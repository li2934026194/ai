"""Agent 注册表与统一调用入口（agents/registry.py，17 号契约 3.6）。

本轮只做 4 个：A5_forecast / A6_replenish / A3_ask / A1_support；
A2_console / A4_sourcing / A7_content 只建模板版骨架（可调用、标注模板版）。

编排铁律：
  - 用户提问路由到角色  -> handoffs（A3）
  - 角色之间取数        -> A5.as_tool("run_forecast")（A6），不用 handoffs
  - A1 永不自动发送     -> 白名单只有 query_order/query_logistics/draft_reply（结构约束）

统一入口 run_agent()：
  - 每次调用落 agent_runs（agent / 耗时ms / token / 成功或降级 / 输出摘要）
  - Key 无效 / 超时 / 断网 -> 返回 E-2001 文案，不抛异常打死整页

SDK 与本地 agents/ 同名：本模块先用文件路径加载本地 explain/tools，
所有 SDK import 都从顶层 agents 包走（sys.path 里 pilot 根在末尾， SDK 优先）。
"""

from __future__ import annotations

import importlib.util
import time
import uuid
from datetime import datetime
from pathlib import Path

# ---- SDK（顶层 agents 包）；必须在把 PILOT 插到 sys.path[0] 之前解析 -------
from agents import Agent, Runner, set_default_openai_api, set_default_openai_client
from openai import AsyncOpenAI

# ---- 本地 agents/ 模块按文件路径加载，绕开与 SDK 的同名冲突 ----------------
_AGENT_DIR = Path(__file__).resolve().parent
PILOT_DIR = _AGENT_DIR.parent


def _load_local(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, _AGENT_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    if str(PILOT_DIR) not in __import__("sys").path:
        __import__("sys").path.insert(0, str(PILOT_DIR))  # 让 core/db 可 import
    spec.loader.exec_module(module)
    return module


explain = _load_local("_agent_explain", "explain.py")
tools = _load_local("_agent_tools", "tools.py")

E2001_TEXT = explain.E2001_TEXT


# ---- LLM client（DeepSeek，OpenAI 兼容）-----------------------------------
def _read_env() -> dict[str, str]:
    cfg: dict[str, str] = {}
    env_path = PILOT_DIR / ".env"
    if not env_path.exists():
        return cfg
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip()
    return cfg


_cfg = _read_env()
_api_key = _cfg.get("DEEPSEEK_API_KEY", "").strip()
_base_url = _cfg.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
_model = _cfg.get("DEEPSEEK_MODEL", "deepseek-chat").strip()

if _api_key and not _api_key.startswith("<"):
    _client = AsyncOpenAI(api_key=_api_key, base_url=_base_url)
    set_default_openai_client(_client)
set_default_openai_api("chat_completions")


# ---- trace 落库 -------------------------------------------------------------
# 每次「Agent 调用」由 run_agent 落一条完整记录（agent/耗时/token/状态/摘要）。
# 工具内部子调用不再单独落库，避免产生 latency/token 为 None 的重复脏行。
# （tools._log 保留但默认 sink 为空，单独测工具时可自行注入。）


def _insert_run(agent, tool, status, latency_ms, tokens, summary, error=None):
    from db import get_session
    from schema import AgentRuns

    with get_session() as session:
        session.add(
            AgentRuns(
                run_id=uuid.uuid4().hex,
                agent=agent,
                tool=tool or "chat",
                status=status,
                latency_ms=latency_ms,
                tokens=tokens,
                error=(error or "")[:500] or None,
                created_at=datetime.now(),
            )
        )
        session.commit()


# ---- build_agents -----------------------------------------------------------
def build_agents() -> dict[str, Agent]:
    a1 = Agent(
        name="A1_support",
        instructions=(
            "你是客服助手。只能查询订单/物流、用 search_knowledge 检索客服知识库、生成回复草稿。"
            "严禁发送任何消息——你没有发送工具，也不要声称已发送。"
            "用户要求直接回复/发送时，说明只能出草稿、需人工确认后发送。"
            "回答商品/物流/关税/退换货等政策问题前，先用 search_knowledge 检索知识库，"
            "只依据检索命中的问答作答，并注明引用了哪条知识（问题原文）。"
            "知识库内容全部是 SYNTHETIC 演示知识，回答时必须说明这是演示知识、非真实客服数据。"
            "若检索返回 retrieval_ok=false，如实告知暂时查不到资料，绝不编造。"
        ),
        model=_model,
        tools=list(tools.A1_TOOLS),
    )

    a5 = Agent(
        name="A5_forecast",
        instructions="你是销量预测助手。用 forecast_backtest 工具取回测结果，"
        "回答哪个模型最好、WAPE 多少。只用工具给出的数字，不要编造。",
        model=_model,
        tools=[tools.forecast_backtest],
    )

    a6 = Agent(
        name="A6_replenish",
        instructions="你是补货助手。先用 run_forecast 取预测结论，"
        "再用 run_replenish 取建议量与金额，综合给出补货建议。数字只用工具返回的。"
        "用户问运输方式/多路线对比或保销量、保利润、保现金方案时，可调用 route_compare 取四条路线与三目标方案的真实计算结果；"
        "其运输参数均为合成假设参数，回答时必须说明不是真实物流报价，不得编造收益。",
        model=_model,
        tools=[
            a5.as_tool(tool_name="run_forecast", tool_description="取该 SKU 的预测回测结论（最佳模型与 WAPE）"),
            tools.run_replenish,
            tools.route_compare,
        ],
    )

    a3 = Agent(
        name="A3_ask",
        instructions="你是问数路由助手。判断用户问题：涉及预测/模型/回测交给 A5_forecast，"
        "涉及补货/建议量/订多少交给 A6_replenish，其余自己简要回答。"
        "转交后给出结论时，注明数据来源表（sales_daily/inventory_daily/demand_daily）与行数口径。",
        model=_model,
        handoffs=[a5, a6],
    )

    # A2/A4/A7 模板版骨架：可调用、明确标注模板版，不接 LLM 真编排
    def _skeleton(name, desc):
        return Agent(
            name=name,
            instructions=f"【模板版骨架】{desc}。本轮未实现，如实告知用户这是模板版。",
            model=_model,
            tools=[],
        )

    return {
        "A1_support": a1,
        "A2_console": _skeleton("A2_console", "驾驶舱设计器"),
        "A3_ask": a3,
        "A4_sourcing": _skeleton("A4_sourcing", "选品助手"),
        "A5_forecast": a5,
        "A6_replenish": a6,
        "A7_content": _skeleton("A7_content", "内容创作助手"),
    }


_AGENTS = None


def get_agents() -> dict[str, Agent]:
    global _AGENTS
    if _AGENTS is None:
        _AGENTS = build_agents()
    return _AGENTS


def _usage_tokens(result) -> int | None:
    usage = getattr(result, "usage", None)
    if usage is None:
        raw = getattr(result, "raw_responses", None) or []
        if raw:
            usage = getattr(raw[-1], "usage", None)
    return getattr(usage, "total_tokens", None) if usage is not None else None


def run_agent(name: str, question: str, tool_label: str = "chat") -> dict:
    """统一入口：调用 -> 落库 -> 成功返回原文 / 失败返回 E-2001（不抛异常）。"""
    agents = get_agents()
    if name not in agents:
        return {"text": f"未知 Agent：{name}", "status": "error", "latency_ms": None, "tokens": None}

    t0 = time.perf_counter()
    try:
        if not _api_key or _api_key.startswith("<"):
            raise RuntimeError("LLM key missing")
        result = Runner.run_sync(agents[name], question)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        text = result.final_output or ""
        tokens = _usage_tokens(result)
        summary = text.replace("\n", " ")[:200]
        _insert_run(name, tool_label, "success", elapsed_ms, tokens, summary)
        return {"text": text, "status": "success", "latency_ms": elapsed_ms, "tokens": tokens}
    except Exception as exc:  # Key 错 / 超时 / 断网 / SDK 异常，一律降级不抛栈
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        err_msg = f"{type(exc).__name__}: {exc}"
        _insert_run(name, tool_label, "fallback", elapsed_ms, None, E2001_TEXT, error=err_msg)
        return {
            "text": E2001_TEXT,
            "status": "fallback",
            "latency_ms": elapsed_ms,
            "tokens": None,
            "error": err_msg,
        }


__all__ = ["build_agents", "get_agents", "run_agent", "E2001_TEXT", "explain", "tools"]
