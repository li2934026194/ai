"""PACK 21a：数字全文 diff。

目的：此前评测只校验“抽取字段里的那 3–4 个数字”，回答正文里多写一个错数字（比如
把 19.55 写成 25.19、把 360 件写成 420 件）不会被发现。这里改为：
把回答里出现的每一个数字，逐个对照“同数据集同 SKU 的 detail 实际返回的全部数字”，
允许四舍五入变体，但不允许凭空多出来的数。

用法：
    python -m tests.check_numbers
输出：逐条列出越界数字；有任何一条即退出码 1。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api import service  # noqa: E402
from db import get_session  # noqa: E402

RAW = PILOT_DIR / "docs" / "eval-raw.json"

# 回答里常见、但与业务数字无关的数：年份、天/小时等阈值固定由 detail 或错误文案提供。
_YEAR = {"2025", "2026"}

# 标识符里的数字（数据集 id、SKU 编号、错误码、日期）先整体抠掉，避免误报。
_DROP_PATTERNS = (
    r"ds_[0-9a-f]+",
    r"SKU-\d+",
    r"E-\d{4}",
    r"\d{4}-\d{2}-\d{2}",
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",
)
_NUM = re.compile(r"(?<![A-Za-z0-9_.])(\d[\d,]*(?:\.\d+)?)")


def _variants(value: float) -> set[str]:
    """一个真实数字的可接受文本形态（含四舍五入与千分位）。"""
    out: set[str] = set()
    for v in (value, round(value, 1), round(value, 2), round(value, 3)):
        text = f"{v:.6f}".rstrip("0").rstrip(".")
        out.add(text)
        out.add(f"{v:,}".rstrip("0").rstrip("."))
        out.add(f"{v:,.2f}".rstrip("0").rstrip("."))
    integer = int(round(value))
    out.add(str(integer))
    out.add(f"{integer:,}")
    out.add(f"{integer:.1f}")
    if 0 < value <= 1.01:  # 比例也可能写成百分数
        pct = value * 100
        out.add(f"{pct:.0f}")
        out.add(f"{pct:.2f}".rstrip("0").rstrip("."))
        out.add(f"{pct:.1f}".rstrip("0").rstrip("."))
    return out


def _collect_numbers(obj: Any, out: list[float]) -> None:
    if isinstance(obj, dict):
        for value in obj.values():
            _collect_numbers(value, out)
    elif isinstance(obj, (list, tuple)):
        for value in obj:
            _collect_numbers(value, out)
    elif isinstance(obj, bool):
        return
    elif isinstance(obj, (int, float)):
        out.append(float(obj))


def _pool_from_detail(detail: dict, dataset_name: str = "") -> set[str]:
    numbers: list[float] = []
    _collect_numbers(detail, numbers)
    pool: set[str] = set()
    for value in numbers:
        pool |= _variants(abs(value))
    # 数据集名字里的数字（如「合成-断货14天」）会在回答里被反复提到，属于名称不是业务数字。
    for token in _NUM.findall(dataset_name or ""):
        pool.add(token.replace(",", ""))
    # 固定业务常量：0 件、1 天；资金按 45 天持有期测算（holding_days 默认值）。
    pool |= {"0", "1", "45", "100"}
    return pool


def _pool_from_message(message: str, dataset_name: str = "") -> set[str]:
    numbers = [float(t.replace(",", "")) for t in _NUM.findall(message)]
    pool: set[str] = set()
    for value in numbers:
        pool |= _variants(value)
    for token in _NUM.findall(dataset_name or ""):
        pool.add(token.replace(",", ""))
    return pool | {"0", "1", "45", "60", "100"}


def _answer_numbers(answer: str) -> list[str]:
    text = answer
    for pattern in _DROP_PATTERNS:
        text = re.sub(pattern, " ", text)
    return _NUM.findall(text)


def _normalize(token: str) -> str:
    return token.replace(",", "")


_NAME_NUMBERS: set[str] | None = None


def _all_dataset_name_numbers() -> set[str]:
    global _NAME_NUMBERS
    if _NAME_NUMBERS is None:
        with get_session() as session:
            from schema import Datasets
            from sqlalchemy import select

            names = session.execute(select(Datasets.name)).scalars().all()
        _NAME_NUMBERS = {t.replace(",", "") for n in names for t in _NUM.findall(n or "")}
    return _NAME_NUMBERS


def check_case(case: dict) -> list[tuple[str, str]]:
    """返回 [(越界数字, 上下文)]；空列表表示全过。"""
    answer = case.get("text") or case.get("answer") or ""
    dataset_id = case.get("dataset_id")
    sku = case.get("sku")
    if not dataset_id or not sku:
        return []

    with get_session() as session:
        try:
            detail = service._sku_detail(session, dataset_id, sku)
            pool = _pool_from_detail(detail, str(case.get("dataset_name") or ""))
        except service.ServiceError as exc:
            pool = _pool_from_message(str(exc), str(case.get("dataset_name") or ""))

    pool |= _all_dataset_name_numbers()
    violations: list[tuple[str, str]] = []
    for token in _answer_numbers(answer):
        norm = _normalize(token)
        if not norm or norm in _YEAR:
            continue
        try:
            value = float(norm)
        except ValueError:
            continue
        if value < 10:  # 小于 10 的孤立数字多是“三步”“四要素”这类文本，不纳入
            continue
        if norm in pool:
            continue
        # 允许四舍五入后的文本再宽松一档（例如 19.5462 → 19.55）
        if any(_normalize(p) in pool for p in {f"{value:.2f}", f"{value:.1f}", f"{value:.0f}"}):
            continue
        if f"{value:,}" in pool:
            continue
        context = answer[max(0, answer.find(token) - 18): answer.find(token) + len(token) + 18].replace("\n", " ")
        violations.append((token, context))
    return violations


def main() -> int:
    if not RAW.exists():
        print(f"缺少 {RAW}，先跑 python -m tests.eval_qa")
        return 2
    data = json.loads(RAW.read_text(encoding="utf-8"))
    cases = data.get("explain_cases") or []
    if not cases:
        print("eval-raw.json 里没有 explain_cases")
        return 2

    bad = 0
    for case in cases:
        violations = check_case(case)
        if violations:
            bad += 1
            print(f"[{case.get('id')}] {case.get('category')} {case.get('dataset_name')} / {case.get('sku')}")
            for token, context in violations:
                print(f"    × {token}  …{context}…")
    print(f"\n全文数字对照：{len(cases)} 条中 {len(cases) - bad} 条通过，{bad} 条出现无法由 detail 解释的数字")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
