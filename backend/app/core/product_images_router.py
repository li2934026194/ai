"""Public product image serving endpoint.

Serves real product photos stored in MinIO (bucket crosspilot-assets,
prefix product-images/). No org auth required because <img src> cannot
carry custom headers. Filename is strict-whitelisted to block path traversal.
"""
import io
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.core.config import get_settings
from app.core.storage import FileStorage

router = APIRouter(prefix="/api/v1/product-images", tags=["Product Images"])

# 只允许：SKU 字母数字、-、_、.，且必须是 .png / .jpg
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp)$")


@router.get("/{filename}")
async def get_product_image(filename: str):
    if not _SAFE_NAME.match(filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="invalid image filename")
    key = f"product-images/{filename}"
    storage = FileStorage()
    try:
        data = storage.read_bytes(key)
    except Exception:
        raise HTTPException(status_code=404, detail="image not found")
    mime = "image/png"
    if filename.lower().endswith((".jpg", ".jpeg")):
        mime = "image/jpeg"
    elif filename.lower().endswith(".webp"):
        mime = "image/webp"
    return Response(content=data, media_type=mime)
