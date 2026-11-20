"""PACK 22：公开数据构建器（UCI + 仿真库存）测试。

分两层：
1. 纯逻辑层（不依赖 DB/Milvus/真实 xlsx）：用 tests/fixtures/uci_sample.csv
   （3 SKU × 120 天 UCI 同列名小样本）验证清洗、选样、补日、仿真非负、frames 行数。
   小样本只是测试夹具，绝不冒充真实全量数据。
2. DB 集成层：把小样本转成内存 xlsx → PublicUciLoader → upsert_dataset 写库，
   再经 TestClient 验证 /api/datasets 有 note、/api/p3/sku 的 evidence.dataset_note
   含「仿真」；tearDown 按 dataset_id 清掉五张表，不污染基线库。

运行：.venv/Scripts/python.exe -m pytest tests/test_public_dataset.py -q
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

from api.main import app  # noqa: E402
from db import engine, get_session  # noqa: E402
from loaders.base import upsert_dataset  # noqa: E402
from loaders.public_uci import (  # noqa: E402
    DEFAULT_NAME,
    FX_GBP_CNY,
    INIT_ON_HAND_DAYS,
    LEAD_TOTAL,
    MOQ,
    PACK_SIZE,
    REORDER_POINT_DAYS,
    TARGET_DAYS,
    PublicUciError,
    PublicUciLoader,
    _rolling_mean_28,
    aggregate_daily,
    clean_transactions,
    load_transactions,
    select_skus,
    simulate_inventory,
)

FIXTURE = PILOT_DIR / "tests" / "fixtures" / "uci_sample.csv"
client = TestClient(app)


def _fixture_frame() -> pd.DataFrame:
    return pd.read_csv(FIXTURE)


def _xlsx_from_fixture(tmp_dir: Path) -> Path:
    path = tmp_dir / "uci_sample_test.xlsx"
    _fixture_frame().to_excel(path, sheet_name="Year 2010-2011", index=False)
    return path


class TestPublicUciLogic(unittest.TestCase):
    """纯逻辑：不碰 DB / 真实数据。"""

    def test_01_clean_removes_cancel_zero_and_blank(self) -> None:
        df = _fixture_frame()
        # 注入一行取消单、一行负数量、一行空 StockCode
        extra = pd.DataFrame(
            [
                {"InvoiceNo": "C538001", "StockCode": "84991", "Description": "cancel",
                 "Quantity": 5, "InvoiceDate": "2011-09-01 12:00:00", "UnitPrice": 2.0,
                 "CustomerID": "1", "Country": "UK"},
                {"InvoiceNo": "538999", "StockCode": "84991", "Description": "neg",
                 "Quantity": -3, "InvoiceDate": "2011-09-01 12:00:00", "UnitPrice": 2.0,
                 "CustomerID": "1", "Country": "UK"},
                {"InvoiceNo": "538998", "StockCode": " ", "Description": "blank",
                 "Quantity": 5, "InvoiceDate": "2011-09-01 12:00:00", "UnitPrice": 2.0,
                 "CustomerID": "1", "Country": "UK"},
            ]
        )
        cleaned = clean_transactions(pd.concat([df, extra], ignore_index=True))
        # 原样本 360 行全部有效；注入的 3 行脏数据（取消/负数量/空编码）被整行剔除
        self.assertEqual(len(cleaned), 360)
        self.assertTrue((cleaned["Quantity"] > 0).all())
        self.assertTrue((cleaned["UnitPrice"] > 0).all())
        self.assertTrue((cleaned["StockCode"].astype(str).str.strip() != "").all())
        self.assertIn("date", cleaned.columns)

    def test_02_select_skus_by_total_qty(self) -> None:
        clean = clean_transactions(_fixture_frame())
        skus, start, end = select_skus(clean, limit=3, window_days=120)
        self.assertEqual(len(skus), 3)
        self.assertEqual((end - start).days + 1, 120)

    def test_03_aggregate_daily_fills_gaps(self) -> None:
        clean = clean_transactions(_fixture_frame())
        skus, start, end = select_skus(clean, limit=3, window_days=120)
        daily = aggregate_daily(clean, skus, start=start, end=end)
        for sku in skus:
            self.assertEqual(len(daily[sku]), 120)
            self.assertTrue(all(0 <= r["sales_qty"] for r in daily[sku]))

    def test_04_simulate_inventory_nonnegative(self) -> None:
        clean = clean_transactions(_fixture_frame())
        skus, start, end = select_skus(clean, limit=3, window_days=120)
        daily = aggregate_daily(clean, skus, start=start, end=end)
        sim = simulate_inventory(daily)
        for sku in skus:
            self.assertEqual(len(sim[sku]["rows"]), 120)
            self.assertTrue(all(r["on_hand"] >= 0 for r in sim[sku]["rows"]))
            self.assertTrue(all(r["in_transit"] >= 0 for r in sim[sku]["rows"]))

    def test_05_rolling_mean_no_future_leak(self) -> None:
        # 第 i 天的均值只取 [max(0,i-27), i]，第 0 天等于第 0 天自身
        means = _rolling_mean_28([10.0, 20.0, 30.0])
        self.assertEqual(means[0], 10.0)
        self.assertEqual(means[1], 15.0)
        self.assertEqual(means[-1], 20.0)

    def test_06_frames_row_count_and_no_fabrication(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as td:
            loader = PublicUciLoader(_xlsx_from_fixture(Path(td)), limit=3, window_days=120)
            frames = loader.load()
            self.assertEqual(loader.sku_count, 3)
            self.assertEqual(loader.row_count, 360)
            self.assertEqual(len(frames["products"]), 3)
            self.assertEqual(len(frames["sales_daily"]), 360)
            self.assertEqual(len(frames["inventory_daily"]), 360)
            # 参数常量写进产品主数据，可逐条核对
            p0 = frames["products"][0]
            self.assertEqual(p0["moq"], MOQ)
            self.assertEqual(p0["pack_size"], PACK_SIZE)
            self.assertEqual(p0["lead_prod"] + p0["lead_transit"] + p0["lead_customs"] + p0["lead_inbound"], LEAD_TOTAL)
            self.assertIn("仿真", loader.note)

    def test_07_missing_xlsx_raises(self) -> None:
        with self.assertRaises(PublicUciError):
            load_transactions(PILOT_DIR / "data" / "__definitely_missing__.xlsx")


class TestPublicUciDbIntegration(unittest.TestCase):
    """DB 集成：upsert 后 API 暴露 note/evidence；测完按 dataset_id 清表。"""

    _created: list[str] = []
    _sku: str = ""

    @classmethod
    def setUpClass(cls) -> None:
        import tempfile

        cls._tmp = tempfile.TemporaryDirectory()
        xlsx = _xlsx_from_fixture(Path(cls._tmp.name))
        loader = PublicUciLoader(xlsx, name="测试-公开UCI集成-勿用于生产", limit=3, window_days=120)
        cls._sku = loader.skus[0]
        session = get_session()
        try:
            did = upsert_dataset(session, loader, loader.name, loader.note)
            session.commit()
            cls._created.append(did)
        finally:
            session.close()

    @classmethod
    def tearDownClass(cls) -> None:
        with engine.begin() as con:
            for did in cls._created:
                for table in (
                    "products", "sales_daily", "inventory_daily", "inbound_batches",
                    "demand_daily",
                ):
                    con.execute(text(f"delete from {table} where dataset_id=:d"), {"d": did})
                con.execute(text("delete from datasets where dataset_id=:d"), {"d": did})
        cls._created.clear()
        cls._tmp.cleanup()

    def test_10_list_datasets_has_note(self) -> None:
        body = client.get("/api/datasets").json()
        row = next((d for d in body["datasets"] if d["id"] == self._created[0]), None)
        self.assertIsNotNone(row)
        self.assertIn("仿真", row["note"])
        self.assertIn("UCI", row["note"])

    def test_11_sku_detail_evidence_has_dataset_note(self) -> None:
        body = client.get(
            "/api/p3/sku/{sku}".format(sku=self._sku),
            params={"dataset_id": self._created[0]},
        ).json()
        self.assertIn("仿真", body["meta"]["dataset_note"])
        self.assertIn("仿真", body["evidence"]["dataset_note"])


if __name__ == "__main__":
    unittest.main()
