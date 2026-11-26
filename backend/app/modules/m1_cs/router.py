from collections import defaultdict
from pathlib import Path
import uuid
from fastapi import APIRouter, Depends, File, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext, require_perm
from app.core.database import get_db_session
from app.core.exceptions import M7Error, build_envelope
from app.core.storage import FileStorage
from app.core.tenant import OrgContext, get_org_context
from app.mocks.seed_data import ensure_seed_data
from app.modules.m1_cs.models import M1AftersalesAttachment, M1AftersalesTicket
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

_ALLOWED_ATT_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".docx", ".txt"}
_MAX_ATT_SIZE = 5 * 1024 * 1024
_MAX_ATT_COUNT = 10


class M1EventHub:
    """进程内 WebSocket EventHub（对齐 SRS FR-CS-14：数据库为最终事实来源，断线靠 HTTP 回读）"""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[room].add(ws)

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self._rooms[room].discard(ws)

    async def broadcast(self, room: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(room, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room, ws)


event_hub = M1EventHub()


def _trace(r: Request) -> str:
    return getattr(r.state, "trace_id", "")


@router.websocket("/ws/{session_id}")
async def m1_session_ws(websocket: WebSocket, org_id: str, session_id: str):
    room = f"{org_id}:{session_id}"
    await event_hub.connect(room, websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"type": "pong", "session_id": session_id})
    except WebSocketDisconnect:
        event_hub.disconnect(room, websocket)


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
    data = await svc.reply_session(session, org_ctx.org_id, session_id, req, actor, _trace(request))
    await event_hub.broadcast(f"{org_ctx.org_id}:{session_id}", {"type": "SESSION_REPLIED", **data})
    return build_envelope(data=data, trace_id=_trace(request))


@router.post("/simulator/ask")
async def simulate_inquiry(
    request: Request,
    req: SimulatorMsgReq,
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:simulator:run")),
    session: AsyncSession = Depends(get_db_session),
):
    await ensure_seed_data(session, org_id=org_ctx.org_id)
    data = await svc.simulate_inquiry(session, org_ctx.org_id, req, actor, _trace(request))
    await event_hub.broadcast(f"{org_ctx.org_id}:{data['session_id']}", {"type": "SIMULATOR_ASK", **data})
    return build_envelope(data=data, trace_id=_trace(request))


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


@router.post("/aftersales/{ticket_id}/attachments")
async def upload_aftersales_attachments(
    request: Request,
    ticket_id: str,
    files: list[UploadFile] = File(...),
    org_ctx: OrgContext = Depends(get_org_context),
    actor: ActorContext = Depends(require_perm("m1:aftersales:submit")),
    session: AsyncSession = Depends(get_db_session),
):
    """对齐 SRS FR-CS-26：支持 multipart 附件上传（≤10件，单件≤5MB，限 PDF/JPG/PNG/DOCX/TXT）"""
    ticket = await session.scalar(
        select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_ctx.org_id, M1AftersalesTicket.ticket_id == ticket_id)
    )
    if not ticket:
        raise M7Error("M7-4041", f"未找到售后工单 {ticket_id}", http_status=404)

    existing = (
        await session.scalars(
            select(M1AftersalesAttachment).where(
                M1AftersalesAttachment.org_id == org_ctx.org_id,
                M1AftersalesAttachment.ticket_id == ticket_id,
            )
        )
    ).all()
    if len(existing) + len(files) > _MAX_ATT_COUNT:
        raise M7Error("M7-4221", f"单张售后工单最多支持 {_MAX_ATT_COUNT} 个附件", http_status=422)

    storage = FileStorage()
    saved: list[dict] = []
    for f in files:
        fname = Path(f.filename or "file.txt").name
        ext = Path(fname).suffix.lower()
        if ext not in _ALLOWED_ATT_EXTS:
            raise M7Error("M7-4221", f"不允许的附件格式 {ext}（仅允许 PDF/JPG/PNG/DOCX/TXT）", http_status=422)
        raw = await f.read()
        if not raw or len(raw) > _MAX_ATT_SIZE:
            raise M7Error("M7-4221", f"附件 {fname} 大小须在 1B~5MB 之间", http_status=422)
        att_id = f"att_{uuid.uuid4().hex[:10]}"
        key = f"orgs/{org_ctx.org_id}/m1/aftersales/{ticket_id}/{att_id}_{fname}"
        mime, size_b, _sha = storage.save_bytes(key, raw, allowed_mimes=None)
        row = M1AftersalesAttachment(
            att_id=att_id,
            org_id=org_ctx.org_id,
            ticket_id=ticket_id,
            filename=fname,
            mime_type=f.content_type or mime,
            size_bytes=size_b,
            storage_key=key,
        )
        session.add(row)
        saved.append({"att_id": att_id, "filename": fname, "size_bytes": size_b, "storage_backend": storage.backend_name})

    await write_audit_event(
        session,
        org_id=org_ctx.org_id,
        sku=ticket.sku,
        module="M1",
        action="AFTERSALES_ATTACHMENT_UPLOADED",
        actor_id=actor.user_id,
        actor_role=actor.role,
        ok=True,
        sentence_zh=f"{actor.display_name} 为售后工单 {ticket_id} 上传了 {len(saved)} 个凭证附件",
        trace_id=_trace(request),
    )
    await session.commit()
    return build_envelope(data={"ticket_id": ticket_id, "attachments": saved}, trace_id=_trace(request))


@router.get("/aftersales/{ticket_id}/attachments/{att_id}")
async def download_aftersales_attachment(
    ticket_id: str,
    att_id: str,
    org_ctx: OrgContext = Depends(get_org_context),
    _actor: ActorContext = Depends(require_perm("m1:read")),
    session: AsyncSession = Depends(get_db_session),
):
    att = await session.scalar(
        select(M1AftersalesAttachment).where(
            M1AftersalesAttachment.org_id == org_ctx.org_id,
            M1AftersalesAttachment.ticket_id == ticket_id,
            M1AftersalesAttachment.att_id == att_id,
        )
    )
    if not att:
        raise M7Error("M7-4041", "未找到售后附件或无权下载", http_status=404)
    raw = FileStorage().read_bytes(att.storage_key)
    return Response(
        content=raw,
        media_type=att.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )


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
