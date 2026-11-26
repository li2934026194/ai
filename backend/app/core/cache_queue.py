import json
import time
from typing import Any
from app.core.config import get_settings


class RedisCacheAdapter:
    """Redis 缓存与事件广播适配器（未配或连不通时回退进程内 TTL 缓存）"""

    def __init__(self) -> None:
        self._mem: dict[str, tuple[float, str]] = {}

    async def ping(self) -> str:
        settings = get_settings()
        if not settings.REDIS_URL:
            return "disabled_in_memory"
        try:
            import redis.asyncio as aioredis  # type: ignore

            client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1.5)
            try:
                ok = await client.ping()
                return "connected" if ok else "unreachable"
            finally:
                await client.aclose()
        except Exception:
            return "unreachable_fallback_memory"

    async def get_json(self, key: str) -> Any | None:
        settings = get_settings()
        if settings.REDIS_URL:
            try:
                import redis.asyncio as aioredis  # type: ignore

                client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
                try:
                    raw = await client.get(key)
                    if raw:
                        return json.loads(raw)
                finally:
                    await client.aclose()
            except Exception:
                pass
        item = self._mem.get(key)
        if item and item[0] > time.time():
            return json.loads(item[1])
        self._mem.pop(key, None)
        return None

    async def set_json(self, key: str, value: Any, ttl_sec: int = 300) -> None:
        payload = json.dumps(value, ensure_ascii=False)
        self._mem[key] = (time.time() + ttl_sec, payload)
        settings = get_settings()
        if settings.REDIS_URL:
            try:
                import redis.asyncio as aioredis  # type: ignore

                client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
                try:
                    await client.setex(key, ttl_sec, payload)
                finally:
                    await client.aclose()
            except Exception:
                pass

    async def delete_prefix(self, prefix: str) -> None:
        for k in list(self._mem.keys()):
            if k.startswith(prefix):
                self._mem.pop(k, None)
        settings = get_settings()
        if settings.REDIS_URL:
            try:
                import redis.asyncio as aioredis  # type: ignore

                client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
                try:
                    keys = [k async for k in client.scan_iter(match=f"{prefix}*")]
                    if keys:
                        await client.delete(*keys)
                finally:
                    await client.aclose()
            except Exception:
                pass


redis_cache = RedisCacheAdapter()


def build_celery_app():
    """按 V1.1 架构图定义 Redis + Celery Worker/Beat 实例（按需启用）"""
    settings = get_settings()
    if not (settings.CELERY_BROKER_URL or settings.REDIS_URL):
        return None
    try:
        from celery import Celery  # type: ignore

        broker = settings.CELERY_BROKER_URL or settings.REDIS_URL
        backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL
        capp = Celery("crosspilot", broker=broker, backend=backend)
        capp.conf.update(
            task_serializer="json",
            accept_content=["json"],
            result_serializer="json",
            timezone="UTC",
            enable_utc=True,
        )

        @capp.task(name="crosspilot.index_m1_vectors")
        def task_index_m1_vectors(org_id: str, items: list[dict]) -> dict:
            from app.modules.m1_cs.vector_store import milvus_adapter

            return milvus_adapter.index_products_batch_20(org_id, items)

        @capp.task(name="crosspilot.health_ping")
        def task_health_ping() -> str:
            return "pong"

        return capp
    except Exception:
        return None


celery_app = build_celery_app()
