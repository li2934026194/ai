import csv
import io
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Product
from app.modules.m4_selection.models import M4Candidate
from app.modules.m4_selection.schemas import (
    CandidateCsvImportReq,
    CandidateDecisionReq,
    CandidateEvaluateReq,
    CandidateImportReq,
)


SCORE_WEIGHTS: dict[str, float] = {
    "demand": 0.25,
    "competition": 0.20,
    "margin": 0.25,
    "supply": 0.15,
    "compliance": 0.15,
}


def _calc_margin_pct(price_usd: float, cost_rmb: float, ship_rmb: float) -> float:
    rev_rmb = price_usd * 7.2
    platform_fee = rev_rmb * 0.15
    profit = rev_rmb - platform_fee - cost_rmb - ship_rmb
    return round(profit / rev_rmb, 4) if rev_rmb > 0 else 0.0


def _calc_total_score(scores: dict[str, int | float]) -> int:
    for key, val in scores.items():
        if val < 0 or val > 100:
            raise M7Error("M7-4221", f"五维评分 {key}={val} 越界，必须在 0~100 之间", http_status=422)
    weighted = sum(float(scores.get(k, 75)) * wt for k, wt in SCORE_WEIGHTS.items())
    return round(weighted)


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
                "source_nature": r.source_nature,
                "fulfillment_mode": r.fulfillment_mode,
                "ip_risk_note": r.ip_risk_note,
                "target_price_usd": r.target_price_usd,
                "est_cost_rmb": r.est_cost_rmb,
                "est_shipping_rmb": r.est_shipping_rmb,
                "est_margin_pct": r.est_margin_pct,
                "margin_gate_pass": r.est_margin_pct >= 0.30,
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
        total = _calc_total_score(default_scores)
        sku_norm = req.sku.strip().upper()
        session.add(
            M4Candidate(
                candidate_id=cid,
                org_id=org_id,
                sku=sku_norm,
                name=req.name.strip(),
                category=req.category,
                source_channel=req.source_channel,
                source_nature=req.source_nature,
                fulfillment_mode=req.fulfillment_mode,
                ip_risk_note=req.ip_risk_note,
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
            sku=sku_norm,
            module="M4",
            action="CANDIDATE_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导入选品候选 {sku_norm}（{req.name}，来源={req.source_nature}），预估毛利率 {margin*100:.2f}%",
            trace_id=trace_id,
        )
        await session.commit()
        return {"candidate_id": cid, "sku": sku_norm, "est_margin_pct": margin}

    async def import_csv_candidates(
        self, session: AsyncSession, org_id: str, req: CandidateCsvImportReq, actor: ActorContext, trace_id: str
    ) -> dict:
        fn_lower = (req.filename or "").lower()
        if req.source_nature == "internal_live" and any(k in fn_lower for k in ("mock", "demo", "演示", "测试")):
            raise M7Error("M7-4221", f"文件名「{req.filename}」含演示/测试标识，禁止选为内部实盘选品导入", http_status=422)

        reader = csv.DictReader(io.StringIO(req.csv_text.strip()))
        ready_count = 0
        pending_quote_count = 0
        risk_blocked_count = 0
        errors: list[dict] = []

        for line_no, row in enumerate(reader, start=2):
            sku = (row.get("sku") or "").strip().upper()
            name = (row.get("name") or "").strip()
            if not sku or not name:
                errors.append({"line": line_no, "message": "缺少 sku 或 name"})
                continue
            try:
                price = float(row.get("target_price_usd") or 0)
                cost = float(row.get("est_cost_rmb") or 0)
                ship = float(row.get("est_shipping_rmb") or 15.0)
            except (TypeError, ValueError):
                errors.append({"line": line_no, "message": f"{sku} 价格或成本数字非法"})
                continue
            if price <= 0 or cost <= 0 or ship < 0:
                errors.append({"line": line_no, "message": f"{sku} 售价/采购价必须大于 0"})
                continue

            ip_note = (row.get("ip_risk_note") or "").strip()
            margin = _calc_margin_pct(price, cost, ship)
            default_scores = {"demand": 80, "competition": 75, "margin": 82, "supply": 78, "compliance": 60 if ip_note else 85}
            total = _calc_total_score(default_scores)
            if ip_note or margin < 0.10:
                risk_blocked_count += 1
            elif req.source_nature == "external_estimate":
                pending_quote_count += 1
            else:
                ready_count += 1

            session.add(
                M4Candidate(
                    candidate_id=f"cand_{uuid.uuid4().hex[:10]}",
                    org_id=org_id,
                    sku=sku,
                    name=name,
                    category=(row.get("category") or "kitchen_appliance").strip(),
                    source_channel=(row.get("source_channel") or "CSV批量选品").strip(),
                    source_nature=req.source_nature,
                    fulfillment_mode=(row.get("fulfillment_mode") or "FBA").strip().upper(),
                    ip_risk_note=ip_note,
                    target_price_usd=price,
                    est_cost_rmb=cost,
                    est_shipping_rmb=ship,
                    est_margin_pct=margin,
                    scores_json=default_scores,
                    total_score=total,
                    status="DISCOVERED",
                )
            )

        imported = ready_count + pending_quote_count + risk_blocked_count
        await write_audit_event(
            session,
            org_id=org_id,
            module="M4",
            action="CANDIDATE_CSV_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 批量导入 {imported} 款选品（可投产 {ready_count}，待核价 {pending_quote_count}，风险/低毛利 {risk_blocked_count}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "imported": imported,
            "ready_count": ready_count,
            "pending_quote_count": pending_quote_count,
            "risk_blocked_count": risk_blocked_count,
            "errors": errors,
        }

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
        total = _calc_total_score(scores)
        cand.target_price_usd = req.target_price_usd
        cand.est_cost_rmb = req.est_cost_rmb
        cand.est_shipping_rmb = req.est_shipping_rmb
        cand.fulfillment_mode = req.fulfillment_mode
        cand.ip_risk_note = req.ip_risk_note
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
            sentence_zh=f"{actor.display_name} 评估候选 {cand.sku}（加权总分 {total}，毛利率 {margin*100:.2f}%，状态 {cand.status}）",
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
        if cand.status in ("APPROVED", "REJECTED"):
            raise M7Error("M7-4091", f"候选品 {cand.sku} 已终审（{cand.status}），不可重复决策", http_status=409)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and cand.submitter_id and cand.submitter_id == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：选品提交人禁止自批过会", http_status=403)

        cand.status = req.decision
        cand.approver_id = actor.user_id
        cand.decision_note = req.note
        m0_synced = False
        m7_draft_triggered = False

        if req.decision == "APPROVED":
            landed_cost_usd = round((cand.est_cost_rmb + cand.est_shipping_rmb) / 7.2, 2)
            existing_prod = await session.scalar(
                select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == cand.sku)
            )
            if existing_prod:
                existing_prod.origin = "M4_APPROVED"
                existing_prod.unit_cost_usd = landed_cost_usd
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
                        unit_cost_usd=landed_cost_usd,
                        sale_price_usd=cand.target_price_usd,
                        selling_points_json=[f"选品综合分 {cand.total_score}", f"预估毛利率 {cand.est_margin_pct*100:.2f}%"],
                    )
                )
            await session.flush()
            m0_synced = True

            if req.trigger_m7_draft:
                from app.modules.m7_content.schemas import CopyGenerateReq
                from app.modules.m7_content.services.copy_service import CopyService

                await CopyService().generate_copy(
                    session,
                    org_id=org_id,
                    req=CopyGenerateReq(sku=cand.sku, platform="amazon_us", lang="en-US"),
                    actor=actor,
                    idempotency_key=f"m4_auto_{cand.candidate_id}",
                    trace_id=trace_id,
                )
                m7_draft_triggered = True

        await write_audit_event(
            session,
            org_id=org_id,
            sku=cand.sku,
            module="M4",
            action="CANDIDATE_DECIDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} {'审批通过' if req.decision == 'APPROVED' else '驳回'}选品 {cand.sku}（同步M0={m0_synced}，触发M7草稿={m7_draft_triggered}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "candidate_id": candidate_id,
            "status": cand.status,
            "m0_synced": m0_synced,
            "m7_draft_triggered": m7_draft_triggered,
        }
