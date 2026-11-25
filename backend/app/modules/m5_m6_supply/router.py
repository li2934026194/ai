from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m5_m6_supply.schemas import (
    ApplyCreateReq,
    ApplyRejectReq,
    PoCancelReq,
    PoReceiveReq,
    WeeklyReviewCreateReq,
    WhatIfSandboxReq,
)
from app.modules.m5_m6_supply.service import M5M6SupplyService

router = APIRouter(prefix="/api/v1/orgs/{org_id}/supply", tags=["M5 Forecast & M6 Replenishment"])
svc = M5M6SupplyService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.get("/forecast/{sku}")
async def get_forecast_and_suggestion(
    request: Request,
    sku: str,
    route_code: str | None = Query(default=None),
    objective_mode: str | None = Query(default=None),
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m5:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    data = await svc.get_forecast_and_suggestion(
        session, org_ctx.org_id, sku, route_code=route_code, objective_mode=objective_mode
    )
    return build_envelope(data=data, trace_id=_trace(request))


@router.post("/sandbox")
async def run_whatif_sandbox(
    request: Request,
    req: WhatIfSandboxReq,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m5:run")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.run_whatif_sandbox(session, org_ctx.org_id, req), trace_id=_trace(request))


@router.get("/applies")
async def list_applies(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m6:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_applies(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/applies")
async def create_apply(
    request: Request,
    req: ApplyCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:draft")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_apply(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/applies/{apply_id}/submit")
async def submit_apply(
    request: Request,
    apply_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:draft")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.submit_apply_flow(session, org_ctx.org_id, apply_id, actor, _trace(request)), trace_id=_trace(request))


@router.post("/applies/{apply_id}/approve")
async def approve_apply(
    request: Request,
    apply_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.approve_apply_flow(session, org_ctx.org_id, apply_id, actor, _trace(request)), trace_id=_trace(request))


@router.post("/applies/{apply_id}/reject")
async def reject_apply(
    request: Request,
    apply_id: str,
    req: ApplyRejectReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.reject_apply_flow(session, org_ctx.org_id, apply_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/pos")
async def list_pos(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m6:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_pos(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/pos/{po_id}/ship")
async def ship_po(
    request: Request,
    po_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:receive")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.ship_po(session, org_ctx.org_id, po_id, actor, _trace(request)), trace_id=_trace(request))


@router.post("/pos/{po_id}/receive")
async def receive_po(
    request: Request,
    po_id: str,
    req: PoReceiveReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:receive")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.receive_po(session, org_ctx.org_id, po_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/pos/{po_id}/cancel")
async def cancel_po(
    request: Request,
    po_id: str,
    req: PoCancelReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.cancel_po(session, org_ctx.org_id, po_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/alerts")
async def list_alerts(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m6:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_alerts(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/alerts/{alert_id}/ack")
async def ack_alert(
    request: Request,
    alert_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m6:read")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.ack_alert(session, org_ctx.org_id, alert_id, actor, _trace(request)), trace_id=_trace(request))


@router.get("/weekly-reviews")
async def list_weekly_reviews(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m5:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_weekly_reviews(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/weekly-reviews")
async def create_weekly_review(
    request: Request,
    req: WeeklyReviewCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m5:review")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_weekly_review(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))
