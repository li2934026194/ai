"""core —— 纯计算算法内核（PACK 1）。

契约来源：17-接口契约v1.1（施工图·取代13号）.md 第二节「数据类型」。

铁律（写进代码注释，逐条落实）：
1. 本包及所有子模块绝不 import 任何 UI / ORM / Web 框架（禁用清单见契约铁律一）；
   计算只在 core 里做一次，api 与界面都只是壳。
2. 不可算一律返回 None，绝不返回 NaN（wape / bias / mae / Cu / Co / ratio / amount）。
3. 下面出现的数值字面量全部是契约明文规定的默认值、阈值或查表锚点
   （如 obsolescence=0.08、clip=(0.90, 0.97)、降级 0.95、365 天/年），
   不是写死的业务百分比或金额；所有业务输出均由函数实时计算。
4. 契约中未指定存放文件的公共数据类型与异常，统一放在本 __init__.py，
   子模块再按需 re-export，避免循环依赖，也便于 PACK 2/3/4 直接 `from core import ...`。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, Optional

SourceType = Literal["TEST_API", "OPEN_PUBLIC", "PLATFORM_REPORT", "SYNTHETIC"]


class EmptyData(Exception):
    """E-1003：该 SKU 在数据集里没有任何记录。"""

    def __init__(self, sku: str):
        self.sku = sku
        super().__init__(f"E-1003: no records for SKU {sku}")


class InsufficientHistory(Exception):
    """E-1001：有效历史（qty 非 None 的天数）不足。"""

    def __init__(self, available: int, required: int):
        self.available = int(available)
        self.required = int(required)
        super().__init__(
            f"E-1001: only {self.available} valid days, at least {self.required} required"
        )


class InvalidParams(Exception):
    """入参非法：服务水平越界、moq/pack_size 非法、回测窗口参数非法等。"""

    def __init__(self, message: str = "invalid parameters"):
        super().__init__(message)


@dataclass
class DemandSeries:
    """语义层需求序列：断货日 qty=None，不是 0。"""

    sku: str
    dates: list[date]
    qty: list[Optional[float]]
    is_stockout: list[bool]
    source_type: SourceType
    warning: Optional[str] = None


@dataclass
class Metrics:
    """预测误差指标：None 表示不可算，不是 NaN。"""

    wape: Optional[float]
    bias: Optional[float]
    mae: Optional[float]
    n_obs: int


@dataclass
class BacktestResult:
    """走步回测结果；best 为 WAPE 最低且 bias > -0.15 的模型，全 None 则为 None。"""

    per_model: dict[str, Metrics]
    windows: list[dict]
    best: Optional[str]
    method: Literal["holdout", "rolling"] = "rolling"


@dataclass
class InventoryParams:
    """库存与补货参数；lead_time 为四段交期之和。"""

    unit_cost: Optional[float]
    price: Optional[float]
    moq: int
    pack_size: int
    lead_prod: int
    lead_transit: int
    lead_customs: int
    lead_inbound: int
    review_period: int = 15
    cu_multiplier: float = 1.5
    holding_rate: float = 0.25
    obsolescence: float = 0.08
    holding_days: int = 45
    service_level: Optional[float] = None

    @property
    def lead_time(self) -> int:
        """总交期 = 生产 + 头程 + 清关 + 入仓。"""
        return self.lead_prod + self.lead_transit + self.lead_customs + self.lead_inbound


@dataclass
class Suggestion:
    """一条补货建议快照，可由 inputs_json 原地复现。"""

    sku: str
    qty: int
    amount: Optional[float]
    service_level: float
    raw_service_level: Optional[float]
    service_level_source: Literal["cost_reverse", "manual", "default_missing_cost"]
    z: float
    sigma_lt: float
    ss: float
    rop: float
    target_s: float
    on_hand: float
    in_transit: float
    stockout_date: Optional[date]
    zero_days: int
    lost_amount: Optional[float]
    reason: Optional[str]
    inputs_json: dict


__all__ = [
    "SourceType",
    "EmptyData",
    "InsufficientHistory",
    "InvalidParams",
    "DemandSeries",
    "Metrics",
    "BacktestResult",
    "InventoryParams",
    "Suggestion",
]

# PACK 11：多路线方案对比 / 三目标决策（只加，不改上面任何既有定义与导出）。
# routes.py 的函数体用延迟 import 复用 core.inventory 既有算法，不修改它们。
from .routes import (  # noqa: E402
    ASSUMPTION_NOTE,
    OBJECTIVE_ASSUMPTIONS,
    ROUTE_ASSUMPTIONS,
    build_route_plan,
    compare_objectives,
    compare_routes,
)

__all__ += [
    "ROUTE_ASSUMPTIONS",
    "OBJECTIVE_ASSUMPTIONS",
    "ASSUMPTION_NOTE",
    "compare_routes",
    "compare_objectives",
    "build_route_plan",
]
