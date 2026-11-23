"""PACK 15 / W4 离线自检：EX-10/11/13/14/15 五条合规声明命中。

复用 tests/eval_qa.py 的真实 call_agent + judge_explain 代码路径；
为避免消耗 LLM 预算，用 docs/eval-raw.json 里已缓存的模型原文桩掉 Runner.run_sync。
这不是省略判定：judge_explain 原样执行，只是文本来源换成历史原文。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

spec = importlib.util.spec_from_file_location("_w4_eval_qa", PILOT_DIR / "tests" / "eval_qa.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

from api.constants import NO_REPLENISH_TEXT, SYNTHETIC_NOTICE  # noqa: E402

TARGET_IDS = ("EX-10", "EX-11", "EX-13", "EX-14", "EX-15")

cases = json.loads((PILOT_DIR / "tests" / "cases_explain.json").read_text(encoding="utf-8"))["cases"]
raw = json.loads((PILOT_DIR / "docs" / "eval-raw.json").read_text(encoding="utf-8"))
cache = raw["explain_cache"]

original_run_sync = qa.Runner.run_sync


def main() -> int:
    hit_count = 0
    print("=== W4 五条 EX 判定（离线桩：真实 call_agent + judge_explain）===")
    for case in cases:
        if case["id"] not in TARGET_IDS:
            continue
        key = qa.cache_key(case)
        model_text = cache[key]["text"]

        # 未拼原文时的基线判定（模型自由转述版本）
        before = qa.judge_explain(case, model_text, None, True)

        # 用缓存原文桩掉 Runner.run_sync，走真实 call_agent 代码路径
        def stub_run_sync(_agent, _question, _text=model_text):
            return SimpleNamespace(
                final_output=_text,
                last_agent=SimpleNamespace(name="A6_replenish"),
            )

        qa.Runner.run_sync = stub_run_sync
        try:
            out = qa.call_agent("A6_replenish", case["question"],
                                compliance_hint=case["category"])
        finally:
            qa.Runner.run_sync = original_run_sync

        after = qa.judge_explain(case, out["text"], None, True)
        final_text = out["text"]
        nr_hit = NO_REPLENISH_TEXT in final_text
        sn_hit = SYNTHETIC_NOTICE in final_text
        if after["element_ok"]:
            hit_count += 1

        print(f"[{case['id']}] {case['category']} | 拼前 element_ok={before['element_ok']}"
              f" -> 拼后 element_ok={after['element_ok']} numbers_ok={after['numbers_ok']}"
              f" passed={after['passed']}")
        print(f"    原文命中: 无补货声明={nr_hit} 合成声明={sn_hit} | 判定口径={after['element_note']}")
        print(f"    文本末尾: {final_text[-120:]!r}")
    print(f"[W4 RESULT] 实时路径（call_agent）element_ok 命中 {hit_count}/5")

    # 缓存路径：text 直接来自 explain_cache，完全不经过 call_agent，
    # 只靠主流程 judge 前的 ensure_compliance 兜底。
    cache_hit = 0
    print("\n=== W4 五条 EX 判定（缓存路径：原样缓存 text + ensure_compliance）===")
    for case in cases:
        if case["id"] not in TARGET_IDS:
            continue
        cached_text = cache[qa.cache_key(case)]["text"]
        nr_before = NO_REPLENISH_TEXT in cached_text
        sn_before = SYNTHETIC_NOTICE in cached_text
        text = qa.ensure_compliance(cached_text, case)
        judged = qa.judge_explain(case, text, None, True)
        cache_hit += int(judged["element_ok"])
        print(f"[{case['id']}] {case['category']} | 缓存原文命中 无补货={nr_before} 合成={sn_before}"
              f" -> 兜底后 element_ok={judged['element_ok']} numbers_ok={judged['numbers_ok']}"
              f" | 兜底后原文命中 无补货={NO_REPLENISH_TEXT in text} 合成={SYNTHETIC_NOTICE in text}")
    print(f"[W4 RESULT] 缓存路径（ensure_compliance）element_ok 命中 {cache_hit}/5")
    return 0 if hit_count == 5 and cache_hit == 5 else 1


if __name__ == "__main__":
    sys.exit(main())
