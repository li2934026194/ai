import hashlib
import math
from typing import Any
from app.core.config import get_settings

EMBED_DIM = 64
BATCH_SIZE = 20


def deterministic_embed(text: str, dim: int = EMBED_DIM) -> list[float]:
    """生成固定维度 L2 归一化向量（支持离线无外部 Embedding 服务时与 Milvus 联调）"""
    vec = [0.0] * dim
    norm_txt = (text or "").lower().strip()
    if not norm_txt:
        return vec
    tokens = [norm_txt[i : i + 2] for i in range(max(1, len(norm_txt) - 1))]
    for tok in tokens:
        digest = hashlib.md5(tok.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "little") % dim
        sign = 1.0 if (digest[2] & 1) == 0 else -1.0
        vec[idx] += sign
    mag = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / mag, 6) for v in vec]


class MilvusVectorAdapter:
    """对齐 V1.1：20 件一批写 Milvus + 按 org_id/shop 召回，未起 Milvus 时安全回退主库匹配"""

    def __init__(self) -> None:
        self.settings = get_settings()

    def status(self) -> str:
        if not self.settings.MILVUS_URI:
            return "disabled_pg_fallback"
        try:
            from pymilvus import MilvusClient  # type: ignore

            client = MilvusClient(uri=self.settings.MILVUS_URI, timeout=1.5)
            client.list_collections()
            return "connected"
        except Exception:
            return "unreachable_pg_fallback"

    def _ensure_collection(self, client: Any) -> None:
        name = self.settings.MILVUS_COLLECTION
        if client.has_collection(name):
            return
        client.create_collection(
            collection_name=name,
            dimension=EMBED_DIM,
            metric_type="COSINE",
            auto_id=False,
        )

    def index_products_batch_20(self, org_id: str, items: list[dict[str, Any]]) -> dict[str, Any]:
        """按 SRS FR-CS-08：每 20 件一批校验向量维度与数量后写入 Milvus"""
        if not self.settings.MILVUS_URI:
            return {"backend": "pg_fallback", "indexed": len(items), "batches": (len(items) + 19) // 20, "status": "READY"}
        try:
            from pymilvus import MilvusClient  # type: ignore

            client = MilvusClient(uri=self.settings.MILVUS_URI, timeout=2.0)
            self._ensure_collection(client)
            total = 0
            batches = 0
            for start in range(0, len(items), BATCH_SIZE):
                chunk = items[start : start + BATCH_SIZE]
                rows = []
                for idx, it in enumerate(chunk):
                    emb = deterministic_embed(it.get("text", ""))
                    if len(emb) != EMBED_DIM:
                        raise ValueError("embedding dimension mismatch")
                    rows.append(
                        {
                            "id": abs(hash(f"{org_id}:{it['sku']}")) % (2**62),
                            "vector": emb,
                            "org_id": org_id,
                            "sku": it["sku"],
                            "seq": start + idx,
                        }
                    )
                if len(rows) != len(chunk):
                    raise ValueError("vector batch count mismatch")
                client.upsert(collection_name=self.settings.MILVUS_COLLECTION, data=rows)
                total += len(rows)
                batches += 1
            return {"backend": "milvus", "indexed": total, "batches": batches, "status": "READY"}
        except Exception as exc:
            return {"backend": "pg_fallback", "indexed": 0, "batches": 0, "status": "FAILED", "error": str(exc)}

    def search_skus(self, org_id: str, query: str, limit: int = 3) -> list[str]:
        if not self.settings.MILVUS_URI:
            return []
        try:
            from pymilvus import MilvusClient  # type: ignore

            client = MilvusClient(uri=self.settings.MILVUS_URI, timeout=1.5)
            if not client.has_collection(self.settings.MILVUS_COLLECTION):
                return []
            emb = deterministic_embed(query[:1000])
            res = client.search(
                collection_name=self.settings.MILVUS_COLLECTION,
                data=[emb],
                filter=f'org_id == "{org_id}"',
                limit=limit,
                output_fields=["sku"],
            )
            skus: list[str] = []
            for hit in (res[0] if res else []):
                ent = hit.get("entity") or {}
                if ent.get("sku"):
                    skus.append(ent["sku"])
            return skus
        except Exception:
            return []


milvus_adapter = MilvusVectorAdapter()
