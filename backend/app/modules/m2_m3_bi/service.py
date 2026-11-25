import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Inventory, M0Order, M0Product, M0Shop
from app.modules.m1_cs.models import M1AftersalesTicket
from app.modules.m2_m3_bi.models import M2AdCampaign, M3CompetitorWatch
from app.modules.m2_m3_bi.schemas import AdAdjustReq, CompetitorCreateReq
from app.modules.m5_m6_supply.models import M5SalesHistory, M6AlertEvent, M6PurchaseOrder, M6ReplenishApply


class M2M3BiService:
    async def get_home_workbench(self, session: AsyncSession, org_id: str) -> dict:
        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        shops = (await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id))).all()
        applies = (await session.scalars(select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id))).all()
        alerts = (await session.scalars(select(M6AlertEvent).where(M6AlertEvent.org_id == org_id, M6AlertEvent.status == "OPEN"))).all()
        tickets = (await session.scalars(select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id, M1AftersalesTicket.status == "PENDING_APPROVAL"))).all()
        orders = (await session.scalars(select(M0Order).where(M0Order.org_id == org_id))).all()
        gmv = round(sum(float(o.revenue_usd) for o in orders), 2)
        return {
            "kpis": {
                "active_skus": len(prods),
                "connected_shops": len(shops),
                "gmv_usd": gmv,
                "open_alerts": len(alerts),
                "pending_replenish": sum(1 for a in applies if a.status == "pending_approve"),
                "pending_aftersales": len(tickets),
            },
            "todos": [
                {
                    "id": "todo-m4",
                    "module": "M4",
                    "title": "新品选品过会审批",
                    "desc": "查看待评估与待审批的选品池 SKU",
                    "route": "/m4/approval",
                },
                {
                    "id": "todo-m6",
                    "module": "M6",
                    "title": f"补货申请审批（{sum(1 for a in applies if a.status == 'pending_approve')} 条待审）",
                    "desc": "确认采购建议与物流路线后下达 PO",
                    "route": "/m6/applies",
                },
                {
                    "id": "todo-m7",
                    "module": "M7",
                    "title": "上架合规与多渠道内容发布",
                    "desc": "核对合规门禁清单与多语种 Listing 包",
                    "route": "/m7/publish",
                },
                {
                    "id": "todo-m1",
                    "module": "M1",
                    "title": f"售后退款审批（{len(tickets)} 条待审）",
                    "desc": "核对买家凭证后完成退款裁定",
                    "route": "/m1/aftersales",
                },
            ],
        }

    async def get_m2_overview(self, session: AsyncSession, org_id: str) -> dict:
        orders = (await session.scalars(select(M0Order).where(M0Order.org_id == org_id))).all()
        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        inv = (await session.scalars(select(M0Inventory).where(M0Inventory.org_id == org_id))).all()
        ads = (await session.scalars(select(M2AdCampaign).where(M2AdCampaign.org_id == org_id))).all()
        hist = (await session.scalars(select(M5SalesHistory).where(M5SalesHistory.org_id == org_id))).all()
        pos = (await session.scalars(select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id))).all()
        tickets = (await session.scalars(select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id))).all()

        prod_map = {p.sku: p for p in prods}
        inv_map = {i.sku: i for i in inv}

        # Product & Profit breakdown from real orders + cost
        by_sku: dict[str, dict] = {}
        for o in orders:
            entry = by_sku.setdefault(
                o.sku,
                {
                    "sku": o.sku,
                    "name": prod_map[o.sku].name if o.sku in prod_map else o.sku,
                    "units": 0,
                    "gmv_usd": 0.0,
                    "cogs_usd": 0.0,
                    "platform_fee_usd": 0.0,
                    "net_profit_usd": 0.0,
                    "on_hand": inv_map[o.sku].on_hand if o.sku in inv_map else 0,
                },
            )
            p = prod_map.get(o.sku)
            unit_cost_usd = float(p.unit_cost_usd) if p else 6.0
            entry["units"] += int(o.qty)
            entry["gmv_usd"] = round(entry["gmv_usd"] + float(o.revenue_usd), 2)
            entry["cogs_usd"] = round(entry["cogs_usd"] + int(o.qty) * unit_cost_usd, 2)
            entry["platform_fee_usd"] = round(entry["gmv_usd"] * 0.15, 2)
            entry["net_profit_usd"] = round(entry["gmv_usd"] - entry["cogs_usd"] - entry["platform_fee_usd"], 2)

        total_gmv = round(sum(r["gmv_usd"] for r in by_sku.values()), 2)
        total_profit = round(sum(r["net_profit_usd"] for r in by_sku.values()), 2)
        total_ad_spend = round(sum(float(a.spend_7d_usd) for a in ads), 2)
        total_refund = round(sum(float(t.refund_usd) for t in tickets if t.status == "APPROVED"), 2)
        po_commit_rmb = round(sum(p.order_qty * (round(float(prod_map[p.sku].unit_cost_usd) * 7.2, 2) if p.sku in prod_map else 40.0) for p in pos if p.status != "cancelled"), 2)

        # Daily trend from M5SalesHistory
        daily_agg: dict[str, dict] = {}
        for h in hist:
            ds = h.sales_date.isoformat()
            d = daily_agg.setdefault(ds, {"date": ds, "units": 0.0, "revenue_usd": 0.0})
            d["units"] += float(h.qty_raw)
            d["revenue_usd"] = round(d["revenue_usd"] + float(h.revenue_usd), 2)
        trend = sorted(daily_agg.values(), key=lambda x: x["date"])[-30:]

        return {
            "summary": {
                "total_gmv_usd": total_gmv,
                "net_profit_usd": round(total_profit - total_ad_spend - total_refund, 2),
                "margin_pct": round((total_profit / total_gmv) * 100, 1) if total_gmv > 0 else 0.0,
                "ad_spend_7d_usd": total_ad_spend,
                "approved_refund_usd": total_refund,
                "po_commitment_rmb": po_commit_rmb,
            },
            "sku_profits": list(by_sku.values()),
            "trend_30d": trend,
            "settlements": [
                {
                    "period": "2026-11 W2",
                    "channel": "Amazon US",
                    "gross_usd": round(total_gmv * 0.65, 2),
                    "commission_usd": round(total_gmv * 0.65 * 0.15, 2),
                    "ad_deduct_usd": total_ad_spend,
                    "refund_usd": total_refund,
                    "net_payout_usd": round(total_gmv * 0.65 * 0.85 - total_ad_spend - total_refund, 2),
                    "status": "SETTLED",
                },
                {
                    "period": "2026-11 W2",
                    "channel": "TikTok Shop US",
                    "gross_usd": round(total_gmv * 0.35, 2),
                    "commission_usd": round(total_gmv * 0.35 * 0.08, 2),
                    "ad_deduct_usd": 0.0,
                    "refund_usd": 0.0,
                    "net_payout_usd": round(total_gmv * 0.35 * 0.92, 2),
                    "status": "PENDING_PAYOUT",
                },
            ],
        }

    async def list_ads(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (await session.scalars(select(M2AdCampaign).where(M2AdCampaign.org_id == org_id))).all()
        return [
            {
                "campaign_id": r.campaign_id,
                "sku": r.sku,
                "platform": r.platform,
                "campaign_name": r.campaign_name,
                "daily_budget_usd": r.daily_budget_usd,
                "spend_7d_usd": r.spend_7d_usd,
                "sales_7d_usd": r.sales_7d_usd,
                "acos": r.acos,
                "roas": r.roas,
                "status": r.status,
            }
            for r in rows
        ]

    async def adjust_ad(
        self, session: AsyncSession, org_id: str, campaign_id: str, req: AdAdjustReq, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(
            select(M2AdCampaign).where(M2AdCampaign.org_id == org_id, M2AdCampaign.campaign_id == campaign_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到广告计划: {campaign_id}", http_status=404)
        row.daily_budget_usd = req.daily_budget_usd
        row.status = req.status
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M2",
            action="AD_BUDGET_ADJUSTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 调整广告 {row.campaign_name} 日预算为 ${req.daily_budget_usd}（{req.status}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"campaign_id": campaign_id, "daily_budget_usd": row.daily_budget_usd, "status": row.status}

    async def list_competitors(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (await session.scalars(select(M3CompetitorWatch).where(M3CompetitorWatch.org_id == org_id))).all()
        return [
            {
                "watch_id": r.watch_id,
                "sku": r.sku,
                "competitor_brand": r.competitor_brand,
                "asin_or_ref": r.asin_or_ref,
                "price_usd": r.price_usd,
                "rating": r.rating,
                "review_count": r.review_count,
                "bsr_rank": r.bsr_rank,
                "sentiment_score": r.sentiment_score,
                "negative_topics": r.negative_topics_json or [],
                "last_alert": r.last_alert,
            }
            for r in rows
        ]

    async def create_competitor(
        self, session: AsyncSession, org_id: str, req: CompetitorCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        wid = f"cmp_{uuid.uuid4().hex[:8]}"
        session.add(
            M3CompetitorWatch(
                watch_id=wid,
                org_id=org_id,
                sku=req.sku,
                competitor_brand=req.competitor_brand,
                asin_or_ref=req.asin_or_ref,
                price_usd=req.price_usd,
                rating=req.rating,
                review_count=85,
                bsr_rank=req.bsr_rank,
                sentiment_score=0.84,
                negative_topics_json=["包装盒略软", "线长待优化"],
                last_alert="新增竞品监控项",
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=req.sku,
            module="M3",
            action="COMPETITOR_ADDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 新增竞品监控 {req.competitor_brand}（{req.asin_or_ref}）对标 {req.sku}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"watch_id": wid}
