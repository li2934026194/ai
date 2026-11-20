"""QA 临时验收脚本：11 条边界一致性 / A6 真转交 / A3 真实数字。

【合成演示业务，非真实生产业务】

- 全部走 tests.eval_qa.call_agent（= Runner.run_sync(AGENTS["A3_ask"], question)），
  是真实 DeepSeek 调用，不读 eval-raw.json 缓存。
- 用 tests/ 下 tmp_ 前缀，不修改任何既有评测文件 / 用例集 / 判定口径。
- 与 run8 评测分开跑，便于控制单次预算。

用法：
    .venv\\Scripts\\python.exe -m tests.tmp_qa_boundary
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

from sqlalchemy import text  # noqa: E402

from db import engine  # noqa: E402
from tests.eval_qa import call_agent  # noqa: E402  与官方评测完全同一调用路径

CASES = json.loads((PILOT_DIR / "tests" / "cases_ask.json").read_text(encoding="utf-8"))["cases"]
BY_ID = {c["id"]: c for c in CASES}

BOUNDARY_IDS = ["A07", "A13", "A14", "A15", "A20", "A21", "A30", "A33", "A36", "A37", "A46"]
A6_IDS = ["A09", "A10", "A17", "A24", "A31", "A38", "A46"]
A3_IDS = ["A07", "A13", "A14", "A15", "A20", "A21", "A32", "A33", "A36"]
EXTRA_QUESTION = "SKU-009 现在多少在手"

NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


def db_counts() -> tuple[int, int]:
    with engine.connect() as con:
        a = con.execute(text("SELECT COUNT(*) FROM replenish_apply")).scalar()
        p = con.execute(text("SELECT COUNT(*) FROM purchase_order")).scalar()
    return a, p


def number_excerpt(text: str, max_hits: int = 6, width: int = 26) -> str:
    """截取答案里数字及其上下文，原样呈现，不做任何归一化。"""
    hits = list(NUMBER_RE.finditer(text or ""))
    if not hits:
        return "(答案中无数字)"
    parts = []
    for m in hits[:max_hits]:
        left = max(0, m.start() - width)
        right = min(len(text), m.end() + width)
        frag = text[left:right].replace("\n", " ").replace("\r", " ")
        parts.append("…" + frag + "…")
    suffix = f"（共 {len(hits)} 处数字，仅摘录前 {max_hits}）" if len(hits) > max_hits else ""
    return " | ".join(parts) + suffix


def q(cid: str) -> str:
    return BY_ID[cid]["question"]


def exp(cid: str) -> str:
    return BY_ID[cid]["expected_intent"]


def main() -> int:
    before = db_counts()
    print("=== QA 专测开始（真实 LLM 调用，非缓存） ===")
    print(f"[DB-BEFORE] replenish_apply={before[0]} purchase_order={before[1]}")
    total_runs = 0

    # ---------- 1. 11 条边界一致性 ----------
    print("\n=== [1] 11 条边界一致性：每条 5 次真实 Agent，取 last_agent ===")
    print("| id | 问句 | 期望 | 5 次实际 last_agent | 是否 5 次完全一致 | 是否都等于期望 |")
    print("|---|---|---|---|---|---|")
    boundary_rows = []
    for cid in BOUNDARY_IDS:
        lands = []
        for _ in range(5):
            out = call_agent("A3_ask", q(cid))
            lands.append(out["last_agent"] or f"ERROR({out['error']})")
            total_runs += 1
        consistent = len(set(lands)) == 1
        all_expected = set(lands) == {exp(cid)}
        boundary_rows.append((cid, consistent, all_expected))
        print(f"| {cid} | {q(cid)} | {exp(cid)} | {', '.join(str(x) for x in lands)}"
              f" | {'是' if consistent else '否'} | {'是' if all_expected else '否'} |")
    print(f"[1 汇总] 一致 {sum(1 for _, c, _ in boundary_rows if c)}/{len(boundary_rows)}"
          f"；命中期望 {sum(1 for _, _, e in boundary_rows if e)}/{len(boundary_rows)}")

    # ---------- 2. A6 真转交 ----------
    print("\n=== [2] A6 真转交：规则判 A6 的问句，last_agent 必须真是 A6_replenish ===")
    print("| id | 期望 | 实际 last_agent | 是否真转交 | 回答首 80 字 |")
    print("|---|---|---|---|---|")
    a6_ok = 0
    for cid in A6_IDS:
        out = call_agent("A3_ask", q(cid))
        total_runs += 1
        actual = out["last_agent"] or f"ERROR({out['error']})"
        transferred = actual == exp(cid) == "A6_replenish"
        a6_ok += 1 if transferred else 0
        head = (out["text"] or "").replace("\n", " ").replace("\r", " ")[:80]
        print(f"| {cid} | {exp(cid)} | {actual} | {'是' if transferred else '否'} | {head} |")
    print(f"[2 汇总] 真转交 {a6_ok}/{len(A6_IDS)}")

    # ---------- 3. A3 真实数字 ----------
    print("\n=== [3] A3 真实数字：规则判 A3 的问句，答案必须含真实数字 ===")
    print("| id | 问句 | 答案中的真实数字摘录 | 是否含数字 | last_agent |")
    print("|---|---|---|---|---|")
    a3_ok = 0
    for cid in A3_IDS:
        out = call_agent("A3_ask", q(cid))
        total_runs += 1
        text = out["text"] or ""
        has_num = bool(NUMBER_RE.search(text))

        # 拒答/口径类：数字不是正确性要求，单独标注，但要照实展示
        if cid in ("A33", "A36"):
            has_num_label = ("是" if has_num else "否") + "（口径/不存在SKU，不要求数字）"
        else:
            has_num_label = "是" if has_num else "否"
            a3_ok += 1 if has_num else 0
        print(f"| {cid} | {q(cid)} | {number_excerpt(text)} | {has_num_label}"
              f" | {out['last_agent'] or out['error']} |")
    print(f"[3 汇总] 指标类含数字 {a3_ok}/7（A33/A36 为口径/不存在 SKU，单列不计数）")

    # ---------- 3b. 点名验证 ----------
    print("\n=== [3b] 点名验证：SKU-009 现在多少在手 ===")
    out = call_agent("A3_ask", EXTRA_QUESTION)
    total_runs += 1
    print(f"last_agent={out['last_agent']} status={out['status']} error={out['error']}")
    print(f"答案原文：{out['text']}")
    print(f"数字摘录：{number_excerpt(out['text'])}")

    after = db_counts()
    print(f"\n[DB-AFTER] replenish_apply={after[0]} purchase_order={after[1]}"
          f"  {'不变' if after == before else '*** 发生变化 ***'}")
    print(f"[TOTAL] 本脚本真实 Agent 调用 {total_runs} 次")
    return 0


if __name__ == "__main__":
    sys.exit(main())
