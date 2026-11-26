import asyncio
import json
import uuid
import httpx

from app.core.config import get_settings
from app.core.storage import detect_magic_mime


class ComfyUIGeneratorAdapter:
    """对齐 V1.1 图3：可配置 ComfyUI 生图适配器（queue -> history -> /view 真字节核验）"""

    def is_configured(self) -> bool:
        return bool((get_settings().COMFYUI_BASE_URL or "").strip())

    async def generate_image_bytes(self, prompt_text: str, width: int = 1024, height: int = 1024) -> bytes | None:
        base = (get_settings().COMFYUI_BASE_URL or "").strip().rstrip("/")
        if not base:
            return None
        workflow = {
            "3": {
                "class_type": "KSampler",
                "inputs": {"seed": 42, "steps": 20, "cfg": 7.0, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0},
            },
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt_text}},
            "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                q_resp = await client.post(
                    f"{base}/prompt",
                    json={"prompt": workflow, "client_id": f"cp_{uuid.uuid4().hex[:8]}"},
                )
                if q_resp.status_code != 200:
                    return None
                prompt_id = q_resp.json().get("prompt_id")
                if not prompt_id:
                    return None
                for _ in range(15):
                    h_resp = await client.get(f"{base}/history/{prompt_id}")
                    if h_resp.status_code == 200:
                        hist = h_resp.json().get(prompt_id) or {}
                        outputs = hist.get("outputs") or {}
                        for node in outputs.values():
                            imgs = node.get("images") or []
                            if imgs:
                                img_info = imgs[0]
                                view_resp = await client.get(
                                    f"{base}/view",
                                    params={
                                        "filename": img_info.get("filename", ""),
                                        "subfolder": img_info.get("subfolder", ""),
                                        "type": img_info.get("type", "output"),
                                    },
                                )
                                if view_resp.status_code == 200 and detect_magic_mime(view_resp.content) in {
                                    "image/png",
                                    "image/jpeg",
                                    "image/webp",
                                }:
                                    return view_resp.content
                    await asyncio.sleep(0.5)
        except Exception:
            return None
        return None
