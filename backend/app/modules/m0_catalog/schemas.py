from pydantic import BaseModel, Field


class ShopCreateReq(BaseModel):
    shop_code: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=128)
    platform: str = "amazon_us"
    currency: str = "USD"
    credential_mask: str = Field(default="****4821", min_length=2, max_length=32)
    is_mock: bool = True


class ProductCreateReq(BaseModel):
    sku: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=1, max_length=256)
    category: str = "kitchen_appliance"
    category_label_zh: str = "厨卫小电"
    platform: str = "amazon_us"
    brand_name: str = "CrossPilot Lab"
    sale_price_usd: float = Field(..., gt=0)
    strike_price_usd: float | None = None
    unit_cost_usd: float = Field(default=6.5, ge=0)
    moq: int = Field(default=120, ge=1)
    pack_size: int = Field(default=60, ge=1)
    lead_time_days: int = Field(default=21, ge=1)
    specs: dict[str, str] = Field(default_factory=dict)
    selling_points: list[str] = Field(default_factory=list)


class CostProposeReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    new_cost_usd: float = Field(..., ge=0)
    reason: str = Field(..., min_length=2)


class CostDecisionReq(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")


class StocktakeReq(BaseModel):
    warehouse_code: str = Field(default="WH-US-WEST", min_length=2, max_length=32)
    sku: str = Field(..., min_length=1, max_length=64)
    counted_qty: int = Field(..., ge=0)
    reason: str = "人工盘点校准"


class CsvImportReq(BaseModel):
    csv_text: str = Field(..., min_length=5)
    filename: str = ""
    source_type: str = Field(default="auto", pattern="^(auto|live|mock)$")
