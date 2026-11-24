import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import redact_secrets
from app.modules.m7_content.models import CoreAuditEvent


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def write_audit_event(
    session: AsyncSession,
    *,
    org_id: str,
    action: str,
    actor_id: str,
    actor_role: str,
    ok: bool,
    sentence_zh: str,
    sku: str | None = None,
    module: str = "M7",
    payload: dict[str, Any] | None = None,
    trace_id: str = "",
) -> CoreAuditEvent:
    ev = CoreAuditEvent(
        event_id=f"evt_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        sku=sku,
        module=module,
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        ok=ok,
        sentence_zh=redact_secrets(sentence_zh),
        payload_json=payload or {},
        trace_id=trace_id or f"tr_{uuid.uuid4().hex[:12]}",
    )
    session.add(ev)
    await session.flush()
    return ev
