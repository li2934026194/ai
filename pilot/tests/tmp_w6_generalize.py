"""PACK 15 / W6 离线自检：20 条自造同义问法的路由落点。

问法只写在本临时脚本里，绝不写入 tests/cases_ask.json / cases_explain.json。
只调用 agents/registry.py 的 classify_intent（纯规则，不调用 LLM）。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

spec = importlib.util.spec_from_file_location("_w6_registry", PILOT_DIR / "agents" / "registry.py")
reg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reg)

# (问句, 期望 Agent, 判定理由：为什么该落这个 Agent)
QUESTIONS: list[tuple[str, str, str]] = [
    ("这个 SKU 的预测误差有多大？", "A5_forecast",
     "误差是回测评估的通用度量词，问的是预测质量，归 A5"),
    ("回测偏差为什么偏高？", "A5_forecast",
     "偏差是 bias 的自然语言类目词，且带回测，归 A5"),
    ("把服务水平调到 99% 再算一次结果会变吗？", "A5_forecast",
     "再算是重跑计算的动作类目，未提补货动作，归 A5"),
    ("调参后再算一下 WAPE", "A5_forecast",
     "调参/再算都指向回测重算，且有 WAPE，归 A5"),
    ("这个模型的预测偏差能降到多少？", "A5_forecast",
     "偏差+模型，问预测精度，归 A5"),
    ("WAPE 误差的口径是什么？", "A5_forecast",
     "误差与 WAPE 同属回测口径词，归 A5"),
    ("为什么回测误差这么大？", "A5_forecast",
     "回测+误差，问模型评估，归 A5"),
    ("调参后回测模型表现有变化吗？", "A5_forecast",
     "调参是对预测模型参数的动作，归 A5"),
    ("历史需求波动大，预测偏差怎么解释？", "A5_forecast",
     "预测+偏差，仍是预测质量问句，归 A5"),
    ("再算一次未来两周的销量预测", "A5_forecast",
     "再算+预测，指向重新预测，归 A5"),
    ("这个 SKU 这次要备货多少件？", "A6_replenish",
     "备货是补货动作的动词类目，归 A6"),
    ("下一批进货多少合适？", "A6_replenish",
     "语义上属进货动作应归 A6；词面「进货多少」不含「进多少」，当前落 A3——已知缺口。"
     "不补「进货」：会把 A48「竞争对手的进货价」误路由 A6"),
    ("这份申请批不批？", "A6_replenish",
     "批不批是审批动作的动词类目，归 A6"),
    ("给我一个备货建议量", "A6_replenish",
     "备货+建议量，都是补货动作类，归 A6"),
    ("现在该备货还是再等等？", "A6_replenish",
     "备货是补货动作类目，问是否执行，归 A6"),
    ("补多少件比较稳？", "A6_replenish",
     "补多少是原有补货动作类目，归 A6"),
    ("这批货批不批，谁来决定？", "A6_replenish",
     "批不批属审批动作类目，归 A6"),
    ("能不能帮我订多少件的方案看一下？", "A6_replenish",
     "订多少是原有订货数量类目，归 A6"),
    ("当前在手库存还剩多少？", "A3_ask",
     "单指标查询，无任何预测/补货动作词，A3 只读取数自答"),
    ("补货点的口径是什么？", "A3_ask",
     "补货点属 METRIC_GUARD_TERMS，问口径不是补货动作，归 A3"),
]


def main() -> int:
    print("=== W6 20 条自造同义问法 × classify_intent 落点 ===")
    hit = 0
    for idx, (question, expected, reason) in enumerate(QUESTIONS, start=1):
        actual = reg.classify_intent(question)
        ok = actual == expected
        hit += int(ok)
        print(f"{idx:02d}. Q={question}")
        print(f"    期望={expected:<13} 实际={actual:<13} {'HIT' if ok else 'MISS'} | {reason}")
    print(f"\n[W6 RESULT] 命中 {hit}/20（目标 ≥16/20）")
    return 0 if hit >= 16 else 1


if __name__ == "__main__":
    sys.exit(main())
