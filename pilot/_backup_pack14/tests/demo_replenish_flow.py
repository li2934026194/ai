"""PACK 12 全流程演示：SKU-017 提交申请 → 待审批 → 审批通过 → 生成采购单 → 部分收货 → 完全收货。

【合成演示业务，非真实生产业务】
每一步都打印「接口回执 + 数据库表的实际记录」，用于逐项核对留痕是否真实落库。

跑法：pilot/.venv/Scripts/python.exe -m tests.demo_replenish_flow
"""

from __future__ import annotations

import sys
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from api.main import app  # noqa: E402
from db import engine  # noqa: E402

client = TestClient(app)

DATASET_NAME = "合成-正在缺货"
SKU = "SKU-017"

APPLY_COLS = (
    "apply_id", "sku_id", "dataset_id", "qty_propose", "capital", "route_code",
    "objective_mode", "status", "submit_user", "submit_at", "approve_user",
    "approve_at", "reject_reason",
)
PO_COLS = (
    "po_id", "apply_id", "sku_id", "order_qty", "receive_qty", "defect_qty",
    "status", "expect_arrive", "actual_arrive", "created_at",
)


def _dataset_id() -> str:
    for item in client.get("/api/datasets").json()["datasets"]:
        if item["name"] == DATASET_NAME:
            return item["id"]
    raise SystemExit(f"数据集 {DATASET_NAME} 不存在")


def _fmt(value) -> str:
    if value is None:
        return "NULL"
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M:%S") if hasattr(value, "hour") else value.isoformat()
    return str(value)


def dump_apply(apply_id: str, title: str) -> None:
    with engine.connect() as con:
        row = con.execute(
            text("SELECT * FROM replenish_apply WHERE apply_id=:a"), {"a": apply_id}
        ).mappings().first()
        po = con.execute(
            text("SELECT * FROM purchase_order WHERE apply_id=:a ORDER BY created_at DESC"),
            {"a": apply_id},
        ).mappings().all()
    print(f"  ── {title} ──")
    if row is None:
        print("   replenish_apply: 无记录")
        return
    print("   replenish_apply:")
    for col in APPLY_COLS:
        print(f"     {col:<15}= {_fmt(row[col])}")
    if not po:
        print("   purchase_order: 无记录")
    for p in po:
        print("   purchase_order:")
        for col in PO_COLS:
            print(f"     {col:<15}= {_fmt(p[col])}")
    print()


def step(idx: int, title: str, resp: dict) -> None:
    print("=" * 78)
    print(f"步骤 {idx}｜{title}")
    print("=" * 78)
    if "code" in resp:
        print(f"  接口回执：拦截 {resp['code']}｜{resp['message']}")
    else:
        print(f"  接口回执：{resp.get('message', '')}")
        print(f"  动作={resp.get('action')} 操作人={resp.get('operator')} 时间={resp.get('operated_at')}")
        a = resp.get("apply") or {}
        print(f"  申请号={a.get('apply_id')} 状态={a.get('status')}｜{a.get('status_label')}")
        p = resp.get("purchase_order") or {}
        if p:
            print(f"  采购单={p.get('po_id')} 状态={p.get('status')}｜{p.get('status_label')} "
                  f"订单量={p.get('order_qty')} 累计实收={p.get('receive_qty')} 不良={p.get('defect_qty')}")
    print()


def main() -> None:
    did = _dataset_id()
    print(f"数据集：{DATASET_NAME}（{did}）｜SKU：{SKU}")
    print("【合成演示业务，非真实生产业务】\n")

    # 步骤 1：提交申请（数量不传 → 后端按 core 实时建议量计算）
    r1 = client.post(
        "/api/p3/apply",
        json={
            "dataset_id": did, "sku": SKU, "submit_user": "u_buyer_lin",
            "route_code": "sea", "objective_mode": "profit",
        },
    ).json()
    step(1, "提交补货申请（建议量由后端实时计算）", r1)
    apply_id = r1["apply"]["apply_id"]
    dump_apply(apply_id, "提交后")

    # 步骤 2：审批通过 → 自动生成采购单
    r2 = client.post(
        "/api/p3/apply/approve", json={"apply_id": apply_id, "approve_user": "u_mgr_zhao"}
    ).json()
    step(2, "审批通过（自动生成采购单）", r2)
    po_id = r2["purchase_order"]["po_id"]
    order_qty = r2["purchase_order"]["order_qty"]
    dump_apply(apply_id, "审批通过后")

    # 步骤 3：部分收货（实收一半，含 3 件不良品）
    half = order_qty // 2
    r3 = client.post(
        "/api/p3/po/receive",
        json={"po_id": po_id, "receive_qty": half, "defect_qty": 3, "operator": "u_wh_chen"},
    ).json()
    step(3, f"部分收货（实收 {half} 件 / 不良 3 件）", r3)
    dump_apply(apply_id, "部分收货后")

    # 步骤 4：完全收货（补齐剩余）
    rest = order_qty - half
    r4 = client.post(
        "/api/p3/po/receive",
        json={"po_id": po_id, "receive_qty": rest, "defect_qty": 0, "operator": "u_wh_chen"},
    ).json()
    step(4, f"完全收货（补齐 {rest} 件）", r4)
    dump_apply(apply_id, "完全收货后（申请应自动关闭）")

    # 附：一条待审批（P2 审批台按钮演示） + 一条已驳回（驳回理由留痕演示）
    pending = client.post(
        "/api/p3/apply",
        json={
            "dataset_id": did, "sku": SKU, "submit_user": "u_buyer_lin",
            "route_code": "air", "objective_mode": "sales",
        },
    ).json()
    step(5, "附：再提交一条，保持待审批（用于 P2 审批按钮演示）", pending)
    rejected = client.post(
        "/api/p3/apply",
        json={
            "dataset_id": did, "sku": SKU, "submit_user": "u_buyer_lin",
            "route_code": "truck", "objective_mode": "cash",
        },
    ).json()
    rej = client.post(
        "/api/p3/apply/reject",
        json={
            "apply_id": rejected["apply"]["apply_id"],
            "approve_user": "u_mgr_zhao",
            "reject_reason": "本月现金预算已用完，改为下月合并下单",
        },
    ).json()
    step(6, "附：驳回一条（理由必填）", rej)
    dump_apply(rej["apply"]["apply_id"], "驳回后")

    # 汇总：该 SKU 全部申请记录
    print("=" * 78)
    print("汇总｜/api/p3/applies 返回的 SKU-017 申请记录")
    print("=" * 78)
    body = client.get("/api/p3/applies", params={"dataset_id": did, "sku": SKU}).json()
    print(f"  total = {body['total']}")
    for a in body["applies"]:
        po = a["purchase_order"]
        po_txt = (
            f"{po['po_id']}｜{po['status']}｜实收 {po['receive_qty']}/{po['order_qty']}｜不良 {po['defect_qty']}"
            if po else "无采购单"
        )
        print(f"  {a['apply_id']}｜{a['status']:<14}｜{a['qty_propose']:>4} 件｜"
              f"{a['submit_user']}｜审批 {a['approve_user'] or '—'}｜{po_txt}")


if __name__ == "__main__":
    main()
