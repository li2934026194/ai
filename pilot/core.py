"""核心计算：日销量聚合 / 预测 / 回测 / 补货测算。

设计原则：
1. 纯函数，不依赖界面，方便单测；
2. 预测只用 numpy + 可选 LightGBM，不引入 numba 依赖（Python 3.13 兼容风险）；
3. 所有对外展示的数字，都必须能追到 data_nature / source / as_of。
"""

from __future__ import annotations

import math
from typing import Dict, Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------- 1. 聚合
def aggregate_daily(orders: pd.DataFrame) -> pd.DataFrame:
    """orders: [sku, date, qty] -> daily: [sku, date, qty]，缺失日期补 0。

    真实订单表通常只有"有成交的日子"，预测必须基于连续日历，
    否则空日会被当成不存在，直接把需求算低。
    """
    if orders.empty:
        return pd.DataFrame(columns=["sku", "date", "qty"])

    df = orders.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["qty"] = pd.to_numeric(df["qty"], errors="coerce").fillna(0)

    frames = []
    for sku, sub in df.groupby("sku"):
        s = sub.groupby("date")["qty"].sum().sort_index()
        full = pd.date_range(s.index.min(), s.index.max(), freq="D")
        s = s.reindex(full, fill_value=0)
        frames.append(
            pd.DataFrame({"sku": sku, "date": s.index, "qty": s.to_numpy(dtype=float)})
        )
    return pd.concat(frames, ignore_index=True)


# ---------------------------------------------------------------- 2. 模型
def f_moving_average(y: np.ndarray, horizon: int, window: int = 7) -> np.ndarray:
    """移动平均：最简单的基线，也是验收的底线。"""
    if len(y) == 0:
        return np.zeros(horizon)
    return np.repeat(float(np.mean(y[-window:])), horizon)


def f_exponential_smoothing(y: np.ndarray, horizon: int, alpha: float = 0.3) -> np.ndarray:
    """一次指数平滑：给近期数据更高权重。"""
    if len(y) == 0:
        return np.zeros(horizon)
    level = float(y[0])
    for v in y[1:]:
        level = alpha * float(v) + (1 - alpha) * level
    return np.repeat(level, horizon)


def f_seasonal_naive(y: np.ndarray, horizon: int, season: int = 7) -> np.ndarray:
    """季节朴素：直接复用上周同一天，电商周规律很强，往往最难被打败。"""
    if len(y) == 0:
        return np.zeros(horizon)
    if len(y) < season:
        return np.repeat(float(np.mean(y)), horizon)
    reps = int(math.ceil(horizon / season))
    return np.tile(y[-season:], reps)[:horizon]


def f_lightgbm(y: np.ndarray, horizon: int, lags: tuple = (1, 7, 14)) -> Optional[np.ndarray]:
    """LightGBM + 滞后特征，递归预测。未安装 lightgbm 时返回 None（不阻断主流程）。"""
    try:
        import lightgbm as lgb
    except ImportError:
        return None

    n = len(y)
    if n < max(lags) + 14:
        return None

    X, Y = [], []
    for i in range(max(lags), n):
        X.append([float(y[i - l]) for l in lags] + [float(i)])
        Y.append(float(y[i]))
    if not X:
        return None

    model = lgb.LGBMRegressor(
        n_estimators=200, learning_rate=0.05, num_leaves=15, verbose=-1
    )
    model.fit(np.asarray(X, dtype=float), np.asarray(Y, dtype=float))

    work = [float(v) for v in y]
    preds = []
    for _ in range(horizon):
        i = len(work)
        feat = [work[i - l] for l in lags] + [float(i)]
        p = float(model.predict(np.asarray([feat], dtype=float))[0])
        p = max(p, 0.0)
        work.append(p)
        preds.append(p)
    return np.asarray(preds)


MODELS = {
    "移动平均(7)": f_moving_average,
    "指数平滑(0.3)": f_exponential_smoothing,
    "季节朴素(7)": f_seasonal_naive,
    "LightGBM": f_lightgbm,
}


# ---------------------------------------------------------------- 3. 评估
def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """WAPE / Bias / MAE。WAPE 用总量加权，低销量 SKU 不会把误差拉爆。"""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = float(np.sum(y_true))
    if denom <= 0:
        return {"WAPE%": float("nan"), "Bias%": float("nan"), "MAE": float("nan")}
    return {
        "WAPE%": float(np.sum(np.abs(y_true - y_pred)) / denom * 100),
        "Bias%": float((np.sum(y_pred) - denom) / denom * 100),
        "MAE": float(np.mean(np.abs(y_true - y_pred))),
    }


def backtest(daily_sku: pd.DataFrame, horizon: int = 14) -> pd.DataFrame:
    """留出回测：最后 horizon 天不参与训练，只用来打分。

    注意：这是"单次留出"，不是走步回测；一周版够用，别对外宣称是严格回测。
    """
    y = daily_sku.sort_values("date")["qty"].to_numpy(dtype=float)
    if len(y) <= horizon:
        return pd.DataFrame()

    train, test = y[:-horizon], y[-horizon:]
    rows = []
    for name, fn in MODELS.items():
        pred = fn(train, horizon)
        if pred is None:
            continue
        rows.append({"模型": name, **evaluate(test, pred)})
    return pd.DataFrame(rows).sort_values("WAPE%")


def forecast(daily_sku: pd.DataFrame, horizon: int, method: str) -> np.ndarray:
    y = daily_sku.sort_values("date")["qty"].to_numpy(dtype=float)
    pred = MODELS[method](y, horizon)
    return np.zeros(horizon) if pred is None else np.asarray(pred, dtype=float)


# ---------------------------------------------------------------- 4. 补货
def replenish_suggest(
    avg_daily_demand: float,
    lead_time_days: int,
    current_stock: float,
    inbound_stock: float = 0.0,
    safety_days: float = 7.0,
    pack_size: int = 1,
    moq: int = 0,
) -> Dict[str, float]:
    """建议补货量 = 交期需求 + 安全库存 - 现有 - 在途，再按整箱与起订量取整。

    这是决策支持，不是下单指令；不修改任何库存。
    """
    demand_in_lead = avg_daily_demand * lead_time_days
    safety = avg_daily_demand * safety_days
    gap = demand_in_lead + safety - current_stock - inbound_stock

    if gap <= 0:
        qty = 0
    else:
        qty = max(gap, moq)
        if pack_size > 1:
            qty = math.ceil(qty / pack_size) * pack_size

    days_of_cover = (current_stock + inbound_stock) / avg_daily_demand if avg_daily_demand > 0 else float("inf")
    stockout_day = int(math.floor(days_of_cover)) if math.isfinite(days_of_cover) else None

    return {
        "建议补货量": int(round(qty)),
        "交期需求": round(demand_in_lead, 1),
        "安全库存": round(safety, 1),
        "可用合计": round(current_stock + inbound_stock, 1),
        "预计断货日": stockout_day,
        "可支撑天数": None if stockout_day is None else stockout_day,
    }


def inventory_curve(
    current_stock: float,
    inbound_qty: float,
    inbound_day: int,
    daily_demand: np.ndarray,
) -> pd.DataFrame:
    """逐日库存曲线：让"为什么现在必须补"变成一张看得懂的图。"""
    rows = []
    stock = float(current_stock)
    for i, d in enumerate(daily_demand):
        if i == inbound_day:
            stock += float(inbound_qty)
        stock -= float(d)
        rows.append({"day": i + 1, "stock": round(stock, 1), "demand": round(float(d), 1)})
    return pd.DataFrame(rows)
