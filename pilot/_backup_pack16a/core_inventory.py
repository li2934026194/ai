"""库存与补货：服务水平反推、z 查表、sigma、SS / ROP / 目标水位、两步取整。

最需要照抄契约 3.4 的地方：
- critical_ratio 截断到 [0.90, 0.97]，不是 0.99；
- per_unit_holding_cost 的 obsolescence 默认 0.08；
- order_qty 两步取整：raw → max(raw, moq) → ceil(pack)，
  验算 raw=130 / moq=120 / pack=60 得 180（不是 240）。
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional

from . import InventoryParams, InvalidParams, Suggestion  # re-export 契约类型
from .backtest import backtest
from .models import MODELS
from .simulate import estimate_loss, simulate_stockout


def per_unit_shortage_cost(price, unit_cost, cu_multiplier=1.5) -> Optional[float]:
    """= (price - unit_cost) * cu_multiplier；任一为 None → None（交上层降级）。"""
    if price is None or unit_cost is None:
        return None
    return (float(price) - float(unit_cost)) * float(cu_multiplier)


def per_unit_holding_cost(
    unit_cost, holding_rate=0.25, obsolescence=0.08, holding_days=45
) -> Optional[float]:
    """= unit_cost * (holding_rate + obsolescence) / 365 * holding_days；缺成本 → None。"""
    if unit_cost is None:
        return None
    return float(unit_cost) * (float(holding_rate) + float(obsolescence)) / 365.0 * float(holding_days)


def _coerce_date(value) -> Optional[date]:
    """把 date / datetime / ISO 字符串统一成 date（两个壳传入的日期类型不一样）。"""
    if value is None:
        return None
    if hasattr(value, "date") and callable(value.date):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return value


def gross_margin_rate(price, unit_cost) -> Optional[float]:
    """毛利率 = (售价 - 单件成本) / 售价；缺一 / 售价非正 / 负毛利 → None。

    断货损失只算「少赚的毛利」，所以需要毛利率；缺成本时不估算（交上层降级为 null）。
    """
    if price is None or unit_cost is None:
        return None
    sell = float(price)
    if sell <= 0:
        return None
    rate = (sell - float(unit_cost)) / sell
    return rate if rate > 0 else None


def raw_critical_ratio(cu, co) -> Optional[float]:
    """不截断的纯 cu/(cu+co)，供 T-16 双断言与界面「反推 {raw:.1%}」使用。"""
    if cu is None or co is None:
        return None
    denominator = float(cu) + float(co)
    if denominator == 0:
        return None
    return float(cu) / denominator


def critical_ratio(cu, co, clip=(0.90, 0.97)) -> Optional[float]:
    """截断到 clip（默认 [0.90, 0.97]）；cu/co 任一 None → None。"""
    ratio = raw_critical_ratio(cu, co)
    if ratio is None:
        return None
    lower, upper = clip
    return min(max(ratio, lower), upper)


def resolve_service_level(inv: InventoryParams) -> tuple[Optional[float], float, str]:
    """返回 (raw_ratio, adopted_level, source)，界面文案的数据来源。

    - service_level 显式给定 → (level, level, "manual")
    - 缺成本导致 cu/co 为 None → (None, 0.95, "default_missing_cost")
      （0.95 是契约明文规定的降级默认值，是本函数唯一源头，界面禁止另写死）
    - 否则 → (raw, critical_ratio(raw), "cost_reverse")
    """
    if inv.service_level is not None:
        level = float(inv.service_level)
        return (level, level, "manual")

    cu = per_unit_shortage_cost(inv.price, inv.unit_cost, inv.cu_multiplier)
    co = per_unit_holding_cost(
        inv.unit_cost, inv.holding_rate, inv.obsolescence, inv.holding_days
    )
    if cu is None or co is None:
        return (None, 0.95, "default_missing_cost")

    return (raw_critical_ratio(cu, co), critical_ratio(cu, co), "cost_reverse")


def z_from_service(level: float) -> float:
    """查表 + 线性插值。锚点: 0.90→1.2816 0.95→1.6449 0.97→1.8808 0.99→2.3263。
    超出 [0.90, 0.99] → 抛 InvalidParams。"""
    anchors = [(0.90, 1.2816), (0.95, 1.6449), (0.97, 1.8808), (0.99, 2.3263)]
    value = float(level)
    if value < anchors[0][0] or value > anchors[-1][0]:
        raise InvalidParams(f"service level {value} out of [{anchors[0][0]}, {anchors[-1][0]}]")
    for (low_x, low_y), (high_x, high_y) in zip(anchors, anchors[1:]):
        if low_x <= value <= high_x:
            return low_y + (value - low_x) * (high_y - low_y) / (high_x - low_x)
    return anchors[-1][1]


def sigma_from_residuals(y, yhat) -> float:
    """sigma_日 取自合并残差的 std(ddof=1)，不是原始销量 sigma（P2/C7）。"""
    residuals: list[float] = []
    for actual, predicted in zip(y, yhat):
        if actual is None or predicted is None:
            continue
        try:
            a = float(actual)
            p = float(predicted)
        except (TypeError, ValueError):
            continue
        if math.isnan(a) or math.isnan(p):
            continue
        residuals.append(a - p)
    if len(residuals) < 2:
        return 0.0
    mean = sum(residuals) / len(residuals)
    variance = sum((value - mean) ** 2 for value in residuals) / (len(residuals) - 1)
    return math.sqrt(variance)


def sigma_over_lead_time(sigma_daily: float, lead_time: int, ar1: float = 0.0) -> float:
    """= sigma_daily * sqrt(lead_time)；|ar1| > 0.3 时再放大 1.2 倍。"""
    value = float(sigma_daily) * math.sqrt(float(lead_time))
    if abs(float(ar1)) > 0.3:
        value *= 1.2
    return value


def safety_stock(z, sigma_daily, lead_time, ar1=0.0) -> float:
    """SS = z * sigma_LT。"""
    return float(z) * sigma_over_lead_time(sigma_daily, lead_time, ar1)


def reorder_point(mu_daily, lead_time, ss) -> float:
    """ROP = mu_daily * lead_time + SS。"""
    return float(mu_daily) * float(lead_time) + float(ss)


def target_level(mu_daily, lead_time, review_period, ss) -> float:
    """目标 S = mu_daily * (lead_time + review_period) + SS。"""
    return float(mu_daily) * (float(lead_time) + float(review_period)) + float(ss)


def order_qty(target, on_hand, in_transit, moq, pack_size) -> tuple[int, Optional[str]]:
    """两步取整（v1.1，13 号原文已作废）：
         raw = max(0, target - on_hand - in_transit)
         if raw <= 0 → (0, "no_replenishment")
         qty = max(raw, moq)                     # MOQ 是下限
         qty = ceil(qty / pack_size) * pack_size # 整箱是粒度
       前置校验: moq < 1 或 pack_size < 1 → InvalidParams；moq % pack_size != 0 → InvalidParams。
       验算: raw=478.3 → 480 ｜ raw=130, moq=120, pack=60 → 180（不是 240）。
    """
    if moq < 1 or pack_size < 1:
        raise InvalidParams("moq and pack_size must both be >= 1")
    if moq % pack_size != 0:
        raise InvalidParams("moq must be a multiple of pack_size")

    raw = max(0.0, float(target) - float(on_hand) - float(in_transit))
    if raw <= 0:
        return (0, "no_replenishment")
    qty = max(raw, float(moq))
    qty = math.ceil(qty / float(pack_size)) * int(pack_size)
    return (int(qty), None)


def build_suggestion(
    series, inv: InventoryParams, on_hand: float, in_transit: float,
    inbound_batches: Optional[list] = None,
) -> Suggestion:
    """两壳共用的唯一补货建议算法（PACK 4 抽取，杜绝 API 与 Agent 分叉）。

    输入：已校准的 DemandSeries + 库存参数 + as_of 时点的在手/在途。
    内部完整走一遍推导链，σ_日 从 best 模型残差真算（不是写死的 3.1），
    lead_time 从 inv.lead_time 取（不是写死的 53）。

    PACK 14（Z1）补三处占位，口径分开、互不冒充：
    - stockout_date / zero_days = 历史断货日（series.is_stockout 数出来的真实天数），
      这是契约口径，也是 /api/p3/sku 曲线里 qty=None 的那些天；
    - lost_amount = estimate_loss(zero_days, mu, price, 毛利率) —— 只算少赚的毛利，
      缺售价/成本时返回 None 并在 inputs_json["lost_amount_reason"] 标注原因；
    - stockout_forward = simulate_stockout(on_hand, 在途批次, mu, 90 天) —— 从今天起
      的前向断货预测，和历史断货天数**不是同一个字段**，不许互相顶替。
    inbound_batches: [(date, qty), ...]，缺省 None = 没有在途批次信息（按 0 处理）。
    """
    bt = backtest(series, MODELS)
    valid = [q for q in series.qty if q is not None]
    mu_daily = sum(valid) / len(valid) if valid else 0.0

    raw_level, adopted_level, source = resolve_service_level(inv)
    z = z_from_service(adopted_level)

    # σ_日 来自最佳模型残差 std(ddof=1)；无最佳模型则 0（不可算，不当 3.1）。
    if bt.best is not None:
        sigma_daily = sigma_from_residuals(
            valid, list(MODELS[bt.best](valid, len(valid)))
        )
    else:
        sigma_daily = 0.0

    sigma_lt = sigma_over_lead_time(sigma_daily, inv.lead_time)
    ss = safety_stock(z, sigma_daily, inv.lead_time)
    rop = reorder_point(mu_daily, inv.lead_time, ss)
    target = target_level(mu_daily, inv.lead_time, inv.review_period, ss)
    raw = max(0.0, target - on_hand - in_transit)
    qty, reason = order_qty(target, on_hand, in_transit, inv.moq, inv.pack_size)
    amount = None if inv.unit_cost is None else round(qty * float(inv.unit_cost), 2)

    # ---- PACK 14 / Z1：历史断货日（契约口径，来自已校准序列，不是模拟值）----
    stockout_days = [_coerce_date(d) for d, flag in zip(series.dates, series.is_stockout) if flag]
    stockout_days = [d for d in stockout_days if d is not None]
    zero_days = len(stockout_days)
    stockout_date = stockout_days[0] if stockout_days else None

    # ---- 断货损失：只算少赚的毛利；缺成本/毛利不可用 → None + 原因（绝不编数）----
    margin = gross_margin_rate(inv.price, inv.unit_cost)
    lost_amount: Optional[float] = None
    lost_reason: Optional[str] = None
    if zero_days == 0:
        lost_amount = 0.0
        lost_reason = "历史无断货日，损失为 0（是真实 0，不是缺数）"
    elif inv.price is None or inv.unit_cost is None:
        lost_reason = "缺售价或单件成本，断货损失无法计算"
    elif margin is None:
        lost_reason = "售价不高于成本或售价非正，毛利率不可用，断货损失无法计算"
    else:
        lost_amount = round(
            estimate_loss(zero_days, mu_daily, inv.price, margin), 2
        )

    # ---- 前向断货预测（从今天起 90 天），与历史断货天数分开存放，不互相顶替 ----
    forward = simulate_stockout(on_hand, inbound_batches or [], mu_daily, horizon=90)
    forward_out = {
        "horizon_days": 90,
        "first_zero_date": forward["first_zero_date"].isoformat()
        if forward["first_zero_date"] is not None else None,
        "zero_days": forward["zero_days"],
        "coverage_days": forward["coverage_days"],
        "inbound_batch_count": len(inbound_batches or []),
        "on_hand": float(on_hand),
    }

    return Suggestion(
        sku=series.sku,
        qty=qty,
        amount=amount,
        service_level=adopted_level,
        raw_service_level=raw_level,
        service_level_source=source,
        z=z,
        sigma_lt=sigma_lt,
        ss=ss,
        rop=rop,
        target_s=target,
        on_hand=on_hand,
        in_transit=in_transit,
        stockout_date=stockout_date,
        zero_days=zero_days,
        lost_amount=lost_amount,
        reason=reason,
        inputs_json={
            "mu_daily": mu_daily,
            "sigma_daily": sigma_daily,
            "raw": raw,
            "best": bt.best,
            "lead_time": inv.lead_time,
            "review_period": inv.review_period,
            "holding_days": inv.holding_days,
            # PACK 14 / Z1 新增（只加键，不改上面的既有键）
            "stockout_source": "sales_daily(qty=None 的历史断货日)",
            "stockout_first_date": stockout_date.isoformat() if stockout_date else None,
            "stockout_zero_days": zero_days,
            "lost_amount": lost_amount,
            "lost_amount_reason": lost_reason,
            "gross_margin_rate": round(margin, 4) if margin is not None else None,
            "stockout_forward": forward_out,
        },
    )


__all__ = [
    "InventoryParams",
    "Suggestion",
    "per_unit_shortage_cost",
    "per_unit_holding_cost",
    "gross_margin_rate",
    "raw_critical_ratio",
    "critical_ratio",
    "resolve_service_level",
    "z_from_service",
    "sigma_from_residuals",
    "sigma_over_lead_time",
    "safety_stock",
    "reorder_point",
    "target_level",
    "order_qty",
    "build_suggestion",
]
