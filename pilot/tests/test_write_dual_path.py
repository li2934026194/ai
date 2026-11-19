"""PACK 21c：写库双路径。

同一个动作有两条入口：网页/HTTP（`POST /api/...`）与 Agent 工具（`agents/tools.py`）。
两边最终都必须落到同一套 service / 同一张表，并且产出同样的单据与数字。
本用例拿“提交申请 → 审批通过 → 生成采购单”做对照：一条走 HTTP，一条走工具，
逐字段比对结果后清理。
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import re
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app  # noqa: E402
from db import engine  # noqa: E402

client = TestClient(app)
DATASET_NAME = "合成-断货14天"
SKU = "SKU-017"
_CREATED_APPLIES: set[str] = set()
_CREATED_POS: set[str] = set()


def _dataset_id() -> str:
    for item in client.get("/api/datasets").json()["datasets"]:
        if item["name"] == DATASET_NAME:
            return item["id"]
    raise AssertionError("数据集不存在")


def _tools_module():
    spec = importlib.util.spec_from_file_location(
        "_agent_tools_dual", PILOT_DIR / "agents" / "tools.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _invoke(tool, payload: dict) -> str:
    """按 Agent 运行时的方式调用 FunctionTool。"""
    from agents.run import RunConfig
    from agents.tool_context import ToolContext
    from agents.usage import Usage

    args = json.dumps(payload, ensure_ascii=False)
    ctx = ToolContext(
        context=None,
        usage=Usage(),
        tool_name=tool.name,
        tool_call_id="dual-path",
        tool_arguments=args,
        run_config=RunConfig(),
    )
    return asyncio.run(tool.on_invoke_tool(ctx, args))


def _db_po(po_id: str) -> dict:
    with engine.connect() as con:
        row = con.execute(
            text(
                "select po_id, apply_id, order_qty, status"
                " from purchase_order where po_id=:p"
            ),
            {"p": po_id},
        ).mappings().first()
    return dict(row) if row else {}


def _db_apply(apply_id: str) -> dict:
    with engine.connect() as con:
        row = con.execute(
            text(
                "select apply_id, qty_propose, capital, route_code, objective_mode, status"
                " from replenish_apply where apply_id=:a"
            ),
            {"a": apply_id},
        ).mappings().first()
    return dict(row) if row else {}


class TestWriteDualPath(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        with engine.begin() as con:
            for po_id in _CREATED_POS:
                con.execute(text("delete from purchase_order where po_id=:p"), {"p": po_id})
            for apply_id in _CREATED_APPLIES:
                con.execute(text("delete from replenish_apply where apply_id=:a"), {"a": apply_id})
        _CREATED_POS.clear()
        _CREATED_APPLIES.clear()

    def test_http_and_agent_tool_produce_same_order(self):
        did = _dataset_id()
        tools = _tools_module()
        # 防止工具自带兜底把真实异常吞成“运行失败”，测试里要看到真错
        def _raise(_ctx, exc):
            raise exc

        for name in ("submit_replenish_apply", "approve_apply"):
            tool = getattr(tools, name)
            tool._failure_error_function = _raise
            tool._use_default_failure_error_function = False

        # ---- 路径 1：HTTP 提交 + HTTP 审批
        http_apply = client.post(
            "/api/p3/apply",
            json={
                "dataset_id": did,
                "sku": SKU,
                "submit_user": "pytest_http",
                "route_code": "sea",
                "objective_mode": "profit",
            },
        ).json()
        self.assertIn("apply", http_apply, http_apply)
        http_aid = http_apply["apply"]["apply_id"]
        _CREATED_APPLIES.add(http_aid)
        http_approved = client.post(
            "/api/p3/apply/approve", json={"apply_id": http_aid, "approve_user": "pytest_http"}
        ).json()
        http_po = http_approved["purchase_order"]["po_id"]
        _CREATED_POS.add(http_po)

        # ---- 路径 2：Agent 工具提交 + 工具审批
        submit_text = _invoke(
            tools.submit_replenish_apply,
            {
                "sku": SKU,
                "dataset_name": DATASET_NAME,
                "route_code": "sea",
                "objective_mode": "profit",
                "submit_user": "pytest_agent",
            },
        )
        agent_aid = re.search(r"(ap_[0-9a-f]+)", submit_text).group(1)
        _CREATED_APPLIES.add(agent_aid)
        approve_text = _invoke(tools.approve_apply, {"apply_id": agent_aid, "approve_user": "pytest_agent"})
        self.assertIn("采购单", approve_text, approve_text)
        agent_po = re.search(r"(po_[0-9a-f]+)", approve_text).group(1)
        _CREATED_POS.add(agent_po)

        # ---- 逐字段比对
        a1, a2 = _db_apply(http_aid), _db_apply(agent_aid)
        p1, p2 = _db_po(http_po), _db_po(agent_po)
        for field in ("qty_propose", "capital", "route_code", "objective_mode"):
            self.assertEqual(a1[field], a2[field], f"申请字段 {field} 不一致：{a1} vs {a2}")
        self.assertEqual(a1["status"], "approved")
        self.assertEqual(a2["status"], "approved")
        for field in ("order_qty", "status"):
            self.assertEqual(p1[field], p2[field], f"采购单字段 {field} 不一致：{p1} vs {p2}")
        self.assertEqual(p1["order_qty"], a1["qty_propose"])

        # ---- 回执也必须说同一组数字
        self.assertIn(str(a1["qty_propose"]), approve_text)
        print(
            f"  [双路径] HTTP 申请 {http_aid} / 工具申请 {agent_aid}；"
            f"两单数量 {p1['order_qty']}，金额 {a1['capital']}，状态一致"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
