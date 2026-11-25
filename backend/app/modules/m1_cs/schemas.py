from pydantic import BaseModel, Field


class FaqUpsertReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    pain_points: list[str] = Field(default_factory=list)
    faq_pairs: list[dict[str, str]] = Field(default_factory=list)


class SessionReplyReq(BaseModel):
    reply: str = Field(..., min_length=1)


class SimulatorMsgReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    question: str = Field(..., min_length=2)


class AftersalesCreateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    order_ref: str = Field(..., min_length=2, max_length=64)
    platform: str = "Amazon US"
    issue_type: str = Field(..., min_length=2, max_length=64)
    refund_usd: float = Field(..., ge=0)
    evidence_note: str = Field(..., min_length=2)


class AftersalesDecisionReq(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    note: str = Field(..., min_length=1)
