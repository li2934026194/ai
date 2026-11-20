"""1688 第一层「模拟供应商报价」确定性规则（PACK 25）。

【模拟数据，非实时 1688、非正式报价、未校验供应商】本模块只按固定规则算数，
不联网、不采集、不随机、不写库、不参与 core 补货推导；供两处复用：

1. ``scripts/seed_1688_quotes.py``：调 build_mock_quotes 把固定字段写进 supplier_quotes；
2. ``api/service.py``：优先读库；库里没有或需要按当前 qty 重算时，同样调本模块。

对外两个纯函数（任务书指定签名）：
    build_mock_quotes(product, qty) -> list[dict]
    quote_id_for(dataset_id, sku, supplier_code) -> str

设计要点：
- 报价基准 = products.unit_cost；为 NULL 时用 price * 0.45 估算，**绝不拿 0 当成本**，
  并在 source_note 追加「成本缺失，按售价 45% 估算」。
- 基准用于生成报价；但 current_unit_cost（返回给前端做比较）在缺成本时仍是 None，
  此时 saving_* 一律 None，前端显示「缺成本，无法比较」，不伪造节省。
- 金额统一 round 到 2 位小数；moq 最少 1；pack_size 缺失取 1。
- ranking 与 applicable 依赖请求时的 qty：applicable_unit_price / saving_* / rank
  由 finalize_quotes 统一计算，build_mock_quotes 与 service 读库后都走它，杜绝口径分叉。
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

# 三家固定模拟供应商：code / 名称 / 价格系数 / MOQ 规则 / 生产交期规则 / 可靠性 / 单件运费
# 说明：MOQ 与 lead_prod 的具体值由 _vendor_spec 按产品原值计算，表里只放规则系数。
SUPPLIERS = (
    {
        "code": "MOCK-A",
        "name": "1688 模拟供应商 A（义乌）",
        "factor": 0.92,
        "reliability": 0.86,
        "freight": 0.80,
        "moq_mode": "base",        # 原 MOQ
        "lead_mode": "base_plus_2",  # 原 lead_prod + 2
    },
    {
        "code": "MOCK-B",
        "name": "1688 模拟供应商 B（广州）",
        "factor": 1.03,
        "reliability": 0.93,
        "freight": 0.60,
        "moq_mode": "double",      # max(原 MOQ, 原 MOQ × 2)
        "lead_mode": "minus_1",    # max(1, 原 lead_prod - 1)
    },
    {
        "code": "MOCK-C",
        "name": "1688 模拟供应商 C（深圳）",
        "factor": 0.97,
        "reliability": 0.78,
        "freight": 1.10,
        "moq_mode": "base",
        "lead_mode": "base_plus_5",
    },
)

SOURCE_NOTE = "模拟 1688 第一层报价；非实时、非正式、未校验供应商"
COST_MISSING_SUFFIX = "；成本缺失，按售价 45% 估算"
# 真实数据里有 18 个 SKU（6 套合成集 × SKU-018/019/020）unit_cost 与 price 同时为 NULL。
# 绝不用 0 代替缺失成本；这里用一个确定性、非 0 的演示占位基准，并在 source_note 明确标注
# 「非真实成本估算」。current_unit_cost 仍为 None，saving_* 仍为 None（诚实缺省）。
NO_BASIS_FALLBACK = 10.0
NO_BASIS_SUFFIX = "；成本与售价均缺失，基准为确定性模拟占位价10元，非真实成本估算"
QUOTE_SOURCE = "SYNTHETIC_1688_FIRST_LAYER"
CURRENCY = "CNY"

TIER2_FACTOR = 0.97   # 第 2 档在系数价基础上再打 97 折
TIER3_FACTOR = 0.93   # 第 3 档在系数价基础上再打 93 折


def quote_id_for(dataset_id: str, sku: str, supplier_code: str) -> str:
    """确定性 quote_id：sq_ + sha1(dataset_id|sku|supplier_code)[:16]。"""
    raw = f"{dataset_id}|{sku}|{supplier_code}".encode("utf-8")
    return "sq_" + hashlib.sha1(raw).hexdigest()[:16]


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    """同时兼容 SQLAlchemy ORM 行与 dict，供纯函数直接吃 product。"""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _money(value: Optional[float]) -> Optional[float]:
    """金额统一 2 位；None 原样返回（缺成本不伪造 0）。"""
    return None if value is None else round(float(value), 2)


def _base_cost(product: Any) -> tuple[float, Optional[float], str]:
    """返回 (报价基准, current_unit_cost, source_note 追加后缀)。

    三级基准（确定性，绝不用 0）：
      1. unit_cost 有值 → 基准 = unit_cost，current_unit_cost = 真实值，后缀空；
      2. unit_cost 缺、price 有值 → 基准 = price*0.45，current_unit_cost=None，追加「按售价估算」；
      3. 两者都缺 → 基准 = NO_BASIS_FALLBACK（非 0 占位），current_unit_cost=None，
         追加「非真实成本估算」声明。
    current_unit_cost 只认真实 unit_cost：缺成本时它必须是 None，
    这样 saving_* 才会是 None，前端才能显示「缺成本，无法比较」。
    """
    unit_cost = _attr(product, "unit_cost", None)
    if unit_cost is not None:
        base = float(unit_cost)
        if base <= 0:
            raise ValueError("products.unit_cost 必须为正数，拒绝用 0 冒充成本")
        return base, base, ""
    price = _attr(product, "price", None)
    if price is not None:
        price_f = float(price)
        if price_f <= 0:
            raise ValueError("products.price 必须为正数，无法按售价 45% 估算成本")
        return round(price_f * 0.45, 2), None, COST_MISSING_SUFFIX
    # 两者都缺：确定性占位基准，绝不用 0；不伪造真实成本，只做演示比价。
    return NO_BASIS_FALLBACK, None, NO_BASIS_SUFFIX


def _moq_for(base_moq: int, mode: str) -> int:
    """供应商 MOQ：MOCK-B 翻倍，其余用原 MOQ；结果最少 1。"""
    if mode == "double":
        return max(1, base_moq, base_moq * 2)
    return max(1, base_moq)


def _lead_prod_for(base_lead: int, mode: str) -> int:
    """供应商生产交期：B 减 1（最少 1），A 加 2，C 加 5。"""
    if mode == "minus_1":
        return max(1, base_lead - 1)
    if mode == "base_plus_2":
        return base_lead + 2
    if mode == "base_plus_5":
        return base_lead + 5
    return max(1, base_lead)


def _tier_prices(moq: int, unit_price: float) -> list[dict]:
    """三档阶梯价：MOQ / MOQ×2 / MOQ×5，价格分别 ×1 / ×0.97 / ×0.93。"""
    tiers: list[dict] = []
    tiers.append({"min_qty": moq, "price": _money(unit_price)})
    tiers.append({"min_qty": moq * 2, "price": _money(unit_price * TIER2_FACTOR)})
    tiers.append({"min_qty": moq * 5, "price": _money(unit_price * TIER3_FACTOR)})
    return tiers


def _applicable(tiers: list[dict], qty: int) -> dict:
    """按当前建议量选适用档：qty≥MOQ×5→档3；≥MOQ×2→档2；否则档1。"""
    top = tiers[-1]["min_qty"]
    mid = tiers[1]["min_qty"]
    if qty >= top:
        return tiers[2]
    if qty >= mid:
        return tiers[1]
    return tiers[0]


def finalize_quotes(
    rows: list[dict], qty: int, current_unit_cost: Optional[float]
) -> list[dict]:
    """给一批「固定报价行」按当前 qty 补上适用价/节省/排名并排序。

    输入行至少含：supplier_code / reliability / moq / unit_price / tier_json。
    输出是带 rank 的新 dict 列表（不改动入参），排序键：
        applicable_unit_price 升序 → reliability 降序 → supplier_code 升序。

    build_mock_quotes（库内无报价即时生成）与 service（从库读固定字段后重算）
    都调用本函数，保证两条路径的适用档、节省、排名口径完全一致。
    """
    out: list[dict] = []
    for row in rows:
        item = dict(row)
        tiers = item.get("tier_prices")
        if tiers is None:
            tiers = json.loads(item.get("tier_json") or "[]")
        applicable = _applicable(tiers, qty) if tiers else {"price": item.get("unit_price")}
        item["tier_prices"] = tiers
        item["applicable_unit_price"] = _money(applicable.get("price"))

        if current_unit_cost is None:
            item["saving_per_unit"] = None
            item["saving_amount"] = None
        else:
            saving = round(float(current_unit_cost) - float(item["applicable_unit_price"]), 2)
            item["saving_per_unit"] = saving
            item["saving_amount"] = round(saving * qty, 2)
        out.append(item)

    out.sort(
        key=lambda r: (
            r["applicable_unit_price"],
            -float(r["reliability"]),
            r["supplier_code"],
        )
    )
    for index, item in enumerate(out, start=1):
        item["rank"] = index
    return out


def build_mock_quotes(product: Any, qty: int) -> list[dict]:
    """按确定规则为 1 个 product 生成 3 家模拟报价（纯函数，不写库）。

    Args:
        product: Products ORM 行或等价 dict，需含 dataset_id/sku/unit_cost/price/
                 moq/pack_size/lead_prod/lead_transit。
        qty: 当前建议量，决定每家适用档价与节省金额；qty=0 时按 MOQ 档展示。

    Returns:
        3 条报价 dict（已按适用价排名），字段同时覆盖库表列与前端展示所需。
    """
    dataset_id = str(_attr(product, "dataset_id", ""))
    sku = str(_attr(product, "sku", ""))
    base, current_cost, note_suffix = _base_cost(product)
    note = SOURCE_NOTE + note_suffix

    base_moq = int(_attr(product, "moq", 1) or 1)
    base_moq = max(1, base_moq)
    pack_size = int(_attr(product, "pack_size", 1) or 1)
    pack_size = max(1, pack_size)
    lead_transit = int(_attr(product, "lead_transit", 0) or 0)
    base_lead = int(_attr(product, "lead_prod", 1) or 1)

    rows: list[dict] = []
    for spec in SUPPLIERS:
        code = spec["code"]
        unit_price = _money(base * spec["factor"])
        moq = _moq_for(base_moq, spec["moq_mode"])
        lead_prod = _lead_prod_for(base_lead, spec["lead_mode"])
        tiers = _tier_prices(moq, unit_price)
        rows.append(
            {
                "quote_id": quote_id_for(dataset_id, sku, code),
                "dataset_id": dataset_id,
                "sku": sku,
                "supplier_code": code,
                "supplier_name": spec["name"],
                "unit_price": unit_price,
                "currency": CURRENCY,
                "moq": moq,
                "pack_size": pack_size,
                "lead_prod": lead_prod,
                "lead_transit": lead_transit,
                "lead_days": lead_prod + lead_transit,
                "reliability": spec["reliability"],
                "freight_per_unit": _money(spec["freight"]),
                "tier_json": json.dumps(tiers, ensure_ascii=False),
                "tier_prices": tiers,
                "is_mock": True,
                "source_note": note,
            }
        )

    return finalize_quotes(rows, qty, current_cost)


__all__ = [
    "build_mock_quotes",
    "quote_id_for",
    "finalize_quotes",
    "SUPPLIERS",
    "SOURCE_NOTE",
    "QUOTE_SOURCE",
]
