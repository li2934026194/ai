"""PACK 24：商品主数据导入测试（真实 PostgreSQL）。

覆盖任务书 10 项验收：
1. 新 SKU + 完整主数据导入成功
2. 新 SKU 旧格式导入失败且无脏数据
3. 缺失单个必填字段（E-6006）
4. price/unit_cost/moq/pack_size/lead_* 非法值（E-6007）
5. 同一 SKU 主数据冲突（E-6005）
6. 数据集重名（E-6004，不放宽）
7. 中途失败整批回滚（失败后四表无残留）
8. 旧格式已知 SKU 回归（沿用 PACK 20 回放口径）
9. 导入成功后 P2 可查到新 SKU
10. 不使用 SQLite / 不 mock：全程 engine 指向 PG，断言方言为 postgresql

每个用例按 dataset_id 清理五张表，不留脏数据。
"""

from __future__ import annotations

import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from db import engine  # noqa: E402

client = TestClient(app)
BASE_DATASET = "ds_00b31ed333b05de698c0"  # 合成-断货14天，SKU-017 有 90 天
BASE_SKU = "SKU-017"
START = date(2026, 1, 1)
_CLEAN_IDS: list[str] = []

HEADER = (
    "date,sku,sales_qty,on_hand,in_transit,"
    "title,price,unit_cost,moq,pack_size,lead_prod,lead_transit,lead_customs,lead_inbound"
)
OLD_HEADER = "date,sku,sales_qty,on_hand,in_transit"


def _master_csv(sku: str, *, days: int = 90, title: str = "PACK24 测试商品",
                price: str = "9.2", cost: str = "4.14", moq: str = "100",
                pack: str = "50", leads: str = "30,25,7,3") -> str:
    lines = [HEADER]
    for i in range(days):
        day = (START + timedelta(days=i)).isoformat()
        lines.append(
            f"{day},{sku},2,10,0,{title},{price},{cost},{moq},{pack},{leads}"
        )
    return "\n".join(lines) + "\n"


def _old_csv(sku: str, *, days: int = 90) -> str:
    lines = [OLD_HEADER]
    for i in range(days):
        day = (START + timedelta(days=i)).isoformat()
        lines.append(f"{day},{sku},2,10,0")
    return "\n".join(lines) + "\n"


def _post(name: str, csv_text: str, **extra):
    payload = {"name": name, "csv_text": csv_text, "base_dataset_id": BASE_DATASET}
    payload.update(extra)
    resp = client.post("/api/datasets/import", json=payload)
    return resp.status_code, resp.json()


def _import_ok(name: str, csv_text: str, **extra) -> dict:
    code, body = _post(name, csv_text, **extra)
    assert code == 200, (code, body)
    assert "dataset_id" in body, body
    _CLEAN_IDS.append(body["dataset_id"])
    return body


def _rows(table: str, did: str) -> int:
    with engine.connect() as con:
        return con.execute(
            text(f"select count(*) from {table} where dataset_id=:d"), {"d": did}
        ).scalar()


def _table_columns(table: str) -> list[str]:
    with engine.connect() as con:
        return [r[0] for r in con.execute(
            text("select column_name from information_schema.columns "
                 "where table_schema='public' and table_name=:t order by ordinal_position"),
            {"t": table},
        ).all()]


class TestCsvMasterData(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        with engine.begin() as con:
            for did in _CLEAN_IDS:
                for table in ("products", "sales_daily", "inventory_daily",
                              "inbound_batches", "demand_daily"):
                    con.execute(text(f"delete from {table} where dataset_id=:d"), {"d": did})
                con.execute(text("delete from datasets where dataset_id=:d"), {"d": did})
        _CLEAN_IDS.clear()

    def test_00_real_postgres_only(self):
        """10：验收库必须是 PG，且产品表具备全部主数据列。"""
        self.assertEqual(engine.dialect.name, "postgresql")
        cols = _table_columns("products")
        for col in ("title", "price", "unit_cost", "moq", "pack_size",
                    "lead_prod", "lead_transit", "lead_customs", "lead_inbound"):
            self.assertIn(col, cols)
        print("  [环境] dialect=postgresql，products 主数据列齐全")

    def test_01_new_sku_with_master_success(self):
        """1：新 SKU + 完整合法主数据 → 成功，产品落库且字段正确。"""
        sku = "P24-NEW-01"
        out = _import_ok("p24-新SKU完整主数据", _master_csv(sku))
        self.assertEqual(out["sku_count"], 1)
        self.assertIn(sku, out["skus"])
        self.assertEqual(out["source_type"], "TEST_API")
        with engine.connect() as con:
            p = con.execute(
                text("select title, price, unit_cost, moq, pack_size, "
                     "lead_prod, lead_transit, lead_customs, lead_inbound "
                     "from products where dataset_id=:d and sku=:s"),
                {"d": out["dataset_id"], "s": sku},
            ).one()
        self.assertEqual(p[0], "PACK24 测试商品")
        self.assertEqual(float(p[1]), 9.2)
        self.assertEqual(float(p[2]), 4.14)
        self.assertEqual(tuple(int(x) for x in p[3:]), (100, 50, 30, 25, 7, 3))
        print(f"  [成功] {sku} 产品主数据落库：price=9.2 cost=4.14 moq=100 pack=50")

    def test_02_new_sku_old_format_rejected_no_dirty(self):
        """2：新 SKU 用旧格式（无主数据）→ E-6002，且不产生任何脏数据。"""
        _, body = _post("p24-新SKU旧格式", _old_csv("P24-NO-MASTER"))
        self.assertEqual(body.get("code"), "E-6002", body)
        self.assertIn("缺少商品主数据", body.get("message", ""))
        did = body.get("dataset_id")
        if did:  # 万一返回了 id，也必须没有任何事实表行
            for table in ("products", "sales_daily", "inventory_daily"):
                self.assertEqual(_rows(table, did), 0)
        # 库里不应出现同名数据集
        with engine.connect() as con:
            n = con.execute(
                text("select count(*) from datasets where name=:n"),
                {"n": "p24-新SKU旧格式"},
            ).scalar()
        self.assertEqual(n, 0)
        print("  [拒绝] 新 SKU 旧格式 → E-6002，无数据集、无事实表行")

    def test_03_missing_one_required_field(self):
        """3：缺单个必填字段 unit_cost → E-6006，定位到字段与行。"""
        csv = HEADER + "\n" + (
            "2026-01-01,P24-MISS,2,10,0,标题,9.2\n"  # 缺 unit_cost 及其后所有列
        )
        _, body = _post("p24-缺字段", csv)
        self.assertEqual(body.get("code"), "E-6006", body)
        self.assertIn("unit_cost", body.get("message", ""))
        print("  [拒绝] 缺 unit_cost → E-6006，message 定位字段")

    def test_04_illegal_master_values(self):
        """4：非法值 → E-6007，逐字段定位。"""
        cases = [
            ("price", _master_csv("P24-BAD1", price="0")),
            ("unit_cost", _master_csv("P24-BAD2", cost="-1")),
            ("moq", _master_csv("P24-BAD3", moq="1.5")),
            ("pack_size", _master_csv("P24-BAD4", pack="0")),
            ("lead_prod", _master_csv("P24-BAD5", leads="abc,25,7,3")),
            ("title", _master_csv("P24-BAD6", title="   ")),
        ]
        for field, csv in cases:
            _, body = _post(f"p24-非法-{field}", csv)
            self.assertEqual(body.get("code"), "E-6007", (field, body))
            self.assertIn(field, body.get("message", ""), (field, body))
        print("  [拒绝] price/unit_cost/moq/pack_size/lead/title 非法 → E-6007 共 6 项")

    def test_05_master_conflict_same_sku(self):
        """5：同一 SKU 多行主数据不一致 → E-6005，整批拒绝。"""
        lines = _master_csv("P24-CONFLICT").strip().split("\n")
        parts = lines[3].split(",")
        parts[5] = "冲突标题"
        lines[3] = ",".join(parts)
        _, body = _post("p24-主数据冲突", "\n".join(lines) + "\n")
        self.assertEqual(body.get("code"), "E-6005", body)
        self.assertIn("冲突", body.get("message", ""))
        print("  [拒绝] 同 SKU 主数据冲突 → E-6005")

    def test_06_duplicate_name_not_relaxed(self):
        """6：数据集重名仍 E-6004，不放宽。"""
        name = "p24-重名检查"
        _import_ok(name, _master_csv("P24-DUP1"))
        _, body = _post(name, _master_csv("P24-DUP2"))
        self.assertEqual(body.get("code"), "E-6004", body)
        print("  [拒绝] 重名 → E-6004，旧规则未放宽")

    def test_07_batch_rollback_on_failure(self):
        """7：中途失败整批回滚——混合一个合法新 SKU 与一个冲突 SKU，整批不写库。"""
        good = _master_csv("P24-ROLLGOOD").strip().split("\n")[1:]
        bad = _master_csv("P24-ROLLBAD").strip().split("\n")[1:]
        bad[2] = bad[2].replace(",30,25,7,3", ",31,25,7,3")  # 第 3 行 lead 冲突
        csv = "\n".join([HEADER] + good + bad) + "\n"
        _, body = _post("p24-整批回滚", csv)
        self.assertEqual(body.get("code"), "E-6005", body)
        did = body.get("dataset_id")
        if did:
            for table in ("products", "sales_daily", "inventory_daily"):
                self.assertEqual(_rows(table, did), 0)
        with engine.connect() as con:
            n = con.execute(
                text("select count(*) from datasets where name=:n"),
                {"n": "p24-整批回滚"},
            ).scalar()
        self.assertEqual(n, 0)
        print("  [回滚] 合法 SKU + 冲突 SKU 同批 → 整批拒绝，零残留")

    def test_08_old_format_known_sku_regression(self):
        """8：旧格式已知 SKU（SKU-017）继续成功。"""
        with engine.connect() as con:
            rows = con.execute(
                text("select s.date, s.qty, i.on_hand, i.in_transit "
                     "from sales_daily s join inventory_daily i "
                     "on i.dataset_id=s.dataset_id and i.sku=s.sku and i.date=s.date "
                     "where s.dataset_id=:d and s.sku=:k order by s.date"),
                {"d": BASE_DATASET, "k": BASE_SKU},
            ).all()
        lines = [OLD_HEADER]
        for r in rows:
            lines.append(f"{r[0].isoformat()},{BASE_SKU},{float(r[1]):g},{float(r[2]):g},{float(r[3]):g}")
        out = _import_ok("p24-旧格式回归", "\n".join(lines) + "\n")
        self.assertEqual(out["skus"], [BASE_SKU])
        print(f"  [回归] SKU-017 旧格式导入成功：{out['rows']} 行")

    def test_09_new_sku_visible_in_p2(self):
        """9：导入成功后 P2 能查到新 SKU。"""
        sku = "P24-P2-01"
        out = _import_ok("p24-P2可见", _master_csv(sku, days=90))
        body = client.get("/api/p2/skus", params={"dataset_id": out["dataset_id"]}).json()
        found = [r for r in body["skus"] if r["sku"] == sku]
        self.assertEqual(len(found), 1, body)
        self.assertEqual(found[0]["title"], "PACK24 测试商品")
        print(f"  [P2] 新 SKU {sku} 可见：title={found[0]['title']}，日销 {found[0]['daily_avg']}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
