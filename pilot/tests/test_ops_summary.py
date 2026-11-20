"""PACK 21f：观测快照接口。"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402

client = TestClient(app)


class TestOpsSummary(unittest.TestCase):
    def test_snapshot_has_db_eval_gates(self):
        body = client.get("/api/ops/summary").json()
        self.assertIn("db", body)
        self.assertGreaterEqual(body["db"]["datasets"], 1)
        self.assertEqual(body["db"]["purchase_order_columns"], 13)
        self.assertIn("eval", body)
        self.assertTrue(body["eval"]["available"])
        self.assertIn("/", body["eval"]["ask"])
        self.assertIn("gates", body)
        print(f"  [观测] {body['db']} / eval={body['eval']}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
