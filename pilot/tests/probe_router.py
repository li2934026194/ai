"""PACK 17a 泛化探针：规则表 vs 规则+语义路由。

用法：
    .venv/Scripts/python.exe -m tests.probe_router

输出：
    docs/router-probe.json（逐条落点、命中、两种口径的准确率、以及冻结集是否被扰动）

判法：
- 探针集是新说法，命中率说明泛化能力；
- 冻结集只比「规则判 A3 的条目里，被模型改成 A5/A6 的是否与 expected_intent 一致」，
  若一致 = 模型补的是规则漏的，若不一致 = 模型会打乱既有 50/50，必须回退。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))


def _load_registry():
    """本地 agents/ 与 SDK 同名，按文件路径加载（与 registry 内部做法一致）。"""
    spec = importlib.util.spec_from_file_location(
        "_probe_registry", PILOT_DIR / "agents" / "registry.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


registry = _load_registry()


def load(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8-sig"))["cases"]


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    source = Path(argv[0]) if argv else PILOT_DIR / "tests" / "cases_router_probe.json"
    if not source.is_absolute():
        source = PILOT_DIR / source
    probe = load(source)
    rows = []
    for case in probe:
        rules = registry.classify_intent(case["question"])
        hybrid = registry.route_intent(case["question"])
        rows.append(
            {
                "id": case["id"],
                "question": case["question"],
                "expected": case["expected"],
                "rules": rules,
                "hybrid": hybrid,
                "rules_hit": rules == case["expected"],
                "hybrid_hit": hybrid == case["expected"],
                "why": case.get("why"),
            }
        )

    rules_acc = sum(r["rules_hit"] for r in rows)
    hybrid_acc = sum(r["hybrid_hit"] for r in rows)
    regressions = [r["id"] for r in rows if r["rules_hit"] and not r["hybrid_hit"]]

    frozen = load(PILOT_DIR / "tests" / "cases_ask.json")
    flips = []
    untouched = 0
    for case in frozen:
        rules = registry.classify_intent(case["question"])
        if rules != "A3_ask":
            untouched += 1
            continue
        hybrid = registry.route_intent(case["question"])
        if hybrid == rules:
            untouched += 1
            continue
        flips.append(
            {
                "id": case["id"],
                "question": case["question"],
                "expected_intent": case.get("expected_intent"),
                "rules": rules,
                "hybrid": hybrid,
                "agrees_with_frozen": hybrid == case.get("expected_intent"),
            }
        )

    result = {
        "generated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "probe_total": len(rows),
        "rules_accuracy": f"{rules_acc}/{len(rows)}",
        "hybrid_accuracy": f"{hybrid_acc}/{len(rows)}",
        "regressions_introduced": regressions,
        "frozen_total": len(frozen),
        "frozen_untouched": untouched,
        "frozen_flips": flips,
        "frozen_flips_disagreeing": [f["id"] for f in flips if not f["agrees_with_frozen"]],
        "rows": rows,
    }

    suffix = source.stem.replace("cases_router_", "")
    name = "router-probe.json" if suffix == "probe" else f"router-probe-{suffix}.json"
    out = PILOT_DIR / "docs" / name
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"探针 {len(rows)} 条：纯规则 {rules_acc}/{len(rows)} → 混合 {hybrid_acc}/{len(rows)}")
    print(f"引入回归（规则原本对、混合变错）：{regressions or '无'}")
    print(f"冻结集 {len(frozen)} 条：被模型改动 {len(flips)} 条，其中与 expected_intent 不一致 "
          f"{result['frozen_flips_disagreeing'] or '无'}")
    for f in flips:
        print(f"  [改] {f['id']} 规则 {f['rules']} → 混合 {f['hybrid']}｜expected {f['expected_intent']}"
              f"｜{'一致' if f['agrees_with_frozen'] else '冲突'}")
    missed = [r["id"] for r in rows if not r["hybrid_hit"]]
    if missed:
        print("混合口径未命中：", missed)
    print(f"[OUT] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
