"""PACK 15 / QA 临时脚本：50 条既有 ask 用例规则回归。

用 agents/registry.py 的 classify_intent（纯规则，不调用 LLM）对
tests/cases_ask.json 每条 question 比对 expected_intent，验证 W6 词表
扩充后既有 50 条无回归。只读数据，不改 cases_ask.json / cases_explain.json。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

spec = importlib.util.spec_from_file_location(
    "_qa15_registry", PILOT_DIR / "agents" / "registry.py"
)
reg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reg)


def main() -> int:
    cases = json.loads(
        (PILOT_DIR / "tests" / "cases_ask.json").read_text(encoding="utf-8")
    )["cases"]
    print(f"=== W6 既有 50 条 ask 用例规则回归 (classify_intent) 共 {len(cases)} 条 ===")
    hit = 0
    misses: list[str] = []
    for c in cases:
        actual = reg.classify_intent(c["question"])
        expected = c["expected_intent"]
        ok = actual == expected
        hit += int(ok)
        if not ok:
            misses.append(f"{c['id']} Q={c['question']} 期望={expected} 实际={actual}")
            print(f"  [{c['id']}] MISS 期望={expected:<13} 实际={actual:<13} Q={c['question']}")
    print(f"[REGRESSION RESULT] 命中 {hit}/{len(cases)}；MISS {len(misses)} 条")
    if misses:
        print("--- MISS 明细 ---")
        for m in misses:
            print("  " + m)
    return 0 if hit == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
