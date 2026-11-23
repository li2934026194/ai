"""PACK 15 / W5 离线自检：EX-07/08/09 断货日四要素 + 全部 30 条 element_ok 计数。

复用 eval_qa 的 build_constructed / judge_explain / live_facts，
文本来源为本地构造序列与 docs/eval-raw.json 缓存的 A6 原文（不调用 LLM）。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

spec = importlib.util.spec_from_file_location("_w5_eval_qa", PILOT_DIR / "tests" / "eval_qa.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

cases = json.loads((PILOT_DIR / "tests" / "cases_explain.json").read_text(encoding="utf-8"))["cases"]
cache = json.loads((PILOT_DIR / "docs" / "eval-raw.json").read_text(encoding="utf-8"))["explain_cache"]


def judged_text(case: dict) -> tuple[str, object, bool]:
    """复刻 eval_qa.main 的解释分支（离线，不触发 LLM）。"""
    if case["source"] == "db":
        text = cache[qa.cache_key(case)]["text"]
        text = qa.ensure_compliance(text, case)
        warning, result_ok = None, True
        live = qa.live_facts(case)
        if live.get("error") == "E-1001" and case["category"] != "E-1001":
            result_ok = False
        else:
            warning = live.get("warning")
    else:
        built = qa.build_constructed(case["constructed"])
        text = built["text"]
        warning, result_ok = built["warning"], built["result_ok"]
    return text, warning, result_ok


def main() -> int:
    print("=== W5 EX-07/08/09 构造序列 ===")
    for case in cases:
        if case["id"] not in ("EX-07", "EX-08", "EX-09"):
            continue
        text, warning, result_ok = judged_text(case)
        judged = qa.judge_explain(case, text, warning, result_ok)
        print(f"[{case['id']}] text={text!r}")
        print(f"    四要素={judged['elements']} element_ok={judged['element_ok']}"
              f" numbers_ok={judged['numbers_ok']} mismatches={judged['mismatches']}"
              f" warning={warning} result_ok={result_ok}")

    print("\n=== W5 全部 30 条 explain element_ok ===")
    element_ok = numbers_ok = passed = 0
    for case in cases:
        text, warning, result_ok = judged_text(case)
        judged = qa.judge_explain(case, text, warning, result_ok)
        element_ok += int(judged["element_ok"])
        numbers_ok += int(judged["numbers_ok"])
        passed += int(judged["passed"])
    print(f"element_ok={element_ok}/30 numbers_ok={numbers_ok}/30 passed={passed}/30")
    return 0 if element_ok >= 25 else 1


if __name__ == "__main__":
    sys.exit(main())
