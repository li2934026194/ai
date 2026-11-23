"""PACK 最终收口 / T3：POST /api/agents/support 客服草稿端点测试。

覆盖：
1. 端点存在且调用 A1_support（用假 registry 记录 name/tool_label）
2. 未配置 Key / A1 降级（status=fallback）→ degraded=True，返回 E-2001 文案
3. 成功路径（status=success）→ degraded=False，返回真实原文
4. 空 message → E-2001
5. 真实路径：本机有 Key 时结构字段齐全（不伪造模型成功，接受 success 或 degraded）

全程真实 PostgreSQL（端点不写库，仅校验契约与降级分支）。
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from api import service
from api.main import app


class _FakeRegistry:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def run_agent(self, name, question, tool_label="chat"):
        self.calls.append((name, question, tool_label))
        return self.result


class TestSupportEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_endpoint_calls_a1_success(self):
        """成功路径：degraded=False，原文透传，且确实调用 A1_support/chat。"""
        fake = _FakeRegistry({
            "text": "您好，这是 A1 生成的真实草稿。",
            "status": "success",
            "latency_ms": 123,
            "tokens": 45,
        })
        orig = service._load_support_registry
        service._load_support_registry = lambda: fake
        try:
            r = self.client.post("/api/agents/support", json={"message": "订单没发货"})
        finally:
            service._load_support_registry = orig
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        self.assertFalse(body["degraded"])
        self.assertEqual(body["text"], "您好，这是 A1 生成的真实草稿。")
        self.assertEqual(fake.calls, [("A1_support", "订单没发货", "chat")])

    def test_02_fallback_not_mistaken_as_success(self):
        """降级路径：无 Key/超时 → degraded=True，返回 E-2001，前端据此切模板版。"""
        fake = _FakeRegistry({
            "text": service.E2001_TEXT if hasattr(service, "E2001_TEXT") else "AI 服务暂时不可用，已切换到模板版。",
            "status": "fallback",
            "latency_ms": 3,
            "tokens": None,
        })
        orig = service._load_support_registry
        service._load_support_registry = lambda: fake
        try:
            body = self.client.post("/api/agents/support", json={"message": "你好"}).json()
        finally:
            service._load_support_registry = orig
        self.assertTrue(body["degraded"])
        self.assertEqual(body["status"], "fallback")
        self.assertIn("不可用", body["text"])

    def test_03_empty_message_rejected(self):
        body = self.client.post("/api/agents/support", json={"message": "   "}).json()
        self.assertEqual(body.get("code"), "E-2001")

    def test_04_real_path_shape(self):
        """真实路径：本机有 Key，断言返回结构齐全（不预设一定 success）。"""
        body = self.client.post("/api/agents/support", json={"message": "订单 5 天没发货"}).json()
        for key in ("text", "status", "degraded"):
            self.assertIn(key, body)
        self.assertIn(body["status"], ("success", "fallback"))
        self.assertIsInstance(body["degraded"], bool)
        self.assertTrue(body["text"])


if __name__ == "__main__":
    unittest.main()
