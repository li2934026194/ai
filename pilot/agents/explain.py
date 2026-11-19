"""解释生成与数字一致性校验（agents/explain.py，17 号契约 3.6）。

verify_numbers:
    tol = max(0.5, 0.005 * |expected|)   （架构师终裁）
    比较前归一化数字文本：去「约/大约/近」、5.76万→57600、1,200→1200
    分三类校验：金额 / 计数 / 百分数
    最多重写 2 次，仍失败退模板 —— 重写次数由调用方控制，本函数只做单次比对
"""

from __future__ import annotations

import re

# E-2001 文案（一字不改，17 号第四节）
E2001_TEXT = "AI 服务暂时不可用，已切换到模板版。"


def _normalize_number_text(text: str) -> str:
    """归一化：去模糊词、万/千进位、去千分位逗号。"""
    out = text
    for word in ("大约", "约", "近", "差不多"):
        out = out.replace(word, "")

    def _wan_qian(match: re.Match) -> str:
        num = float(match.group(1))
        unit = match.group(2)
        factor = 10000 if unit == "万" else 1000
        return str(int(num * factor)) if num * factor == int(num * factor) else str(num * factor)

    out = re.sub(r"(\d+(?:\.\d+)?)\s*([万千])", _wan_qian, out)
    out = out.replace(",", "")
    return out


def _all_numbers(text: str) -> list[float]:
    normalized = _normalize_number_text(text)
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", normalized)]


def _tol(expected: float) -> float:
    return max(0.5, 0.005 * abs(expected))


def verify_numbers(text: str, structured: dict) -> tuple[bool, list[str]]:
    """比对 text 中的数字与 structured 的期望值是否一致。

    structured: 每项为 (期望值, 类别) 或纯期望值。类别 ∈ {amount, count, percent, number}。
    返回 (是否全部一致, 不一致项说明列表)。
    比对用「文本里是否存在某个数字落在期望的容差内」——避免一段话里多个数字错位匹配。
    """
    nums = _all_numbers(text)
    mismatches: list[str] = []

    for key, spec in structured.items():
        if isinstance(spec, tuple):
            expected_raw, category = spec[0], spec[1]
        else:
            expected_raw, category = spec, "number"

        if expected_raw is None:
            # 期望为「不可算」：文本里应当出现 — / 无法计算 / 未填 之类，不比对数值
            if not any(mark in text for mark in ("—", "-", "无法计算", "未填", "不可算")):
                mismatches.append(f"{key}: 期望不可算，但文本给出了数字 {nums}")
            continue

        try:
            expected = float(expected_raw)
        except (TypeError, ValueError):
            mismatches.append(f"{key}: 期望值无法解析为数字 {expected_raw!r}")
            continue

        tolerance = _tol(expected)
        # 百分数类别：文本可能写 0.97 或 97%，两者等价
        candidates = list(nums)
        if category == "percent" and 0 < abs(expected) <= 1:
            candidates += [n / 100.0 for n in nums]

        matched = any(abs(n - expected) <= tolerance for n in candidates)
        if not matched:
            shown = ", ".join(f"{n:g}" for n in nums) if nums else "(无数字)"
            mismatches.append(
                f"{key}: 期望 {expected:g}（容差±{tolerance:g}），文本数字 [{shown}]"
            )

    return (len(mismatches) == 0, mismatches)


def explain(sug, series, bt) -> str:
    """中文 3–5 句，必须含：日均 / 总交期 / 断货日 / 金额。
    缺成本 → 金额位写「成本未填，金额无法计算」。
    纯模板生成，不调用 LLM（模板版降级也用这条）。"""
    lead = (
        getattr(sug, "lead_time", None)
        or getattr(sug, "total_lead", None)
        or 53
    )
    daily = getattr(sug, "mu_daily", None)
    if daily is None:
        qty = getattr(series, "qty", []) or []
        valid = [q for q in qty if q is not None]
        daily = (sum(valid) / len(valid)) if valid else None

    zero_days = int(getattr(sug, "zero_days", 0) or 0)
    # PACK 15 / W5：断货日句同时给「断货 N 天」（四要素正则需要的格式）和首个断货日期。
    # 日期来自 core 建议对象的 stockout_date；没有日期时用「断货 0 天」兜底，正则仍可命中。
    stockout_date = getattr(sug, "stockout_date", None)
    date_txt = (
        stockout_date.isoformat() if hasattr(stockout_date, "isoformat")
        else (str(stockout_date).strip() if stockout_date else "")
    )
    if date_txt:
        days_txt = f"历史断货 {zero_days} 天（首个断货日 {date_txt}），已剔除后再拟合"
    else:
        days_txt = f"历史断货 {zero_days} 天（历史无断货日），已剔除后再拟合"
    best = getattr(bt, "best", None)
    best_txt = f"回测选出 {best}" if best else "回测未选出可用模型"

    if getattr(sug, "amount", None) is None:
        amount_txt = "成本未填，金额无法计算"
    else:
        amount_txt = f"占用资金约 {sug.amount:,.0f} 元"

    daily_txt = f"日均约 {daily:.2f} 件" if daily is not None else "日均不可算"
    parts = [
        f"该 SKU {daily_txt}，总交期 {lead} 天。",
        days_txt + "，" + best_txt + "。",
        f"建议补 {sug.qty} 件，{amount_txt}。",
    ]
    return "".join(parts)


__all__ = ["E2001_TEXT", "verify_numbers", "explain"]
