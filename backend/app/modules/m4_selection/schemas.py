from pydantic import BaseModel, Field


class CandidateImportReq(BaseModel):
    sku: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=128)
    category: str = "Consumer Electronics"
    source_channel: str = "1688 趋势选品"
    target_price_usd: float = Field(..., gt=0)
    est_cost_rmb: float = Field(..., gt=0)
    est_shipping_rmb: float = Field(15.0, ge=0)


class CandidateEvaluateReq(BaseModel):
    target_price_usd: float = Field(..., gt=0)
    est_cost_rmb: float = Field(..., gt=0)
    est_shipping_rmb: float = Field(..., ge=0)
    scores: dict[str, int] = Field(default_factory=dict)
    operator_note: str = ""
    submit_for_approval: bool = False


class CandidateDecisionReq(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    note: str = Field(..., min_length=1)
