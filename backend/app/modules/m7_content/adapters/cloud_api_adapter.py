import asyncio
import json
from typing import Any
import httpx

from app.contracts.product_catalog_contract import ProductFactSnapshot
from app.contracts.voice_faq_contract import VoiceFaqSnapshot
from app.core.config import get_settings, redact_secrets
from app.modules.m7_content.adapters.base import (
    CopyVariant,
    GeneratedImageSlot,
    GeneratorAdapter,
)
from app.modules.m7_content.adapters.comfyui_adapter import ComfyUIGeneratorAdapter
from app.modules.m7_content.adapters.local_media_adapter import LocalMediaAdapter


class CloudApiAdapter(GeneratorAdapter):
    """阿里云百炼（通义千问 Qwen + 万相 Wanxiang）与 ComfyUI 适配器，支持无密钥本地双模式兜底"""

    def __init__(self, local_fallback: LocalMediaAdapter | None = None) -> None:
        self.local = local_fallback or LocalMediaAdapter()
        self.comfyui = ComfyUIGeneratorAdapter()

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
        settings = get_settings()
        if settings.CLOUD_LLM_PROVIDER == "dashscope" and settings.dashscope_configured:
            try:
                return await self._call_dashscope_copy(
                    product,
                    faq,
                    slot=slot,
                    platform=platform,
                    lang=lang,
                    must_terms=must_terms,
                )
            except Exception as exc:
                # 记录脱敏提示并安全回退本地确定性模板，绝不泄露密钥
                _ = redact_secrets(str(exc))

        return self.local.build_deterministic_copy_variants(
            product,
            faq,
            slot=slot,
            platform=platform,
            lang=lang,
            must_terms=must_terms,
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
        settings = get_settings()
        if settings.CLOUD_LLM_PROVIDER == "dashscope" and settings.dashscope_configured:
            try:
                raw_bytes, prompt = await self._call_dashscope_image(
                    product,
                    slot_idx=slot_idx,
                    style=style,
                    aspect=aspect,
                    avoid_terms=avoid_terms,
                    selling_points=selling_points,
                    custom_instruction=custom_instruction,
                )
                return self.local.finalize_image_bytes(
                    raw_bytes,
                    slot_idx=slot_idx,
                    prompt_used=prompt,
                    ai_person_flag=ai_person_flag,
                    engine_mode="dashscope_wanxiang",
                )
            except Exception as exc:
                _ = redact_secrets(str(exc))

        if self.comfyui.is_configured():
            prompt = f"{product.title_seed}, {style}, {', '.join(selling_points[:3])}, {custom_instruction}".strip(", ")
            raw_bytes = await self.comfyui.generate_image_bytes(prompt)
            if raw_bytes:
                return self.local.finalize_image_bytes(
                    raw_bytes,
                    slot_idx=slot_idx,
                    prompt_used=prompt,
                    ai_person_flag=ai_person_flag,
                    engine_mode="comfyui",
                )

        return await self.local.generate_slot_image(
            product,
            slot_idx=slot_idx,
            style=style,
            aspect=aspect,
            avoid_terms=avoid_terms,
            selling_points=selling_points,
            custom_instruction=custom_instruction,
            ai_person_flag=ai_person_flag,
        )

    async def _call_dashscope_copy(
        self,
        product: ProductFactSnapshot,
        faq: VoiceFaqSnapshot,
        *,
        slot: str,
        platform: str,
        lang: str,
        must_terms: list[str],
    ) -> list[CopyVariant]:
        settings = get_settings()
        prompt = (
            f"You are an e-commerce copywriter for {platform}. Output ONLY valid JSON array of 3 variants "
            f'[{{"style_label": "...", "text": "..."}}] for slot={slot}, lang={lang}.\n'
            f"Product facts (do NOT invent accessories): SKU={product.sku}, Name={product.name}, "
            f"Brand={product.brand_name}, Specs={json.dumps(product.specs, ensure_ascii=False)}, "
            f"SellingPoints={json.dumps(product.selling_points, ensure_ascii=False)}, "
            f"FAQ={json.dumps(faq.pain_points, ensure_ascii=False)}.\n"
            f"Must include terms when natural: {must_terms}. "
            "Never use ALL CAPS hype words, FDA Approved, Waterproof, Velcro, Dyson, or 100% Best."
        )
        url = f"{settings.DASHSCOPE_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": settings.DASHSCOPE_TEXT_MODEL,
            "messages": [
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            body = resp.json()
        raw_content = body["choices"][0]["message"]["content"].strip()
        if raw_content.startswith("```"):
            raw_content = raw_content.strip("`").lstrip("json").strip()
        items = json.loads(raw_content)
        variants: list[CopyVariant] = []
        for idx, item in enumerate(items[:3]):
            text_val = str(item.get("text", "")).strip()
            if text_val:
                variants.append(
                    CopyVariant(
                        variant_idx=idx,
                        style_label=str(item.get("style_label") or f"百炼方案 {idx + 1}"),
                        content={"text": text_val, "source": "dashscope"},
                    )
                )
        if len(variants) == 3:
            return variants
        raise ValueError("DashScope returned fewer than 3 valid copy variants")

    async def _call_dashscope_image(
        self,
        product: ProductFactSnapshot,
        *,
        slot_idx: int,
        style: str,
        aspect: str,
        avoid_terms: list[str],
        selling_points: list[str],
        custom_instruction: str,
    ) -> tuple[bytes, str]:
        settings = get_settings()
        role_desc = (
            "pure white #FFFFFF studio e-commerce main product photo, centered single unit, no text"
            if slot_idx == 0
            else f"e-commerce lifestyle detail image #{slot_idx}, style={style}, clean product focus"
        )
        prompt = (
            f"{product.name} ({product.brand_name}), {role_desc}, "
            f"accurate specs only: {', '.join(selling_points[:2])}. "
            f"{custom_instruction}".strip()
        )
        negative = ", ".join(["blurry", "watermark", "extra accessories", *avoid_terms])
        size_map = {"1:1": "1024*1024", "4:5": "896*1152", "3:4": "896*1152", "16:9": "1280*720"}
        wanx_size = size_map.get(aspect, "1024*1024")
        submit_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
        headers = {
            "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
        }
        payload = {
            "model": settings.DASHSCOPE_IMAGE_MODEL,
            "input": {"prompt": prompt, "negative_prompt": negative},
            "parameters": {"size": wanx_size, "n": 1},
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            sub = await client.post(submit_url, headers=headers, json=payload)
            sub.raise_for_status()
            task_id = sub.json()["output"]["task_id"]
            task_url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
            for _ in range(18):
                await asyncio.sleep(1.5)
                poll = await client.get(
                    task_url, headers={"Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}"}
                )
                poll.raise_for_status()
                out = poll.json().get("output", {})
                if out.get("task_status") == "SUCCEEDED":
                    img_url = out["results"][0]["url"]
                    img_resp = await client.get(img_url)
                    img_resp.raise_for_status()
                    return img_resp.content, prompt
                if out.get("task_status") in ("FAILED", "CANCELED"):
                    raise RuntimeError("Wanxiang image generation failed")
        raise TimeoutError("Wanxiang image generation timed out")
