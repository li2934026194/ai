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

    await session.commit()
