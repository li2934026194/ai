from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


class M4Candidate(Base):
    __tablename__ = "m4_candidates"

    candidate_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="Consumer Electronics")
    source_channel: Mapped[str] = mapped_column(String(64), nullable=False, default="1688 趋势选品")
    target_price_usd: Mapped[float] = mapped_column(Float, nullable=False, default=29.99)
    est_cost_rmb: Mapped[float] = mapped_column(Float, nullable=False, default=42.0)
    est_shipping_rmb: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    est_margin_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.35)
    scores_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=75)
    operator_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DISCOVERED")
    submitter_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approver_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
