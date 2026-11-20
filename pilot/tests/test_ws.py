"""PACK 9 测试：/ws/runs WebSocket 实时推送。

三条核心用例（全部触发真实 Agent 运行，不用定时器/假消息）：
  1. 连上能收到消息：agent_start / agent_token / agent_done / run_done 都收到，
     且 run_done 的 elapsed_ms、tokens 是真实值。
  2. 断开不崩：中途断开后再连一次，仍能正常收完整条消息流。
  3. 多客户端互不干扰：两个连接并行跑不同 agent，各自 run_done 的 agent 名正确。

跑法：pilot/.venv/Scripts/python.exe -m pytest tests/test_ws.py -v
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

from api.main import app  # noqa: E402

SHORT_Q = "SKU-001 回测哪个模型最好？只说结论"


def _client() -> TestClient:
    return TestClient(app)


def _drain(ws, expect_agent: str) -> tuple[list[str], dict]:
    """收完整条消息流，返回 (事件类型列表, run_done 事件)。"""
    types: list[str] = []
    done: dict = {}
    while True:
        ev = json.loads(ws.receive_text())
        types.append(ev["type"])
        if ev["type"] == "run_done":
            done = ev
            break
    return types, done


def test_01_connect_receives_real_events():
    """连上能收到真实 Agent 事件，四类必备类型齐全，run_done 带真实耗时/token。"""
    with _client() as client:
        with client.websocket_connect("/ws/runs") as ws:
            ws.send_text(json.dumps({"agent": "A5_forecast", "question": SHORT_Q}, ensure_ascii=False))
            types, done = _drain(ws, "A5_forecast")

    c = Counter(types)
    assert c["agent_start"] >= 1
    assert c["agent_token"] >= 1, "必须有真实 LLM 流式 token 片段"
    assert c["agent_done"] == 1
    assert c["run_done"] == 1
    assert done["status"] == "success"
    assert isinstance(done["elapsed_ms"], int) and done["elapsed_ms"] > 0
    assert isinstance(done["tokens"], int) and done["tokens"] > 0


def test_02_disconnect_does_not_crash_service():
    """中途断开不崩服务：断开后新建连接仍能跑完一整条真实消息流。"""
    # 第一次：连上、发指令、收到 agent_start 后立刻断开（模拟用户中途关闭页面）
    with _client() as client:
        with client.websocket_connect("/ws/runs") as ws:
            ws.send_text(json.dumps({"agent": "A5_forecast", "question": SHORT_Q}, ensure_ascii=False))
            first = json.loads(ws.receive_text())
            assert first["type"] == "agent_start"
        # with 退出即断开；服务端应捕获 WebSocketDisconnect 并取消本连接任务

    # 第二次：服务仍存活，新连接正常收完整条流
    with _client() as client2:
        with client2.websocket_connect("/ws/runs") as ws2:
            ws2.send_text(json.dumps({"agent": "A5_forecast", "question": SHORT_Q}, ensure_ascii=False))
            types, done = _drain(ws2, "A5_forecast")
    assert "run_done" in types
    assert done["status"] == "success"


def test_03_multi_clients_isolated():
    """多客户端互不干扰：并行两个连接跑不同 agent，各自 run_done 的 agent 名正确。"""
    with _client() as client:
        with client.websocket_connect("/ws/runs") as ws_a, client.websocket_connect("/ws/runs") as ws_b:
            ws_a.send_text(json.dumps({"agent": "A5_forecast", "question": SHORT_Q}, ensure_ascii=False))
            ws_b.send_text(json.dumps({"agent": "A6_replenish", "question": "SKU-001 建议补多少件？"}, ensure_ascii=False))
            _, done_a = _drain(ws_a, "A5_forecast")
            _, done_b = _drain(ws_b, "A6_replenish")

    # 各自收自己的结果，agent 名不串线
    assert done_a["agent"] == "A5_forecast"
    assert done_b["agent"] == "A6_replenish"
    assert done_a["status"] == "success"
    assert done_b["status"] == "success"
