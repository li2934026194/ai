import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession, M1FaqEntry
from app.modules.m1_cs.schemas import (
    AftersalesCreateReq,
    AftersalesDecisionReq,
    FaqUpsertReq,
    SessionReplyReq,
    SimulatorMsgReq,
)


class M1CsService:
    async def list_faqs(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M1FaqEntry).where(M1FaqEntry.org_id == org_id).order_by(M1FaqEntry.sku))
        ).all()
        return [
            {
                "faq_id": r.faq_id,
                "sku": r.sku,
                "pain_points": r.pain_points_json or [],
                "faq_pairs": r.faq_pairs_json or [],
            }
            for r in rows
        ]

    async def upsert_faq(
        self, session: AsyncSession, org_id: str, req: FaqUpsertReq, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M1FaqEntry).where(M1FaqEntry.org_id == org_id, M1FaqEntry.sku == req.sku)
        )
        if row:
            row.pain_points_json = req.pain_points
            row.faq_pairs_json = req.faq_pairs
            fid = row.faq_id
        else:
            fid = f"faq_{uuid.uuid4().hex[:10]}"
            session.add(
                M1FaqEntry(
                    faq_id=fid,
                    org_id=org_id,
                    sku=req.sku,
                    pain_points_json=req.pain_points,
                    faq_pairs_json=req.faq_pairs,
                )
            )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M1",
            action="FAQ_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新了 {req.sku} 的导购 FAQ 知识库（将同步供 M7 文案引用）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"faq_id": fid, "sku": req.sku}

    async def list_sessions(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M1CsSession).where(M1CsSession.org_id == org_id).order_by(M1CsSession.created_at.desc()))
        ).all()
        return [
            {
                "session_id": r.session_id,
                "sku": r.sku,
                "buyer_name": r.buyer_name,
                "channel": r.channel,
                "question": r.question,
                "reply": r.reply,
                "is_mock": r.is_mock,
                "status": r.status,
                "handler_id": r.handler_id,
            }
            for r in rows
        ]

    async def reply_session(
        self, session: AsyncSession, org_id: str, session_id: str, req: SessionReplyReq, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M1CsSession).where(M1CsSession.org_id == org_id, M1CsSession.session_id == session_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到会话: {session_id}", http_status=404)
        row.reply = req.reply
        row.status = "REPLIED"
        row.handler_id = actor.user_id
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M1",
            action="CS_SESSION_REPLIED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 回复了买家 {row.buyer_name} 关于 {row.sku} 的咨询",
            trace_id=trace_id,
        )
        await session.commit()
        return {"session_id": session_id, "status": "REPLIED"}

    async def simulate_inquiry(
        self, session: AsyncSession, org_id: str, req: SimulatorMsgReq, actor: ActorContext, trace_id: str
    ) -> dict:
        faq = await session.scalar(select(M1FaqEntry).where(M1FaqEntry.org_id == org_id, M1FaqEntry.sku == req.sku))
        suggested = "请参考商品主档规格说明，已为您转接人工客服核实。"
        if faq and faq.faq_pairs_json:
            first_pair = faq.faq_pairs_json[0]
            suggested = f"【知识库命中】{first_pair.get('a', suggested)}"

        sid = f"cs_{uuid.uuid4().hex[:10]}"
        session.add(
            M1CsSession(
                session_id=sid,
                org_id=org_id,
                sku=req.sku,
                buyer_name=f"{actor.display_name}(模拟)",
                channel="Buyer Simulator (MOCK)",
                question=req.question,
                reply=suggested,
                is_mock=True,
                status="OPEN",
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M1",
            action="BUYER_SIMULATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 发起 {req.sku} 买家咨询模拟联调",
            trace_id=trace_id,
        )
        await session.commit()
        return {"session_id": sid, "suggested_reply": suggested}

    async def list_tickets(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M1AftersalesTicket)
                .where(M1AftersalesTicket.org_id == org_id)
                .order_by(M1AftersalesTicket.created_at.desc())
            )
        ).all()
        return [
            {
                "ticket_id": r.ticket_id,
                "sku": r.sku,
                "order_ref": r.order_ref,
                "platform": r.platform,
                "issue_type": r.issue_type,
                "refund_usd": r.refund_usd,
                "evidence_note": r.evidence_note,
                "status": r.status,
                "submitter_id": r.submitter_id,
                "approver_id": r.approver_id,
                "decision_note": r.decision_note,
            }
            for r in rows
        ]

    async def create_ticket(
        self, session: AsyncSession, org_id: str, req: AftersalesCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        tid = f"tkt_{uuid.uuid4().hex[:10]}"
        session.add(
            M1AftersalesTicket(
                ticket_id=tid,
                org_id=org_id,
                sku=req.sku,
                order_ref=req.order_ref,
                platform=req.platform,
                issue_type=req.issue_type,
                refund_usd=req.refund_usd,
                evidence_note=req.evidence_note,
                status="PENDING_APPROVAL",
                submitter_id=actor.user_id,
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M1",
            action="AFTERSALES_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 为订单 {req.order_ref}（{req.sku}）创建售后退款工单 ${req.refund_usd}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"ticket_id": tid, "status": "PENDING_APPROVAL"}

    async def decide_ticket(
        self, session: AsyncSession, org_id: str, ticket_id: str, req: AftersalesDecisionReq, actor: ActorContext, trace_id: str
    ) -> dict:
        tkt = await session.scalar(
            select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id, M1AftersalesTicket.ticket_id == ticket_id)
        )
        if not tkt:
            raise M7Error("M7-4041", f"未找到售后工单: {ticket_id}", http_status=404)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and tkt.submitter_id == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：客服建单人禁止自批售后退款", http_status=403)
        tkt.status = req.decision
        tkt.approver_id = actor.user_id
        tkt.decision_note = req.note
        await write_audit_event(
            session,
            org_id=org_id,
            sku=tkt.sku,
            module="M1",
            action="AFTERSALES_DECIDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} {'批准' if req.decision == 'APPROVED' else '驳回'}了售后工单 {ticket_id}（{req.note}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"ticket_id": ticket_id, "status": tkt.status}
