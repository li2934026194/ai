from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


class M0Shop(Base):
    __tablename__ = "m0_shops"
    __table_args__ = (UniqueConstraint("org_id", "shop_code", name="uq_m0_shop_code"),)

    shop_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    shop_code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="USD")
    credential_mask: Mapped[str] = mapped_column(String(32), nullable=False, default="****4821")
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="CONNECTED")
    last_sync_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M0SyncBatch(Base):
    __tablename__ = "m0_sync_batches"

    batch_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    shop_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    added_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dedup_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    missing_dates_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="SUCCESS")
    triggered_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M0FxRate(Base):
    __tablename__ = "m0_fx_rates"
    __table_args__ = (UniqueConstraint("org_id", "currency", name="uq_m0_fx_org_curr"),)

    rate_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False)
    rate_to_usd: Mapped[float] = mapped_column(Float, nullable=False)
    rate_source: Mapped[str] = mapped_column(String(64), nullable=False, default="组织配置参考汇率")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class M0Product(Base):
    __tablename__ = "m0_products"
    __table_args__ = (UniqueConstraint("org_id", "sku", name="uq_m0_org_sku"),)

    product_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="kitchen_appliance")
    category_label_zh: Mapped[str] = mapped_column(String(64), nullable=False, default="厨卫小电")
    platform: Mapped[str] = mapped_column(String(24), nullable=False, default="amazon_us")
    brand_name: Mapped[str] = mapped_column(String(64), nullable=False, default="CrossPilot Lab")
    sale_price_usd: Mapped[float] = mapped_column(Float, nullable=False, default=24.9)
    strike_price_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=7.5)
    moq: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    pack_size: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=21)
    origin: Mapped[str] = mapped_column(String(32), nullable=False, default="IN_STORE_REFRESH")
    approver: Mapped[str] = mapped_column(String(64), nullable=False, default="在售老品翻新")
    decision_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    specs_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    selling_points_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class M0CostRequest(Base):
    __tablename__ = "m0_cost_requests"

    req_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    old_cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    new_cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PENDING")
    proposer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    reviewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M0Order(Base):
    __tablename__ = "m0_orders"

    order_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    shop_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    order_date: Mapped[str] = mapped_column(String(16), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    revenue_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PAID")


class M0Inventory(Base):
    __tablename__ = "m0_inventory"
    __table_args__ = (UniqueConstraint("org_id", "warehouse_code", "sku", name="uq_m0_wh_sku"),)

    inv_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    warehouse_code: Mapped[str] = mapped_column(String(32), nullable=False, default="WH-US-WEST")
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    in_transit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_stocktake_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class M0SupplierQuote(Base):
    __tablename__ = "m0_supplier_quotes"

    quote_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(128), nullable=False)
    unit_price_rmb: Mapped[float] = mapped_column(Float, nullable=False)
    moq: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=18)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="1688 模拟比价层（不直接写回成本）")
