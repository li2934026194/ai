"""数据层表结构：18 张表（SQLAlchemy 2.0 DeclarativeBase）。

构成：
- 原有 10 张业务表（设计依据见 10 号文档）；
- PACK 12 新增 2 张履约表（replenish_apply / purchase_order）；
- PACK 23 新增 6 张 RBAC/审计表（3 主表 + 2 关联表 + 1 审计表）。

依据：
- 10-数据层设计（SQLite库表+仿真器接入）.md 第三节「表结构（10 张）」；
- 17-接口契约v1.1 第二节数据类型（SourceType 四个固定取值）。

三条建库原则（10 号文档第二节）在本文件的落实：
1. 数据性质是列不是注释：source_type 是真实列，落在 datasets / products /
   sales_daily / inventory_daily / inbound_batches / suggestions 六张表上。
2. 事实与口径分开存：sales_daily 存原始事实，demand_daily 存断货判断。
3. 每条建议留快照：suggestions.inputs_json（Text，写入时 JSON 序列化）。

空值不当 0：products.unit_cost / price 允许 NULL；成本未知的 SKU 存 None，绝不存 0。
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# 10 号文档原则 1：四个固定取值，具名常量，禁止散落字符串字面量。
SOURCE_TYPES: tuple[str, str, str, str] = (
    "TEST_API",
    "OPEN_PUBLIC",
    "PLATFORM_REPORT",
    "SYNTHETIC",
)
SOURCE_TYPE_MAX_LEN = 20
ID_MAX_LEN = 64
NAME_MAX_LEN = 128
SKU_MAX_LEN = 64


class Base(DeclarativeBase):
    """声明式基类；本轮只用 SQLite，换 PostgreSQL 只需改 DATABASE_URL。"""


class Datasets(Base):
    """数据集：一个场景一行。唯一键 name，保证 upsert 幂等。"""

    __tablename__ = "datasets"

    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, unique=True)
    source_type: Mapped[str] = mapped_column(
        String(SOURCE_TYPE_MAX_LEN), nullable=False, comment="10号原则1：数据性质是列"
    )
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )


class Products(Base):
    """商品事实表；unit_cost / price 可为 NULL（成本未知存 NULL，绝不存 0）。"""

    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("dataset_id", "sku", name="uq_products_dataset_sku"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    title: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    moq: Mapped[int] = mapped_column(Integer, nullable=False)
    pack_size: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_prod: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_transit: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_customs: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_inbound: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[str] = mapped_column(String(SOURCE_TYPE_MAX_LEN), nullable=False)


class SalesDaily(Base):
    """原始销量事实（qty 是当天卖了几件）；唯一键 (dataset_id, sku, date)。"""

    __tablename__ = "sales_daily"
    __table_args__ = (
        UniqueConstraint("dataset_id", "sku", "date", name="uq_sales_dataset_sku_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    revenue: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_refund: Mapped[int] = mapped_column(Boolean, nullable=False, default=0)
    source_type: Mapped[str] = mapped_column(String(SOURCE_TYPE_MAX_LEN), nullable=False)


class InventoryDaily(Base):
    """每日库存事实；唯一键 (dataset_id, sku, date)。"""

    __tablename__ = "inventory_daily"
    __table_args__ = (
        UniqueConstraint("dataset_id", "sku", "date", name="uq_inventory_dataset_sku_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    on_hand: Mapped[float] = mapped_column(Float, nullable=False)
    in_transit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source_type: Mapped[str] = mapped_column(String(SOURCE_TYPE_MAX_LEN), nullable=False)


class InboundBatches(Base):
    """在途批次；唯一键 (dataset_id, sku, batch_id)。延误只改 arrive_date。"""

    __tablename__ = "inbound_batches"
    __table_args__ = (
        UniqueConstraint(
            "dataset_id", "sku", "batch_id", name="uq_inbound_dataset_sku_batch"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    batch_id: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    arrive_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    source_type: Mapped[str] = mapped_column(String(SOURCE_TYPE_MAX_LEN), nullable=False)


class DemandDaily(Base):
    """口径层：断货判断与剔除后销量。qty_clean NULL = 不知道，不是 0。"""

    __tablename__ = "demand_daily"
    __table_args__ = (
        UniqueConstraint("dataset_id", "sku", "date", name="uq_demand_dataset_sku_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    qty_raw: Mapped[float] = mapped_column(Float, nullable=False)
    is_stockout: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    qty_clean: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class ForecastRuns(Base):
    """一次回测 = 一行 run + N 行 forecast_points。"""

    __tablename__ = "forecast_runs"

    run_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    params_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    n_windows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wape: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bias: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mae: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )


class ForecastPoints(Base):
    """回测/预测逐日点。"""

    __tablename__ = "forecast_points"
    __table_args__ = (
        UniqueConstraint("run_id", "sku", "date", name="uq_forecast_point"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    yhat: Mapped[float] = mapped_column(Float, nullable=False)


class Suggestions(Base):
    """决策层：结果 + inputs_json 快照；amount 映射为 capital。"""

    __tablename__ = "suggestions"

    sug_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )
    service_level: Mapped[float] = mapped_column(Float, nullable=False)
    z: Mapped[float] = mapped_column(Float, nullable=False)
    sigma_lt: Mapped[float] = mapped_column(Float, nullable=False)
    ss: Mapped[float] = mapped_column(Float, nullable=False)
    rop: Mapped[float] = mapped_column(Float, nullable=False)
    target_s: Mapped[float] = mapped_column(Float, nullable=False)
    on_hand: Mapped[float] = mapped_column(Float, nullable=False)
    in_transit: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    stockout_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lost_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    capital: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    inputs_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    source_type: Mapped[str] = mapped_column(String(SOURCE_TYPE_MAX_LEN), nullable=False)


class AgentRuns(Base):
    """观测层：每次 Agent 调用落一行 trace。"""

    __tablename__ = "agent_runs"

    run_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    agent: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    tool: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    status: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )


# ===========================================================================
# PACK 12：补货审批履约闭环两张业务表（只新增，上面 10 张表一字未改）
# 【合成演示业务，非真实生产业务】
# ---------------------------------------------------------------------------
# 状态枚举的唯一定义处（禁止在 service / 前端散落字符串字面量）：
#   replenish_apply.status : draft → pending_approve → approved → closed
#                            pending_approve → rejected
#   purchase_order.status  : created → shipping → partial_received →
#                            fully_received / cancelled
# 表上用 CHECK 约束兜底，业务层再做一次流转防护（双保险）。
# ===========================================================================
APPLY_STATUSES: tuple[str, ...] = (
    "draft",
    "pending_approve",
    "approved",
    "rejected",
    "closed",
)
PO_STATUSES: tuple[str, ...] = (
    "created",
    "shipping",
    "partial_received",
    "fully_received",
    "cancelled",
)

_APPLY_STATUS_CHECK = "status IN (" + ", ".join(f"'{s}'" for s in APPLY_STATUSES) + ")"
_PO_STATUS_CHECK = "status IN (" + ", ".join(f"'{s}'" for s in PO_STATUSES) + ")"


class ReplenishApply(Base):
    """补货申请主表：一次「提交申请」一行，审批与履约状态全链路留痕。

    【合成演示业务，非真实生产业务】
    - status 严格按 APPLY_STATUSES 五态流转，非法跳转由业务层拦截；
    - qty_propose / capital 来自 core 计算的补货建议，不在本表写死任何数字；
    - 所有时间、操作人（submit_user / approve_user）全部落库留痕。
    """

    __tablename__ = "replenish_apply"
    __table_args__ = (
        CheckConstraint(_APPLY_STATUS_CHECK, name="ck_replenish_apply_status"),
        Index("ix_replenish_apply_dataset_sku", "dataset_id", "sku_id"),
    )

    apply_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    sku_id: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False, index=True)
    qty_propose: Mapped[int] = mapped_column(Integer, nullable=False)
    capital: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    route_code: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    objective_mode: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    status: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    submit_user: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    submit_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )
    approve_user: Mapped[Optional[str]] = mapped_column(String(NAME_MAX_LEN), nullable=True)
    approve_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PurchaseOrder(Base):
    """采购单表：审批通过后自动生成，收货质检在此累计实收与不良品。

    【合成演示业务，非真实生产业务】
    - order_qty 由申请的 qty_propose 生成，不写死；
    - receive_qty / defect_qty 为累计值，每次收货在事务内累加；
    - status 严格按 PO_STATUSES 五态，fully_received 后不可再收货。
    """

    __tablename__ = "purchase_order"
    __table_args__ = (
        CheckConstraint(_PO_STATUS_CHECK, name="ck_purchase_order_status"),
        Index("ix_purchase_order_apply", "apply_id"),
    )

    po_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    apply_id: Mapped[str] = mapped_column(String(ID_MAX_LEN), nullable=False)
    sku_id: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    order_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    receive_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    defect_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(SKU_MAX_LEN), nullable=False)
    expect_arrive: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_arrive: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # PACK 19：取消留痕（可空；未取消的采购单三个字段都是 NULL）
    cancel_user: Mapped[Optional[str]] = mapped_column(String(SKU_MAX_LEN), nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cancel_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )


# ===========================================================================
# PACK 23：RBAC 认证授权表（只新增，原有 12 张业务表一字未改）
# 表名统一加 rbac_ 前缀：user/role/permission 在 PostgreSQL 里过于泛化，
# 且 ``user`` 是 SQL 保留字；前缀化后不会和业务表冲突。
# ===========================================================================
rbac_user_role = Table(
    "rbac_user_role",
    Base.metadata,
    Column(
        "user_id",
        String(ID_MAX_LEN),
        ForeignKey("rbac_user.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        String(ID_MAX_LEN),
        ForeignKey("rbac_role.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

rbac_role_permission = Table(
    "rbac_role_permission",
    Base.metadata,
    Column(
        "role_id",
        String(ID_MAX_LEN),
        ForeignKey("rbac_role.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        String(ID_MAX_LEN),
        ForeignKey("rbac_permission.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class RBACUser(Base):
    """用户：账号、密码哈希、启停状态。密码只存 scrypt 哈希，绝不存明文。"""

    __tablename__ = "rbac_user"
    __table_args__ = (
        UniqueConstraint("username", name="uq_rbac_user_username"),
        Index("ix_rbac_user_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    username: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    display_name: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, default="")
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    roles: Mapped[list["RBACRole"]] = relationship(
        "RBACRole",
        secondary=rbac_user_role,
        back_populates="users",
        lazy="selectin",
    )


class RBACRole(Base):
    """角色：一个角色可拥有多个权限，一个用户可拥有多个角色。"""

    __tablename__ = "rbac_role"
    __table_args__ = (UniqueConstraint("code", name="uq_rbac_role_code"),)

    id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    code: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )

    users: Mapped[list["RBACUser"]] = relationship(
        "RBACUser",
        secondary=rbac_user_role,
        back_populates="roles",
        lazy="selectin",
    )
    permissions: Mapped[list["RBACPermission"]] = relationship(
        "RBACPermission",
        secondary=rbac_role_permission,
        back_populates="roles",
        lazy="selectin",
    )


class RBACPermission(Base):
    """权限：code 是校验用的稳定标识，例如 ``rbac:user:read`` / ``apply:approve``。"""

    __tablename__ = "rbac_permission"
    __table_args__ = (UniqueConstraint("code", name="uq_rbac_permission_code"),)

    id: Mapped[str] = mapped_column(String(ID_MAX_LEN), primary_key=True)
    code: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    resource: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )

    roles: Mapped[list["RBACRole"]] = relationship(
        "RBACRole",
        secondary=rbac_role_permission,
        back_populates="permissions",
        lazy="selectin",
    )


class RBACAuditLog(Base):
    """鉴权审计：登录结果、拒绝访问、管理操作都落一行；只追加不更新。"""

    __tablename__ = "rbac_audit_log"
    __table_args__ = (Index("ix_rbac_audit_created", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(ID_MAX_LEN), nullable=True)
    username: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False)
    resource: Mapped[str] = mapped_column(String(NAME_MAX_LEN), nullable=False, default="")
    result: Mapped[str] = mapped_column(String(20), nullable=False, default="allow")
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )


TABLE_MODELS: tuple[type[Base], ...] = (
    Datasets,
    Products,
    SalesDaily,
    InventoryDaily,
    InboundBatches,
    DemandDaily,
    ForecastRuns,
    ForecastPoints,
    Suggestions,
    AgentRuns,
    ReplenishApply,
    PurchaseOrder,
    RBACUser,
    RBACRole,
    RBACPermission,
    RBACAuditLog,
)

__all__ = [
    "Base",
    "SOURCE_TYPES",
    "TABLE_MODELS",
    "Datasets",
    "Products",
    "SalesDaily",
    "InventoryDaily",
    "InboundBatches",
    "DemandDaily",
    "ForecastRuns",
    "ForecastPoints",
    "Suggestions",
    "AgentRuns",
    # PACK 12：补货审批履约两张业务表（只新增，上面导出名不变）
    "APPLY_STATUSES",
    "PO_STATUSES",
    "ReplenishApply",
    "PurchaseOrder",
    # PACK 23：RBAC 表（只新增，旧导出名不变）
    "RBACUser",
    "RBACRole",
    "RBACPermission",
    "RBACAuditLog",
]
