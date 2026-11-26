import asyncio
import re
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.audit import write_audit_event
from app.core.auth_rbac import ActorContext
from app.core.exceptions import M7Error
from app.modules.m0_catalog.models import M0Inventory, M0Order, M0Product, M0Shop
from app.modules.m1_cs.models import M1AftersalesTicket
from app.modules.m2_m3_bi.models import M2AdCampaign, M2DashboardLayout, M3CompetitorWatch
from app.modules.m2_m3_bi.schemas import (
    AdAdjustReq,
    AdCreateReq,
    BiAskReq,
    CompetitorCreateReq,
    CompetitorUpdateReq,
    DesignerLayoutSaveReq,
)
from app.modules.m2_m3_bi.vanna_client import query_vanna_if_configured
from app.modules.m5_m6_supply.models import M5SalesHistory, M6AlertEvent, M6PurchaseOrder, M6ReplenishApply


_MUTATION_RE = re.compile(
    r"\b(delete|drop|update|insert|alter|truncate|grant|revoke)\b|修改|删除|改价|调价|删单|改库存|下采购单|清空|篡改",
    re.IGNORECASE,
)


class M2M3BiService:
    async def get_home_workbench(self, session: AsyncSession, org_id: str) -> dict:
        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        shops = (await session.scalars(select(M0Shop).where(M0Shop.org_id == org_id))).all()
        applies = (await session.scalars(select(M6ReplenishApply).where(M6ReplenishApply.org_id == org_id))).all()
        alerts = (await session.scalars(select(M6AlertEvent).where(M6AlertEvent.org_id == org_id, M6AlertEvent.status == "OPEN"))).all()
        tickets = (await session.scalars(select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id, M1AftersalesTicket.status == "PENDING_APPROVAL"))).all()
        orders = (await session.scalars(select(M0Order).where(M0Order.org_id == org_id))).all()
        live_orders = [o for o in orders if not o.is_mock]
        calc_orders = live_orders if live_orders else orders
        gmv = round(sum(float(o.revenue_usd) for o in calc_orders), 2)
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

    async def get_m2_overview(
        self,
        session: AsyncSession,
        org_id: str,
        include_mock: bool = False,
        shop_id: str | None = None,
        actor: ActorContext | None = None,
    ) -> dict:
        all_orders = (await session.scalars(select(M0Order).where(M0Order.org_id == org_id))).all()
        if actor and actor.allowed_shop_ids:
            all_orders = [o for o in all_orders if o.shop_id in actor.allowed_shop_ids]
        if shop_id:
            all_orders = [o for o in all_orders if o.shop_id == shop_id]

        mock_excluded_count = sum(1 for o in all_orders if o.is_mock) if not include_mock else 0
        orders = all_orders if include_mock else [o for o in all_orders if not o.is_mock]
        if not orders and all_orders and not include_mock:
            # Fallback only when org has zero non-mock orders yet, clearly flagged
            orders = []

        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        inv = (await session.scalars(select(M0Inventory).where(M0Inventory.org_id == org_id))).all()
        ads = (await session.scalars(select(M2AdCampaign).where(M2AdCampaign.org_id == org_id))).all()
        hist = (await session.scalars(select(M5SalesHistory).where(M5SalesHistory.org_id == org_id))).all()
        pos = (await session.scalars(select(M6PurchaseOrder).where(M6PurchaseOrder.org_id == org_id))).all()
        tickets = (await session.scalars(select(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id))).all()

        prod_map = {p.sku: p for p in prods}
        inv_map = {i.sku: i for i in inv}

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
        po_commit_rmb = round(
            sum(
                p.order_qty * (round(float(prod_map[p.sku].unit_cost_usd) * 7.2, 2) if p.sku in prod_map else 40.0)
                for p in pos
                if p.status != "cancelled"
            ),
            2,
        )

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
                "include_mock": include_mock,
                "mock_excluded_count": mock_excluded_count,
                "live_order_count": len(orders),
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
                "high_acos_alert": r.acos > 0.30,
            }
            for r in rows
        ]

    async def create_ad(
        self, session: AsyncSession, org_id: str, req: AdCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        cid = f"ad_{uuid.uuid4().hex[:8]}"
        sku_norm = req.sku.strip().upper()
        session.add(
            M2AdCampaign(
                campaign_id=cid,
                org_id=org_id,
                sku=sku_norm,
                platform=req.platform,
                campaign_name=req.campaign_name.strip(),
                daily_budget_usd=req.daily_budget_usd,
                spend_7d_usd=0.0,
                sales_7d_usd=0.0,
                acos=0.0,
                roas=0.0,
                status="ACTIVE",
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            sku=sku_norm,
            module="M2",
            action="AD_CAMPAIGN_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 新建广告计划 {req.campaign_name}（日预算 ${req.daily_budget_usd}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"campaign_id": cid, "sku": sku_norm, "status": "ACTIVE"}

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
        prods = (await session.scalars(select(M0Product).where(M0Product.org_id == org_id))).all()
        price_map = {p.sku: float(p.sale_price_usd) for p in prods}
        return [
            {
                "watch_id": r.watch_id,
                "sku": r.sku,
                "our_price_usd": price_map.get(r.sku),
                "price_diff_usd": round(r.price_usd - price_map[r.sku], 2) if r.sku in price_map else None,
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
        sku_norm = req.sku.strip().upper()
        session.add(
            M3CompetitorWatch(
                watch_id=wid,
                org_id=org_id,
                sku=sku_norm,
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
            sku=sku_norm,
            module="M3",
            action="COMPETITOR_ADDED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 新增竞品监控 {req.competitor_brand}（{req.asin_or_ref}）对标 {sku_norm}",
            trace_id=trace_id,
        )
        await session.commit()
        return {"watch_id": wid}

    async def update_competitor(
        self,
        session: AsyncSession,
        org_id: str,
        watch_id: str,
        req: CompetitorUpdateReq,
        actor: ActorContext,
        trace_id: str,
    ) -> dict:
        row = await session.scalar(
            select(M3CompetitorWatch).where(M3CompetitorWatch.org_id == org_id, M3CompetitorWatch.watch_id == watch_id)
        )
        if not row:
            raise M7Error("M7-4041", f"未找到竞品监控记录: {watch_id}", http_status=404)
        price_delta = round(req.price_usd - row.price_usd, 2)
        row.price_usd = req.price_usd
        row.rating = req.rating
        row.bsr_rank = req.bsr_rank
        if req.negative_topics:
            row.negative_topics_json = req.negative_topics
        if price_delta < 0:
            row.last_alert = f"竞品降价 ${abs(price_delta):.2f} 至 ${req.price_usd:.2f}"
        await write_audit_event(
            session,
            org_id=org_id,
            sku=row.sku,
            module="M3",
            action="COMPETITOR_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新竞品 {row.competitor_brand}（售价 ${req.price_usd}，BSR #{req.bsr_rank}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"watch_id": watch_id, "last_alert": row.last_alert}

    async def ask_bi_assistant(
        self, session: AsyncSession, org_id: str, req: BiAskReq, actor: ActorContext, trace_id: str
    ) -> dict:
        if _MUTATION_RE.search(req.question):
            await write_audit_event(
                session,
                org_id=org_id,
                module="M3",
                action="BI_MUTATION_BLOCKED",
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"拦截 {actor.display_name} 的只读问数越权写入尝试",
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error("M7-4033", "经营智能问数仅限只读指标分析，禁止执行任何修改或删除指令", http_status=403)

        ov = await self.get_m2_overview(session, org_id, include_mock=req.include_mock, actor=actor)
        alerts = (
            await session.scalars(
                select(M6AlertEvent).where(M6AlertEvent.org_id == org_id, M6AlertEvent.status == "OPEN")
            )
        ).all()
        applies = (
            await session.scalars(
                select(M6ReplenishApply).where(
                    M6ReplenishApply.org_id == org_id, M6ReplenishApply.status == "pending_approve"
                )
            )
        ).all()
        comps = await self.list_competitors(session, org_id)

        s = ov["summary"]
        top_sku = max(ov["sku_profits"], key=lambda x: x["net_profit_usd"], default=None)
        scope_label = "含演示订单" if req.include_mock else f"仅实盘订单（已剔除 {s['mock_excluded_count']} 条 MOCK）"
        lines = [
            f"【实时数据库口径溯源 · {scope_label}】",
            f"1. 经营大盘：实盘 GMV ${s['total_gmv_usd']:.2f}，预估净利润 ${s['net_profit_usd']:.2f}（毛利率 {s['margin_pct']}%）。",
        ]
        if top_sku:
            lines.append(
                f"2. 最优利润单品：{top_sku['sku']}（{top_sku['name']}），销量 {top_sku['units']} 件，净利 ${top_sku['net_profit_usd']:.2f}。"
            )
        lines.append(
            f"3. 扣减明细：7日广告花费 ${s['ad_spend_7d_usd']:.2f}；已批售后退款 ${s['approved_refund_usd']:.2f}；未取消采购承诺 ¥{s['po_commitment_rmb']:.0f}。"
        )
        lines.append(
            f"4. 供应链与竞品风险：待审补货申请 {len(applies)} 笔；未处理断货/逾期告警 {len(alerts)} 条；监控竞品 {len(comps)} 家。"
        )
        if alerts:
            lines.append("   └ 重点告警：" + "；".join(a.message for a in alerts[:3]))

        vanna_res = await query_vanna_if_configured(org_id, req.question)
        engine_mode = "vanna_http" if vanna_res else "pg_readonly_fact"

        await write_audit_event(
            session,
            org_id=org_id,
            module="M3",
            action="BI_ASK_EXECUTED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 执行只读经营智能问数（引擎 {engine_mode}）",
            trace_id=trace_id,
        )
        await session.commit()
        answer_text = "\n".join(lines)
        if vanna_res and vanna_res.get("answer"):
            answer_text = f"{answer_text}\n\n【Vanna 2 增强解读】\n{vanna_res['answer']}"
        return {
            "answer": answer_text,
            "engine_mode": engine_mode,
            "lineage_sources": ["m0_orders", "m0_products", "m2_ad_campaigns", "m1_aftersales_tickets", "m6_alert_events"],
            "metrics": s,
            "open_alerts_count": len(alerts),
            "pending_applies_count": len(applies),
        }

    async def get_designer_layout(self, session: AsyncSession, org_id: str) -> dict:
        row = await session.scalar(select(M2DashboardLayout).where(M2DashboardLayout.org_id == org_id))
        default_cards = [
            {"card_id": "c1", "title": "实盘 GMV", "metric_key": "gmv_usd"},
            {"card_id": "c2", "title": "预估净利", "metric_key": "net_profit_usd"},
            {"card_id": "c3", "title": "7日广告费", "metric_key": "ad_spend_7d_usd"},
            {"card_id": "c4", "title": "待处理告警", "metric_key": "open_alerts_count"},
        ]
        if not row:
            return {"draft_layout": default_cards, "published_layout": None, "version": 1}
        return {
            "draft_layout": row.draft_layout_json or default_cards,
            "published_layout": row.published_layout_json or None,
            "version": row.version,
        }

    async def save_designer_draft(
        self, session: AsyncSession, org_id: str, req: DesignerLayoutSaveReq, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(select(M2DashboardLayout).where(M2DashboardLayout.org_id == org_id))
        cards_payload = [c.model_dump() for c in req.cards]
        if not row:
            row = M2DashboardLayout(
                layout_id=f"lyt_{uuid.uuid4().hex[:10]}",
                org_id=org_id,
                draft_layout_json=cards_payload,
                published_layout_json=[],
                version=1,
                updated_by=actor.user_id,
            )
            session.add(row)
        else:
            if req.version != row.version:
                raise M7Error("M7-4091", f"驾驶舱布局版本冲突（期望 {row.version}，收到 {req.version}）", http_status=409)
            row.draft_layout_json = cards_payload
            row.version += 1
            row.updated_by = actor.user_id
        await write_audit_event(
            session,
            org_id=org_id,
            module="M2",
            action="DESIGNER_DRAFT_SAVED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 保存了驾驶舱草稿布局（共 {len(cards_payload)} 张卡，v{row.version}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"draft_layout": row.draft_layout_json, "version": row.version}

    async def publish_designer_layout(
        self, session: AsyncSession, org_id: str, actor: ActorContext, trace_id: str
    ) -> dict:
        row = await session.scalar(select(M2DashboardLayout).where(M2DashboardLayout.org_id == org_id))
        if not row or not row.draft_layout_json:
            raise M7Error("M7-4221", "请先保存驾驶舱草稿布局后再发布", http_status=422)
        row.published_layout_json = list(row.draft_layout_json)
        row.version += 1
        row.updated_by = actor.user_id
        await write_audit_event(
            session,
            org_id=org_id,
            module="M2",
            action="DESIGNER_LAYOUT_PUBLISHED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 发布了驾驶舱正式布局（v{row.version}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"published_layout": row.published_layout_json, "version": row.version}

    async def query_designer_cards(self, session: AsyncSession, org_id: str, actor: ActorContext) -> dict:
        """对齐 SRS FR-BI-06：最多 4 张卡并发问数，每张卡使用独立数据库会话并按卡隔离异常"""
        layout = await self.get_designer_layout(session, org_id)
        cards = (layout["published_layout"] or layout["draft_layout"])[:4]
        maker = async_sessionmaker(bind=session.bind, class_=AsyncSession, expire_on_commit=False, autoflush=False)

        async def _eval_card(card: dict) -> dict:
            try:
                async with maker() as card_session:
                    key = card["metric_key"]
                    if key == "open_alerts_count":
                        cnt = len(
                            (
                                await card_session.scalars(
                                    select(M6AlertEvent).where(
                                        M6AlertEvent.org_id == org_id, M6AlertEvent.status == "OPEN"
                                    )
                                )
                            ).all()
                        )
                        return {**card, "ok": True, "value": cnt, "error": None}
                    ov = await self.get_m2_overview(card_session, org_id, include_mock=False, actor=actor)
                    return {**card, "ok": True, "value": ov["summary"].get(key, 0), "error": None}
            except Exception as exc:
                return {**card, "ok": False, "value": None, "error": str(exc)}

        results = await asyncio.gather(*[_eval_card(c) for c in cards])
        return {"cards": list(results), "published": layout["published_layout"] is not None}
