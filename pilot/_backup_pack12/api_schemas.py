"""Pydantic 响应模型（api/schemas.py，PACK 4）。

只描述「壳」要吐给前端的 JSON 形状；所有数值都由 service 从 core/库取来后填入。
这里出现的字段名 = 前端 P1/P3 页面直接消费的键，不承载任何计算。
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# 三个通用字段：每个响应都必须带（source_type / as_of / method）
# ---------------------------------------------------------------------------
class Meta(BaseModel):
    """数据来源 + 截止日 + 回测方法。"""

    source_type: str
    as_of: str
    method: str


class Warning(BaseModel):
    """结构化警告位（不是错误）。"""

    code: str
    message: str


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------
class Health(BaseModel):
    status: str
    dataset_count: int
    sqlalchemy_version: str


# ---------------------------------------------------------------------------
# GET /api/datasets
# ---------------------------------------------------------------------------
class DatasetItem(BaseModel):
    id: str
    name: str
    source_type: str
    created_at: str


class DatasetsResponse(BaseModel):
    datasets: list[DatasetItem]


# ---------------------------------------------------------------------------
# GET /api/p1/dashboard
# ---------------------------------------------------------------------------
class DashboardKpi(BaseModel):
    pending_sku_count: int       # 待补货 SKU 数（qty > 0）
    stockout_risk_count: int     # 断货风险 SKU 数
    total_capital: float         # 建议占用资金合计（缺成本 SKU 不计入）
    agent_runs_today: int        # 七 Agent 今日运行次数


class DashboardResponse(BaseModel):
    meta: Meta
    kpi: DashboardKpi


# ---------------------------------------------------------------------------
# GET /api/p2/skus
# ---------------------------------------------------------------------------
class SkuRow(BaseModel):
    sku: str
    title: str
    daily_avg: float             # 日均销量
    on_hand: float               # 在手
    in_transit: float            # 在途
    days_left: float             # 按当前需求可支撑天数
    stock_risk: str              # STOCKOUT / RISK / WATCH / LOW
    qty: int                     # 建议补货量（两步取整后）
    capital: Optional[float]     # 占用资金（qty × 单件成本；缺成本为 null）


class SkusResponse(BaseModel):
    meta: Meta
    skus: list[SkuRow]


# ---------------------------------------------------------------------------
# GET /api/p3/sku/{sku}
# ---------------------------------------------------------------------------
class S1Point(BaseModel):
    date: str
    qty: Optional[float]         # 断货日 None
    on_hand: float


class ModelMetrics(BaseModel):
    wape: Optional[float]
    bias: Optional[float]
    mae: Optional[float]
    n_obs: int


class Derivation(BaseModel):
    """推导链：σ_日 → σ_LT → SS → ROP → target → raw → qty。"""

    mu_daily: float
    sigma_daily: float
    sigma_lt: float
    z: float
    lead_time: int
    review_period: int
    ss: float
    rop: float
    target: float
    raw: float
    qty: int
    on_hand: float
    in_transit: float
    days_left: Optional[float]


class SkuDetailResponse(BaseModel):
    meta: Meta
    sku: str
    best_model: Optional[str]
    series: list[S1Point]
    per_model: dict[str, ModelMetrics]
    derivation: Derivation
    service_level: float
    service_level_source: str
    capital: Optional[float]
    stock_risk: str
    warning: Optional[Warning] = None


# ---------------------------------------------------------------------------
# GET /api/p3/route-plan（PACK 11：多路线方案对比 + 三目标决策）
# 只新增模型；上面的既有响应字段一行未动。
# ---------------------------------------------------------------------------
class RoutePlanBase(BaseModel):
    """方案对比的基础输入，全部来自既有 /api/p3/sku 推导链。"""

    mu_daily: float
    on_hand: float
    in_transit: float
    cover_days: float          # (在手 + 在途) / 日均销量
    base_qty: int
    base_capital: Optional[float]
    service_level: float
    lead_time: int
    review_period: int
    sigma_daily: float
    moq: int
    pack_size: int
    unit_cost: Optional[float]


class RouteItem(BaseModel):
    """一条运输路线；参数来自「合成假设参数」表，结果由 core.routes 实时计算。"""

    code: str
    name: str
    transit_days: int           # 含起运与清关
    unit_freight: float         # ¥/件，合成假设
    min_qty: int                # 最小起运量，合成假设
    reliability: float          # 按时到货可靠性，合成假设
    order_qty: int
    total_freight: float
    cover_days: float
    gap_days: float             # 到货前裸露天数
    arrival_remaining_days: float
    risk_index: float
    risk_level: str
    recommendation: str


class ObjectiveItem(BaseModel):
    """一个决策目标；建议量与资金占用由各自的服务水平/覆盖周期参数算出。"""

    code: str
    name: str
    service_level: float
    review_factor: float
    review_period: float
    z: float
    ss: float
    rop: float
    target: float
    raw: float
    qty: int
    capital: Optional[float]
    difference_from: str


class RoutePlanResponse(BaseModel):
    meta: Meta
    sku: str
    base: RoutePlanBase
    assumption_note: str
    routes: list[RouteItem]
    objectives: list[ObjectiveItem]


# ---------------------------------------------------------------------------
# 结构化错误（绝不 500）
# ---------------------------------------------------------------------------
class ErrorResponse(BaseModel):
    code: str
    message: str
    available: Optional[int] = None
