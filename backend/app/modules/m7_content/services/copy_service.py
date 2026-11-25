import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.contracts.voice_faq_contract import VoiceFaqContract
from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.exceptions import M7Error
from app.mocks.seed_data import ensure_seed_data
from app.modules.m7_content.adapters.cloud_api_adapter import CloudApiAdapter
from app.modules.m7_content.domain.lexicon_scanner import LexiconScanner
from app.modules.m7_content.models import M7GenerationAsset, M7GenerationJob
from app.modules.m7_content.repository import M7Repository
from app.modules.m7_content.schemas import (
    CORE_COPY_SLOTS,
    EXT_COPY_SLOTS,
    CopyEditReq,
    CopyGenerateReq,
    CopyScanReq,
)


def _asset_to_dict(a: M7GenerationAsset) -> dict:
    return {
        "asset_id": a.asset_id,
        "org_id": a.org_id,
        "sku": a.sku,
        "job_id": a.job_id,
        "asset_slot": a.asset_slot,
        "platform": a.platform,
        "lang": a.lang,
        "variant_idx": a.variant_idx,
        "version": a.version,
        "is_selected": a.is_selected,
        "edit_status": a.edit_status,
        "content_json": a.content_json,
        "orig_content_json": a.orig_content_json,
        "scan_result_json": a.scan_result_json,
        "last_edited_by": a.last_edited_by,
        "updated_at": a.updated_at.isoformat() if a.updated_at else "",
    }


class CopyService:
    def __init__(self) -> None:
        self.catalog = ProductCatalogContract()
        self.faq = VoiceFaqContract()
        self.scanner = LexiconScanner()
        self.adapter = CloudApiAdapter()

    async def list_available_products(self, session: AsyncSession, org_id: str) -> list[dict]:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        items = []
        for p in self.catalog.list_available_products(org_id):
            faq_snap = self.faq.get_faq_for_sku(org_id, p.sku)
            selected = await repo.list_selected_assets(org_id, p.sku, p.platform)
            slots = {a.asset_slot for a in selected}
            core_copy_done = sum(1 for s in CORE_COPY_SLOTS if s in slots)
            ext_copy_done = sum(1 for s in EXT_COPY_SLOTS if s in slots)
            items.append(
                {
                    "sku": p.sku,
                    "name": p.name,
                    "category": p.category,
                    "category_label_zh": p.category_label_zh,
                    "platform": p.platform,
                    "sale_price_usd": p.sale_price_usd,
                    "strike_price_usd": p.strike_price_usd,
                    "origin": p.origin,
                    "approver": p.approver,
                    "decision_reason": p.decision_reason,
                    "brand_name": p.brand_name,
                    "specs": p.specs,
                    "selling_points": p.selling_points,
                    "faq": {
                        "pain_points": faq_snap.pain_points,
                        "faq_pairs": faq_snap.faq_pairs,
                    },
                    "progress_hint": {
                        "core_copy_done": core_copy_done,
                        "ext_copy_done": ext_copy_done,
                    },
                }
            )
        return items

    async def generate_copy(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: CopyGenerateReq,
        actor: ActorContext,
        idempotency_key: str,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到可用商品 SKU: {req.sku}", http_status=404)

        existing_job = await repo.get_job_by_idempotency(org_id, idempotency_key)
        if existing_job:
            res = await session.scalars(
                select(M7GenerationAsset)
                .where(
                    M7GenerationAsset.org_id == org_id,
                    M7GenerationAsset.job_id == existing_job.job_id,
                    M7GenerationAsset.deleted_at.is_(None),
                )
                .order_by(M7GenerationAsset.variant_idx)
            )
            return {
                "job_id": existing_job.job_id,
                "idempotent_reused": True,
                "variants": [_asset_to_dict(a) for a in res.all()],
            }

        rule = await repo.get_rule(org_id, req.platform, product.category)
        faq_snap = self.faq.get_faq_for_sku(org_id, req.sku)
        must_terms = list(
            dict.fromkeys(((rule.lexicon_json or {}).get("must") if rule else []) + req.extra_must)
        )

        job_id = f"job_{uuid.uuid4().hex[:14]}"
        job = M7GenerationJob(
            job_id=job_id,
            org_id=org_id,
            sku=req.sku,
            job_type="COPY",
            platform=req.platform,
            workflow_id="wf_copy_v1",
            workflow_version="1.0.0",
            idempotency_key=idempotency_key,
            status="RUNNING",
            progress=40,
            params_json=req.model_dump(),
            created_by=actor.user_id,
        )
        session.add(job)
        await session.flush()

        variants = await self.adapter.generate_copy_variants(
            product,
            faq_snap,
            slot=req.asset_slot,
            platform=req.platform,
            lang=req.lang,
            must_terms=must_terms,
        )

        created_assets: list[M7GenerationAsset] = []
        for var in variants:
            text_val = str(var.content.get("text", ""))
            scan_res = self.scanner.scan(
                text_val,
                slot=req.asset_slot,
                rule=rule,
                extra_must=req.extra_must,
                extra_ban=req.extra_ban,
                platform=req.platform,
            )
            asset = M7GenerationAsset(
                asset_id=f"ast_{uuid.uuid4().hex[:14]}",
                org_id=org_id,
                sku=req.sku,
                job_id=job_id,
                asset_slot=req.asset_slot,
                platform=req.platform,
                lang=req.lang,
                variant_idx=var.variant_idx,
                version=1,
                is_selected=False,
                edit_status="AI_GENERATED",
                content_json={**var.content, "style_label": var.style_label},
                orig_content_json={**var.content, "style_label": var.style_label},
                scan_result_json=scan_res.to_dict(),
                last_edited_by=actor.user_id,
            )
            session.add(asset)
            created_assets.append(asset)

        job.status = "SUCCEEDED"
        job.progress = 100
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="COPY_GENERATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 为 {req.sku}（{req.platform}）生成了 {req.asset_slot} 的 3 组多语言候选文案",
            payload={"job_id": job_id, "slot": req.asset_slot, "platform": req.platform},
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "job_id": job_id,
            "idempotent_reused": False,
            "variants": [_asset_to_dict(a) for a in created_assets],
        }

    async def scan_copy(self, session: AsyncSession, *, org_id: str, req: CopyScanReq) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, req.sku)
        cat = product.category if product else req.category
        rule = await repo.get_rule(org_id, req.platform, cat)
        res = self.scanner.scan(
            req.text,
            slot=req.asset_slot,
            rule=rule,
            extra_must=req.extra_must,
            extra_ban=req.extra_ban,
            platform=req.platform,
        )
        return res.to_dict()

    async def select_asset(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        asset_id: str,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        repo = M7Repository(session)
        asset = await repo.get_asset(org_id, asset_id)
        if not asset:
            raise M7Error("M7-4041", f"未找到文案资产: {asset_id}", http_status=404)

        product = self.catalog.get_product(org_id, asset.sku)
        cat = product.category if product else "kitchen_appliance"
        rule = await repo.get_rule(org_id, asset.platform, cat)
        text_val = str((asset.content_json or {}).get("text", ""))
        scan_res = self.scanner.scan(
            text_val, slot=asset.asset_slot, rule=rule, platform=asset.platform
        )
        asset.scan_result_json = scan_res.to_dict()
        if not scan_res.passed:
            await write_audit_event(
                session,
                org_id=org_id,
                sku=asset.sku,
                action="COPY_SELECT_BLOCKED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name} 尝试采纳 {asset.sku} 的 {asset.asset_slot} 文案，因触发红线/长度拦截被阻断",
                payload=scan_res.to_dict(),
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error(
                "M7-4221",
                "文案触发合规拦截，未写入交付清单",
                http_status=422,
                data=scan_res.to_dict(),
            )

        await session.execute(
            update(M7GenerationAsset)
            .where(
                M7GenerationAsset.org_id == org_id,
                M7GenerationAsset.sku == asset.sku,
                M7GenerationAsset.platform == asset.platform,
                M7GenerationAsset.asset_slot == asset.asset_slot,
                M7GenerationAsset.is_selected.is_(True),
                M7GenerationAsset.deleted_at.is_(None),
            )
            .values(is_selected=False)
        )
        asset.is_selected = True
        asset.last_edited_by = actor.user_id
        inv = await repo.invalidate_active_approvals(org_id, asset.sku, asset.platform, "COPY_SELECTED")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=asset.sku,
            action="COPY_SELECTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 采纳了 {asset.sku}（{asset.platform}）的 {asset.asset_slot} 文案写入交付清单"
            + ("（已自动作废旧审批）" if inv else ""),
            payload={"asset_id": asset.asset_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return _asset_to_dict(asset)

    async def edit_asset(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        asset_id: str,
        req: CopyEditReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        repo = M7Repository(session)
        asset = await repo.get_asset(org_id, asset_id)
        if not asset:
            raise M7Error("M7-4041", f"未找到文案资产: {asset_id}", http_status=404)
        if asset.version != req.version:
            raise M7Error(
                "M7-4091",
                f"文案已被他人更新（当前版本 v{asset.version}，提交版本 v{req.version}），请刷新后重试",
                http_status=409,
            )
        if not req.text or not req.text.strip():
            raise M7Error("M7-4221", "修改后的文案不能为空", http_status=422)

        product = self.catalog.get_product(org_id, asset.sku)
        cat = product.category if product else "kitchen_appliance"
        rule = await repo.get_rule(org_id, asset.platform, cat)
        scan_res = self.scanner.scan(
            req.text,
            slot=asset.asset_slot,
            rule=rule,
            extra_must=req.extra_must,
            extra_ban=req.extra_ban,
            platform=asset.platform,
        )
        if not scan_res.passed:
            await write_audit_event(
                session,
                org_id=org_id,
                sku=asset.sku,
                action="COPY_BAN_BLOCKED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name} 微调 {asset.sku} 的 {asset.asset_slot} 命中违规词或超限，系统拦截未落盘",
                payload=scan_res.to_dict(),
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error(
                "M7-4221",
                "文案触发平台红线或字节上限拦截，已阻止写入交付清单",
                http_status=422,
                data=scan_res.to_dict(),
            )

        # 保护 orig_content_json 不可覆盖，仅更新 content_json
        new_content = dict(asset.content_json or {})
        new_content["text"] = req.text
        if asset.asset_slot == "copy_bullets":
            new_content["bullets"] = [ln.strip() for ln in req.text.splitlines() if ln.strip()]

        asset.content_json = new_content
        asset.scan_result_json = scan_res.to_dict()
        asset.edit_status = "MANUALLY_EDITED"
        asset.version += 1
        asset.last_edited_by = actor.user_id
        inv = await repo.invalidate_active_approvals(org_id, asset.sku, asset.platform, "COPY_EDITED")

        await write_audit_event(
            session,
            org_id=org_id,
            sku=asset.sku,
            action="COPY_EDITED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 微调保存了 {asset.sku} 的 {asset.asset_slot} 文案（v{asset.version}，原稿已保留）"
            + ("，并自动作废旧审批" if inv else ""),
            payload={"asset_id": asset.asset_id, "version": asset.version, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return _asset_to_dict(asset)

    async def restore_asset(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        asset_id: str,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        repo = M7Repository(session)
        asset = await repo.get_asset(org_id, asset_id)
        if not asset:
            raise M7Error("M7-4041", f"未找到文案资产: {asset_id}", http_status=404)

        asset.content_json = dict(asset.orig_content_json or {})
        asset.edit_status = "RESTORED_ORIGINAL"
        asset.version += 1
        asset.last_edited_by = actor.user_id

        product = self.catalog.get_product(org_id, asset.sku)
        cat = product.category if product else "kitchen_appliance"
        rule = await repo.get_rule(org_id, asset.platform, cat)
        text_val = str((asset.content_json or {}).get("text", ""))
        asset.scan_result_json = self.scanner.scan(
            text_val, slot=asset.asset_slot, rule=rule, platform=asset.platform
        ).to_dict()

        inv = await repo.invalidate_active_approvals(org_id, asset.sku, asset.platform, "COPY_RESTORED")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=asset.sku,
            action="COPY_RESTORED_ORIGINAL",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 将 {asset.sku} 的 {asset.asset_slot} 一键还原为 AI 原稿（v{asset.version}）",
            payload={"asset_id": asset.asset_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return _asset_to_dict(asset)
