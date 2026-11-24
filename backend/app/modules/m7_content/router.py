from typing import Literal
import uuid
from fastapi import APIRouter, Body, Depends, Header, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.modules.m7_content.schemas import (
    AplusGenerateReq,
    CertRenewReq,
    ComplianceCheckReq,
    CopyEditReq,
    CopyGenerateReq,
    CopyScanReq,
    ImageBatchReq,
    ImageSlotActionReq,
    IptcVerifyReq,
    PackageApproveReq,
    RuleMatrixUpdateReq,
    VideoGenerateReq,
    VideoSegmentEditReq,
    normalize_platform,
)
from app.modules.m7_content.services.compliance_service import ComplianceService
from app.modules.m7_content.services.copy_service import CopyService
from app.modules.m7_content.services.image_service import ImageService
from app.modules.m7_content.services.video_aplus_service import VideoAplusService


router = APIRouter(prefix="/api/v1/orgs/{org_id}/m7", tags=["M7 Content & Compliance"])

copy_svc = CopyService()
image_svc = ImageService()
video_aplus_svc = VideoAplusService()
compliance_svc = ComplianceService()


def _trace(request: Request) -> str:
    return getattr(request.state, "trace_id", "")


def _idemp(val: str | None) -> str:
    return val.strip() if val and val.strip() else f"auto_{uuid.uuid4().hex[:16]}"


# 1. GET /products/available
@router.get("/products/available")
async def get_available_products(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    items = await copy_svc.list_available_products(session, org_ctx.org_id)
    return build_envelope(data={"items": items, "total": len(items)}, trace_id=_trace(request))


# 2. POST /copy/generate
@router.post("/copy/generate")
async def generate_copy(
    request: Request,
    req: CopyGenerateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await copy_svc.generate_copy(
        session,
        org_id=org_ctx.org_id,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message="成功生成 3 组文案草稿", data=data, trace_id=_trace(request))


# 3. POST /copy/scan
@router.post("/copy/scan")
async def scan_copy(
    request: Request,
    req: CopyScanReq,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await copy_svc.scan_copy(session, org_id=org_ctx.org_id, req=req)
    return build_envelope(data=data, trace_id=_trace(request))


# 4. POST /copy/assets/{asset_id}/select
@router.post("/copy/assets/{asset_id}/select")
async def select_copy_asset(
    request: Request,
    asset_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await copy_svc.select_asset(
        session, org_id=org_ctx.org_id, asset_id=asset_id, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(message="已采纳写入交付清单", data=data, trace_id=_trace(request))


# 5. PUT /copy/assets/{asset_id}
@router.put("/copy/assets/{asset_id}")
async def edit_copy_asset(
    request: Request,
    asset_id: str,
    req: CopyEditReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await copy_svc.edit_asset(
        session,
        org_id=org_ctx.org_id,
        asset_id=asset_id,
        req=req,
        actor=actor,
        trace_id=_trace(request),
    )
    return build_envelope(message="文案微调已保存（原稿已保留）", data=data, trace_id=_trace(request))


# 6. POST /copy/assets/{asset_id}/restore
@router.post("/copy/assets/{asset_id}/restore")
async def restore_copy_asset(
    request: Request,
    asset_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await copy_svc.restore_asset(
        session, org_id=org_ctx.org_id, asset_id=asset_id, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(message="已一键还原 AI 原稿", data=data, trace_id=_trace(request))


# 7. POST /images/batch
@router.post("/images/batch", status_code=status.HTTP_202_ACCEPTED)
async def submit_image_batch(
    request: Request,
    req: ImageBatchReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await image_svc.submit_batch(
        session,
        org_id=org_ctx.org_id,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message="已提交 1+4 套图生成任务", data=data, trace_id=_trace(request))


# 8. GET /engines/status
@router.get("/engines/status")
async def get_engines_status(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await image_svc.get_engines_status(session, org_ctx.org_id)
    return build_envelope(data=data, trace_id=_trace(request))


# 9. POST /jobs/{job_id}/sync
@router.post("/jobs/{job_id}/sync")
async def sync_image_job(
    request: Request,
    job_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await image_svc.sync_job(
        session, org_id=org_ctx.org_id, job_id=job_id, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(data=data, trace_id=_trace(request))


# 10. POST /images/slots/{slot_idx}/regenerate
@router.post("/images/slots/{slot_idx}/regenerate")
async def regenerate_image_slot(
    request: Request,
    slot_idx: int,
    req: ImageSlotActionReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await image_svc.regenerate_slot(
        session,
        org_id=org_ctx.org_id,
        slot_idx=slot_idx,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message=f"已完成图位 img_{slot_idx} 单图重绘", data=data, trace_id=_trace(request))


# 11. POST /images/slots/{slot_idx}/inpaint
@router.post("/images/slots/{slot_idx}/inpaint")
async def inpaint_image_slot(
    request: Request,
    slot_idx: int,
    req: ImageSlotActionReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await image_svc.inpaint_slot(
        session,
        org_id=org_ctx.org_id,
        slot_idx=slot_idx,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message=f"已完成图位 img_{slot_idx} 局部修改", data=data, trace_id=_trace(request))


# 12. POST /images/iptc/verify
@router.post("/images/iptc/verify")
async def verify_iptc(
    request: Request,
    req: IptcVerifyReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:compliance:run")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await image_svc.verify_or_repair_iptc(
        session, org_id=org_ctx.org_id, req=req, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(data=data, trace_id=_trace(request))


# 13. POST /videos/generate
@router.post("/videos/generate")
async def generate_video(
    request: Request,
    req: VideoGenerateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await video_aplus_svc.generate_video(
        session,
        org_id=org_ctx.org_id,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message="15 秒短视频合成完成", data=data, trace_id=_trace(request))


# 14. PUT /videos/segments/{seg_idx}
@router.put("/videos/segments/{seg_idx}")
async def edit_video_segment(
    request: Request,
    seg_idx: int,
    req: VideoSegmentEditReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await video_aplus_svc.edit_segment(
        session,
        org_id=org_ctx.org_id,
        seg_idx=seg_idx,
        req=req,
        actor=actor,
        trace_id=_trace(request),
    )
    return build_envelope(message="分镜配置已更新", data=data, trace_id=_trace(request))


# 15. POST /videos/segments/{seg_idx}/regenerate
@router.post("/videos/segments/{seg_idx}/regenerate")
async def regenerate_video_segment(
    request: Request,
    seg_idx: int,
    sku: str = Body(..., embed=True),
    platform: str = Body(default="amazon_us", embed=True),
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await video_aplus_svc.regenerate_segment(
        session,
        org_id=org_ctx.org_id,
        seg_idx=seg_idx,
        sku=sku,
        platform=normalize_platform(platform),
        actor=actor,
        trace_id=_trace(request),
    )
    return build_envelope(message=f"已完成第 {seg_idx + 1} 段分镜重做", data=data, trace_id=_trace(request))


# 16. POST /aplus/generate
@router.post("/aplus/generate")
async def generate_aplus(
    request: Request,
    req: AplusGenerateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:content:edit")),
    session: AsyncSession = Depends(get_db_session),
    x_idempotency_key: str | None = Header(default=None),
):
    data = await video_aplus_svc.generate_aplus(
        session,
        org_id=org_ctx.org_id,
        req=req,
        actor=actor,
        idempotency_key=_idemp(x_idempotency_key),
        trace_id=_trace(request),
    )
    return build_envelope(message="A+ 图文详情长页组装完成", data=data, trace_id=_trace(request))


# 17. GET /compliance/matrix
@router.get("/compliance/matrix")
async def get_compliance_matrix(
    request: Request,
    sku: str | None = Query(default=None),
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await compliance_svc.get_matrix(session, org_id=org_ctx.org_id, sku=sku)
    return build_envelope(data=data, trace_id=_trace(request))


# 18. PUT /compliance/matrix/{rule_id}
@router.put("/compliance/matrix/{rule_id}")
async def update_compliance_matrix(
    request: Request,
    rule_id: str,
    req: RuleMatrixUpdateReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:rule:maintain")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await compliance_svc.update_rule(
        session,
        org_id=org_ctx.org_id,
        rule_id=rule_id,
        req=req,
        actor=actor,
        trace_id=_trace(request),
    )
    return build_envelope(message="规则矩阵已更新", data=data, trace_id=_trace(request))


# 19. POST /certs/renew
@router.post("/certs/renew")
async def renew_cert(
    request: Request,
    req: CertRenewReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:rule:maintain")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await compliance_svc.renew_cert(
        session, org_id=org_ctx.org_id, req=req, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(message="资质台账已更新", data=data, trace_id=_trace(request))


# 20. POST /compliance/check
@router.post("/compliance/check")
async def run_compliance_check(
    request: Request,
    req: ComplianceCheckReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:compliance:run")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await compliance_svc.run_5_checks(
        session, org_id=org_ctx.org_id, req=req, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(message="已完成 5 项上架合规检查", data=data, trace_id=_trace(request))


# 21. GET /packages/{sku}/summary
@router.get("/packages/{sku}/summary")
async def get_package_summary(
    request: Request,
    sku: str,
    platform: str = Query(default="amazon_us"),
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    plat = normalize_platform(platform)
    data = await compliance_svc.get_package_summary(
        session, org_id=org_ctx.org_id, sku=sku, platform=plat
    )
    return build_envelope(data=data, trace_id=_trace(request))


# 22a. POST /packages/approve
@router.post("/packages/approve")
async def approve_package(
    request: Request,
    req: PackageApproveReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:publish:approve")),
    session: AsyncSession = Depends(get_db_session),
):
    data = await compliance_svc.approve_package(
        session, org_id=org_ctx.org_id, req=req, actor=actor, trace_id=_trace(request)
    )
    return build_envelope(message="发布包审批已生效", data=data, trace_id=_trace(request))


# 22b. GET /packages/{sku}/export
@router.get("/packages/{sku}/export")
async def export_package(
    sku: str,
    request: Request,
    platform: str = Query(default="amazon_us"),
    format: Literal["zip", "html"] = Query(default="zip"),
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m7:package:export")),
    session: AsyncSession = Depends(get_db_session),
):
    plat = normalize_platform(platform)
    content, media_type, filename = await compliance_svc.export_package(
        session,
        org_id=org_ctx.org_id,
        sku=sku,
        platform=plat,
        fmt=format,
        actor=actor,
        trace_id=_trace(request),
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# 二进制媒体读回流（PNG / MP4）
@router.get("/media/{media_id}")
async def stream_media(
    media_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m7:content:read")),
    session: AsyncSession = Depends(get_db_session),
):
    data, mime = await compliance_svc.read_media_binary(
        session, org_id=org_ctx.org_id, media_id=media_id
    )
    return Response(content=data, media_type=mime)
