"""PACK 21d：并发写路径（行锁）验证。

同一条申请被两个人同时点“通过”，必须只有一个成功、只生成一张采购单；
后到的那个应该看到 E-1103（当前状态不允许再审批），而不是两张采购单/两套回执。
"""

from __future__ import annotations

import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from api import service  # noqa: E402
from db import engine  # noqa: E402

client = TestClient(app)
BASE = "ds_00b31ed333b05de698c0"
SKU = "SKU-017"
_APPLY_ID: str | None = None
_PO_IDS: list[str] = []


class TestConcurrentApprove(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        with engine.begin() as con:
            for po_id in _PO_IDS:
                con.execute(text("delete from purchase_order where po_id=:p"), {"p": po_id})
            if _APPLY_ID:
                con.execute(text("delete from replenish_apply where apply_id=:a"), {"a": _APPLY_ID})

    def test_concurrent_approve_yields_one_po(self):
        global _APPLY_ID
        created = client.post(
            "/api/p3/apply",
            json={
                "dataset_id": BASE,
                "sku": SKU,
                "submit_user": "pytest_concurrent",
                "route_code": "sea",
                "objective_mode": "profit",
            },
        ).json()
        self.assertIn("apply", created, created)
        _APPLY_ID = created["apply"]["apply_id"]

        def approve(user: str):
            try:
                receipt = service.approve_apply(_APPLY_ID, approve_user=user)
                return ("ok", receipt["purchase_order"]["po_id"])
            except service.ServiceError as exc:
                return ("err", exc.code)

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(approve, ("并发甲", "并发乙")))

        ok = [r for r in results if r[0] == "ok"]
        err = [r for r in results if r[0] == "err"]
        self.assertEqual(len(ok), 1, f"必须只有一个人成功：{results}")
        self.assertEqual(len(err), 1, f"另一个人必须被状态机挡住：{results}")
        self.assertEqual(err[0][1], "E-1103", results)

        po_id = ok[0][1]
        _PO_IDS.append(po_id)
        with engine.connect() as con:
            count = con.execute(
                text("select count(*) from purchase_order where apply_id=:a"), {"a": _APPLY_ID}
            ).scalar()
            status = con.execute(
                text("select status from replenish_apply where apply_id=:a"), {"a": _APPLY_ID}
            ).scalar()
        self.assertEqual(count, 1, "同一申请只能有一张采购单")
        self.assertEqual(status, "approved")
        print(f"  [并发] 甲/乙同时审批：成功 1、E-1103 1、采购单 {count} 张、申请 {status}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
