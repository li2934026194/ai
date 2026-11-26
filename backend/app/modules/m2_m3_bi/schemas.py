from pydantic import BaseModel, Field


class AdCreateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "Amazon Sponsored"
    campaign_name: str = Field(..., min_length=2, max_length=128)
    daily_budget_usd: float = Field(..., gt=0, le=50000)


class AdAdjustReq(BaseModel):
    daily_budget_usd: float = Field(..., gt=0, le=50000)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|PAUSED)$")


class CompetitorCreateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    competitor_brand: str = Field(..., min_length=1, max_length=64)
    asin_or_ref: str = Field(..., min_length=2, max_length=64)
    price_usd: float = Field(..., gt=0)
    rating: float = Field(4.5, ge=1.0, le=5.0)
    bsr_rank: int = Field(500, ge=1)


class CompetitorUpdateReq(BaseModel):
    price_usd: float = Field(..., gt=0)
    rating: float = Field(..., ge=1.0, le=5.0)
    bsr_rank: int = Field(..., ge=1)
    negative_topics: list[str] = Field(default_factory=list)


class BiAskReq(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    include_mock: bool = False


class DesignerCardItem(BaseModel):
    card_id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=64)
    metric_key: str = Field(..., pattern="^(gmv_usd|net_profit_usd|ad_spend_7d_usd|open_alerts_count)$")


class DesignerLayoutSaveReq(BaseModel):
    cards: list[DesignerCardItem] = Field(..., min_length=1, max_length=4)
    version: int = Field(1, ge=1)
