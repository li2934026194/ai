"""补货申请 → 审批 → 采购单 → 收货质检 的纯状态机（core/replenish_flow.py，PACK 12）。

【合成演示业务，非真实生产业务】本模块只做「状态流转规则 + 数量校验」，
不碰数据库、不碰 Web 框架，落库由 api/service.py 完成（与 core 包铁律一致）。

状态机（唯一定义处，schema.py 的 CHECK 约束与之对齐）：
    replenish_apply :
        draft          --提交--> pending_approve
        pending_approve --通过--> approved --采购单全收--> closed
        pending_approve --驳回--> rejected
    purchase_order :
        created        --发货--> shipping
        created/shipping --收货--> partial_received --收满--> fully_received
        任意未终态      --取消--> cancelled

铁律：
1. 任何非法跳转抛 FlowError（F-2001），绝不「先改状态再校验」；
2. 数量全部由入参实时累加/校验，没有任何写死的业务数字；
3. 驳回必须带驳回理由（非空白字符串），理由为空抛 FlowError（F-2002）；
4. 收货数量非法（负数、不良品多于实收、累计实收超过订单量）抛 F-2003。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Mapping, Optional

# ---------------------------------------------------------------------------
# 状态枚举（与 schema.py 的 APPLY_STATUSES / PO_STATUSES 完全一致）
# ---------------------------------------------------------------------------
APPLY_DRAFT = "draft"
APPLY_PENDING = "pending_approve"
APPLY_APPROVED = "approved"
APPLY_REJECTED = "rejected"
APPLY_CLOSED = "closed"

PO_CREATED = "created"
PO_SHIPPING = "shipping"
PO_PARTIAL = "partial_received"
PO_FULLY = "fully_received"
PO_CANCELLED = "cancelled"

APPLY_STATUSES: tuple[str, ...] = (
    APPLY_DRAFT, APPLY_PENDING, APPLY_APPROVED, APPLY_REJECTED, APPLY_CLOSED,
)
PO_STATUSES: tuple[str, ...] = (
    PO_CREATED, PO_SHIPPING, PO_PARTIAL, PO_FULLY, PO_CANCELLED,
)

# 中文展示名（后端下发给前端做字典，前端不再自己拼状态文案）
STATUS_LABELS: dict[str, str] = {
    APPLY_DRAFT: "草稿",
    APPLY_PENDING: "待审批",
    APPLY_APPROVED: "已通过",
    APPLY_REJECTED: "已驳回",
    APPLY_CLOSED: "已关闭",
    PO_CREATED: "已生成",
    PO_SHIPPING: "运输中",
    PO_PARTIAL: "部分收货",
    PO_FULLY: "完全收货",
    PO_CANCELLED: "已取消",
}

# 允许的流转表：键是当前状态，值是允许到达的目标状态集合。
APPLY_TRANSITIONS: dict[str, frozenset[str]] = {
    APPLY_DRAFT: frozenset({APPLY_PENDING}),
    APPLY_PENDING: frozenset({APPLY_APPROVED, APPLY_REJECTED}),
    APPLY_APPROVED: frozenset({APPLY_CLOSED}),
    APPLY_REJECTED: frozenset(),
    APPLY_CLOSED: frozenset(),
}

PO_TRANSITIONS: dict[str, frozenset[str]] = {
    PO_CREATED: frozenset({PO_SHIPPING, PO_PARTIAL, PO_FULLY, PO_CANCELLED}),
    PO_SHIPPING: frozenset({PO_PARTIAL, PO_FULLY, PO_CANCELLED}),
    PO_PARTIAL: frozenset({PO_PARTIAL, PO_FULLY, PO_CANCELLED}),
    PO_FULLY: frozenset(),
    PO_CANCELLED: frozenset(),
}

# 单号前缀（真正的唯一 id 由 service 用 uuid 生成，这里只集中前缀常量）
APPLY_ID_PREFIX = "ap_"
PO_ID_PREFIX = "po_"


class FlowError(Exception):
    """状态流转 / 数量校验失败；code 由 api 层原样透出给前端。"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# ---------------------------------------------------------------------------
# 通用校验
# ---------------------------------------------------------------------------
def ensure_status(status: str, allowed: tuple[str, ...], entity: str) -> str:
    """进入状态机前的第一道门：状态值必须在枚举内（防止脏数据绕过流转表）。"""
    value = str(status or "")
    if value not in allowed:
        raise FlowError("F-2001", f"{entity} 状态 {value!r} 不在允许枚举 {allowed} 内")
    return value


def check_transition(
    current: str,
    target: str,
    transitions: Mapping[str, frozenset[str]],
    entity: str,
) -> None:
    """非法跳转一律拦截（例如 draft 直接 → approved、rejected 再 → approved）。"""
    allowed = transitions.get(current)
    if allowed is None:
        raise FlowError("F-2001", f"{entity} 当前状态 {current!r} 未知，拒绝流转")
    if target not in allowed:
        raise FlowError(
            "F-2001",
            f"{entity} 不允许从 {current!r} 流转到 {target!r}"
            f"（允许：{sorted(allowed) or '无，已是终态'}）",
        )


# ---------------------------------------------------------------------------
# 1) 提交申请：draft → pending_approve
# ---------------------------------------------------------------------------
def submit_apply(
    apply_row: Mapping[str, Any], *, submit_user: str, now: datetime
) -> dict[str, Any]:
    """草稿提交：校验 0 < qty_propose 且路由/目标码非空，状态置 pending_approve。"""
    current = ensure_status(str(apply_row["status"]), APPLY_STATUSES, "补货申请")
    check_transition(current, APPLY_PENDING, APPLY_TRANSITIONS, "补货申请")

    qty = int(apply_row["qty_propose"])
    if qty <= 0:
        raise FlowError("F-2003", f"申请数量必须为正整数，当前 {qty}")
    for field in ("route_code", "objective_mode"):
        if not str(apply_row.get(field) or "").strip():
            raise FlowError("F-2003", f"{field} 不能为空")
    if not str(submit_user or "").strip():
        raise FlowError("F-2003", "提交人不能为空")

    return {
        "status": APPLY_PENDING,
        "submit_user": str(submit_user).strip(),
        "submit_at": now,
    }


# ---------------------------------------------------------------------------
# 2) 审批通过：pending_approve → approved，并生成采购单
# ---------------------------------------------------------------------------
def approve_apply(
    apply_row: Mapping[str, Any],
    *,
    approve_user: str,
    now: datetime,
    po_id: str,
    lead_time_days: int,
) -> dict[str, Any]:
    """通过审批：返回申请要改的字段 + 一张待落库的采购单（order_qty = qty_propose）。"""
    current = ensure_status(str(apply_row["status"]), APPLY_STATUSES, "补货申请")
    check_transition(current, APPLY_APPROVED, APPLY_TRANSITIONS, "补货申请")
    if not str(approve_user or "").strip():
        raise FlowError("F-2003", "审批人不能为空")

    order_qty = int(apply_row["qty_propose"])
    if order_qty <= 0:
        raise FlowError("F-2003", f"申请数量必须为正整数，当前 {order_qty}")

    # 预计到货日 = 审批当天 + 该 SKU 四段总交期（交期来自 products，不写死）
    expect_arrive: date = (now + timedelta(days=int(lead_time_days))).date()

    return {
        "apply": {
            "status": APPLY_APPROVED,
            "approve_user": str(approve_user).strip(),
            "approve_at": now,
            "reject_reason": None,
        },
        "purchase_order": {
            "po_id": po_id,
            "apply_id": apply_row["apply_id"],
            "sku_id": apply_row["sku_id"],
            "order_qty": order_qty,
            "receive_qty": 0,
            "defect_qty": 0,
            "status": PO_CREATED,
            "expect_arrive": expect_arrive,
            "actual_arrive": None,
            "created_at": now,
        },
    }


# ---------------------------------------------------------------------------
# 3) 驳回：pending_approve → rejected，必须写理由
# ---------------------------------------------------------------------------
def reject_apply(
    apply_row: Mapping[str, Any],
    *,
    approve_user: str,
    now: datetime,
    reject_reason: str,
) -> dict[str, Any]:
    """驳回审批：理由必须非空白（F-2002），审批人必须非空（F-2003）。"""
    current = ensure_status(str(apply_row["status"]), APPLY_STATUSES, "补货申请")
    check_transition(current, APPLY_REJECTED, APPLY_TRANSITIONS, "补货申请")

    reason = str(reject_reason or "").strip()
    if not reason:
        raise FlowError("F-2002", "驳回必须填写驳回理由")
    if not str(approve_user or "").strip():
        raise FlowError("F-2003", "审批人不能为空")

    return {
        "status": APPLY_REJECTED,
        "approve_user": str(approve_user).strip(),
        "approve_at": now,
        "reject_reason": reason,
    }


# ---------------------------------------------------------------------------
# 4) 采购单发货：created → shipping
# ---------------------------------------------------------------------------
def mark_shipping(po_row: Mapping[str, Any]) -> dict[str, Any]:
    """标记发货（只改状态，不动数量）。"""
    current = ensure_status(str(po_row["status"]), PO_STATUSES, "采购单")
    check_transition(current, PO_SHIPPING, PO_TRANSITIONS, "采购单")
    return {"status": PO_SHIPPING}


# ---------------------------------------------------------------------------
# 4-bis) 取消采购单：任一未终态 → cancelled（必须写理由）
# ---------------------------------------------------------------------------
def cancel_purchase_order(
    po_row: Mapping[str, Any],
    *,
    cancel_user: str,
    now: datetime,
    reason: str,
) -> dict[str, Any]:
    """取消采购单。

    口径：
    - created / shipping / partial_received 都可取消；fully_received 与 cancelled 是终态，挡回 F-2001；
    - 理由必须非空白（F-2002），操作人必须非空（F-2003）——取消是破坏性动作，必须留痕；
    - 已部分收货的采购单取消时，已收数量保留在册，不冲销（货已经到了，账不能抹），
      由调用方在文案里说明「已收 N 件仍计入库存」；
    - 取消不改变对应申请的状态（申请仍为 approved）——申请与采购单是两条链，
      是否把申请一并关闭属于业务决策，不在本函数里偷偷做。
    """
    current = ensure_status(str(po_row["status"]), PO_STATUSES, "采购单")
    check_transition(current, PO_CANCELLED, PO_TRANSITIONS, "采购单")

    text = str(reason or "").strip()
    if not text:
        raise FlowError("F-2002", "取消采购单必须填写原因")
    if not str(cancel_user or "").strip():
        raise FlowError("F-2003", "取消操作人不能为空")

    return {
        "status": PO_CANCELLED,
        "cancel_user": str(cancel_user).strip(),
        "cancel_reason": text,
        "cancel_at": now,
    }


# ---------------------------------------------------------------------------
# 5) 收货质检：累计实收 + 不良品，判定部分/完全收货
# ---------------------------------------------------------------------------
def receive_goods(
    po_row: Mapping[str, Any],
    *,
    receive_qty: int,
    defect_qty: int,
    now: datetime,
) -> dict[str, Any]:
    """一次收货：累加实收与不良品，按「累计实收 vs 订单量」判定 PO 新状态。

    返回 {
      "purchase_order": {status, receive_qty, defect_qty, actual_arrive},
      "fully_received": bool,      # 是否收满（service 据此把申请置 closed）
      "remaining_qty": int,        # 还剩多少未到货（收满为 0）
    }
    不良品是「实收」的子集，单独累计用于质检留痕，不减少实收数量。
    """
    current = ensure_status(str(po_row["status"]), PO_STATUSES, "采购单")
    if current in (PO_FULLY, PO_CANCELLED):
        raise FlowError("F-2001", f"采购单已是终态 {current!r}，不可再收货")

    got = int(receive_qty)
    bad = int(defect_qty)
    if got <= 0:
        raise FlowError("F-2003", f"实收数量必须为正整数，当前 {got}")
    if bad < 0:
        raise FlowError("F-2003", f"不良品数量不能为负，当前 {bad}")
    if bad > got:
        raise FlowError("F-2003", f"不良品 {bad} 不能多于实收 {got}")

    order_qty = int(po_row["order_qty"])
    total_receive = int(po_row["receive_qty"]) + got
    if total_receive > order_qty:
        remaining = order_qty - int(po_row["receive_qty"])
        raise FlowError(
            "F-2003",
            f"累计实收 {total_receive} 超过订单量 {order_qty}（本次最多可收 {remaining}）",
        )
    total_defect = int(po_row["defect_qty"]) + bad

    target = PO_FULLY if total_receive >= order_qty else PO_PARTIAL
    # 部分收货 → 部分收货 属于「原地重入」，流转表里显式允许，仍然走一次校验。
    check_transition(current, target, PO_TRANSITIONS, "采购单")

    return {
        "purchase_order": {
            "status": target,
            "receive_qty": total_receive,
            "defect_qty": total_defect,
            "actual_arrive": now if target == PO_FULLY else po_row.get("actual_arrive"),
        },
        "fully_received": target == PO_FULLY,
        "remaining_qty": max(0, order_qty - total_receive),
    }


# ---------------------------------------------------------------------------
# 6) 收满后关闭申请：approved → closed
# ---------------------------------------------------------------------------
def close_apply(apply_row: Mapping[str, Any], *, now: datetime) -> dict[str, Any]:
    """采购单完全收货后，对应申请置 closed（终态，不可再流转）。"""
    current = ensure_status(str(apply_row["status"]), APPLY_STATUSES, "补货申请")
    check_transition(current, APPLY_CLOSED, APPLY_TRANSITIONS, "补货申请")
    return {"status": APPLY_CLOSED, "approve_at": apply_row.get("approve_at") or now}


# 兼容：外部若只想拿「下一步合法状态」做展示，用这两张表即可。
__all__ = [
    "APPLY_DRAFT", "APPLY_PENDING", "APPLY_APPROVED", "APPLY_REJECTED", "APPLY_CLOSED",
    "PO_CREATED", "PO_SHIPPING", "PO_PARTIAL", "PO_FULLY", "PO_CANCELLED",
    "APPLY_STATUSES", "PO_STATUSES", "APPLY_TRANSITIONS", "PO_TRANSITIONS",
    "STATUS_LABELS", "APPLY_ID_PREFIX", "PO_ID_PREFIX",
    "FlowError", "ensure_status", "check_transition",
    "submit_apply", "approve_apply", "reject_apply", "mark_shipping",
    "receive_goods", "close_apply", "cancel_purchase_order",
]
