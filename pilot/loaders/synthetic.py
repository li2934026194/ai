"""合成数据生成器：20 SKU × 180 天，seed=42，S1–S5 场景参数（10 号文档 4.2/4.3）。

日销量公式（10 号 4.2）：

    日销量 = 基线 × 趋势(±) × 周季节(周末高) × 节庆脉冲 × 泊松噪声

所有数值均用具名常量并注明来源：
- SKU 数/天数/seed/交期/退货率/补货周期/MOQ/整箱来自 10 号 4.2；
- 价差 20 = 17 号「五、手算对照表」中 Cu=30、cu_multiplier=1.5 的逆推
  （price − unit_cost = 30 / 1.5 = 20），不是演示数字；
- 10 号 4.2 未给绝对价格与基线销量，其余量只作为具名构造参数出现，
  不在计算逻辑里散落魔数。

契约里的 pd.DataFrame 在本环境用 duck-typed ``list[dict]`` 实现（未装 pandas，
core/demand.py::_iter_records 明确支持 list[dict]）。
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from random import Random
from typing import Literal

# 17 号第二节 SourceType 固定四值；合成数据只用 SYNTHETIC。
SYNTHETIC: Literal["SYNTHETIC"] = "SYNTHETIC"
ScenarioCode = Literal["S1", "S2", "S3", "S4", "S5"]

# ---- 10 号 4.2 仿真参数（具名常量，注释来源） ----
DEFAULT_SKU_COUNT = 20           # 10 号 4.2：20 SKU
SLOW_MOVER_COUNT = 3             # 10 号 4.2：含 3 个慢动 SKU
DEFAULT_DAYS = 180               # 10 号 4.2：180 天
DEFAULT_SEED = 42                # 10 号 4.2：seed=42
LEAD_PROD_DAYS = 7               # 10 号 4.2：生产 7 天
LEAD_TRANSIT_DAYS = 35           # 10 号 4.2：头程 35 天
LEAD_CUSTOMS_DAYS = 6            # 10 号 4.2：清关 6 天
LEAD_INBOUND_DAYS = 5            # 10 号 4.2：入仓 5 天
LEAD_TIME_DAYS = 53              # 10 号 4.2：四段合计 53 天
RETURN_RATE = 0.08               # 10 号 4.2：退货率 8%
REPLENISHMENT_DAYS = 15          # 10 号 4.2：定期补货 15 天
MOQ = 300                        # 10 号 4.2：MOQ 300
PACK_SIZE = 60                   # 10 号 4.2：整箱 60

# ---- 生成器构造参数（10 号 4.2 未给具体数值，集中具名，便于解释与调参） ----
SCENARIO_START_DATE = date(2026, 1, 1)
BASE_DAILY_QTY = 8.0             # 主力 SKU 泊松强度基线
SLOW_BASE_DAILY_QTY = 0.8        # 慢动 SKU：间歇需求
TREND_AMPLITUDE = 0.10           # 趋势幅度 ±10%
WEEKEND_MULTIPLIER = 1.30        # 周季节：周末高
FESTIVAL_DAY_INDEX = 150         # 节庆脉冲所在日序号（0 基）
FESTIVAL_MULTIPLIER = 1.50       # 节庆脉冲强度
PRICE_TIER_STEP = 4.0            # 价格分层步长
COST_TIER_STEP = 4.0             # 成本同幅度分层，保证各 SKU 价差一致
PRICE_TIER_COUNT = 4             # 4 档价格
GROSS_MARGIN_PER_UNIT = 20.0     # 17 号手算：Cu=30 / 1.5 = price − unit_cost
BASE_UNIT_COST = 10.0            # 成本档位基准：价差由 GROSS_MARGIN_PER_UNIT 保证
INITIAL_ON_HAND = 320.0          # 期初在手，保证正常场景自然断货不发生
SLOW_INITIAL_ON_HAND = 120.0     # 慢动 SKU 期初在手
ON_HAND_DAILY_DRIFT = 2.0        # 在手缓慢增长，避免库存见底噪声
BATCH_QTY = 200.0                # 常规 SKU 每批到货量
SLOW_BATCH_QTY = 60.0            # 慢动 SKU 每批到货量
BATCH_CYCLES = 10                # 每 SKU 10 个补货批次（15..150 天）
NEW_SKU_ON_HAND = 100.0          # S4 新品期初在手
GAP_SKU_ON_HAND = 100.0          # S5 缺口 SKU 期初在手

# ---- S1–S5 注入参数（10 号 4.3） ----
S1_STOCKOUT_START_INDEX = 80     # S1：断货窗口起点，连续 14 天
S1_STOCKOUT_DAYS = 14
S2_DELAY_CYCLE = 8               # S2：第 8 批名义第 120 天到
S2_DELAY_DAYS = 20               # S2：晚 20 天 → 第 140 天到
S2_DELAY_NOMINAL_INDEX = S2_DELAY_CYCLE * REPLENISHMENT_DAYS   # 120
S2_STOCKOUT_START_INDEX = S2_DELAY_NOMINAL_INDEX + 1           # 121
S2_STOCKOUT_DAYS = S2_DELAY_DAYS - 1                           # 19
S3_PROMO_START_INDEX = 100       # S3：连续 3 天大促
S3_PROMO_DAYS = 3
PROMO_MULTIPLIER = 3.0           # S3：销量 ×3（脉冲，不是趋势）
S4_HISTORY_DAYS = 3              # S4：新品只有 3 天历史
S5_BEFORE_DAYS = 40              # S5：缺口前 40 天
S5_GAP_DAYS = 30                 # S5：中间 30 天无任何记录
S5_AFTER_DAYS = 15               # S5：缺口后 15 天；有效 55 < 60
S5_GAP_START_INDEX = S5_BEFORE_DAYS                            # 40
S5_GAP_END_INDEX = S5_GAP_START_INDEX + S5_GAP_DAYS            # 70
S5_EFFECTIVE_DAYS = S5_BEFORE_DAYS + S5_AFTER_DAYS             # 55

HERO_SKU = "SKU-001"             # 主力 SKU：S1/S2/S3 的注入对象
S4_NEW_SKU = "SKU-017"           # S4 新品（非慢动，索引 16）
S5_GAP_SKU = "SKU-017"           # S5 缺口 SKU（另一个场景复用同一索引）

# ---- S6「正在缺货」注入参数（新增，PACK 4） ----
# 与 S1「曾经历断货」不同：S6 让 5 个 SKU 在数据末尾仍处于断货中，
# 这样按 as_of 口径打开 P1 驾驶舱，就能看到「此刻正在缺货、建议补 X 件」。
S6_STOCKOUT_SKUS: tuple[str, ...] = (
    "SKU-002", "SKU-003", "SKU-004", "SKU-005", "SKU-006",
)                                    # 5 个非慢动 SKU（有成本，能算金额）
S6_STOCKOUT_TAIL_DAYS = 8            # 最后 8 天 on_hand=0（此刻仍缺货）
S6_DEMAND_QTY: tuple[float, ...] = (8.0, 12.0, 15.0)  # 断货日 qty_raw 仍有需求值

SCENARIO_NAMES: dict[str, str] = {
    "S1": "合成-断货14天",
    "S2": "合成-交期延误20天",
    "S3": "合成-大促3倍",
    "S4": "合成-新品零历史",
    "S5": "合成-数据缺30天",
    "S6": "合成-正在缺货",
}


def sku_at(index: int) -> str:
    """按序号生成 SKU 编码（0 基 → SKU-001）。"""
    return f"SKU-{index + 1:03d}"


def is_slow_mover(index: int, sku_count: int = DEFAULT_SKU_COUNT) -> bool:
    """末尾 SLOW_MOVER_COUNT 个 SKU 是慢动/间歇需求 SKU。"""
    return index >= sku_count - SLOW_MOVER_COUNT


def batch_qty_for(index: int, sku_count: int = DEFAULT_SKU_COUNT) -> float:
    """慢动 SKU 批量更小，其余用常规批量。"""
    return SLOW_BATCH_QTY if is_slow_mover(index, sku_count) else BATCH_QTY


def poisson_noise(rng: Random, lam: float) -> int:
    """泊松噪声：未装 numpy，用 stdlib 实现。小 λ 用 Knuth 乘法法（精确），
    λ>=30 用正态近似；两者都只依赖 Random.random / Random.gauss。"""
    if lam <= 0.0:
        return 0
    if lam < 30.0:
        limit = math.exp(-lam)
        product = 1.0
        count = 0
        while product > limit:
            count += 1
            product *= rng.random()
        return count - 1
    return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))


def unit_cost_for_tier(tier: int) -> float:
    """按价格档位算单位成本；与售价的价差恒为 GROSS_MARGIN_PER_UNIT。"""
    return BASE_UNIT_COST + COST_TIER_STEP * tier


class SyntheticLoader:
    """Loader 实现：一次构造生成一个场景的四张事实表数据。

    未装 pandas，``load()`` 返回 ``dict[str, list[dict]]``（等价 DataFrame）；
    真 DataFrame 传入 loaders.base.upsert_dataset 也能被 ``to_dict("records")`` 吃下。
    同一 (scenario, seed) 必定产出完全相同的数据，这是幂等复导的前提。
    """

    source_type = SYNTHETIC

    def __init__(
        self,
        scenario: ScenarioCode = "S1",
        *,
        sku_count: int = DEFAULT_SKU_COUNT,
        days: int = DEFAULT_DAYS,
        seed: int = DEFAULT_SEED,
    ) -> None:
        if scenario not in SCENARIO_NAMES:
            raise ValueError(f"未知场景 {scenario!r}，只允许 {sorted(SCENARIO_NAMES)}")
        if sku_count < 1 or days < 1:
            raise ValueError("sku_count 与 days 必须为正整数")

        self.scenario: ScenarioCode = scenario
        self.sku_count = sku_count
        self.days = days
        self.seed = seed
        self.name = SCENARIO_NAMES[scenario]
        self.note = self._build_note()
        self._rng = Random(self.seed)

        self._products: list[dict] = []
        self._sales: list[dict] = []
        self._inventory: list[dict] = []
        self._inbound: list[dict] = []
        self._generate()

    def _build_note(self) -> str:
        """把生成口径与场景注入写进 note，便于解释层引用（10 号 4.2）。"""
        common = (
            f"scenario={self.scenario} seed={self.seed} sku={self.sku_count} "
            f"days={self.days} lead={LEAD_PROD_DAYS}/{LEAD_TRANSIT_DAYS}/"
            f"{LEAD_CUSTOMS_DAYS}/{LEAD_INBOUND_DAYS}={LEAD_TIME_DAYS} "
            f"refund={RETURN_RATE:.0%} replenish={REPLENISHMENT_DAYS}d "
            f"moq={MOQ} pack={PACK_SIZE} "
            "qty=baseline*trend*weekday*festival*poisson"
        )
        injections: dict[str, str] = {
            "S1": (
                f"{HERO_SKU} on_hand=0 for {S1_STOCKOUT_DAYS}d "
                f"from index {S1_STOCKOUT_START_INDEX}"
            ),
            "S2": (
                f"{HERO_SKU} batch#{S2_DELAY_CYCLE} arrive "
                f"+{S2_DELAY_DAYS}d (index {S2_DELAY_NOMINAL_INDEX}->"
                f"{S2_DELAY_NOMINAL_INDEX + S2_DELAY_DAYS})"
            ),
            "S3": (
                f"{HERO_SKU} index {S3_PROMO_START_INDEX}.."
                f"{S3_PROMO_START_INDEX + S3_PROMO_DAYS - 1} qty x{PROMO_MULTIPLIER:g}"
            ),
            "S4": f"{S4_NEW_SKU} only {S4_HISTORY_DAYS}d history",
            "S5": (
                f"{S5_GAP_SKU} gap {S5_GAP_DAYS}d at index "
                f"{S5_GAP_START_INDEX}..{S5_GAP_END_INDEX - 1}, "
                f"effective={S5_EFFECTIVE_DAYS}<60"
            ),
            "S6": (
                f"{', '.join(S6_STOCKOUT_SKUS)} on_hand=0 for last "
                f"{S6_STOCKOUT_TAIL_DAYS}d (still stocked out at as_of)"
            ),
        }
        return f"{common} | {injections[self.scenario]}"

    def _day_indices_for(self, sku: str) -> list[int]:
        """按场景决定某 SKU 有哪些天的记录（S4/S5 会裁剪历史）。"""
        if self.scenario == "S4" and sku == S4_NEW_SKU:
            return list(range(S4_HISTORY_DAYS))
        if self.scenario == "S5" and sku == S5_GAP_SKU:
            return list(range(S5_BEFORE_DAYS)) + list(
                range(S5_GAP_END_INDEX, S5_GAP_END_INDEX + S5_AFTER_DAYS)
            )
        return list(range(self.days))

    def _daily_qty(self, index: int, day_index: int, sku: str) -> float:
        """基线 × 趋势 × 周季节 × 节庆脉冲 × 泊松噪声（10 号 4.2）。"""
        baseline = (
            SLOW_BASE_DAILY_QTY
            if is_slow_mover(index, self.sku_count)
            else BASE_DAILY_QTY
        )
        # 趋势：整段 180 天内从 -TREND_AMPLITUDE 线性走到 +TREND_AMPLITUDE。
        span = max(1, self.days - 1)
        trend = 1.0 + TREND_AMPLITUDE * (2.0 * day_index / span - 1.0)
        weekday = (SCENARIO_START_DATE + timedelta(days=day_index)).weekday()
        season = WEEKEND_MULTIPLIER if weekday >= 5 else 1.0
        festival = FESTIVAL_MULTIPLIER if day_index == FESTIVAL_DAY_INDEX else 1.0
        promo = 1.0
        if (
            self.scenario == "S3"
            and sku == HERO_SKU
            and S3_PROMO_START_INDEX <= day_index < S3_PROMO_START_INDEX + S3_PROMO_DAYS
        ):
            promo = PROMO_MULTIPLIER
        # S6 断货尾段：qty_raw 给确定需求值（8/12/15 轮换），代表「有需求但没货卖」。
        if self.scenario == "S6" and sku in S6_STOCKOUT_SKUS:
            if day_index >= self.days - S6_STOCKOUT_TAIL_DAYS:
                return S6_DEMAND_QTY[index % len(S6_DEMAND_QTY)]
        intensity = baseline * trend * season * festival * promo
        return poisson_noise(self._rng, intensity)

    def _on_hand(self, sku: str, day_index: int, index: int) -> float:
        """生成库存；S1/S2 的断货窗口强制 0，S4/S5 目标 SKU 保持正值。"""
        if self.scenario == "S1" and sku == HERO_SKU:
            if S1_STOCKOUT_START_INDEX <= day_index < S1_STOCKOUT_START_INDEX + S1_STOCKOUT_DAYS:
                return 0.0
        if self.scenario == "S2" and sku == HERO_SKU:
            if S2_STOCKOUT_START_INDEX <= day_index < S2_STOCKOUT_START_INDEX + S2_STOCKOUT_DAYS:
                return 0.0
        if self.scenario == "S6" and sku in S6_STOCKOUT_SKUS:
            if day_index >= self.days - S6_STOCKOUT_TAIL_DAYS:
                return 0.0  # 末尾仍在缺货：此刻 as_of 在手 = 0
        if sku == S4_NEW_SKU:
            return NEW_SKU_ON_HAND + float(day_index)
        if sku == S5_GAP_SKU:
            return GAP_SKU_ON_HAND + float(day_index)
        initial = (
            SLOW_INITIAL_ON_HAND
            if is_slow_mover(index, self.sku_count)
            else INITIAL_ON_HAND
        )
        return initial + ON_HAND_DAILY_DRIFT * float(day_index)

    def _in_transit(self, index: int, day_index: int) -> float:
        """未来 REPLENISHMENT_DAYS 天内会到的批次量（按名义到货日算）。"""
        qty = batch_qty_for(index, self.sku_count)
        for cycle in range(1, BATCH_CYCLES + 1):
            nominal_index = cycle * REPLENISHMENT_DAYS
            if 0 < nominal_index - day_index <= REPLENISHMENT_DAYS:
                return qty
        return 0.0

    def _generate(self) -> None:
        """生成四张事实表；SKU 外层、日期内层，随机序列完全可复现。"""
        for index in range(self.sku_count):
            sku = sku_at(index)
            slow = is_slow_mover(index, self.sku_count)
            tier = index % PRICE_TIER_COUNT
            # 慢动/新品之一成本未知：存 None（SQL NULL），绝不存 0。
            unit_cost: float | None = None if slow else unit_cost_for_tier(tier)
            price: float | None = None if slow else unit_cost + GROSS_MARGIN_PER_UNIT
            self._products.append(
                {
                    "dataset_id": "",  # 由 upsert_dataset 按 dataset 盖写
                    "sku": sku,
                    "title": f"合成商品 {sku}" + ("（慢动）" if slow else ""),
                    "unit_cost": unit_cost,
                    "price": price,
                    "moq": MOQ,
                    "pack_size": PACK_SIZE,
                    "lead_prod": LEAD_PROD_DAYS,
                    "lead_transit": LEAD_TRANSIT_DAYS,
                    "lead_customs": LEAD_CUSTOMS_DAYS,
                    "lead_inbound": LEAD_INBOUND_DAYS,
                    "source_type": SYNTHETIC,
                }
            )

            batch_qty = batch_qty_for(index, self.sku_count)
            for cycle in range(1, BATCH_CYCLES + 1):
                nominal_index = cycle * REPLENISHMENT_DAYS
                arrive_index = nominal_index
                status = "PLANNED"
                if self.scenario == "S2" and sku == HERO_SKU and cycle == S2_DELAY_CYCLE:
                    arrive_index = nominal_index + S2_DELAY_DAYS
                    status = "DELAYED"
                self._inbound.append(
                    {
                        "dataset_id": "",
                        "sku": sku,
                        "batch_id": f"B{cycle:03d}",
                        "arrive_date": SCENARIO_START_DATE
                        + timedelta(days=arrive_index),
                        "qty": batch_qty,
                        "status": status,
                        "source_type": SYNTHETIC,
                    }
                )

            for day_index in self._day_indices_for(sku):
                day = SCENARIO_START_DATE + timedelta(days=day_index)
                qty = self._daily_qty(index, day_index, sku)
                revenue = round(qty * price, 2) if price is not None else None
                self._sales.append(
                    {
                        "dataset_id": "",
                        "sku": sku,
                        "date": day,
                        "qty": qty,
                        "revenue": revenue,
                        "is_refund": int(self._rng.random() < RETURN_RATE),
                        "source_type": SYNTHETIC,
                    }
                )
                self._inventory.append(
                    {
                        "dataset_id": "",
                        "sku": sku,
                        "date": day,
                        "on_hand": self._on_hand(sku, day_index, index),
                        "in_transit": self._in_transit(index, day_index),
                        "source_type": SYNTHETIC,
                    }
                )

    def load(self) -> dict[str, list[dict]]:
        """返回四张事实表（duck-typed DataFrame = list[dict] 的拷贝）。"""
        return {
            "products": [dict(row) for row in self._products],
            "sales_daily": [dict(row) for row in self._sales],
            "inventory_daily": [dict(row) for row in self._inventory],
            "inbound_batches": [dict(row) for row in self._inbound],
        }


__all__ = [
    "SYNTHETIC",
    "ScenarioCode",
    "SCENARIO_NAMES",
    "SCENARIO_START_DATE",
    "HERO_SKU",
    "S4_NEW_SKU",
    "S5_GAP_SKU",
    "S1_STOCKOUT_START_INDEX",
    "S1_STOCKOUT_DAYS",
    "S2_DELAY_CYCLE",
    "S2_DELAY_DAYS",
    "S2_DELAY_NOMINAL_INDEX",
    "S2_STOCKOUT_START_INDEX",
    "S2_STOCKOUT_DAYS",
    "S3_PROMO_START_INDEX",
    "S3_PROMO_DAYS",
    "PROMO_MULTIPLIER",
    "S4_HISTORY_DAYS",
    "S5_BEFORE_DAYS",
    "S5_GAP_DAYS",
    "S5_GAP_END_INDEX",
    "S5_EFFECTIVE_DAYS",
    "S6_STOCKOUT_SKUS",
    "S6_STOCKOUT_TAIL_DAYS",
    "S6_DEMAND_QTY",
    "LEAD_TIME_DAYS",
    "MOQ",
    "PACK_SIZE",
    "SyntheticLoader",
    "sku_at",
    "is_slow_mover",
    "unit_cost_for_tier",
    "poisson_noise",
]
