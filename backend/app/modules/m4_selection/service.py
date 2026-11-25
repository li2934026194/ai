import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Product
from app.modules.m4_selection.models import M4Candidate
from app.modules.m4_selection.schemas import CandidateDecisionReq, CandidateEvaluateReq, CandidateImportReq


def _calc_margin_pct(price_usd: float, cost_rmb: float, ship_rmb: float) -> float:
    rev_rmb = price_usd * 7.2
    platform_fee = rev_rmb * 0.15
    profit = rev_rmb - platform_fee - cost_rmb - ship_rmb
    return round(profit / rev_rmb, 4) if rev_rmb > 0 else 0.0


class M4SelectionService:
    async def list_candidates(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M4Candidate).where(M4Candidate.org_id == org_id).order_by(M4Candidate.created_at.desc())
            )
        ).all()
        return [
            {
                "candidate_id": r.candidate_id,
                "sku": r.sku,
                "name": r.name,
                "category": r.category,
                "source_channel": r.source_channel,
                "target_price_usd": r.target_price_usd,
                "est_cost_rmb": r.est_cost_rmb,
                "est_shipping_rmb": r.est_shipping_rmb,
                "est_margin_pct": r.est_margin_pct,
                "scores": r.scores_json or {},
                "total_score": r.total_score,
                "operator_note": r.operator_note,
                "status": r.status,
                "submitter_id": r.submitter_id,
                "approver_id": r.approver_id,
                "decision_note": r.decision_note,
            }
            for r in rows
        ]

    async def import_candidate(
        self, session: AsyncSession, org_id: str, req: CandidateImportReq, actor: ActorContext, trace_id: str
    ) -> dict:
        cid = f"cand_{uuid.uuid4().hex[:10]}"
        margin = _calc_margin_pct(req.target_price_usd, req.est_cost_rmb, req.est_shipping_rmb)
        default_scores = {"demand": 80, "competition": 75, "margin": 82, "supply": 78, "compliance": 85}
        total = round(sum(default_scores.values()) / len(default_scores))
        session.add(
            M4Candidate(
                candidate_id=cid,
                org_id=org_id,
                sku=req.sku.strip().upper(),
                name=req.name.strip(),
                category=req.category,
                source_channel=req.source_channel,
                target_price_usd=req.target_price_usd,
                est_cost_rmb=req.est_cost_rmb,
                est_shipping_rmb=req.est_shipping_rmb,
                est_margin_pct=margin,
                scores_json=default_scores,
                total_score=total,
                status="DISCOVERED",
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku.strip().upper(),
            module="M4",
            action="CANDIDATE_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导入选品候选 {req.sku.strip().upper()}（{req.name}），预估毛利率 {margin*100:.1f}%",
            trace_id=trace_id,
        )
        await session.commit()
        return {"candidate_id": cid, "est_margin_pct": margin}

    async def evaluate_candidate(
        self, session: AsyncSession, org_id: str, candidate_id: str, req: CandidateEvaluateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        cand = await session.scalar(
            select(M4Candidate).where(M4Candidate.org_id == org_id, M4Candidate.candidate_id == candidate_id)
        )
        if not cand:
            raise M7Error("M7-4041", f"未找到候选品: {candidate_id}", http_status=404)
        margin = _calc_margin_pct(req.target_price_usd, req.est_cost_rmb, req.est_shipping_rmb)
        scores = req.scores or cand.scores_json or {"demand": 80, "competition": 75, "margin": 82, "supply": 78, "compliance": 85}
        total = round(sum(scores.values()) / max(len(scores), 1))
        cand.target_price_usd = req.target_price_usd
        cand.est_cost_rmb = req.est_cost_rmb
        cand.est_shipping_rmb = req.est_shipping_rmb
        cand.est_margin_pct = margin
        cand.scores_json = scores
        cand.total_score = total
        cand.operator_note = req.operator_note
        if req.submit_for_approval:
            cand.status = "PENDING_APPROVAL"
            cand.submitter_id = actor.user_id
        else:
            cand.status = "EVALUATING"
        await write_audit_event(
            session,
            org_id=org_id,
            sku=cand.sku,
            module="M4",
            action="CANDIDATE_EVALUATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 评估候选 {cand.sku}（综合分 {total}，毛利率 {margin*100:.1f}%，状态 {cand.status}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"candidate_id": candidate_id, "status": cand.status, "total_score": total, "est_margin_pct": margin}

    async def decide_candidate(
        self, session: AsyncSession, org_id: str, candidate_id: str, req: CandidateDecisionReq, actor: ActorContext, trace_id: str
    ) -> dict:
        cand = await session.scalar(
            select(M4Candidate).where(M4Candidate.org_id == org_id, M4Candidate.candidate_id == candidate_id)
        )
        if not cand:
            raise M7Error("M7-4041", f"未找到候选品: {candidate_id}", http_status=404)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and cand.submitter_id and cand.submitter_id == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：选品提交人禁止自批过会", http_status=403)

        cand.status = req.decision
        cand.approver_id = actor.user_id
        cand.decision_note = req.note

        if req.decision == "APPROVED":
            existing_prod = await session.scalar(
                select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == cand.sku)
            )
            if existing_prod:
                existing_prod.origin = "M4_APPROVED"
                existing_prod.unit_cost_usd = round(cand.est_cost_rmb / 7.2, 2)
                existing_prod.sale_price_usd = cand.target_price_usd
                existing_prod.approver = actor.display_name
                existing_prod.decision_reason = req.note
            else:
                session.add(
                    M0Product(
                        product_id=f"prod_{uuid.uuid4().hex[:10]}",
                        org_id=org_id,
                        sku=cand.sku,
                        name=cand.name,
                        category=cand.category,
                        category_label_zh="精选新品",
                        platform="amazon_us",
                        origin="M4_APPROVED",
                        approver=actor.display_name,
                        decision_reason=req.note,
                        unit_cost_usd=round(cand.est_cost_rmb / 7.2, 2),
                        sale_price_usd=cand.target_price_usd,
                        selling_points_json=[f"选品综合分 {cand.total_score}", f"预估毛利率 {cand.est_margin_pct*100:.1f}%"],
                    )
                )

        await write_audit_event(
            session,
            org_id=org_id,
            sku=cand.sku,
            module="M4",
            action="CANDIDATE_DECIDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} {'审批通过' if req.decision == 'APPROVED' else '驳回'}选品 {cand.sku}（已同步 M0 主档供 M7 创作）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"candidate_id": candidate_id, "status": cand.status}
