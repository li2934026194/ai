import html
import uuid
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.exceptions import M7Error
from app.core.storage import FileStorage
from app.mocks.seed_data import ensure_seed_data
from app.modules.m7_content.adapters.local_media_adapter import LocalMediaAdapter
from app.modules.m7_content.models import (
    M7GenerationAsset,
    M7GenerationJob,
    M7GenerationMedia,
)
from app.modules.m7_content.repository import M7Repository
from app.modules.m7_content.schemas import (
    AplusGenerateReq,
    VideoGenerateReq,
    VideoSegmentEditReq,
)


def _default_segments(product_name: str, title_text: str, use_m7_copy: bool) -> list[dict]:
    hook = title_text[:60] if (use_m7_copy and title_text) else f"Meet {product_name}"
    return [
        {
            "seg_idx": 0,
            "title": "0-3s 痛点吸睛钩子",
            "slot_idx": 0,
            "duration_sec": 3.0,
            "motion": "zoom_in",
            "sub_en": hook,
            "sub_cn": f"3秒锁鲜/痛点直击：{product_name}",
        },
        {
            "seg_idx": 1,
            "title": "3-11s 核心卖点实拍演示",
            "slot_idx": 2,
            "duration_sec": 8.0,
            "motion": "pan_left",
            "sub_en": "Verified performance & food-grade detail",
            "sub_cn": "核心参数与真实现场演示（严格匹配 M0-2 主档）",
        },
        {
            "seg_idx": 2,
            "title": "11-15s 行动号召收尾",
            "slot_idx": 4,
            "duration_sec": 4.0,
            "motion": "zoom_out",
            "sub_en": "Ready for daily use — shop now",
            "sub_cn": "全套规格一目了然，立即选购",
        },
    ]


class VideoAplusService:
    def __init__(self) -> None:
        self.catalog = ProductCatalogContract()
        self.media_adapter = LocalMediaAdapter()

    async def generate_video(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: VideoGenerateReq,
        actor: ActorContext,
        idempotency_key: str,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = await self.catalog.aget_product(session, org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到 SKU: {req.sku}", http_status=404)

        # 门禁：先校验视频合成引擎是否可用；不可用时记录 FAILED 任务并抛 503 M7-5031，绝不产空 MP4，绝不删前序图文资产
        try:
            self.media_adapter.check_video_engine_available()
        except M7Error as exc:
            fail_job = M7GenerationJob(
                job_id=f"job_{uuid.uuid4().hex[:14]}",
                org_id=org_id,
                sku=req.sku,
                job_type="VIDEO_15S",
                platform=req.platform,
                workflow_id="wf_vid_15s_v1",
                workflow_version="1.2.0",
                idempotency_key=f"{idempotency_key}_{uuid.uuid4().hex[:6]}",
                status="FAILED",
                progress=0,
                params_json=req.model_dump(),
                error_code=exc.code,
                error_detail=exc.message,
                created_by=actor.user_id,
            )
            session.add(fail_job)
            await write_audit_event(
                session,
                org_id=org_id,
                sku=req.sku,
                action="VIDEO_ENGINE_UNAVAILABLE",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name} 触发 {req.sku} 短视频合成失败：{exc.message}（前序图文资产已完整保留）",
                payload={"error_code": exc.code},
                trace_id=trace_id,
            )
            await session.commit()
            raise

        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        by_slot = {a.asset_slot: a for a in selected}
        title_text = str((by_slot.get("copy_title").content_json or {}).get("text", "")) if "copy_title" in by_slot else ""

        segments = (
            [s.model_dump() for s in req.segments]
            if len(req.segments) == 3
            else _default_segments(product.name, title_text, req.use_m7_copy)
        )

        # 读取已选套图字节用于 FFmpeg 分镜合成
        storage = FileStorage()
        img_assets = [a for a in selected if a.asset_slot.startswith("img_")]
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in img_assets])
        slot_bytes: dict[int, bytes] = {}
        for a in img_assets:
            m = media_map.get(a.asset_id)
            if m and storage.exists(m.storage_key):
                slot_bytes[int(a.asset_slot.split("_")[1])] = storage.read_bytes(m.storage_key)

        vid_res = await self.media_adapter.synthesize_15s_video(
            sku=req.sku, segments=segments, slot_image_bytes=slot_bytes
        )

        job_id = f"job_{uuid.uuid4().hex[:14]}"
        job = M7GenerationJob(
            job_id=job_id,
            org_id=org_id,
            sku=req.sku,
            job_type="VIDEO_15S",
            platform=req.platform,
            workflow_id="wf_vid_15s_v1",
            workflow_version="1.2.0",
            idempotency_key=idempotency_key,
            status="SUCCEEDED",
            progress=100,
            params_json=req.model_dump(),
            created_by=actor.user_id,
        )
        session.add(job)
        await session.flush()

        asset_id = f"ast_{uuid.uuid4().hex[:14]}"
        storage_key = f"orgs/{org_id}/{req.sku}/{req.platform}/vid_15s_{asset_id}.mp4"
        mime, size, sha = storage.save_bytes(
            storage_key, vid_res.video_bytes, allowed_mimes={"video/mp4"}
        )

        await session.execute(
            update(M7GenerationAsset)
            .where(
                M7GenerationAsset.org_id == org_id,
                M7GenerationAsset.sku == req.sku,
                M7GenerationAsset.platform == req.platform,
                M7GenerationAsset.asset_slot == "vid_15s",
                M7GenerationAsset.is_selected.is_(True),
                M7GenerationAsset.deleted_at.is_(None),
            )
            .values(is_selected=False)
        )
        content_payload = {"bgm": req.bgm, "use_m7_copy": req.use_m7_copy, "segments": segments}
        asset = M7GenerationAsset(
            asset_id=asset_id,
            org_id=org_id,
            sku=req.sku,
            job_id=job_id,
            asset_slot="vid_15s",
            platform=req.platform,
            lang="en-US",
            variant_idx=0,
            version=1,
            is_selected=True,
            edit_status="AI_GENERATED",
            content_json=content_payload,
            orig_content_json=content_payload,
            scan_result_json={},
            last_edited_by=actor.user_id,
        )
        media = M7GenerationMedia(
            media_id=f"med_{uuid.uuid4().hex[:14]}",
            org_id=org_id,
            asset_id=asset_id,
            media_kind="VIDEO",
            mime_type=mime,
            file_size=size,
            sha256=sha,
            storage_key=storage_key,
            width=vid_res.width,
            height=vid_res.height,
            duration_sec=vid_res.duration_sec,
        )
        session.add(asset)
        session.add(media)
        inv = await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "VIDEO_GENERATED")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="VIDEO_15S_GENERATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 合成了 {req.sku} 的 15 秒 9:16 短视频成片（{size} 字节）",
            payload={"media_id": media.media_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "job_id": job_id,
            "asset_id": asset_id,
            "media_id": media.media_id,
            "version": asset.version,
            "mime_type": mime,
            "file_size": size,
            "duration_sec": float(vid_res.duration_sec),
            "media_url": f"/api/v1/orgs/{org_id}/m7/media/{media.media_id}",
            "segments": segments,
        }

    async def edit_segment(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        seg_idx: int,
        req: VideoSegmentEditReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        if seg_idx < 0 or seg_idx > 2:
            raise M7Error("M7-4001", f"分镜索引越界: {seg_idx}（必须为 0..2）", http_status=400)
        repo = M7Repository(session)
        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        vid_asset = next((a for a in selected if a.asset_slot == "vid_15s"), None)
        if not vid_asset:
            raise M7Error("M7-4041", f"{req.sku} 尚未生成 15s 短视频资产", http_status=404)
        if vid_asset.version != req.version:
            raise M7Error("M7-4091", f"视频分镜版本冲突（当前 v{vid_asset.version}）", http_status=409)

        content = dict(vid_asset.content_json or {})
        segs = [dict(s) for s in (content.get("segments") or [])]
        if seg_idx >= len(segs):
            raise M7Error("M7-4001", f"分镜 {seg_idx} 不存在", http_status=400)

        target = segs[seg_idx]
        if req.slot_idx is not None:
            target["slot_idx"] = req.slot_idx
        if req.motion is not None:
            target["motion"] = req.motion
        if req.sub_en is not None:
            target["sub_en"] = req.sub_en
        if req.sub_cn is not None:
            target["sub_cn"] = req.sub_cn

        content["segments"] = segs
        vid_asset.content_json = content
        vid_asset.edit_status = "MANUALLY_EDITED"
        vid_asset.version += 1
        vid_asset.last_edited_by = actor.user_id
        inv = await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "VIDEO_SEG_EDITED")

        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="VIDEO_SEGMENT_EDITED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 修改了 {req.sku} 短视频第 {seg_idx + 1} 段分镜配置（v{vid_asset.version}）",
            payload={"seg_idx": seg_idx, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"asset_id": vid_asset.asset_id, "version": vid_asset.version, "segments": segs}

    async def regenerate_segment(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        seg_idx: int,
        sku: str,
        platform: str,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        if seg_idx < 0 or seg_idx > 2:
            raise M7Error("M7-4001", f"分镜索引越界: {seg_idx}", http_status=400)
        # 严格校验视频合成能力
        self.media_adapter.check_video_engine_available()
        repo = M7Repository(session)
        selected = await repo.list_selected_assets(org_id, sku, platform)
        vid_asset = next((a for a in selected if a.asset_slot == "vid_15s"), None)
        if not vid_asset:
            raise M7Error("M7-4041", f"{sku} 尚未生成 15s 短视频", http_status=404)

        segs = [dict(s) for s in ((vid_asset.content_json or {}).get("segments") or [])]
        storage = FileStorage()
        img_assets = [a for a in selected if a.asset_slot.startswith("img_")]
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in img_assets])
        slot_bytes = {
            int(a.asset_slot.split("_")[1]): storage.read_bytes(media_map[a.asset_id].storage_key)
            for a in img_assets
            if a.asset_id in media_map and storage.exists(media_map[a.asset_id].storage_key)
        }
        vid_res = await self.media_adapter.synthesize_15s_video(
            sku=sku, segments=segs, slot_image_bytes=slot_bytes
        )
        storage_key = f"orgs/{org_id}/{sku}/{platform}/vid_15s_seg{seg_idx}_{uuid.uuid4().hex[:8]}.mp4"
        mime, size, sha = storage.save_bytes(
            storage_key, vid_res.video_bytes, allowed_mimes={"video/mp4"}
        )
        cur_media_map = await repo.list_media_for_assets(org_id, [vid_asset.asset_id])
        if vid_asset.asset_id in cur_media_map:
            m = cur_media_map[vid_asset.asset_id]
            m.mime_type = mime
            m.file_size = size
            m.sha256 = sha
            m.storage_key = storage_key
        vid_asset.version += 1
        vid_asset.last_edited_by = actor.user_id
        inv = await repo.invalidate_active_approvals(org_id, sku, platform, "VIDEO_SEG_REGEN")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku,
            action="VIDEO_SEGMENT_REGENERATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 局部重做了 {sku} 短视频第 {seg_idx + 1} 段并重新封装 MP4（其余两段保留）",
            payload={"seg_idx": seg_idx, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"asset_id": vid_asset.asset_id, "version": vid_asset.version, "segments": segs}

    async def generate_aplus(
        self,
        session: AsyncSession,
        *,
        org_id: str,
        req: AplusGenerateReq,
        actor: ActorContext,
        idempotency_key: str,
        trace_id: str,
    ) -> dict:
        await ensure_seed_data(session, org_id=org_id)
        repo = M7Repository(session)
        product = await self.catalog.aget_product(session, org_id, req.sku)
        if not product:
            raise M7Error("M7-4041", f"未找到 SKU: {req.sku}", http_status=404)

        selected = await repo.list_selected_assets(org_id, req.sku, req.platform)
        by_slot = {a.asset_slot: a for a in selected}
        title_txt = str((by_slot["copy_title"].content_json or {}).get("text", "")) if "copy_title" in by_slot else product.name
        bullets_txt = str((by_slot["copy_bullets"].content_json or {}).get("text", "")) if "copy_bullets" in by_slot else "\n".join(product.selling_points)
        desc_txt = str((by_slot["copy_desc"].content_json or {}).get("text", "")) if "copy_desc" in by_slot else "Engineered for everyday reliability with verified specs and multi-region compliance."

        # 消费 M7-2 实拍/生成套图（若 M7-2 尚未生成则回退静态白底商业主图）
        img_assets = [by_slot[f"img_{i}"] for i in range(5) if f"img_{i}" in by_slot]
        media_map = await repo.list_media_for_assets(org_id, [a.asset_id for a in img_assets]) if img_assets else {}
        fallback_img = f"/product-images/{product.sku}.png"
        slot_urls: list[str] = []
        for i in range(5):
            slot_key = f"img_{i}"
            if slot_key in by_slot and by_slot[slot_key].asset_id in media_map:
                slot_urls.append(f"/api/v1/orgs/{org_id}/m7/media/{media_map[by_slot[slot_key].asset_id].media_id}")
            else:
                slot_urls.append(fallback_img)

        # XSS 实体转义
        safe_name = html.escape(product.name)
        safe_sku = html.escape(product.sku)
        safe_brand = html.escape(product.brand_name)
        safe_plat = html.escape(req.platform.upper())
        safe_title = html.escape(title_txt)
        safe_desc = html.escape(desc_txt)
        safe_theme = html.escape(req.theme)
        safe_bullets_li = "".join(
            f"<li><span class=\"aplus-dot\">✓</span><span>{html.escape(line.strip())}</span></li>"
            for line in bullets_txt.splitlines()
            if line.strip()
        )
        safe_specs_tr = "".join(
            f"<tr><th>{html.escape(str(k))}</th><td>{html.escape(str(v))}</td></tr>"
            for k, v in product.specs.items()
        )
        gallery_titles = ["Lifestyle Usage", "Core Feature", "Macro Craft", "In-Box Specs"]
        safe_gallery_cards = "".join(
            f'<div class="aplus-gal-card">'
            f'<img src="{html.escape(slot_urls[idx])}" alt="{safe_name} - {gallery_titles[idx - 1]}" />'
            f'<div class="aplus-gal-cap"><strong>0{idx}</strong> {gallery_titles[idx - 1]}</div>'
            f'</div>'
            for idx in range(1, 5)
        )
        safe_hero_img = html.escape(slot_urls[0])
        safe_story_img = html.escape(slot_urls[1])
        aplus_html = (
            f'<section class="m7-aplus-page" data-theme="{safe_theme}">'
            f'<header class="aplus-hero">'
            f'<div class="aplus-hero-copy">'
            f'<div class="aplus-brand-tag">{safe_brand} · {safe_plat} A+ Brand Story</div>'
            f'<h2>{safe_title}</h2>'
            f'<p class="aplus-sub">{safe_name} · SKU: {safe_sku}</p>'
            f'</div>'
            f'<div class="aplus-hero-media"><img src="{safe_hero_img}" alt="{safe_name}" /></div>'
            f'</header>'
            f'<div class="aplus-story">'
            f'<div class="aplus-story-media"><img src="{safe_story_img}" alt="{safe_name} Feature" /></div>'
            f'<div class="aplus-story-body">'
            f'<h3>Why Choose {safe_brand}</h3>'
            f'<p>{safe_desc}</p>'
            f'<ul class="aplus-bullets">{safe_bullets_li}</ul>'
            f'</div>'
            f'</div>'
            f'<div class="aplus-gallery-wrap">'
            f'<div class="aplus-sec-hdr">Product Highlights &amp; Detail Gallery (M7-2 1+4 套图联动)</div>'
            f'<div class="aplus-gallery">{safe_gallery_cards}</div>'
            f'</div>'
            f'<div class="aplus-specs-wrap">'
            f'<div class="aplus-sec-hdr">Verified Technical Specifications (M0-2 实标参数)</div>'
            f'<table class="aplus-specs"><tbody>{safe_specs_tr}</tbody></table>'
            f'</div>'
            f'</section>'
        )

        job_id = f"job_{uuid.uuid4().hex[:14]}"
        job = M7GenerationJob(
            job_id=job_id,
            org_id=org_id,
            sku=req.sku,
            job_type="APLUS",
            platform=req.platform,
            workflow_id="wf_aplus_v1",
            workflow_version="1.0.0",
            idempotency_key=f"{idempotency_key}_{uuid.uuid4().hex[:6]}",
            status="SUCCEEDED",
            progress=100,
            params_json=req.model_dump(),
            created_by=actor.user_id,
        )
        session.add(job)
        await session.flush()

        await session.execute(
            update(M7GenerationAsset)
            .where(
                M7GenerationAsset.org_id == org_id,
                M7GenerationAsset.sku == req.sku,
                M7GenerationAsset.platform == req.platform,
                M7GenerationAsset.asset_slot == "aplus_page",
                M7GenerationAsset.is_selected.is_(True),
                M7GenerationAsset.deleted_at.is_(None),
            )
            .values(is_selected=False)
        )
        asset_id = f"ast_{uuid.uuid4().hex[:14]}"
        content_payload = {
            "theme": req.theme,
            "html": aplus_html,
            "modules": [
                {"title": "品牌主视觉 Banner", "summary": title_txt},
                {"title": "核心卖点解析", "summary": bullets_txt[:220]},
                {"title": "M0-2 实标参数对比表", "specs": product.specs},
            ],
        }
        asset = M7GenerationAsset(
            asset_id=asset_id,
            org_id=org_id,
            sku=req.sku,
            job_id=job_id,
            asset_slot="aplus_page",
            platform=req.platform,
            lang="en-US",
            variant_idx=0,
            version=1,
            is_selected=True,
            edit_status="AI_GENERATED",
            content_json=content_payload,
            orig_content_json=content_payload,
            scan_result_json={},
            last_edited_by=actor.user_id,
        )
        session.add(asset)
        inv = await repo.invalidate_active_approvals(org_id, req.sku, req.platform, "APLUS_GENERATED")
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            action="APLUS_ASSEMBLED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 组装完成了 {req.sku}（{req.platform}）的 A+ 图文详情长页",
            payload={"asset_id": asset_id, "invalidated_approvals": inv},
            trace_id=trace_id,
        )
        await session.commit()
        return {"asset_id": asset_id, "job_id": job_id, **content_payload}
