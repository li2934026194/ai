from datetime import datetime, timezone
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
    M0FxRate,
    M0Inventory,
    M0Order,
    M0Product,
    M0Shop,
    M0SupplierQuote,
    M0SyncBatch,
)
from app.modules.m0_catalog.schemas import (
    CostDecisionReq,
    CostProposeReq,
    ProductCreateReq,
    ShopCreateReq,
    StocktakeReq,
)


class M0CatalogService:
    async def list_shops(self, session: AsyncSession, org_id: str, actor: ActorContext | None = None) -> list[dict]:
        rows = (
            await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id).order_by(M0Shop.shop_code))
        ).all()
        if actor and actor.allowed_shop_ids:
            allowed = set(actor.allowed_shop_ids)
            rows = [r for r in rows if r.shop_id in allowed or r.shop_code in allowed]
        batches = (
            await session.scalars(
                select(M0SyncBatch).where(M0SyncBatch.org_id == org_id).order_by(M0SyncBatch.created_at.desc())
            )
        ).all()
        latest_batch: dict[str, M0SyncBatch] = {}
        for b in batches:
            if b.shop_id not in latest_batch:
                latest_batch[b.shop_id] = b
        return [
            {
                "shop_id": r.shop_id,
                "shop_code": r.shop_code,
                "name": r.name,
                "platform": r.platform,
                "currency": r.currency,
                "credential_mask": r.credential_mask,
                "is_mock": r.is_mock,
                "status": r.status,
                "last_sync_at": r.last_sync_at.isoformat() if r.last_sync_at else "",
                "last_batch": {
                    "batch_id": latest_batch[r.shop_id].batch_id,
                    "added_count": latest_batch[r.shop_id].added_count,
                    "dedup_count": latest_batch[r.shop_id].dedup_count,
                    "error_count": latest_batch[r.shop_id].error_count,
                    "missing_dates": latest_batch[r.shop_id].missing_dates_json,
                    "status": latest_batch[r.shop_id].status,
                }
                if r.shop_id in latest_batch
                else None,
            }
            for r in rows
        ]

    async def create_shop(
        self, session: AsyncSession, org_id: str, req: ShopCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        existing = await session.scalar(
            select(M0Shop).where(M0Shop.org_id == org_id, M0Shop.shop_code == req.shop_code)
        )
        if existing:
            raise M7Error("M7-4091", f"店铺代码已存在: {req.shop_code}", http_status=409)
        shop_id = f"shop_{uuid.uuid4().hex[:10]}"
        shop = M0Shop(
            shop_id=shop_id,
            org_id=org_id,
            shop_code=req.shop_code,
            name=req.name,
            platform=req.platform,
            currency=req.currency,
            credential_mask=req.credential_mask,
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

    async def sync_shop(
        self, session: AsyncSession, org_id: str, shop_id: str, actor: ActorContext, trace_id: str
    ) -> dict:
        shop = await session.scalar(select(M0Shop).where(M0Shop.org_id == org_id, M0Shop.shop_id == shop_id))
        if not shop:
            raise M7Error("M7-4041", f"未找到店铺: {shop_id}", http_status=404)
        batch_id = f"bat_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc)
        if shop.status != "CONNECTED":
            missing_dates = [now.date().isoformat()]
            batch = M0SyncBatch(
                batch_id=batch_id,
                org_id=org_id,
                shop_id=shop_id,
                added_count=0,
                dedup_count=0,
                error_count=1,
                missing_dates_json=missing_dates,
                status="AUTH_FAILED",
                triggered_by=actor.user_id,
            )
            session.add(batch)
            await write_audit_event(
                session,
                org_id=org_id,
                module="M0",
                action="SHOP_SYNC_FAILED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name} 触发店铺 {shop.shop_code} 同步失败（授权状态={shop.status}，缺失日期保留未填零）",
                trace_id=trace_id,
            )
            await session.commit()
            return {"batch_id": batch_id, "status": "AUTH_FAILED", "missing_dates": missing_dates}

        shop.last_sync_at = now
        existing_orders = (
            await session.scalars(select(M0Order.order_id).where(M0Order.org_id == org_id, M0Order.shop_id == shop_id))
        ).all()
        batch = M0SyncBatch(
            batch_id=batch_id,
            org_id=org_id,
            shop_id=shop_id,
            added_count=0,
            dedup_count=len(existing_orders),
            error_count=0,
            missing_dates_json=[],
            status="SUCCESS",
            triggered_by=actor.user_id,
        )
        session.add(batch)
        await write_audit_event(
            session,
            org_id=org_id,
            module="M0",
            action="SHOP_SYNCED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 同步店铺 {shop.shop_code} 完成（新增 0 单，去重跳过 {len(existing_orders)} 单）",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "batch_id": batch_id,
            "status": "SUCCESS",
            "added_count": 0,
            "dedup_count": len(existing_orders),
            "error_count": 0,
            "missing_dates": [],
        }

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

    async def list_orders_and_quotes(
        self, session: AsyncSession, org_id: str, actor: ActorContext | None = None
    ) -> dict:
        orders = (
            await session.scalars(select(M0Order).where(M0Order.org_id == org_id).order_by(M0Order.order_date.desc()).limit(100))
        ).all()
        if actor and actor.allowed_shop_ids:
            allowed_shops = (
                await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id))
            ).all()
            allowed_ids = {
                s.shop_id for s in allowed_shops if s.shop_id in actor.allowed_shop_ids or s.shop_code in actor.allowed_shop_ids
            } | set(actor.allowed_shop_ids)
            orders = [o for o in orders if o.shop_id in allowed_ids]
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
                "available": r.on_hand,
                "last_stocktake_by": r.last_stocktake_by,
            }
            for r in rows
        ]

    async def list_fx_rates(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M0FxRate).where(M0FxRate.org_id == org_id).order_by(M0FxRate.currency))
        ).all()
        return [
            {
                "rate_id": r.rate_id,
                "currency": r.currency,
                "rate_to_usd": r.rate_to_usd,
                "rate_source": r.rate_source,
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
        self,
        session: AsyncSession,
        org_id: str,
        csv_text: str,
        actor: ActorContext,
        trace_id: str,
        filename: str = "",
        source_type: str = "auto",
    ) -> dict:
        fn_lower = (filename or "").lower()
        mock_filename_hint = any(k in fn_lower for k in ("mock", "demo", "演示", "测试"))
        if source_type == "live" and mock_filename_hint:
            raise M7Error("M7-4221", f"文件名「{filename}」包含演示/测试标识，禁止作为实盘订单导入", http_status=422)

        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        shop_rows = (await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id))).all()
        shop_mock_map = {s.shop_id: s.is_mock for s in shop_rows}
        existing_oids = set(
            (await session.scalars(select(M0Order.order_id).where(M0Order.org_id == org_id))).all()
        )

        imported = 0
        skipped_duplicates = 0
        errors: list[dict] = []

        for line_no, row in enumerate(reader, start=2):
            sku = (row.get("sku") or "").strip().upper()
            if not sku:
                errors.append({"line": line_no, "message": "缺少 SKU"})
                continue
            raw_oid = (row.get("order_id") or "").strip()
            oid = raw_oid or f"ord_{uuid.uuid4().hex[:12]}"
            if oid in existing_oids:
                skipped_duplicates += 1
                continue
            try:
                qty = int(float(row.get("qty") or row.get("qty_raw") or 0))
                rev = float(row.get("revenue_usd") or row.get("revenue") or -1)
            except (TypeError, ValueError):
                errors.append({"line": line_no, "message": f"数字格式非法（sku={sku}）"})
                continue
            if qty <= 0 or rev < 0:
                errors.append({"line": line_no, "message": f"数量须大于 0 且营收非负（qty={qty}, rev={rev}）"})
                continue

            shop_id = (row.get("shop_id") or f"shop_amz_us_{org_id}").strip()
            raw_mock = (row.get("is_mock") or "").strip().lower()
            if source_type == "mock" or mock_filename_hint:
                is_mock = True
            elif raw_mock in ("true", "1", "yes"):
                is_mock = True
            elif raw_mock in ("false", "0", "no"):
                is_mock = False
            else:
                is_mock = shop_mock_map.get(shop_id, False)

            dt = (row.get("order_date") or row.get("date") or "2026-11-18")[:10]
            st = (row.get("status") or "SETTLED").strip().upper()
            session.add(
                M0Order(
                    order_id=oid,
                    org_id=org_id,
                    shop_id=shop_id,
                    sku=sku,
                    order_date=dt,
                    qty=qty,
                    revenue_usd=round(rev, 2),
                    is_mock=is_mock,
                    status=st,
                )
            )
            existing_oids.add(oid)
            imported += 1

        await write_audit_event(
            session,
            org_id=org_id,
            module="M0",
            action="CSV_IMPORTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 导入订单 CSV（新增 {imported} 单，去重跳过 {skipped_duplicates} 单，错误 {len(errors)} 行）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"imported": imported, "skipped_duplicates": skipped_duplicates, "errors": errors}
