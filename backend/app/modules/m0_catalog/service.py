import csv
import io
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import (
    M0CostRequest,
    M0Inventory,
    M0Order,
    M0Product,
    M0Shop,
    M0SupplierQuote,
)
from app.modules.m0_catalog.schemas import (
    CostDecisionReq,
    CostProposeReq,
    ProductCreateReq,
    ShopCreateReq,
    StocktakeReq,
)


class M0CatalogService:
    async def list_shops(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id).order_by(M0Shop.shop_code))
        ).all()
        return [
            {
                "shop_id": r.shop_id,
                "shop_code": r.shop_code,
                "name": r.name,
                "platform": r.platform,
                "currency": r.currency,
                "is_mock": r.is_mock,
                "status": r.status,
            }
            for r in rows
        ]

    async def create_shop(
        self, session: AsyncSession, org_id: str, req: ShopCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        shop_id = f"shop_{uuid.uuid4().hex[:10]}"
        shop = M0Shop(
            shop_id=shop_id,
            org_id=org_id,
            shop_code=req.shop_code,
            name=req.name,
            platform=req.platform,
            currency=req.currency,
            is_mock=req.is_mock,
            status="CONNECTED",
        )
        session.add(shop)
        await write_audit_event(
            session,
            org_id=org_id,
            module="M0",
            action="SHOP_CONNECTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 连接了店铺 {req.name}（{req.platform}，{'演示隔离' if req.is_mock else '实盘'}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"shop_id": shop_id, "shop_code": req.shop_code, "status": "CONNECTED"}

    async def list_products(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M0Product).where(M0Product.org_id == org_id).order_by(M0Product.sku))
        ).all()
        return [
            {
                "product_id": r.product_id,
                "sku": r.sku,
                "name": r.name,
                "category": r.category,
                "category_label_zh": r.category_label_zh,
                "platform": r.platform,
                "brand_name": r.brand_name,
                "sale_price_usd": r.sale_price_usd,
                "strike_price_usd": r.strike_price_usd,
                "unit_cost_usd": r.unit_cost_usd,
                "moq": r.moq,
                "pack_size": r.pack_size,
                "lead_time_days": r.lead_time_days,
                "origin": r.origin,
                "approver": r.approver,
                "decision_reason": r.decision_reason,
                "specs": r.specs_json or {},
                "selling_points": r.selling_points_json or [],
            }
            for r in rows
        ]

    async def upsert_product(
        self, session: AsyncSession, org_id: str, req: ProductCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        existing = await session.scalar(
            select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == req.sku)
        )
        if existing:
            existing.name = req.name
            existing.category = req.category
            existing.category_label_zh = req.category_label_zh
            existing.platform = req.platform
            existing.brand_name = req.brand_name
            existing.sale_price_usd = req.sale_price_usd
            existing.strike_price_usd = req.strike_price_usd
            existing.unit_cost_usd = req.unit_cost_usd
            existing.moq = req.moq
            existing.pack_size = req.pack_size
            existing.lead_time_days = req.lead_time_days
            existing.specs_json = req.specs
            existing.selling_points_json = req.selling_points
            pid = existing.product_id
        else:
            pid = f"prd_{uuid.uuid4().hex[:10]}"
            session.add(
                M0Product(
                    product_id=pid,
                    org_id=org_id,
                    sku=req.sku,
                    name=req.name,
                    category=req.category,
                    category_label_zh=req.category_label_zh,
                    platform=req.platform,
                    brand_name=req.brand_name,
                    sale_price_usd=req.sale_price_usd,
                    strike_price_usd=req.strike_price_usd,
                    unit_cost_usd=req.unit_cost_usd,
                    moq=req.moq,
                    pack_size=req.pack_size,
                    lead_time_days=req.lead_time_days,
                    specs_json=req.specs,
                    selling_points_json=req.selling_points,
                )
            )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M0",
            action="PRODUCT_SAVED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 维护了商品主档 {req.sku}（{req.name}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"product_id": pid, "sku": req.sku}

    async def list_orders_and_quotes(self, session: AsyncSession, org_id: str) -> dict:
        orders = (
            await session.scalars(select(M0Order).where(M0Order.org_id == org_id).order_by(M0Order.order_date.desc()).limit(100))
        ).all()
        quotes = (
            await session.scalars(select(M0SupplierQuote).where(M0SupplierQuote.org_id == org_id).order_by(M0SupplierQuote.sku))
        ).all()
        cost_reqs = (
            await session.scalars(select(M0CostRequest).where(M0CostRequest.org_id == org_id).order_by(M0CostRequest.created_at.desc()))
        ).all()
        return {
            "orders": [
                {
                    "order_id": o.order_id,
                    "shop_id": o.shop_id,
                    "sku": o.sku,
                    "order_date": o.order_date,
                    "qty": o.qty,
                    "revenue_usd": o.revenue_usd,
                    "is_mock": o.is_mock,
                    "status": o.status,
                }
                for o in orders
            ],
            "quotes": [
                {
                    "quote_id": q.quote_id,
                    "sku": q.sku,
                    "supplier_name": q.supplier_name,
                    "unit_price_rmb": q.unit_price_rmb,
                    "moq": q.moq,
                    "lead_time_days": q.lead_time_days,
                    "is_simulated": q.is_simulated,
                    "note": q.note,
                }
                for q in quotes
            ],
            "cost_requests": [
                {
                    "req_id": c.req_id,
                    "sku": c.sku,
                    "old_cost_usd": c.old_cost_usd,
                    "new_cost_usd": c.new_cost_usd,
                    "reason": c.reason,
                    "status": c.status,
                    "proposer_id": c.proposer_id,
                    "reviewer_id": c.reviewer_id,
                }
                for c in cost_reqs
            ],
        }

    async def propose_cost_change(
        self, session: AsyncSession, org_id: str, req: CostProposeReq, actor: ActorContext, trace_id: str
    ) -> dict:
        prod = await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == req.sku))
        if not prod:
            raise M7Error("M7-4041", f"未找到 SKU: {req.sku}", http_status=404)
        req_id = f"cst_{uuid.uuid4().hex[:10]}"
        session.add(
            M0CostRequest(
                req_id=req_id,
                org_id=org_id,
                sku=req.sku,
                old_cost_usd=prod.unit_cost_usd,
                new_cost_usd=req.new_cost_usd,
                reason=req.reason,
                status="PENDING",
                proposer_id=actor.user_id,
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M0",
            action="COST_CHANGE_PROPOSED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 发起 {req.sku} 成本调整申请（${prod.unit_cost_usd} -> ${req.new_cost_usd}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"req_id": req_id, "status": "PENDING"}

    async def decide_cost_change(
        self, session: AsyncSession, org_id: str, req_id: str, req: CostDecisionReq, actor: ActorContext, trace_id: str
    ) -> dict:
        cr = await session.scalar(select(M0CostRequest).where(M0CostRequest.org_id == org_id, M0CostRequest.req_id == req_id))
        if not cr:
            raise M7Error("M7-4041", f"未找到成本申请: {req_id}", http_status=404)
        if get_settings().M7_STRICT_SEPARATION_OF_DUTIES and cr.proposer_id == actor.user_id:
            raise M7Error("M7-4032", "违反职责分离：发起人禁止自批成本变更", http_status=403)
        cr.status = req.decision
        cr.reviewer_id = actor.user_id
        if req.decision == "APPROVED":
            prod = await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == cr.sku))
            if prod:
                prod.unit_cost_usd = cr.new_cost_usd
        await write_audit_event(
            session,
            org_id=org_id,
            sku=cr.sku,
            module="M0",
            action="COST_CHANGE_DECIDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} {'批准' if req.decision == 'APPROVED' else '驳回'}了 {cr.sku} 成本变更申请",
            trace_id=trace_id,
        )
        await session.commit()
        return {"req_id": req_id, "status": cr.status}

    async def list_inventory(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M0Inventory).where(M0Inventory.org_id == org_id).order_by(M0Inventory.sku))
        ).all()
        return [
            {
                "inv_id": r.inv_id,
                "warehouse_code": r.warehouse_code,
                "sku": r.sku,
                "on_hand": r.on_hand,
                "in_transit": r.in_transit,
                "reserved": r.reserved,
                "available": max(0, r.on_hand - r.reserved),
                "last_stocktake_by": r.last_stocktake_by,
            }
            for r in rows
        ]

    async def submit_stocktake(
        self, session: AsyncSession, org_id: str, req: StocktakeReq, actor: ActorContext, trace_id: str
    ) -> dict:
        inv = await session.scalar(
            select(M0Inventory).where(
                M0Inventory.org_id == org_id,
                M0Inventory.warehouse_code == req.warehouse_code,
                M0Inventory.sku == req.sku,
            )
        )
        if inv:
            old_qty = inv.on_hand
            inv.on_hand = req.counted_qty
            inv.last_stocktake_by = actor.user_id
        else:
            old_qty = 0
            inv = M0Inventory(
                inv_id=f"inv_{uuid.uuid4().hex[:10]}",
                org_id=org_id,
                warehouse_code=req.warehouse_code,
                sku=req.sku,
                on_hand=req.counted_qty,
                in_transit=0,
                reserved=0,
                last_stocktake_by=actor.user_id,
            )
            session.add(inv)
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M0",
            action="STOCKTAKE_CALIBRATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 完成 {req.warehouse_code} / {req.sku} 人工盘点（{old_qty} -> {req.counted_qty}，原因：{req.reason}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"sku": req.sku, "warehouse_code": req.warehouse_code, "on_hand": req.counted_qty}

    async def import_csv_orders(
        self, session: AsyncSession, org_id: str, csv_text: str, actor: ActorContext, trace_id: str
    ) -> dict:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        imported = 0
        for row in reader:
            sku = (row.get("sku") or "").strip()
            if not sku:
                continue
            qty = int(float(row.get("qty") or row.get("qty_raw") or 1))
            rev = float(row.get("revenue") or row.get("revenue_usd") or qty * 20.0)
            dt = (row.get("date") or row.get("order_date") or "2026-11-18")[:10]
            session.add(
                M0Order(
                    order_id=f"ord_{uuid.uuid4().hex[:12]}",
                    org_id=org_id,
                    shop_id="shop_amz_us",
                    sku=sku,
                    order_date=dt,
                    qty=qty,
                    revenue_usd=rev,
                    is_mock=True,
                    status="PAID",
                )
            )
            imported += 1
        await write_audit_event(
            session,
            org_id=org_id,
            module="M0",
            action="CSV_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导入了 {imported} 条历史订单 CSV 记录",
            trace_id=trace_id,
        )
        await session.commit()
        return {"imported": imported}
