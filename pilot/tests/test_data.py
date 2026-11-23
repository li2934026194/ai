"""数据层验收测试（stdlib unittest，无需 pytest / pandas / numpy）。

运行：``.venv/Scripts/python.exe tests/test_data.py -v``
既打印 unittest 汇总行，也打印 6 项验收的真实查询结果（不是预期值）。
"""

from __future__ import annotations

import json
import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path

# 让本文件从任意 cwd 直接执行都能 import pilot/ 下的模块。
PILOT_DIR = Path(__file__).resolve().parents[1]
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

from sqlalchemy import text  # noqa: E402

from core import InsufficientHistory, Suggestion  # noqa: E402
from core.demand import calibrate_demand  # noqa: E402
from db import DB_PATH, engine, get_session, suggestion_to_row  # noqa: E402
from loaders.base import upsert_dataset  # noqa: E402
from loaders.synthetic import (  # noqa: E402
    HERO_SKU,
    S1_STOCKOUT_DAYS,
    S1_STOCKOUT_START_INDEX,
    S2_DELAY_DAYS,
    S2_DELAY_NOMINAL_INDEX,
    S2_STOCKOUT_DAYS,
    S2_STOCKOUT_START_INDEX,
    S3_PROMO_DAYS,
    S3_PROMO_START_INDEX,
    S4_HISTORY_DAYS,
    S4_NEW_SKU,
    S5_EFFECTIVE_DAYS,
    S5_GAP_DAYS,
    S5_GAP_END_INDEX,
    S5_GAP_SKU,
    S5_GAP_START_INDEX,
    SCENARIO_NAMES,
    SCENARIO_START_DATE,
    SyntheticLoader,
)
from scenarios import build_all_scenarios  # noqa: E402

EXPECTED_TABLES = {
    "datasets",
    "products",
    "sales_daily",
    "inventory_daily",
    "inbound_batches",
    "demand_daily",
    "forecast_runs",
    "forecast_points",
    "suggestions",
    "agent_runs",
    # PACK 12：补货审批履约闭环新增两张业务表（只加表，旧十张结构一字未改）
    "replenish_apply",
    "purchase_order",
    # PACK 23：RBAC 三张主表 + 两张关联表 + 审计表
    "rbac_user",
    "rbac_role",
    "rbac_permission",
    "rbac_user_role",
    "rbac_role_permission",
    "rbac_audit_log",
    # PACK 25：1688 第一层模拟供应商报价表（第 19 张表）
    "supplier_quotes",
}


def _normalize(value: object) -> object:
    """把驱动返回的 date/datetime 统一成 ISO 字符串，抹平 SQLite(返回 str) 与
    PG(psycopg 返回 datetime.date) 的驱动差异，让下游断言只看字符串。"""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _query(sql: str, params: dict | None = None) -> list[dict]:
    """执行只读 SQL，返回 dict 列表（date/datetime 已归一化为 ISO 字符串）。"""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        return [
            {key: _normalize(value) for key, value in row._mapping.items()}
            for row in result
        ]


def _scalar(sql: str, params: dict | None = None):
    """执行只读 SQL，返回首行首列（date/datetime 已归一化为 ISO 字符串）。"""
    with engine.connect() as conn:
        return _normalize(conn.execute(text(sql), params or {}).scalar())


def _table_names() -> list[str]:
    """查真实表名（跨方言：PG 用 information_schema，SQLite 用 sqlite_master）。"""
    dialect = engine.dialect.name
    if dialect == "postgresql":
        rows = _query(
            "SELECT table_name AS name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
        )
    else:
        rows = _query(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    return [row["name"] for row in rows]


def _sum_qty(dataset_id: str) -> float:
    """某 dataset 全部销量合计（验收幂等用）。"""
    value = _scalar(
        "SELECT COALESCE(SUM(qty), 0) FROM sales_daily WHERE dataset_id=:d",
        {"d": dataset_id},
    )
    return float(value or 0.0)


def _daily_inventory_rows(dataset_id: str, sku: str) -> tuple[list[dict], list[dict]]:
    """从库里取 core.calibrate_demand 要的两组 duck-typed DataFrame（list[dict]）。"""
    daily = _query(
        "SELECT sku, date, qty AS qty_raw, source_type "
        "FROM sales_daily WHERE dataset_id=:d AND sku=:s ORDER BY date",
        {"d": dataset_id, "s": sku},
    )
    inventory = _query(
        "SELECT sku, date, on_hand FROM inventory_daily "
        "WHERE dataset_id=:d AND sku=:s ORDER BY date",
        {"d": dataset_id, "s": sku},
    )
    return daily, inventory


def _stockout_dates(dataset_id: str, sku: str) -> list[str]:
    """查 demand_daily 中被数据层标记为断货的日期。"""
    rows = _query(
        "SELECT date FROM demand_daily "
        "WHERE dataset_id=:d AND sku=:s AND is_stockout = TRUE ORDER BY date",
        {"d": dataset_id, "s": sku},
    )
    return [row["date"] for row in rows]


class TestDataLayer(unittest.TestCase):
    """六项验收 + 补充一致性检查。"""

    dataset_ids: dict[str, str] = {}

    @classmethod
    def setUpClass(cls) -> None:
        cls.dataset_ids = build_all_scenarios()

    def test_01_db_file_and_ten_tables(self) -> None:
        """1：pilot.db 已生成；原十张表 + PACK 12 两张新表都在。"""
        self.assertTrue(DB_PATH.exists(), f"数据库文件不存在: {DB_PATH}")
        tables = _table_names()
        self.assertEqual(len(tables), len(EXPECTED_TABLES),
                         f"表数量不是 {len(EXPECTED_TABLES)}: {tables}")
        self.assertEqual(set(tables), EXPECTED_TABLES)

    def test_02_s1_fourteen_stockout_days(self) -> None:
        """2：S1 那 14 天 is_stockout=1、qty_clean=NULL。"""
        dataset_id = self.dataset_ids["S1"]
        rows = _query(
            "SELECT date, qty_clean FROM demand_daily "
            "WHERE dataset_id=:d AND sku=:s AND is_stockout = TRUE ORDER BY date",
            {"d": dataset_id, "s": HERO_SKU},
        )
        self.assertEqual(len(rows), S1_STOCKOUT_DAYS)
        expected = [
            (SCENARIO_START_DATE + timedelta(days=S1_STOCKOUT_START_INDEX + offset)).isoformat()
            for offset in range(S1_STOCKOUT_DAYS)
        ]
        self.assertEqual([row["date"] for row in rows], expected)
        self.assertTrue(all(row["qty_clean"] is None for row in rows))

    def test_03_s4_s5_calibrate_raises(self) -> None:
        """3：S4/S5 调 calibrate_demand 抛 InsufficientHistory，不返回数字。"""
        cases = (
            ("S4", S4_NEW_SKU, S4_HISTORY_DAYS),
            ("S5", S5_GAP_SKU, S5_EFFECTIVE_DAYS),
        )
        for code, sku, expected_available in cases:
            with self.subTest(scenario=code):
                daily, inventory = _daily_inventory_rows(self.dataset_ids[code], sku)
                self.assertEqual(len(daily), expected_available)
                with self.assertRaises(InsufficientHistory) as caught:
                    calibrate_demand(daily, inventory, sku, min_history=60)
                self.assertEqual(caught.exception.available, expected_available)
                self.assertEqual(caught.exception.required, 60)
                self.assertTrue(str(caught.exception).startswith("E-1001"))

    def test_04_double_import_is_idempotent(self) -> None:
        """4：同一报表导两次销量合计完全相等。"""
        dataset_id = self.dataset_ids["S3"]
        before = _sum_qty(dataset_id)
        loader = SyntheticLoader("S3")
        session = get_session()
        try:
            returned = upsert_dataset(
                session, loader, SCENARIO_NAMES["S3"], loader.note
            )
            session.commit()
        finally:
            session.close()
        self.assertEqual(returned, dataset_id)
        after = _sum_qty(dataset_id)
        self.assertEqual(before, after)

    def test_05_five_datasets(self) -> None:
        """5：S1–S6 六个基线 dataset 全部入库（PACK22 起另有 OPEN_PUBLIC 集）。

        基线 6 个仍要求齐全且为 SYNTHETIC；UCI 公开集作为新增行不破坏基线断言。
        """
        rows = _query(
            "SELECT dataset_id, name, source_type FROM datasets ORDER BY name"
        )
        baseline = [r for r in rows if r["name"] in set(SCENARIO_NAMES.values())]
        self.assertEqual(
            {row["name"] for row in baseline}, set(SCENARIO_NAMES.values())
        )
        self.assertTrue(all(row["source_type"] == "SYNTHETIC" for row in baseline))
        self.assertEqual(len(set(row["dataset_id"] for row in baseline)), 6)

    def test_06_source_type_is_real_column_and_null_cost(self) -> None:
        """6：source_type 是真实列；成本未知存 NULL 不存 0。"""
        # 跨方言：PG 用 information_schema.columns，SQLite 用 PRAGMA table_info。
        if engine.dialect.name == "postgresql":
            col_rows = _query(
                "SELECT column_name, is_nullable FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='sales_daily' "
                "AND column_name='source_type'"
            )
            self.assertEqual(len(col_rows), 1, f"source_type 不是真实列: {col_rows}")
            self.assertEqual(col_rows[0]["is_nullable"], "NO")
        else:
            with engine.connect() as conn:
                pragma = [
                    tuple(row)
                    for row in conn.exec_driver_sql("PRAGMA table_info(sales_daily)")
                ]
            source_rows = [row for row in pragma if row[1] == "source_type"]
            self.assertEqual(len(source_rows), 1, f"source_type 不是真实列: {pragma}")
            self.assertTrue(source_rows[0][2])

        null_cost_skus = _query(
            "SELECT sku FROM products WHERE unit_cost IS NULL ORDER BY sku"
        )
        self.assertGreater(len(null_cost_skus), 0)
        zero_cost_count = _scalar(
            "SELECT COUNT(*) FROM products WHERE unit_cost = 0"
        )
        self.assertEqual(int(zero_cost_count or 0), 0)

    def test_07_suggestion_to_row_explicit_mapping(self) -> None:
        """补充：Suggestion → suggestions 显式映射，不丢字段。"""
        suggestion = Suggestion(
            sku="SKU-001",
            qty=480,
            amount=None,
            service_level=0.95,
            raw_service_level=0.984,
            service_level_source="default_missing_cost",
            z=1.6449,
            sigma_lt=22.57,
            ss=37.12,
            rop=429.3,
            target_s=540.32,
            on_hand=62.0,
            in_transit=0.0,
            stockout_date=date(2026, 3, 1),
            zero_days=7,
            lost_amount=None,
            reason="缺单件成本，算不出金额。请在商品页补录成本。",
            inputs_json={"source_type": "SYNTHETIC", "price": 30.0},
        )
        row = suggestion_to_row(suggestion, "ds_test")
        self.assertIsNone(row["capital"])
        self.assertEqual(row["qty"], 480)
        self.assertNotIn("amount", row)
        snapshot = json.loads(row["inputs_json"])
        self.assertEqual(snapshot["raw_service_level"], 0.984)
        self.assertEqual(snapshot["service_level_source"], "default_missing_cost")
        self.assertEqual(snapshot["zero_days"], 7)
        self.assertEqual(snapshot["reason"], suggestion.reason)
        self.assertEqual(row["source_type"], "SYNTHETIC")

    def test_08_s2_delay_and_s3_promo_and_s5_gap(self) -> None:
        """补充：S2 晚到 20 天、S3 脉冲 ×3、S5 中间 30 天空白。"""
        s2 = self.dataset_ids["S2"]
        delayed = _query(
            "SELECT arrive_date, status FROM inbound_batches "
            "WHERE dataset_id=:d AND sku=:s AND status='DELAYED'",
            {"d": s2, "s": HERO_SKU},
        )
        self.assertEqual(len(delayed), 1)
        expected_arrive = SCENARIO_START_DATE + timedelta(
            days=S2_DELAY_NOMINAL_INDEX + S2_DELAY_DAYS
        )
        self.assertEqual(delayed[0]["arrive_date"], expected_arrive.isoformat())
        s2_dates = _stockout_dates(s2, HERO_SKU)
        self.assertEqual(len(s2_dates), S2_STOCKOUT_DAYS)
        self.assertEqual(
            s2_dates[0],
            (SCENARIO_START_DATE + timedelta(days=S2_STOCKOUT_START_INDEX)).isoformat(),
        )

        s3 = self.dataset_ids["S3"]
        promo_rows = _query(
            "SELECT date, qty FROM sales_daily "
            "WHERE dataset_id=:d AND sku=:s ORDER BY date",
            {"d": s3, "s": HERO_SKU},
        )
        promo_qty = [
            float(row["qty"])
            for row in promo_rows[
                S3_PROMO_START_INDEX : S3_PROMO_START_INDEX + S3_PROMO_DAYS
            ]
        ]
        self.assertEqual(len(promo_qty), S3_PROMO_DAYS)
        other_qty = [
            float(row["qty"])
            for index, row in enumerate(promo_rows)
            if index < S3_PROMO_START_INDEX
            or index >= S3_PROMO_START_INDEX + S3_PROMO_DAYS
        ]
        baseline = sum(other_qty) / len(other_qty)
        self.assertGreater(min(promo_qty), 2.0 * baseline)

        s5 = self.dataset_ids["S5"]
        gap_count = _scalar(
            "SELECT COUNT(*) FROM sales_daily "
            "WHERE dataset_id=:d AND sku=:s AND date>=:start AND date<:end",
            {
                "d": s5,
                "s": S5_GAP_SKU,
                "start": (SCENARIO_START_DATE + timedelta(days=S5_GAP_START_INDEX)).isoformat(),
                "end": (SCENARIO_START_DATE + timedelta(days=S5_GAP_END_INDEX)).isoformat(),
            },
        )
        self.assertEqual(int(gap_count or 0), 0)
        self.assertLess(S5_EFFECTIVE_DAYS, 60)


def print_acceptance_report() -> None:
    """打印 6 项验收的真实查询结果（终端原文，不是预期值）。"""
    ids = build_all_scenarios()  # 幂等：确保独立调用本函数也有数据。

    print("\n" + "=" * 76)
    print("验收 1/6 · pilot.db 已生成、十张表都在")
    print("=" * 76)
    print(f"pilot.db 绝对路径: {DB_PATH}")
    print(f"pilot.db 存在: {DB_PATH.exists()}")
    tables = _table_names()
    print(f"sqlite_master 查出的表名清单（{len(tables)} 个）: {tables}")

    print("\n" + "=" * 76)
    print("验收 2/6 · S1 那 14 天 is_stockout=1、qty_clean=None")
    print("=" * 76)
    rows = _query(
        "SELECT date, qty_clean FROM demand_daily "
        "WHERE dataset_id=:d AND sku=:s AND is_stockout = TRUE ORDER BY date",
        {"d": ids["S1"], "s": HERO_SKU},
    )
    print(f"demand_daily 查出的断货日期清单: {[row['date'] for row in rows]}")
    print(f"计数 = {len(rows)}")
    print(f"qty_clean 全为 NULL = {all(row['qty_clean'] is None for row in rows)}")

    print("\n" + "=" * 76)
    print("验收 3/6 · S4/S5 调 calibrate_demand 抛异常")
    print("=" * 76)
    for code, sku in (("S4", S4_NEW_SKU), ("S5", S5_GAP_SKU)):
        daily, inventory = _daily_inventory_rows(ids[code], sku)
        try:
            series = calibrate_demand(daily, inventory, sku, min_history=60)
            print(f"{code} 【失败】竟然返回了数字序列: {series.qty[:5]}")
        except Exception as caught:  # 打印真实异常类名与消息
            print(f"{code}: {type(caught).__name__}: {caught}")
            available = getattr(caught, "available", None)
            if available is not None:
                print(f"{code} 有效历史天数（异常对象 .available）= {available}")
    s5_valid = _scalar(
        "SELECT COUNT(*) FROM demand_daily "
        "WHERE dataset_id=:d AND sku=:s AND qty_clean IS NOT NULL",
        {"d": ids["S5"], "s": S5_GAP_SKU},
    )
    print(f"S5 目标 SKU 有效天数（库里 qty_clean 非 NULL 行数）= {s5_valid}")

    print("\n" + "=" * 76)
    print("验收 4/6 · 同一报表导两次，销量合计不变")
    print("=" * 76)
    first = _sum_qty(ids["S3"])
    loader = SyntheticLoader("S3")
    session = get_session()
    try:
        upsert_dataset(session, loader, SCENARIO_NAMES["S3"], loader.note)
        session.commit()
    finally:
        session.close()
    second = _sum_qty(ids["S3"])
    print(f"第一次 sum(qty) = {first}")
    print(f"第二次 sum(qty) = {second}")
    print(f"两次完全相等 = {first == second}")

    print("\n" + "=" * 76)
    print("验收 5/6 · 五个 dataset 都入库")
    print("=" * 76)
    datasets = _query(
        "SELECT dataset_id, name, source_type FROM datasets ORDER BY name"
    )
    print(f"dataset 清单（{len(datasets)} 行，id / name / source_type）:")
    for row in datasets:
        print(f"  {row['dataset_id']} / {row['name']} / {row['source_type']}")

    print("\n" + "=" * 76)
    print("验收 6/6 · source_type 是列 + 空成本存 NULL")
    print("=" * 76)
    if engine.dialect.name == "postgresql":
        col_rows = _query(
            "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='sales_daily' "
            "AND column_name='source_type'"
        )
        print(f"information_schema.columns 中 source_type 那行: {col_rows}")
    else:
        with engine.connect() as conn:
            pragma_rows = [
                tuple(row)
                for row in conn.exec_driver_sql("PRAGMA table_info(sales_daily)")
            ]
        source_line = [row for row in pragma_rows if row[1] == "source_type"]
        print(f"PRAGMA table_info(sales_daily) 中 source_type 那行: {source_line}")
    null_cost = _query(
        "SELECT DISTINCT sku, unit_cost, price FROM products "
        "WHERE unit_cost IS NULL ORDER BY sku LIMIT 3"
    )
    print(f"unit_cost IS NULL 的 SKU 证据: {null_cost}")
    zero_cost = _scalar("SELECT COUNT(*) FROM products WHERE unit_cost = 0")
    print(f"unit_cost = 0 的行数 = {zero_cost}")

    print("\n" + "=" * 76)
    print("core 缺陷如实上报（按指令未改 core 一行）")
    print("=" * 76)
    print(
        "core/demand.py:137 用 qty[-7:]（已剔除序列）判「前 7 天销量」；"
        "S1 连续断货第 8 天起 previous_sales=0 会漏标。"
        "本数据层用原始 qty_raw 判定，14 天全部命中；calibrate_demand 未改动。"
    )


if __name__ == "__main__":
    # 把 unittest 的详细输出也写到 stdout，保证终端里「汇总行 + 6 项打印」顺序稳定。
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
    print_acceptance_report()
    sys.exit(0 if result.wasSuccessful() else 1)
