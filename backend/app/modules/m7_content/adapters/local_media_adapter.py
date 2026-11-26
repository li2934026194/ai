import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

from app.contracts.product_catalog_contract import ProductFactSnapshot
from app.contracts.voice_faq_contract import VoiceFaqSnapshot
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m7_content.adapters.base import (
    CopyVariant,
    GeneratedImageSlot,
    GeneratedVideoResult,
    GeneratorAdapter,
)
from app.modules.m7_content.domain.iptc_handler import IptcMetadataHandler


SLOT_THEMES: dict[int, tuple[str, tuple[int, int, int], tuple[int, int, int]]] = {
    0: ("Pure White Main Photo", (255, 255, 255), (37, 99, 235)),
    1: ("Lifestyle Usage Scene", (239, 246, 255), (29, 78, 216)),
    2: ("Core Feature Callout", (240, 253, 244), (5, 150, 105)),
    3: ("Detail & Material Macro", (250, 245, 255), (124, 58, 237)),
    4: ("Dimensions & In-Box Specs", (255, 247, 237), (234, 88, 12)),
}


class LocalMediaAdapter(GeneratorAdapter):
    """本地确定性媒体处理器：Pillow 套图+IPTC 写入 与 FFmpeg 15s 短视频合成"""

    def __init__(self) -> None:
        self.iptc = IptcMetadataHandler()

    def build_deterministic_copy_variants(
        self,
        product: ProductFactSnapshot,
        faq: VoiceFaqSnapshot,
        *,
        slot: str,
        platform: str,
        lang: str,
        must_terms: list[str],
    ) -> list[CopyVariant]:
        brand = product.brand_name
        spec_vals = [f"{k}: {v}" for k, v in list(product.specs.items())[:3]]
        sp_line = " · ".join(product.selling_points[:2]) or product.name
        must_suffix = " ".join([t for t in must_terms if t not in brand][:2]).strip()
        must_tag = f" ({must_suffix})" if must_suffix else ""
        faq_hint = faq.pain_points[0] if faq.pain_points else "Verified spec match"

        if slot == "copy_title":
            t1 = f"{brand} {product.name} - Compact USB-C Home Essential{must_tag}"
            t2 = f"{brand} {product.name} ({list(product.specs.values())[0] if product.specs else product.sku}){must_tag}"
            t3 = f"{brand} {product.name} for Daily Organization & Kitchen Use{must_tag}"
            # 按站点严格截断，保证默认方案合规不超长
            cap = {"amazon_us": 195, "tiktok_us": 145, "shopee_th": 115}.get(platform, 195)
            return [
                CopyVariant(0, "转化型（核心卖点前置）", {"text": t1[:cap], "lang": lang, "source": "local_template"}),
                CopyVariant(1, "参数型（规格精准匹配）", {"text": t2[:cap], "lang": lang, "source": "local_template"}),
                CopyVariant(2, "场景型（痛点直击）", {"text": t3[:cap], "lang": lang, "source": "local_template"}),
            ]

        if slot == "copy_bullets":
            b_common = [
                f"[Core Performance] {brand} {product.name}: {sp_line}.",
                f"[Verified Specs] {'; '.join(spec_vals) or product.sku}.",
                f"[Safe Material] {must_suffix or 'Food-grade BPA-Free'} construction built for everyday durability.",
                f"[Buyer FAQ Match] Designed around real buyer needs: {faq_hint}.",
                f"[In the Box] {product.specs.get('package_contents', '1x Main Unit, 1x User Manual')}.",
            ]
            return [
                CopyVariant(0, "标准五点结构（推荐）", {"text": "\n".join(b_common), "bullets": b_common, "lang": lang}),
                CopyVariant(1, "精炼卖点版", {"text": "\n".join(b_common[:4]), "bullets": b_common[:4], "lang": lang}),
                CopyVariant(2, "FAQ 强化版", {"text": "\n".join(reversed(b_common)), "bullets": list(reversed(b_common)), "lang": lang}),
            ]

        if slot == "copy_kw":
            kw1 = f"{product.sku.lower()} home organizer compact usb-c daily sealer kitchen tool {must_suffix.lower()}".strip()
            kw2 = f"portable sealer kitchen storage pouch bag closer rechargeable {must_suffix.lower()}".strip()
            kw3 = f"lightweight travel pouch bag organizer everyday carry {must_suffix.lower()}".strip()
            return [
                CopyVariant(0, "高相关核心词组（≤250B）", {"text": kw1[:220], "lang": lang}),
                CopyVariant(1, "长尾场景词组（≤250B）", {"text": kw2[:220], "lang": lang}),
                CopyVariant(2, "泛流量补充词组（≤250B）", {"text": kw3[:220], "lang": lang}),
            ]

        if slot == "copy_desc":
            d1 = (
                f"{brand} {product.name} ({product.sku}) delivers consistent performance backed by verified specifications: "
                f"{'; '.join(spec_vals)}. {must_suffix}".strip()
            )
            return [
                CopyVariant(0, "标准详情描述", {"text": d1, "lang": lang}),
                CopyVariant(1, "精简场景描述", {"text": f"{brand} {product.name}: {sp_line}.", "lang": lang}),
                CopyVariant(2, "问答解析描述", {"text": f"{d1} FAQ: {faq_hint}", "lang": lang}),
            ]

        # 扩展 6 类文案槽位
        ext_map = {
            "copy_faq": f"Q: {faq.faq_pairs[0]['q'] if faq.faq_pairs else 'What is included?'}\nA: {faq.faq_pairs[0]['a'] if faq.faq_pairs else 'See verified specs.'}",
            "copy_aplus_txt": f"{brand} {product.name} A+ Story: {sp_line}. Verified specs: {'; '.join(spec_vals)}.",
            "copy_variant": f"Variant Option: Classic Matte / Standard Single Pack ({product.sku})",
            "copy_attr": "; ".join(spec_vals) or f"SKU: {product.sku}",
            "copy_alt": f"{brand} {product.name} front studio view on clean background",
            "copy_warranty": f"{brand} 12-Month Standard Quality Support & Replacement Guide",
        }
        base_txt = ext_map.get(slot, f"{brand} {product.name} ({slot})")
        return [
            CopyVariant(0, "标准方案", {"text": base_txt, "lang": lang}),
            CopyVariant(1, "精简方案", {"text": base_txt[:180], "lang": lang}),
            CopyVariant(2, "扩展说明", {"text": f"{base_txt} | {product.sku}", "lang": lang}),
        ]

    async def generate_copy_variants(
        self,
        product: ProductFactSnapshot,
        faq: VoiceFaqSnapshot,
        *,
        slot: str,
        platform: str,
        lang: str,
        must_terms: list[str],
    ) -> list[CopyVariant]:
        return self.build_deterministic_copy_variants(
            product, faq, slot=slot, platform=platform, lang=lang, must_terms=must_terms
        )

    def finalize_image_bytes(
        self,
        raw_bytes: bytes,
        *,
        slot_idx: int,
        prompt_used: str,
        ai_person_flag: bool,
        engine_mode: str,
    ) -> GeneratedImageSlot:
        tagged = self.iptc.embed_tags(raw_bytes, ai_person_flag=ai_person_flag)
        with Image.open(io.BytesIO(tagged)) as im:
            w, h = im.size
        return GeneratedImageSlot(
            slot_idx=slot_idx,
            slot_name=f"img_{slot_idx}",
            image_bytes=tagged,
            width=w,
            height=h,
            prompt_used=prompt_used,
            ai_person_flag=ai_person_flag,
            engine_mode=engine_mode,
        )

    async def generate_slot_image(
        self,
        product: ProductFactSnapshot,
        *,
        slot_idx: int,
        style: str,
        aspect: str,
        avoid_terms: list[str],
        selling_points: list[str],
        custom_instruction: str = "",
        ai_person_flag: bool = False,
    ) -> GeneratedImageSlot:
        dims = {"1:1": (1000, 1000), "4:5": (960, 1200), "3:4": (900, 1200), "16:9": (1280, 720)}
        w, h = dims.get(aspect, (1000, 1000))
        theme_label, bg, accent = SLOT_THEMES.get(slot_idx, SLOT_THEMES[1])
        if slot_idx == 0:
            bg = (255, 255, 255)  # 白底主图强制纯白 #FFFFFF

        img = Image.new("RGB", (w, h), bg)
        draw = ImageDraw.Draw(img)

        # 绘制定制化工业风几何产品展示卡片
        pad_x, pad_y = int(w * 0.16), int(h * 0.16)
        if slot_idx != 0:
            draw.rounded_rectangle(
                [36, 36, w - 36, h - 36], radius=28, outline=accent, width=4
            )
        # 产品主体轮廓
        draw.rounded_rectangle(
            [pad_x, pad_y, w - pad_x, h - pad_y - 40],
            radius=36,
            fill=(248, 250, 252) if slot_idx == 0 else (255, 255, 255),
            outline=accent,
            width=6,
        )
        cx, cy = w // 2, h // 2 - 20
        draw.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=accent)
        draw.ellipse([cx - 62, cy - 62, cx + 62, cy + 62], fill=(255, 255, 255))

        if slot_idx > 0:
            # 非主图展示 ASCII 标签与卖点条（避免容器无中文字体方框）
            draw.rectangle([60, h - 125, w - 60, h - 55], fill=accent)
            draw.text((84, h - 102), f"{product.sku} | Slot {slot_idx}: {theme_label} ({style})", fill=(255, 255, 255))
            if custom_instruction:
                draw.text((84, 64), f"Note: {custom_instruction[:48]}", fill=accent)
        else:
            # 主图保持纯白底，不叠加促销文字角标
            pass

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        prompt_used = (
            f"[{theme_label}] SKU={product.sku}, style={style}, aspect={aspect}, "
            f"avoid={','.join(avoid_terms)}, custom={custom_instruction}"
        )
        return self.finalize_image_bytes(
            buf.getvalue(),
            slot_idx=slot_idx,
            prompt_used=prompt_used,
            ai_person_flag=ai_person_flag,
            engine_mode="pillow_local",
        )

    def check_video_engine_available(self) -> str:
        """硬规则：未开启 VIDEO_ENGINE_ENABLED 或系统无可用 ffmpeg，必须抛出 503 M7-5031"""
        settings = get_settings()
        if not settings.VIDEO_ENGINE_ENABLED:
            raise M7Error(
                "M7-5031",
                "视频生成节点未启用（VIDEO_ENGINE_ENABLED=false），已阻断合成并完整保留前序图文资产",
                http_status=503,
            )
        ffmpeg_path = shutil.which(settings.FFMPEG_BIN) or (
            settings.FFMPEG_BIN if os.path.isfile(settings.FFMPEG_BIN) else None
        )
        if not ffmpeg_path:
            raise M7Error(
                "M7-5031",
                "未检测到可用 FFmpeg 视频合成引擎，已阻断合成并完整保留前序图文资产",
                http_status=503,
            )
        return ffmpeg_path

    async def synthesize_15s_video(
        self,
        *,
        sku: str,
        segments: list[dict],
        slot_image_bytes: dict[int, bytes],
    ) -> GeneratedVideoResult:
        ffmpeg_path = self.check_video_engine_available()

        with tempfile.TemporaryDirectory(prefix="m7vid_") as tmpdir:
            tmp = Path(tmpdir)
            clip_paths: list[Path] = []
            for idx, seg in enumerate(segments):
                dur = float(seg.get("duration_sec", 5.0))
                slot_idx = int(seg.get("slot_idx", idx))
                src_bytes = slot_image_bytes.get(slot_idx) or next(iter(slot_image_bytes.values()), None)
                frame_path = tmp / f"seg_{idx}.png"
                if src_bytes:
                    with Image.open(io.BytesIO(src_bytes)) as im:
                        canvas = im.convert("RGB").resize((720, 1280), Image.Resampling.LANCZOS)
                        canvas.save(frame_path, format="PNG")
                else:
                    Image.new("RGB", (720, 1280), (241, 245, 249)).save(frame_path, format="PNG")

                clip_path = tmp / f"clip_{idx}.mp4"
                cmd = [
                    ffmpeg_path,
                    "-y",
                    "-loop",
                    "1",
                    "-i",
                    str(frame_path),
                    "-t",
                    f"{dur:.2f}",
                    "-vf",
                    "scale=720:1280,format=yuv420p",
                    "-c:v",
                    "libx264",
                    "-r",
                    "24",
                    str(clip_path),
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
                if proc.returncode != 0 or not clip_path.exists() or clip_path.stat().st_size == 0:
                    raise M7Error(
                        "M7-5031",
                        f"FFmpeg 渲染分镜 {idx + 1} 失败，已终止并拒绝生成空视频文件",
                        http_status=503,
                    )
                clip_paths.append(clip_path)

            concat_file = tmp / "concat.txt"
            concat_file.write_text(
                "\n".join(f"file '{p.as_posix()}'" for p in clip_paths), encoding="utf-8"
            )
            out_mp4 = tmp / f"{sku}_15s.mp4"
            merge_cmd = [
                ffmpeg_path,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(out_mp4),
            ]
            mproc = subprocess.run(merge_cmd, capture_output=True, text=True, timeout=45)
            if mproc.returncode != 0 or not out_mp4.exists() or out_mp4.stat().st_size == 0:
                raise M7Error(
                    "M7-5031",
                    "FFmpeg 混流输出 MP4 失败，未产出有效成片",
                    http_status=503,
                )
            video_bytes = out_mp4.read_bytes()

        total_dur = sum(float(s.get("duration_sec", 5.0)) for s in segments)
        return GeneratedVideoResult(
            video_bytes=video_bytes,
            width=720,
            height=1280,
            duration_sec=total_dur,
            segments=segments,
        )
