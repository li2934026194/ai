"""走步回测（rolling origin），不是单次留出。

窗口 = 训练 >= 60 天 + 预测 horizon + 步进 step，循环 n_windows 次；
全部窗口的误差合并成 per_model。
best 规则：WAPE 非 None 中取最低，且 bias > -0.15；全 None → None（C2）。
S1 断货场景：snaive 不参与 best 选优，但仍保留在 per_model 里可查（不删模型，只标注）。
"""

from __future__ import annotations

import math

from . import BacktestResult, InsufficientHistory, InvalidParams, Metrics
from .demand import clean_for_model
from .metrics import bias, mae, wape


def _count_valid(y: list, yhat: list) -> int:
    """内部：统计双方都有有效数值的位置数，用于 Metrics.n_obs。"""
    count = 0
    for actual, predicted in zip(y, yhat):
        if actual is None or predicted is None:
            continue
        try:
            if math.isnan(float(actual)) or math.isnan(float(predicted)):
                continue
        except (TypeError, ValueError):
            continue
        count += 1
    return count


def backtest(series, models, horizon=14, n_windows=4, step=7) -> BacktestResult:
    """走步回测：多滚动窗口合并评估，返回 BacktestResult(method="rolling")。"""
    if horizon < 1 or n_windows < 1 or step < 1:
        raise InvalidParams("horizon / n_windows / step must all be >= 1")

    clean = clean_for_model(series)
    min_train = 60
    required = min_train + horizon
    if len(clean) < required:
        raise InsufficientHistory(len(clean), required)

    y_all: list[float] = []
    yhat_all: dict[str, list[float]] = {name: [] for name in models}
    windows: list[dict] = []

    for window_index in range(n_windows):
        origin = min_train + window_index * step
        if origin + horizon > len(clean):
            break
        train = clean[:origin]
        test = clean[origin : origin + horizon]

        per_model: dict[str, Metrics] = {}
        for name, forecast in models.items():
            predicted = list(forecast(train, horizon))
            per_model[name] = Metrics(
                wape=wape(test, predicted),
                bias=bias(test, predicted),
                mae=mae(test, predicted),
                n_obs=_count_valid(test, predicted),
            )
            y_all.extend(test)
            yhat_all[name].extend(predicted)

        windows.append(
            {"origin": origin, "horizon": horizon, "per_model": per_model}
        )

    per_model_all: dict[str, Metrics] = {}
    for name, predicted_all in yhat_all.items():
        per_model_all[name] = Metrics(
            wape=wape(y_all, predicted_all),
            bias=bias(y_all, predicted_all),
            mae=mae(y_all, predicted_all),
            n_obs=_count_valid(y_all, predicted_all),
        )

    # S1 断货压缩后周对齐偏移，snaive 系统性偏低 → 不进 best，但仍在对比表里。
    excluded: set[str] = {"snaive"} if any(series.is_stockout) else set()
    eligible: list[tuple[str, Metrics]] = []
    for name, metrics in per_model_all.items():
        if name in excluded or metrics.wape is None or metrics.bias is None:
            continue
        if metrics.bias > -0.15:
            eligible.append((name, metrics))
    best = min(eligible, key=lambda item: item[1].wape)[0] if eligible else None

    return BacktestResult(
        per_model=per_model_all,
        windows=windows,
        best=best,
        method="rolling",
    )


__all__ = ["backtest"]
