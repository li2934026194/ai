"""PACK 20：CSV 导入器测试。

核心不是“能导入”，而是“导入后的数字与来源一致”：
用主数据集 SKU-017 的原始日数据拼一份 CSV，导入成新数据集，
再对新数据集算一次建议量——必须与原始数据集逐位相同。
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from api import service  # noqa: E402
from db import engine, get_session  # noqa: E402

client = TestClient(app)

BASE_DATASET = "ds_00b31ed333b05de698c0"
SKU = "SKU-017"
_CREATED: list[str] = []


def _source_rows() -> list[tuple[str, float, float, float]]:
    """从库里取原始数据：(date, qty, on_hand, in_transit)。"""
    with engine.connect() as con:
        sales = con.execute(
            text(
                "select s.date, s.qty, i.on_hand, i.in_transit"
                " from sales_daily s join inventory_daily i"
                " on i.dataset_id=s.dataset_id and i.sku=s.sku and i.date=s.date"
                " where s.dataset_id=:d and s.sku=:k order by s.date"
            ),
            {"d": BASE_DATASET, "k": SKU},
        ).all()
    return [(r[0].isoformat(), float(r[1]), float(r[2]), float(r[3])) for r in sales]


def _csv_text(rows: list[tuple[str, float, float, float]], sku: str = SKU) -> str:
    lines = ["date,sku,sales_qty,on_hand,in_transit"]
    for day, qty, on_hand, in_transit in rows:
        lines.append(f"{day},{sku},{qty:g},{on_hand:g},{in_transit:g}")
    return "\n".join(lines)


def _import(name: str, csv_text: str, **extra) -> dict:
    payload = {"name": name, "csv_text": csv_text, "base_dataset_id": BASE_DATASET}
    payload.update(extra)
    body = client.post("/api/datasets/import", json=payload).json()
    if "dataset_id" in body:
        _CREATED.append(body["dataset_id"])
    return body


def _cleanup() -> None:
    with engine.begin() as con:
        for did in _CREATED:
            for table in ("products", "sales_daily", "inventory_daily", "inbound_batches", "demand_daily"):
                con.execute(text(f"delete from {table} where dataset_id=:d"), {"d": did})
            con.execute(text("delete from datasets where dataset_id=:d"), {"d": did})
    _CREATED.clear()


class TestCsvImport(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        _cleanup()

    # ---------------------------------------------------------------- 用例 1
    def test_01_roundtrip_numbers_match(self):
        """导入后的 SKU-017 建议量/占用资金/交期必须与来源数据集一致。"""
        rows = _source_rows()
        self.assertGreaterEqual(len(rows), 60)
        name = "pytest-导入回放"
        out = _import(name, _csv_text(rows))
        self.assertEqual(out.get("sku_count"), 1, out)
        self.assertEqual(out.get("rows"), len(rows), out)
        self.assertTrue(out["dataset_id"].startswith("ds_"))

        with get_session() as s:
            base = service._sku_detail(s, BASE_DATASET, SKU)
            imported = service._sku_detail(s, out["dataset_id"], SKU)
        for key in ("qty", "lead_time"):
            self.assertEqual(
                base["derivation"][key], imported["derivation"][key], f"{key} 不一致"
            )
        self.assertAlmostEqual(float(base["capital"]), float(imported["capital"]), places=6)
        self.assertEqual(base["best_model"], imported["best_model"])
        self.assertEqual(imported["evidence"]["dataset_id"], out["dataset_id"])
        print(
            f"  [回放] 导入 {out['rows']} 行，qty={imported['derivation']['qty']}，"
            f"capital={imported['capital']}，与来源一致"
        )

    # ---------------------------------------------------------------- 用例 2
    def test_02_reject_bad_csv(self):
        """缺列 / 未知 SKU / 历史不足：整批拒绝，且不留下半个数据集。"""
        rows = _source_rows()[:30]
        missing = _import("pytest-缺列", "date,sku,sales_qty\n2026-01-01,SKU-017,1")
        self.assertEqual(missing.get("code"), "E-6001", missing)

        unknown = _import("pytest-未知SKU", _csv_text(rows, sku="SKU-999"))
        self.assertEqual(unknown.get("code"), "E-6002", unknown)

        short = _import("pytest-历史不足", _csv_text(rows))
        self.assertEqual(short.get("code"), "E-6003", short)
        self.assertIn("60", short["message"])

        with get_session() as s:
            names = s.execute(
                text("select name from datasets where name in ('pytest-缺列','pytest-未知SKU','pytest-历史不足')")
            ).scalars().all()
        self.assertEqual(names, [], "失败导入不得留下数据集")

    # ---------------------------------------------------------------- 用例 3
    def test_03_duplicate_name_and_empty(self):
        rows = _source_rows()
        first = _import("pytest-重名", _csv_text(rows))
        self.assertIn("dataset_id", first, first)
        again = _import("pytest-重名", _csv_text(rows))
        self.assertEqual(again.get("code"), "E-6004", again)

        empty = _import("pytest-空", "date,sku,sales_qty,on_hand,in_transit\n")
        self.assertEqual(empty.get("code"), "E-6001", empty)

    # ---------------------------------------------------------------- 用例 4
    def test_04_new_dataset_visible_in_list(self):
        rows = _source_rows()
        out = _import("pytest-列表可见", _csv_text(rows))
        names = [d["name"] for d in client.get("/api/datasets").json()["datasets"]]
        self.assertIn(out["name"], names)


if __name__ == "__main__":
    unittest.main(verbosity=2)
