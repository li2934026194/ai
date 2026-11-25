from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m1_cs.schemas import (
    AftersalesCreateReq,
    AftersalesDecisionReq,
    FaqUpsertReq,
    SessionReplyReq,
    SimulatorMsgReq,
)
from app.modules.m1_cs.service import M1CsService

router = APIRouter(prefix="/api/v1/orgs/{org_id}/m1", tags=["M1 CS & Aftersales"])
svc = M1CsService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.get("/faqs")
async def list_faqs(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m1:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_faqs(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/faqs")
async def upsert_faq(
    request: Request,
    req: FaqUpsertReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:faq:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.upsert_faq(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/sessions")
async def list_sessions(
    request: Request,
    is_mock: bool | None = None,
    status: str | None = None,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m1:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data={"items": await svc.list_sessions(session, org_ctx.org_id, is_mock=is_mock, status=status)},
        trace_id=_trace(request),
    )


@router.post("/sessions/{session_id}/reply")
async def reply_session(
    request: Request,
    session_id: str,
    req: SessionReplyReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:session:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.reply_session(session, org_ctx.org_id, session_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/simulator/ask")
async def simulate_inquiry(
    request: Request,
    req: SimulatorMsgReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:simulator:run")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.simulate_inquiry(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/aftersales")
async def list_aftersales(
    request: Request,
    status: str | None = None,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m1:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data={"items": await svc.list_tickets(session, org_ctx.org_id, status=status)},
        trace_id=_trace(request),
    )


@router.post("/aftersales")
async def create_aftersales(
    request: Request,
    req: AftersalesCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:aftersales:submit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_ticket(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/aftersales/{ticket_id}/decide")
async def decide_aftersales(
    request: Request,
    ticket_id: str,
    req: AftersalesDecisionReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:aftersales:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.decide_ticket(session, org_ctx.org_id, ticket_id, req, actor, _trace(request)), trace_id=_trace(request))
