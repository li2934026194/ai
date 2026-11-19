"""PACK 25：1688 第一层模拟供应商报价测试（7 项验收）。

覆盖任务书第八节：
1. 生成规则：同一 SKU 生成 3 家，排名按适用价升序；
2. 阶梯价：qty 跨过 MOQ×2 / MOQ×5 时 applicable_unit_price 变化正确；
3. 缺成本：current_unit_cost / saving_* 为 null，报价仍可返回；
4. API 正常：GET /api/p3/supplier-quotes 返回 200，is_mock=true，3 条报价；
5. 未知 SKU：返回 E-1003；
6. seed 幂等：连续跑两次，报价数不翻倍；
7. 业务四表不变：datasets=7 / products=140 / replenish_apply=3 / purchase_order=1。

全程真实 PostgreSQL，不连 1688、不采集、不写 products / 补货 / 采购单。
seed 脚本本身对 supplier_quotes 幂等，可重复执行；本测试不改业务四表。
"""

from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

from api.main import app
from db import SessionLocal
from loaders.supplier_quotes import NO_BASIS_FALLBACK, build_mock_quotes, quote_id_for

PILOT_DIR = Path(__file__).resolve().parent.parent
DATASET = "ds_00b31ed333b05de698c0"

PRODUCT = {
    "dataset_id": DATASET,
    "sku": "SKU-017",
    "title": "合成商品 SKU-017",
    "unit_cost": 10.0,
    "price": 22.0,
    "moq": 300,
    "pack_size": 60,
    "lead_prod": 30,
    "lead_transit": 21,
}


def _counts() -> dict[str, int]:
    out: dict[str, int] = {}
    with SessionLocal() as s:
        for table in ("datasets", "products", "replenish_apply", "purchase_order", "supplier_quotes"):
            out[table] = s.execute(text(f"select count(*) from {table}")).scalar()
    return out


class TestSupplierQuotes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    # 1. 生成规则：3 家 + 排名按适用价升序
    def test_01_three_vendors_ranked_by_applicable_price(self):
        quotes = build_mock_quotes(PRODUCT, 360)
        self.assertEqual(len(quotes), 3)
        codes = {q["supplier_code"] for q in quotes}
        self.assertEqual(codes, {"MOCK-A", "MOCK-B", "MOCK-C"})
        prices = [q["applicable_unit_price"] for q in quotes]
        self.assertEqual(prices, sorted(prices))
        self.assertEqual([q["rank"] for q in quotes], [1, 2, 3])
        for q in quotes:
            self.assertTrue(q["is_mock"])
            self.assertIn("模拟 1688 第一层报价", q["source_note"])

    # 2. 阶梯价：qty 跨 MOQ×2 / MOQ×5 时适用价下降
    def test_02_tier_prices_by_qty(self):
        q1 = build_mock_quotes(PRODUCT, 300)[0]   # tier1（MOCK-A MOQ=300）
        q2 = build_mock_quotes(PRODUCT, 600)[0]   # tier2
        q3 = build_mock_quotes(PRODUCT, 1500)[0]  # tier3
        self.assertEqual(q1["supplier_code"], "MOCK-A")
        self.assertEqual(q1["applicable_unit_price"], 9.2)
        self.assertEqual(q2["applicable_unit_price"], 8.92)
        self.assertEqual(q3["applicable_unit_price"], 8.56)
        self.assertTrue(q3["applicable_unit_price"] < q2["applicable_unit_price"] < q1["applicable_unit_price"])
        self.assertEqual([t["min_qty"] for t in q1["tier_prices"]], [300, 600, 1500])

    # 3. 缺成本：current_unit_cost / saving_* 为 null，报价仍返回
    def test_03_missing_cost_returns_null_savings(self):
        # price*0.45 估算基准的场景
        p = dict(PRODUCT, unit_cost=None, price=22.0)
        q = build_mock_quotes(p, 360)[0]
        self.assertEqual(q["unit_price"], 9.11)  # 22*0.45=9.9 → ×0.92
        self.assertIsNotNone(q["applicable_unit_price"])
        # 两者都缺：确定性占位基准，绝不为 0，且声明非真实成本
        p2 = dict(PRODUCT, unit_cost=None, price=None)
        q2 = build_mock_quotes(p2, 360)[0]
        self.assertEqual(q2["unit_price"], round(NO_BASIS_FALLBACK * 0.92, 2))
        self.assertGreater(q2["unit_price"], 0)
        self.assertIn("非真实成本估算", q2["source_note"])
        # API 层：current_unit_cost / saving_* 为 null
        body = self.client.get(
            f"/api/p3/supplier-quotes?dataset_id={DATASET}&sku=SKU-018"
        ).json()
        self.assertIsNone(body["current_unit_cost"])
        self.assertIsNone(body["best_saving_per_unit"])
        self.assertIsNone(body["best_saving_amount"])
        self.assertEqual(len(body["quotes"]), 3)
        for item in body["quotes"]:
            self.assertIsNone(item["saving_per_unit"])
            self.assertIsNone(item["saving_amount"])

    # 4. API 正常：200 / is_mock / 3 条 / 库读口径
    def test_04_api_returns_three_mock_quotes(self):
        r = self.client.get(
            f"/api/p3/supplier-quotes?dataset_id={DATASET}&sku=SKU-017"
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["is_mock"])
        self.assertEqual(body["quote_source"], "SYNTHETIC_1688_FIRST_LAYER")
        self.assertEqual(len(body["quotes"]), 3)
        self.assertEqual(body["best_supplier_code"], "MOCK-A")
        self.assertEqual(body["best_saving_amount"], 288.0)
        for key in ("meta", "sku", "title", "qty", "current_unit_cost", "currency",
                    "persisted", "note", "quotes"):
            self.assertIn(key, body)
        self.assertTrue(body["persisted"])

    # 5. 未知 SKU：E-1003
    def test_05_unknown_sku_e1003(self):
        body = self.client.get(
            f"/api/p3/supplier-quotes?dataset_id={DATASET}&sku=NO-SUCH-SKU"
        ).json()
        self.assertEqual(body.get("code"), "E-1003")

    # 6. seed 幂等：连续跑两次，报价数不翻倍
    def test_06_seed_idempotent(self):
        before = _counts()["supplier_quotes"]
        for _ in range(2):
            proc = subprocess.run(
                [sys.executable, "scripts/seed_1688_quotes.py"],
                cwd=str(PILOT_DIR), capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=300,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
        after = _counts()["supplier_quotes"]
        self.assertEqual(after, before, "seed 重跑后报价数不应变化")
        # quote_id 确定性
        self.assertEqual(
            quote_id_for(DATASET, "SKU-017", "MOCK-A"),
            quote_id_for(DATASET, "SKU-017", "MOCK-A"),
        )

    # 7. 业务四表不变
    def test_07_business_tables_unchanged(self):
        c = _counts()
        self.assertEqual(c["datasets"], 7)
        self.assertEqual(c["products"], 140)
        self.assertEqual(c["replenish_apply"], 3)
        self.assertEqual(c["purchase_order"], 1)
        self.assertEqual(c["supplier_quotes"], 420)


if __name__ == "__main__":
    unittest.main()
