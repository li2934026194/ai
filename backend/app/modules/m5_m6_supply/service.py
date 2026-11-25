from datetime import date, datetime, timezone
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Inventory, M0Product
from app.modules.m5_m6_supply.domain import InventoryParams
from app.modules.m5_m6_supply.domain.backtest import backtest
from app.modules.m5_m6_supply.domain.demand import calibrate_demand
from app.modules.m5_m6_supply.domain.inventory import build_suggestion
from app.modules.m5_m6_supply.domain.models import MODELS
from app.modules.m5_m6_supply.domain.replenish_flow import (
    APPLY_ID_PREFIX,
    PO_ID_PREFIX,
    STATUS_LABELS,
    FlowError,
    approve_apply,
    cancel_purchase_order,
    close_apply,
    mark_shipping,
    receive_goods,
    reject_apply,
    submit_apply,
)
from app.modules.m5_m6_supply.domain.routes import (
    build_route_plan,
    route_lead_time,
    with_objective,
    with_route,
)
from app.modules.m5_m6_supply.models import (
    M5SalesHistory,
    M6AlertEvent,
    M6PurchaseOrder,
    M6ReplenishApply,
    M6WeeklyReview,
)
from app.modules.m5_m6_supply.schemas import (
    ApplyCreateReq,
    ApplyRejectReq,
    PoCancelReq,
    PoReceiveReq,
    SalesHistoryCsvReq,
    SkuSupplyParamsReq,
    WeeklyReviewCreateReq,
    WhatIfSandboxReq,
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class M5M6SupplyService:
    async def _load_sku_context(self, session: AsyncSession, org_id: str, sku: str):
        prod = await session.scalar(
            select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == sku)
        )
        if not prod:
            raise M7Error("M7-4041", f"未找到 SKU 主档: {sku}", http_status=404)
        inv_row = await session.scalar(
            select(M0Inventory).where(
                M0Inventory.org_id == org_id, M0Inventory.sku == sku
            )
        )
        on_hand = float(inv_row.on_hand if inv_row else 0)
        in_transit = float(inv_row.in_transit if inv_row else 0)

        hist_rows = (
            await session.scalars(
                select(M5SalesHistory)
                .where(M5SalesHistory.org_id == org_id, M5SalesHistory.sku == sku)
                .order_by(M5SalesHistory.sales_date.asc())
            )
        ).all()
        if not hist_rows:
            raise M7Error("M5-1003", f"SKU {sku} 暂无销量历史记录", http_status=422)

        daily_records = [
            {"sku": sku, "date": r.sales_date, "qty_raw": float(r.qty_raw)} for r in hist_rows
        ]
        inv_records = [
            {"sku": sku, "date": r.sales_date, "on_hand": float(r.on_hand_eod)} for r in hist_rows
        ]
        series = calibrate_demand(daily_records, inv_records, sku=sku, min_history=30)

        inv_params = InventoryParams(
            unit_cost=round(float(prod.unit_cost_usd) * 7.2, 2) if prod.unit_cost_usd else None,
            price=round(float(prod.sale_price_usd) * 7.2, 2) if prod.sale_price_usd else None,
            moq=max(int(prod.moq or 60), 1),
            pack_size=max(int(prod.pack_size or 20), 1),
            lead_prod=max(int(prod.lead_time_days or 12) - 9, 4),
            lead_transit=max(int(prod.lead_time_days or 21), 10),
            lead_customs=5,
            lead_inbound=3,
            review_period=15,
        )

        # Open PO inbound batches
        open_pos = (
            await session.scalars(
                select(M6PurchaseOrder).where(
                    M6PurchaseOrder.org_id == org_id,
                    M6PurchaseOrder.sku == sku,
                    M6PurchaseOrder.status.in_(["created", "shipping", "partial_received"]),
                )
            )
        ).all()
        inbound_batches = [
            (po.expect_arrive or date.today(), max(0, po.order_qty - po.receive_qty))
            for po in open_pos
        ]
        return prod, series, inv_params, on_hand, in_transit, inbound_batches, hist_rows

    async def get_forecast_and_suggestion(
        self,
        session: AsyncSession,
        org_id: str,
        sku: str,
        route_code: str | None = None,
        objective_mode: str | None = None,
    ) -> dict:
        prod, series, inv_params, on_hand, in_transit, inbound_batches, hist_rows = (
            await self._load_sku_context(session, org_id, sku)
        )
        bt = backtest(series, MODELS)
        effective_inv = inv_params
        if route_code:
            effective_inv = with_route(effective_inv, route_code)
        if objective_mode:
            effective_inv = with_objective(effective_inv, objective_mode)

        sug = build_suggestion(
            series, effective_inv, on_hand=on_hand, in_transit=in_transit, inbound_batches=inbound_batches
        )
        mu_daily = float(sug.inputs_json.get("mu_daily", 0.0))
        sigma_daily = float(sug.inputs_json.get("sigma_daily", 0.0))
        plan = build_route_plan(
            mu_daily=max(mu_daily, 0.1),
            sigma_daily=sigma_daily,
            lead_time=effective_inv.lead_time,
            review_period=effective_inv.review_period,
            on_hand=on_hand,
            in_transit=in_transit,
            base_qty=max(sug.qty, effective_inv.moq),
            moq=effective_inv.moq,
            pack_size=effective_inv.pack_size,
            unit_cost=effective_inv.unit_cost,
        )

        per_model = {
            name: {
                "wape": round(m.wape, 4) if m.wape is not None else None,
                "bias": round(m.bias, 4) if m.bias is not None else None,
                "mae": round(m.mae, 4) if m.mae is not None else None,
                "n_obs": m.n_obs,
            }
            for name, m in bt.per_model.items()
        }

        tail_series = [
            {
                "date": str(d),
                "qty_raw": float(hist_rows[idx].qty_raw),
                "qty_calibrated": q,
                "is_stockout": bool(so),
                "on_hand_eod": float(hist_rows[idx].on_hand_eod),
            }
            for idx, (d, q, so) in enumerate(zip(series.dates, series.qty, series.is_stockout))
        ][-45:]

        return {
            "sku": sku,
            "product_name": prod.name,
            "best_model": bt.best,
            "warning": series.warning,
            "per_model": per_model,
            "series_tail": tail_series,
            "suggestion": {
                "sku": sug.sku,
                "qty": sug.qty,
                "amount": sug.amount,
                "service_level": round(sug.service_level, 4),
                "raw_service_level": round(sug.raw_service_level, 4) if sug.raw_service_level is not None else None,
                "service_level_source": sug.service_level_source,
                "z": round(sug.z, 4),
                "sigma_lt": round(sug.sigma_lt, 4),
                "ss": round(sug.ss, 2),
                "rop": round(sug.rop, 2),
                "target_s": round(sug.target_s, 2),
                "on_hand": sug.on_hand,
                "in_transit": sug.in_transit,
                "stockout_date": sug.stockout_date.isoformat() if sug.stockout_date else None,
                "zero_days": sug.zero_days,
                "lost_amount": sug.lost_amount,
                "reason": sug.reason,
                "inputs_json": sug.inputs_json,
            },
            "route_plan": plan,
        }

    async def run_whatif_sandbox(self, session: AsyncSession, org_id: str, req: WhatIfSandboxReq) -> dict:
        prod, series, inv_params, on_hand, in_transit, inbound_batches, _ = (
            await self._load_sku_context(session, org_id, req.sku)
        )
        if req.demand_multiplier != 1.0:
            series.qty = [None if q is None else round(q * req.demand_multiplier, 2) for q in series.qty]
        eff = with_route(inv_params, req.route_code)
        eff = with_objective(eff, req.objective_mode)
        if req.lead_prod_override is not None:
            eff.lead_prod = req.lead_prod_override
        if req.review_period_override is not None:
            eff.review_period = req.review_period_override
        if req.service_level_override is not None:
            eff.service_level = req.service_level_override

        sug = build_suggestion(
            series, eff, on_hand=on_hand, in_transit=in_transit, inbound_batches=inbound_batches
        )
        return {
            "sku": req.sku,
            "product_name": prod.name,
            "route_code": req.route_code,
            "objective_mode": req.objective_mode,
            "lead_time_total": eff.lead_time,
            "review_period": eff.review_period,
            "service_level": round(sug.service_level, 4),
            "ss": round(sug.ss, 2),
            "rop": round(sug.rop, 2),
            "target_s": round(sug.target_s, 2),
            "qty_suggest": sug.qty,
            "amount_rmb": sug.amount,
            "stockout_forward": sug.inputs_json.get("stockout_forward"),
        }

    async def list_applies(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M6ReplenishApply)
                .where(M6ReplenishApply.org_id == org_id)
                .order_by(M6ReplenishApply.created_at.desc())
            )
        ).all()
        return [
            {
                "apply_id": r.apply_id,
                "sku": r.sku,
                "route_code": r.route_code,
                "objective_mode": r.objective_mode,
                "qty_suggest": r.qty_suggest,
                "qty_propose": r.qty_propose,
                "est_amount_rmb": r.est_amount_rmb,
                "status": r.status,
                "status_label": STATUS_LABELS.get(r.status, r.status),
                "submit_user": r.submit_user,
                "approve_user": r.approve_user,
                "reject_reason": r.reject_reason,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]

    async def create_apply(
        self, session: AsyncSession, org_id: str, req: ApplyCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        calc = await self.get_forecast_and_suggestion(
            session, org_id, req.sku, route_code=req.route_code, objective_mode=req.objective_mode
        )
        sug = calc["suggestion"]
        prod = await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == req.sku))
        unit_cost = round(float(prod.unit_cost_usd) * 7.2, 2) if prod else 40.0
        apply_id = f"{APPLY_ID_PREFIX}{uuid.uuid4().hex[:8]}"
        session.add(
            M6ReplenishApply(
                apply_id=apply_id,
                org_id=org_id,
                sku=req.sku,
                route_code=req.route_code,
                objective_mode=req.objective_mode,
                qty_suggest=int(sug["qty"]),
                qty_propose=req.qty_propose,
                est_amount_rmb=round(req.qty_propose * unit_cost, 2),
                status="draft",
                snapshot_json=sug,
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M6",
            action="REPLENISH_APPLY_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 创建补货申请 {apply_id}（{req.sku}, {req.route_code}/{req.objective_mode}, {req.qty_propose}件）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"apply_id": apply_id, "status": "draft"}

    async def submit_apply_flow(
        self, session: AsyncSession, org_id: str, apply_id: str, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id, M6ReplenishApply.apply_id == apply_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到补货申请: {apply_id}", http_status=404)
        try:
            res = submit_apply(
                {
                    "status": row.status,
                    "qty_propose": row.qty_propose,
                    "route_code": row.route_code,
                    "objective_mode": row.objective_mode,
                },
                submit_user=actor.user_id,
                now=_now_utc(),
            )
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)
        row.status = res["status"]
        row.submit_user = res["submit_user"]
        row.submit_at = res["submit_at"]
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M6",
            action="REPLENISH_APPLY_SUBMITTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 提交补货申请 {apply_id} 等待审批",
            trace_id=trace_id,
        )
        await session.commit()
        return {"apply_id": apply_id, "status": row.status}

    async def approve_apply_flow(
        self, session: AsyncSession, org_id: str, apply_id: str, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id, M6ReplenishApply.apply_id == apply_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到补货申请: {apply_id}", http_status=404)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and row.submit_user == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：补货申请提交人禁止自批", http_status=403)
        prod = await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == row.sku))
        lead_days = route_lead_time(row.route_code, max(int(prod.lead_time_days if prod else 12) - 9, 4))
        po_id = f"{PO_ID_PREFIX}{uuid.uuid4().hex[:8]}"
        try:
            out = approve_apply(
                {"apply_id": row.apply_id, "sku_id": row.sku, "status": row.status, "qty_propose": row.qty_propose},
                approve_user=actor.user_id,
                now=_now_utc(),
                po_id=po_id,
                lead_time_days=lead_days,
            )
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)

        row.status = out["apply"]["status"]
        row.approve_user = out["apply"]["approve_user"]
        row.approve_at = out["apply"]["approve_at"]
        row.reject_reason = None
        po_data = out["purchase_order"]
        session.add(
            M6PurchaseOrder(
                po_id=po_data["po_id"],
                org_id=org_id,
                apply_id=row.apply_id,
                sku=row.sku,
                route_code=row.route_code,
                order_qty=po_data["order_qty"],
                receive_qty=0,
                defect_qty=0,
                status=po_data["status"],
                expect_arrive=po_data["expect_arrive"],
            )
        )
        inv_row = await session.scalar(
            select(M0Inventory).where(M0Inventory.org_id == org_id, M0Inventory.sku == row.sku)
        )
        if inv_row:
            inv_row.in_transit += po_data["order_qty"]
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M6",
            action="REPLENISH_APPLY_APPROVED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 审批通过补货申请 {apply_id} 并生成采购单 {po_id}（{po_data['order_qty']}件）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"apply_id": apply_id, "status": row.status, "po_id": po_id}

    async def reject_apply_flow(
        self, session: AsyncSession, org_id: str, apply_id: str, req: ApplyRejectReq, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id, M6ReplenishApply.apply_id == apply_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到补货申请: {apply_id}", http_status=404)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and row.submit_user == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：补货申请提交人禁止自批驳回", http_status=403)
        try:
            res = reject_apply(
                {"status": row.status}, approve_user=actor.user_id, now=_now_utc(), reject_reason=req.reason
            )
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)
        row.status = res["status"]
        row.approve_user = res["approve_user"]
        row.approve_at = res["approve_at"]
        row.reject_reason = res["reject_reason"]
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M6",
            action="REPLENISH_APPLY_REJECTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 驳回补货申请 {apply_id}：{req.reason}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"apply_id": apply_id, "status": row.status}

    async def list_pos(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id).order_by(M6PurchaseOrder.created_at.desc())
            )
        ).all()
        return [
            {
                "po_id": r.po_id,
                "apply_id": r.apply_id,
                "sku": r.sku,
                "route_code": r.route_code,
                "order_qty": r.order_qty,
                "receive_qty": r.receive_qty,
                "defect_qty": r.defect_qty,
                "status": r.status,
                "status_label": STATUS_LABELS.get(r.status, r.status),
                "expect_arrive": r.expect_arrive.isoformat() if r.expect_arrive else None,
                "cancel_reason": r.cancel_reason,
            }
            for r in rows
        ]

    async def ship_po(self, session: AsyncSession, org_id: str, po_id: str, actor: ActorContext, trace_id: str) -> dict:
        po = await session.scalar(
            select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id, M6PurchaseOrder.po_id == po_id)
        )
        if not po:
            raise M7Error("M7-4041", f"未找到采购单: {po_id}", http_status=404)
        try:
            res = mark_shipping({"status": po.status})
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)
        po.status = res["status"]
        await write_audit_event(
            session,
            org_id=org_id,
            sku=po.sku,
            module="M6",
            action="PO_SHIPPED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 将采购单 {po_id} 标记为运输中",
            trace_id=trace_id,
        )
        await session.commit()
        return {"po_id": po_id, "status": po.status}

    async def receive_po(
        self, session: AsyncSession, org_id: str, po_id: str, req: PoReceiveReq, actor: ActorContext, trace_id: str
    ) -> dict:
        po = await session.scalar(
            select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id, M6PurchaseOrder.po_id == po_id)
        )
        if not po:
            raise M7Error("M7-4041", f"未找到采购单: {po_id}", http_status=404)
        try:
            out = receive_goods(
                {"status": po.status, "order_qty": po.order_qty, "receive_qty": po.receive_qty, "defect_qty": po.defect_qty},
                receive_qty=req.receive_qty,
                defect_qty=req.defect_qty,
                now=_now_utc(),
            )
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)
        po_upd = out["purchase_order"]
        po.status = po_upd["status"]
        po.receive_qty = po_upd["receive_qty"]
        po.defect_qty = po_upd["defect_qty"]
        po.actual_arrive = po_upd["actual_arrive"]

        # Update warehouse stock: good units move from in_transit -> on_hand
        good_units = max(0, req.receive_qty - req.defect_qty)
        inv_row = await session.scalar(
            select(M0Inventory).where(M0Inventory.org_id == org_id, M0Inventory.sku == po.sku)
        )
        if inv_row:
            inv_row.on_hand += good_units
            inv_row.in_transit = max(0, inv_row.in_transit - req.receive_qty)

        if out["fully_received"]:
            app_row = await session.scalar(
                select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id, M6ReplenishApply.apply_id == po.apply_id)
            )
            if app_row and app_row.status == "approved":
                closed = close_apply({"status": app_row.status, "approve_at": app_row.approve_at}, now=_now_utc())
                app_row.status = closed["status"]

        await write_audit_event(
            session,
            org_id=org_id,
            sku=po.sku,
            module="M6",
            action="PO_RECEIVED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 对采购单 {po_id} 质检收货 {req.receive_qty} 件（不良 {req.defect_qty} 件），状态：{po.status}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"po_id": po_id, "status": po.status, "receive_qty": po.receive_qty, "remaining_qty": out["remaining_qty"]}

    async def cancel_po(
        self, session: AsyncSession, org_id: str, po_id: str, req: PoCancelReq, actor: ActorContext, trace_id: str
    ) -> dict:
        po = await session.scalar(
            select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id, M6PurchaseOrder.po_id == po_id)
        )
        if not po:
            raise M7Error("M7-4041", f"未找到采购单: {po_id}", http_status=404)
        remaining = max(0, po.order_qty - po.receive_qty)
        try:
            res = cancel_purchase_order({"status": po.status}, cancel_user=actor.user_id, now=_now_utc(), reason=req.reason)
        except FlowError as exc:
            raise M7Error(exc.code, exc.message, http_status=422)
        po.status = res["status"]
        po.cancel_reason = res["cancel_reason"]
        inv_row = await session.scalar(
            select(M0Inventory).where(M0Inventory.org_id == org_id, M0Inventory.sku == po.sku)
        )
        if inv_row:
            inv_row.in_transit = max(0, inv_row.in_transit - remaining)
        await write_audit_event(
            session,
            org_id=org_id,
            sku=po.sku,
            module="M6",
            action="PO_CANCELLED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 取消采购单 {po_id}：{req.reason}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"po_id": po_id, "status": po.status}

    async def list_alerts(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M6AlertEvent).where(M6AlertEvent.org_id == org_id).order_by(M6AlertEvent.created_at.desc())
            )
        ).all()
        return [
            {
                "alert_id": r.alert_id,
                "sku": r.sku,
                "severity": r.severity,
                "alert_type": r.alert_type,
                "message": r.message,
                "status": r.status,
                "ack_by": r.ack_by,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]

    async def ack_alert(self, session: AsyncSession, org_id: str, alert_id: str, actor: ActorContext, trace_id: str) -> dict:
        row = await session.scalar(
            select(M6AlertEvent).where(M6AlertEvent.org_id == org_id, M6AlertEvent.alert_id == alert_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到告警事件: {alert_id}", http_status=404)
        row.status = "ACKED"
        row.ack_by = actor.user_id
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M6",
            action="ALERT_ACKED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 确认处理告警 {alert_id}（{row.sku}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"alert_id": alert_id, "status": "ACKED"}

    async def list_weekly_reviews(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(
                select(M6WeeklyReview).where(M6WeeklyReview.org_id == org_id).order_by(M6WeeklyReview.created_at.desc())
            )
        ).all()
        return [
            {
                "review_id": r.review_id,
                "week_label": r.week_label,
                "summary_text": r.summary_text,
                "metrics": r.metrics_json or {},
                "is_mock": r.is_mock,
                "created_by": r.created_by,
            }
            for r in rows
        ]

    async def create_weekly_review(
        self, session: AsyncSession, org_id: str, req: WeeklyReviewCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        rid = f"rev_{uuid.uuid4().hex[:8]}"
        pos = await self.list_pos(session, org_id)
        alerts = await self.list_alerts(session, org_id)
        metrics = {
            "total_pos": len(pos),
            "fully_received": sum(1 for p in pos if p["status"] == "fully_received"),
            "open_alerts": sum(1 for a in alerts if a["status"] == "OPEN"),
        }
        session.add(
            M6WeeklyReview(
                review_id=rid,
                org_id=org_id,
                week_label=req.week_label,
                summary_text=req.summary_text,
                metrics_json=metrics,
                is_mock=False,
                created_by=actor.user_id,
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            module="M6",
            action="WEEKLY_REVIEW_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 生成供应链周度复盘归档 {req.week_label}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"review_id": rid, "metrics": metrics}

    async def import_sales_csv(
        self, session: AsyncSession, org_id: str, req: SalesHistoryCsvReq, actor: ActorContext, trace_id: str
    ) -> dict:
        import csv
        import io

        fn_low = (req.filename or "").lower()
        if any(k in fn_low for k in ("mock", "demo", "演示", "测试")):
            raise M7Error("M7-4221", f"文件名「{req.filename}」含演示/测试字样，禁止导入实盘销量历史", http_status=422)

        reader = csv.DictReader(io.StringIO(req.csv_text.strip()))
        imported = 0
        errors: list[dict] = []
        for idx, row in enumerate(reader, start=2):
            sku = (row.get("sku") or "").strip().upper()
            d_str = (row.get("sales_date") or row.get("date") or "").strip()
            if not sku or not d_str:
                errors.append({"line": idx, "message": "缺少 sku 或 sales_date"})
                continue
            try:
                s_date = date.fromisoformat(d_str)
                qty = float(row.get("qty_raw") or row.get("qty") or 0)
                eod = float(row.get("on_hand_eod") or 0)
                rev = float(row.get("revenue_usd") or 0)
            except (TypeError, ValueError):
                errors.append({"line": idx, "message": f"{sku} {d_str} 日期或数值非法"})
                continue
            if qty < 0 or eod < 0:
                errors.append({"line": idx, "message": f"{sku} {d_str} 销量或库存不能为负"})
                continue

            existing = await session.scalar(
                select(M5SalesHistory).where(
                    M5SalesHistory.org_id == org_id,
                    M5SalesHistory.sku == sku,
                    M5SalesHistory.sales_date == s_date,
                )
            )
            if existing:
                existing.qty_raw = qty
                existing.on_hand_eod = eod
                existing.revenue_usd = rev
            else:
                session.add(
                    M5SalesHistory(
                        org_id=org_id,
                        sku=sku,
                        sales_date=s_date,
                        qty_raw=qty,
                        on_hand_eod=eod,
                        revenue_usd=rev,
                    )
                )
            imported += 1

        await write_audit_event(
            session,
            org_id=org_id,
            module="M5",
            action="SALES_HISTORY_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导入 {imported} 条日度销量与期末库存流水",
            trace_id=trace_id,
        )
        await session.commit()
        return {"imported": imported, "errors": errors}

    async def update_sku_supply_params(
        self, session: AsyncSession, org_id: str, sku: str, req: SkuSupplyParamsReq, actor: ActorContext, trace_id: str
    ) -> dict:
        sku_norm = sku.strip().upper()
        prod = await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == sku_norm))
        if not prod:
            raise M7Error("M7-4041", f"未找到 SKU 主档: {sku_norm}", http_status=404)
        prod.moq = req.moq
        prod.pack_size = req.pack_size
        prod.lead_time_days = req.lead_time_days
        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku_norm,
            module="M5",
            action="SKU_SUPPLY_PARAMS_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 调整 {sku_norm} 补货参数（MOQ={req.moq}，整箱={req.pack_size}，交期={req.lead_time_days}天）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"sku": sku_norm, "moq": prod.moq, "pack_size": prod.pack_size, "lead_time_days": prod.lead_time_days}

    async def scan_alerts(self, session: AsyncSession, org_id: str, actor: ActorContext, trace_id: str) -> dict:
        created = 0
        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        open_alerts = (
            await session.scalars(
                select(M6AlertEvent).where(M6AlertEvent.org_id == org_id, M6AlertEvent.status == "OPEN")
            )
        ).all()
        open_keys = {(a.sku, a.alert_type) for a in open_alerts}

        for p in prods:
            try:
                fc = await self.get_forecast_and_suggestion(session, org_id, p.sku)
                fwd = (fc.get("suggestion", {}).get("inputs_json") or {}).get("stockout_forward") or {}
                if (fwd.get("zero_days") or 0) > 0 and (p.sku, "STOCKOUT_RISK") not in open_keys:
                    session.add(
                        M6AlertEvent(
                            alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                            org_id=org_id,
                            sku=p.sku,
                            severity="HIGH",
                            alert_type="STOCKOUT_RISK",
                            message=f"未来 90 天预计断货 {fwd.get('zero_days')} 天（首次见底：{fwd.get('first_zero_date')}），建议按 ROP={fc['suggestion']['rop']} 及时补货",
                            status="OPEN",
                        )
                    )
                    open_keys.add((p.sku, "STOCKOUT_RISK"))
                    created += 1
            except M7Error:
                continue

        today = date.today()
        open_pos = (
            await session.scalars(
                select(M6PurchaseOrder).where(
                    M6PurchaseOrder.org_id == org_id,
                    M6PurchaseOrder.status.in_(["created", "shipping", "partial_received"]),
                )
            )
        ).all()
        for po in open_pos:
            if po.expect_arrive and po.expect_arrive < today and (po.sku, "PO_OVERDUE") not in open_keys:
                session.add(
                    M6AlertEvent(
                        alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                        org_id=org_id,
                        sku=po.sku,
                        severity="HIGH",
                        alert_type="PO_OVERDUE",
                        message=f"采购单 {po.po_id} 已逾期（预计到货 {po.expect_arrive}，未收 {po.order_qty - po.receive_qty} 件）",
                        status="OPEN",
                    )
                )
                open_keys.add((po.sku, "PO_OVERDUE"))
                created += 1

        await write_audit_event(
            session,
            org_id=org_id,
            module="M6",
            action="ALERTS_SCANNED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 执行全盘断货与逾期 PO 巡检，新增 {created} 条预警",
            trace_id=trace_id,
        )
        await session.commit()
        return {"created": created}
