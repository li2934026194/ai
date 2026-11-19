"""多路线方案对比 + 三目标决策（core/routes.py，PACK 11）。

铁律（与 core 包一致）：
1. 本模块是纯计算，绝不 import UI / ORM / Web 框架；
2. 所有业务输出（时效、总运费、剩余可撑天数、缺货风险、建议量、资金占用）
   一律由入参实时计算，绝不写死任何路线结果或建议量；
3. 既有 core 算法（z / SS / ROP / target / 两步取整）只**复用调用**，不修改一行。

复用方式采用函数内延迟 import，避免 core/__init__.py 在末尾导出本模块时
与 core.inventory 形成包初始化期的循环依赖。
"""

from __future__ import annotations

from typing import Optional

from . import InvalidParams

# ===========================================================================
# 合成假设参数（唯一定义处 · 全部为演示用合成数值，不是真实物流报价）
# ---------------------------------------------------------------------------
# 以下 ROUTE_ASSUMPTIONS / OBJECTIVE_ASSUMPTIONS 均为「合成假设参数」：
#   - 运输时效 transit_days：已含起运 + 干线 + 清关 + 入仓，单位天；
#   - 单件运费 unit_freight：合成假设 ¥/件；
#   - 最小起运量 min_qty：合成假设 件；
#   - 可靠性 reliability：合成假设按时到货概率（0~1），用于缺货风险折算；
#   - 三目标的 service_level / review_factor 同为合成假设的决策偏好参数。
# 用途仅限课程演示的方案对比，不得对外表述为真实承运商报价或真实收益。
# ===========================================================================

ROUTE_ASSUMPTIONS: dict[str, dict] = {
    "sea": {
        "name": "海运",
        "transit_days": 45,       # 合成假设参数：含起运与清关的运输时效（天）
        "unit_freight": 2.5,      # 合成假设参数：单件运费（¥/件）
        "min_qty": 500,           # 合成假设参数：最小起运量（件）
        "reliability": 0.72,      # 合成假设参数：按时到货可靠性
    },
    "air": {
        "name": "空运",
        "transit_days": 7,
        "unit_freight": 18.0,
        "min_qty": 50,
        "reliability": 0.97,
    },
    "rail": {
        "name": "铁运",
        "transit_days": 22,
        "unit_freight": 6.0,
        "min_qty": 200,
        "reliability": 0.90,
    },
    "truck": {
        "name": "卡航",
        "transit_days": 14,
        "unit_freight": 9.5,
        "min_qty": 100,
        "reliability": 0.92,
    },
}

OBJECTIVE_ASSUMPTIONS: dict[str, dict] = {
    "sales": {
        "name": "保销量",
        "service_level": 0.99,    # 合成假设参数：更高服务水平 → 更高安全库存
        "review_factor": 1.5,     # 合成假设参数：补货覆盖周期放大系数
        "driver": "服务水平更高、覆盖周期更长，目标水位抬高",
    },
    "profit": {
        "name": "保利润",
        "service_level": 0.97,    # 合成假设参数：与既有 cost_reverse 基准一致
        "review_factor": 1.0,
        "driver": "基准服务水平与基准覆盖周期，作为对照口径",
    },
    "cash": {
        "name": "保现金",
        "service_level": 0.90,    # 合成假设参数：更低服务水平
        "review_factor": 0.5,     # 合成假设参数：覆盖周期缩短，减少资金占用
        "driver": "服务水平更低、覆盖周期缩短，建议量与资金占用下降",
    },
}

# 风险分级展示阈值（合成假设参数）：只用于把连续 risk_index 映射成中文等级，
# 不参与任何金额/件数计算。
RISK_LEVEL_HIGH = 0.60
RISK_LEVEL_MID = 0.30

ASSUMPTION_NOTE = (
    "运输方式与三目标参数均为合成假设参数（core/routes.py 的 "
    "ROUTE_ASSUMPTIONS / OBJECTIVE_ASSUMPTIONS），不是真实物流报价，"
    "不得据此推断任何收益；仅供课程演示的方案对比。"
)


def _risk_level(index: float) -> str:
    if index >= RISK_LEVEL_HIGH:
        return "高"
    if index >= RISK_LEVEL_MID:
        return "中"
    return "低"


def compare_routes(
    mu_daily: float,
    on_hand: float,
    in_transit: float,
    base_qty: int,
) -> list[dict]:
    """四种运输路线对比。

    缺货风险的计算链（全部由入参实时算出，不含任何写死的路线结果）：
        cover_days = (on_hand + in_transit) / mu_daily      # 现有库存+在途可撑天数
        gap_days   = max(0, transit_days - cover_days)      # 到货前裸露天数
        remaining  = max(0, cover_days - transit_days)       # 到货时剩余可撑天数
        coverage_ratio = cover_days / transit_days
        tension    = 1 / (1 + coverage_ratio)              # 展示用归一化映射系数
        risk_index = min(1, tension * (1 + (1 - reliability)))
    即：风险由「(现有库存+在途)/日均销量」与「路线时效」共同决定，
    再用该路线的合成可靠性放大；不同时效/可靠性必然得到不同结果。

    总运费 = 单件运费 × 实际订量；实际订量 = max(基础建议量, 最小起运量)。
    """
    mu = float(mu_daily)
    if mu <= 0:
        raise InvalidParams("mu_daily must be > 0 to compute route cover days")

    cover_days = (float(on_hand) + float(in_transit)) / mu
    base_qty = int(base_qty)

    rows: list[dict] = []
    for code, p in ROUTE_ASSUMPTIONS.items():
        transit = int(p["transit_days"])
        reliability = float(p["reliability"])
        min_qty = int(p["min_qty"])

        gap_days = max(0.0, float(transit) - cover_days)
        arrival_remaining_days = max(0.0, cover_days - float(transit))
        order_qty = max(base_qty, min_qty)
        total_freight = round(order_qty * float(p["unit_freight"]), 2)

        coverage_ratio = cover_days / float(transit)
        tension = 1.0 / (1.0 + coverage_ratio)
        risk_index = round(min(1.0, tension * (1.0 + (1.0 - reliability))), 4)

        rows.append(
            {
                "code": code,
                "name": p["name"],
                "transit_days": transit,
                "unit_freight": float(p["unit_freight"]),
                "min_qty": min_qty,
                "reliability": reliability,
                "order_qty": order_qty,
                "total_freight": total_freight,
                "cover_days": round(cover_days, 4),
                "gap_days": round(gap_days, 4),
                "arrival_remaining_days": round(arrival_remaining_days, 4),
                "risk_index": risk_index,
                "risk_level": _risk_level(risk_index),
            }
        )

    # 建议文案：由该路线的计算结果生成（不写死任何一条路线的结论）。
    freights = [r["total_freight"] for r in rows]
    cheapest, priciest = min(freights), max(freights)
    for r in rows:
        parts: list[str] = []
        if r["gap_days"] > 0:
            parts.append(f"到货前预计裸露 {r['gap_days']:.1f} 天")
            parts.append("建议提前下单或改时效更短路线")
        else:
            parts.append(f"到货时仍可撑 {r['arrival_remaining_days']:.1f} 天")
        parts.append(f"缺货风险{r['risk_level']}（指数 {r['risk_index']:.2f}）")
        if r["total_freight"] == cheapest:
            parts.append("总运费最低")
        elif r["total_freight"] == priciest:
            parts.append("总运费最高，适合紧急补货")
        if r["order_qty"] > base_qty:
            parts.append(f"受最小起运量约束需订 {r['order_qty']} 件")
        r["recommendation"] = "；".join(parts) + "。"
    return rows


def compare_objectives(
    mu_daily: float,
    sigma_daily: float,
    lead_time: int,
    review_period: int,
    on_hand: float,
    in_transit: float,
    moq: int,
    pack_size: int,
    unit_cost: Optional[float],
) -> list[dict]:
    """三目标方案（保销量 / 保利润 / 保现金）。

    每个方案用各自的「合成假设参数」(service_level, review_factor) 走一遍
    既有 core.inventory 的 z → SS → ROP → target → 两步取整链路，
    不修改既有算法，只复用调用。三个方案的服务水平与覆盖周期不同，
    因此建议量、资金占用由计算自然产生差异，不是写死的。
    """
    from .inventory import (  # 延迟导入，避免包初始化期循环依赖
        order_qty,
        reorder_point,
        safety_stock,
        target_level,
        z_from_service,
    )

    rows: list[dict] = []
    for code, p in OBJECTIVE_ASSUMPTIONS.items():
        level = float(p["service_level"])
        factor = float(p["review_factor"])
        z = z_from_service(level)
        ss = safety_stock(z, sigma_daily, lead_time)
        rop = reorder_point(mu_daily, lead_time, ss)
        objective_review = float(review_period) * factor
        target = target_level(mu_daily, lead_time, objective_review, ss)
        raw = max(0.0, target - float(on_hand) - float(in_transit))
        qty, reason = order_qty(target, on_hand, in_transit, moq, pack_size)
        capital = None if unit_cost is None else round(qty * float(unit_cost), 2)
        rows.append(
            {
                "code": code,
                "name": p["name"],
                "service_level": level,
                "review_factor": factor,
                "review_period": round(objective_review, 4),
                "z": round(z, 4),
                "ss": round(ss, 4),
                "rop": round(rop, 4),
                "target": round(target, 4),
                "raw": round(raw, 4),
                "qty": int(qty),
                "capital": capital,
                "difference_from": (
                    f"service_level={level:.2f}、review_period×{factor:g}；{p['driver']}"
                ),
            }
        )
    return rows


def build_route_plan(
    mu_daily: float,
    sigma_daily: float,
    lead_time: int,
    review_period: int,
    on_hand: float,
    in_transit: float,
    base_qty: int,
    moq: int,
    pack_size: int,
    unit_cost: Optional[float],
) -> dict:
    """一次性产出「四条路线 + 三个目标」的完整方案（供 api.service 直接组装 JSON）。"""
    return {
        "assumption_note": ASSUMPTION_NOTE,
        "cover_days": round((float(on_hand) + float(in_transit)) / float(mu_daily), 4),
        "routes": compare_routes(mu_daily, on_hand, in_transit, base_qty),
        "objectives": compare_objectives(
            mu_daily, sigma_daily, lead_time, review_period,
            on_hand, in_transit, moq, pack_size, unit_cost,
        ),
    }


__all__ = [
    "ROUTE_ASSUMPTIONS",
    "OBJECTIVE_ASSUMPTIONS",
    "ASSUMPTION_NOTE",
    "RISK_LEVEL_HIGH",
    "RISK_LEVEL_MID",
    "compare_routes",
    "compare_objectives",
    "build_route_plan",
]
