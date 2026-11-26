from pydantic import BaseModel, Field


class CandidateImportReq(BaseModel):
    sku: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=128)
    category: str = "Consumer Electronics"
    source_channel: str = "1688 趋势选品"
    source_nature: str = Field(
        default="internal_live",
        pattern="^(internal_live|external_estimate|public_bestseller|demo_only)$",
    )
    fulfillment_mode: str = Field(default="FBA", pattern="^(FBA|FBM)$")
    ip_risk_note: str = ""
    target_price_usd: float = Field(..., gt=0)
    est_cost_rmb: float = Field(..., gt=0)
    est_shipping_rmb: float = Field(15.0, ge=0)


class CandidateCsvImportReq(BaseModel):
    csv_text: str = Field(..., min_length=5)
    filename: str = ""
    source_nature: str = Field(
        default="internal_live",
        pattern="^(internal_live|external_estimate|public_bestseller|demo_only)$",
    )


class CandidateEvaluateReq(BaseModel):
    target_price_usd: float = Field(..., gt=0)
    est_cost_rmb: float = Field(..., gt=0)
    est_shipping_rmb: float = Field(..., ge=0)
    fulfillment_mode: str = Field(default="FBA", pattern="^(FBA|FBM)$")
    ip_risk_note: str = ""
    scores: dict[str, int] = Field(default_factory=dict)
    operator_note: str = ""
    submit_for_approval: bool = False


class CandidateDecisionReq(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    note: str = Field(..., min_length=2)
    trigger_m7_draft: bool = False
