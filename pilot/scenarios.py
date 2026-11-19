"""S1–S5 五个极端场景注入 + dataset 建库（10 号 4.3 / 17 号 3.1）。

关键口径（按 team-lead 裁决，不改 core）：
- ``demand_daily`` 由数据层自己算：当天 on_hand == 0 且**原始** qty_raw 前 7 天
  累计 > 0 → is_stockout=1，qty_clean=NULL。
- 用原始销量判定，所以 S1 连续 14 天断货会全部命中；qty_clean 写 NULL 不是 0。
- core.demand.calibrate_demand 用的是已剔除序列 qty[-7:]，连续断货第 8 天起会漏标；
  本轮不改 core，只在验收 S4/S5 时调用它验异常，并在测试输出里如实上报该缺陷。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from db import create_all, get_session
from loaders.base import upsert_dataset, upsert_rows
from loaders.synthetic import (
    SCENARIO_NAMES,
    S1_STOCKOUT_DAYS,
    S1_STOCKOUT_START_INDEX,
    S2_DELAY_DAYS,
    S2_STOCKOUT_DAYS,
    S2_STOCKOUT_START_INDEX,
    S3_PROMO_DAYS,
    S3_PROMO_START_INDEX,
    S5_GAP_DAYS,
    S5_GAP_START_INDEX,
    SyntheticLoader,
)
from schema import DemandDaily

# 断货判定窗口：前 7 个自然日（10 号 3.3 原文）。
LOOKBACK_DAYS = 7


def _compute_demand_daily(
    sales: list[dict], inventory: list[dict]
) -> list[dict]:
    """按「当天 on_hand==0 且原始前 7 天销量>0」算断货标记。

    Args:
        sales: 原始销量行（含 sku/date/qty）。
        inventory: 库存行（含 sku/date/on_hand）。

    Returns:
        可直接写 demand_daily 的 dict 列表；断货日 qty_clean=None。
    """
    inventory_by_key: dict[tuple[str, object], float] = {}
    for row in inventory:
        inventory_by_key[(row["sku"], row["date"])] = float(row["on_hand"])

    by_sku: dict[str, list[dict]] = defaultdict(list)
    for row in sales:
        by_sku[row["sku"]].append(row)

    result: list[dict] = []
    for sku in sorted(by_sku):
        rows = sorted(by_sku[sku], key=lambda item: item["date"])
        for position, row in enumerate(rows):
            day = row["date"]
            raw = float(row["qty"])
            # 只看「之前 7 个自然日」的原始 qty_raw，不看已经剔除的 qty_clean。
            previous_raw_sum = 0.0
            for previous in rows[:position]:
                delta = day - previous["date"]
                if isinstance(delta, timedelta) and timedelta(days=1) <= delta <= timedelta(
                    days=LOOKBACK_DAYS
                ):
                    previous_raw_sum += float(previous["qty"])
            on_hand = inventory_by_key.get((sku, day))
            is_stockout = (
                on_hand is not None
                and on_hand == 0.0
                and previous_raw_sum > 0.0
            )
            result.append(
                {
                    "dataset_id": "",  # 由调用方盖写
                    "sku": sku,
                    "date": day,
                    "qty_raw": raw,
                    "is_stockout": 1 if is_stockout else 0,
                    "qty_clean": None if is_stockout else raw,
                }
            )
    return result


def _write_demand_daily(
    conn: Session, dataset_id: str, loader: SyntheticLoader
) -> int:
    """把口径层结果幂等写进 demand_daily。"""
    frames = loader.load()
    rows = _compute_demand_daily(frames["sales_daily"], frames["inventory_daily"])
    for row in rows:
        row["dataset_id"] = dataset_id
    return upsert_rows(
        conn,
        DemandDaily.__table__,
        rows,
        ("dataset_id", "sku", "date"),
    )


def _build(
    conn: Session, scenario: str
) -> str:
    """通用构建：建 dataset → 导四张事实表 → 算 demand_daily。"""
    loader = SyntheticLoader(scenario)  # type: ignore[arg-type]
    dataset_id = upsert_dataset(conn, loader, loader.name, loader.note)
    _write_demand_daily(conn, dataset_id, loader)
    return dataset_id


def build_s1_stockout_14d(conn: Session) -> str:
    """S1：主力 SKU 连续 14 天 on_hand=0；14 天全标 is_stockout=1。"""
    return _build(conn, "S1")


def build_s2_lead_delay_20d(conn: Session) -> str:
    """S2：第 8 批在途晚 20 天到，断货窗口随到货日推移（第 121 天起 19 天）。"""
    return _build(conn, "S2")


def build_s3_promo_3x(conn: Session) -> str:
    """S3：连续 3 天销量 ×3（脉冲），库存充足不误标断货。"""
    return _build(conn, "S3")


def build_s4_new_sku_zero_history(conn: Session) -> str:
    """S4：某 SKU 只有 3 天历史，calibrate_demand(min_history=60) 必须抛异常。"""
    return _build(conn, "S4")


def build_s5_missing_30d(conn: Session) -> str:
    """S5：中间 30 天无任何记录，目标 SKU 有效历史 55<60 天。"""
    return _build(conn, "S5")


def build_s6_stockout_now(conn: Session) -> str:
    """S6：5 个 SKU 在数据末尾仍在缺货（as_of 在手=0），有需求但没货卖。"""
    return _build(conn, "S6")


SCENARIO_BUILDERS = {
    "S1": build_s1_stockout_14d,
    "S2": build_s2_lead_delay_20d,
    "S3": build_s3_promo_3x,
    "S4": build_s4_new_sku_zero_history,
    "S5": build_s5_missing_30d,
    "S6": build_s6_stockout_now,
}


def build_all_scenarios() -> dict[str, str]:
    """建表并一次性生成五个 dataset；可重复调用（幂等）。

    Returns:
        ``{"S1": dataset_id, ...}``。
    """
    create_all()
    session = get_session()
    try:
        dataset_ids: dict[str, str] = {}
        for code, builder in SCENARIO_BUILDERS.items():
            dataset_ids[code] = builder(session)
        session.commit()
        return dataset_ids
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = [
    "LOOKBACK_DAYS",
    "SCENARIO_BUILDERS",
    "SCENARIO_NAMES",
    "S1_STOCKOUT_START_INDEX",
    "S1_STOCKOUT_DAYS",
    "S2_DELAY_DAYS",
    "S2_STOCKOUT_START_INDEX",
    "S2_STOCKOUT_DAYS",
    "S3_PROMO_START_INDEX",
    "S3_PROMO_DAYS",
    "S5_GAP_START_INDEX",
    "S5_GAP_DAYS",
    "_compute_demand_daily",
    "build_s1_stockout_14d",
    "build_s2_lead_delay_20d",
    "build_s3_promo_3x",
    "build_s4_new_sku_zero_history",
    "build_s5_missing_30d",
    "build_s6_stockout_now",
    "build_all_scenarios",
]
