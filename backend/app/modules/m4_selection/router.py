from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m4_selection.schemas import CandidateDecisionReq, CandidateEvaluateReq, CandidateImportReq
from app.modules.m4_selection.service import M4SelectionService

router = APIRouter(prefix="/api/v1/orgs/{org_id}/m4", tags=["M4 Selection"])
svc = M4SelectionService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.get("/candidates")
async def list_candidates(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m4:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_candidates(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/candidates")
async def import_candidate(
    request: Request,
    req: CandidateImportReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m4:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.import_candidate(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/candidates/{candidate_id}/evaluate")
async def evaluate_candidate(
    request: Request,
    candidate_id: str,
    req: CandidateEvaluateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m4:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.evaluate_candidate(session, org_ctx.org_id, candidate_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/candidates/{candidate_id}/decide")
async def decide_candidate(
    request: Request,
    candidate_id: str,
    req: CandidateDecisionReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m4:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.decide_candidate(session, org_ctx.org_id, candidate_id, req, actor, _trace(request)), trace_id=_trace(request))
