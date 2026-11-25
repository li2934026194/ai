from pydantic import BaseModel, Field


class ApplyCreateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    route_code: str = Field("sea", pattern="^(sea|air|rail|truck)$")
    objective_mode: str = Field("profit", pattern="^(sales|profit|cash)$")
    qty_propose: int = Field(..., gt=0)


class ApplyRejectReq(BaseModel):
    reason: str = Field(..., min_length=1)


class PoReceiveReq(BaseModel):
    receive_qty: int = Field(..., gt=0)
    defect_qty: int = Field(0, ge=0)


class PoCancelReq(BaseModel):
    reason: str = Field(..., min_length=1)


class WhatIfSandboxReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    route_code: str = Field("sea", pattern="^(sea|air|rail|truck)$")
    objective_mode: str = Field("profit", pattern="^(sales|profit|cash)$")
    lead_prod_override: int | None = Field(default=None, ge=0, le=90)
    review_period_override: int | None = Field(default=None, ge=1, le=90)
    service_level_override: float | None = Field(default=None, ge=0.90, le=0.99)
    demand_multiplier: float = Field(1.0, ge=0.3, le=3.0)


class WeeklyReviewCreateReq(BaseModel):
    week_label: str = Field(..., min_length=2, max_length=32)
    summary_text: str = Field(..., min_length=4)
