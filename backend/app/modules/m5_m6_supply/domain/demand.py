"""需求口径（两层，别混）：

第一层 aggregate_daily：空日补 0 ——「那天没有订单」是事实层的真 0。
第二层 calibrate_demand：断货日置 None ——「那天卖不出去」不是需求，是语义层缺失。

calibrate_demand 不接 conn，入参为已取好的 DataFrame（17 号 v1.1 修正）。
本模块导入时不依赖 pandas：pd.DataFrame 仅是契约标注（future annotations 延迟求值），
真实 DataFrame 只在 aggregate_daily 被调用时局部导入；calibrate_demand 对
duck-typed 记录（pandas DataFrame 或 list[dict]）都可工作。
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Optional

from . import DemandSeries, EmptyData, InsufficientHistory, SourceType


def _iter_records(frame):
    """内部：把 pandas DataFrame 或 list[dict] 统一成逐条 dict 记录。"""
    if frame is None:
        return
    if hasattr(frame, "to_dict"):
        records = frame.to_dict("records")
    else:
        records = frame
    for record in records:
        yield record


def _get(record, key: str, default=None):
    """内部：兼容 dict 与 namedtuple 两种记录取字段。"""
    if hasattr(record, "get"):
        return record.get(key, default)
    return getattr(record, key, default)


def _as_date(value):
    """内部：pandas Timestamp / datetime.datetime → datetime.date。"""
    if value is None:
        return None
    if hasattr(value, "date") and callable(value.date):
        return value.date()
    return value


def _finite_float(value, default: float = 0.0) -> float:
    """内部：数值化并剔除 NaN，保证返回的需求序列里没有 NaN。"""
    if value is None:
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return default if math.isnan(number) else number


def aggregate_daily(orders: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    """按 sku×date 聚合，无订单的日期补 0（真实没卖）。返回列: sku, date, qty_raw, revenue。"""
    import pandas as pd  # 局部导入：core 包导入时不需要 pandas

    columns = ["sku", "date", "qty_raw", "revenue"]
    if orders is None:
        return pd.DataFrame(columns=columns)
    work = orders.copy()
    if work.empty:
        return pd.DataFrame(columns=columns)

    work["date"] = pd.to_datetime(work["date"]).dt.date
    work = work[(work["date"] >= start) & (work["date"] <= end)]
    if work.empty:
        return pd.DataFrame(columns=columns)

    qty_col = "qty" if "qty" in work.columns else "qty_raw"
    rev_col = "revenue" if "revenue" in work.columns else None
    skus = sorted(work["sku"].dropna().unique().tolist())

    aggregation = {"qty_raw": (qty_col, "sum")}
    if rev_col is not None:
        aggregation["revenue"] = (rev_col, "sum")
    grouped = work.groupby(["sku", "date"], as_index=False).agg(**aggregation)

    lookup: dict = {}
    for row in grouped.to_dict("records"):
        lookup[(row["sku"], row["date"])] = (
            _finite_float(row["qty_raw"]),
            _finite_float(row.get("revenue", 0.0)),
        )

    rows: list[dict] = []
    current = start
    while current <= end:
        for sku in skus:
            qty_raw, revenue = lookup.get((sku, current), (0.0, 0.0))
            rows.append(
                {"sku": sku, "date": current, "qty_raw": qty_raw, "revenue": revenue}
            )
        current = current + timedelta(days=1)
    return pd.DataFrame(rows, columns=columns)


def calibrate_demand(
    daily: pd.DataFrame,
    inventory: pd.DataFrame,
    sku: str,
    min_history: int = 60,
) -> DemandSeries:
    """断货判定: on_hand == 0 且 前 7 天销量 > 0 → is_stockout=True, qty=None。

    min_history 只计 qty 非 None 的有效天数。
    异常: EmptyData(sku) / InsufficientHistory(available, required)。
    警告位（不抛异常）: 断货天占比 > 0.5 → warning="stockout_ratio_high"。
    """
    daily_rows = [r for r in _iter_records(daily) if _get(r, "sku") == sku]
    if not daily_rows:
        raise EmptyData(sku)
    daily_rows.sort(key=lambda r: _as_date(_get(r, "date")))

    on_hand_by_date: dict = {}
    for record in _iter_records(inventory):
        if _get(record, "sku") != sku:
            continue
        day = _as_date(_get(record, "date"))
        if day is None:
            continue
        on_hand_by_date[day] = _finite_float(_get(record, "on_hand", 0.0))

    dates: list = []
    qty: list[Optional[float]] = []
    is_stockout: list[bool] = []
    raws: list[float] = []  # T-19: 原始销量（含断货日），只用于判「前 7 天销量」，不受 qty 置 None 影响

    for record in daily_rows:
        day = _as_date(_get(record, "date"))
        raw = _finite_float(_get(record, "qty_raw", _get(record, "qty", 0.0)))
        previous_sales = sum(raws[-7:])  # 用原始销量判，不用 qty（qty 断货日被置 None）
        on_hand = on_hand_by_date.get(day)
        stockout = on_hand is not None and on_hand == 0 and previous_sales > 0

        dates.append(day)
        is_stockout.append(stockout)
        if stockout:
            qty.append(None)
        else:
            qty.append(raw)
        raws.append(raw)  # 无论是否断货都记录原始销量，供后续窗口判定

    available = sum(1 for value in qty if value is not None)
    if available < min_history:
        raise InsufficientHistory(available, min_history)

    warning = None
    if is_stockout and (sum(1 for flag in is_stockout if flag) / len(is_stockout)) > 0.5:
        warning = "stockout_ratio_high"

    source_type: SourceType = _get(daily_rows[0], "source_type", "TEST_API") or "TEST_API"
    return DemandSeries(
        sku=sku,
        dates=dates,
        qty=qty,
        is_stockout=is_stockout,
        source_type=source_type,
        warning=warning,
    )


def clean_for_model(series: DemandSeries) -> list[float]:
    """唯一允许处理 None 的地方：只保留 qty 非 None 的日期，一次性交给所有模型。

    契约 3.3 把本函数写在 core/models.py 段内，派单清单把它列在 demand.py；
    这里在 demand.py 定义并由 models.py re-export，两个导入路径均可用，签名不变。
    """
    result: list[float] = []
    for value in series.qty:
        if value is None:
            continue
        number = float(value)
        if not math.isnan(number):
            result.append(number)
    return result


__all__ = ["aggregate_daily", "calibrate_demand", "clean_for_model"]
