"""PACK 21b 抽查：拒答矩阵里最容易“说着说着就给数”的四类，逐类钉住。

完整矩阵见 docs/reject-matrix.md；本文件只钉四类最容易被模型糊过去的场景：
- 数据不足（E-1001）：不许给 qty/金额
- 缺成本（E-1002）：可以给量，但金额必须为 null
- SKU 不存在（E-1003）：不许给任何业务数字
- 无需补货（E-4001）：qty=0，不许写成“建议补 0 件”
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from api import constants  # noqa: E402
from db import get_session  # noqa: E402
from api import service  # noqa: E402

client = TestClient(app)
BASE = "ds_00b31ed333b05de698c0"


class TestRejectMatrix(unittest.TestCase):
    def test_e1001_insufficient_history_gives_no_numbers(self):
        did = None
        for item in client.get("/api/datasets").json()["datasets"]:
            if item["name"] == "合成-新品零历史":
                did = item["id"]
        self.assertTrue(did)
        body = client.get(f"/api/p3/sku/SKU-017?dataset_id={did}").json()
        self.assertEqual(body.get("code"), "E-1001", body)
        for key in ("qty", "capital", "derivation"):
            self.assertNotIn(key, body, f"拒答时不应返回 {key}")

    def test_e1002_missing_cost_amount_is_null_but_qty_exists(self):
        with get_session() as session:
            detail = service._sku_detail(session, BASE, "SKU-018")
        self.assertIsNone(detail["capital"])
        self.assertEqual(detail["derivation"]["qty"], 0)
        self.assertEqual(detail["service_level_source"], "default_missing_cost")

    def test_e1003_unknown_sku_gives_no_business_numbers(self):
        body = client.get(f"/api/p3/sku/SKU-999?dataset_id={BASE}").json()
        self.assertEqual(body.get("code"), "E-1003", body)
        self.assertNotIn("qty", body)
        self.assertNotIn("capital", body)

    def test_e4001_no_replenish_zero_qty_and_canonical_copy(self):
        with get_session() as session:
            detail = service._sku_detail(session, BASE, "SKU-002")
        self.assertEqual(detail["derivation"]["qty"], 0)
        self.assertEqual(constants.NO_REPLENISH_TEXT, "本轮无需补货")

    def test_e5001_synthetic_notice_is_single_source(self):
        self.assertIn("合成场景", constants.SYNTHETIC_NOTICE)
        with get_session() as session:
            detail = service._sku_detail(session, BASE, "SKU-017")
        self.assertEqual(detail["evidence"]["source_type"], "SYNTHETIC")


if __name__ == "__main__":
    unittest.main(verbosity=2)
