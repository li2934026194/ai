"""QA round2 定向复测：A13/A15 真实数字 + A07/A46 路由回归 + A09 真转交回归。

【合成演示业务，非真实生产业务】

真实 DeepSeek 调用（tests.eval_qa.call_agent = Runner.run_sync），不读 eval-raw 缓存。
严格判定口径与 round1 的 tests/tmp_qa_numbers.py 完全一致：
只有「工具回执来源数字」才算真实数字，SKU 编号 / 数据集名数字 / 行业常识不算。

用法：
    .venv\\Scripts\\python.exe -u -m tests.tmp_qa_round2
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
from tests.eval_qa import call_agent  # noqa: E402

CASES = json.loads((PILOT_DIR / "tests" / "cases_ask.json").read_text(encoding="utf-8"))["cases"]
BY_ID = {c["id"]: c for c in CASES}

# 与 tmp_qa_numbers.py 完全相同的工具回执特征串
MARKERS = [
    (re.compile(r"在手\s*[\d,]+(?:\.\d+)?\s*件"), "sku_snapshot.在手"),
    (re.compile(r"在途\s*[\d,]+(?:\.\d+)?\s*件"), "sku_snapshot.在途"),
    (re.compile(r"销售日记录\s*\d+\s*行"), "sku_snapshot.销售行数"),
    (re.compile(r"库存日记录\s*\d+\s*行"), "sku_snapshot.库存行数"),
    (re.compile(r"dataset_id\s*=\s*ds_"), "sku_snapshot.数据集ID"),
    (re.compile(r"截至\s*20\d{2}-\d{2}-\d{2}"), "sku_snapshot.截止日"),
    (re.compile(r"日均\s*[\d,]+(?:\.\d+)?"), "run_replenish.日均"),
    (re.compile(r"总交期\s*\d+"), "run_replenish.总交期"),
    (re.compile(r"服务水平\s*[\d.]+%"), "run_replenish.服务水平"),
    (re.compile(r"(?:σ_LT|sigma_lt)\s*[=:：]?\s*[\d.]+"), "run_replenish.σ_LT"),
    (re.compile(r"(?:SS|安全库存)\s*[=:：]?\s*[\d.]+"), "run_replenish.SS"),
    (re.compile(r"建议(?:补货)?量\s*[:：]?\s*[\d,]+"), "run_replenish.建议量"),
    (re.compile(r"历史断货\s*\d+\s*天"), "run_replenish.断货天数"),
    (re.compile(r"占用资金\s*[\d,]+"), "run_replenish.占用资金"),
]

# 工程师补丁明令禁止的三类说法
FORBIDDEN_RE = re.compile(
    r"当前只读工具没有返回该字段"
    r"|工具(?:里|没有|不提供)[^。\n]{0,20}(?:没有|不提供|无)[^。\n]{0,12}字段"
    r"|没有取数能力"
    r"|没有(?:直接)?(?:查询|读取)[^。\n]{0,12}工具"
    r"|我先不给出具体数字[^。\n]{0,12}以免编造"
)

NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


def db_counts() -> tuple[int, int]:
    with engine.connect() as con:
        a = con.execute(text("SELECT COUNT(*) FROM replenish_apply")).scalar()
        p = con.execute(text("SELECT COUNT(*) FROM purchase_order")).scalar()
    return a, p


def excerpts(text: str, max_hits: int = 4, width: int = 24) -> str:
    hits = list(NUMBER_RE.finditer(text or ""))
    if not hits:
        return "(无数字)"
    parts = []
    for m in hits[:max_hits]:
        left = max(0, m.start() - width)
        right = min(len(text), m.end() + width)
        parts.append("…" + text[left:right].replace("\n", " ").replace("\r", " ") + "…")
    more = f"（共{len(hits)}处，摘录前{max_hits}）" if len(hits) > max_hits else ""
    return " | ".join(parts) + more


def main() -> int:
    before = db_counts()
    audits: list[dict] = []
    runs = 0
    print("=== ROUND2 定向复测开始（真实 LLM，非缓存） ===")
    print(f"[DB-BEFORE] replenish_apply={before[0]} purchase_order={before[1]}")

    # ---------- 1. A13 / A15 各 5 次真实数字判定 ----------
    print("\n=== [R2-1] A13/A15 各 5 次：工具来源数字严格判定 ===")
    print("| id | 次 | last_agent | 工具来源数字标记 | 是否含真实数字 | 命中禁用说法 | 答案数字摘录 |")
    print("|---|---|---|---|---|---|---|")
    for cid in ("A13", "A15"):
        q = BY_ID[cid]["question"]
        passed = 0
        for i in range(1, 6):
            out = call_agent("A3_ask", q)
            runs += 1
            text = out["text"] or ""
            hits = [name for pat, name in MARKERS if pat.search(text)]
            forbidden = FORBIDDEN_RE.findall(text)
            ok = bool(hits) and not forbidden
            passed += 1 if ok else 0
            print(f"| {cid} | {i} | {out['last_agent'] or out['error']} | {', '.join(hits) if hits else '（无）'}"
                  f" | {'是' if hits else '否'} | {forbidden if forbidden else '无'} | {excerpts(text)} |")
            audits.append({"id": cid, "run": i, "question": q, "last_agent": out["last_agent"],
                           "status": out["status"], "markers": hits,
                           "forbidden": forbidden, "ok": ok, "answer": text})
        print(f"[R2-1 {cid}] 达标 {passed}/5")

    # ---------- 2. A07 / A46 各 3 次路由回归 ----------
    print("\n=== [R2-2] A07/A46 各 3 次路由一致性回归 ===")
    print("| id | 期望 | 3 次 last_agent | 是否全一致且命中 |")
    print("|---|---|---|---|")
    for cid in ("A07", "A46"):
        lands = []
        for _ in range(3):
            out = call_agent("A3_ask", BY_ID[cid]["question"])
            runs += 1
            lands.append(out["last_agent"] or f"ERROR({out['error']})")
        ok = set(lands) == {BY_ID[cid]["expected_intent"]}
        print(f"| {cid} | {BY_ID[cid]['expected_intent']} | {', '.join(lands)} | {'是' if ok else '否'} |")

    # ---------- 3. A09 3 次真转交回归 ----------
    print("\n=== [R2-3] A09 3 次真转交回归 ===")
    print("| id | 期望 | 3 次 last_agent | 是否 3 次真转交 | 回答首 80 字 |")
    print("|---|---|---|---|---|")
    lands = []
    heads = []
    for _ in range(3):
        out = call_agent("A3_ask", BY_ID["A09"]["question"])
        runs += 1
        lands.append(out["last_agent"] or f"ERROR({out['error']})")
        heads.append((out["text"] or "").replace("\n", " ").replace("\r", " ")[:80])
    ok = set(lands) == {"A6_replenish"}
    for i, (land, head) in enumerate(zip(lands, heads), 1):
        print(f"| A09-{i} | A6_replenish | {land} | {'是' if land == 'A6_replenish' else '否'} | {head} |")
    print(f"[R2-3 A09] 3 次真转交 = {'是' if ok else '否'}")

    after = db_counts()
    print(f"\n[DB-AFTER] replenish_apply={after[0]} purchase_order={after[1]}"
          f"  {'不变' if after == before else '*** 发生变化 ***'}")
    print(f"[TOTAL] round2 真实 Agent 调用 {runs} 次")

    audit_path = PILOT_DIR / "tests" / "tmp_qa_round2_audit.json"
    audit_path.write_text(json.dumps(audits, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[AUDIT] {audit_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
