from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m8_org.schemas import LoginReq, PolicyToggleReq, UserCreateReq, UserRoleUpdateReq
from app.modules.m8_org.service import M8OrgService

auth_router = APIRouter(prefix="/api/v1/auth", tags=["Auth & Session"])
router = APIRouter(prefix="/api/v1/orgs/{org_id}/m8", tags=["M8 Organization & RBAC"])
svc = M8OrgService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@auth_router.post("/login")
async def login(
    request: Request,
    req: LoginReq,
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=req.org_id)
    return build_envelope(data=await svc.login(session, req, _trace(request)), trace_id=_trace(request))


@router.get("/users")
async def list_users(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m8:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_users(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/users")
async def create_user(
    request: Request,
    req: UserCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m8:manage")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_user(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.put("/users/{user_id}")
async def update_user(
    request: Request,
    user_id: str,
    req: UserRoleUpdateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m8:manage")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.update_user(session, org_ctx.org_id, user_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/roles")
async def list_roles(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m8:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_roles(session)}, trace_id=_trace(request))


@router.get("/policies")
async def list_policies(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m8:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_policies(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/policies/{policy_id}/toggle")
async def toggle_policy(
    request: Request,
    policy_id: str,
    req: PolicyToggleReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m8:manage")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.toggle_policy(session, org_ctx.org_id, policy_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/audits")
async def list_audits(
    request: Request,
    module: str | None = Query(default=None),
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m8:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_global_audits(session, org_ctx.org_id, module=module)}, trace_id=_trace(request))
