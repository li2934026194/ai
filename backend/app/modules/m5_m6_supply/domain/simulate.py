"""断货日模拟与损失估算（C5 口径）。

simulate_stockout 以 date.today() 为模拟起点（今天），每日先到货后扣减 mu_daily；
库存 <= 0 的天记为断货日（不累积欠货），返回 first_zero_date / zero_days / coverage_days。
estimate_loss 按契约公式 = zero_days * mu_daily * price * gross_margin * multiplier。
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional


def simulate_stockout(on_hand, inbound: list[tuple[date, float]], mu_daily, horizon=90) -> dict:
    """返回 first_zero_date / zero_days / coverage_days。"""
    start = date.today()
    inbound_by_date: dict = {}
    for batch_date, batch_qty in inbound or []:
        if batch_date is None or batch_qty is None:
            continue
        day = batch_date.date() if hasattr(batch_date, "date") and callable(batch_date.date) else batch_date
        try:
            quantity = float(batch_qty)
        except (TypeError, ValueError):
            continue
        inbound_by_date[day] = inbound_by_date.get(day, 0.0) + quantity

    stock = float(on_hand) if on_hand is not None else 0.0
    daily_demand = float(mu_daily) if mu_daily is not None else 0.0
    first_zero_date: Optional[date] = None
    zero_days = 0
    coverage_days = 0

    for offset in range(int(horizon)):
        current = start + timedelta(days=offset)
        stock += inbound_by_date.get(current, 0.0)
        stock -= daily_demand
        if stock <= 0:
            if first_zero_date is None:
                first_zero_date = current
            zero_days += 1
            stock = 0.0
        else:
            coverage_days += 1

    return {
        "first_zero_date": first_zero_date,
        "zero_days": zero_days,
        "coverage_days": coverage_days,
    }


def estimate_loss(zero_days, mu_daily, price, gross_margin, multiplier=1.5) -> Optional[float]:
    """= zero_days * mu_daily * price * gross_margin * multiplier；缺价格/毛利 → None。"""
    if price is None or gross_margin is None:
        return None
    return (
        float(zero_days)
        * float(mu_daily)
        * float(price)
        * float(gross_margin)
        * float(multiplier)
    )


__all__ = ["simulate_stockout", "estimate_loss"]
