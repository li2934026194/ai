import httpx
from app.core.config import get_settings


async def query_vanna_if_configured(org_id: str, question: str) -> dict | None:
    """对齐 V1.1 图3：若配置了独立 Vanna 2 HTTP 服务则转发只读问数，不可达时回退主库引擎"""
    settings = get_settings()
    base = (settings.VANNA_BASE_URL or "").strip().rstrip("/")
    if not base:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(
                f"{base}/api/v1/ask",
                json={"org_id": org_id, "question": question, "read_only": True},
            )
            if resp.status_code == 200:
                payload = resp.json()
                return {
                    "engine": "vanna_http",
                    "sql": payload.get("sql", ""),
                    "answer": payload.get("answer", ""),
                }
    except Exception:
        return None
    return None
