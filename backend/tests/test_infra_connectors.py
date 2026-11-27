import pytest
from httpx import AsyncClient

from app.core.cache_queue import redis_cache
from app.core.storage import FileStorage
from app.modules.m1_cs.vector_store import EMBED_DIM, deterministic_embed, milvus_adapter


@pytest.mark.asyncio
async def test_healthz_reports_infra_matrix_and_adapters(test_ctx, tmp_path):
    client: AsyncClient = test_ctx["client"]

    r = await client.get("/healthz")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "healthy"
    assert data["database_dialect"] == "postgresql"
    assert data["storage_writable"] is True
    assert data["storage_backend"] in {"local", "minio"}
    assert "redis_status" in data
    assert "milvus_status" in data

    # Redis adapter TTL cache fallback
    await redis_cache.set_json("cp:test:rules", {"ok": True}, ttl_sec=30)
    cached = await redis_cache.get_json("cp:test:rules")
    assert cached == {"ok": True}
    await redis_cache.delete_prefix("cp:test:")
    assert await redis_cache.get_json("cp:test:rules") is None

    # Milvus 20-batch deterministic embed + batching
    emb = deterministic_embed("Mini Vacuum Sealer USB-C")
    assert len(emb) == EMBED_DIM
    items = [{"sku": f"SKU-{i:03d}", "text": f"Product {i}"} for i in range(45)]
    idx_res = milvus_adapter.index_products_batch_20("org_demo", items)
    assert idx_res["indexed"] == 45
    assert idx_res["batches"] == 3
    assert idx_res["status"] == "READY"

    # FileStorage local verification
    fs = FileStorage(root=tmp_path)
    assert fs.backend_name == "local"
    mime, size, _sha = fs.save_bytes("orgs/org_demo/probe.html", b"<!DOCTYPE html><html></html>")
    assert mime == "text/html"
    assert size > 0
    assert fs.exists("orgs/org_demo/probe.html")
