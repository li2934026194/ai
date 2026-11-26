"""可选本地压测造数脚本：为主要业务表幂等填充 >=100 条数据，用于本地并发与列表性能验证。

运行方式（在 backend/ 目录下）：
    python scripts/seed_100_rows.py
"""
import asyncio
from datetime import date, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, Base, engine
from app.mocks.seed_data import ensure_seed_data
from app.modules.m0_catalog.models import M0Inventory, M0Order, M0Product
from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession
from app.modules.m2_m3_bi.models import M2AdCampaign, M3CompetitorWatch
from app.modules.m4_selection.models import M4Candidate
from app.modules.m5_m6_supply.models import M5SalesHistory
from app.modules.m7_content import models as _m7_models  # noqa: F401
from app.modules.m8_org import models as _m8_models  # noqa: F401


async def seed_100_rows(org_id: str = "org_demo", target: int = 100) -> dict[str, int]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await ensure_seed_data(session, org_id=org_id)

        # 1. m0_products & m0_inventory (>=100)
        p_cnt = await session.scalar(select(func.count()).select_from(M0Product).where(M0Product.org_id == org_id)) or 0
        for i in range(p_cnt, target):
            sku = f"SKU-LOAD-{i:03d}"
            if not await session.scalar(select(M0Product).where(M0Product.org_id == org_id, M0Product.sku == sku)):
                session.add(
                    M0Product(
                        product_id=f"prod_load_{i:03d}",
                        org_id=org_id,
                        sku=sku,
                        name=f"CrossPilot 压测示例商品 #{i:03d}",
                        category="kitchen_appliance",
                        category_label_zh="厨房小电",
                        platform="amazon_us",
                        origin="SEED_LOAD",
                        unit_cost_usd=6.5 + (i % 10) * 0.5,
                        sale_price_usd=29.99 + (i % 15),
                        selling_points_json=["高性能", "低噪音", "合规认证"],
                    )
                )
            if not await session.scalar(select(M0Inventory).where(M0Inventory.org_id == org_id, M0Inventory.sku == sku)):
                session.add(
                    M0Inventory(
                        inv_id=f"inv_load_{i:03d}",
                        org_id=org_id,
                        warehouse_code="WH-US",
                        sku=sku,
                        on_hand=80 + (i % 50),
                        in_transit=20,
                        reserved=2,
                        last_stocktake_by="usr_warehouse",
                    )
                )

        # 2. m0_orders (>=100)
        o_cnt = await session.scalar(select(func.count()).select_from(M0Order).where(M0Order.org_id == org_id)) or 0
        for i in range(o_cnt, target):
            oid = f"ORD-LOAD-{i:04d}"
            if not await session.get(M0Order, oid):
                session.add(
                    M0Order(
                        order_id=oid,
                        org_id=org_id,
                        shop_id="shop_amz_us",
                        sku="SKU-00704",
                        order_date=(date.today() - timedelta(days=i % 45)).isoformat(),
                        qty=1 + (i % 4),
                        revenue_usd=round(29.99 * (1 + (i % 4)), 2),
                        is_mock=False,
                        status="COMPLETED",
                    )
                )

        # 3. m4_candidates (>=100)
        c_cnt = await session.scalar(select(func.count()).select_from(M4Candidate).where(M4Candidate.org_id == org_id)) or 0
        for i in range(c_cnt, target):
            cid = f"cand_load_{i:03d}"
            if not await session.get(M4Candidate, cid):
                session.add(
                    M4Candidate(
                        candidate_id=cid,
                        org_id=org_id,
                        sku=f"SKU-CAND-{i:03d}",
                        name=f"选品压测新品 #{i:03d}",
                        category="kitchen_appliance",
                        source_channel="1688",
                        source_nature="internal_live",
                        fulfillment_mode="FBA",
                        target_price_usd=35.0,
                        est_cost_rmb=42.0,
                        est_shipping_rmb=14.0,
                        est_margin_pct=0.35,
                        scores_json={"demand": 82, "competition": 78, "margin": 86, "supply": 80, "compliance": 85},
                        total_score=82,
                        status="DISCOVERED",
                    )
                )

        # 4. m1_cs_sessions & m1_aftersales_tickets (>=100)
        s_cnt = await session.scalar(select(func.count()).select_from(M1CsSession).where(M1CsSession.org_id == org_id)) or 0
        for i in range(s_cnt, target):
            sid = f"sess_load_{i:03d}"
            if not await session.get(M1CsSession, sid):
                session.add(
                    M1CsSession(
                        session_id=sid,
                        org_id=org_id,
                        sku="SKU-00704",
                        buyer_name=f"Buyer-{i:03d}",
                        channel="Amazon",
                        question="Does it support 110V US plug?",
                        reply="Yes, 110V standard US plug.",
                        is_mock=False,
                        status="REPLIED",
                        handler_id="usr_cs",
                    )
                )

        t_cnt = await session.scalar(select(func.count()).select_from(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id)) or 0
        for i in range(t_cnt, target):
            tid = f"tkt_load_{i:03d}"
            if not await session.get(M1AftersalesTicket, tid):
                session.add(
                    M1AftersalesTicket(
                        ticket_id=tid,
                        org_id=org_id,
                        sku="SKU-00704",
                        order_ref=f"ORD-LOAD-{i:04d}",
                        platform="Amazon US",
                        issue_type="使用咨询退换",
                        refund_usd=9.99,
                        evidence_note="压测示例凭证",
                        status="APPROVED",
                        submitter_id="usr_cs",
                        approver_id="usr_approver",
                    )
                )

        # 5. m2_ad_campaigns & m3_competitor_watches & m5_sales_history (>=100)
        ad_cnt = await session.scalar(select(func.count()).select_from(M2AdCampaign).where(M2AdCampaign.org_id == org_id)) or 0
        for i in range(ad_cnt, target):
            aid = f"camp_load_{i:03d}"
            if not await session.get(M2AdCampaign, aid):
                session.add(
                    M2AdCampaign(
                        campaign_id=aid,
                        org_id=org_id,
                        sku="SKU-00704",
                        platform="Amazon Sponsored",
                        campaign_name=f"SP-Load-{i:03d}",
                        daily_budget_usd=50.0,
                        spend_7d_usd=120.0,
                        sales_7d_usd=480.0,
                        acos=0.25,
                        roas=4.0,
                        status="ACTIVE",
                    )
                )

        cw_cnt = await session.scalar(select(func.count()).select_from(M3CompetitorWatch).where(M3CompetitorWatch.org_id == org_id)) or 0
        for i in range(cw_cnt, target):
            wid = f"watch_load_{i:03d}"
            if not await session.get(M3CompetitorWatch, wid):
                session.add(
                    M3CompetitorWatch(
                        watch_id=wid,
                        org_id=org_id,
                        sku="SKU-00704",
                        competitor_brand=f"Brand-{i:03d}",
                        asin_or_ref=f"B0LOAD{i:04d}",
                        price_usd=31.99,
                        rating=4.4,
                        review_count=120 + i,
                        bsr_rank=200 + i,
                        sentiment_score=0.78,
                        negative_topics_json=["包装偏软"],
                    )
                )

        sh_cnt = await session.scalar(select(func.count()).select_from(M5SalesHistory).where(M5SalesHistory.org_id == org_id)) or 0
        existing_dates = set(
            (await session.scalars(select(M5SalesHistory.sales_date).where(M5SalesHistory.org_id == org_id, M5SalesHistory.sku == "SKU-00704"))).all()
        )
        day_offset = 1
        while sh_cnt < target:
            d = date.today() - timedelta(days=day_offset)
            day_offset += 1
            if d in existing_dates:
                continue
            existing_dates.add(d)
            session.add(
                M5SalesHistory(
                    org_id=org_id,
                    sku="SKU-00704",
                    sales_date=d,
                    qty_raw=10 + (sh_cnt % 15),
                    on_hand_eod=50,
                    revenue_usd=round((10 + (sh_cnt % 15)) * 29.99, 2),
                )
            )
            sh_cnt += 1

        await session.commit()

        return {
            "m0_products": await session.scalar(select(func.count()).select_from(M0Product).where(M0Product.org_id == org_id)) or 0,
            "m0_orders": await session.scalar(select(func.count()).select_from(M0Order).where(M0Order.org_id == org_id)) or 0,
            "m4_candidates": await session.scalar(select(func.count()).select_from(M4Candidate).where(M4Candidate.org_id == org_id)) or 0,
            "m1_cs_sessions": await session.scalar(select(func.count()).select_from(M1CsSession).where(M1CsSession.org_id == org_id)) or 0,
            "m1_aftersales_tickets": await session.scalar(select(func.count()).select_from(M1AftersalesTicket).where(M1AftersalesTicket.org_id == org_id)) or 0,
            "m2_ad_campaigns": await session.scalar(select(func.count()).select_from(M2AdCampaign).where(M2AdCampaign.org_id == org_id)) or 0,
            "m3_competitor_watches": await session.scalar(select(func.count()).select_from(M3CompetitorWatch).where(M3CompetitorWatch.org_id == org_id)) or 0,
            "m5_sales_history": await session.scalar(select(func.count()).select_from(M5SalesHistory).where(M5SalesHistory.org_id == org_id)) or 0,
        }


if __name__ == "__main__":
    res = asyncio.run(seed_100_rows())
    print("Seed >=100 rows result:", res)
