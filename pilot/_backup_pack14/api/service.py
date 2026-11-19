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

from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core import EmptyData, InsufficientHistory, InventoryParams, build_route_plan
from core import (
    OBJECTIVE_ASSUMPTIONS,
    ROUTE_ASSUMPTIONS,
    STATUS_LABELS,
    FlowError,
    replenish_flow,
)
from core.backtest import backtest
from core.demand import calibrate_demand
from core.inventory import build_suggestion
from core.models import MODELS
from db import get_session
from schema import AgentRuns, Datasets, InventoryDaily, Products, SalesDaily
from schema import PurchaseOrder, ReplenishApply


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


# ===========================================================================
# PACK 12：补货申请 → 多级审批 → 采购单 → 收货质检
# ---------------------------------------------------------------------------
# 【合成演示业务，非真实生产业务】
# 本段只做「读库 → 调 core.replenish_flow 纯状态机 → 落库」，状态流转规则与
# 数量校验一律在 core/replenish_flow.py，绝不在壳层重复实现（更不写死状态）。
# 既有函数（_sku_detail / dashboard / list_skus / route_plan）一行未改。
# ===========================================================================

# core 的 FlowError 码 → 前端约定的 E 码（errorCodes.js 里同步登记）
_FLOW_ERROR_CODE: dict[str, str] = {
    "F-2001": "E-1103",   # 非法状态流转
    "F-2002": "E-1104",   # 驳回必须填理由
    "F-2003": "E-1105",   # 数量 / 必填项校验
}


def _guard_flow(fn, *args, **kwargs):
    """把 core 的 FlowError 翻译成结构化 ServiceError（HTTP 200，不 500）。"""
    try:
        return fn(*args, **kwargs)
    except FlowError as exc:
        raise ServiceError(_FLOW_ERROR_CODE.get(exc.code, "E-1103"), exc.message) from exc


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _new_apply_id() -> str:
    return f"{replenish_flow.APPLY_ID_PREFIX}{uuid4().hex[:16]}"


def _new_po_id() -> str:
    return f"{replenish_flow.PO_ID_PREFIX}{uuid4().hex[:16]}"


def _lead_time(session: Session, dataset_id: str, sku: str) -> int:
    """该 SKU 的四段总交期（用于算采购单预计到货日）；查不到按 0（当天到）。"""
    p = session.execute(
        select(Products).where(Products.dataset_id == dataset_id, Products.sku == sku)
    ).scalar_one_or_none()
    if p is None:
        return 0
    return int(p.lead_prod + p.lead_transit + p.lead_customs + p.lead_inbound)


def _po_row_of_apply(session: Session, apply_id: str) -> Optional[PurchaseOrder]:
    return session.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.apply_id == apply_id)
        .order_by(PurchaseOrder.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _po_dict(row: PurchaseOrder) -> dict:
    return {
        "po_id": row.po_id,
        "apply_id": row.apply_id,
        "sku_id": row.sku_id,
        "order_qty": int(row.order_qty),
        "receive_qty": int(row.receive_qty),
        "defect_qty": int(row.defect_qty),
        "status": row.status,
        "status_label": STATUS_LABELS.get(row.status, row.status),
        "expect_arrive": row.expect_arrive.isoformat() if row.expect_arrive else None,
        "actual_arrive": _iso(row.actual_arrive),
        "created_at": _iso(row.created_at) or "",
    }


def _apply_dict(session: Session, row: ReplenishApply) -> dict:
    po = _po_row_of_apply(session, row.apply_id)
    return {
        "apply_id": row.apply_id,
        "sku_id": row.sku_id,
        "dataset_id": row.dataset_id,
        "qty_propose": int(row.qty_propose),
        "capital": row.capital,
        "route_code": row.route_code,
        "objective_mode": row.objective_mode,
        "status": row.status,
        "status_label": STATUS_LABELS.get(row.status, row.status),
        "submit_user": row.submit_user,
        "submit_at": _iso(row.submit_at) or "",
        "approve_user": row.approve_user,
        "approve_at": _iso(row.approve_at),
        "reject_reason": row.reject_reason,
        "purchase_order": _po_dict(po) if po is not None else None,
    }


def _get_apply(session: Session, apply_id: str) -> ReplenishApply:
    row = session.get(ReplenishApply, apply_id)
    if row is None:
        raise ServiceError("E-1101", f"补货申请 {apply_id} 不存在", None)
    return row


def _get_po(session: Session, po_id: str) -> PurchaseOrder:
    row = session.get(PurchaseOrder, po_id)
    if row is None:
        raise ServiceError("E-1102", f"采购单 {po_id} 不存在", None)
    return row


def _apply_as_dict(row: ReplenishApply) -> dict:
    """把 ORM 行转成 core 状态机要的 Mapping（只读快照，避免状态机依赖 ORM）。"""
    return {
        "apply_id": row.apply_id,
        "sku_id": row.sku_id,
        "dataset_id": row.dataset_id,
        "qty_propose": int(row.qty_propose),
        "route_code": row.route_code,
        "objective_mode": row.objective_mode,
        "status": row.status,
        "approve_at": row.approve_at,
    }


def _po_as_dict(row: PurchaseOrder) -> dict:
    return {
        "po_id": row.po_id,
        "apply_id": row.apply_id,
        "sku_id": row.sku_id,
        "order_qty": int(row.order_qty),
        "receive_qty": int(row.receive_qty),
        "defect_qty": int(row.defect_qty),
        "status": row.status,
        "actual_arrive": row.actual_arrive,
    }


def _flow_receipt(
    session: Session,
    *,
    action: str,
    operator: str,
    now: datetime,
    message: str,
    apply_row: ReplenishApply,
    po_row: Optional[PurchaseOrder],
) -> dict:
    return {
        "operator": operator,
        "operated_at": now.isoformat(),
        "action": action,
        "message": message,
        "apply": _apply_dict(session, apply_row),
        "purchase_order": _po_dict(po_row) if po_row is not None else None,
    }


def create_apply(
    dataset_id: str,
    sku: str,
    *,
    qty_propose: Optional[int] = None,
    route_code: str = "sea",
    objective_mode: str = "profit",
    submit_user: str = "demo_submitter",
    submit: bool = True,
) -> dict:
    """提交补货申请：先落 draft，再按 submit 决定是否立刻转 pending_approve。

    qty_propose 不传时取该 SKU 的实时建议量（core.build_suggestion 的唯一结果），
    capital 同理取建议金额；缺成本时 capital 为 None（绝不落 0）。
    """
    session = get_session()
    try:
        _dataset_row(session, dataset_id)  # 数据集不存在 → E-1003
        if route_code not in ROUTE_ASSUMPTIONS:
            raise ServiceError("E-1105", f"未知运输路线 {route_code!r}", None)
        if objective_mode not in OBJECTIVE_ASSUMPTIONS:
            raise ServiceError("E-1105", f"未知决策目标 {objective_mode!r}", None)

        capital: Optional[float]
        if qty_propose is None:
            detail = _sku_detail(session, dataset_id, sku)
            qty = int(detail["derivation"]["qty"])
            capital = detail["capital"]
        else:
            qty = int(qty_propose)
            p = session.execute(
                select(Products).where(
                    Products.dataset_id == dataset_id, Products.sku == sku
                )
            ).scalar_one_or_none()
            capital = None
            if p is not None and p.unit_cost is not None:
                capital = round(qty * float(p.unit_cost), 2)

        if qty <= 0:
            raise ServiceError(
                "E-1106",
                f"该 SKU 本轮建议量为 {qty} 件（无需补货），不能提交补货申请",
                None,
            )

        now = datetime.now()
        row = ReplenishApply(
            apply_id=_new_apply_id(),
            sku_id=sku,
            dataset_id=dataset_id,
            qty_propose=qty,
            capital=capital,
            route_code=route_code,
            objective_mode=objective_mode,
            status=replenish_flow.APPLY_DRAFT,
            submit_user=submit_user,
            submit_at=now,
            approve_user=None,
            approve_at=None,
            reject_reason=None,
        )
        session.add(row)
        session.flush()

        if submit:
            changes = _guard_flow(
                replenish_flow.submit_apply,
                _apply_as_dict(row),
                submit_user=submit_user,
                now=now,
            )
            for key, value in changes.items():
                setattr(row, key, value)
        session.commit()

        message = (
            f"申请 {row.apply_id} 已提交，状态 {STATUS_LABELS[row.status]}，等待审批"
            if submit
            else f"申请 {row.apply_id} 已保存为草稿（未提交审批）"
        )
        return _flow_receipt(
            session,
            action="submit" if submit else "draft",
            operator=submit_user,
            now=now,
            message=message,
            apply_row=row,
            po_row=None,
        )
    finally:
        session.close()


def approve_apply(apply_id: str, *, approve_user: str = "demo_approver") -> dict:
    """审批通过：申请 → approved，同一事务内自动生成采购单（order_qty = qty_propose）。"""
    session = get_session()
    try:
        row = _get_apply(session, apply_id)
        now = datetime.now()
        po_id = _new_po_id()
        result = _guard_flow(
            replenish_flow.approve_apply,
            _apply_as_dict(row),
            approve_user=approve_user,
            now=now,
            po_id=po_id,
            lead_time_days=_lead_time(session, row.dataset_id, row.sku_id),
        )
        for key, value in result["apply"].items():
            setattr(row, key, value)

        po_payload = result["purchase_order"]
        po = PurchaseOrder(**po_payload)
        session.add(po)
        session.commit()
        return _flow_receipt(
            session,
            action="approve",
            operator=approve_user,
            now=now,
            message=(
                f"申请 {apply_id} 已通过，自动生成采购单 {po.po_id}"
                f"（订单量 {int(po.order_qty)} 件，预计 {po.expect_arrive} 到货）"
            ),
            apply_row=row,
            po_row=po,
        )
    finally:
        session.close()


def reject_apply(
    apply_id: str, *, approve_user: str = "demo_approver", reject_reason: str = ""
) -> dict:
    """审批驳回：申请 → rejected；驳回理由为空直接拦截（E-1104）。"""
    session = get_session()
    try:
        row = _get_apply(session, apply_id)
        now = datetime.now()
        changes = _guard_flow(
            replenish_flow.reject_apply,
            _apply_as_dict(row),
            approve_user=approve_user,
            now=now,
            reject_reason=reject_reason,
        )
        for key, value in changes.items():
            setattr(row, key, value)
        session.commit()
        return _flow_receipt(
            session,
            action="reject",
            operator=approve_user,
            now=now,
            message=f"申请 {apply_id} 已驳回，理由：{row.reject_reason}",
            apply_row=row,
            po_row=None,
        )
    finally:
        session.close()


def ship_po(po_id: str, *, operator: str = "demo_shipper") -> dict:
    """采购单发货：created → shipping（只改状态，不动数量）。"""
    session = get_session()
    try:
        po = _get_po(session, po_id)
        now = datetime.now()
        changes = _guard_flow(replenish_flow.mark_shipping, _po_as_dict(po))
        for key, value in changes.items():
            setattr(po, key, value)
        session.commit()
        apply_row = _get_apply(session, po.apply_id)
        return _flow_receipt(
            session,
            action="ship",
            operator=operator,
            now=now,
            message=f"采购单 {po_id} 已标记运输中",
            apply_row=apply_row,
            po_row=po,
        )
    finally:
        session.close()


def receive_po_goods(
    po_id: str,
    receive_qty: int,
    defect_qty: int = 0,
    *,
    operator: str = "demo_receiver",
) -> dict:
    """收货质检：累计实收/不良品 → 部分收货或完全收货；收满后申请自动 closed。"""
    session = get_session()
    try:
        po = _get_po(session, po_id)
        now = datetime.now()
        result = _guard_flow(
            replenish_flow.receive_goods,
            _po_as_dict(po),
            receive_qty=receive_qty,
            defect_qty=defect_qty,
            now=now,
        )
        for key, value in result["purchase_order"].items():
            setattr(po, key, value)

        apply_row = _get_apply(session, po.apply_id)
        if result["fully_received"]:
            close_changes = _guard_flow(
                replenish_flow.close_apply, _apply_as_dict(apply_row), now=now
            )
            for key, value in close_changes.items():
                setattr(apply_row, key, value)

        session.commit()
        message = (
            f"采购单 {po_id} 本次实收 {int(receive_qty)} 件（不良 {int(defect_qty)} 件），"
            f"累计实收 {int(po.receive_qty)}/{int(po.order_qty)} 件，状态 "
            f"{STATUS_LABELS[po.status]}"
            + ("，对应申请已关闭" if result["fully_received"] else f"，还剩 {result['remaining_qty']} 件未到")
        )
        return _flow_receipt(
            session,
            action="receive",
            operator=operator,
            now=now,
            message=message,
            apply_row=apply_row,
            po_row=po,
        )
    finally:
        session.close()


def list_applies(
    dataset_id: str,
    *,
    sku: str | None = None,
    status: str | None = None,
    limit: int = 100,
) -> dict:
    """申请列表（按提交时间倒序）：供 P2/P3 页面直接渲染，状态文案由后端下发。"""
    session = get_session()
    try:
        _dataset_row(session, dataset_id)
        stmt = select(ReplenishApply).where(ReplenishApply.dataset_id == dataset_id)
        if sku:
            stmt = stmt.where(ReplenishApply.sku_id == sku)
        if status:
            if status not in replenish_flow.APPLY_STATUSES:
                raise ServiceError("E-1105", f"未知申请状态 {status!r}", None)
            stmt = stmt.where(ReplenishApply.status == status)
        stmt = stmt.order_by(ReplenishApply.submit_at.desc()).limit(int(limit))
        rows = session.execute(stmt).scalars().all()
        return {"total": len(rows), "applies": [_apply_dict(session, r) for r in rows]}
    finally:
        session.close()
