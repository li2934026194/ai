import uuid
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.async_jobs import spawn_background_job
from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import M7Error, build_envelope
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m4_selection.schemas import (
    CandidateCsvImportReq,
    CandidateDecisionReq,
    CandidateEvaluateReq,
    CandidateImportReq,
)
from app.modules.m4_selection.service import M4SelectionService
from app.modules.m7_content.models import M7GenerationJob

router = APIRouter(prefix="/api/v1/orgs/{org_id}/m4", tags=["M4 Selection"])
svc = M4SelectionService()

_MAX_M4_CSV_BYTES = 25 * 1024 * 1024


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


@router.post("/candidates/import-csv")
async def import_csv_candidates(
    request: Request,
    req: CandidateCsvImportReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m4:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    return build_envelope(
        data=await svc.import_csv_candidates(session, org_ctx.org_id, req, actor, _trace(request)),
        trace_id=_trace(request),
    )


@router.post("/candidates/import-csv-async", status_code=status.HTTP_202_ACCEPTED)
async def import_csv_candidates_async(
    request: Request,
    req: CandidateCsvImportReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m4:edit")),
    session: AsyncSession = Depends(get_db_session),
):
    """对齐 SRS NFR-05/06：<=25MB 选品导入异步化并立即返回 202 Accepted"""
    if len(req.csv_text.encode("utf-8")) > _MAX_M4_CSV_BYTES:
        raise M7Error("M7-4221", "选品文件超出 25 MB 上限", http_status=422)
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    job_id = f"m4job_{uuid.uuid4().hex[:12]}"
    job = M7GenerationJob(
        job_id=job_id,
        org_id=org_ctx.org_id,
        sku="BATCH",
        job_type="m4_csv_import",
        platform="amazon_us",
        workflow_id=None,
        idempotency_key=f"m4_csv_{job_id}",
        status="QUEUED",
        progress=0,
        params_json={"rows_hint": len(req.csv_text.splitlines())},
        created_by=actor.user_id,
    )
    session.add(job)
    await session.commit()

    maker = async_sessionmaker(bind=session.bind, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    trace_id = _trace(request)

    async def _run() -> None:
        async with maker() as bg_session:
            bg_job = await bg_session.get(M7GenerationJob, job_id)
            if not bg_job:
                return
            bg_job.status = "RUNNING"
            bg_job.progress = 20
            await bg_session.commit()
            try:
                res = await svc.import_csv_candidates(bg_session, org_ctx.org_id, req, actor, trace_id)
                bg_job.status = "SUCCEEDED"
                bg_job.progress = 100
                bg_job.params_json = res
            except Exception as exc:
                bg_job.status = "FAILED"
                bg_job.error_code = "M7-5001"
                bg_job.error_detail = str(exc)
            await bg_session.commit()

    spawn_background_job(_run())
    return build_envelope(
        data={"job_id": job_id, "status": "QUEUED"},
        trace_id=trace_id,
    )


@router.get("/jobs/{job_id}")
async def get_m4_job(
    request: Request,
    job_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m4:read")),
    session: AsyncSession = Depends(get_db_session),
):
    job = await session.scalar(
        select(M7GenerationJob).where(M7GenerationJob.org_id == org_ctx.org_id, M7GenerationJob.job_id == job_id)
    )
    if not job:
        raise M7Error("M7-4041", f"异步导入任务 {job_id} 不存在", http_status=404)
    return build_envelope(
        data={
            "job_id": job.job_id,
            "status": job.status,
            "progress": job.progress,
            "result": job.params_json,
            "error_message": job.error_detail,
        },
        trace_id=_trace(request),
    )


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
