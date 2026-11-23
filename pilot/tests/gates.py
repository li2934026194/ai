"""五闸脚本（PACK 18）：每包收尾跑一遍，任一条红即不许宣布完成。

G01 红线哈希（diff 代理）：评测集、回测核心、工具层、履约状态机不得被悄悄改动
G02 契约闸门：18 个端点必须在册；SKU 详情字段 + evidence 证据块齐全
G03 双壳闸门：同一 SKU 走 API 与 Agent 工具，建议量与占用资金必须一致
G04 库闸门：表计数、采购单列数、状态 CHECK 约束
G05 口径闸门（全量测试代理）：pytest tests 必须全绿

跑法：.venv\\Scripts\\python.exe -m tests.gates
"""

from __future__ import annotations

import hashlib
import importlib.util
import re
import subprocess
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from api.main import app  # noqa: E402
from api import service  # noqa: E402
from db import SessionLocal  # noqa: E402

DATASET = "ds_00b31ed333b05de698c0"
DATASET_NAME = "合成-断货14天"
DUAL_SKUS = ("SKU-002", "SKU-005", "SKU-017")

# 2026-11-19 / PACK 19 收尾时登记；改这些文件必须同时改这里并写理由
RED_LINES = {
    "tests/cases_ask.json": "E2EF2A5EAB693844FCA83857C1457D42996B60E2E6B23DC7DE1181630C237D1D",
    "tests/cases_explain.json": "C240F6EF22F120F3FE4E5F5E895D43D8B0EC217897AE2478C97EB7E1BC033026",
    "core/backtest.py": "985BBDD92057051A37A8CAB3B33FAD9CF96CEE5ACB6A4F22A21EDAECF238A422",
    "agents/tools.py": "F2950CFD348698510EE553251EE2BE831292CF95342C2D746D95F62399E87DEB",
    "core/replenish_flow.py": "543B3F566DCC8D64BEA2610AFCE48DEF459158722A35B1055690E221E8A976A0",
}

EXPECTED_PATHS = {
    "/api/health",
    "/api/datasets",
    "/api/datasets/import",
    "/api/ops/summary",
    "/api/p1/dashboard",
    "/api/p2/skus",
    "/api/p3/sku/{sku}",
    "/api/copy",
    "/api/p3/route-plan",
    "/api/p3/apply",
    "/api/p3/apply/approve",
    "/api/p3/apply/reject",
    "/api/p3/po/ship",
    "/api/p3/po/receive",
    "/api/p3/po/cancel",
    "/api/p3/applies",
    "/api/p3/supplier-quotes",
    "/api/agents/support",
}


def g01_red_lines() -> list[str]:
    bad = []
    for rel, expect in RED_LINES.items():
        got = hashlib.sha256((PILOT_DIR / rel).read_bytes()).hexdigest().upper()
        if got != expect:
            bad.append(f"{rel}: 期望 {expect[:12]}… 实际 {got[:12]}…")
    return bad


def g02_pytest() -> list[str]:
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "tests", "-q"],
        cwd=str(PILOT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=600,
    )
    tail = (proc.stdout or "").strip().splitlines()[-3:]
    print("    " + " / ".join(tail))
    # PowerShell 下的 tracing 噪声在 stderr，不影响退出码
    return [] if proc.returncode == 0 else [f"pytest 退出码 {proc.returncode}"]


def g03_db() -> list[str]:
    bad = []
    with SessionLocal() as s:
        counts = {
            "replenish_apply": s.execute(text("select count(*) from replenish_apply")).scalar(),
            "purchase_order": s.execute(text("select count(*) from purchase_order")).scalar(),
        }
        cols = s.execute(
            text(
                "select column_name from information_schema.columns"
                " where table_name='purchase_order'"
            )
        ).fetchall()
        names = {c[0] for c in cols}
        checks = s.execute(
            text(
                "select conname from pg_constraint"
                " where conrelid='purchase_order'::regclass and contype='c'"
            )
        ).fetchall()
    if counts["replenish_apply"] != 3:
        bad.append(f"replenish_apply 行数 {counts['replenish_apply']}（基线 3）")
    if counts["purchase_order"] != 1:
        bad.append(f"purchase_order 行数 {counts['purchase_order']}（基线 1）")
    if len(names) != 13:
        bad.append(f"purchase_order 列数 {len(names)}（基线 13）")
    for col in ("cancel_user", "cancel_reason", "cancel_at"):
        if col not in names:
            bad.append(f"缺列 {col}")
    if not checks:
        bad.append("purchase_order 缺 CHECK 约束")
    print(f"    行数 {counts}，列数 {len(names)}")
    return bad


def g04_contract() -> list[str]:
    bad = []
    paths = {getattr(r, "path", "") for r in app.routes}
    missing = EXPECTED_PATHS - paths
    extra = {p for p in paths if p.startswith("/api/")} - EXPECTED_PATHS
    if missing:
        bad.append(f"缺端点 {sorted(missing)}")
    if extra:
        bad.append(f"未登记端点 {sorted(extra)}")
    with TestClient(app) as client:
        body = client.get(f"/api/p3/sku/SKU-017?dataset_id={DATASET}").json()
    for key in ("meta", "sku", "best_model", "series", "per_model", "derivation", "capital", "evidence"):
        if key not in body:
            bad.append(f"SkuDetail 缺字段 {key}")
    ev = body.get("evidence") or {}
    for key in (
        "engine_version",
        "dataset_id",
        "dataset_name",
        "sku",
        "as_of",
        "source_type",
        "method",
        "best_model",
        "sigma_source",
        "sigma_residual_points",
        "route_code",
        "objective_mode",
        "lead_time_basis",
        "generated_at",
    ):
        if key not in ev:
            bad.append(f"evidence 缺字段 {key}")
    print(f"    端点数 {len(EXPECTED_PATHS & paths)}/18")
    return bad


def _load_tools():
    spec = importlib.util.spec_from_file_location(
        "_pilot_tools_gate", PILOT_DIR / "agents" / "tools.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _agent_numbers(text_out: str) -> tuple[int, float]:
    if "本轮无需补货" in text_out:
        qty = 0
    else:
        m = re.search(r"建议(?:补|量)[：:]?\s*([\d,]+)\s*件", text_out)
        qty = int(m.group(1).replace(",", "")) if m else -1
    m2 = re.search(r"占用资金\s*([\d,]+)\s*元", text_out)
    capital = float(m2.group(1).replace(",", "")) if m2 else -1.0
    return qty, capital


def g05_dual_shell() -> list[str]:
    bad = []
    tools = _load_tools()
    with SessionLocal() as s:
        for sku in DUAL_SKUS:
            d = service._sku_detail(s, DATASET, sku)
            api_qty = int(d["derivation"]["qty"])
            api_cap = float(d["capital"] or 0)
            out = tools._run_replenish_impl(sku, dataset_name=DATASET_NAME)
            tool_qty, tool_cap = _agent_numbers(out)
            if api_qty != tool_qty or abs(api_cap - tool_cap) > 1e-6:
                bad.append(
                    f"{sku}: API {api_qty}/{api_cap:.0f} vs Agent {tool_qty}/{tool_cap:.0f}"
                )
            else:
                print(f"    {sku}: {api_qty} 件 / {api_cap:.0f} 元 两壳一致")
    return bad


GATES = (
    ("G01 红线哈希（diff 代理）", g01_red_lines),
    ("G02 契约闸门", g04_contract),
    ("G03 双壳闸门", g05_dual_shell),
    ("G04 库闸门", g03_db),
    ("G05 口径闸门（全量测试代理）", g02_pytest),
)


def main() -> int:
    failed = 0
    records = []
    for name, fn in GATES:
        print(f"[{name}]")
        try:
            problems = fn()
        except Exception as exc:  # noqa: BLE001 — 闸门自身异常也算失败
            problems = [f"闸门异常：{type(exc).__name__}: {exc}"]
        records.append({"name": name, "ok": not problems, "problems": problems})
        if problems:
            failed += 1
            print("  FAIL")
            for p in problems:
                print("   -", p)
        else:
            print("  PASS")
    print(f"\n结果：{len(GATES) - failed}/{len(GATES)} 通过")
    snapshot = {
        "ran_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "passed": len(GATES) - failed,
        "total": len(GATES),
        "items": records,
    }
    (PILOT_DIR / "docs" / "gates-latest.json").write_text(
        __import__("json").dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
