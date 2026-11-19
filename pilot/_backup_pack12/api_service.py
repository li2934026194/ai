"""取数 + 调 core 的唯一数据入口（api/service.py，PACK 4）。

职责边界（17 号契约铁律二）：
- 这里只做三件事：从 SQLite 读行 → 拼成 core 要的 duck-typed 结构 → 调 core 纯函数；
- 绝不出现 σ、z、ceil、安全库存、两步取整这些公式——它们只在 core 出现；
- 绝不 import agents.tools（本地 pilot/agents 与 openai-agents SDK 同名会撞包），
  本模块直接用 sqlalchemy 会话读库，再调 core.demand / core.backtest / core.inventory。

结构化错误约定（17 号 3.5）：
- E-1001 数据不足 / E-1003 SKU 不存在 → 抛 ServiceError，main 层转 JSON；
- E-1002 缺成本 → 金额字段返回 null（不是错误，是诚实缺省）；
- E-1004 断货占比高 → 不是错误，是 warning 字段，正常返回结果。
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core import EmptyData, InsufficientHistory, InventoryParams, build_route_plan
from core.backtest import backtest
from core.demand import calibrate_demand
from core.inventory import build_suggestion
from core.models import MODELS
from db import get_session
from schema import AgentRuns, Datasets, InventoryDaily, Products, SalesDaily


# 需求历史下限（E-1001 的 required 值），唯一来源是 core.calibrate_demand 的默认值。
MIN_HISTORY = 60


class ServiceError(Exception):
    """带结构化 code 的业务异常，main 层据此返回 JSON，绝不 500。"""

    def __init__(self, code: str, message: str, available: Optional[int] = None):
        self.code = code
        self.message = message
        self.available = available
        super().__init__(message)


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------
def _dataset_row(session: Session, dataset_id: str) -> Datasets:
    row = session.get(Datasets, dataset_id)
    if row is None:
        raise ServiceError("E-1003", f"数据集 {dataset_id} 不存在", None)
    return row


def _as_of(session: Session, dataset_id: str) -> str:
    """数据截止日 = 该数据集销量表最大 date；空表退回 dataset 创建日。"""
    max_date = session.execute(
        select(func.max(SalesDaily.date)).where(SalesDaily.dataset_id == dataset_id)
    ).scalar()
    if max_date is None:
        return _dataset_row(session, dataset_id).created_at.date().isoformat()
    if isinstance(max_date, date):
        return max_date.isoformat()
    return str(max_date)


def _series(session: Session, dataset_id: str, sku: str):
    """calibrate_demand 包装：把 core 异常翻译成结构化 ServiceError。"""
    daily = [
        {"sku": r.sku, "date": r.date, "qty_raw": r.qty, "source_type": r.source_type}
        for r in session.execute(
            select(SalesDaily)
            .where(SalesDaily.dataset_id == dataset_id, SalesDaily.sku == sku)
            .order_by(SalesDaily.date)
        ).scalars()
    ]
    if not daily:
        raise ServiceError("E-1003", "这个数据集里没有这个 SKU 的订单记录", None)
    inventory = [
        {"sku": r.sku, "date": r.date, "on_hand": r.on_hand, "in_transit": r.in_transit}
        for r in session.execute(
            select(InventoryDaily)
            .where(InventoryDaily.dataset_id == dataset_id, InventoryDaily.sku == sku)
            .order_by(InventoryDaily.date)
        ).scalars()
    ]
    try:
        return calibrate_demand(daily, inventory, sku, min_history=MIN_HISTORY)
    except EmptyData as exc:
        raise ServiceError("E-1003", "这个数据集里没有这个 SKU 的订单记录", None) from exc
    except InsufficientHistory as exc:
        raise ServiceError(
            "E-1001",
            f"数据只有 {exc.available} 天，至少要 {exc.required} 天才能预测",
            exc.available,
        ) from exc


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------
def health() -> dict:
    import sqlalchemy

    session = get_session()
    try:
        count = session.execute(select(func.count()).select_from(Datasets)).scalar_one()
    finally:
        session.close()
    return {
        "status": "ok",
        "dataset_count": int(count),
        "sqlalchemy_version": sqlalchemy.__version__,
    }


# ---------------------------------------------------------------------------
# GET /api/datasets
# ---------------------------------------------------------------------------
def list_datasets() -> list[dict]:
    session = get_session()
    try:
        return [
            {
                "id": r.dataset_id,
                "name": r.name,
                "source_type": r.source_type,
                "created_at": r.created_at.isoformat(),
            }
            for r in session.execute(select(Datasets).order_by(Datasets.name)).scalars()
        ]
    finally:
        session.close()


# ---------------------------------------------------------------------------
# 内部：单 SKU 的完整推导（P1/P2/P3 共用）
# ---------------------------------------------------------------------------
def _sku_detail(session: Session, dataset_id: str, sku: str) -> dict:
    """给定 dataset 与 sku，跑回测 + 库存推导，返回完整详情 dict。"""
    series = _series(session, dataset_id, sku)
    p = session.execute(
        select(Products).where(Products.dataset_id == dataset_id, Products.sku == sku)
    ).scalar_one_or_none()
    if p is None:
        raise ServiceError("E-1003", "这个数据集里没有这个 SKU 的订单记录", None)

    bt = backtest(series, MODELS)

    inv = InventoryParams(
        unit_cost=p.unit_cost,
        price=p.price,
        moq=p.moq,
        pack_size=p.pack_size,
        lead_prod=p.lead_prod,
        lead_transit=p.lead_transit,
        lead_customs=p.lead_customs,
        lead_inbound=p.lead_inbound,
        review_period=15,
        holding_days=45,
    )

    last_inv = session.execute(
        select(InventoryDaily)
        .where(InventoryDaily.dataset_id == dataset_id, InventoryDaily.sku == sku)
        .order_by(InventoryDaily.date.desc())
        .limit(1)
    ).scalar_one_or_none()
    on_hand = float(last_inv.on_hand) if last_inv else 0.0
    in_transit = float(last_inv.in_transit) if last_inv else 0.0

    # ---- 唯一建议算法：调 core.build_suggestion（与 tools.py 共用，杜绝分叉）----
    sug = build_suggestion(series, inv, on_hand, in_transit)
    ctx: dict = sug.inputs_json
    mu_daily = float(ctx["mu_daily"])
    raw = float(ctx["raw"])
    qty = int(sug.qty)
    capital = sug.amount

    # 断货风险分级：按「能不能撑过交期」判，而不是拿「要不要补货」反推。
    # days_left = on_hand / mu_daily；lead_time 从推导链取。
    days_left = sug.on_hand / mu_daily if mu_daily > 0 else None
    lead_time = int(ctx["lead_time"])
    if on_hand <= 0:
        stock_risk = "STOCKOUT"          # 已断货（在手为 0）
    elif days_left is not None and days_left < lead_time:
        stock_risk = "RISK"              # 会在交期内断货
    elif days_left is not None and days_left < lead_time * 1.2:
        stock_risk = "WATCH"             # 接近交期，需关注
    else:
        stock_risk = "LOW"               # 安全（能撑过交期，即便有 MOQ 补货也是安全冗余）

    warning = None
    if series.warning == "stockout_ratio_high":
        warning = {"code": "E-1004", "message": "断货天数占比过高，预测与建议量仅供参考"}

    # S1 曲线：date / qty(断货 None) / on_hand 逐日。
    on_hand_map = {
        r.date: float(r.on_hand)
        for r in session.execute(
            select(InventoryDaily.date, InventoryDaily.on_hand).where(
                InventoryDaily.dataset_id == dataset_id, InventoryDaily.sku == sku
            )
        ).all()
    }
    series_out = [
        {"date": d.isoformat(), "qty": q, "on_hand": on_hand_map.get(d, 0.0)}
        for d, q in zip(series.dates, series.qty)
    ]

    per_model = {
        name: {
            "wape": m.wape,
            "bias": m.bias,
            "mae": m.mae,
            "n_obs": m.n_obs,
        }
        for name, m in bt.per_model.items()
    }

    return {
        "meta": {
            "source_type": _dataset_row(session, dataset_id).source_type,
            "as_of": _as_of(session, dataset_id),
            "method": bt.method,
        },
        "sku": sku,
        "best_model": bt.best,
        "series": series_out,
        "per_model": per_model,
        "derivation": {
            "mu_daily": round(mu_daily, 4),
            "sigma_daily": round(float(ctx["sigma_daily"]), 4),
            "sigma_lt": round(sug.sigma_lt, 4),
            "z": round(sug.z, 4),
            "lead_time": int(ctx["lead_time"]),
            "review_period": int(ctx["review_period"]),
            "ss": round(sug.ss, 4),
            "rop": round(sug.rop, 4),
            "target": round(sug.target_s, 4),
            "raw": round(raw, 4),
            "qty": int(qty),
            "on_hand": round(sug.on_hand, 4),
            "in_transit": round(sug.in_transit, 4),
            "days_left": round(days_left, 2) if days_left is not None else None,
        },
        "service_level": round(sug.service_level, 4),
        "service_level_source": sug.service_level_source,
        "capital": capital,
        "stock_risk": stock_risk,
        "warning": warning,
    }


# ---------------------------------------------------------------------------
# GET /api/p1/dashboard
# ---------------------------------------------------------------------------
def dashboard(dataset_id: str) -> dict:
    session = get_session()
    try:
        meta = {
            "source_type": _dataset_row(session, dataset_id).source_type,
            "as_of": _as_of(session, dataset_id),
            "method": "rolling",
        }
        skus = [
            r[0]
            for r in session.execute(
                select(Products.sku).where(Products.dataset_id == dataset_id)
            ).all()
        ]
        pending = 0
        stockout_risk = 0
        total_capital = 0.0
        for sku in skus:
            try:
                detail = _sku_detail(session, dataset_id, sku)
            except ServiceError:
                # E-1001（数据不足）的 SKU 无法预测，跳过汇总。
                continue
            if detail["derivation"]["qty"] > 0:
                pending += 1
            if detail["stock_risk"] == "STOCKOUT":
                stockout_risk += 1
            total_capital += detail["capital"] or 0.0
        agent_runs_today = session.execute(
            select(func.count()).select_from(AgentRuns)
        ).scalar_one()
        return {
            "meta": meta,
            "kpi": {
                "pending_sku_count": pending,
                "stockout_risk_count": stockout_risk,
                "total_capital": round(total_capital, 2),
                "agent_runs_today": int(agent_runs_today),
            },
        }
    finally:
        session.close()


# ---------------------------------------------------------------------------
# GET /api/p2/skus
# ---------------------------------------------------------------------------
def list_skus(dataset_id: str, rank: int = 20) -> dict:
    session = get_session()
    try:
        meta = {
            "source_type": _dataset_row(session, dataset_id).source_type,
            "as_of": _as_of(session, dataset_id),
            "method": "rolling",
        }
        rows: list[dict] = []
        for p in session.execute(
            select(Products).where(Products.dataset_id == dataset_id)
        ).scalars():
            try:
                detail = _sku_detail(session, dataset_id, p.sku)
            except ServiceError:
                continue
            rows.append(
                {
                    "sku": p.sku,
                    "title": p.title,
                    "daily_avg": round(detail["derivation"]["mu_daily"], 2),
                    "on_hand": detail["derivation"]["on_hand"],
                    "in_transit": detail["derivation"]["in_transit"],
                    "days_left": detail["derivation"]["days_left"],
                    "stock_risk": detail["stock_risk"],
                    "qty": detail["derivation"]["qty"],
                    "capital": detail["capital"],
                }
            )
        rows.sort(key=lambda r: r["daily_avg"], reverse=True)
        return {"meta": meta, "skus": rows[:rank]}
    finally:
        session.close()


# ---------------------------------------------------------------------------
# GET /api/p3/sku/{sku}
# ---------------------------------------------------------------------------
def sku_detail(dataset_id: str, sku: str) -> dict:
    session = get_session()
    try:
        return _sku_detail(session, dataset_id, sku)
    finally:
        session.close()


# ---------------------------------------------------------------------------
# GET /api/p3/route-plan（PACK 11：多路线方案对比 + 三目标决策）
# 只新增端点：基础输入全部复用 _sku_detail 的既有推导链，公式只在 core.routes。
# ---------------------------------------------------------------------------
def route_plan(dataset_id: str, sku: str) -> dict:
    session = get_session()
    try:
        # 复用既有推导链（含 E-1001 / E-1003 结构化错误），绝不重算 σ/SS/ROP/qty。
        detail = _sku_detail(session, dataset_id, sku)
        p = session.execute(
            select(Products).where(
                Products.dataset_id == dataset_id, Products.sku == sku
            )
        ).scalar_one_or_none()
        if p is None:
            raise ServiceError("E-1003", "这个数据集里没有这个 SKU 的订单记录", None)

        dv = detail["derivation"]
        plan = build_route_plan(
            mu_daily=dv["mu_daily"],
            sigma_daily=dv["sigma_daily"],
            lead_time=dv["lead_time"],
            review_period=dv["review_period"],
            on_hand=dv["on_hand"],
            in_transit=dv["in_transit"],
            base_qty=dv["qty"],
            moq=p.moq,
            pack_size=p.pack_size,
            unit_cost=p.unit_cost,
        )

        return {
            "meta": detail["meta"],
            "sku": detail["sku"],
            "base": {
                "mu_daily": dv["mu_daily"],
                "on_hand": dv["on_hand"],
                "in_transit": dv["in_transit"],
                "cover_days": plan["cover_days"],
                "base_qty": dv["qty"],
                "base_capital": detail["capital"],
                "service_level": detail["service_level"],
                "lead_time": dv["lead_time"],
                "review_period": dv["review_period"],
                "sigma_daily": dv["sigma_daily"],
                "moq": p.moq,
                "pack_size": p.pack_size,
                "unit_cost": p.unit_cost,
            },
            "assumption_note": plan["assumption_note"],
            "routes": plan["routes"],
            "objectives": plan["objectives"],
        }
    finally:
        session.close()
