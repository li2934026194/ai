from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


class M2AdCampaign(Base):
    __tablename__ = "m2_ad_campaigns"

    campaign_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, default="Amazon Sponsored")
    campaign_name: Mapped[str] = mapped_column(String(128), nullable=False)
    daily_budget_usd: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    spend_7d_usd: Mapped[float] = mapped_column(Float, nullable=False, default=280.0)
    sales_7d_usd: Mapped[float] = mapped_column(Float, nullable=False, default=1400.0)
    acos: Mapped[float] = mapped_column(Float, nullable=False, default=0.20)
    roas: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE")


class M3CompetitorWatch(Base):
    __tablename__ = "m3_competitor_watches"

    watch_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    competitor_brand: Mapped[str] = mapped_column(String(64), nullable=False)
    asin_or_ref: Mapped[str] = mapped_column(String(64), nullable=False)
    price_usd: Mapped[float] = mapped_column(Float, nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=4.5)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    bsr_rank: Mapped[int] = mapped_column(Integer, nullable=False, default=450)
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.82)
    negative_topics_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    last_alert: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class M2DashboardLayout(Base):
    __tablename__ = "m2_dashboard_layouts"

    layout_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), index=True, unique=True, nullable=False)
    draft_layout_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    published_layout_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=False, default="system")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
