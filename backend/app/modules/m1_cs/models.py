from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


class M1FaqEntry(Base):
    __tablename__ = "m1_faq_entries"
    __table_args__ = (UniqueConstraint("org_id", "sku", name="uq_m1_org_sku_faq"),)

    faq_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    pain_points_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    faq_pairs_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class M1CsSession(Base):
    __tablename__ = "m1_cs_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(64), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="Amazon Buyer Msg")
    question: Mapped[str] = mapped_column(Text, nullable=False)
    reply: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="OPEN")
    handler_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class M1AftersalesTicket(Base):
    __tablename__ = "m1_aftersales_tickets"

    ticket_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    order_ref: Mapped[str] = mapped_column(String(64), nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, default="Amazon US")
    issue_type: Mapped[str] = mapped_column(String(64), nullable=False)
    refund_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PENDING_APPROVAL")
    submitter_id: Mapped[str] = mapped_column(String(64), nullable=False)
    approver_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
