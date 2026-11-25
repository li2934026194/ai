import os
import shutil
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.core.storage import FileStorage
from app.mocks.seed_data import ensure_seed_data
from app.modules.m7_content.adapters.cloud_api_adapter import CloudApiAdapter
from app.modules.m7_content.domain.iptc_handler import IptcMetadataHandler
from app.modules.m7_content.models import (
    M7GenerationAsset,
    M7GenerationJob,
    M7GenerationMedia,
)
from app.modules.m7_content.repository import M7Repository
from app.modules.m7_content.schemas import (
    IMAGE_SLOTS,
    ImageBatchReq,
    ImageSlotActionReq,
    IptcVerifyReq,
)


def _slot_response(org_id: str, asset: M7GenerationAsset, media: M7GenerationMedia) -> dict:
    return {
        "asset_id": asset.asset_id,
        "media_id": media.media_id,
        "asset_slot": asset.asset_slot,
        "slot_idx": int(asset.asset_slot.split("_")[1]),
        "version": asset.version,
        "is_selected": asset.is_selected,
        "mime_type": media.mime_type,
        "file_size": media.file_size,
        "sha256": media.sha256,
        "width": media.width,
        "height": media.height,
        "ai_person_flag": media.ai_person_flag,
        "iptc_verified": media.iptc_verified,
        "iptc_tags_json": media.iptc_tags_json,
        "media_url": f"/api/v1/orgs/{org_id}/m7/media/{media.media_id}",
        "content_json": asset.content_json,
    }


class ImageService:
    def __init__(self) -> None:
        self.catalog = ProductCatalogContract()
        self.adapter = CloudApiAdapter()
        self.iptc = IptcMetadataHandler()

    async def get_engines_status(self, session: AsyncSession, org_id: str) -> dict:
        settings = get_settings()
        ffmpeg_path = shutil.which(settings.FFMPEG_BIN) or (
            settings.FFMPEG_BIN if os.path.isfile(settings.FFMPEG_BIN) else None
        )
        return {
            "org_id": org_id,
            "engines": [
                {
                    "id": "dashscope",
                    "name": "阿里云百炼（通义千问 / 万相）",
                    "configured": settings.dashscope_configured,
                    "mode": "cloud" if settings.dashscope_configured else "fallback_to_local",
                },
                {
                    "id": "pillow_local",
                    "name": "本地 Pillow 确定性制图 + IPTC 写入",
                    "configured": True,
                    "mode": "ready",
                },
                {
                    "id": "ffmpeg_video",
                    "name": "本地 FFmpeg 15s 短视频合成节点",
                    "configured": bool(settings.VIDEO_ENGINE_ENABLED and ffmpeg_path),
                    "mode": "ready" if (settings.VIDEO_ENGINE_ENABLED and ffmpeg_path) else "unconfigured",
                },
                {
                    "id": "comfyui_pool",
                    "name": "ComfyUI GPU 扩展节点池（V1 预留）",
                    "configured": False,
                    "mode": "reserved",
                },
            ],
        }

    async def submit_batch(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: ImageBatchReq,
        actor: ActorContext,
        idempotency_key: str,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到可用商品 SKU: {req.sku}", http_status=404)

        existing = await repo.get_job_by_idempotency(org_id, idempotency_key)
        if existing:
            return {
                "job_id": existing.job_id,
                "status": existing.status,
                "progress": existing.progress,
                "workflow_id": existing.workflow_id,
                "workflow_version": existing.workflow_version,
                "idempotent_reused": True,
            }

        wf = await repo.get_workflow("wf_img_1plus4_v2")
        job_id = f"job_{uuid.uuid4().hex[:14]}"
        job = M7GenerationJob(
            job_id=job_id,
            org_id=org_id,
            sku=req.sku,
            job_type="IMG_BATCH",
            platform=req.platform,
            workflow_id=wf.workflow_id if wf else "wf_img_1plus4_v2",
            workflow_version=wf.version if wf else "2.1.0",
            idempotency_key=idempotency_key,
            status="QUEUED",
            progress=15,
            params_json=req.model_dump(),
            created_by=actor.user_id,
        )
        session.add(job)
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="IMG_BATCH_SUBMITTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 提交了 {req.sku}（{req.platform}）的 1+4 套图生成任务 {job_id}",
            payload={"job_id": job_id, "workflow_version": job.workflow_version},
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "job_id": job_id,
            "status": job.status,
            "progress": job.progress,
            "workflow_id": job.workflow_id,
            "workflow_version": job.workflow_version,
            "idempotent_reused": False,
        }

    async def sync_job(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        job_id: str,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        repo = M7Repository(session)
        job = await repo.get_job(org_id, job_id)
        if not job:
            raise M7Error("M7-4041", f"未找到生成任务: {job_id}", http_status=404)

        if job.status == "SUCCEEDED":
            assets = (
                await session.scalars(
                    select(M7GenerationAsset).where(
                        M7GenerationAsset.org_id == org_id,
                        M7GenerationAsset.job_id == job.job_id,
                        M7GenerationAsset.deleted_at.is_(None),
                    )
                )
            ).all()
            media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in assets])
            return {
                "job_id": job.job_id,
                "status": job.status,
                "progress": job.progress,
                "slots": [
                    _slot_response(org_id, a, media_map[a.asset_id])
                    for a in sorted(assets, key=lambda x: x.asset_slot)
                    if a.asset_id in media_map
                ],
            }

        product = self.catalog.get_product(org_id, job.sku)
        if not product:
            job.status = "FAILED"
            job.error_code = "M7-4041"
            await session.commit()
            raise M7Error("M7-4041", f"未找到 SKU {job.sku}", http_status=404)

        params = job.params_json or {}
        style = str(params.get("style", "Studio Minimalist"))
        aspect = str(params.get("aspect", "1:1"))
        avoid_terms = list(params.get("avoid_terms") or [])
        ai_person_slots = set(int(x) for x in (params.get("ai_person_slots") or []))
        slot_notes = dict(params.get("slot_notes") or {})

        storage = FileStorage()
        slots_out: list[dict] = []

        # 仅在全部 5 张真图落盘并通过魔数+IPTC 校验后才置为 SUCCEEDED
        job.status = "RUNNING"
        job.progress = 55
        await session.flush()

        for idx in range(5):
            slot_name = f"img_{idx}"
            ai_flag = idx in ai_person_slots
            gen = await self.adapter.generate_slot_image(
                product,
                slot_idx=idx,
                style=style,
                aspect=aspect,
                avoid_terms=avoid_terms,
                selling_points=product.selling_points,
                custom_instruction=str(slot_notes.get(str(idx), "")),
                ai_person_flag=ai_flag,
            )
            asset_id = f"ast_{uuid.uuid4().hex[:14]}"
            storage_key = f"orgs/{org_id}/{job.sku}/{job.platform}/{slot_name}_{asset_id}.png"
            mime, size, sha = storage.save_bytes(
                storage_key,
                gen.image_bytes,
                allowed_mimes={"image/png", "image/jpeg", "image/webp"},
            )
            ok_iptc, iptc_tags = self.iptc.verify_disk_file(
                storage, storage_key, ai_person_flag=ai_flag
            )
            if not ok_iptc:
                job.status = "FAILED"
                job.error_code = "M7-4242"
                await session.commit()
                raise M7Error("M7-4242", f"{slot_name} 末端 IPTC 写入后读盘校验失败", http_status=424)

            # 切换该槽位唯一选中状态
            await session.execute(
                update(M7GenerationAsset)
                .where(
                    M7GenerationAsset.org_id == org_id,
                    M7GenerationAsset.sku == job.sku,
                    M7GenerationAsset.platform == job.platform,
                    M7GenerationAsset.asset_slot == slot_name,
                    M7GenerationAsset.is_selected.is_(True),
                    M7GenerationAsset.deleted_at.is_(None),
                )
                .values(is_selected=False)
            )
            asset = M7GenerationAsset(
                asset_id=asset_id,
                org_id=org_id,
                sku=job.sku,
                job_id=job.job_id,
                asset_slot=slot_name,
                platform=job.platform,
                lang="en-US",
                variant_idx=0,
                version=1,
                is_selected=True,
                edit_status="AI_GENERATED",
                content_json={
                    "slot_idx": idx,
                    "prompt_used": gen.prompt_used,
                    "engine_mode": gen.engine_mode,
                    "style": style,
                    "aspect": aspect,
                },
                orig_content_json={"slot_idx": idx, "prompt_used": gen.prompt_used},
                scan_result_json={},
                last_edited_by=actor.user_id,
            )
            media = M7GenerationMedia(
                media_id=f"med_{uuid.uuid4().hex[:14]}",
                org_id=org_id,
                asset_id=asset_id,
                media_kind="IMAGE",
                mime_type=mime,
                file_size=size,
                sha256=sha,
                storage_key=storage_key,
                width=gen.width,
                height=gen.height,
                ai_person_flag=ai_flag,
                iptc_verified=ok_iptc,
                iptc_tags_json=iptc_tags,
            )
            session.add(asset)
            session.add(media)
            slots_out.append(_slot_response(org_id, asset, media))

        job.status = "SUCCEEDED"
        job.progress = 100
        inv = await repo.invalidate_active_approvals(org_id, job.sku, job.platform, "IMG_BATCH_SYNCED")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=job.sku,
            action="IMG_BATCH_SUCCEEDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 同步完成 {job.sku} 1+4 套图落盘并写入 IPTC/XMP 双标签（5/5 已验证）",
            payload={"job_id": job.job_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"job_id": job.job_id, "status": job.status, "progress": 100, "slots": slots_out}

    async def _replace_single_slot(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        slot_idx: int,
        req: ImageSlotActionReq,
        mode: str,
        actor: ActorContext,
        idempotency_key: str,
        trace_id: str,
    ) -> dict:
        if slot_idx < 0 or slot_idx > 4:
            raise M7Error("M7-4001", f"图位索引越界: {slot_idx}（必须为 0..4）", http_status=400)
        if mode == "inpaint" and not (req.instruction or "").strip():
            raise M7Error("M7-4001", "请填写局部修改要求", http_status=422)
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = self.catalog.get_product(org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到 SKU: {req.sku}", http_status=404)

        slot_name = f"img_{slot_idx}"
        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        prev_asset = next((a for a in selected if a.asset_slot == slot_name), None)
        prev_media = None
        if prev_asset:
            prev_map = await repo.list_media_for_assets(org_id, [prev_asset.asset_id])
            prev_media = prev_map.get(prev_asset.asset_id)

        job_id = f"job_{uuid.uuid4().hex[:14]}"
        job = M7GenerationJob(
            job_id=job_id,
            org_id=org_id,
            sku=req.sku,
            job_type="IMG_INPAINT" if mode == "inpaint" else "IMG_REGEN",
            platform=req.platform,
            workflow_id="wf_img_1plus4_v2",
            workflow_version="2.1.0",
            idempotency_key=idempotency_key,
            status="RUNNING",
            progress=50,
            params_json=req.model_dump(),
            created_by=actor.user_id,
        )
        session.add(job)
        await session.flush()

        gen = await self.adapter.generate_slot_image(
            product,
            slot_idx=slot_idx,
            style=req.style,
            aspect=req.aspect,
            avoid_terms=["watermark"],
            selling_points=product.selling_points,
            custom_instruction=req.instruction or ("Local Inpaint Refined" if mode == "inpaint" else "Regenerated Slot"),
            ai_person_flag=req.ai_person_flag,
        )
        storage = FileStorage()
        new_asset_id = f"ast_{uuid.uuid4().hex[:14]}"
        storage_key = f"orgs/{org_id}/{req.sku}/{req.platform}/{slot_name}_{new_asset_id}.png"
        mime, size, sha = storage.save_bytes(
            storage_key, gen.image_bytes, allowed_mimes={"image/png", "image/jpeg", "image/webp"}
        )
        ok_iptc, iptc_tags = self.iptc.verify_disk_file(
            storage, storage_key, ai_person_flag=req.ai_person_flag
        )

        new_ver = (prev_asset.version + 1) if prev_asset else 1
        if prev_asset:
            prev_asset.is_selected = False

        new_asset = M7GenerationAsset(
            asset_id=new_asset_id,
            org_id=org_id,
            sku=req.sku,
            job_id=job_id,
            asset_slot=slot_name,
            platform=req.platform,
            lang="en-US",
            variant_idx=0,
            version=new_ver,
            is_selected=True,
            edit_status="MANUALLY_EDITED" if mode == "inpaint" else "AI_GENERATED",
            content_json={
                "slot_idx": slot_idx,
                "mode": mode,
                "instruction": req.instruction,
                "prompt_used": gen.prompt_used,
            },
            orig_content_json=(prev_asset.orig_content_json if prev_asset else {"slot_idx": slot_idx}),
            scan_result_json={},
            last_edited_by=actor.user_id,
        )
        new_media = M7GenerationMedia(
            media_id=f"med_{uuid.uuid4().hex[:14]}",
            org_id=org_id,
            asset_id=new_asset_id,
            media_kind="IMAGE",
            mime_type=mime,
            file_size=size,
            sha256=sha,
            storage_key=storage_key,
            width=gen.width,
            height=gen.height,
            ai_person_flag=req.ai_person_flag,
            iptc_verified=ok_iptc,
            iptc_tags_json=iptc_tags,
        )
        session.add(new_asset)
        session.add(new_media)
        job.status = "SUCCEEDED"
        job.progress = 100

        inv = await repo.invalidate_active_approvals(
            org_id, req.sku, req.platform, "IMG_INPAINT" if mode == "inpaint" else "IMG_REGEN"
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="IMG_SLOT_INPAINT" if mode == "inpaint" else "IMG_SLOT_REGENERATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 对 {req.sku} 图位 {slot_name} 执行了{'局部修改' if mode=='inpaint' else '单图重绘'}（v{new_ver}，其余 4 张套图保持不变）",
            payload={"slot": slot_name, "version": new_ver, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        resp = _slot_response(org_id, new_asset, new_media)
        if prev_media:
            resp["before_media_url"] = f"/api/v1/orgs/{org_id}/m7/media/{prev_media.media_id}"
        return resp

    async def regenerate_slot(self, session: AsyncSession, **kwargs) -> dict:
        return await self._replace_single_slot(session, mode="regenerate", **kwargs)

    async def inpaint_slot(self, session: AsyncSession, **kwargs) -> dict:
        return await self._replace_single_slot(session, mode="inpaint", **kwargs)

    async def verify_or_repair_iptc(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: IptcVerifyReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        repo = M7Repository(session)
        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        target_slots = (
            [f"img_{req.slot_idx}"] if req.slot_idx is not None else list(IMAGE_SLOTS)
        )
        img_assets = [a for a in selected if a.asset_slot in target_slots]
        if not img_assets:
            raise M7Error("M7-4041", f"未找到 {req.sku} 已选套图资产", http_status=404)

        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in img_assets])
        storage = FileStorage()
        results: list[dict] = []

        for a in sorted(img_assets, key=lambda x: x.asset_slot):
            m = media_map.get(a.asset_id)
            if not m:
                continue
            if req.mode == "simulate_strip":
                size, sha = self.iptc.strip_tags_for_simulation(storage, m.storage_key)
                m.file_size = size
                m.sha256 = sha
                ok, tags = self.iptc.verify_disk_file(
                    storage, m.storage_key, ai_person_flag=m.ai_person_flag
                )
                m.iptc_verified = ok
                m.iptc_tags_json = tags
            elif req.mode == "rewrite":
                mime, size, sha, tags = self.iptc.rewrite_disk_file(
                    storage, m.storage_key, ai_person_flag=m.ai_person_flag
                )
                m.mime_type = mime
                m.file_size = size
                m.sha256 = sha
                m.iptc_verified = True
                m.iptc_tags_json = tags
            else:
                ok, tags = self.iptc.verify_disk_file(
                    storage, m.storage_key, ai_person_flag=m.ai_person_flag
                )
                m.iptc_verified = ok
                m.iptc_tags_json = tags

            results.append(
                {
                    "asset_slot": a.asset_slot,
                    "media_id": m.media_id,
                    "ai_person_flag": m.ai_person_flag,
                    "iptc_verified": m.iptc_verified,
                    "iptc_tags_json": m.iptc_tags_json,
                }
            )

        all_ok = all(r["iptc_verified"] for r in results)
        if req.mode == "simulate_strip" or not all_ok:
            await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "IPTC_METADATA_MISSING")

        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action=f"IPTC_{req.mode.upper()}",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=all_ok,
            sentence_zh=f"{actor.display_name} 对 {req.sku} 执行了磁盘 IPTC/XMP {req.mode} 操作，核验结果：{'全部通过' if all_ok else '存在缺失待修复'}",
            payload={"results": results},
            trace_id=trace_id,
        )
        await session.commit()
        return {"all_verified": all_ok, "items": results}
