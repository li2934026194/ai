"""PACK 12 单元测试：补货申请 → 审批 → 采购单 → 收货质检 闭环。

【合成演示业务，非真实生产业务】
覆盖 6 条用例：
  1. 正常全流程（提交 → 待审批 → 通过 → 生成 PO → 部分收货 → 完全收货 → 申请关闭）
  2. 驳回分支（理由为空被拦截 / 驳回后不可再审批 / 不生成采购单）
  3. 部分收货与超收拦截（累计实收、不良品累计、超出订单量拒绝）
  4. 非法状态流转拦截（草稿直接审批、终态再收货、驳回后再审批）
  5. 状态枚举与 DB CHECK 约束（脏状态写不进库）
  6. A6_replenish 已挂载 4 个新工具（只读结构断言，不调 LLM）

跑法：pilot/.venv/Scripts/python.exe -m pytest tests/test_replenish_flow.py -v
"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from api.main import app          # noqa: E402
from core import replenish_flow    # noqa: E402
from db import engine             # noqa: E402
from schema import APPLY_STATUSES, PO_STATUSES   # noqa: E402

client = TestClient(app)

DATASET_NAME = "合成-正在缺货"
SKU = "SKU-017"

# 测试期间创建的单号，tearDown 统一清理，保证演示库不留测试垃圾
_CREATED_APPLIES: set[str] = set()


def _dataset_id() -> str:
    for item in client.get("/api/datasets").json()["datasets"]:
        if item["name"] == DATASET_NAME:
            return item["id"]
    raise AssertionError(f"数据集 {DATASET_NAME} 不存在")


def _apply(did: str, **kwargs) -> dict:
    body = {
        "dataset_id": did,
        "sku": SKU,
        "submit_user": "pytest_submitter",
        "route_code": "sea",
        "objective_mode": "profit",
    }
    for key, value in kwargs.items():
        if key in ("dataset_id", "sku"):
            continue  # 不允许覆盖测试基准
        body[key] = value
    resp = client.post("/api/p3/apply", json=body)
    payload = resp.json()
    if "apply" in payload:
        _CREATED_APPLIES.add(payload["apply"]["apply_id"])
    return payload


def _approve(apply_id: str) -> dict:
    return client.post(
        "/api/p3/apply/approve", json={"apply_id": apply_id, "approve_user": "pytest_approver"}
    ).json()


def _reject(apply_id: str, reason: str) -> dict:
    return client.post(
        "/api/p3/apply/reject",
        json={"apply_id": apply_id, "approve_user": "pytest_approver", "reject_reason": reason},
    ).json()


def _receive(po_id: str, qty: int, defect: int = 0) -> dict:
    return client.post(
        "/api/p3/po/receive",
        json={"po_id": po_id, "receive_qty": qty, "defect_qty": defect, "operator": "pytest_operator"},
    ).json()


def _db_row(sql: str, **params) -> dict | None:
    with engine.connect() as con:
        row = con.execute(text(sql), params).mappings().first()
    return dict(row) if row else None


def _db_rows(sql: str, **params) -> list[dict]:
    with engine.connect() as con:
        return [dict(r) for r in con.execute(text(sql), params).mappings().all()]


class TestReplenishFlow(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        """清掉本次测试创建的单据（只删本测试的 apply_id，不碰任何既有数据）。"""
        if not _CREATED_APPLIES:
            return
        with engine.begin() as con:
            for apply_id in _CREATED_APPLIES:
                con.execute(
                    text("DELETE FROM purchase_order WHERE apply_id=:a"), {"a": apply_id}
                )
                con.execute(
                    text("DELETE FROM replenish_apply WHERE apply_id=:a"), {"a": apply_id}
                )

    # ---------------------------------------------------------------- 用例 1
    def test_01_full_flow_submit_approve_partial_then_full(self):
        """正常全流程：提交 → 待审批 → 通过 → PO → 部分收货 → 完全收货。"""
        did = _dataset_id()

        # 提交申请：数量由后端按实时建议量计算（不传 qty_propose）
        created = _apply(did)
        self.assertNotIn("code", created, created)
        apply_id = created["apply"]["apply_id"]
        qty = created["apply"]["qty_propose"]
        self.assertEqual(created["apply"]["status"], replenish_flow.APPLY_PENDING)
        self.assertGreater(qty, 0, "SKU-017 在「合成-正在缺货」应有正建议量")

        row = _db_row("SELECT * FROM replenish_apply WHERE apply_id=:a", a=apply_id)
        self.assertEqual(row["status"], "pending_approve")
        self.assertEqual(row["qty_propose"], qty)
        self.assertEqual(row["submit_user"], "pytest_submitter")
        self.assertIsNotNone(row["submit_at"])
        self.assertIsNone(row["approve_user"])
        print(f"\n  [1] 提交后 DB 行：apply_id={apply_id} status={row['status']} qty={row['qty_propose']}")

        # 审批通过 → 自动生成采购单
        approved = _approve(apply_id)
        self.assertNotIn("code", approved, approved)
        self.assertEqual(approved["apply"]["status"], "approved")
        self.assertEqual(approved["apply"]["approve_user"], "pytest_approver")
        po = approved["purchase_order"]
        self.assertIsNotNone(po)
        self.assertEqual(po["status"], "created")
        self.assertEqual(po["order_qty"], qty, "采购单订单量必须等于申请数量")
        self.assertEqual(po["receive_qty"], 0)

        po_row = _db_row("SELECT * FROM purchase_order WHERE po_id=:p", p=po["po_id"])
        apply_row = _db_row("SELECT * FROM replenish_apply WHERE apply_id=:a", a=apply_id)
        self.assertEqual(po_row["status"], "created")
        self.assertEqual(apply_row["approve_user"], "pytest_approver")
        self.assertIsNotNone(apply_row["approve_at"])
        self.assertIsNotNone(po_row["expect_arrive"])
        print(f"  [2] 通过后 DB：apply.status={apply_row['status']} po.status={po_row['status']} "
              f"order_qty={po_row['order_qty']} expect={po_row['expect_arrive']}")

        # 部分收货：实收一半，带 2 件不良品
        half = qty // 2
        r1 = _receive(po["po_id"], half, 2)
        self.assertNotIn("code", r1, r1)
        self.assertEqual(r1["purchase_order"]["status"], "partial_received")
        self.assertEqual(r1["purchase_order"]["receive_qty"], half)
        self.assertEqual(r1["purchase_order"]["defect_qty"], 2)
        self.assertEqual(r1["apply"]["status"], "approved")
        print(f"  [3] 部分收货 DB：po.status=partial_received receive={half}/{qty} defect=2")

        # 完全收货：补齐剩余
        rest = qty - half
        r2 = _receive(po["po_id"], rest)
        self.assertNotIn("code", r2, r2)
        self.assertEqual(r2["purchase_order"]["status"], "fully_received")
        self.assertEqual(r2["purchase_order"]["receive_qty"], qty)
        self.assertEqual(r2["apply"]["status"], "closed", "收满后申请必须自动关闭")
        self.assertIsNotNone(r2["purchase_order"]["actual_arrive"])
        print(f"  [4] 完全收货 DB：po.status=fully_received receive={qty}/{qty} "
              f"apply.status={r2['apply']['status']}")

        # 列表接口与 DB 一致
        listed = client.get(
            "/api/p3/applies", params={"dataset_id": did, "sku": SKU}
        ).json()
        hit = [a for a in listed["applies"] if a["apply_id"] == apply_id][0]
        self.assertEqual(hit["status"], "closed")
        self.assertEqual(hit["purchase_order"]["status"], "fully_received")
        self.assertEqual(hit["purchase_order"]["receive_qty"], qty)

    # ---------------------------------------------------------------- 用例 2
    def test_02_reject_branch(self):
        """驳回分支：理由必填；驳回后不可再审批、不生成采购单。"""
        did = _dataset_id()
        created = _apply(did)
        apply_id = created["apply"]["apply_id"]

        empty = _reject(apply_id, "   ")
        self.assertEqual(empty.get("code"), "E-1104", empty)
        self.assertIn("驳回必须填写驳回理由", empty["message"])

        ok = _reject(apply_id, "资金占用超预算，暂缓")
        self.assertNotIn("code", ok, ok)
        self.assertEqual(ok["apply"]["status"], "rejected")
        self.assertEqual(ok["apply"]["reject_reason"], "资金占用超预算，暂缓")
        self.assertIsNone(ok["purchase_order"], "驳回不得生成采购单")
        print(f"  [驳回] apply.status={ok['apply']['status']} reason={ok['apply']['reject_reason']}")

        after = _approve(apply_id)
        self.assertEqual(after.get("code"), "E-1103", after)
        self.assertIn("不允许从", after["message"])

        row = _db_row("SELECT * FROM replenish_apply WHERE apply_id=:a", a=apply_id)
        self.assertEqual(row["status"], "rejected")
        self.assertIsNotNone(row["reject_reason"])
        po_rows = _db_rows("SELECT * FROM purchase_order WHERE apply_id=:a", a=apply_id)
        self.assertEqual(len(po_rows), 0, "驳回后库里不应有采购单")

    # ---------------------------------------------------------------- 用例 3
    def test_03_partial_receive_accumulate_and_overflow(self):
        """部分收货：累计实收/不良品；超收被拒；收满转完全收货。"""
        did = _dataset_id()
        created = _apply(did)
        apply_id = created["apply"]["apply_id"]
        qty = created["apply"]["qty_propose"]
        po = _approve(apply_id)["purchase_order"]

        first = qty // 3
        r1 = _receive(po["po_id"], first, 1)
        self.assertEqual(r1["purchase_order"]["status"], "partial_received")
        self.assertEqual(r1["purchase_order"]["receive_qty"], first)

        second = qty // 3
        r2 = _receive(po["po_id"], second, 2)
        self.assertEqual(r2["purchase_order"]["receive_qty"], first + second)
        self.assertEqual(r2["purchase_order"]["defect_qty"], 3, "不良品必须累计")
        self.assertEqual(r2["purchase_order"]["status"], "partial_received")

        po_row = _db_row("SELECT * FROM purchase_order WHERE po_id=:p", p=po["po_id"])
        self.assertEqual(po_row["receive_qty"], first + second)
        print(f"  [部分收货] 累计实收 {po_row['receive_qty']}/{qty}，不良 {po_row['defect_qty']}")

        over = _receive(po["po_id"], qty)
        self.assertEqual(over.get("code"), "E-1105", over)
        self.assertIn("超过订单量", over["message"])

        rest = qty - first - second
        r3 = _receive(po["po_id"], rest)
        self.assertEqual(r3["purchase_order"]["status"], "fully_received")
        self.assertEqual(r3["purchase_order"]["receive_qty"], qty)

        again = _receive(po["po_id"], 1)
        self.assertEqual(again.get("code"), "E-1103", again)

    # ---------------------------------------------------------------- 用例 4
    def test_04_illegal_transition_blocked(self):
        """非法状态流转拦截：草稿不能直接审批/驳回；数量非法拦截；终态不可再收货。"""
        did = _dataset_id()

        draft = _apply(did, submit=False)
        draft_id = draft["apply"]["apply_id"]
        self.assertEqual(draft["apply"]["status"], "draft")
        self.assertIsNone(draft["apply"]["purchase_order"])

        bad_approve = _approve(draft_id)
        self.assertEqual(bad_approve.get("code"), "E-1103", bad_approve)

        bad_reject = _reject(draft_id, "草稿不该被驳回")
        self.assertEqual(bad_reject.get("code"), "E-1103", bad_reject)

        row = _db_row("SELECT * FROM replenish_apply WHERE apply_id=:a", a=draft_id)
        self.assertEqual(row["status"], "draft", "被拦截后状态必须原样不动")

        # 数量类非法：实收 0 / 不良品多于实收
        created = _apply(did)
        po = _approve(created["apply"]["apply_id"])["purchase_order"]
        zero = _receive(po["po_id"], 0)
        self.assertEqual(zero.get("code"), "E-1105", zero)
        defect_over = _receive(po["po_id"], 10, 11)
        self.assertEqual(defect_over.get("code"), "E-1105", defect_over)
        po_row = _db_row("SELECT * FROM purchase_order WHERE po_id=:p", p=po["po_id"])
        self.assertEqual(po_row["receive_qty"], 0, "非法收货不能改动已收数量")
        print(f"  [拦截] draft→approve={bad_approve['code']} 0 件收货={zero['code']} "
              f"不良>实收={defect_over['code']}")

    # ---------------------------------------------------------------- 用例 5
    def test_05_status_enums_and_db_check(self):
        """状态枚举三处一致，且 DB CHECK 约束让脏状态写不进库。"""
        self.assertEqual(APPLY_STATUSES, replenish_flow.APPLY_STATUSES)
        self.assertEqual(PO_STATUSES, replenish_flow.PO_STATUSES)
        self.assertEqual(
            set(APPLY_STATUSES),
            {"draft", "pending_approve", "approved", "rejected", "closed"},
        )
        self.assertEqual(
            set(PO_STATUSES),
            {"created", "shipping", "partial_received", "fully_received", "cancelled"},
        )

        with self.assertRaises(IntegrityError):
            with engine.begin() as con:
                con.execute(
                    text(
                        "INSERT INTO replenish_apply (apply_id, sku_id, dataset_id, qty_propose,"
                        " route_code, objective_mode, status, submit_user, submit_at)"
                        " VALUES ('ap_bogus_check', 'SKU-017', 'ds_x', 1, 'sea', 'profit',"
                        " 'approved_by_magic', 'pytest', now())"
                    )
                )
        print("  [约束] 非法 status 写入被 CHECK 约束拒绝（IntegrityError）")

    # ---------------------------------------------------------------- 用例 6
    def test_06_agent_tools_registered(self):
        """A6_replenish 已挂载 4 个新工具，且原有 run_replenish / route_compare 仍在。"""
        spec = importlib.util.spec_from_file_location(
            "_agent_registry_pack12", PILOT_DIR / "agents" / "registry.py"
        )
        reg = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reg)

        a6 = reg.get_agents()["A6_replenish"]
        tool_names = {getattr(t, "name", "") for t in a6.tools}
        joined = " ".join(tool_names)
        for expect in (
            "submit_replenish_apply",
            "approve_apply",
            "reject_apply",
            "receive_po_goods",
            "run_replenish",
            "route_compare",
        ):
            self.assertIn(expect, joined, f"A6 缺工具 {expect}")
        self.assertGreaterEqual(len(tool_names), 6)
        print(f"  [A6 工具] {sorted(tool_names)}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
