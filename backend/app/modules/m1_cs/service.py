import re
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Order
from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession, M1FaqEntry
from app.modules.m1_cs.schemas import (
    AftersalesCreateReq,
    AftersalesDecisionReq,
    FaqUpsertReq,
    SessionReplyReq,
    SimulatorMsgReq,
)


_EN_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in", "on", "for",
    "with", "can", "could", "do", "does", "did", "how", "what", "when", "where", "why",
    "this", "that", "it", "i", "you", "we", "my", "your", "per", "up",
}

_CROSS_LANG_SYNONYMS: dict[str, str] = {
    "grind": "研磨 粗细",
    "espresso": "意式 咖啡",
    "seal": "封口 真空",
    "bag": "袋 零食袋",
    "battery": "电池 续航 充电",
    "charge": "充电 续航",
    "waterproof": "防水",
}


def _tokenize_faq(text: str) -> set[str]:
    low = (text or "").strip().lower()
    en_tokens = {t for t in re.findall(r"[a-z0-9]+", low) if t not in _EN_STOPWORDS and len(t) > 1}
    cjk_chars = re.findall(r"[\u4e00-\u9fff]", low)
    cjk_bigrams = {cjk_chars[i] + cjk_chars[i + 1] for i in range(len(cjk_chars) - 1)}
    expanded = en_tokens | cjk_bigrams
    for t in en_tokens:
        if t in _CROSS_LANG_SYNONYMS:
            expanded.update(_CROSS_LANG_SYNONYMS[t].split())
    return expanded


def _match_faq_pair(question: str, faq_pairs: list[dict]) -> tuple[dict | None, float]:
    if not (question or "").strip() or not faq_pairs:
        return None, 0.0
    q_tokens = _tokenize_faq(question)
    if not q_tokens:
        return None, 0.0
    best_pair = None
    best_score = 0.0
    for pair in faq_pairs:
        pq = pair.get("q") or ""
        pa = pair.get("a") or ""
        p_tokens = _tokenize_faq(f"{pq} {pa}")
        overlap = len(q_tokens & p_tokens)
        score = overlap / max(len(q_tokens), 1)
        if overlap >= 2 and score > best_score:
            best_score = score
            best_pair = pair
    return best_pair, round(min(best_score, 0.99), 2)


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
        sku_norm = req.sku.strip().upper()
        row = await session.scalar(
            select(M1FaqEntry).where(M1FaqEntry.org_id == org_id, M1FaqEntry.sku == sku_norm)
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
                    sku=sku_norm,
                    pain_points_json=req.pain_points,
                    faq_pairs_json=req.faq_pairs,
                )
            )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku_norm,
            module="M1",
            action="FAQ_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新了 {sku_norm} 的导购 FAQ 知识库（共 {len(req.faq_pairs)} 组问答，将同步供 M7 文案引用）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"faq_id": fid, "sku": sku_norm, "faq_count": len(req.faq_pairs)}

    async def list_sessions(
        self,
        session: AsyncSession,
        org_id: str,
        is_mock: bool | None = None,
        status: str | None = None,
    ) -> list[dict]:
        stmt = select(M1CsSession).where(M1CsSession.org_id == org_id)
        if is_mock is not None:
            stmt = stmt.where(M1CsSession.is_mock == is_mock)
        if status:
            stmt = stmt.where(M1CsSession.status == status)
        rows = (await session.scalars(stmt.order_by(M1CsSession.created_at.desc()))).all()
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
        sku_norm = req.sku.strip().upper()
        faq = await session.scalar(select(M1FaqEntry).where(M1FaqEntry.org_id == org_id, M1FaqEntry.sku == sku_norm))
        pair, confidence = _match_faq_pair(req.question, (faq.faq_pairs_json or []) if faq else [])
        if pair:
            suggested = f"【知识库精准命中 · 匹配度 {int(confidence*100)}%】{pair.get('a', '')}"
            handoff_required = False
            matched_q = pair.get("q", "")
        else:
            suggested = "【安全兜底转人工】未在知识库检索到高置信度答案，为防止参数幻觉，已标记转接人工客服核实后回复。"
            handoff_required = True
            matched_q = ""

        sid = f"cs_{uuid.uuid4().hex[:10]}"
        session.add(
            M1CsSession(
                session_id=sid,
                org_id=org_id,
                sku=sku_norm,
                buyer_name=f"{actor.display_name}(模拟)",
                channel="Buyer Simulator (MOCK)",
                question=req.question,
                reply=suggested,
                is_mock=True,
                status="OPEN" if handoff_required else "REPLIED",
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku_norm,
            module="M1",
            action="BUYER_SIMULATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 发起 {sku_norm} 买家咨询模拟联调（命中FAQ={not handoff_required}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "session_id": sid,
            "suggested_reply": suggested,
            "matched_q": matched_q,
            "confidence": confidence,
            "handoff_required": handoff_required,
        }

    async def list_tickets(self, session: AsyncSession, org_id: str, status: str | None = None) -> list[dict]:
        stmt = select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id)
        if status:
            stmt = stmt.where(M1AftersalesTicket.status == status)
        rows = (await session.scalars(stmt.order_by(M1AftersalesTicket.created_at.desc()))).all()
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
        sku_norm = req.sku.strip().upper()
        matched_order = await session.scalar(
            select(M0Order).where(M0Order.org_id == org_id, M0Order.order_id == req.order_ref.strip())
        )
        if matched_order and req.refund_usd > matched_order.revenue_usd:
            raise M7Error(
                "M7-4221",
                f"退款金额 ${req.refund_usd} 超过订单实付总额 ${matched_order.revenue_usd}，已拦截超额建单",
                http_status=422,
            )

        tid = f"tkt_{uuid.uuid4().hex[:10]}"
        session.add(
            M1AftersalesTicket(
                ticket_id=tid,
                org_id=org_id,
                sku=sku_norm,
                order_ref=req.order_ref.strip(),
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
            sku=sku_norm,
            module="M1",
            action="AFTERSALES_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 为订单 {req.order_ref}（{sku_norm}）创建售后退款工单 ${req.refund_usd}",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "ticket_id": tid,
            "status": "PENDING_APPROVAL",
            "order_verified": bool(matched_order),
            "order_amount_usd": matched_order.revenue_usd if matched_order else None,
        }

    async def decide_ticket(
        self, session: AsyncSession, org_id: str, ticket_id: str, req: AftersalesDecisionReq, actor: ActorContext, trace_id: str
    ) -> dict:
        tkt = await session.scalar(
            select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id, M1AftersalesTicket.ticket_id == ticket_id)
        )
        if not tkt:
            raise M7Error("M7-4041", f"未找到售后工单: {ticket_id}", http_status=404)
        if tkt.status != "PENDING_APPROVAL":
            raise M7Error("M7-4091", f"售后工单 {ticket_id} 已终审（{tkt.status}），不可重复审批", http_status=409)
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
