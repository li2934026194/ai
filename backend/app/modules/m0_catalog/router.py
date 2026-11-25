from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m0_catalog.schemas import (
    CostDecisionReq,
    CostProposeReq,
    CsvImportReq,
    ProductCreateReq,
    ShopCreateReq,
    StocktakeReq,
)
from app.modules.m0_catalog.service import M0CatalogService

router = APIRouter(prefix="/api/v1/orgs/{org_id}/m0", tags=["M0 Catalog & Inventory"])
svc = M0CatalogService()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.get("/shops")
async def list_shops(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_shops(session, org_ctx.org_id, actor=actor)}, trace_id=_trace(request))


@router.post("/shops")
async def create_shop(
    request: Request,
    req: ShopCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:shop:manage")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.create_shop(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/shops/{shop_id}/sync")
async def sync_shop(
    request: Request,
    shop_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:shop:manage")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.sync_shop(session, org_ctx.org_id, shop_id, actor, _trace(request)), trace_id=_trace(request))


@router.get("/products")
async def list_products(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m0:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_products(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/products")
async def upsert_product(
    request: Request,
    req: ProductCreateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:cost:propose")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.upsert_product(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/ledger")
async def get_orders_and_quotes(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.list_orders_and_quotes(session, org_ctx.org_id, actor=actor), trace_id=_trace(request))


@router.post("/cost-requests")
async def propose_cost(
    request: Request,
    req: CostProposeReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:cost:propose")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.propose_cost_change(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/cost-requests/{req_id}/decide")
async def decide_cost(
    request: Request,
    req_id: str,
    req: CostDecisionReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:cost:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    return build_envelope(data=await svc.decide_cost_change(session, org_ctx.org_id, req_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.get("/inventory")
async def list_inventory(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m0:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_inventory(session, org_ctx.org_id)}, trace_id=_trace(request))


@router.post("/inventory/stocktake")
async def stocktake(
    request: Request,
    req: StocktakeReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:inventory:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data=await svc.submit_stocktake(session, org_ctx.org_id, req, actor, _trace(request)), trace_id=_trace(request))


@router.post("/orders/import-csv")
async def import_csv(
    request: Request,
    req: CsvImportReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m0:cost:propose")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data=await svc.import_csv_orders(
            session,
            org_ctx.org_id,
            req.csv_text,
            actor,
            _trace(request),
            filename=req.filename,
            source_type=req.source_type,
        ),
        trace_id=_trace(request),
    )


@router.get("/fx-rates")
async def list_fx_rates(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m0:read")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(data={"items": await svc.list_fx_rates(session, org_ctx.org_id)}, trace_id=_trace(request))
