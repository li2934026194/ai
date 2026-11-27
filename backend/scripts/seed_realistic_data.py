"""仿真实数据造数脚本：生成每条都不相同的、有真实业务感的演示数据。

与 seed_100_rows.py 的区别：
- seed_100_rows.py：递增编号 + 固定值，用于压测，看起来很假。
- 本脚本：真实商品名、随机但合理的价格/成本/库存/日期/客户名/问答，每条数据都不同。

运行方式（在 backend/ 目录下）：
    python scripts/seed_realistic_data.py

前提：先用 alembic upgrade head 建表，且已启动后端写入种子数据。
本脚本会先删除旧的压测假数据（SKU-LOAD / *-load-* 等），再生成仿真数据。
"""
import asyncio
import random
from datetime import date, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal, engine
from app.modules.m0_catalog.models import M0Inventory, M0Order, M0Product
from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession
from app.modules.m2_m3_bi.models import M2AdCampaign, M3CompetitorWatch
from app.modules.m4_selection.models import M4Candidate
from app.modules.m5_m6_supply.models import M5SalesHistory

ORG = "org_demo"
SEED = 20261126  # 固定种子：每次跑生成一样的仿真数据，方便演示复现
TARGET = 40  # 每类造 40 条，够列表翻页、不会淹没真实种子商品


# ---------- 真实感数据池 ----------

# (名称, 品类, 成本区间, 售价区间, 规格, 卖点)
PRODUCTS = [
    ("无线真空迷你封口机", "kitchen_appliance", (4.5, 7.5), (22.9, 32.9),
     {"power": "USB-C 5V/2A 1200mAh", "suction_kpa": "58-62 kPa", "weight_g": "200-220g"},
     ["60kPa 强力抽真空，3 秒锁鲜", "Type-C 充电满电封口 40 次", "210g 掌心体积磁吸收纳"]),
    ("轻量通勤双肩包", "bags", (5.8, 9.2), (26.9, 39.9),
     {"fabric": "防泼水牛津布", "capacity": "18-22L", "weight_g": "480-560g"},
     ["520g 超轻减负，18L 多隔层", "防泼水面料雨雪不渗", "隐藏拉杆带+水杯位"]),
    ("便携静音循环扇", "home_appliance", (3.8, 6.5), (16.9, 25.9),
     {"speeds": "4 档风速 90° 摇头", "battery": "4000mAh USB-C", "noise_db": "26-30 dB"},
     ["28dB 图书馆级静音", "4000mAh 续航 12 小时", "桌面壁挂两用"]),
    ("磁吸折叠手机支架", "mobile_accessories", (2.6, 5.4), (14.9, 24.9),
     {"material": "铝合金+N52 磁铁", "weight_g": "105-125g", "compatibility": "iPhone 12-16"},
     ["N52 强磁稳固不晃", "双轴 180° 折叠收纳", "CNC 精雕散热底座"]),
    ("焕亮保湿面霜", "beauty", (2.8, 5.2), (18.9, 29.9),
     {"volume": "50ml", "skin_type": "全肤质无香精", "key_ingredients": "烟酰胺5%+玻尿酸"},
     ["5% 烟酰胺+三重玻尿酸", "无香精温和配方", "轻盈乳霜不黏腻"]),
    ("LED 感应小夜灯", "home_appliance", (2.2, 4.8), (12.9, 21.9),
     {"battery": "1200mAh", "sensor": "人体红外感应", "lumens": "80-120 lm"},
     ["人体感应自动亮灭", "Type-C 充电续航 15 天", "磁吸免打孔安装"]),
    ("宠物自动饮水机", "pet_supplies", (6.5, 11.0), (29.9, 45.9),
     {"capacity": "2.5L", "pump": "静音循环泵", "filter": "三重滤芯"},
     ["2.5L 大容量循环活水", "25dB 静音泵不扰宠", "三重滤芯易清洗"]),
    ("折叠便携蓝牙键盘", "mobile_accessories", (8.0, 14.0), (34.9, 54.9),
     {"keys": "78 键紧凑布局", "battery": "300mAh 续航 90 天", "connect": "蓝牙 5.2 三设备"},
     ["三设备一键切换", "90 天超长续航", "折叠收纳随身带"]),
    ("硅胶厨房置物架", "kitchen_appliance", (1.8, 4.2), (11.9, 19.9),
     {"material": "食品级硅胶", "heat_resistant": "-40~230℃", "weight_g": "180-260g"},
     ["食品级硅胶耐高温", "防滑不伤台面", "可折叠省空间"]),
    ("无线感应垃圾桶", "home_appliance", (12.0, 20.0), (49.9, 79.9),
     {"capacity": "12L", "sensor": "红外感应开盖", "battery": "4×AA 续航 6 个月"},
     ["红外感应 0.3 秒开盖", "静音缓降盖", "IPX4 防水易清洁"]),
]

BUYERS = ["Emily R.", "Michael C.", "Sarah W.", "David K.", "Jessica L.", "James P.",
          "Amanda T.", "Robert H.", "Linda M.", "William F.", "Katherine S.", "Daniel B.",
          "Olivia N.", "Thomas G.", "Sophia D.", "Benjamin V.", "Charlotte A.", "Lucas J."]

QUESTIONS = [
    ("Does it support 110V US plug?", "Yes, it works with standard 110V US outlets out of the box."),
    ("How long does the battery last on a full charge?", "About 12 hours on low speed, 6 hours on high speed."),
    ("Is the material BPA free?", "Yes, all food-contact parts are BPA-free and FDA approved."),
    ("Can I return it if it doesn't fit?", "Absolutely, 30-day free returns with prepaid label."),
    ("What's the warranty period?", "12-month manufacturer warranty, extendable to 24 months."),
    ("Is it compatible with iPhone 15 Pro Max?", "Yes, it fits all iPhone 12-16 series including Pro Max."),
    ("How do I clean the filter?", "Rinse under water, air dry 2 hours, replace every 3 months."),
    ("Does it come with a storage bag?", "Yes, a premium travel pouch is included in the box."),
]

ISSUES = ["商品到货破损", "尺寸与描述不符", "物流延误超 7 天", "使用咨询退换", "颜色色差退货", "配件缺失补发"]
BRANDS = ["Anker", "Baseus", "Xiaomi", "Aukey", "UGREEN", "Belkin", "RAVPower", "Spigen"]
NEG_TOPICS = [["包装偏软"], ["充电慢"], ["噪音略大"], ["说明书不清"], ["颜色偏差"], ["尺寸偏小"], []]
CITIES = ["Los Angeles", "New York", "Chicago", "Houston", "Seattle", "Austin", "Denver", "Miami"]


def money(rng, lo, hi):
    return round(rng.uniform(lo, hi), 2)


async def wipe_old_fake(session):
    """删除旧压测假数据（seed_100_rows.py 生成的），保留真实种子数据。"""
    conds = {
        M0Product: M0Product.sku.like("SKU-LOAD-%") | M0Product.sku.like("SKU-CAND-%"),
        M0Inventory: M0Inventory.sku.like("SKU-LOAD-%"),
        M0Order: M0Order.order_id.like("ORD-LOAD-%"),
        M4Candidate: M4Candidate.candidate_id.like("cand_load_%"),
        M1CsSession: M1CsSession.session_id.like("sess_load_%"),
        M1AftersalesTicket: M1AftersalesTicket.ticket_id.like("tkt_load_%"),
        M2AdCampaign: M2AdCampaign.campaign_id.like("camp_load_%"),
        M3CompetitorWatch: M3CompetitorWatch.watch_id.like("watch_load_%"),
    }
    for model, cond in conds.items():
        await session.execute(
            model.__table__.delete().where((model.org_id == ORG) & cond)
        )
    await session.flush()
    print("已清理旧压测假数据")


async def seed_realistic():
    rng = random.Random(SEED)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)

    async with factory() as s:
        await wipe_old_fake(s)

        # 现有种子商品 SKU
        base_skus = [r[0] for r in (await s.execute(
            select(M0Product.sku).where(M0Product.org_id == ORG, M0Product.origin != "SEED_LOAD")
        )).all()]

        # 1. 商品 + 库存：每条都不同
        product_count = 0
        for i in range(TARGET):
            name, cat, cost_r, price_r, specs, points = PRODUCTS[i % len(PRODUCTS)]
            sku = f"RL-{cat[:3].upper()}-{i + 1:03d}"
            if await s.scalar(select(M0Product).where(M0Product.org_id == ORG, M0Product.sku == sku)):
                continue
            cost = money(rng, *cost_r)
            price = round(max(cost * rng.uniform(2.2, 3.8), money(rng, *price_r)), 2)
            s.add(M0Product(
                product_id=f"prod_rl_{i + 1:03d}",
                org_id=ORG, sku=sku,
                name=f"{name} · {['标准版','升级版','旗舰版','轻量版'][i % 4]}",
                category=cat,
                category_label_zh={"kitchen_appliance": "厨房小电", "bags": "箱包", "home_appliance": "家居电器",
                                   "mobile_accessories": "手机配件", "beauty": "个护美妆", "pet_supplies": "宠物用品"}.get(cat, "百货"),
                platform=rng.choice(["amazon_us", "amazon_us", "shopee_th", "tiktok_us"]),
                brand_name=rng.choice(BRANDS + ["CrossPilot Lab"]),
                sale_price_usd=price,
                strike_price_usd=round(price * rng.uniform(1.15, 1.4), 2),
                unit_cost_usd=cost,
                moq=rng.choice([50, 60, 80, 100, 120, 150, 200]),
                pack_size=rng.choice([10, 20, 24, 30, 40]),
                lead_time_days=rng.randint(28, 60),
                origin=rng.choice(["IN_STORE_REFRESH", "M4_APPROVED"]),
                approver="陈主管",
                decision_reason="历史销量稳定，复购率高" if i % 2 else "测款数据达标，过会引入",
                specs_json={k: (v if isinstance(v, str) and "%" not in v else str(v)) for k, v in specs.items()},
                selling_points_json=points,
            ))
            s.add(M0Inventory(
                inv_id=f"inv_rl_{i + 1:03d}",
                org_id=ORG, sku=sku,
                warehouse_code=rng.choice(["WH-US-WEST", "WH-US-EAST", "WH-US-CENTRAL"]),
                on_hand=rng.randint(35, 480),
                in_transit=rng.randint(0, 160),
                reserved=rng.randint(0, 25),
                last_stocktake_by="usr_warehouse",
            ))
            product_count += 1

        # 所有可售 SKU（种子 + 新造）
        all_skus = base_skus + [f"RL-{PRODUCTS[i % len(PRODUCTS)][1][:3].upper()}-{i + 1:03d}" for i in range(TARGET)]

        # 2. 订单：随机 SKU / 日期 / 数量 / 金额 / 状态
        for i in range(TARGET):
            oid = f"ORD-RL-{rng.randint(10000, 99999)}-{i:03d}"
            sku = rng.choice(all_skus)
            qty = rng.randint(1, 6)
            prod = await s.scalar(select(M0Product).where(M0Product.org_id == ORG, M0Product.sku == sku))
            unit = prod.sale_price_usd if prod else 25.0
            s.add(M0Order(
                order_id=oid, org_id=ORG,
                shop_id=rng.choice(["shop_amz_us", "shop_amz_us", "shop_shopee_th", "shop_tiktok_us"]),
                sku=sku,
                order_date=(date.today() - timedelta(days=rng.randint(0, 60))).isoformat(),
                qty=qty,
                revenue_usd=round(unit * qty * rng.uniform(0.92, 1.05), 2),
                is_mock=False,
                status=rng.choice(["COMPLETED", "COMPLETED", "PAID", "SHIPPED"]),
            ))

        # 3. 选品候选：真实名称 + 各异的五维评分
        for i in range(TARGET):
            name, cat, cost_r, price_r, _, _ = PRODUCTS[i % len(PRODUCTS)]
            scores = {k: rng.randint(62, 96) for k in ["demand", "competition", "margin", "supply", "compliance"]}
            s.add(M4Candidate(
                candidate_id=f"cand_rl_{i + 1:03d}", org_id=ORG,
                sku=f"CAND-RL-{i + 1:03d}",
                name=f"{name} · {rng.choice(['便携款','Pro款','迷你款','升级款'])}",
                category=cat,
                source_channel=rng.choice(["1688 趋势选品", "亚马逊 Best Sellers", "TikTok 热榜", "展会样品"]),
                source_nature=rng.choice(["internal_live", "external_trend"]),
                fulfillment_mode=rng.choice(["FBA", "FBM", "海外仓"]),
                ip_risk_note=rng.choice(["", "", "需核查外观专利", "商标检索通过"]),
                target_price_usd=money(rng, 15, 55),
                est_cost_rmb=money(rng, 22, 95),
                est_shipping_rmb=money(rng, 8, 28),
                est_margin_pct=round(rng.uniform(0.22, 0.52), 3),
                scores_json=scores,
                total_score=round(sum(scores.values()) / 5),
                operator_note=rng.choice(["竞品评分高但差评集中在续航", "季节性需求明显", "毛利空间充足", "供应链稳定"]),
                status=rng.choice(["DISCOVERED", "DISCOVERED", "PENDING_APPROVAL", "EVALUATED"]),
                submitter_id="usr_selector",
            ))

        # 4. 客服会话 + 售后单
        for i in range(TARGET):
            q, a = QUESTIONS[i % len(QUESTIONS)]
            s.add(M1CsSession(
                session_id=f"sess_rl_{i + 1:03d}", org_id=ORG,
                sku=rng.choice(all_skus),
                buyer_name=rng.choice(BUYERS),
                channel=rng.choice(["Amazon Buyer Msg", "Shopee Chat", "Website Live Chat"]),
                question=q, reply=a,
                is_mock=False,
                status=rng.choice(["REPLIED", "REPLIED", "CLOSED", "OPEN"]),
                handler_id="usr_cs",
            ))
        for i in range(TARGET):
            prod_price = money(rng, 8, 45)
            s.add(M1AftersalesTicket(
                ticket_id=f"tkt_rl_{i + 1:03d}", org_id=ORG,
                sku=rng.choice(all_skus),
                order_ref=f"ORD-RL-{rng.randint(10000, 99999)}-{rng.randint(0, TARGET):03d}",
                platform=rng.choice(["Amazon US", "Shopee TH", "TikTok Shop US"]),
                issue_type=rng.choice(ISSUES),
                refund_usd=round(prod_price * rng.uniform(0.3, 1.0), 2),
                evidence_note=rng.choice(["买家上传开箱照片", "物流签收截图", "聊天记录截图", "实物对比图"]),
                status=rng.choice(["APPROVED", "APPROVED", "PENDING_APPROVAL", "REJECTED"]),
                submitter_id="usr_cs", approver_id="usr_approver",
                decision_note=rng.choice(["凭证充分，同意退款", "符合售后政策", "证据不足，待补充"]),
            ))

        # 5. 广告活动 + 竞品监控
        for i in range(TARGET):
            spend = money(rng, 45, 480)
            acos = round(rng.uniform(0.12, 0.42), 3)
            s.add(M2AdCampaign(
                campaign_id=f"camp_rl_{i + 1:03d}", org_id=ORG,
                sku=rng.choice(all_skus),
                platform=rng.choice(["Amazon Sponsored", "Amazon DSP", "TikTok Ads"]),
                campaign_name=f"SP-{rng.choice(['Exact','Broad','Phrase','Auto'])}-{rng.choice(CITIES).replace(' ','')}-{i + 1:02d}",
                daily_budget_usd=money(rng, 20, 180),
                spend_7d_usd=spend,
                sales_7d_usd=round(spend / acos, 2),
                acos=acos,
                roas=round(1 / acos, 2),
                status=rng.choice(["ACTIVE", "ACTIVE", "PAUSED"]),
            ))
        for i in range(TARGET):
            s.add(M3CompetitorWatch(
                watch_id=f"watch_rl_{i + 1:03d}", org_id=ORG,
                sku=rng.choice(all_skus),
                competitor_brand=rng.choice(BRANDS),
                asin_or_ref=f"B0{rng.randint(10000000, 99999999)}",
                price_usd=money(rng, 12, 89),
                rating=round(rng.uniform(3.6, 4.9), 1),
                review_count=rng.randint(45, 8600),
                bsr_rank=rng.randint(80, 9500),
                sentiment_score=round(rng.uniform(0.55, 0.95), 3),
                negative_topics_json=rng.choice(NEG_TOPICS),
                last_alert=rng.choice(["", "", "竞品降价 8%，建议跟进", "竞品新增差评集中续航"]),
            ))

        # 6. 销量历史：近 90 天，带趋势 + 周末效应 + 随机波动（给预测模型用）
        existing = set((await s.scalars(select(M5SalesHistory.sales_date).where(
            M5SalesHistory.org_id == ORG, M5SalesHistory.sku == "SKU-00704"))).all())
        base_qty = rng.randint(12, 20)
        for d_idx in range(90):
            d = date.today() - timedelta(days=90 - d_idx)
            if d in existing:
                continue
            trend = base_qty + d_idx * 0.06  # 缓慢增长
            weekend = 1.25 if d.weekday() >= 5 else 1.0
            noise = rng.uniform(0.75, 1.3)
            qty = max(3, round(trend * weekend * noise))
            s.add(M5SalesHistory(
                org_id=ORG, sku="SKU-00704", sales_date=d,
                qty_raw=qty, on_hand_eod=rng.randint(40, 160),
                revenue_usd=round(qty * 26.9, 2),
            ))

        await s.commit()

        # 统计输出
        result = {}
        for name, model in [("商品", M0Product), ("库存", M0Inventory), ("订单", M0Order),
                            ("选品", M4Candidate), ("会话", M1CsSession), ("售后", M1AftersalesTicket),
                            ("广告", M2AdCampaign), ("竞品", M3CompetitorWatch), ("销量", M5SalesHistory)]:
            result[name] = await s.scalar(select(func.count()).select_from(model).where(model.org_id == ORG)) or 0
        print("仿真实数据生成完成:", result)
        print(f"本轮新增商品 {product_count} 条，SKU 前缀 RL-（列表里带真实中文名+规格+卖点）")


if __name__ == "__main__":
    asyncio.run(seed_realistic())
