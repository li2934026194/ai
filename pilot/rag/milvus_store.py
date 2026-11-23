"""Milvus 向量检索层（rag/milvus_store.py，PACK 8）。

职责：连接现有 Milvus → 建独立集合 crosspilot_kb → 写入种子 → 语义检索 → 失败降级。

硬约束落实：
  - 只操作 crosspilot_kb 这一个集合，绝不读写删除 knowledge_base。
  - 向量固定 1024 维（bge-m3），metric=COSINE。
  - 索引选 HNSW（理由见下方 INDEX_REASON），不新建 Docker / 不拉镜像。
  - embedding 只调本机 Ollama /api/embeddings（POST bge-m3），不下载新模型。
  - 检索失败（Milvus 不可用 / 超时 / Ollama 失败）一律降级：
    返回 retrieval_ok=False + 空结果，不向调用方抛异常。

索引选择理由（写死在这里，供交付说明引用）：
  INDEX_REASON = 种子只有 20-30 条，HNSW 无需训练质心、小数据集即可用，
  查询延迟低且召回稳定；IVF_FLAT 需要 nlist 训练，小样本下 nlist 难以设定、
  准确率随参数波动大。且 HNSW 支持增量写入无需重建索引，更适合后续扩充 FAQ。
"""

from __future__ import annotations

import json
import urllib.request
from typing import Any, Optional

# ---- 固定配置（PACK 8 硬约束）---------------------------------------------
COLLECTION = "crosspilot_kb"          # 独立集合，绝不碰 knowledge_base
DIM = 1024                            # bge-m3 输出维度
METRIC = "COSINE"
INDEX_TYPE = "HNSW"                   # 见模块顶部 INDEX_REASON
INDEX_PARAMS = {"M": 16, "efConstruction": 200}
SEARCH_PARAMS = {"ef": 64}

DEFAULT_URI = "http://127.0.0.1:19530"
OLLAMA_EMBED_URL = "http://127.0.0.1:11434/api/embeddings"
EMBED_MODEL = "bge-m3"
EMBED_TIMEOUT = 10.0

INDEX_REASON = (
    "种子仅20-30条，HNSW无需训练质心、小数据集即可用，查询延迟低且召回稳定；"
    "IVF_FLAT需要nlist训练，小样本下nlist难设定、效果随参数波动大。"
    "HNSW还支持增量写入无需重建索引，更适合后续扩充FAQ。"
)

# 可注入的 URI（降级验证时传错误端口即可，不改全局默认）
_uri: str = DEFAULT_URI


def configure(uri: Optional[str] = None) -> None:
    """覆盖 Milvus 连接地址（用于降级验证指向错误端口）。传 None 复位默认。"""
    global _uri
    _uri = uri or DEFAULT_URI


def current_uri() -> str:
    return _uri


# ---- embedding：只调本机 Ollama /api/embeddings ----------------------------
def embed(text: str) -> list[float]:
    """调 Ollama bge-m3 生成 1024 维向量。失败抛异常，由 search 捕获降级。"""
    payload = json.dumps({"model": EMBED_MODEL, "prompt": text}).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_EMBED_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=EMBED_TIMEOUT) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    vec = body["embedding"]
    if not isinstance(vec, list) or len(vec) != DIM:
        raise ValueError(f"embedding 维度异常：期望 {DIM}，实际 {len(vec) if isinstance(vec, list) else type(vec)}")
    return [float(x) for x in vec]


# ---- 连接与建集合 ----------------------------------------------------------
def _client(uri: Optional[str] = None):
    from pymilvus import MilvusClient

    return MilvusClient(uri=uri or _uri, timeout=8.0)


def ensure_collection(uri: Optional[str] = None, recreate: bool = False) -> dict:
    """确保 crosspilot_kb 存在，返回 describe_collection 结果。

    recreate=True 时先 drop 再建（仅用于灌库重跑，避免重复行）。
    不接触任何其他集合。
    """
    from pymilvus import DataType

    cli = _client(uri)
    exists = cli.has_collection(COLLECTION)
    if exists and recreate:
        cli.drop_collection(COLLECTION)
        exists = False
    if not exists:
        schema = cli.create_schema(auto_id=False, enable_dynamic_field=False)
        schema.add_field("id", DataType.INT64, is_primary=True, auto_id=False)
        schema.add_field("category", DataType.VARCHAR, max_length=64)
        schema.add_field("question", DataType.VARCHAR, max_length=512)
        schema.add_field("answer", DataType.VARCHAR, max_length=2048)
        schema.add_field("chunk_text", DataType.VARCHAR, max_length=4096)
        schema.add_field("source_type", DataType.VARCHAR, max_length=32)
        schema.add_field("vector", DataType.FLOAT_VECTOR, dim=DIM)
        index_params = cli.prepare_index_params()
        index_params.add_index(
            field_name="vector",
            index_type=INDEX_TYPE,
            metric_type=METRIC,
            params=INDEX_PARAMS,
        )
        cli.create_collection(
            collection_name=COLLECTION,
            schema=schema,
            index_params=index_params,
        )
        cli.load_collection(COLLECTION)
    elif exists:
        # 兼容：集合已存在但未 load（重连场景）
        try:
            cli.load_collection(COLLECTION)
        except Exception:
            pass
    return cli.describe_collection(COLLECTION)


def describe(uri: Optional[str] = None) -> dict:
    """返回 describe_collection 关键字段 + describe_index 索引信息，供交付核验。

    pymilvus 3.0.3 的 describe_collection 只给字段 dim，
    metric_type / index_type 要用 describe_index(collection, 'vector') 单独取。
    """
    cli = _client(uri)
    info = cli.describe_collection(COLLECTION)
    dim = None
    for f in info.get("fields", []):
        if f.get("name") == "vector":
            dim = (f.get("params") or {}).get("dim")
    idx = {}
    try:
        idx = cli.describe_index(COLLECTION, "vector") or {}
    except Exception:
        pass
    return {
        "collection": COLLECTION,
        "dim": dim,
        "metric": idx.get("metric_type"),
        "index_type": idx.get("index_type"),
        "index_params": {k: idx.get(k) for k in ("M", "efConstruction", "state")},
        "fields": [f.get("name") for f in info.get("fields", [])],
        "index_reason": INDEX_REASON,
    }


def write_rows(rows: list[dict], uri: Optional[str] = None) -> int:
    """把 seed_chunks() 的行写入 crosspilot_kb，返回写入条数。

    先按 id 删旧行再插，保证重复灌库不产生重复（幂等）。
    """
    cli = _client(uri)
    data: list[dict] = []
    for r in rows:
        data.append(
            {
                "id": int(r["id"]),
                "category": r["category"],
                "question": r["question"],
                "answer": r["answer"],
                "chunk_text": r["chunk_text"],
                "source_type": "SYNTHETIC",   # 强制标注，不信任入参
                "vector": embed(r["chunk_text"]),
            }
        )
    cli.delete(COLLECTION, filter="id >= 0")
    result = cli.insert(collection_name=COLLECTION, data=data)
    cli.flush(COLLECTION)
    return int(result.get("insert_count", len(data)))


def row_count(uri: Optional[str] = None) -> int:
    cli = _client(uri)
    return int(cli.get_collection_stats(COLLECTION).get("row_count", 0))


# ---- 检索（含降级）---------------------------------------------------------
def search(query: str, top_k: int = 3, uri: Optional[str] = None) -> dict:
    """语义检索 crosspilot_kb。

    成功：{"retrieval_ok": True, "results": [ {chunk_text, question, answer,
           category, source_type, distance}, ... ], "count": N}
    失败：{"retrieval_ok": False, "results": [], "count": 0, "error": "..."}

    任何异常（连接失败 / 超时 / Ollama 失败 / 集合不存在）都在此吞掉并降级，
    绝不向调用方抛异常——这是 PACK 8 硬约束 7。
    """
    try:
        vector = embed(query)
        cli = _client(uri)
        hits = cli.search(
            collection_name=COLLECTION,
            data=[vector],
            limit=int(top_k),
            output_fields=["category", "question", "answer", "chunk_text", "source_type"],
            search_params={"metric_type": METRIC, "params": SEARCH_PARAMS},
            anns_field="vector",
        )
        results: list[dict] = []
        for group in hits:
            for h in group:
                ent = h.get("entity", {}) or {}
                results.append(
                    {
                        "chunk_text": ent.get("chunk_text", ""),
                        "question": ent.get("question", ""),
                        "answer": ent.get("answer", ""),
                        "category": ent.get("category", ""),
                        "source_type": ent.get("source_type", ""),
                        "distance": float(h.get("distance", 0.0)),
                        "id": h.get("id"),
                    }
                )
        return {"retrieval_ok": True, "results": results, "count": len(results)}
    except Exception as exc:  # noqa: BLE001 - 降级是硬约束，必须吞掉一切
        return {
            "retrieval_ok": False,
            "results": [],
            "count": 0,
            "error": f"{type(exc).__name__}: {exc}",
        }


__all__ = [
    "COLLECTION", "DIM", "METRIC", "INDEX_TYPE", "INDEX_REASON",
    "configure", "current_uri", "embed", "ensure_collection", "describe",
    "write_rows", "row_count", "search",
]
