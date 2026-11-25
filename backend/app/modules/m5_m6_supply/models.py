from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


class M5SalesHistory(Base):
    __tablename__ = "m5_sales_history"
    __table_args__ = (UniqueConstraint("org_id", "sku", "sales_date", name="uq_m5_org_sku_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sales_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    qty_raw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    on_hand_eod: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    revenue_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


class M6ReplenishApply(Base):
    __tablename__ = "m6_replenish_applies"

    apply_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    route_code: Mapped[str] = mapped_column(String(24), nullable=False, default="sea")
    objective_mode: Mapped[str] = mapped_column(String(24), nullable=False, default="profit")
    qty_suggest: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    qty_propose: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    est_amount_rmb: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    submit_user: Mapped[str | None] = mapped_column(String(64), nullable=True)
    submit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approve_user: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approve_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M6PurchaseOrder(Base):
    __tablename__ = "m6_purchase_orders"

    po_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    apply_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    route_code: Mapped[str] = mapped_column(String(24), nullable=False, default="sea")
    order_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    receive_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    defect_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="created")
    expect_arrive: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_arrive: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M6AlertEvent(Base):
    __tablename__ = "m6_alert_events"

    alert_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="HIGH")
    alert_type: Mapped[str] = mapped_column(String(48), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="OPEN")
    ack_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M6WeeklyReview(Base):
    __tablename__ = "m6_weekly_reviews"

    review_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    week_label: Mapped[str] = mapped_column(String(32), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    metrics_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
