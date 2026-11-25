import csv
from datetime import date, datetime
import html
import io
import json
import uuid
import zipfile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.core.storage import FileStorage
from app.mocks.seed_data import ensure_seed_data
from app.modules.m7_content.domain.rule_evaluator import RuleEvaluator
from app.modules.m7_content.models import (
    M7ApprovalRecord,
    M7CertRecord,
    M7ComplianceCheck,
    M7ComplianceRule,
    M7GenerationMedia,
)
from app.modules.m7_content.repository import M7Repository
from app.modules.m7_content.schemas import (
    CORE_COPY_SLOTS,
    EXT_COPY_SLOTS,
    IMAGE_SLOTS,
    CertRenewReq,
    ComplianceCheckReq,
    PackageApproveReq,
    RuleMatrixUpdateReq,
)


class ComplianceService:
    def __init__(self) -> None:
        self.catalog = ProductCatalogContract()
        self.evaluator = RuleEvaluator()

    async def get_matrix(
        self, session: AsyncSession, *, org_id: str, sku: str | None = None
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        rules = await repo.list_rules(org_id)
        certs = (
            await repo.list_certs(org_id, sku)
            if sku
            else list(
                (
                    await session.scalars(
                        select(M7CertRecord).where(M7CertRecord.org_id == org_id)
                    )
                ).all()
            )
        )
        today = date.today()
        return {
            "rules": [
                {
                    "rule_id": r.rule_id,
                    "platform": r.platform,
                    "category": r.category,
                    "rule_version": r.rule_version,
                    "effective_date": r.effective_date.isoformat(),
                    "title_max_chars": r.title_max_chars,
                    "bullet_max_chars": r.bullet_max_chars,
                    "search_terms_max_bytes": r.search_terms_max_bytes,
                    "lexicon_json": r.lexicon_json,
                    "required_certs_json": r.required_certs_json,
                    "image_policy_json": r.image_policy_json,
                    "updated_by": r.updated_by,
                }
                for r in rules
            ],
            "certs": [
                {
                    "cert_id": c.cert_id,
                    "sku": c.sku,
                    "cert_type": c.cert_type,
                    "cert_no": c.cert_no,
                    "expire_date": c.expire_date.isoformat(),
                    "status": (
                        "EXPIRED"
                        if c.expire_date < today
                        else ("EXPIRING" if (c.expire_date - today).days <= 30 else "VALID")
                    ),
                }
                for c in certs
            ],
        }

    async def update_rule(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        rule_id: str,
        req: RuleMatrixUpdateReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        rule = await session.scalar(
            select(M7ComplianceRule).where(
                M7ComplianceRule.org_id == org_id,
                M7ComplianceRule.rule_id == rule_id,
            )
        )
        if not rule:
            raise M7Error("M7-4041", f"未找到合规规则: {rule_id}", http_status=404)

        rule.title_max_chars = req.title_max_chars
        rule.bullet_max_chars = req.bullet_max_chars
        rule.search_terms_max_bytes = req.search_terms_max_bytes
        rule.lexicon_json = req.lexicon_json
        rule.required_certs_json = req.required_certs_json
        rule.image_policy_json = req.image_policy_json
        rule.updated_by = actor.user_id

        # 规则调整后失效该站点的既有有效审批
        repo = M7Repository(session)
        await session.flush()
        inv = await repo.invalidate_active_approvals(
            org_id, None, rule.platform, "RULE_MATRIX_UPDATED"
        )
        await write_audit_event(
            session,
            org_id=org_id,
            action="RULE_MATRIX_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新了规则矩阵 {rule.platform}/{rule.category} 的词库与限长配置"
            + (f"（已作废 {inv} 条旧审批）" if inv else ""),
            payload={"rule_id": rule.rule_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"rule_id": rule.rule_id, "updated_by": rule.updated_by}

    async def renew_cert(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: CertRenewReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        exp = date.fromisoformat(req.expire_date)
        today = date.today()
        status = (
            "EXPIRED" if exp < today else ("EXPIRING" if (exp - today).days <= 30 else "VALID")
        )
        existing = await session.scalar(
            select(M7CertRecord).where(
                M7CertRecord.org_id == org_id,
                M7CertRecord.sku == req.sku,
                M7CertRecord.cert_type == req.cert_type,
            )
        )
        if existing:
            existing.cert_no = req.cert_no
            existing.expire_date = exp
            existing.status = status
            cert_id = existing.cert_id
        else:
            cert_id = f"cert_{uuid.uuid4().hex[:12]}"
            session.add(
                M7CertRecord(
                    cert_id=cert_id,
                    org_id=org_id,
                    sku=req.sku,
                    cert_type=req.cert_type,
                    cert_no=req.cert_no,
                    expire_date=exp,
                    status=status,
                )
            )
        repo = M7Repository(session)
        inv = 0
        if status == "EXPIRED":
            inv = await repo.invalidate_active_approvals(org_id, req.sku, None, "CERT_EXPIRED")

        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="CERT_RENEWED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新了 {req.sku} 的资质 {req.cert_type}（到期日 {req.expire_date}，状态 {status}）",
            payload={"cert_id": cert_id, "status": status, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"cert_id": cert_id, "status": status, "expire_date": req.expire_date}

    async def run_5_checks(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: ComplianceCheckReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到 SKU: {req.sku}", http_status=404)
        rule = await repo.get_rule(org_id, req.platform, product.category)
        if not rule:
            raise M7Error("M7-4041", f"未找到规则 {req.platform}/{product.category}", http_status=404)

        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in selected])
        certs = await repo.list_certs(org_id, req.sku)
        storage = FileStorage()

        eval_res = self.evaluator.evaluate_five_checks(
            rule=rule,
            selected_assets=selected,
            media_by_asset=media_map,
            certs=certs,
            storage=storage,
        )

        check_id = f"chk_{uuid.uuid4().hex[:14]}"
        rec = M7ComplianceCheck(
            check_id=check_id,
            org_id=org_id,
            sku=req.sku,
            platform=req.platform,
            rule_id=rule.rule_id,
            rule_version=rule.rule_version,
            checks_json=eval_res["checks"],
            deliverable_count=eval_res["deliverable_count"],
            overall_pass=eval_res["overall_pass"],
            checked_by=actor.user_id,
        )
        session.add(rec)

        if not eval_res["overall_pass"]:
            await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "COMPLIANCE_FAILED")

        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="COMPLIANCE_CHECK_RUN",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=eval_res["overall_pass"],
            sentence_zh=f"{actor.display_name} 对 {req.sku}（{req.platform}）运行了 5 项上架合规检查：{'全部通过' if eval_res['overall_pass'] else '存在阻断项'}（交付度 {eval_res['deliverable_count']}/8）",
            payload={"check_id": check_id, "overall_pass": eval_res["overall_pass"]},
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "check_id": check_id,
            "sku": req.sku,
            "platform": req.platform,
            "rule_version": rule.rule_version,
            "deliverable_count": eval_res["deliverable_count"],
            "overall_pass": eval_res["overall_pass"],
            "checks": eval_res["checks"],
            "warnings": eval_res["warnings"],
        }

    async def get_package_summary(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        sku: str,
        platform: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, sku)
        if not product:
            raise M7Error("M7-4041", f"未找到 SKU: {sku}", http_status=404)

        selected = await repo.list_selected_assets(org_id, sku, platform)
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in selected])
        storage = FileStorage()
        by_slot = {a.asset_slot: a for a in selected}

        # 8+N 完整度计算
        img0_ok = "img_0" in by_slot and by_slot["img_0"].asset_id in media_map and storage.exists(media_map[by_slot["img_0"].asset_id].storage_key)
        img14_ok = all(
            s in by_slot and by_slot[s].asset_id in media_map and storage.exists(media_map[by_slot[s].asset_id].storage_key)
            for s in ("img_1", "img_2", "img_3", "img_4")
        )
        vid_ok = "vid_15s" in by_slot and by_slot["vid_15s"].asset_id in media_map and storage.exists(media_map[by_slot["vid_15s"].asset_id].storage_key)
        aplus_ok = "aplus_page" in by_slot

        core_items = [
            {"slot": "copy_title", "label": "核心标题", "done": "copy_title" in by_slot, "jump_route": "/m7/copy"},
            {"slot": "copy_bullets", "label": "五点卖点", "done": "copy_bullets" in by_slot, "jump_route": "/m7/copy"},
            {"slot": "copy_desc", "label": "商品详情描述", "done": "copy_desc" in by_slot, "jump_route": "/m7/copy"},
            {"slot": "copy_kw", "label": "后台搜索词", "done": "copy_kw" in by_slot, "jump_route": "/m7/copy"},
            {"slot": "img_0", "label": "白底主图", "done": img0_ok, "jump_route": "/m7/images"},
            {"slot": "img_1_4", "label": "4 张附图套图", "done": img14_ok, "jump_route": "/m7/images"},
            {"slot": "aplus_page", "label": "A+ 图文详情页", "done": aplus_ok, "jump_route": "/m7/video-aplus"},
            {"slot": "vid_15s", "label": "15 秒短视频成片", "done": vid_ok, "jump_route": "/m7/video-aplus"},
        ]
        done_cnt = sum(1 for item in core_items if item["done"])

        ext_items = [
            {"slot": s, "done": s in by_slot, "jump_route": "/m7/copy"} for s in EXT_COPY_SLOTS
        ]
        ext_done_cnt = sum(1 for item in ext_items if item["done"])

        # 买家视角折扣：仅划线价 > 售价时算折扣，绝不输出 NaN
        sale = product.sale_price_usd
        strike = product.strike_price_usd
        discount_pct = None
        if sale is not None and strike is not None and sale > 0 and strike > sale:
            discount_pct = round((1.0 - sale / strike) * 100)

        latest_check = await repo.get_latest_check(org_id, sku, platform)
        active_approval = await repo.get_active_approval(org_id, sku, platform)

        if active_approval and active_approval.decision == "APPROVED":
            approval_status = "APPROVED"
        elif latest_check and latest_check.overall_pass:
            approval_status = "CHECK_PASSED"
        elif latest_check and not latest_check.overall_pass:
            approval_status = "CHECK_FAILED"
        else:
            approval_status = "PENDING_CHECK"

        # 追踪最后一次修改创作资产的操作人，用于禁自批校对
        last_editor_id = ""
        if selected:
            latest_asset = max(selected, key=lambda a: a.updated_at or datetime.min)
            last_editor_id = latest_asset.last_edited_by

        copy_map = {
            s: {
                "asset_id": by_slot[s].asset_id,
                "version": by_slot[s].version,
                "edit_status": by_slot[s].edit_status,
                "lang": by_slot[s].lang,
                "content_json": by_slot[s].content_json,
                "orig_content_json": by_slot[s].orig_content_json,
                "scan_result_json": by_slot[s].scan_result_json,
            }
            for s in (*CORE_COPY_SLOTS, *EXT_COPY_SLOTS)
            if s in by_slot
        }
        images_list = []
        for s in IMAGE_SLOTS:
            a = by_slot.get(s)
            m = media_map.get(a.asset_id) if a else None
            if a and m:
                images_list.append(
                    {
                        "slot": s,
                        "slot_idx": int(s.split("_")[1]),
                        "asset_id": a.asset_id,
                        "version": a.version,
                        "media_id": m.media_id,
                        "media_url": f"/api/v1/orgs/{org_id}/m7/media/{m.media_id}",
                        "iptc_verified": m.iptc_verified,
                        "iptc_tags_json": m.iptc_tags_json,
                        "ai_person_flag": m.ai_person_flag,
                        "content_json": a.content_json,
                    }
                )
        video_info = None
        if vid_ok:
            va = by_slot["vid_15s"]
            vm = media_map[va.asset_id]
            video_info = {
                "asset_id": va.asset_id,
                "version": va.version,
                "media_id": vm.media_id,
                "media_url": f"/api/v1/orgs/{org_id}/m7/media/{vm.media_id}",
                "duration_sec": float(vm.duration_sec or 15.0),
                "bgm": (va.content_json or {}).get("bgm", "Upbeat Acoustic"),
                "segments": (va.content_json or {}).get("segments", []),
            }

        return {
            "sku": sku,
            "platform": platform,
            "product_name": product.name,
            "done_cnt": done_cnt,
            "ext_done_cnt": ext_done_cnt,
            "core_items": core_items,
            "ext_items": ext_items,
            "missing_items": [c for c in core_items if not c["done"]],
            "last_editor_id": last_editor_id,
            "approval_status": approval_status,
            "selected_copy_assets": copy_map,
            "latest_check": (
                {
                    "check_id": latest_check.check_id,
                    "overall_pass": latest_check.overall_pass,
                    "deliverable_count": latest_check.deliverable_count,
                    "checks": latest_check.checks_json,
                }
                if latest_check
                else None
            ),
            "active_approval": (
                {
                    "approval_id": active_approval.approval_id,
                    "approver_id": active_approval.approver_id,
                    "decision": active_approval.decision,
                    "note": active_approval.note,
                    "approved_at": active_approval.approved_at.isoformat(),
                }
                if active_approval
                else None
            ),
            "buyer_preview": {
                "banner": "预览，尚未发布",
                "is_mock": True,
                "title": ((copy_map.get("copy_title") or {}).get("content_json") or {}).get("text") or product.name,
                "bullets": ((copy_map.get("copy_bullets") or {}).get("content_json") or {}).get("bullets") or product.selling_points,
                "description": ((copy_map.get("copy_desc") or {}).get("content_json") or {}).get("text") or "",
                "aplus_html": (by_slot["aplus_page"].content_json or {}).get("html", "") if aplus_ok else "",
                "sale_price_usd": sale,
                "strike_price_usd": strike,
                "discount_pct": discount_pct,
                "specs": product.specs,
                "images": images_list,
                "video": video_info,
            },
        }

    async def approve_package(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: PackageApproveReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        settings = get_settings()
        repo = M7Repository(session)
        latest_check = await repo.get_latest_check(org_id, req.sku, req.platform)
        if not latest_check or not latest_check.overall_pass:
            raise M7Error(
                "M7-4222",
                "必须先完成 5 项上架合规检查并全部通过，方可执行主管审批",
                http_status=422,
            )

        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        last_editor_id = (
            max(selected, key=lambda a: a.updated_at or datetime.min).last_edited_by
            if selected
            else ""
        )

        # 职责分离禁自批校验
        if settings.M7_STRICT_SEPARATION_OF_DUTIES and last_editor_id and last_editor_id == actor.user_id:
            await write_audit_event(
                session,
                org_id=org_id,
                sku=req.sku,
                action="APPROVE_SELF_DENIED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name}({actor.user_id}) 尝试自我批准本人最后修改的 {req.sku} 发布包，已被职责分离规则拦截",
                payload={"last_editor_id": last_editor_id},
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error(
                "M7-4032",
                "违反职责分离原则：禁止内容最后修改人与审批主管为同一账号（禁自批）",
                http_status=403,
            )

        # 使旧有效审批失效，落库新审批记录
        await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "SUPERSEDED_BY_NEW_APPROVAL")

        approval_id = f"apr_{uuid.uuid4().hex[:14]}"
        rec = M7ApprovalRecord(
            approval_id=approval_id,
            org_id=org_id,
            sku=req.sku,
            platform=req.platform,
            check_id=latest_check.check_id,
            last_editor_id=last_editor_id or "unknown",
            approver_id=actor.user_id,
            decision=req.decision,
            note=req.note,
            is_active=(req.decision == "APPROVED"),
        )
        session.add(rec)
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="PACKAGE_APPROVED" if req.decision == "APPROVED" else "PACKAGE_REJECTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 对 {req.sku}（{req.platform}）执行了发布包审批：{req.decision}（{req.note or '无附加备注'}）",
            payload={"approval_id": approval_id, "check_id": latest_check.check_id},
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "approval_id": approval_id,
            "decision": rec.decision,
            "is_active": rec.is_active,
            "approver_id": rec.approver_id,
            "last_editor_id": rec.last_editor_id,
        }

    async def export_package(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        sku: str,
        platform: str,
        fmt: str,
        actor: ActorContext,
        trace_id: str,
    ) -> tuple[bytes, str, str]:
        repo = M7Repository(session)
        latest_check = await repo.get_latest_check(org_id, sku, platform)
        active_approval = await repo.get_active_approval(org_id, sku, platform)
        if not latest_check or not latest_check.overall_pass or not active_approval:
            await write_audit_event(
                session,
                org_id=org_id,
                sku=sku,
                action="EXPORT_GATE_BLOCKED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name} 尝试导出 {sku}（{platform}）交付包，因未通过合规或缺少有效主管审批被门禁阻断",
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error(
                "M7-4222",
                "未满足「5 项合规全通过 + 有效主管审批」门禁，禁止导出离线交付包",
                http_status=422,
            )

        summary = await self.get_package_summary(session, org_id=org_id, sku=sku, platform=platform)
        selected = await repo.list_selected_assets(org_id, sku, platform)
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in selected])
        storage = FileStorage()
        by_slot = {a.asset_slot: a for a in selected}

        html_doc = self._render_offline_html(summary, by_slot)

        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku,
            action="PACKAGE_EXPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导出了 {sku}（{platform}）本地离线交付包（格式：{fmt}）",
            payload={"format": fmt, "approval_id": active_approval.approval_id},
            trace_id=trace_id,
        )
        await session.commit()

        if fmt == "html":
            return html_doc.encode("utf-8"), "text/html; charset=utf-8", f"{sku}_{platform}_deliverable.html"

        # ZIP 分目录离线交付包
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            # 1. listing_copy.csv
            csv_buf = io.StringIO()
            writer = csv.writer(csv_buf)
            writer.writerow(["slot", "lang", "edit_status", "text"])
            for s in (*CORE_COPY_SLOTS, *EXT_COPY_SLOTS):
                if s in by_slot:
                    a = by_slot[s]
                    writer.writerow([s, a.lang, a.edit_status, (a.content_json or {}).get("text", "")])
            zf.writestr("listing_copy.csv", csv_buf.getvalue().encode("utf-8-sig"))

            # 2. images/ 5 张套图
            for s in IMAGE_SLOTS:
                a = by_slot.get(s)
                m = media_map.get(a.asset_id) if a else None
                if m and storage.exists(m.storage_key):
                    zf.writestr(f"images/{s}.png", storage.read_bytes(m.storage_key))

            # 3. aplus/aplus.html
            zf.writestr("aplus/aplus.html", html_doc.encode("utf-8"))

            # 4. video/vid_15s.mp4
            if "vid_15s" in by_slot and by_slot["vid_15s"].asset_id in media_map:
                vm = media_map[by_slot["vid_15s"].asset_id]
                if storage.exists(vm.storage_key):
                    zf.writestr("video/vid_15s.mp4", storage.read_bytes(vm.storage_key))

            # 5. compliance_report.json
            report = {
                "sku": sku,
                "platform": platform,
                "check_id": latest_check.check_id,
                "approval_id": active_approval.approval_id,
                "approver_id": active_approval.approver_id,
                "checks": latest_check.checks_json,
            }
            zf.writestr(
                "compliance_report.json",
                json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8"),
            )

        return zbuf.getvalue(), "application/zip", f"{sku}_{platform}_deliverable.zip"

    @staticmethod
    def _render_offline_html(summary: dict, by_slot: dict) -> str:
        bp = summary["buyer_preview"]
        safe_title = html.escape(str(bp["title"]))
        safe_sku = html.escape(str(summary["sku"]))
        safe_plat = html.escape(str(summary["platform"]))
        bullets_html = "".join(f"<li>{html.escape(str(b))}</li>" for b in bp.get("bullets", []))
        aplus_raw = bp.get("aplus_html") or ""
        return (
            "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'/>"
            f"<title>{safe_sku} 离线交付包</title>"
            "<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#0f172a}"
            ".banner{background:#fef3c7;border:1px solid #f59e0b;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-weight:600}"
            "</style></head><body>"
            "<div class='banner'>预览，尚未发布 · CrossPilot M7 离线交付归档包（仅供人工上传核验）</div>"
            f"<h1>{safe_title}</h1><p>SKU: {safe_sku} | 站点: {safe_plat}</p>"
            f"<ul>{bullets_html}</ul>"
            f"<div>{aplus_raw}</div>"
            "</body></html>"
        )

    async def read_media_binary(
        self, session: AsyncSession, *, org_id: str, media_id: str
    ) -> tuple[bytes, str]:
        media = await session.scalar(
            select(M7GenerationMedia).where(
                M7GenerationMedia.org_id == org_id,
                M7GenerationMedia.media_id == media_id,
            )
        )
        if not media:
            raise M7Error("M7-4041", f"未找到媒体资源: {media_id}", http_status=404)
        storage = FileStorage()
        data = storage.read_bytes(media.storage_key)
        return data, media.mime_type
