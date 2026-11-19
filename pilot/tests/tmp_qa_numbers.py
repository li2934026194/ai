"""QA 临时脚本：从 eval-raw.json 里判定 A3 答案是否含「工具来源的真实数字」。

【合成演示业务，非真实生产业务】

不产生任何 LLM 调用，只读 run8 刚生成的 docs/eval-raw.json。
判定依据：答案中是否出现 sku_snapshot / run_replenish 回执的特征串（工具原文标记），
而不是「答案里随便有个数字」——SKU-002 / E-1003 / 97% 这类编号或行业常识不算真实取数。

用法：
    .venv\\Scripts\\python.exe -m tests.tmp_qa_numbers
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

RAW = PILOT_DIR / "docs" / "eval-raw.json"

A3_IDS = ["A07", "A13", "A14", "A15", "A20", "A21", "A32", "A33", "A36"]

# 工具回执特征串 -> 来源
MARKERS = [
    (re.compile(r"在手\s*[\d,]+(?:\.\d+)?\s*件"), "sku_snapshot.在手"),
    (re.compile(r"在途\s*[\d,]+(?:\.\d+)?\s*件"), "sku_snapshot.在途"),
    (re.compile(r"销售日记录\s*\d+\s*行"), "sku_snapshot.销售行数"),
    (re.compile(r"库存日记录\s*\d+\s*行"), "sku_snapshot.库存行数"),
    (re.compile(r"dataset_id\s*=\s*ds_"), "sku_snapshot.数据集ID"),
    (re.compile(r"截至\s*20\d{2}-\d{2}-\d{2}"), "sku_snapshot.截止日"),
    (re.compile(r"日均\s*[\d,]+(?:\.\d+)?"), "run_replenish.日均"),
    (re.compile(r"总交期\s*\d+"), "run_replenish.总交期"),
    (re.compile(r"建议(?:补货)?量\s*[:：]?\s*[\d,]+"), "run_replenish.建议量"),
    (re.compile(r"历史断货\s*\d+\s*天"), "run_replenish.断货天数"),
    (re.compile(r"占用资金\s*[\d,]+"), "run_replenish.占用资金"),
    (re.compile(r"合成-断货14天|合成-正在缺货|新品零历史|数据缺30天"), "工具数据集名"),
]

NO_CAPABILITY_RE = re.compile(r"没有.*(?:工具|能力)|无法(?:直接)?(?:查询|读取|给出)|由\s*A[56]|转给\s*A[56]|转交(?:给|到)")


def main() -> int:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in raw["ask_cases"]}
    print("=== [3 精核] A3 答案中的「工具来源真实数字」判定（只读 run8 raw，0 次 LLM） ===")
    print("| id | 问句 | 工具来源标记（命中项） | 是否含真实数字 | 是否出现「无取数能力/转交」 | 答案摘录 |")
    print("|---|---|---|---|---|---|")
    ok = 0
    for cid in A3_IDS:
        r = by_id[cid]
        text = r.get("answer") or ""
        hits = [name for pattern, name in MARKERS if pattern.search(text)]
        refuse = bool(NO_CAPABILITY_RE.search(text))
        has_real = bool(hits)
        ok += 1 if has_real else 0
        # 摘录：优先截第一个命中标记附近
        if hits:
            first_name = hits[0]
            pattern = next(p for p, n in MARKERS if n == first_name)
            m = pattern.search(text)
            left, right = max(0, m.start() - 30), min(len(text), m.end() + 60)
            excerpt = text[left:right].replace("\n", " ").replace("\r", " ")
        else:
            excerpt = text[:100].replace("\n", " ").replace("\r", " ")
        print(f"| {cid} | {r['question']} | {', '.join(hits) if hits else '（无）'}"
              f" | {'是' if has_real else '否'} | {'是' if refuse else '否'} | …{excerpt}… |")
    print(f"[3 精核汇总] 含工具来源真实数字 {ok}/{len(A3_IDS)}")
    print(f"[数据源] {RAW}")
    print(f"[run8 汇总行] {raw['summary']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
