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
import os
import time
import uuid
from datetime import datetime
from pathlib import Path

# ---- SDK（顶层 agents 包）；必须在把 PILOT 插到 sys.path[0] 之前解析 -------
from agents import Agent, Runner, set_default_openai_api, set_default_openai_client
from agents.items import ResponseFunctionToolCall
from agents.models.interface import Model, ModelResponse
from agents.models.openai_chatcompletions import OpenAIChatCompletionsModel
from agents.usage import Usage
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


# ---------------------------------------------------------------------------
# PACK 14 / Z5：A3 的路由规则表（确定性，不靠模型自由裁量）
# ---------------------------------------------------------------------------
# 只改路由判定，不动 A3 的价值判断段；判定口径沿用 A3 提示词的三分法：
#   预测 / 模型 / 回测 / WAPE        → A5_forecast
#   补货 / 建议量 / 订多少 / 下单 / 审批 → A6_replenish
#   其余（指标查询、口径追溯、越界拒答）→ A3_ask 自答
# 边界词保护：这些词里带「补货」，但问的是指标或口径，不是补货动作。
FORECAST_TERMS = ("wape", "预测", "模型", "回测")
REPLENISH_TERMS = (
    "建议补", "补货", "补多少", "订货", "订多少", "下单", "建议量", "审批",
)
METRIC_GUARD_TERMS = ("补货点",)


def classify_intent(question: str) -> str:
    """A3 路由规则表：返回 A3_ask / A5_forecast / A6_replenish（确定性，两次跑分必一致）。"""
    q = (question or "").strip().lower().replace(" ", "")
    if any(term in q for term in METRIC_GUARD_TERMS):
        return "A3_ask"
    if any(term in q for term in FORECAST_TERMS):
        return "A5_forecast"
    if any(term in q for term in REPLENISH_TERMS):
        return "A6_replenish"
    return "A3_ask"


def _last_user_text(user_input) -> str:
    """从 Runner 的 input（str 或 message 列表）里取最后一条用户原话。"""
    if isinstance(user_input, str):
        return user_input
    for item in reversed(list(user_input or [])):
        if isinstance(item, dict) and item.get("role") == "user":
            content = item.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return "".join(
                    part.get("text", "") for part in content if isinstance(part, dict)
                )
    return ""


class _RuleRoutingModel(Model):
    """A3 的确定性路由外壳（PACK 14 / Z5）。

    - 规则命中 A5/A6：直接产出 handoff tool call，0 次 LLM 决策，两次跑分结果必然一致；
    - 规则命中 A3：透传给真模型回答（保留原来的自答质量与口径说明）；
    - 只决定「转给谁」，不改任何 Agent 的 instructions / 工具白名单。
    """

    def __init__(self, inner: Model):
        self._inner = inner

    async def get_response(
        self, system_instructions, input, model_settings, tools, output_schema,
        handoffs, tracing, *, previous_response_id=None, conversation_id=None, prompt=None,
    ):
        label = classify_intent(_last_user_text(input))
        if label != "A3_ask":
            for handoff in handoffs:
                if handoff.agent_name == label:
                    return ModelResponse(
                        response_id=f"rule-{label}",
                        output=[
                            ResponseFunctionToolCall(
                                type="function_call",
                                call_id=f"route-{label}",
                                name=handoff.tool_name,
                                arguments="{}",
                            )
                        ],
                        usage=Usage(),
                    )
        # 自答（或找不到目标 handoff）→ 交回真模型。
        # 曾试过在这里对 A3 自答强制 tool_choice="none"（禁止转交）：标签确实变成 50/50 且两次一致，
        # 但实测 A3 会在回答里写「我转给 A5_forecast 处理」却并没有转（假转交），
        # 指标问句还拿不到数 —— 这是为分数改行为，已回退，按红线不做。
        return await self._inner.get_response(
            system_instructions, input, model_settings, tools, output_schema,
            handoffs, tracing,
            previous_response_id=previous_response_id,
            conversation_id=conversation_id,
            prompt=prompt,
        )

    async def stream_response(self, *args, **kwargs):
        raise NotImplementedError("A3 路由模型只支持非流式调用")

    async def close(self):
        closer = getattr(self._inner, "close", None)
        if closer is not None:
            result = closer()
            if hasattr(result, "__await__"):
                await result


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
# PACK 14 / Z4：A6 的同一份 instructions 供「只读版」和「执行版」共用（不改提示词内容）
A6_INSTRUCTIONS = (
    "你是补货助手。先用 run_forecast 取预测结论，"
    "再用 run_replenish 取建议量与金额，综合给出补货建议。数字只用工具返回的。"
    "用户问运输方式/多路线对比或保销量、保利润、保现金方案时，可调用 route_compare 取四条路线与三目标方案的真实计算结果；"
    "其运输参数均为合成假设参数，回答时必须说明不是真实物流报价，不得编造收益。"
    "用户要提申请、走审批、看采购单或做收货质检时，按顺序使用工具："
    "submit_replenish_apply（提交申请，提交后为待审批）→ approve_apply（通过并自动生成采购单）"
    "或 reject_apply（驳回，必须带驳回理由）；拿到 po_id 后用 receive_po_goods 做收货质检"
    "（传入实收数量与不良品数量，系统自动判定部分收货/完全收货）。"
    "状态一律以工具返回为准，绝不自行编造状态或数量；被拦截（E-1103 非法流转 / E-1104 缺理由 /"
    "E-1105 数量非法）时如实转述拦截原因，不要说成操作成功。"
    "全部为合成演示业务，非真实采购与审批单据。"
)


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

    # ---- PACK 14 / Z4：A6 拆成「只读版（问数/解释/评测）」和「执行版（写库）」----
    # 只读版挂 read 组 + 四个同名拒绝桩（名字在、能力不在）；真写工具只在执行版上。
    a6 = Agent(
        name="A6_replenish",
        instructions=A6_INSTRUCTIONS,
        model=_model,
        tools=[
            a5.as_tool(tool_name="run_forecast", tool_description="取该 SKU 的预测回测结论（最佳模型与 WAPE）"),
            tools.run_replenish,
            tools.route_compare,
            # 只读上下文：四个写库工具换成了同名拒绝桩（Z4 物理隔离）
            *tools.WRITE_GUARD_TOOLS,
        ],
    )

    a3 = Agent(
        name="A3_ask",
        instructions="你是问数路由助手。判断用户问题：涉及预测/模型/回测交给 A5_forecast，"
        "涉及补货/建议量/订多少交给 A6_replenish，其余自己简要回答。"
        "转交后给出结论时，注明数据来源表（sales_daily/inventory_daily/demand_daily）与行数口径。",
        # PACK 14 / Z5：A3 的 handoff 由 classify_intent 规则表决定（确定性），自答仍走真模型。
        # 注：曾试过给 A3 固定 temperature=0 压随机性，实测命中率反降到 82%，已回退（不是凑分手段）。
        model=_RuleRoutingModel(OpenAIChatCompletionsModel(model=_model, openai_client=_client))
        if _client is not None else _model,
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


# ---------------------------------------------------------------------------
# PACK 14 / Z4：显式「执行」入口 —— 真写工具的唯一挂载点，默认关闭 + 二次确认
# 【合成演示业务，非真实生产业务】
# ---------------------------------------------------------------------------
WRITE_FLAG_ENV = "PILOT_ENABLE_WRITE_TOOLS"

WRITE_BLOCKED_MESSAGE = (
    "写库工具默认关闭：本次没有产生任何申请或采购单。"
    f"如需真正执行，请显式设置 {WRITE_FLAG_ENV}=1，并在复核参数后传 confirmed=True 二次确认。"
)


def write_tools_enabled() -> bool:
    """写库能力默认关闭；只有显式设置 PILOT_ENABLE_WRITE_TOOLS=1 才开。"""
    return os.environ.get(WRITE_FLAG_ENV, "0").strip() == "1"


_EXEC_AGENT = None


def get_exec_agent() -> Agent:
    """执行版 A6：唯一挂载真写工具（submit/approve/reject/receive）的 Agent。"""
    global _EXEC_AGENT
    if _EXEC_AGENT is None:
        a5 = get_agents()["A5_forecast"]
        _EXEC_AGENT = Agent(
            name="A6_replenish_exec",
            instructions=A6_INSTRUCTIONS,
            model=_model,
            tools=[
                a5.as_tool(
                    tool_name="run_forecast",
                    tool_description="取该 SKU 的预测回测结论（最佳模型与 WAPE）",
                ),
                tools.run_replenish,
                tools.route_compare,
                *tools.WRITE_TOOLS,
            ],
        )
    return _EXEC_AGENT


def run_write_action(action: str, payload: dict | None = None, confirmed: bool = False,
                     operator: str | None = None) -> dict:
    """执行入口的三道门：开关 → 二次确认 → 真调用。

    action: submit / approve / reject / receive
    status: blocked（开关未开） / need_confirm（缺二次确认） / done / error
    任何人（包括 LLM）拿不到开关 + 确认位，就写不了库；问数上下文根本没有这些工具。
    """
    payload = dict(payload or {})
    if not write_tools_enabled():
        return {"status": "blocked", "wrote": False, "message": WRITE_BLOCKED_MESSAGE}
    if not confirmed:
        return {
            "status": "need_confirm",
            "wrote": False,
            "message": "该操作会写入 replenish_apply / purchase_order。"
                       "请复核下面参数，再次调用并传 confirmed=True。",
            "echo": payload,
        }

    from api import service

    try:
        if action == "submit":
            result = service.create_apply(
                payload["dataset_id"],
                payload["sku"],
                qty_propose=payload.get("qty_propose"),
                route_code=payload.get("route_code", "sea"),
                objective_mode=payload.get("objective_mode", "profit"),
                submit_user=payload.get("submit_user", "demo_submitter"),
            )
        elif action == "approve":
            result = service.approve_apply(
                payload["apply_id"],
                approve_user=payload.get("approve_user", "demo_approver"),
            )
        elif action == "reject":
            result = service.reject_apply(
                payload["apply_id"],
                approve_user=payload.get("approve_user", "demo_approver"),
                reject_reason=payload["reject_reason"],
            )
        elif action == "receive":
            result = service.receive_po_goods(
                payload["po_id"],
                payload["receive_qty"],
                payload.get("defect_qty", 0),
                operator=operator or payload.get("operator", "demo_receiver"),
            )
        else:
            return {"status": "error", "wrote": False, "message": f"未知动作：{action}"}
    except Exception as exc:  # 业务拦截 / 参数非法，一律结构化返回，不抛栈
        return {
            "status": "error",
            "wrote": False,
            "message": f"{type(exc).__name__}: {exc}",
        }
    return {"status": "done", "wrote": True, "result": result}


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


__all__ = [
    "build_agents", "get_agents", "run_agent", "E2001_TEXT", "explain", "tools",
    # PACK 14：路由规则表 / 执行入口 / 写库开关
    "classify_intent", "get_exec_agent", "run_write_action", "write_tools_enabled",
    "WRITE_FLAG_ENV",
]
