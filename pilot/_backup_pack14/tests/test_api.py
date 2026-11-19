"""api 层验收（tests/test_api.py，PACK 4）。

用 FastAPI TestClient 直接调 app（不起 uvicorn），断言：
1. health / datasets 正常（现在 6 个数据集，含 S6）；
2. p1/p2/p3 三个 meta 字段齐全；
3. S1 的 SKU-001 按 as_of 口径建议量 = 0（期末在手 678 > target，不缺货）；
   S1 的 SKU-017 建议量 > 0 且金额 > 0；
4. S4 的 SKU-017 返回 E-1001 结构化错误（不是 500、不是空数组）；
5. S6 的 5 个 SKU 此刻正在缺货（on_hand=0，建议量 > 0）；
6. 未知 SKU 返回 E-1003。

运行（在 pilot/ 目录下）：python -m tests.test_api
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def _dataset_id(client: TestClient, name: str) -> str:
    """按数据集名找 dataset_id（不硬编码 uuid）。"""
    resp = client.get("/api/datasets")
    for item in resp.json()["datasets"]:
        if item["name"] == name:
            return item["id"]
    raise AssertionError(f"数据集 {name} 不存在")


class TestHealthAndDatasets(unittest.TestCase):
    def test_health(self):
        resp = client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "ok")
        self.assertGreaterEqual(body["dataset_count"], 6)
        self.assertIn(".", body["sqlalchemy_version"])

    def test_datasets(self):
        resp = client.get("/api/datasets")
        self.assertEqual(resp.status_code, 200)
        datasets = resp.json()["datasets"]
        self.assertEqual(len(datasets), 6)
        for d in datasets:
            self.assertTrue(d["id"].startswith("ds_"))
            self.assertEqual(d["source_type"], "SYNTHETIC")
            self.assertIn("created_at", d)


class TestDashboard(unittest.TestCase):
    def test_dashboard(self):
        did = _dataset_id(client, "合成-断货14天")
        resp = client.get("/api/p1/dashboard", params={"dataset_id": did})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        # 三个 meta 字段齐全
        self.assertEqual(body["meta"]["source_type"], "SYNTHETIC")
        self.assertIn("as_of", body["meta"])
        self.assertEqual(body["meta"]["method"], "rolling")
        # KPI 是数字
        self.assertGreaterEqual(body["kpi"]["pending_sku_count"], 0)
        self.assertGreaterEqual(body["kpi"]["stockout_risk_count"], 0)
        self.assertGreaterEqual(body["kpi"]["total_capital"], 0)
        self.assertGreaterEqual(body["kpi"]["agent_runs_today"], 0)


class TestSkus(unittest.TestCase):
    def test_skus(self):
        did = _dataset_id(client, "合成-断货14天")
        resp = client.get("/api/p2/skus", params={"dataset_id": did, "rank": 20})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["meta"]["method"], "rolling")
        self.assertGreaterEqual(len(body["skus"]), 1)
        for s in body["skus"]:
            self.assertIn("sku", s)
            self.assertIn("qty", s)
            self.assertIn("stock_risk", s)


class TestSkuDetail(unittest.TestCase):
    def test_s1_hero_sku_as_of_no_replenishment(self):
        """关键断言：S1 的 SKU-001 按 as_of 口径，期末在手 678 > target，建议量应为 0。"""
        did = _dataset_id(client, "合成-断货14天")
        resp = client.get("/api/p3/sku/SKU-001", params={"dataset_id": did})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        qty = body["derivation"]["qty"]
        self.assertEqual(qty, 0, f"SKU-001 按 as_of 口径建议量应为 0，实际 {qty}")
        # 在手 > target，不缺货
        self.assertGreater(body["derivation"]["on_hand"], body["derivation"]["target"])
        self.assertEqual(body["stock_risk"], "LOW")
        # 推导链字段齐全
        for key in ("mu_daily", "sigma_lt", "ss", "rop", "target", "raw", "qty", "on_hand", "in_transit"):
            self.assertIn(key, body["derivation"])
        # service_level 与 source
        self.assertIn(body["service_level_source"], {"cost_reverse", "manual", "default_missing_cost"})

    def test_s1_sku017_has_qty(self):
        """S1 的 SKU-017（非断货、有成本）应算出建议量与金额。"""
        did = _dataset_id(client, "合成-断货14天")
        resp = client.get("/api/p3/sku/SKU-017", params={"dataset_id": did})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertGreater(body["derivation"]["qty"], 0)
        self.assertGreater(body["capital"], 0)
        self.assertEqual(body["service_level_source"], "cost_reverse")

    def test_s4_new_sku_e1001(self):
        """关键断言：S4 的 SKU-017（只有 3 天历史）必须返回 E-1001 结构化错误。"""
        did = _dataset_id(client, "合成-新品零历史")
        resp = client.get("/api/p3/sku/SKU-017", params={"dataset_id": did})
        # 结构化错误按约定返回 HTTP 200（不是 500）
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], "E-1001")
        self.assertIn("至少要", body["message"])
        self.assertLess(body["available"], 60)

    def test_s6_stockout_now(self):
        """S6：5 个 SKU 此刻正在缺货（as_of on_hand=0），建议量 > 0。"""
        did = _dataset_id(client, "合成-正在缺货")
        for sku in ("SKU-002", "SKU-003", "SKU-004", "SKU-005", "SKU-006"):
            resp = client.get(f"/api/p3/sku/{sku}", params={"dataset_id": did})
            self.assertEqual(resp.status_code, 200)
            body = resp.json()
            self.assertEqual(body["derivation"]["on_hand"], 0.0)
            self.assertGreater(body["derivation"]["qty"], 0)
            self.assertEqual(body["stock_risk"], "STOCKOUT")
            self.assertGreater(body["capital"], 0)

    def test_unknown_sku_e1003(self):
        did = _dataset_id(client, "合成-断货14天")
        resp = client.get("/api/p3/sku/SKU-999", params={"dataset_id": did})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["code"], "E-1003")


if __name__ == "__main__":
    unittest.main(verbosity=2)
