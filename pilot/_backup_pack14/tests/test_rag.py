"""PACK 8 测试：Milvus 向量检索接入。

三条核心用例：
  1. 建库：crosspilot_kb 存在，dim=1024 / COSINE / HNSW，row_count=种子数
  2. 命中：语义检索 top1 命中预期 FAQ，retrieval_ok=true
  3. 降级：指向错误端口返回 retrieval_ok=false + 空结果，不抛异常

跑法：pilot/.venv/Scripts/python.exe -m pytest pilot/tests/test_rag.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

from rag import milvus_store as ms  # noqa: E402
from rag.knowledge_seed import seed_chunks  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _ensure_store():
    """模块级：建集合 + 灌库一次；结束复位 URI。"""
    ms.configure()  # 复位默认 URI，防止上轮降级验证残留
    ms.ensure_collection(recreate=True)
    ms.write_rows(seed_chunks())
    yield
    ms.configure()


def test_01_collection_built_correctly():
    """建库：独立集合、1024维、COSINE、HNSW、行数=种子数。"""
    d = ms.describe()
    assert d["collection"] == "crosspilot_kb"
    assert d["dim"] == 1024
    assert d["metric"] == "COSINE"
    assert d["index_type"] == "HNSW"
    assert ms.row_count() == len(seed_chunks())
    assert all(r["source_type"] == "SYNTHETIC" for r in seed_chunks())


def test_02_semantic_search_hit():
    """命中：5 类问题的 top1 都应是对应 FAQ（实测 top-k 命中，不报准确率）。"""
    cases = [
        ("我的包裹显示签收了但我没收到", 4),
        ("退货运费谁承担", 6),
        ("下单后多久发货", 18),
        ("商品标价包含关税吗", 9),
        ("可以用信用卡分期付款吗", 15),
    ]
    for query, expected_id in cases:
        r = ms.search(query, top_k=3)
        assert r["retrieval_ok"] is True, f"{query}: 检索失败 {r.get('error')}"
        assert r["count"] > 0
        top1 = r["results"][0]
        assert int(top1["id"]) == expected_id, (
            f"{query}: 期望 top1 id={expected_id}, 实际 {top1['id']} ({top1['question']})"
        )
        assert top1["source_type"] == "SYNTHETIC"


def test_03_degrade_when_milvus_unavailable():
    """降级：错误端口必须返回 retrieval_ok=false + 空结果，不抛异常。"""
    ms.configure("http://127.0.0.1:19531")  # 错误端口
    try:
        r = ms.search("退货运费谁承担", top_k=3)
        assert r["retrieval_ok"] is False
        assert r["results"] == []
        assert r["count"] == 0
        assert r.get("error")  # 有降级原因
    finally:
        ms.configure()  # 复位


def test_04_tool_search_knowledge_degrades():
    """工具层降级：search_knowledge 在 Milvus 不可用时返回字符串且不抛异常。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("_tools_test", PILOT_DIR / "agents" / "tools.py")
    tools = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tools)

    ms.configure("http://127.0.0.1:19531")
    try:
        # 直调实现体（FunctionTool 包装器不可直接调用，SDK 约定）
        text = tools._search_knowledge_impl("退货运费谁承担")
        assert "retrieval_ok=false" in text
        assert "不要编造" in text
    finally:
        ms.configure()
