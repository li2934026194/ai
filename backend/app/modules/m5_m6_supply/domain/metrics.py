"""WAPE / Bias / MAE。

口径（契约 P6）：只在 (y is not None) and (yhat is not None) 的位置累加；
Sigma y == 0 返回 None；任何情况下都不返回 NaN。
正数 bias 表示高估，负数表示低估。
"""

from __future__ import annotations

import math
from typing import Optional

from . import Metrics  # re-export：调用方可直接 `from core.metrics import Metrics`


def _valid_pair(actual, predicted) -> bool:
    """内部校验：None、非数值、NaN 都不参与累加，从源头杜绝 NaN 输出。"""
    if actual is None or predicted is None:
        return False
    try:
        a = float(actual)
        p = float(predicted)
    except (TypeError, ValueError):
        return False
    return not (math.isnan(a) or math.isnan(p))


def wape(y: list, yhat: list) -> Optional[float]:
    """加权绝对百分比误差 = sum(|y - yhat|) / sum(y)；sum(y)==0 → None。"""
    total_y: float = 0.0
    total_abs_error: float = 0.0
    n_obs: int = 0
    for actual, predicted in zip(y, yhat):
        if not _valid_pair(actual, predicted):
            continue
        a = float(actual)
        total_y += a
        total_abs_error += abs(a - float(predicted))
        n_obs += 1
    if n_obs == 0 or total_y == 0:
        return None
    return total_abs_error / total_y


def bias(y, yhat) -> Optional[float]:
    """预测偏差 = sum(yhat - y) / sum(y)；正=高估，负=低估；sum(y)==0 → None。"""
    total_y: float = 0.0
    total_error: float = 0.0
    n_obs: int = 0
    for actual, predicted in zip(y, yhat):
        if not _valid_pair(actual, predicted):
            continue
        a = float(actual)
        total_y += a
        total_error += float(predicted) - a
        n_obs += 1
    if n_obs == 0 or total_y == 0:
        return None
    return total_error / total_y


def mae(y, yhat) -> Optional[float]:
    """平均绝对误差 = sum(|y - yhat|) / n；无有效观测 → None。"""
    total_abs_error: float = 0.0
    n_obs: int = 0
    for actual, predicted in zip(y, yhat):
        if not _valid_pair(actual, predicted):
            continue
        total_abs_error += abs(float(actual) - float(predicted))
        n_obs += 1
    if n_obs == 0:
        return None
    return total_abs_error / n_obs


__all__ = ["Metrics", "wape", "bias", "mae"]
