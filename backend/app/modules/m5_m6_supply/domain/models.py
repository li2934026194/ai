"""四个预测模型（纯函数）。

P5：模型函数本身不处理 None；断货日由 demand.clean_for_model 一次性清理后再传入。
CrostonSBA 手写纯 Python（约 20 行），不引任何第三方预测库、加速库或梯度提升库。
"""

from __future__ import annotations

import math
from typing import Callable

from . import DemandSeries  # re-export：调用方可直接 `from core.models import DemandSeries`
from .demand import clean_for_model  # 契约 3.3 段内也列出本函数，此处 re-export 兼容两个路径


def _numeric(s: list) -> list[float]:
    """内部：过滤 None / 非数值 / NaN，保证模型输出不出现 NaN。"""
    result: list[float] = []
    for value in s:
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not math.isnan(number):
            result.append(number)
    return result


def f_moving_average(s: list[float], horizon: int, window: int = 7) -> list[float]:
    """移动平均：取最近 window 个有效值的均值，水平外推 horizon 天。"""
    values = _numeric(s)
    if horizon <= 0:
        return []
    if not values:
        return [0.0] * horizon
    tail = values[-window:] if window > 0 else values
    average = sum(tail) / len(tail)
    return [average] * horizon


def f_exp_smoothing(s: list[float], horizon: int, alpha: float = 0.3) -> list[float]:
    """一次指数平滑：水平外推 horizon 天。"""
    values = _numeric(s)
    if horizon <= 0:
        return []
    if not values:
        return [0.0] * horizon
    level = values[0]
    for value in values[1:]:
        level = alpha * value + (1.0 - alpha) * level
    return [level] * horizon


def f_seasonal_naive(s: list[float], horizon: int, period: int = 7) -> list[float]:
    """季节朴素：第 h 天取 period 天前同一相位的值；历史不足 period 时回绕。"""
    values = _numeric(s)
    if horizon <= 0:
        return []
    if not values:
        return [0.0] * horizon
    p = period if period > 0 else 1
    n = len(values)
    result: list[float] = []
    for h in range(1, horizon + 1):
        index = n - p + ((h - 1) % p)
        while index < 0:
            index += p
        result.append(values[index])
    return result


def f_croston_sba(s: list[float], horizon: int, alpha: float = 0.1) -> list[float]:
    """Croston/SBA：分别平滑「需求发生量」与「发生间隔」，外推单位期需求率。"""
    values = _numeric(s)
    if horizon <= 0:
        return []
    rate = 0.0
    interval = 0.0
    last_occurrence = -1
    initialized = False
    for index, value in enumerate(values):
        if value <= 0:
            continue
        if not initialized:
            rate = value
            interval = float(index + 1)
            initialized = True
        else:
            rate = alpha * value + (1.0 - alpha) * rate
            interval = alpha * float(index - last_occurrence) + (1.0 - alpha) * interval
        last_occurrence = index
    if not initialized:
        return [0.0] * horizon
    return [rate / interval] * horizon


MODELS: dict[str, Callable] = {
    "ma7": f_moving_average,
    "es": f_exp_smoothing,
    "snaive": f_seasonal_naive,
    "croston_sba": f_croston_sba,
}


__all__ = [
    "DemandSeries",
    "clean_for_model",
    "f_moving_average",
    "f_exp_smoothing",
    "f_seasonal_naive",
    "f_croston_sba",
    "MODELS",
]
