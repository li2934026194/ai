from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.product_catalog_contract import ProductFactSnapshot
from app.contracts.voice_faq_contract import VoiceFaqSnapshot
from app.modules.m7_content.models import (
    M7CertRecord,
    M7ComplianceRule,
    M7WorkflowRegistry,
)


PLATFORMS: tuple[str, ...] = ("amazon_us", "shopee_th", "tiktok_us")
CATEGORIES: tuple[str, ...] = (
    "kitchen_appliance",
    "bags_travel",
    "3c_accessories",
    "beauty_skincare",
)

PLATFORM_LIMITS: dict[str, dict[str, int]] = {
    "amazon_us": {"title_max_chars": 200, "bullet_max_chars": 500, "search_terms_max_bytes": 250},
    "tiktok_us": {"title_max_chars": 150, "bullet_max_chars": 400, "search_terms_max_bytes": 250},
    "shopee_th": {"title_max_chars": 120, "bullet_max_chars": 350, "search_terms_max_bytes": 250},
}

CATEGORY_CERTS: dict[str, dict[str, list[str]]] = {
    "kitchen_appliance": {
        "amazon_us": ["UL", "FCC"],
        "tiktok_us": ["UL", "FCC", "TIKTOK_CREATOR_AUTH"],
        "shopee_th": ["TISI"],
    },
    "bags_travel": {
        "amazon_us": [],
        "tiktok_us": ["TIKTOK_CREATOR_AUTH"],
        "shopee_th": [],
    },
    "3c_accessories": {
        "amazon_us": ["FCC", "UN38_3"],
        "tiktok_us": ["FCC", "TIKTOK_CREATOR_AUTH"],
        "shopee_th": ["NBTC"],
    },
    "beauty_skincare": {
        "amazon_us": ["FDA_COSMETIC_REG"],
        "tiktok_us": ["FDA_COSMETIC_REG", "TIKTOK_CREATOR_AUTH"],
        "shopee_th": ["TH_FDA"],
    },
}

DEFAULT_LEXICON_BY_CAT: dict[str, dict[str, list[str]]] = {
    "kitchen_appliance": {
        "must": ["CrossPilot Lab", "BPA-Free", "USB-C"],
        "ban": ["100% Best", "No.1", "Guaranteed", "Free Gift"],
        "trademark": ["Dyson", "Ziploc", "Velcro", "Teflon", "Thermos"],
        "regulatory": ["FDA Approved", "Sterilize", "Cure", "Medical Grade", "Waterproof"],
    },
    "bags_travel": {
        "must": ["CrossPilot Lab", "Lightweight"],
        "ban": ["100% Best", "Indestructible", "Free Gift"],
        "trademark": ["Velcro", "Samsonite", "Teflon", "Cordura"],
        "regulatory": ["Waterproof", "Fireproof", "Medical Grade"],
    },
    "3c_accessories": {
        "must": ["CrossPilot Lab", "Fast Charge"],
        "ban": ["100% Best", "Never Breaks", "No.1"],
        "trademark": ["MagSafe", "Apple", "Velcro", "Thermos"],
        "regulatory": ["Waterproof", "FDA Approved", "Medical Grade"],
    },
    "beauty_skincare": {
        "must": ["CrossPilot Lab", "Hydrating"],
        "ban": ["Miracle Cure", "100% Effective", "No.1"],
        "trademark": ["Botox", "Vaseline", "Velcro"],
        "regulatory": ["FDA Approved", "Cure", "Treat Acne", "Medical Grade", "Sterilize"],
    },
}


def get_mock_products(org_id: str) -> list[ProductFactSnapshot]:
    return [
        ProductFactSnapshot(
            org_id=org_id,
            sku="SKU-00704",
            name="无线真空迷你封口机",
            category="kitchen_appliance",
            category_label_zh="厨卫小电",
            platform="amazon_us",
            sale_price_usd=26.9,
            strike_price_usd=34.9,
            origin="M4_APPROVED",
            approver="陈主管",
            decision_reason="近30天毛利率 18.4%，外观排雷通过，批准测款",
            specs={
                "power": "USB-C 5V/2A Rechargeable (1200mAh)",
                "suction_kpa": "60 kPa",
                "weight_g": "210g",
                "material": "Food-Grade ABS + Silicone Seal",
                "package_contents": "1x Mini Sealer, 1x USB-C Cable, 5x Storage Bags",
            },
            selling_points=[
                "60 kPa 强力抽真空，3 秒快速封口锁鲜",
                "Type-C 充电设计，单次满电可连续封口 40 次",
                "仅 210g 掌心体积，磁吸背面可贴冰箱收纳",
            ],
        ),
        ProductFactSnapshot(
            org_id=org_id,
            sku="BAG-108",
            name="轻量通勤双肩包",
            category="bags_travel",
            category_label_zh="箱包出行",
            platform="tiktok_us",
            sale_price_usd=29.9,
            strike_price_usd=39.9,
            origin="IN_STORE_REFRESH",
            approver="在售老品翻新",
            decision_reason="在售爆款详情升级（月销 640 件）",
            specs={
                "capacity": "18L (Fits 15.6-inch Laptop)",
                "weight_g": "520g",
                "fabric": "Splash-Resistant Oxford Nylon",
            },
            selling_points=[
                "520g 超轻减负背负，18L 多隔层适配 15.6 寸笔记本",
                "防泼水牛津布表面，日常通勤雨雪不渗水",
                "隐藏式行李箱拉杆带与侧袋水杯位",
            ],
        ),
        ProductFactSnapshot(
            org_id=org_id,
            sku="FAN-203",
            name="便携静音循环扇",
            category="kitchen_appliance",
            category_label_zh="厨卫小电",
            platform="shopee_th",
            sale_price_usd=18.5,
            strike_price_usd=24.0,
            origin="IN_STORE_REFRESH",
            approver="在售老品翻新",
            decision_reason="东南亚夏季旺季老品焕新",
            specs={
                "noise_db": "28 dB Whisper Quiet",
                "battery": "4000mAh USB-C",
                "speeds": "4 Speed Levels + 90° Tilt",
            },
            selling_points=[
                "28dB 图书馆级低噪无刷电机，夜间睡眠不打扰",
                "4000mAh 续航最高 12 小时，支持桌面与壁挂",
            ],
        ),
        ProductFactSnapshot(
            org_id=org_id,
            sku="COS-052",
            name="焕亮保湿面霜",
            category="beauty_skincare",
            category_label_zh="美妆个护",
            platform="amazon_us",
            sale_price_usd=22.9,
            strike_price_usd=None,
            origin="M4_APPROVED",
            approver="陈主管",
            decision_reason="高复购护肤测款池批准新品",
            specs={
                "volume": "50ml / 1.7 fl oz",
                "key_ingredients": "Niacinamide 5%, Hyaluronic Acid, Ceramide NP",
                "skin_type": "All Skin Types, Fragrance-Free",
            },
            selling_points=[
                "5% 烟酰胺 + 三重透明质酸深层锁水",
                "无香精温和配方，轻盈乳霜质地不黏腻",
            ],
        ),
        ProductFactSnapshot(
            org_id=org_id,
            sku="MNT-405",
            name="磁吸折叠支架",
            category="3c_accessories",
            category_label_zh="3C数码",
            platform="amazon_us",
            sale_price_usd=19.9,
            strike_price_usd=27.9,
            origin="M4_APPROVED",
            approver="陈主管",
            decision_reason="3C 桌面配件高毛利新品",
            specs={
                "material": "Aluminum Alloy + N52 Magnet Ring",
                "compatibility": "iPhone 12-16 & Universal Ring",
                "weight_g": "115g",
            },
            selling_points=[
                "N52 强磁吸附稳固不晃动，双轴 180° 折叠收纳",
                "全铝合金 CNC 精雕散热底座",
            ],
        ),
    ]


def get_mock_faq(org_id: str, sku: str) -> VoiceFaqSnapshot:
    defaults = {
        "SKU-00704": VoiceFaqSnapshot(
            org_id=org_id,
            sku=sku,
            pain_points=[
                "买家关心是否兼容普通零食塑料袋还是必须专用纹理袋",
                "关注充满电大约能封多少个袋子及是否有过热保护",
            ],
            faq_pairs=[
                {"q": "是否必须使用专用真空袋？", "a": "抽真空模式需搭配单面网格纹理袋；普通封口模式兼容常见铝箔袋与零食袋。"},
                {"q": "单次充电续航多久？", "a": "1200mAh 锂电池通过 USB-C 约 2 小时充满，可连续封口 35-45 次。"},
            ],
        ),
        "BAG-108": VoiceFaqSnapshot(
            org_id=org_id,
            sku=sku,
            pain_points=["买家关心能否放下 15.6 寸游戏本", "担心肩带承重和防泼水效果"],
            faq_pairs=[
                {"q": "能放 15.6 寸笔记本吗？", "a": "独立加厚电脑隔层最大支持 15.6 寸常规笔记本。"},
            ],
        ),
    }
    return defaults.get(
        sku,
        VoiceFaqSnapshot(
            org_id=org_id,
            sku=sku,
            pain_points=["买家重点关注材质安全、配件清单及质保周期"],
            faq_pairs=[{"q": "包装内包含哪些配件？", "a": "以商品主档 specs.package_contents 实标清单为准。"}],
        ),
    )


async def ensure_seed_data(session: AsyncSession, org_id: str = "org_demo") -> None:
    # 1. 工作流版本注册表（幂等写入）
    workflows = [
        M7WorkflowRegistry(
            workflow_id="wf_copy_v1",
            purpose="COPYWRITING",
            version="1.0.0",
            adapter_type="CLOUD_API",
            compliance_node="lexicon_tail_v1",
            status="ACTIVE",
            config_json={"variants": 3, "provider_default": "dashscope"},
        ),
        M7WorkflowRegistry(
            workflow_id="wf_img_1plus4_v2",
            purpose="MAIN_IMAGE",
            version="2.1.0",
            adapter_type="CLOUD_API",
            compliance_node="iptc_tail_v1",
            status="ACTIVE",
            config_json={"slots": 5, "white_bg_main": True},
        ),
        M7WorkflowRegistry(
            workflow_id="wf_vid_15s_v1",
            purpose="SHORT_VIDEO",
            version="1.2.0",
            adapter_type="PILLOW_FFMPEG",
            compliance_node="ffmpeg_mp4_v1",
            status="ACTIVE",
            config_json={"duration_sec": 15, "aspect": "9:16", "segments": 3},
        ),
        M7WorkflowRegistry(
            workflow_id="wf_aplus_v1",
            purpose="APLUS",
            version="1.0.0",
            adapter_type="PILLOW_FFMPEG",
            compliance_node="html_xss_escape_v1",
            status="ACTIVE",
            config_json={"modules": 4},
        ),
    ]
    for wf in workflows:
        if not await session.get(M7WorkflowRegistry, wf.workflow_id):
            session.add(wf)

    # 2. 3 平台 × 4 类目 = 12 条合规规则矩阵种子
    for plat in PLATFORMS:
        limits = PLATFORM_LIMITS[plat]
        for cat in CATEGORIES:
            rule_id = f"rule_{org_id}_{plat}_{cat}"
            existing = await session.scalar(
                select(M7ComplianceRule).where(
                    M7ComplianceRule.org_id == org_id,
                    M7ComplianceRule.platform == plat,
                    M7ComplianceRule.category == cat,
                )
            )
            if not existing:
                session.add(
                    M7ComplianceRule(
                        rule_id=rule_id,
                        org_id=org_id,
                        platform=plat,
                        category=cat,
                        rule_version="2026.11",
                        effective_date=date.today(),
                        title_max_chars=limits["title_max_chars"],
                        bullet_max_chars=limits["bullet_max_chars"],
                        search_terms_max_bytes=limits["search_terms_max_bytes"],
                        lexicon_json=DEFAULT_LEXICON_BY_CAT[cat],
                        required_certs_json=CATEGORY_CERTS[cat][plat],
                        image_policy_json={
                            "main_white_bg": True,
                            "min_width": 1000,
                            "require_iptc_ai_label": True,
                        },
                        updated_by="system-seed",
                    )
                )

    # 3. 资质台账种子（含有效、临期与过期边界样例）
    today = date.today()
    cert_seeds = [
        ("cert_00704_ul", "SKU-00704", "UL", "UL-2026-88412", today + timedelta(days=180), "VALID"),
        ("cert_00704_fcc", "SKU-00704", "FCC", "FCC-ID-CP704", today + timedelta(days=90), "VALID"),
        ("cert_00704_tt", "SKU-00704", "TIKTOK_CREATOR_AUTH", "TT-AUTH-704", today + timedelta(days=15), "EXPIRING"),
        ("cert_bag_tt", "BAG-108", "TIKTOK_CREATOR_AUTH", "TT-AUTH-108", today + timedelta(days=120), "VALID"),
        ("cert_cos_fda", "COS-052", "FDA_COSMETIC_REG", "FDA-MoCRA-052", today - timedelta(days=1), "EXPIRED"),
        ("cert_mnt_fcc", "MNT-405", "FCC", "FCC-ID-MNT405", today + timedelta(days=240), "VALID"),
        ("cert_mnt_un", "MNT-405", "UN38_3", "UN383-MNT405", today + timedelta(days=365), "VALID"),
    ]
    for cid, sku, ctype, cno, exp, st in cert_seeds:
        full_cid = f"{cid}_{org_id}"
        if not await session.get(M7CertRecord, full_cid):
            session.add(
                M7CertRecord(
                    cert_id=full_cid,
                    org_id=org_id,
                    sku=sku,
                    cert_type=ctype,
                    cert_no=cno,
                    expire_date=exp,
                    status=st,
                )
            )

    # 4. M8 组织与权限种子（9角色 / 演示账号 / 审批流规则）
    from app.core.auth_rbac import ROLE_PERMISSIONS, hash_password
    from app.modules.m8_org.models import M8ApprovalPolicy, M8RoleDefinition, M8UserAccount
    from app.modules.m0_catalog.models import (
        M0CostRequest,
        M0FxRate,
        M0Inventory,
        M0Order,
        M0Product,
        M0Shop,
        M0SupplierQuote,
    )
    from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession, M1FaqEntry
    from app.modules.m2_m3_bi.models import M2AdCampaign, M3CompetitorWatch
    from app.modules.m4_selection.models import M4Candidate
    from app.modules.m5_m6_supply.models import (
        M5SalesHistory,
        M6AlertEvent,
        M6PurchaseOrder,
        M6ReplenishApply,
        M6WeeklyReview,
    )
    import math

    role_meta = [
        ("approver", "主管 / 审批人", "M0-M8 跨模块审批、选品过会、补货/售后/内容终审"),
        ("creator", "内容创作 / 审核人员", "M7 文案/主图/短视频/A+ 创作、合规模拟与导出"),
        ("manager", "大屏浏览者 / 管理者", "全平台组织管理、店铺授权与全局经营大盘"),
        ("planner", "驾驶舱设计者 / 业务运营", "M0/M1/M2/M5/M6 日常运营、需求预测与补货草拟"),
        ("selector", "选品研究员", "M4 新品导入、5 维评分测算与提交过会"),
        ("bi_analyst", "数据分析 / BI 人员", "M2 BI 财务广告与 M3 竞品舆情监控分析"),
        ("warehouse", "采购 / 仓库 / 物流人员", "M0 仓储盘点与 M6 采购单收货质检"),
        ("cs", "客服", "M1 买家咨询回复与售后退款建单"),
        ("mock_buyer", "测试买家", "M1 买家咨询模拟器联调验证"),
    ]
    for rcode, rname, rdesc in role_meta:
        if not await session.get(M8RoleDefinition, rcode):
            session.add(
                M8RoleDefinition(
                    role_code=rcode,
                    display_name=rname,
                    description=rdesc,
                    permissions_json=sorted(ROLE_PERMISSIONS.get(rcode, set())),
                )
            )

    user_seeds = [
        ("usr_approver", "陈主管", "approver", "chen@crosspilot.ai"),
        ("usr_creator", "林设计", "creator", "lin@crosspilot.ai"),
        ("usr_manager", "王总监", "manager", "wang@crosspilot.ai"),
        ("usr_planner", "张运营", "planner", "zhang@crosspilot.ai"),
        ("usr_selector", "吴选品", "selector", "wu@crosspilot.ai"),
        ("usr_analyst", "周分析", "bi_analyst", "zhou@crosspilot.ai"),
        ("usr_warehouse", "赵仓管", "warehouse", "zhao@crosspilot.ai"),
        ("usr_cs", "李客服", "cs", "li@crosspilot.ai"),
        ("usr_buyer", "测试买家", "mock_buyer", "buyer@crosspilot.ai"),
    ]
    default_pw_hash = hash_password("crosspilot123")
    for uid, uname, urole, uemail in user_seeds:
        full_uid = f"{uid}_{org_id}" if org_id != "org_demo" else uid
        existing_u = await session.get(M8UserAccount, full_uid)
        if not existing_u:
            session.add(
                M8UserAccount(
                    user_id=full_uid,
                    org_id=org_id,
                    display_name=uname,
                    role_code=urole,
                    email=uemail,
                    password_hash=default_pw_hash,
                    allowed_shop_ids_json=[],
                    is_active=True,
                )
            )
        elif not existing_u.password_hash:
            existing_u.password_hash = default_pw_hash

    policy_seeds = [
        ("pol_m4_sel", "M4", "新品选品过会审批", "预估毛利率 >= 18% 且综合分 >= 75", "SUPERVISOR", True),
        ("pol_m0_cost", "M0", "商品采购成本调价审批", "调价幅度 > 5% 须财务或主管复核", "FINANCE", True),
        ("pol_m6_rep", "M6", "补货采购申请审批", "单批采购金额 >= ¥5,000 须主管审批", "SUPERVISOR", True),
        ("pol_m7_pub", "M7", "上架内容交付审批", "5 项合规门禁全绿 + 提交人与审批人分离", "SUPERVISOR", True),
        ("pol_m1_ref", "M1", "售后退款工单审批", "退款金额 > $15 须客服主管/财务复核", "FINANCE", True),
    ]
    for pid, mod, pname, rule, approle, sod in policy_seeds:
        full_pid = f"{pid}_{org_id}"
        if not await session.get(M8ApprovalPolicy, full_pid):
            session.add(
                M8ApprovalPolicy(
                    policy_id=full_pid,
                    org_id=org_id,
                    module=mod,
                    name=pname,
                    threshold_rule=rule,
                    approver_role=approle,
                    enforce_sod=sod,
                    is_enabled=True,
                )
            )

    # 5. M0 店铺授权、商品主档、仓储库存、订单、1688 报价、成本审批
    shop_seeds = [
        ("shop_amz_us", "AMZ-US-01", "Amazon US Flagship", "amazon_us", "USD", "CONNECTED", False, "****4821"),
        ("shop_tt_us", "TT-US-01", "TikTok Shop CrossPilot US", "tiktok_us", "USD", "CONNECTED", False, "****9013"),
        ("shop_shp_th", "SHP-TH-01", "Shopee Thailand Sandbox (演示)", "shopee_th", "THB", "CONNECTED", True, "****7710"),
    ]
    for sid, scode, sname, plat, curr, st, is_mk, mask in shop_seeds:
        full_sid = f"{sid}_{org_id}"
        if not await session.get(M0Shop, full_sid):
            session.add(
                M0Shop(
                    shop_id=full_sid,
                    org_id=org_id,
                    shop_code=scode,
                    name=sname,
                    platform=plat,
                    currency=curr,
                    credential_mask=mask,
                    is_mock=is_mk,
                    status=st,
                )
            )

    fx_seeds = [
        ("USD", 1.0, "基准记账币种"),
        ("RMB", 0.1389, "固定参考汇率 (1 USD = 7.20 RMB)"),
        ("THB", 0.029, "参考汇率 (1 USD ≈ 34.48 THB)"),
        ("GBP", 1.27, "参考汇率 (1 GBP = 1.27 USD)"),
        ("EUR", 1.08, "参考汇率 (1 EUR = 1.08 USD)"),
        ("SGD", 0.75, "参考汇率 (1 SGD = 0.75 USD)"),
    ]
    for curr, rate, src in fx_seeds:
        rid = f"fx_{org_id}_{curr}"
        if not await session.get(M0FxRate, rid):
            session.add(
                M0FxRate(
                    rate_id=rid,
                    org_id=org_id,
                    currency=curr,
                    rate_to_usd=rate,
                    rate_source=src,
                )
            )

    prod_meta = {
        "SKU-00704": (38.5, 60, 20, 48, 180, 120, 28.0),
        "BAG-108": (46.0, 80, 20, 42, 240, 80, 22.0),
        "FAN-203": (31.0, 100, 20, 38, 110, 100, 19.5),
        "COS-052": (24.0, 120, 30, 42, 160, 0, 16.0),
        "MNT-405": (29.0, 60, 20, 36, 210, 60, 15.0),
    }
    for mp in get_mock_products(org_id):
        pid = f"prod_{org_id}_{mp.sku}"
        cost_rmb, moq, pack, lead_total, oh, it, base_daily = prod_meta.get(
            mp.sku, (35.0, 60, 20, 40, 150, 0, 12.0)
        )
        if not await session.get(M0Product, pid):
            session.add(
                M0Product(
                    product_id=pid,
                    org_id=org_id,
                    sku=mp.sku,
                    name=mp.name,
                    category=mp.category,
                    category_label_zh=mp.category_label_zh,
                    platform=mp.platform,
                    brand_name=mp.brand_name,
                    sale_price_usd=mp.sale_price_usd or 24.9,
                    strike_price_usd=mp.strike_price_usd,
                    unit_cost_usd=round(cost_rmb / 7.2, 2),
                    moq=moq,
                    pack_size=pack,
                    lead_time_days=lead_total,
                    origin=mp.origin,
                    approver=mp.approver,
                    decision_reason=mp.decision_reason,
                    specs_json=mp.specs,
                    selling_points_json=mp.selling_points,
                )
            )
        inv_id = f"inv_{org_id}_{mp.sku}"
        if not await session.get(M0Inventory, inv_id):
            session.add(
                M0Inventory(
                    inv_id=inv_id,
                    org_id=org_id,
                    warehouse_code="FBA-ONT8",
                    sku=mp.sku,
                    on_hand=oh,
                    in_transit=it,
                    reserved=12,
                )
            )

        # 90-day deterministic sales history for M5/M6 backtesting
        existing_hist = await session.scalar(
            select(M5SalesHistory).where(M5SalesHistory.org_id == org_id, M5SalesHistory.sku == mp.sku).limit(1)
        )
        if not existing_hist:
            for offset in range(90, 0, -1):
                d = today - timedelta(days=offset)
                wave = 1.0 + 0.25 * math.sin(offset / 6.0) + (0.12 if d.weekday() >= 5 else 0.0)
                is_so = mp.sku == "SKU-00704" and offset in (22, 21, 20)
                qty = 0.0 if is_so else round(max(1.0, base_daily * wave), 1)
                eod = 0.0 if is_so else float(max(20, oh - (offset % 15) * 4))
                session.add(
                    M5SalesHistory(
                        org_id=org_id,
                        sku=mp.sku,
                        sales_date=d,
                        qty_raw=qty,
                        on_hand_eod=eod,
                        revenue_usd=round(qty * float(mp.sale_price_usd or 24.9), 2),
                    )
                )

    order_seeds = [
        ("ord_1001", "shop_amz_us", "SKU-00704", 42, 1129.8, "DELIVERED", 14, False),
        ("ord_1002", "shop_tt_us", "BAG-108", 35, 1046.5, "SHIPPED", 5, False),
        ("ord_1003", "shop_amz_us", "FAN-203", 58, 1073.0, "DELIVERED", 9, False),
        ("ord_1004", "shop_amz_us", "COS-052", 28, 641.2, "PAID", 2, False),
        ("ord_1005", "shop_amz_us", "MNT-405", 64, 1273.6, "DELIVERED", 7, False),
        ("ord_mock_01", "shop_shp_th", "SKU-00704", 10, 269.0, "DEMO_PAID", 1, True),
    ]
    for oid, shid, sku, qty, rev, st, days_ago, is_mk in order_seeds:
        full_oid = f"{oid}_{org_id}"
        if not await session.get(M0Order, full_oid):
            session.add(
                M0Order(
                    order_id=full_oid,
                    org_id=org_id,
                    shop_id=f"{shid}_{org_id}",
                    sku=sku,
                    order_date=(today - timedelta(days=days_ago)).isoformat(),
                    qty=qty,
                    revenue_usd=rev,
                    is_mock=is_mk,
                    status=st,
                )
            )

    quote_seeds = [
        ("qt_00704", "SKU-00704", "深圳科创新品智造厂", 38.5, 60, 12, "1688 模拟比价：https://detail.1688.com/offer/704001.html"),
        ("qt_bag108", "BAG-108", "义乌轻行箱包实业", 46.0, 80, 10, "1688 模拟比价：https://detail.1688.com/offer/108002.html"),
    ]
    for qid, sku, sup, pr, moq, ld, note in quote_seeds:
        full_qid = f"{qid}_{org_id}"
        if not await session.get(M0SupplierQuote, full_qid):
            session.add(
                M0SupplierQuote(
                    quote_id=full_qid,
                    org_id=org_id,
                    sku=sku,
                    supplier_name=sup,
                    unit_price_rmb=pr,
                    moq=moq,
                    lead_time_days=ld,
                    is_simulated=True,
                    note=note,
                )
            )

    cost_req_id = f"creq_00704_{org_id}"
    if not await session.get(M0CostRequest, cost_req_id):
        session.add(
            M0CostRequest(
                req_id=cost_req_id,
                org_id=org_id,
                sku="SKU-00704",
                old_cost_usd=5.55,
                new_cost_usd=5.35,
                reason="1688 年度阶梯议价降本 3.75%",
                status="PENDING",
                proposer_id="usr_purchasing",
            )
        )

    # 6. M1 FAQ / 会话 / 售后工单
    for sku in ("SKU-00704", "BAG-108", "FAN-203"):
        mf = get_mock_faq(org_id, sku)
        fid = f"faq_{org_id}_{sku}"
        if not await session.get(M1FaqEntry, fid):
            session.add(
                M1FaqEntry(
                    faq_id=fid,
                    org_id=org_id,
                    sku=sku,
                    pain_points_json=mf.pain_points,
                    faq_pairs_json=mf.faq_pairs,
                )
            )

    cs_id = f"cs_seed1_{org_id}"
    if not await session.get(M1CsSession, cs_id):
        session.add(
            M1CsSession(
                session_id=cs_id,
                org_id=org_id,
                sku="SKU-00704",
                buyer_name="Emily R.",
                channel="Amazon Buyer Msg",
                question="Does this mini sealer work with regular chip bags or only textured vacuum bags?",
                reply="",
                is_mock=True,
                status="OPEN",
            )
        )

    tkt_id = f"tkt_seed1_{org_id}"
    if not await session.get(M1AftersalesTicket, tkt_id):
        session.add(
            M1AftersalesTicket(
                ticket_id=tkt_id,
                org_id=org_id,
                sku="FAN-203",
                order_ref="SHP-661-0021934",
                platform="Shopee TH",
                issue_type="充电线缺失补发退款",
                refund_usd=6.5,
                evidence_note="买家上传开箱照片，盒内缺少 USB-C 线",
                status="PENDING_APPROVAL",
                submitter_id="usr_cs",
            )
        )

    # 7. M2 广告与 M3 竞品监控
    ad_seeds = [
        ("ad_00704", "SKU-00704", "Amazon Sponsored", "SP-SKU00704-Exact", 65.0, 390.0, 1950.0, 0.20, 5.0, "ACTIVE"),
        ("ad_bag108", "BAG-108", "TikTok Shop Ads", "TT-Video-BAG108", 45.0, 260.0, 1120.0, 0.23, 4.3, "ACTIVE"),
    ]
    for aid, sku, plat, cname, bud, sp, sl, acos, roas, st in ad_seeds:
        full_aid = f"{aid}_{org_id}"
        if not await session.get(M2AdCampaign, full_aid):
            session.add(
                M2AdCampaign(
                    campaign_id=full_aid,
                    org_id=org_id,
                    sku=sku,
                    platform=plat,
                    campaign_name=cname,
                    daily_budget_usd=bud,
                    spend_7d_usd=sp,
                    sales_7d_usd=sl,
                    acos=acos,
                    roas=roas,
                    status=st,
                )
            )

    cmp_seeds = [
        ("cmp_00704", "SKU-00704", "Bonsenkitchen Mini", "B09XYZ1234", 29.99, 4.4, 842, 310, 0.79, ["发热丝易氧化", "不支持湿抽"], "竞品降价 $2 促销"),
        ("cmp_bag108", "BAG-108", "Tomtoc Slim 18L", "B08ABC5678", 35.99, 4.6, 1290, 185, 0.87, ["肩带调节扣偏紧"], "BSR 排名上升 15 位"),
    ]
    for wid, sku, brand, asin, pr, rt, rc, bsr, sent, topics, alert in cmp_seeds:
        full_wid = f"{wid}_{org_id}"
        if not await session.get(M3CompetitorWatch, full_wid):
            session.add(
                M3CompetitorWatch(
                    watch_id=full_wid,
                    org_id=org_id,
                    sku=sku,
                    competitor_brand=brand,
                    asin_or_ref=asin,
                    price_usd=pr,
                    rating=rt,
                    review_count=rc,
                    bsr_rank=bsr,
                    sentiment_score=sent,
                    negative_topics_json=topics,
                    last_alert=alert,
                )
            )

    # 8. M4 选品候选池
    cand_seeds = [
        ("cand_704", "SKU-00704", "无线真空迷你封口机", "kitchen_appliance", "1688 趋势选品", 26.9, 38.5, 16.0, 0.34, {"demand": 88, "competition": 78, "margin": 85, "supply": 86, "compliance": 82}, 84, "APPROVED", "usr_operator", "陈主管", "毛利率健康且专利检索通过"),
        ("cand_812", "LED-812", "磁吸感应橱柜灯条", "3c_accessories", "TikTok 爆款池", 24.9, 28.0, 14.0, 0.41, {"demand": 86, "competition": 72, "margin": 90, "supply": 84, "compliance": 80}, 82, "PENDING_APPROVAL", "usr_operator", None, None),
        ("cand_905", "PET-905", "智能恒温宠物饮水机", "kitchen_appliance", "Amazon Movers", 39.9, 64.0, 26.0, 0.29, {"demand": 79, "competition": 68, "margin": 74, "supply": 76, "compliance": 75}, 74, "DISCOVERED", None, None, None),
    ]
    for cid, sku, cname, cat, src, pr, cost, ship, mg, sc, tot, st, sub, app, dnote in cand_seeds:
        full_cid = f"{cid}_{org_id}"
        if not await session.get(M4Candidate, full_cid):
            session.add(
                M4Candidate(
                    candidate_id=full_cid,
                    org_id=org_id,
                    sku=sku,
                    name=cname,
                    category=cat,
                    source_channel=src,
                    target_price_usd=pr,
                    est_cost_rmb=cost,
                    est_shipping_rmb=ship,
                    est_margin_pct=mg,
                    scores_json=sc,
                    total_score=tot,
                    operator_note="已完成 1688 样品核价与竞品差评分析",
                    status=st,
                    submitter_id=sub,
                    approver_id=app,
                    decision_note=dnote,
                )
            )

    # 9. M6 补货申请、采购单、告警与周复盘
    ap_id = f"ap_seed1_{org_id}"
    if not await session.get(M6ReplenishApply, ap_id):
        session.add(
            M6ReplenishApply(
                apply_id=ap_id,
                org_id=org_id,
                sku="FAN-203",
                route_code="sea",
                objective_mode="profit",
                qty_suggest=500,
                qty_propose=500,
                est_amount_rmb=15500.0,
                status="pending_approve",
                submit_user="usr_operator",
            )
        )

    po_id = f"po_seed1_{org_id}"
    if not await session.get(M6PurchaseOrder, po_id):
        session.add(
            M6PurchaseOrder(
                po_id=po_id,
                org_id=org_id,
                apply_id=f"ap_prev_{org_id}",
                sku="SKU-00704",
                route_code="air",
                order_qty=120,
                receive_qty=0,
                defect_qty=0,
                status="shipping",
                expect_arrive=today + timedelta(days=5),
            )
        )

    alt_id = f"alt_seed1_{org_id}"
    if not await session.get(M6AlertEvent, alt_id):
        session.add(
            M6AlertEvent(
                alert_id=alt_id,
                org_id=org_id,
                sku="FAN-203",
                severity="HIGH",
                alert_type="STOCKOUT_RISK",
                message="FAN-203 当前在手 110 件，按日均 19.5 件预计 5.6 天触及断货警戒线，建议审批补货。",
                status="OPEN",
            )
        )

    rev_id = f"rev_seed1_{org_id}"
    if not await session.get(M6WeeklyReview, rev_id):
        session.add(
            M6WeeklyReview(
                review_id=rev_id,
                org_id=org_id,
                week_label="2026-W46",
                summary_text="本周 SKU-00704 空运补货 120 件已发出；FAN-203 旺季销量环比 +18%，已发起 500 件海运补货申请。",
                metrics_json={"total_pos": 1, "fully_received": 0, "open_alerts": 1},
                is_mock=True,
                created_by="usr_supervisor",
            )
        )

    await session.commit()
