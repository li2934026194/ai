from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m2_m3_bi.schemas import (
    AdAdjustReq,
    AdCreateReq,
    BiAskReq,
    CompetitorCreateReq,
    CompetitorUpdateReq,
    DesignerLayoutSaveReq,
)
from app.modules.m2_m3_bi.service import M2M3BiService

router = APIRouter(prefix="/api/v1/orgs/{org_id}", tags=["M2 BI & M3 Market"])
svc = M2M3BiService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.get("/home/workbench")
async def get_home_workbench(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m2:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.get_home_workbench(session, org_ctx.org_id), trace_id=_trace(request))


@router.get("/m2/overview")
async def get_m2_overview(
    request: Request,
    include_mock: bool = False,
    shop_id: str | None = None,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data=await svc.get_m2_overview(
            session, org_ctx.org_id, include_mock=include_mock, shop_id=shop_id, actor=actor
        ),
        trace_id=_trace(request),
    )


@router.get("/m2/ads")
async def list_ads(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m2:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_ads(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/m2/ads")
async def create_ad(
    request: Request,
    req: AdCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_ad(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/m2/ads/{campaign_id}/adjust")
async def adjust_ad(
    request: Request,
    campaign_id: str,
    req: AdAdjustReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.adjust_ad(session, org_ctx.org_id, campaign_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/m3/competitors")
async def list_competitors(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m3:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_competitors(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/m3/competitors")
async def create_competitor(
    request: Request,
    req: CompetitorCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m3:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_competitor(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.patch("/m3/competitors/{watch_id}")
async def update_competitor(
    request: Request,
    watch_id: str,
    req: CompetitorUpdateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m3:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(
        data=await svc.update_competitor(session, org_ctx.org_id, watch_id, req, actor, _trace(request)),
        trace_id=_trace(request),
    )


@router.post("/m3/ask")
async def ask_bi_assistant(
    request: Request,
    req: BiAskReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m3:ask")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data=await svc.ask_bi_assistant(session, org_ctx.org_id, req, actor, _trace(request)),
        trace_id=_trace(request),
    )


@router.get("/m2/designer/layout")
async def get_designer_layout(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m2:read")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.get_designer_layout(session, org_ctx.org_id), trace_id=_trace(request))


@router.put("/m2/designer/layout")
async def save_designer_layout(
    request: Request,
    req: DesignerLayoutSaveReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(
        data=await svc.save_designer_draft(session, org_ctx.org_id, req, actor, _trace(request)),
        trace_id=_trace(request),
    )


@router.post("/m2/designer/publish")
async def publish_designer_layout(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(
        data=await svc.publish_designer_layout(session, org_ctx.org_id, actor, _trace(request)),
        trace_id=_trace(request),
    )


@router.get("/m2/designer/cards")
async def query_designer_cards(
    request: Request,
    response: Response,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m2:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    response.headers["Cache-Control"] = "no-store"
    return build_envelope(
        data=await svc.query_designer_cards(session, org_ctx.org_id, actor),
        trace_id=_trace(request),
    )
