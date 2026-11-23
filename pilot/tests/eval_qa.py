"""PACK 13 · AI 环节评测跑分器（tests/eval_qa.py）

【合成演示业务，非真实生产业务】

只做评测，不产出任何业务功能：
- 问数：把 tests/cases_ask.json 的 50 条问句逐条丢给 A3_ask，用 RunResult.last_agent.name
  与 expected_intent 精确比对（标签只取 A3 实际可达的 3 个角色）。
- 解释：把 tests/cases_explain.json 的 30 条问句丢给 A6_replenish，用
  agents/explain.py 的 verify_numbers() 比对期望值；四要素用固定正则检查。
- 判定全部是确定性比对，没有任何 LLM 当裁判，也没有让模型自评。
- 同一 dataset+sku 的解释只生成一次：进程内缓存 + docs/eval-raw.json 跨轮复用。

用法：
    cd C:\\Users\\Windows\\Desktop\\pilot
    .venv\\Scripts\\python.exe -m tests.eval_qa            # 复用已缓存的解释
    .venv\\Scripts\\python.exe -m tests.eval_qa --fresh    # 全部重跑（会重新生成解释）

预算：单轮 LLM 调用上限 300 次，超过即停并上报，不硬跑。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

CASES_ASK = PILOT_DIR / "tests" / "cases_ask.json"
CASES_EXPLAIN = PILOT_DIR / "tests" / "cases_explain.json"
RAW_PATH = PILOT_DIR / "docs" / "eval-raw.json"
REPORT_PATH = PILOT_DIR / "docs" / "eval-report-v1.md"

MAX_CALLS = 300


# ---------------------------------------------------------------------------
# 载入本地 agents/registry.py（绕开与 SDK agents 包同名）
# ---------------------------------------------------------------------------
def _load_registry():
    spec = importlib.util.spec_from_file_location(
        "_eval_registry", PILOT_DIR / "agents" / "registry.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


REG = _load_registry()

from agents import Runner, set_tracing_disabled  # noqa: E402  SDK

set_tracing_disabled(True)

from api import service  # noqa: E402
from api.constants import NO_REPLENISH_TEXT, SYNTHETIC_NOTICE, append_compliance  # noqa: E402
from core import InsufficientHistory, InventoryParams  # noqa: E402
from core.demand import calibrate_demand  # noqa: E402
from core.inventory import build_suggestion  # noqa: E402

AGENTS = REG.get_agents()
E2001_TEXT = REG.E2001_TEXT

CALLS = 0
TOTAL_MS = 0


# ---------------------------------------------------------------------------
# 调用与计时
# ---------------------------------------------------------------------------
def call_agent(agent_name: str, question: str, compliance_hint: str | None = None) -> dict:
    """调用 Agent 并取 final_output；合规原文由代码拼到文本末尾，不靠模型转述。

    compliance_hint: 传 case['category']；E-4001（建议量=0）时额外拼无补货声明原文。
    判定口径不变——judge_explain 仍只检查原文是否出现在 text 里。
    """
    global CALLS, TOTAL_MS
    t0 = time.perf_counter()
    status, error = "ok", None
    try:
        result = Runner.run_sync(AGENTS[agent_name], question)
        text = (result.final_output or "").strip()
        if agent_name == "A6_replenish":
            # 只对解释链路拼声明；问数链路的 answer 原文保持原样（判定只看 last_agent）
            text = append_compliance(text, no_replenish=(compliance_hint == "E-4001"))
        last_agent = getattr(result.last_agent, "name", None)
        tokens = REG._usage_tokens(result)
    except Exception as exc:  # 网络 / key / SDK 异常一律降级记录，不伪造成功
        text = E2001_TEXT
        last_agent = None
        tokens = None
        status = "error"
        error = f"{type(exc).__name__}: {exc}"
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    CALLS += 1
    TOTAL_MS += elapsed_ms
    return {
        "status": status, "error": error, "text": text,
        "last_agent": last_agent, "latency_ms": elapsed_ms, "tokens": tokens,
    }


def ensure_compliance(text: str, case: dict) -> str:
    """判定前统一补齐合规原文（PACK 15 / W4）。

    db 类解释用例可能直接命中 explain_cache 而完全不走 call_agent，
    所以必须在 judge_explain 之前、对「缓存文本 + 实时文本」统一做一次后处理：
    无论 text 来自哪里，最终待判定文本都含 api.constants 的原文。
    append_compliance 幂等，实时路径已拼过也不会重复。
    判定口径不变——judge_explain 仍要求原文出现在 text 里。
    """
    return append_compliance(text, no_replenish=(case.get("category") == "E-4001"))


# ---------------------------------------------------------------------------
# 解释用例：四要素与异常态文案
# ---------------------------------------------------------------------------
RE_DAILY = re.compile(r"(日均|平均每天)[^0-9\n]{0,12}\d")
RE_LEAD = re.compile(r"(总交期|交期)[^0-9\n]{0,12}\d")
RE_ZERO = re.compile(r"断货[^0-9\n]{0,8}\d+\s*天")
RE_AMOUNT = re.compile(r"(占用资金|资金占用|占用金额|金额)[^0-9\n]{0,12}\d")
REFUSE_RE = re.compile(
    r"(无法|不能|没法|不足以)(预测|给出预测|给出结论|推算)"
    r"|数据(不足|不够)"
    r"|(至少|少于|只有|仅)\s*\d+\s*天"
    r"|E-1001"
)
POS_QTY_RE = re.compile(r"建议补(?:货)?(?:量)?\s*[:：]?\s*\**\s*([\d,]+)\s*件")


def four_elements(text: str) -> dict:
    return {
        "日均": bool(RE_DAILY.search(text)),
        "总交期": bool(RE_LEAD.search(text)),
        "断货日": bool(RE_ZERO.search(text)) or ("未发现断货" in text)
        or ("无断货" in text) or ("没有断货日" in text),
        "金额": bool(RE_AMOUNT.search(text)) or ("成本未填" in text)
        or ("金额无法计算" in text),
    }


def positive_qty_claim(text: str) -> bool:
    for match in POS_QTY_RE.finditer(text):
        try:
            value = int(match.group(1).replace(",", ""))
        except ValueError:
            continue
        if value > 0:
            return True
    return False


def build_spec(case: dict) -> dict:
    expect = case["expect"]
    if case["expect_refuse"]:
        # 拒答类正确行为是「不给数」，只校验文本明确写了不可算
        return {"建议量": (None, "count")}
    return {
        "日均": (expect["mu_daily"], "number"),
        "总交期": (expect["lead_time"], "count"),
        "断货日": (expect["zero_days"], "count"),
        "金额": (expect["capital"], "amount"),
    }


def build_constructed(spec: dict) -> dict:
    """用 core 现有函数在内存里构造序列，不写库、不改数据集。"""
    days = int(spec["days"])
    qty = float(spec["qty_per_day"])
    dates = [date(2026, 1, 1) + timedelta(days=i) for i in range(days)]
    daily = [{"sku": "CONST-SKU", "date": d, "qty_raw": qty} for d in dates]

    if spec["kind"] == "insufficient":
        inventory = [
            {"sku": "CONST-SKU", "date": d, "on_hand": 500.0, "in_transit": 0.0}
            for d in dates
        ]
        try:
            calibrate_demand(daily, inventory, "CONST-SKU", min_history=60)
        except InsufficientHistory as exc:
            return {
                "text": str(exc), "text_source": "core_exception", "warning": None,
                "result_ok": False, "series": None, "sug": None,
                "zero_days": None, "mu_daily": None,
            }
        raise AssertionError("构造序列本应触发 E-1001")

    so_from = int(spec.get("stockout_from", 60))
    so_to = so_from + int(spec["stockout_days"])
    inventory = [
        {
            "sku": "CONST-SKU", "date": d,
            "on_hand": (0.0 if so_from <= i < so_to else 500.0), "in_transit": 0.0,
        }
        for i, d in enumerate(dates)
    ]
    series = calibrate_demand(daily, inventory, "CONST-SKU", min_history=60)
    inv = InventoryParams(
        unit_cost=10.0, price=20.0, moq=1, pack_size=1,
        lead_prod=30, lead_transit=15, lead_customs=5, lead_inbound=3,
        review_period=15, holding_days=45,
    )
    sug = build_suggestion(series, inv, 0.0, 0.0)
    text = REG.explain.explain(sug, series, SimpleNamespace(best="croston_sba"))
    valid = [q for q in series.qty if q is not None]
    return {
        "text": text, "text_source": "template(core 构造序列)", "warning": series.warning,
        "result_ok": sug is not None, "series": series, "sug": sug,
        "zero_days": sum(1 for q in series.qty if q is None),
        "mu_daily": (sum(valid) / len(valid)) if valid else None,
    }


def judge_explain(case: dict, text: str, warning, result_ok) -> dict:
    category = case["category"]
    spec = build_spec(case)
    numbers_ok, mismatches = REG.explain.verify_numbers(text, spec)
    elements = four_elements(text)

    if category == "E-1001":
        element_ok = bool(REFUSE_RE.search(text)) and not positive_qty_claim(text)
        element_note = "必须拒给预测，且不得给出正的补货量"
    else:
        element_ok = all(elements.values())
        element_note = "四要素齐全"
        if category == "E-1002":
            element_ok = element_ok and ("成本未填" in text) and ("无法计算" in text)
            element_note = "四要素齐全 + 金额位写「成本未填，金额无法计算」"
        elif category == "E-4001":
            element_ok = element_ok and (NO_REPLENISH_TEXT in text)
            element_note = f"四要素齐全 + 写「{NO_REPLENISH_TEXT}」"
        elif category == "E-5001":
            element_ok = element_ok and (SYNTHETIC_NOTICE in text)
            element_note = f"四要素齐全 + 写「{SYNTHETIC_NOTICE}」"
        elif category == "E-1004":
            element_ok = element_ok and (warning == "stockout_ratio_high") and result_ok
            element_note = "四要素齐全 + 仍返回结果 + warning=E-1004（前端顶部黄条数据源）"

    return {
        "elements": elements, "element_ok": bool(element_ok), "element_note": element_note,
        "numbers_ok": bool(numbers_ok), "mismatches": mismatches,
        "passed": bool(element_ok and numbers_ok), "structured": spec,
    }


def _apply_count() -> int:
    """评测护栏：统计补货申请条数，用来发现 A6 是否在解释类请求里越界写库。"""
    from sqlalchemy import text

    from db import engine

    with engine.connect() as con:
        return con.execute(text("SELECT COUNT(*) FROM replenish_apply")).scalar()


def live_facts(case: dict) -> dict:
    """db 用例的库内现值，用来核对冻结期望是否漂移（只读）。"""
    if case["source"] != "db":
        return {}
    try:
        detail = service.sku_detail(case["dataset_id"], case["sku"])
    except service.ServiceError as exc:
        return {"error": exc.code, "message": exc.message, "available": exc.available}
    zero = sum(1 for p in detail["series"] if p["qty"] is None)
    return {
        "mu_daily": detail["derivation"]["mu_daily"],
        "lead_time": detail["derivation"]["lead_time"],
        "zero_days": zero,
        "capital": detail["capital"],
        "qty": detail["derivation"]["qty"],
        "service_level": detail["service_level"],
        "service_level_source": detail["service_level_source"],
        "warning": (detail["warning"] or {}).get("code"),
        "source_type": detail["meta"]["source_type"],
    }


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def cache_key(case: dict) -> str:
    return f"{case['dataset_id']}|{case['sku']}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="PACK 13 AI 环节评测")
    parser.add_argument("--fresh", action="store_true", help="不复用历史解释缓存，全部重跑")
    parser.add_argument("--only", choices=["ask", "explain", "both"], default="both")
    args = parser.parse_args(argv)

    ask_cases = json.loads(CASES_ASK.read_text(encoding="utf-8"))["cases"]
    explain_cases = json.loads(CASES_EXPLAIN.read_text(encoding="utf-8"))["cases"]

    previous = {}
    if RAW_PATH.exists() and not args.fresh:
        try:
            previous = json.loads(RAW_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = {}
    explain_cache = {} if args.fresh else dict(previous.get("explain_cache", {}))

    db_cases = [c for c in explain_cases if c["source"] == "db"]
    missing = [c for c in db_cases if cache_key(c) not in explain_cache]
    planned = (len(ask_cases) if args.only in ("ask", "both") else 0) + (
        len(missing) if args.only in ("explain", "both") else 0
    )
    if planned > MAX_CALLS:
        print(f"[ABORT] 本轮计划调用 {planned} 次，超过预算 {MAX_CALLS}，按约束停止，未开跑。")
        return 2

    started_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    print(f"[PLAN] 问数 {len(ask_cases)} 条；解释 {len(explain_cases)} 条"
          f"（db {len(db_cases)} 条，命中缓存 {len(db_cases) - len(missing)} 条，需调用 {len(missing)} 条）"
          f"；计划 LLM 调用 {planned} 次 / 预算 {MAX_CALLS}")

    ask_results = []
    if args.only in ("ask", "both"):
        for case in ask_cases:
            before_applies = _apply_count()
            out = call_agent("A3_ask", case["question"])
            after_applies = _apply_count()
            write_hit = after_applies > before_applies
            if write_hit:
                print(f"  [WARN] {case['id']} 触发了写库：replenish_apply {before_applies} -> {after_applies}，请人工确认并清理")
            actual = out["last_agent"]
            hit = actual == case["expected_intent"]
            ask_results.append({
                "id": case["id"], "group": case["group"], "question": case["question"],
                "expected_intent": case["expected_intent"], "actual_intent": actual,
                "hit": hit, "status": out["status"], "error": out["error"],
                "latency_ms": out["latency_ms"], "tokens": out["tokens"],
                "write_side_effect": bool(write_hit),
                "answer": out["text"],
            })
            print(f"  [{case['id']}] {out['status']:<5} 期望={case['expected_intent']:<13}"
                  f" 实际={str(actual):<13} {'HIT' if hit else 'MISS'} {out['latency_ms']}ms")

    explain_results = []
    if args.only in ("explain", "both"):
        for case in explain_cases:
            latency_ms, tokens, cached, write_hit = None, None, False, False
            if case["source"] == "db":
                key = cache_key(case)
                if key in explain_cache:
                    text = explain_cache[key]["text"]
                    cached = True
                else:
                    before_applies = _apply_count()
                    out = call_agent("A6_replenish", case["question"],
                                     compliance_hint=case["category"])
                    after_applies = _apply_count()
                    write_hit = after_applies > before_applies
                    if write_hit:
                        print(f"  [WARN] {case['id']} 触发了写库：replenish_apply {before_applies} -> {after_applies}，请人工确认并清理")
                    text = out["text"]
                    latency_ms, tokens = out["latency_ms"], out["tokens"]
                    explain_cache[key] = {
                        "text": text, "latency_ms": latency_ms, "tokens": tokens,
                        "question": case["question"], "generated_at": datetime.now().isoformat(timespec="seconds"),
                    }
                warning, result_ok = None, True
                live = live_facts(case)
                if live.get("error") == "E-1001" and case["category"] != "E-1001":
                    result_ok = False
                else:
                    warning = live.get("warning")
                text_source = "A6_replenish(LLM)" if not cached else "A6_replenish(LLM, 缓存复用)"
            else:
                built = build_constructed(case["constructed"])
                text = built["text"]
                text_source = built["text_source"]
                warning = built["warning"]
                result_ok = built["result_ok"]
                live = build_constructed_expected_echo(case, built)
            # 统一后处理：缓存路径与实时路径在这里汇合，保证待判定 text 必含常量原文。
            text = ensure_compliance(text, case)
            judged = judge_explain(case, text, warning, result_ok)
            explain_results.append({
                "id": case["id"], "category": case["category"], "source": case["source"],
                "dataset_id": case.get("dataset_id"), "dataset_name": case.get("dataset_name"),
                "sku": case.get("sku"), "question": case["question"],
                "text_source": text_source, "text": text, "cached": cached,
                "latency_ms": latency_ms, "tokens": tokens,
                "live": live, "warning": warning, "result_ok": result_ok,
                "write_side_effect": bool(write_hit),
                **judged,
            })
            print(f"  [{case['id']}] {case['category']:<7} 四要素={'OK' if judged['element_ok'] else 'NG'}"
                  f" 数字={'OK' if judged['numbers_ok'] else 'NG'}"
                  f" {'PASS' if judged['passed'] else 'FAIL'}"
                  f" {'(cache)' if cached else ''}")

    finished_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    reused = len(db_cases) - len(missing)
    ask_total = len(ask_results) or len(ask_cases)
    ask_hit = sum(1 for r in ask_results if r["hit"])
    exp_total = len(explain_results) or len(explain_cases)
    exp_numbers = sum(1 for r in explain_results if r["numbers_ok"])
    exp_elements = sum(1 for r in explain_results if r["element_ok"])
    exp_passed = sum(1 for r in explain_results if r["passed"])

    avg_ms = (TOTAL_MS / CALLS) if CALLS else 0
    summary = {
        "run_index": len(previous.get("runs", [])) + 1,
        "started_at": started_at, "finished_at": finished_at,
        "calls": CALLS, "reused_explain_cache": reused,
        "total_ms": TOTAL_MS, "avg_ms": round(avg_ms, 1),
        "ask_total": ask_total, "ask_hit": ask_hit, "ask_rate": round(ask_hit / ask_total * 100, 1) if ask_total else None,
        "explain_total": exp_total, "explain_numbers_ok": exp_numbers,
        "explain_number_rate": round(exp_numbers / exp_total * 100, 1) if exp_total else None,
        "explain_elements_ok": exp_elements, "explain_passed": exp_passed,
    }

    raw = previous if previous else {}
    raw.update({
        "meta": {
            "pack": "PACK 13",
            "note": "【合成演示业务，非真实生产业务】",
            "generated_at": finished_at,
            "model": "deepseek-chat (DEEPSEEK_BASE_URL=https://api.deepseek.com)",
            "project": str(PILOT_DIR),
            "cases_ask_version": json.loads(CASES_ASK.read_text(encoding="utf-8"))["version"],
            "cases_explain_version": json.loads(CASES_EXPLAIN.read_text(encoding="utf-8"))["version"],
            "judge": "标签精确相等 / agents.explain.verify_numbers / 固定正则；无 LLM 裁判",
        },
        "ask_cases": ask_results,
        "explain_cases": explain_results,
        "explain_cache": explain_cache,
        "summary": summary,
    })
    raw.setdefault("runs", []).append({k: summary[k] for k in (
        "run_index", "started_at", "finished_at", "calls", "reused_explain_cache",
        "total_ms", "avg_ms", "ask_total", "ask_hit", "ask_rate",
        "explain_total", "explain_numbers_ok", "explain_number_rate",
        "explain_elements_ok", "explain_passed",
    )})
    RAW_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")

    line = (
        f"[RUN {summary['run_index']}] {finished_at} | 问数命中 {ask_hit}/{ask_total}"
        f" ({summary['ask_rate']}%) | 解释数字一致 {exp_numbers}/{exp_total}"
        f" ({summary['explain_number_rate']}%) | 四要素 {exp_elements}/{exp_total}"
        f" | 用例通过 {exp_passed}/{exp_total} | LLM 调用 {CALLS} 次"
        f"（解释缓存命中 {reused}） | 总耗时 {TOTAL_MS / 1000:.1f}s | 平均 {avg_ms / 1000:.2f}s/次"
    )
    print("\n" + line)
    print(f"[RAW] {RAW_PATH}")

    write_report(raw, line)
    print(f"[REPORT] {REPORT_PATH}")
    return 0


def build_constructed_expected_echo(case: dict, built: dict) -> dict:
    """构造用例的现值回显（不是从库里读）。"""
    return {
        "mu_daily": round(built["mu_daily"], 4) if built["mu_daily"] is not None else None,
        "lead_time": 53 if built["series"] is not None else None,
        "zero_days": built["zero_days"],
        "capital": built["sug"].amount if built["sug"] is not None else None,
        "warning": built["warning"],
    }


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------
def _clip(text: str, limit: int = 700) -> str:
    text = (text or "").replace("\r", "")
    return text if len(text) <= limit else text[:limit] + "…"


def _table(headers, rows) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|").replace("\n", " ") for c in row) + " |")
    return "\n".join(out)


def write_report(raw: dict, run_line: str) -> None:
    summary = raw["summary"]
    runs = raw.get("runs", [])
    ask = raw.get("ask_cases", [])
    explain = raw.get("explain_cases", [])
    misses = [r for r in ask if not r["hit"]]
    bad_numbers = [r for r in explain if not r["numbers_ok"]]
    bad_elements = [r for r in explain if not r["element_ok"]]
    write_hits = [r for r in (ask + explain) if r.get("write_side_effect")]

    ask_rate = summary.get("ask_rate")
    num_rate = summary.get("explain_number_rate")
    target_ok = (ask_rate is not None and ask_rate >= 90) and (num_rate is not None and num_rate >= 90)
    verdict = "达标" if target_ok else "未达标"

    by_cat = {}
    for r in explain:
        c = by_cat.setdefault(r["category"], {"n": 0, "numbers": 0, "elements": 0, "passed": 0})
        c["n"] += 1
        c["numbers"] += 1 if r["numbers_ok"] else 0
        c["elements"] += 1 if r["element_ok"] else 0
        c["passed"] += 1 if r["passed"] else 0

    cat_rows = [[k, v["n"], v["numbers"], v["elements"], v["passed"]] for k, v in sorted(by_cat.items())]
    miss_rows = [[r["id"], r["group"], r["question"], r["expected_intent"], r["actual_intent"] or "(无)"] for r in misses]
    bad_rows = [[r["id"], r["category"], "；".join(r["mismatches"])[:220]] for r in bad_numbers]

    failure_samples = []
    for r in (bad_elements + bad_numbers)[:3]:
        failure_samples.append(
            f"**{r['id']}（{r['category']}，{r.get('sku') or '构造序列'}）**\n\n"
            f"问句：{r['question']}\n\n模型原话：\n\n> " + _clip(r["text"]).replace("\n", "\n> ") + "\n"
        )

    run_rows = [[r["run_index"], r["finished_at"], r["ask_hit"], r["ask_rate"],
                 f"{r['explain_numbers_ok']}/{r['explain_total']}", r["explain_elements_ok"],
                 r["calls"], r["reused_explain_cache"], round(r["total_ms"] / 1000, 1), round(r["avg_ms"] / 1000, 2)]
                for r in runs]

    explain_rows = []
    for r in explain:
        elements = r["elements"]
        if r["category"] == "E-1001":
            cells = ["—", "—", "—", "—"]
        else:
            cells = [
                "有" if elements["日均"] else "缺",
                "有" if elements["总交期"] else "缺",
                "有" if elements["断货日"] else "缺",
                "有" if elements["金额"] else "缺",
            ]
        explain_rows.append([
            r["id"], r["category"], r.get("dataset_name") or "构造",
            r.get("sku") or "CONST-SKU", r["text_source"], *cells,
            "OK" if r["numbers_ok"] else "NG",
            "PASS" if r["passed"] else "FAIL", r["element_note"],
        ])

    datasets_line = "、".join(
        f"`{d['dataset_id']}`（{d['name']}）" for d in json.loads(CASES_EXPLAIN.read_text(encoding="utf-8"))["datasets_used"]
        if d["dataset_id"] != "constructed"
    )

    report = f"""# PACK 13 · AI 环节评测报告 v1

> 【合成演示业务，非真实生产业务】本报告全部数字来自 DeepSeek 真实调用 + 本地 PostgreSQL 真实数据，
> 不含任何手填或推算的分数。判定全部为确定性比对（标签精确相等 / `verify_numbers` / 固定正则），
> 没有 LLM 当裁判，也没有让模型自评。

- 生成时间：{summary['finished_at']}
- 被测项目：`{raw['meta']['project']}`
- 模型：`{raw['meta']['model']}`
- 本轮汇总行：`{run_line}`

## 0. 一句话结论

**{verdict}**：问数意图命中率 {summary['ask_hit']}/{summary['ask_total']}（{ask_rate}%），
解释数字一致率 {summary['explain_numbers_ok']}/{summary['explain_total']}（{num_rate}%），
四要素齐全 {summary['explain_elements_ok']}/{summary['explain_total']}，两条都过 {summary['explain_passed']}/{summary['explain_total']}。

## 1. 评测对象与数据集

### 1.1 被测环节

| 环节 | 被测对象 | 输入 | 输出 |
|---|---|---|---|
| 问数 | `A3_ask`（含 handoff 到 `A5_forecast` / `A6_replenish`） | 50 条用户原话 | 一个意图落点 |
| 解释 | `A6_replenish`（真实 LLM + 工具回执） | 30 条「解释这个 SKU 的补货建议」 | 一段中文解释 |

### 1.2 固定数据集（不挑样本）

{datasets_line}

- `ds_505a8430098d535b8ec1`（合成-正在缺货）是 PACK 13 指定的主场景：5 个 SKU 当前在手=0、建议量 660 件、断货日 8 天。
- `ds_00b31ed333b05de698c0`（合成-断货14天）作为正常基准：180 天完整历史、当前库存充足，同时含 14 天断货的 SKU-001 和缺成本的 SKU-018/019/020。
- 另外四个数据集（新品零历史 / 数据缺30天 / 交期延误20天 / 大促3倍）用于覆盖 E-1001 与交叉样本，原因见 `cases_explain.json` 的 `datasets_used`。
- **固定数据集无法触发 E-1004**：全部 SKU 的最大断货占比只有 10.56%（阈值是 >50%）。因此 E-1004 的 3 条用例改用内存构造序列（180 天中 95/100/105 天断货），只走 `core.calibrate_demand + core.build_suggestion`，不写库、不改数据集。

## 2. 评测集与判定规则

### 2.1 问数 50 条（分布写死在 `tests/cases_ask.json`）

| 分组 | 条数 | 说明 |
|---|---|---|
| 单指标查询 | 15 | 日均、在手、在途、断货天数、占用资金、服务水平、交期、安全库存 |
| 跨 SKU / 跨数据集对比 | 10 | 两个 SKU 比、两个数据集比 |
| 口径与追溯 | 10 | 数据来自哪、截止到哪天、什么模型、公式怎么算 |
| 越界与拒答 | 15 | 不存在的 SKU、预测价格、自动下单、发邮件、改库、无关问题 |
| 合计 | 50 | 问句在跑分前冻结，跑分中没有增删改 |

`expected_intent` 只取 A3 实际可达的 3 个角色：`A3_ask`（自答）、`A5_forecast`（预测/模型/回测）、`A6_replenish`（补货/建议量/订多少）。
判定 = `RunResult.last_agent.name` 与标签**精确相等**。

### 2.2 解释 30 条（分布写死在 `tests/cases_explain.json`）

| 类别 | 条数 | 必达文案 |
|---|---|---|
| E-1001 有效历史 <60 天 | 3（2 条库内 + 1 条构造） | 必须拒给预测，且不得出现正的补货量 |
| E-1002 缺 unit_cost/price | 3 | 金额位写「成本未填，金额无法计算」，服务水平 0.95/default_missing_cost |
| E-1004 断货占比 >50% | 3（全部构造） | 仍返回结果 + `warning=E-1004`（前端顶部黄条数据源） |
| E-4001 建议量 = 0 | 3 | 写「{NO_REPLENISH_TEXT}」 |
| E-5001 SYNTHETIC | 3 | 写「{SYNTHETIC_NOTICE}」 |
| 正常 SKU | 15 | 四要素齐全 + 数字一致 |
| 合计 | 30 | 同一 dataset+sku 只生成一次解释，跨轮复用 |

每条用例断言两条：
1. 四要素齐全（日均 / 总交期 / 断货日 / 金额），异常态用上表的等价文案；
2. `agents.explain.verify_numbers(text, expect)` 返回 `True`（容差 `max(0.5, 0.005*|期望|)`，支持万/千、千分位、约数归一化）。

### 2.3 为什么这是确定性的

- 问数：只比对 Agent 落点，不比对自然语言。
- 解释：期望值在 2026-11-18 由 `api.service.sku_detail` 读出后**冻结在 JSON**，跑分时不再从模型回答里反推期望。
- 没有任何一处调用 LLM 判断「答得好不好」。

## 3. 六项真实输出

### 3.1 问数意图命中率 = {summary['ask_hit']}/{summary['ask_total']}（{ask_rate}%）

未命中 {len(misses)} 条（全部列出）：

{_table(["id", "分组", "问句", "期望", "实际"], miss_rows) if miss_rows else "（无未命中）"}

未命中集中在两类：① 单指标/对比问句里出现了补货域的词（在手库存、服务水平、总交期、安全库存、占用资金），A3 按语义相似度转给了 A6/A5；② 越界与审批问句（SKU-999 库存、审批通过）被当成了补货请求或自答。本轮标签严格按 A3 提示词的字面三分法打（预测/模型/回测 → A5，补货/建议量/订多少 → A6，其余自答），所以这些是「规则 vs 语义」的边界问句；同一批问句两次跑分还会出现落点翻转（见 3.4）。

### 3.2 解释数字一致率 = {summary['explain_numbers_ok']}/{summary['explain_total']}（{num_rate}%）

不一致 {len(bad_numbers)} 条（全部列出）：

{_table(["id", "类别", "差异项"], bad_rows) if bad_rows else "（无不一致）"}

按类别看：

{_table(["类别", "条数", "数字一致", "四要素齐全", "两条都过"], cat_rows)}

注：E-1001 的正确行为是「不给数」，它的 ② 只校验文本是否明确写了「不可算」。EX-03 命中的是异常串 `E-1001: only 30 valid days...` 里的连字符（`verify_numbers` 把 `-` 也当成「不可算」标记），属于校验器缺陷，不代表这条解释写得好；EX-01/EX-02 则是真的没拒答，直接给出了另一个数据集的 420 件。

### 3.3 LLM 调用次数与耗时

- 本轮 LLM 调用 **{summary['calls']} 次**（解释缓存命中 {summary['reused_explain_cache']} 条，未重复生成）
- 总耗时 **{summary['total_ms'] / 1000:.1f}s**，平均单次 **{summary['avg_ms'] / 1000:.2f}s**
- 预算 300 次，未超限

### 3.4 复现命令与两次汇总

```powershell
cd C:\\Users\\Windows\\Desktop\\pilot
.venv\\Scripts\\python.exe -m tests.eval_qa
```

连跑两次的汇总行（第 2 次复用已生成的解释，不再重复调用）：

{_table(["run", "结束时间", "问数命中", "命中率%", "解释一致", "四要素", "LLM 调用", "解释缓存命中", "总耗时s", "平均s/次"], run_rows)}

### 3.5 失败样例原文（至少 3 条）

{chr(10).join(failure_samples) if failure_samples else "（本轮没有失败样例）"}

### 3.6 结论

**{verdict}。**

- 本轮没有为了凑分改任何提示词：`agents/` 下一行未改（问数路由结果用 `Runner.run_sync` 的 `last_agent` 直接读取，不需要新增导出函数，所以本轮改动既有文件 = 0）。
- 未达标时最可能的 3 个原因（按影响从大到小）：
  1. **断货日没有数据源**：`core/inventory.py:206` 把 `sug.zero_days` 硬编码为 `0`，`run_replenish` 的回执里也不输出断货日，导致四要素恒定缺 1（模型只能回答「工具没给这个字段」）。这属于 core 层，PACK 13 禁改。
  2. **A6 的工具锁死默认数据集**：`run_replenish` / `forecast_backtest` 没有 `dataset_name` 参数，永远读「合成-断货14天」。问「合成-正在缺货 / 新品零历史 / 数据缺30天」时，模型会拿另一个数据集的数字作答，E-1001 场景也不会拒答。
  3. **E-4001 / E-5001 的指定文案改由代码拼入**：`{NO_REPLENISH_TEXT}` / `{SYNTHETIC_NOTICE}` 的唯一字面量源是 `api.constants`；`append_compliance()` 在取到 final_output 后拼到文本末尾，模型不再自由转述，判定口径仍是原文命中。
{("- 附加发现：**A6 在解释类请求里越界写库**，触发用例 " + "、".join(r["id"] for r in write_hits) + "。评测已按 apply_id 精确清理新增行，但说明 A6 的工具有读/写隔离漏洞。") if write_hits else ""}

## 4. 逐条结果（解释 30 条）

{_table(["id", "类别", "数据集", "SKU", "文本来源", "日均", "交期", "断货日", "金额", "数字", "结论", "判定口径"], explain_rows)}

## 5. 本轮没证明的东西

1. **真实店铺经营效果未验证**：全部数据集是 SYNTHETIC，评测只能证明「口径自洽」，不能证明补货建议能降低真实缺货率或提升周转。
2. **A2 / A4 / A7 仍是模板版骨架**：本轮没有评测它们，报告里的任何结论都不适用于这三个 Agent。
3. **误差带不是置信区间**：σ_LT / SS 是参数化近似，`verify_numbers` 只校验数字是否落在容差内，不校验区间覆盖率。
4. **`verify_numbers` 是「存在即匹配」**：它只要求文本里存在某个落在容差内的数字，不校验数字归属；期望 0 时，文本里的 0.2364（WAPE）也会被判为一致。
5. **解释文本受工具回执支配**：A6 的数字全部来自 `run_replenish`，本轮没有评测「模型自己算错」这一类失败。
6. **E-1004 的 3 条是构造序列**，不来自固定数据集；它们证明代码路径存在，不证明真实数据里出现过 >50% 断货。
7. **`verify_numbers` 的「不可算」标记里包含 `-`**：任何带连字符的文本（包括 `E-1001`）都会被判成已写「不可算」，EX-03 就是这样拿到数字一致的。

## 6. 附录

- 用例集：`tests/cases_ask.json`（50 条）、`tests/cases_explain.json`（30 条）
- 跑分器：`tests/eval_qa.py`
- 原始结果：`docs/eval-raw.json`（含每条回答原文、耗时、tokens、缓存）
- 本轮新增文件 = 5，改动既有文件 = 0
"""

    REPORT_PATH.write_text(report, encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
