"""PACK 11 测试：多路线方案对比 + 三目标决策（tests/test_routes.py）。

覆盖：
  1. 四种运输方式的「合成假设参数」集中定义在 core/routes.py 一处；
  2. 缺货风险由 (在手 + 在途) ÷ 日均销量 与 路线时效算出，不是写死；
  3. 总运费按 max(基础建议量, 最小起运量) × 单件运费实时计算；
  4. 三目标方案的服务水平 / 建议量 / 资金占用互不相同，且说明差异来自哪个参数；
  5. 新端点 /api/p3/route-plan 完整响应，且不含任何预期收益百分比；
  6. 保利润方案沿用既有推导链基准（服务水平和覆盖系数不变），既有算法未被改。

跑法：pilot/.venv/Scripts/python.exe -m pytest tests/test_routes.py -v
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from api.main import app
from core import (
    ASSUMPTION_NOTE,
    OBJECTIVE_ASSUMPTIONS,
    ROUTE_ASSUMPTIONS,
    build_route_plan,
    compare_routes,
)
from core.routes import ROUTE_LEAD_BASIS, route_lead_time, with_objective, with_route
from core import InventoryParams

PILOT_DIR = Path(__file__).resolve().parent.parent
client = TestClient(app)

# 只作计算用的输入样本，不是任何业务数字写死在页面/组件里。
MU = 8.8
SIGMA = 3.1275
LEAD = 53
REVIEW = 15
ON_HAND = 279.0
IN_TRANSIT = 0.0
BASE_QTY = 420
MOQ = 120
PACK = 60
UNIT_COST = 10.0

DATASET_NAME = "合成-正在缺货"
SKU = "SKU-017"


def _dataset_id() -> str:
    resp = client.get("/api/datasets")
    for item in resp.json()["datasets"]:
        if item["name"] == DATASET_NAME:
            return item["id"]
    raise AssertionError(f"数据集 {DATASET_NAME} 不存在")


class TestSyntheticAssumptions(unittest.TestCase):
    def test_four_routes_params_centralized(self):
        """四种运输方式参数集中一处，字段齐全，并标注「合成假设参数」。"""
        self.assertEqual(set(ROUTE_ASSUMPTIONS), {"sea", "air", "rail", "truck"})
        for code, p in ROUTE_ASSUMPTIONS.items():
            for key in ("name", "transit_days", "unit_freight", "min_qty", "reliability"):
                self.assertIn(key, p, f"{code} 缺 {key}")
            self.assertGreater(p["transit_days"], 0)
            self.assertGreater(p["unit_freight"], 0)
            self.assertGreater(p["min_qty"], 0)
            self.assertTrue(0 < p["reliability"] <= 1)

        source = (PILOT_DIR / "core" / "routes.py").read_text(encoding="utf-8")
        self.assertIn("合成假设参数", source, "参数表必须集中标注为合成假设参数")
        self.assertIn("不是真实物流报价", ASSUMPTION_NOTE)
        self.assertIn("合成假设参数", ASSUMPTION_NOTE)
        print(f"  ROUTE_ASSUMPTIONS = {json.dumps(ROUTE_ASSUMPTIONS, ensure_ascii=False)}")
        print(f"  ASSUMPTION_NOTE = {ASSUMPTION_NOTE}")


class TestRiskComputedNotHardcoded(unittest.TestCase):
    def test_risk_from_cover_days_and_transit(self):
        """缺货风险由 cover_days 与 transit_days 算出；改在手量结果必变。"""
        a = compare_routes(MU, ON_HAND, IN_TRANSIT, BASE_QTY)
        b = compare_routes(MU, ON_HAND + 400, IN_TRANSIT, BASE_QTY)

        cover_a = (ON_HAND + IN_TRANSIT) / MU
        cover_b = (ON_HAND + 400 + IN_TRANSIT) / MU
        for r in a:
            self.assertAlmostEqual(r["cover_days"], round(cover_a, 4), places=4)
            self.assertAlmostEqual(
                r["gap_days"], round(max(0.0, r["transit_days"] - cover_a), 4), places=4
            )
            self.assertAlmostEqual(
                r["arrival_remaining_days"],
                round(max(0.0, cover_a - r["transit_days"]), 4),
                places=4,
            )
        for ra, rb in zip(a, b):
            self.assertNotEqual(
                ra["risk_index"], rb["risk_index"],
                "在手量变了但风险不变 → 说明风险被写死了",
            )
            self.assertLess(rb["risk_index"], ra["risk_index"])
        print(f"  在手 {ON_HAND} → cover={cover_a:.2f} 天，海运风险={a[0]['risk_index']}")
        print(f"  在手 {ON_HAND + 400} → cover={cover_b:.2f} 天，海运风险={b[0]['risk_index']}")

    def test_freight_and_min_qty(self):
        """总运费 = max(基础建议量, 最小起运量) × 单件运费，全部实时计算。"""
        rows = compare_routes(MU, ON_HAND, IN_TRANSIT, BASE_QTY)
        for r in rows:
            p = ROUTE_ASSUMPTIONS[r["code"]]
            expect_qty = max(BASE_QTY, p["min_qty"])
            self.assertEqual(r["order_qty"], expect_qty)
            self.assertAlmostEqual(
                r["total_freight"], round(expect_qty * p["unit_freight"], 2), places=2
            )
        print("  总运费/起运量 =", [(r["name"], r["order_qty"], r["total_freight"]) for r in rows])


class TestObjectives(unittest.TestCase):
    def test_three_objectives_differ(self):
        """三目标服务水平 / 建议量 / 资金占用互不相同，且说明差异来自哪个参数。"""
        plan = build_route_plan(
            MU, SIGMA, LEAD, REVIEW, ON_HAND, IN_TRANSIT,
            BASE_QTY, MOQ, PACK, UNIT_COST,
        )
        objs = plan["objectives"]
        self.assertEqual(len(objs), 3)
        self.assertEqual({o["code"] for o in objs}, set(OBJECTIVE_ASSUMPTIONS))
        self.assertEqual(len({o["qty"] for o in objs}), 3, "三个方案建议量必须不同")
        self.assertEqual(len({o["capital"] for o in objs}), 3, "三个方案资金占用必须不同")
        self.assertEqual(len({o["service_level"] for o in objs}), 3, "三个方案服务水平必须不同")
        for o in objs:
            self.assertTrue(o["difference_from"])
            self.assertIn("service_level", o["difference_from"])
            self.assertIn("review_period", o["difference_from"])
        print("  三目标 =", [(o["name"], o["service_level"], o["qty"], o["capital"]) for o in objs])

    def test_profit_is_existing_baseline(self):
        """保利润方案沿用既有 baseline（服务水平 0.97 / 覆盖系数 1.0），既有算法未被改动。"""
        plan = build_route_plan(
            MU, SIGMA, LEAD, REVIEW, ON_HAND, IN_TRANSIT,
            BASE_QTY, MOQ, PACK, UNIT_COST,
        )
        profit = [o for o in plan["objectives"] if o["code"] == "profit"][0]
        self.assertEqual(OBJECTIVE_ASSUMPTIONS["profit"]["review_factor"], 1.0)
        self.assertEqual(profit["review_period"], REVIEW)
        self.assertEqual(profit["qty"], BASE_QTY, "基准方案应与既有建议量一致")
        print(f"  保利润 = {profit['qty']} 件 / ¥{profit['capital']}（与既有建议量 {BASE_QTY} 一致）")


class TestRoutePlanEndpoint(unittest.TestCase):
    def test_endpoint_full_response_and_no_claim(self):
        """新端点返回完整结构，且不含任何预期收益百分比。"""
        resp = client.get(
            "/api/p3/route-plan",
            params={"dataset_id": _dataset_id(), "sku": SKU},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(set(body), {
            "meta", "sku", "base", "assumption_note", "routes", "objectives",
        })
        self.assertEqual(len(body["routes"]), 4)
        self.assertEqual(len(body["objectives"]), 3)
        self.assertEqual(body["sku"], SKU)
        self.assertIn("合成假设参数", body["assumption_note"])
        self.assertIn("不是真实物流报价", body["assumption_note"])
        for r in body["routes"]:
            for key in ("transit_days", "unit_freight", "min_qty", "reliability",
                        "total_freight", "arrival_remaining_days", "risk_index",
                        "risk_level", "recommendation"):
                self.assertIn(key, r)
        for o in body["objectives"]:
            for key in ("service_level", "qty", "capital", "difference_from"):
                self.assertIn(key, o)
        text = json.dumps(body, ensure_ascii=False)
        for banned in ("30-50%", "15-35%", "20-40%", "3-8pp", "预期收益"):
            self.assertNotIn(banned, text, f"响应里出现禁止字样：{banned}")
        print("  端点 routes =", [(r["name"], r["transit_days"], r["total_freight"],
                                   r["arrival_remaining_days"], r["risk_level"])
                                  for r in body["routes"]])
        print("  端点 objectives =", [(o["name"], o["qty"], o["capital"])
                                     for o in body["objectives"]])


class TestRouteLeadBackfill(unittest.TestCase):
    """PACK 16b：路线/目标必须真的回灌进推导链，而不是只落库。"""

    def _inv(self) -> InventoryParams:
        return InventoryParams(
            unit_cost=10.0, price=30.0, moq=MOQ, pack_size=PACK,
            lead_prod=7, lead_transit=35, lead_customs=6, lead_inbound=5,
            review_period=15, holding_days=45,
        )

    def test_route_lead_time_basis(self):
        """路线总交期 = lead_prod + transit_days（transit_days 已含干线+清关+入仓）。"""
        self.assertEqual(route_lead_time("sea", 7), 52)
        self.assertEqual(route_lead_time("air", 7), 14)
        self.assertEqual(route_lead_time("rail", 7), 29)
        self.assertEqual(route_lead_time("truck", 7), 21)
        self.assertIn("transit_days", ROUTE_LEAD_BASIS)

    def test_with_route_replaces_three_segments(self):
        """回灌后 lead_time 必须等于 route_lead_time，且不叠加清关/入仓（防重复计）。"""
        inv = self._inv()
        for code in ROUTE_ASSUMPTIONS:
            got = with_route(inv, code)
            self.assertEqual(got.lead_time, route_lead_time(code, 7), msg=code)
            self.assertEqual(got.lead_customs, 0)
            self.assertEqual(got.lead_inbound, 0)
        # 原对象不被就地修改
        self.assertEqual(inv.lead_time, 53)

    def test_with_objective_overrides_level_and_period(self):
        inv = self._inv()
        cash = with_objective(inv, "cash")
        self.assertAlmostEqual(cash.service_level, 0.90)
        self.assertEqual(cash.review_period, 8)   # 15 × 0.5
        sales = with_objective(inv, "sales")
        self.assertAlmostEqual(sales.service_level, 0.99)
        self.assertEqual(sales.review_period, 22)  # 15 × 1.5
        profit = with_objective(inv, "profit")
        self.assertAlmostEqual(profit.service_level, 0.97)
        self.assertEqual(profit.review_period, 15)
        self.assertIsNone(inv.service_level)       # 原对象不动

    def test_api_route_param_changes_derivation(self):
        """接口层：传 route 后 lead_time 变短、建议量不增；meta 写明口径。"""
        did = _dataset_id()
        base = client.get(f"/api/p3/sku/{SKU}", params={"dataset_id": did}).json()
        air = client.get(
            f"/api/p3/sku/{SKU}", params={"dataset_id": did, "route": "air"}
        ).json()
        self.assertEqual(air["meta"]["route_code"], "air")
        self.assertIn("transit_days", air["meta"]["lead_time_basis"])
        self.assertEqual(base["meta"]["lead_time_basis"], "产品四段之和（生产+头程+清关+入仓）")
        self.assertLess(air["derivation"]["lead_time"], base["derivation"]["lead_time"])
        self.assertLessEqual(air["derivation"]["qty"], base["derivation"]["qty"])
        self.assertLess(air["capital"], base["capital"])

    def test_api_objective_param_changes_level_and_qty(self):
        """接口层：传 objective 后服务水平与覆盖周期按目标覆盖，建议量随之不增。"""
        did = _dataset_id()
        base = client.get(f"/api/p3/sku/{SKU}", params={"dataset_id": did}).json()
        cash = client.get(
            f"/api/p3/sku/{SKU}", params={"dataset_id": did, "objective": "cash"}
        ).json()
        sales = client.get(
            f"/api/p3/sku/{SKU}", params={"dataset_id": did, "objective": "sales"}
        ).json()
        self.assertEqual(cash["meta"]["objective_mode"], "cash")
        self.assertAlmostEqual(cash["service_level"], 0.90, places=4)
        self.assertEqual(cash["derivation"]["review_period"], 8)
        self.assertAlmostEqual(sales["service_level"], 0.99, places=4)
        self.assertEqual(sales["derivation"]["review_period"], 22)
        self.assertLessEqual(cash["derivation"]["qty"], base["derivation"]["qty"])
        self.assertGreaterEqual(sales["derivation"]["qty"], base["derivation"]["qty"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
