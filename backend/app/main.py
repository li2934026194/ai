from contextlib import asynccontextmanager
import os
import shutil
import uuid
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_rbac import ActorContext, require_perm
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, Base, engine, get_db_session
from app.core.exceptions import M7Error, build_envelope, m7_exception_handler
from app.core.storage import FileStorage
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m7_content.repository import M7Repository
from app.modules.m7_content.router import router as m7_router
from app.modules.m7_content.schemas import AuditEventOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await ensure_seed_data(session, org_id="org_demo")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="CrossPilot M7 商品内容创作与合规交付 API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def attach_trace_id(request: Request, call_next):
        trace_id = request.headers.get("X-Trace-Id") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        return response

    app.add_exception_handler(M7Error, m7_exception_handler)
    app.include_router(m7_router)

    @app.get("/healthz")
    async def healthz(request: Request, session: AsyncSession = Depends(get_db_session)):
        await session.execute(text("SELECT 1"))
        storage = FileStorage()
        probe_file = storage.root / ".healthcheck"
        probe_file.write_text("ok", encoding="utf-8")
        probe_file.unlink(missing_ok=True)
        return build_envelope(
            data={"status": "healthy", "storage_writable": True},
            trace_id=getattr(request.state, "trace_id", ""),
        )

    @app.get("/api/v1/orgs/{org_id}/m7/health")
    async def m7_health(
        request: Request,
        org_ctx: OrgContext = Depends(get_org_context),
        session: AsyncSession = Depends(get_db_session),
    ):
        await session.execute(text("SELECT 1"))
        await ensure_seed_data(session, org_id=org_ctx.org_id)
        ffmpeg_path = shutil.which(settings.FFMPEG_BIN) or (
            settings.FFMPEG_BIN if os.path.isfile(settings.FFMPEG_BIN) else None
        )
        video_ready = bool(settings.VIDEO_ENGINE_ENABLED and ffmpeg_path)
        return build_envelope(
            data={
                "org_id": org_ctx.org_id,
                "cloud_provider": settings.CLOUD_LLM_PROVIDER,
                "dashscope_key_configured": settings.dashscope_configured,
                "ffmpeg_available": bool(ffmpeg_path),
                "video_engine_enabled": settings.VIDEO_ENGINE_ENABLED,
                "video_ready": video_ready,
                "strict_separation_of_duties": settings.M7_STRICT_SEPARATION_OF_DUTIES,
            },
            trace_id=getattr(request.state, "trace_id", ""),
        )

    @app.get("/api/v1/orgs/{org_id}/m7/audit")
    async def list_m7_audit_events(
        request: Request,
        sku: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=200),
        org_ctx: OrgContext = Depends(get_org_context),
        _actor: ActorContext = Depends(require_perm("m7:content:read")),
        session: AsyncSession = Depends(get_db_session),
    ):
        repo = M7Repository(session)
        events = await repo.list_audit_events(org_ctx.org_id, sku=sku, limit=limit)
        data = [
            AuditEventOut(
                event_id=e.event_id,
                org_id=e.org_id,
                sku=e.sku,
                module=e.module,
                action=e.action,
                actor_id=e.actor_id,
                actor_role=e.actor_role,
                ok=e.ok,
                sentence_zh=e.sentence_zh,
                payload_json=e.payload_json or {},
                trace_id=e.trace_id,
                created_at=e.created_at.isoformat(),
            ).model_dump()
            for e in events
        ]
        return build_envelope(
            data={"items": data, "total": len(data)},
            trace_id=getattr(request.state, "trace_id", ""),
        )

    return app


app = create_app()
