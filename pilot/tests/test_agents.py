"""Agent 层验收（tests/test_agents.py）：5 项真实输出。

运行：cd pilot && .venv/Scripts/python.exe tests/test_agents.py

成本控制：LLM 调用总数 <= 30。本脚本固定调用，无重试循环。
  输出1：A5/A6/A3/A1 各 1 次（A6 内部 as_tool、A3 handoff 的额外子调用计入）
  输出2：A1 发送请求 1 次
  输出3：错误 key 1 次（必然失败，走 E-2001）
  输出4：verify_numbers 纯函数，0 次
  输出5：查库，0 次
"""

from __future__ import annotations

import importlib.util
import sqlite3
import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PILOT_DIR))

# 按文件路径加载本地 agents/registry.py（绕开与 SDK agents 包同名）
_spec = importlib.util.spec_from_file_location("_agent_registry", PILOT_DIR / "agents" / "registry.py")
reg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(reg)

from db import DB_PATH  # noqa: E402

CALL_BUDGET = 30
_calls = 0


def call(name, question, label="chat"):
    global _calls
    _calls += 1
    if _calls > CALL_BUDGET:
        raise RuntimeError(f"LLM 调用超出预算 {CALL_BUDGET}")
    out = reg.run_agent(name, question, label)
    first = (out.get("text") or "").strip().splitlines()
    first = first[0] if first else "(空)"
    print(f"  [{name}] status={out['status']} latency={out['latency_ms']}ms tokens={out['tokens']}")
    print(f"  首句: {first[:160]}")
    return out, first


def main():
    print("=" * 72)
    print("输出1｜四个 Agent 各调一次，贴首句")
    print("=" * 72)
    results = {}
    results["A5"], _ = call("A5_forecast", "SKU-001 哪个预测模型最好？WAPE 多少？", "forecast_backtest")
    results["A6"], _ = call("A6_replenish", "SKU-001 建议补多少件？占用多少资金？", "run_replenish")
    results["A3"], _ = call("A3_ask", "SKU-001 需要补货吗，补多少？数据来自哪张表几行？", "route")
    results["A1"], _ = call("A1_support", "你好，能帮我查一下订单吗？", "chat")

    print()
    print("=" * 72)
    print("输出2｜A1 被要求直接发送 -> 只出草稿 + 需确认；查 agent_runs 无发送动作")
    print("=" * 72)
    _, a1_first = call("A1_support", "帮我直接回复买家，确认明天发货", "draft_reply")
    print(f"  A1 首句: {a1_first[:200]}")
    con = sqlite3.connect(str(DB_PATH))
    send_tools = [r for r in con.execute(
        "SELECT agent,tool FROM agent_runs WHERE tool LIKE '%send%' OR tool LIKE '%发送%' OR tool LIKE '%email%'"
    )]
    whitelist = sorted(t.name if hasattr(t, 'name') else str(t) for t in reg.tools.A1_TOOLS)
    print(f"  A1 工具白名单 = {whitelist}")
    print(f"  agent_runs 中发送类动作 = {send_tools}  (应为空)")
    print(f"  白名单无发送类 = {all('send' not in w.lower() and '发送' not in w for w in whitelist)}")
    con.close()

    print()
    print("=" * 72)
    print("输出3｜错误 key -> E-2001，不卡死不抛栈")
    print("=" * 72)
    from agents import set_default_openai_client
    from openai import AsyncOpenAI
    cfg = {}
    for line in (PILOT_DIR / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip()
    wrong_key = cfg["DEEPSEEK_API_KEY"][:-1] + ("0" if cfg["DEEPSEEK_API_KEY"][-1] != "0" else "1")
    set_default_openai_client(AsyncOpenAI(api_key=wrong_key, base_url=cfg["DEEPSEEK_BASE_URL"]))
    bad, bad_first = call("A5_forecast", "SKU-001 哪个模型最好？", "chat")
    print(f"  返回原文: {bad['text']}")
    print(f"  == E-2001 文案: {bad['text'].strip() == reg.E2001_TEXT}")
    print(f"  未抛异常: {bad['status'] == 'fallback'}  error={bad.get('error','')[:120]}")
    # 恢复正确 client，避免影响输出5
    set_default_openai_client(AsyncOpenAI(api_key=cfg["DEEPSEEK_API_KEY"], base_url=cfg["DEEPSEEK_BASE_URL"]))

    print()
    print("=" * 72)
    print("输出4｜verify_numbers 错数字（实际 510 说成 240）-> False + 不一致项")
    print("=" * 72)
    ok1, bad1 = reg.explain.verify_numbers("建议补货 240 件", {"建议量": (510, "count")})
    print(f"  verify_numbers('...240...', 期望510) -> {ok1}")
    print(f"  不一致项: {bad1}")
    ok2, bad2 = reg.explain.verify_numbers("约 5.76万元，1,200 件", {"金额": (57600, "amount"), "件数": (1200, "count")})
    print(f"  归一化校验('约5.76万元,1,200件') -> {ok2}, 不一致={bad2}")

    print()
    print("=" * 72)
    print("输出5｜agent_runs 最近记录的 agent / 耗时 / token")
    print("=" * 72)
    con = sqlite3.connect(str(DB_PATH))
    rows = con.execute(
        "SELECT agent, tool, status, latency_ms, tokens FROM agent_runs ORDER BY created_at DESC, rowid DESC LIMIT 15"
    ).fetchall()
    print(f"  {'agent':<14} {'tool':<20} {'status':<9} {'latency_ms':>10} {'tokens':>7}")
    for r in rows:
        print(f"  {r[0]:<14} {r[1]:<20} {r[2]:<9} {str(r[3]):>10} {str(r[4]):>7}")
    total = con.execute("SELECT COUNT(*) FROM agent_runs").fetchone()[0]
    con.close()
    print(f"  agent_runs 累计记录 = {total}")

    print()
    print("=" * 72)
    print(f"LLM 调用总数 = {_calls} / 预算 {CALL_BUDGET}  (未超 = {_calls <= CALL_BUDGET})")
    print("=" * 72)


if __name__ == "__main__":
    main()
