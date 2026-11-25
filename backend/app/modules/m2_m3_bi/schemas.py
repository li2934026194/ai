from pydantic import BaseModel, Field


class AdAdjustReq(BaseModel):
    daily_budget_usd: float = Field(..., gt=0)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|PAUSED)$")


class CompetitorCreateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    competitor_brand: str = Field(..., min_length=1, max_length=64)
    asin_or_ref: str = Field(..., min_length=2, max_length=64)
    price_usd: float = Field(..., gt=0)
    rating: float = Field(4.5, ge=1.0, le=5.0)
    bsr_rank: int = Field(500, ge=1)
