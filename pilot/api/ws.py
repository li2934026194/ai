"""WebSocket 实时推送 Agent 运行进度（api/ws.py，PACK 9）。

端点 /ws/runs：一个连接 = 一次运行订阅。
客户端发 JSON {"agent":"A6_replenish","question":"SKU-001 ..."}，
服务端用 openai-agents SDK 的 Runner.run_streamed 跑**真实** Agent，
把运行过程中产生的事件逐个推回：

  agent_start    运行开始（含 agent 名 / question）
  agent_token    LLM 流式 token 片段（raw_response_event.delta，真实流式）
  agent_progress 工具调用 / 工具返回（run_item_stream_event）
  agent_done     Agent 输出完成（含 final_output 全文）
  run_done       整次运行结束（含 elapsed_ms / tokens / status）

真实性铁律（PACK 9）：
  - 所有事件都来自 Runner.run_streamed 的真实 stream_events()，
    没有定时器、没有循环假发、没有预置脚本、没有 mock。
  - token 数取 SDK 的 usage，耗时取 perf_counter，都是真实值。

并发与断线（PACK 9 硬约束 4）：
  - 每个 WebSocket 连接有自己独立的 asyncio.Queue 和后台运行任务，互不共享状态。
  - 运行任务与 recv 循环解耦：客户端断线只取消自己那条任务，不影响服务和其他连接。
  - 断线时若运行任务还在跑，通过 cancel + 检查 queue 的 websocket 发送异常兜底，不崩服务。
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

CST = timezone(timedelta(hours=8))


def _now() -> str:
    return datetime.now(CST).isoformat(timespec="milliseconds")


def _event(event_type: str, **payload: Any) -> str:
    """统一事件封包：type + ts(ISO +08) + 业务字段。"""
    body = {"type": event_type, "ts": _now()}
    body.update(payload)
    return json.dumps(body, ensure_ascii=False)


def _load_registry():
    """按文件路径加载本地 agents/registry.py（绕开与 SDK agents 包同名冲突）。

    registry 在 import 时完成 DeepSeek client 配置，这里复用它拿 get_agents。
    不修改 registry 任何业务逻辑。
    """
    import importlib.util
    from pathlib import Path

    pilot_dir = Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location("_ws_agent_registry", pilot_dir / "agents" / "registry.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _tokens_from_result(result) -> int | None:
    """与 registry._usage_tokens 同源：从 raw_responses[-1].usage 取 total_tokens。"""
    usage = getattr(result, "usage", None)
    if usage is None:
        raw = getattr(result, "raw_responses", None) or []
        if raw:
            usage = getattr(raw[-1], "usage", None)
    return getattr(usage, "total_tokens", None) if usage is not None else None


async def _run_and_publish(agent_name: str, question: str, queue: asyncio.Queue, registry) -> None:
    """后台任务：跑真实 Agent，把 stream_events 转成事件推进 queue。

    本函数只负责「生产事件」，不碰 WebSocket 对象本身——
    这样客户端断线时不会连带把运行任务打断，任务由连接层按需 cancel。
    """
    from agents import Runner

    agents = registry.get_agents()
    started = time.perf_counter()
    try:
        if agent_name not in agents:
            await queue.put(_event("agent_done", agent=agent_name, text=f"未知 Agent：{agent_name}", ok=False))
            await queue.put(_event("run_done", agent=agent_name, elapsed_ms=0, tokens=None, status="error",
                                   error=f"unknown agent: {agent_name}"))
            return

        if not getattr(registry, "_api_key", "") or registry._api_key.startswith("<"):
            raise RuntimeError("LLM key missing")

        agent = agents[agent_name]
        await queue.put(_event("agent_start", agent=agent_name, question=question,
                               note="真实 Agent 运行，事件来自 Runner.run_streamed"))

        result = Runner.run_streamed(agent, question)
        async for ev in result.stream_events():
            etype = getattr(ev, "type", "")
            if etype == "agent_updated_stream_event":
                new_agent = getattr(ev, "new_agent", None)
                await queue.put(_event("agent_start", agent=getattr(new_agent, "name", agent_name), phase="handoff"))
            elif etype == "raw_response_event":
                delta = getattr(getattr(ev, "data", None), "delta", None)
                if isinstance(delta, str) and delta:
                    await queue.put(_event("agent_token", agent=agent_name, text=delta))
            elif etype == "run_item_stream_event":
                item = getattr(ev, "item", None)
                itype = getattr(item, "type", "")
                name = getattr(ev, "name", "")
                detail: dict[str, Any] = {"item_type": itype, "name": name}
                if itype == "tool_call_item":
                    detail["tool"] = getattr(item, "tool_name", None)
                await queue.put(_event("agent_progress", agent=agent_name, **detail))

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        final_text = result.final_output or ""
        tokens = _tokens_from_result(result)
        await queue.put(_event("agent_done", agent=agent_name, text=final_text, ok=True))
        await queue.put(_event("run_done", agent=agent_name, elapsed_ms=elapsed_ms,
                               tokens=tokens, status="success", chars=len(final_text)))
    except asyncio.CancelledError:
        # 客户端断线主动取消：安静退出，不再往 queue 塞事件
        raise
    except Exception as exc:  # noqa: BLE001 - 单条连接失败不能拖垮服务
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        err = f"{type(exc).__name__}: {exc}"
        await queue.put(_event("agent_done", agent=agent_name, text=err, ok=False))
        await queue.put(_event("run_done", agent=agent_name, elapsed_ms=elapsed_ms,
                               tokens=None, status="fallback", error=err))
    finally:
        await queue.put(None)  # 结束哨兵


@router.websocket("/ws/runs")
async def ws_runs(websocket: WebSocket) -> None:
    """一次连接 = 一次运行订阅。连接建立后客户端发一条 JSON 指定 agent + question。

    协议：
      客户端 -> {"agent":"A6_replenish","question":"SKU-001 建议补多少件？"}
      服务端 -> 多条 {"type":..., "ts":..., ...}（见模块顶部事件类型）
    """
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    run_task: asyncio.Task | None = None

    try:
        # 1) 等客户端下发运行指令（真实参数，不是服务端预置）
        raw = await websocket.receive_text()
        try:
            cmd = json.loads(raw)
        except json.JSONDecodeError:
            await websocket.send_text(_event("run_done", status="error", error="invalid json", elapsed_ms=0))
            return
        agent_name = str(cmd.get("agent", "A6_replenish"))
        question = str(cmd.get("question", "SKU-001 建议补多少件？占用多少资金？"))

        registry = _load_registry()
        # 2) 后台跑真实 Agent；本协程只负责把 queue 里的事件发出去
        run_task = asyncio.create_task(_run_and_publish(agent_name, question, queue, registry))

        while True:
            item = await queue.get()
            if item is None:
                break
            await websocket.send_text(item)
    except WebSocketDisconnect:
        # 客户端主动断开：取消本连接专属的运行任务，不抛出、不影响其他连接
        if run_task is not None and not run_task.done():
            run_task.cancel()
    except Exception as exc:  # noqa: BLE001 - 任何异常都不能让 ws 端点崩掉服务
        try:
            await websocket.send_text(_event("run_done", status="error", error=f"{type(exc).__name__}: {exc}", elapsed_ms=0))
        except Exception:
            pass
    finally:
        if run_task is not None and not run_task.done():
            run_task.cancel()
        # 让被 cancel 的任务有机会收尾，避免 "Task was destroyed but it is pending"
        if run_task is not None:
            try:
                await run_task
            except (asyncio.CancelledError, Exception):
                pass


__all__ = ["router", "ws_runs"]
