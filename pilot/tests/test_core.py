"""PACK 1 验收：五行手算 + 契约第六节边界用例（stdlib unittest，无 pytest/numpy）。

运行：
    pilot/.venv/Scripts/python.exe -m unittest discover -s pilot/tests -v
或在 pilot 目录下：
    .venv/Scripts/python.exe -m unittest discover -s tests -v

T-6/T-7/T-9/T-10/T-17 属于 PACK 2-5（数据层/Agent/界面），不在纯计算内核验收范围；
T-18 在 core 侧验证 method 字段为 "rolling"（界面文案由 PACK 5 渲染）。
"""

import math
import os
import statistics
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import BacktestResult, DemandSeries, InsufficientHistory, InvalidParams, InventoryParams, SourceType
from core.backtest import backtest
from core.demand import calibrate_demand, clean_for_model
from core.inventory import (
    build_suggestion,
    critical_ratio,
    lag1_autocorr,
    order_qty,
    per_unit_holding_cost,
    per_unit_shortage_cost,
    raw_critical_ratio,
    reorder_point,
    resolve_service_level,
    safety_stock,
    sigma_from_residuals,
    sigma_over_lead_time,
    std_ddof1,
    target_level,
    z_from_service,
)
from core.metrics import bias, mae, wape
from core.models import MODELS, f_croston_sba, f_exp_smoothing, f_moving_average, f_seasonal_naive
from core.models import clean_for_model as models_clean_for_model
from core.simulate import estimate_loss, simulate_stockout

# 第五节手算固定参数
SIGMA_DAILY = 3.1
LEAD_TIME = 53
MU_DAILY = 7.4
ON_HAND = 62.0
IN_TRANSIT = 0.0
MOQ = 120
PACK_SIZE = 60
HOLDING_DAYS = 45
OBSOLESCENCE = 0.08
UNIT_COST = 12.0
REVIEW_PERIOD = 15
CU_HAND = 30.0


def make_inventory(**overrides) -> InventoryParams:
    """构造默认档 InventoryParams；overrides 可覆盖任意字段。"""
    params = dict(
        unit_cost=UNIT_COST,
        price=32.0,
        moq=MOQ,
        pack_size=PACK_SIZE,
        lead_prod=7,
        lead_transit=35,
        lead_customs=6,
        lead_inbound=5,
    )
    params.update(overrides)
    return InventoryParams(**params)


def trend_series(days: int = 100) -> DemandSeries:
    """带一个断货日的线性趋势序列，用于 S1 选优 / 残差 sigma 测试。"""
    dates = [date(2025, 1, 1) + timedelta(days=i) for i in range(days)]
    qty = [100.0 + 1.0 * i for i in range(days)]
    stockout_index = days // 2
    qty[stockout_index] = None
    return DemandSeries(
        sku="TREND",
        dates=dates,
        qty=qty,
        is_stockout=[i == stockout_index for i in range(days)],
        source_type="SYNTHETIC",
    )


class TestHandCalculation(unittest.TestCase):
    """第五节五行手算对照：真实调用 core 函数并打印实际数字。"""

    def test_01_sigma_lt(self):
        got = sigma_over_lead_time(SIGMA_DAILY, LEAD_TIME)
        print(f"1. sigma_LT              = {got:.4f}   (hand 22.57)")
        self.assertAlmostEqual(got, 22.57, delta=22.57 * 0.01)

    def test_02_safety_stock(self):
        z = z_from_service(0.95)
        got = safety_stock(z, SIGMA_DAILY, LEAD_TIME)
        print(f"2. z(0.95)={z:.4f}, SS     = {got:.4f}   (hand 37.12)")
        self.assertAlmostEqual(got, 37.12, delta=37.12 * 0.01)

    def test_03_reorder_point(self):
        ss = safety_stock(z_from_service(0.95), SIGMA_DAILY, LEAD_TIME)
        got = reorder_point(MU_DAILY, LEAD_TIME, ss)
        print(f"3. ROP                   = {got:.4f}   (hand 429.3)")
        self.assertAlmostEqual(got, 429.3, delta=429.3 * 0.01)

    def test_04_target_and_two_step_rounding(self):
        ss = safety_stock(z_from_service(0.95), SIGMA_DAILY, LEAD_TIME)
        target = target_level(MU_DAILY, LEAD_TIME, REVIEW_PERIOD, ss)
        raw = target - ON_HAND - IN_TRANSIT
        qty, reason = order_qty(target, ON_HAND, IN_TRANSIT, MOQ, PACK_SIZE)
        print(f"4. target_S={target:.4f}, raw={raw:.4f}, qty={qty}   (hand 480)")
        self.assertAlmostEqual(target, 540.32, delta=540.32 * 0.01)
        self.assertEqual(qty, 480)
        self.assertIsNone(reason)

    def test_05_critical_ratio_double_assert(self):
        co = per_unit_holding_cost(
            UNIT_COST, holding_days=HOLDING_DAYS, obsolescence=OBSOLESCENCE
        )
        raw = raw_critical_ratio(CU_HAND, co)
        adopted = critical_ratio(CU_HAND, co)
        print(f"5. Co={co:.5f}, raw={raw:.4f}, adopted={adopted}")
        self.assertAlmostEqual(co, 0.48822, delta=0.00001)
        self.assertAlmostEqual(raw, 0.9840, delta=0.001)
        self.assertEqual(adopted, 0.97)


class TestBoundaryCases(unittest.TestCase):
    """契约第六节中属于纯计算内核的边界用例 T-1 ~ T-18。"""

    def test_t01_wape_zero_denominator(self):
        self.assertIsNone(wape([0, 0, 0], [1, 2, 3]))
        self.assertIsNone(bias([0, 0, 0], [1, 2, 3]))
        self.assertIsNone(wape([None, None], [1, 2]))
        # MAE 只要有一个有效观测就可算，不受分母约束
        self.assertAlmostEqual(mae([0, 0], [1, 2]), 1.5)
        self.assertIsNone(mae([None], [1]))

    def test_t02_croston_all_zero(self):
        result = f_croston_sba([0.0] * 30, 7)
        self.assertEqual(result, [0.0] * 7)
        self.assertFalse(any(math.isnan(v) for v in result))

    def test_t03_z_boundaries(self):
        self.assertAlmostEqual(z_from_service(0.90), 1.2816)
        self.assertAlmostEqual(z_from_service(0.95), 1.6449)
        self.assertAlmostEqual(z_from_service(0.97), 1.8808)
        self.assertAlmostEqual(z_from_service(0.99), 2.3263)
        with self.assertRaises(InvalidParams):
            z_from_service(0.85)
        with self.assertRaises(InvalidParams):
            z_from_service(1.02)

    def test_t04_invalid_moq_and_pack_size(self):
        with self.assertRaises(InvalidParams):
            order_qty(100.0, 0.0, 0.0, 0, 60)
        with self.assertRaises(InvalidParams):
            order_qty(100.0, 0.0, 0.0, 120, 0)
        with self.assertRaises(InvalidParams):
            order_qty(100.0, 0.0, 0.0, 100, 60)  # moq 非 pack 整数倍

    def test_t05_missing_cost_degradation(self):
        inv = make_inventory(unit_cost=None, price=None)
        self.assertIsNone(per_unit_shortage_cost(inv.price, inv.unit_cost))
        self.assertIsNone(per_unit_holding_cost(inv.unit_cost))
        raw, adopted, source = resolve_service_level(inv)
        self.assertIsNone(raw)
        self.assertEqual(adopted, 0.95)
        self.assertEqual(source, "default_missing_cost")

    def test_t08_stockout_ratio_warning(self):
        daily = [
            {
                "sku": "X",
                "date": date(2025, 1, 1) + timedelta(days=i),
                "qty_raw": 5.0,
                "source_type": "SYNTHETIC",
            }
            for i in range(10)
        ]
        inventory = [
            {"sku": "X", "date": row["date"], "on_hand": 0.0 if 1 <= i <= 6 else 10.0}
            for i, row in enumerate(daily)
        ]
        series = calibrate_demand(daily, inventory, "X", min_history=4)
        self.assertEqual(series.warning, "stockout_ratio_high")
        self.assertEqual(series.qty.count(None), 6)
        self.assertEqual(len([q for q in series.qty if q is not None]), 4)
        self.assertEqual(sum(series.is_stockout), 6)
        # 断货占比高也仍返回结果（C4，不硬拒）
        self.assertEqual(series.sku, "X")

    def test_t11_two_step_rounding_130_120_60(self):
        qty, reason = order_qty(192.0, ON_HAND, IN_TRANSIT, MOQ, PACK_SIZE)  # raw=130
        self.assertEqual(qty, 180)
        self.assertIsNone(reason)
        qty_zero, reason_zero = order_qty(50.0, ON_HAND, IN_TRANSIT, MOQ, PACK_SIZE)
        self.assertEqual((qty_zero, reason_zero), (0, "no_replenishment"))

    def test_t12_snaive_not_best_but_still_in_per_model(self):
        result = backtest(trend_series(), MODELS, horizon=7, n_windows=2, step=7)
        self.assertEqual(result.method, "rolling")
        self.assertIn("snaive", result.per_model)
        self.assertIsNotNone(result.best)
        self.assertNotEqual(result.best, "snaive")
        self.assertTrue(len(result.windows) >= 1)
        self.assertEqual(result.windows[0]["horizon"], 7)

    def test_t13_sigma_from_best_model_residuals(self):
        result = backtest(trend_series(), MODELS, horizon=7, n_windows=2, step=7)
        self.assertIsNotNone(result.best)
        clean = clean_for_model(trend_series())
        train, test = clean[:60], clean[60:67]
        predictions = MODELS[result.best](train, 7)
        got = sigma_from_residuals(test, predictions)
        residuals = [a - p for a, p in zip(test, predictions)]
        mean = sum(residuals) / len(residuals)
        manual = math.sqrt(sum((r - mean) ** 2 for r in residuals) / (len(residuals) - 1))
        self.assertAlmostEqual(got, manual, places=10)
        self.assertLess(got, statistics.pstdev(clean))  # 残差 sigma != 原始销量 sigma

    def test_t14_default_level_and_monotonic_linkage(self):
        inv = make_inventory()
        raw, adopted, source = resolve_service_level(inv)
        self.assertAlmostEqual(raw, 0.9840, delta=0.001)
        self.assertEqual(adopted, 0.97)
        self.assertEqual(source, "cost_reverse")

        # 增大 holding_days → Co 增大 → 服务水平 / SS / ROP / 未取整建议量单调下降
        inv_long = make_inventory(holding_days=150)
        raw_long, adopted_long, _ = resolve_service_level(inv_long)
        self.assertLess(adopted_long, adopted)
        ss = safety_stock(z_from_service(adopted), SIGMA_DAILY, inv.lead_time)
        ss_long = safety_stock(z_from_service(adopted_long), SIGMA_DAILY, inv_long.lead_time)
        self.assertLess(ss_long, ss)
        rop = reorder_point(MU_DAILY, inv.lead_time, ss)
        rop_long = reorder_point(MU_DAILY, inv_long.lead_time, ss_long)
        self.assertLess(rop_long, rop)
        target = target_level(MU_DAILY, inv.lead_time, inv.review_period, ss)
        target_long = target_level(MU_DAILY, inv_long.lead_time, inv_long.review_period, ss_long)
        self.assertLess(target_long, target)
        self.assertLess(target_long - ON_HAND, target - ON_HAND)
        self.assertLess(raw_long, raw)

    def test_t15_dynamic_assertions(self):
        inv = make_inventory()
        raw, adopted, source = resolve_service_level(inv)
        co = per_unit_holding_cost(inv.unit_cost, inv.holding_rate, inv.obsolescence, inv.holding_days)
        cu = per_unit_shortage_cost(inv.price, inv.unit_cost, inv.cu_multiplier)
        # 全部用函数返回值互相比对，不写死期望百分比
        self.assertEqual(raw, raw_critical_ratio(cu, co))
        self.assertEqual(adopted, critical_ratio(cu, co))
        self.assertEqual(z_from_service(adopted), z_from_service(critical_ratio(cu, co)))
        self.assertEqual(
            sigma_over_lead_time(SIGMA_DAILY, inv.lead_time),
            SIGMA_DAILY * math.sqrt(inv.lead_time),
        )
        self.assertEqual(source, "cost_reverse")

    def test_t16_critical_ratio_raw_and_clipped(self):
        co = per_unit_holding_cost(UNIT_COST, holding_days=HOLDING_DAYS, obsolescence=OBSOLESCENCE)
        self.assertAlmostEqual(co, 0.48822, delta=0.00001)
        self.assertAlmostEqual(raw_critical_ratio(30.0, 0.48822), 0.9840, delta=0.001)
        self.assertEqual(critical_ratio(30.0, 0.48822), 0.97)
        self.assertAlmostEqual(raw_critical_ratio(30.0, co), 0.9840, delta=0.001)
        self.assertEqual(critical_ratio(30.0, co), 0.97)
        self.assertIsNone(raw_critical_ratio(None, co))
        self.assertIsNone(critical_ratio(30.0, None))

    def test_t18_backtest_method_is_rolling(self):
        result = backtest(trend_series(), MODELS, horizon=7, n_windows=2, step=7)
        self.assertEqual(result.method, "rolling")
        # holdout 是另一种合法标注；core 产出必须是 rolling，界面才有资格写「走步回测」
        holdout = BacktestResult(per_model={}, windows=[], best=None, method="holdout")
        self.assertEqual(holdout.method, "holdout")


class TestAdditionalCoreChecks(unittest.TestCase):
    """契约函数契约的补充覆盖：None 位置、模型、取整、损失、无 NaN。"""

    def test_metrics_skip_none_positions(self):
        y = [10.0, None, 20.0, 0.0]
        yhat = [12.0, 999.0, 18.0, 5.0]
        # None 位置被跳过；y=0 是有效值须参与：Σy=10+20+0=30，Σ|e|=2+2+5=9
        self.assertAlmostEqual(wape(y, yhat), 9.0 / 30.0, places=10)
        self.assertAlmostEqual(bias(y, yhat), 5.0 / 30.0, places=10)
        self.assertAlmostEqual(mae(y, yhat), 3.0, places=10)

    def test_bias_sign_convention(self):
        self.assertGreater(bias([100.0, 100.0], [110.0, 110.0]), 0)
        self.assertLess(bias([100.0, 100.0], [90.0, 90.0]), 0)

    def test_no_nan_anywhere(self):
        values = [
            wape([0, 0], [1, 1]),
            bias([0, 0], [1, 1]),
            mae([], []),
            raw_critical_ratio(None, 1.0),
            per_unit_shortage_cost(None, 1.0),
            per_unit_holding_cost(None),
            estimate_loss(1, 1.0, None, 0.1),
        ]
        for value in values:
            self.assertTrue(value is None or not math.isnan(float(value)))

    def test_clean_for_model_dual_import_path(self):
        series = DemandSeries(
            sku="S",
            dates=[date(2025, 1, 1), date(2025, 1, 2)],
            qty=[1.0, None],
            is_stockout=[False, True],
            source_type="TEST_API",
        )
        self.assertEqual(clean_for_model(series), [1.0])
        self.assertEqual(models_clean_for_model(series), [1.0])

    def test_all_models_return_horizon_length(self):
        series = [float(i) for i in range(30)]
        for name, forecast in MODELS.items():
            with self.subTest(model=name):
                result = forecast(series, 5)
                self.assertEqual(len(result), 5)
                self.assertTrue(all(not math.isnan(v) for v in result))

    def test_lead_time_property(self):
        self.assertEqual(make_inventory().lead_time, 53)

    def test_manual_service_level(self):
        raw, adopted, source = resolve_service_level(make_inventory(service_level=0.92))
        self.assertEqual((raw, adopted, source), (0.92, 0.92, "manual"))

    def test_estimate_loss_and_stockout_simulation(self):
        loss = estimate_loss(5, MU_DAILY, 20.0, 0.10, 1.5)
        self.assertAlmostEqual(loss, 5 * MU_DAILY * 20.0 * 0.10 * 1.5, places=10)
        self.assertIsNone(estimate_loss(5, MU_DAILY, None, 0.10))

        result = simulate_stockout(10.0, [], MU_DAILY, horizon=10)
        self.assertEqual(result["coverage_days"], 1)
        self.assertEqual(result["zero_days"], 9)
        self.assertEqual(
            result["first_zero_date"], date.today() + timedelta(days=1)
        )

    def test_insufficient_history(self):
        short = DemandSeries(
            sku="SHORT",
            dates=[date(2025, 1, 1)] * 10,
            qty=[1.0] * 10,
            is_stockout=[False] * 10,
            source_type="TEST_API",
        )
        with self.assertRaises(InsufficientHistory):
            backtest(short, MODELS, horizon=7, n_windows=1, step=7)


class TestT19ConsecutiveStockout(unittest.TestCase):
    """T-19：连续断货 14 天，core 必须全部命中（修复 qty[-7:] 漏标缺陷）。

    断货语义：那 14 天「有需求但没货」——原始 qty_raw 仍有值（与 S1 真实库一致），
    只是 on_hand=0，输出 qty 置 None。改之前用 qty[-7:] 判前 7 天销量会漏标
    （实测 13/14），改后用 raws[-7:] 应为 14/14。
    """

    def test_t19_consecutive_14_stockout_days(self):
        n_normal, n_stockout = 20, 14
        start = date(2026, 1, 1)
        daily = []
        inventory = []
        for i in range(n_normal + n_stockout):
            day = start + timedelta(days=i)
            is_out = i >= n_normal
            daily.append(
                {
                    "sku": "X",
                    "date": day,
                    "qty_raw": 5.0,  # 断货期仍记原始需求（非 0），与 S1 真实数据一致
                    "source_type": "SYNTHETIC",
                }
            )
            inventory.append(
                {"sku": "X", "date": day, "on_hand": 0.0 if is_out else 10.0}
            )

        series = calibrate_demand(daily, inventory, "X", min_history=n_normal)
        flagged = [i for i, f in enumerate(series.is_stockout) if f]
        self.assertEqual(len(flagged), n_stockout)  # 恰好 14 天
        self.assertEqual(flagged, list(range(n_normal, n_normal + n_stockout)))
        # 这 14 位在输出 qty 中全是 None
        self.assertTrue(all(q is None for q in series.qty[n_normal:]))
        # 前 20 天未被误标
        self.assertFalse(any(series.is_stockout[:n_normal]))


    # ===== PACK 16a：回测对齐 / 样本外残差 / ar1 =====

    @staticmethod
    def _plate_series(n: int = 180) -> DemandSeries:
        """确定性正弦+趋势序列（无随机，保证断言可复现）。"""
        dates = [date(2026, 1, 1) + timedelta(days=i) for i in range(n)]
        qty = [round(10 + 3 * math.sin(2 * math.pi * (i % 7) / 7) + 0.02 * i, 3) for i in range(n)]
        return DemandSeries(
            sku="SKU-16A", dates=dates, qty=qty,
            is_stockout=[False] * n, source_type=list(SourceType)[0],
        )

    def test_t14_merged_metrics_aligned(self):
        """合并指标必须与「每窗口一次实际值 + 每模型一次预测」独立重算逐位相同。

        旧实现把 y_all.extend(test) 写在模型循环里，实际值被重复 n_models 遍，
        从第 2 个窗口起 WAPE/bias 全错。此用例即闸门。
        """
        series = self._plate_series()
        bt = backtest(series, MODELS)
        clean = clean_for_model(series)
        y, preds = [], {k: [] for k in MODELS}
        for w in range(4):
            origin = 60 + w * 7
            if origin + 14 > len(clean):
                break
            tr, te = clean[:origin], clean[origin : origin + 14]
            y.extend(te)
            for k, f in MODELS.items():
                preds[k].extend(list(f(tr, 14)))
        for k in MODELS:
            self.assertAlmostEqual(bt.per_model[k].wape, wape(y, preds[k]), places=12, msg=k)
            self.assertAlmostEqual(bt.per_model[k].bias, bias(y, preds[k]), places=12, msg=k)
            self.assertEqual(bt.per_model[k].n_obs, len(bt.residuals[k]))

    def test_t15_residuals_are_out_of_sample(self):
        """残差点数 = 各模型 n_obs；且与「全样本拟合」残差不是同一个数（样本外 vs 拟合）。"""
        series = self._plate_series()
        bt = backtest(series, MODELS)
        best = bt.best
        self.assertIsNotNone(best)
        clean = clean_for_model(series)
        valid = [q for q in clean if q is not None]
        oos = std_ddof1(bt.residuals[best])
        insample = sigma_from_residuals(valid, list(MODELS[best](valid, len(valid))))
        self.assertEqual(len(bt.residuals[best]), bt.per_model[best].n_obs)
        self.assertNotAlmostEqual(oos, insample, places=6)  # 必须能区分两种口径

    def test_t16_ar1_formula(self):
        """AR(1)：|ρ|>0.3 才放大，放大系数 sqrt((1+ρ)/(1-ρ))，负 ρ 会缩小，不许 clamp。"""
        self.assertAlmostEqual(sigma_over_lead_time(1.0, 100, 0.0), 10.0, places=12)
        self.assertAlmostEqual(sigma_over_lead_time(1.0, 100, 0.2), 10.0, places=12)   # 未触发
        self.assertAlmostEqual(sigma_over_lead_time(1.0, 100, 0.5), math.sqrt(300.0), places=12)
        self.assertAlmostEqual(sigma_over_lead_time(1.0, 100, -0.5), math.sqrt(100.0 / 3.0), places=12)
        # 手算与实现一致：sqrt(LT*(1+ρ)/(1-ρ))
        self.assertAlmostEqual(
            sigma_over_lead_time(1.0, 53, 0.4),
            math.sqrt(53 * (1.4 / 0.6)), places=12,
        )

    def test_t17_lag1_autocorr(self):
        """lag-1 自相关：与手工公式逐位一致；接缝对必须跳过（horizon 给定时）。"""
        xs = [1.0, -1.0, 1.0, -1.0, 1.0, -1.0]
        mean = sum(xs) / len(xs)
        denom = sum((v - mean) ** 2 for v in xs)
        numer = sum((xs[i] - mean) * (xs[i + 1] - mean) for i in range(len(xs) - 1))
        self.assertAlmostEqual(lag1_autocorr(xs), numer / denom, places=12)
        # 交替 30 点：标准估计量 = -29/30
        self.assertAlmostEqual(lag1_autocorr([1.0, -1.0] * 15), -29.0 / 30.0, places=12)
        # 两段独立拼接：接缝不跳会显著改变 ρ，跳过才对
        a = [1.0, 2.0, 3.0, 4.0]
        b = [-1.0, -2.0, -3.0, -4.0]
        with_seam = lag1_autocorr(a + b)
        no_seam = lag1_autocorr(a + b, horizon=4)
        self.assertNotAlmostEqual(with_seam, no_seam, places=6)

    def test_t18_sigma_source_traced(self):
        """build_suggestion 必须声明 σ 来源为样本外残差，并给出残差点数。"""
        series = self._plate_series()
        inv = InventoryParams(
            unit_cost=12, price=30, moq=120, pack_size=60,
            lead_prod=7, lead_transit=35, lead_customs=6, lead_inbound=5,
            review_period=15, holding_days=45, service_level=0.97,
        )
        sug = build_suggestion(series, inv, on_hand=62, in_transit=0)
        ctx = sug.inputs_json
        self.assertIn("样本外", ctx["sigma_source"])
        bt = backtest(series, MODELS)
        self.assertEqual(ctx["sigma_residual_points"], bt.per_model[bt.best].n_obs)
        self.assertEqual(ctx["ar1"], lag1_autocorr(bt.residuals[bt.best], 14))
        # σ_LT 必须能由 σ_日 与 ρ 手算复现
        expect = sigma_over_lead_time(ctx["sigma_daily"], inv.lead_time, ctx["ar1"])
        self.assertAlmostEqual(sug.sigma_lt, expect, places=12)


class TestDerivationIdentity(unittest.TestCase):
    """独立算式校验：不复用 build_suggestion 的结论，用返回的原始量另算一遍。"""

    def test_t19_derivation_identity_independent(self):
        series = self._plate_series()
        inv = InventoryParams(
            unit_cost=12, price=30, moq=120, pack_size=60,
            lead_prod=7, lead_transit=35, lead_customs=6, lead_inbound=5,
            review_period=15, holding_days=45, service_level=0.97,
        )
        sug = build_suggestion(series, inv, on_hand=62, in_transit=0)
        ctx = sug.inputs_json
        mu, lt, rp, z = ctx["mu_daily"], inv.lead_time, inv.review_period, sug.z
        self.assertAlmostEqual(sug.ss, z * sug.sigma_lt, places=9)
        self.assertAlmostEqual(sug.rop, mu * lt + sug.ss, places=6)
        self.assertAlmostEqual(sug.target_s, mu * (lt + rp) + sug.ss, places=6)
        raw = sug.target_s - (sug.on_hand + sug.in_transit)
        self.assertAlmostEqual(ctx["raw"], max(raw, 0.0), places=6)
        if ctx["raw"] > 0:
            import math
            q = math.ceil(max(ctx["raw"], inv.moq) / inv.pack_size) * inv.pack_size
            self.assertEqual(sug.qty, q)
            self.assertAlmostEqual(sug.amount, q * inv.unit_cost, places=6)
        else:
            self.assertEqual(sug.qty, 0)
            self.assertEqual(sug.amount, 0)

    @staticmethod
    def _plate_series(n: int = 180) -> DemandSeries:
        dates = [date(2026, 1, 1) + timedelta(days=i) for i in range(n)]
        qty = [round(10 + 3 * math.sin(2 * math.pi * (i % 7) / 7) + 0.02 * i, 3) for i in range(n)]
        return DemandSeries(
            sku="SKU-16A", dates=dates, qty=qty,
            is_stockout=[False] * n, source_type=list(SourceType)[0],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
