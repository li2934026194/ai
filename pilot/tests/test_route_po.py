"""PACK 21e：采购单预计到货必须跟路线走。

选空运（14 天）却写“53 天后到货”，是 16b 路线回灌的遗留欠账。
本用例用「合成-正在缺货」SKU-005 各提交一笔海运/空运申请，审批后比对采购单的
expect_arrive：两者必须相差 38 天（52 - 14），且 order_qty 与各自建议量一致。
"""

from __future__ import annotations

import sys
import unittest
from datetime import date, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from db import engine  # noqa: E402

client = TestClient(app)
DATASET = "合成-正在缺货"
SKU = "SKU-005"
_APPLIES: list[str] = []
_POS: list[str] = []


def _dataset_id() -> str:
    for item in client.get("/api/datasets").json()["datasets"]:
        if item["name"] == DATASET:
            return item["id"]
    raise AssertionError("数据集不存在")


class TestRouteLeadTimeInPo(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        with engine.begin() as con:
            for po in _POS:
                con.execute(text("delete from purchase_order where po_id=:p"), {"p": po})
            for apply_id in _APPLIES:
                con.execute(text("delete from replenish_apply where apply_id=:a"), {"a": apply_id})

    def _submit_and_approve(self, did: str, route: str) -> dict:
        created = client.post(
            "/api/p3/apply",
            json={
                "dataset_id": did,
                "sku": SKU,
                "submit_user": "pytest_route",
                "route_code": route,
                "objective_mode": "profit",
            },
        ).json()
        self.assertIn("apply", created, created)
        _APPLIES.append(created["apply"]["apply_id"])
        approved = client.post(
            "/api/p3/apply/approve",
            json={"apply_id": created["apply"]["apply_id"], "approve_user": "pytest_route"},
        ).json()
        self.assertIn("purchase_order", approved, approved)
        _POS.append(approved["purchase_order"]["po_id"])
        return approved

    def test_air_po_arrives_14_days_not_53(self):
        did = _dataset_id()
        sea = self._submit_and_approve(did, "sea")
        air = self._submit_and_approve(did, "air")

        def days_to_arrive(po: dict) -> int:
            arrive = datetime.fromisoformat(po["expect_arrive"]).date()
            created = datetime.fromisoformat(po["created_at"]).date()
            return (arrive - created).days

        sea_days = days_to_arrive(sea["purchase_order"])
        air_days = days_to_arrive(air["purchase_order"])
        self.assertEqual(sea_days, 52, f"海运应为 52 天，实际 {sea_days}")
        self.assertEqual(air_days, 14, f"空运应为 14 天，实际 {air_days}")
        self.assertEqual(sea["purchase_order"]["order_qty"], 660)
        self.assertEqual(air["purchase_order"]["order_qty"], 300)
        print(f"  [路线交期] 海运 {sea_days} 天/660 件，空运 {air_days} 天/300 件")


if __name__ == "__main__":
    unittest.main(verbosity=2)
