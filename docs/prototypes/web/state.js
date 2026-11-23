export const SRS_ROLES = [
  { key: "approver", label: "主管 / 审批人", code: "approver", pill: "p-red", desc: "终审拍板：M1售后审批、M4选品测款/淘汰、M6补货批准、M7发布把关" },
  { key: "manager", label: "大屏浏览者 / 管理者", code: "viewer/manager", pill: "p-purple", desc: "全局管理：M8员工授权管理、M0店铺OAuth、M2看发布大屏、M3经营问数" },
  { key: "planner", label: "驾驶舱设计者 / 业务运营", code: "planner", pill: "p-blue", desc: "业务编排：M2驾驶舱设计发布、M5销量预测、M6普通/智能补货提交草案" },
  { key: "bi_analyst", label: "数据分析 / BI 人员", code: "bi_analyst", pill: "p-blue", desc: "指标口径：M3指标绑定与Celery调度、M2指标配置复用、只读问数" },
  { key: "selector", label: "选品研究员", code: "selector", pill: "p-blue", desc: "选品初筛：M4三源数据接入、机会池初筛提交待审清单（不可自批）" },
  { key: "creator", label: "内容创作 / 审核人员", code: "creator", pill: "p-purple", desc: "内容生成：M7文案/1大4小主图/短视频生成与整套交付校验提交" },
  { key: "warehouse", label: "采购 / 仓库 / 物流人员", code: "warehouse", pill: "p-green", desc: "仓储履约：M0-3分店库存盘点校准、M6-4采购/质检/分批收货凭证登记" },
  { key: "cs", label: "客服", code: "cs", pill: "p-blue", desc: "一线接待：M1三栏工作台接管、双语回复、订单核验与提交售后工单" },
  { key: "mock_buyer", label: "买家（模拟）", code: "mock_buyer", pill: "p-gray", desc: "教学演示入口：仅可访问M1-3模拟买家入口发送英文咨询或投诉" },
];

export function createInitialState() {
  return {
    role: "manager",
    pageId: "m4b",
    openModuleId: "m4",
    showAnno: false,
    stockSyncedAt: "09:50:12",

    // M0: Shops, Master Products, Store×Warehouse Independent Stock
    shops: [
      { id: "shop_th", name: "Shopee 泰国主店", platform: "SHOPEE", region: "TH", mode: "REAL", status: "Token有效", lastSync: "2026-11-19 10:15" },
      { id: "shop_us", name: "TikTok Shop 美区", platform: "TIKTOK", region: "US", mode: "REAL", status: "Token有效", lastSync: "2026-11-19 10:12" },
      { id: "shop_mk", name: "Amazon 演示沙盒店", platform: "AMAZON", region: "US", mode: "MOCK", status: "仅限演示", lastSync: "2026-11-19 09:40" },
    ],
    m0bSearch: "",
    m0bTypeFilter: "ALL",
    masterProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", cat: "箱包出行", cost: 6.8, ship: 2.4, price: "$34.50", shops: ["Shopee TH (SH-BAG108)", "TikTok US (TT-BAG108)", "Amazon Mock"], costVer: "v4", mode: "一货多店" },
      { sku: "FAN-203", name: "便携静音循环扇", cat: "小家电", cost: 11.2, ship: 3.1, price: "$29.00", shops: ["Shopee TH (SH-FAN203)"], costVer: "v2", mode: "泰国专卖" },
      { sku: "MAT-014", name: "桌面皮质收纳垫", cat: "办公家居", cost: 4.5, ship: 1.8, price: "$18.90", shops: ["TikTok US (TT-MAT014)", "Amazon Mock"], costVer: "v3", mode: "美区主推" },
      { sku: "COS-052", name: "焕亮保湿面霜 50ml", cat: "美妆护肤", cost: 5.2, ship: 1.9, price: "$24.00", shops: ["TikTok US (TT-COS052)"], costVer: "v1", mode: "美区专卖" },
    ],
    m0cShopFilter: "ALL",
    m0cSearch: "",
    inventoryItems: [
      { id: "inv1", sku: "BAG-108", name: "轻量通勤双肩包", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-BAG108", wh: "US-WH-2", avail: 18, locked: 4, safety: 25, updated: "09:50:12", note: "一货多店·美区独立海外仓" },
      { id: "inv2", sku: "BAG-108", name: "轻量通勤双肩包", shopId: "shop_th", shopName: "Shopee 泰国主店", shopMode: "REAL", shopSku: "SH-BAG108", wh: "TH-WH-1", avail: 52, locked: 3, safety: 30, updated: "09:50:12", note: "同款SKU在泰仓独立库存" },
      { id: "inv3", sku: "FAN-203", name: "便携静音循环扇", shopId: "shop_th", shopName: "Shopee 泰国主店", shopMode: "REAL", shopSku: "SH-FAN203", wh: "TH-WH-1", avail: 43, locked: 2, safety: 60, updated: "09:50:12", note: "泰国站专卖商品" },
      { id: "inv4", sku: "MAT-014", name: "桌面皮质收纳垫", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-MAT014", wh: "US-WH-1", avail: 120, locked: 6, safety: 40, updated: "09:50:12", note: "美区主推商品" },
      { id: "inv5", sku: "COS-052", name: "焕亮保湿面霜 50ml", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-COS052", wh: "US-WH-1", avail: 6, locked: 1, safety: 35, updated: "09:50:12", note: "美区专卖·极低库存" },
      { id: "inv6", sku: "BAG-108", name: "轻量通勤双肩包 (演示)", shopId: "shop_mk", shopName: "Amazon 演示沙盒店", shopMode: "MOCK", shopSku: "MK-BAG108", wh: "MOCK-US", avail: 99, locked: 0, safety: 20, updated: "09:40:00", note: "仅演示教学用，绝不计入实盘" },
    ],

    // M1
    csActiveId: "s1",
    csShopFilter: "ALL",
    csSearch: "",
    csSessions: [
      {
        id: "s1", buyer: "Mock Buyer", platform: "AMAZON US", lang: "EN", time: "14:32",
        preview: "My item arrived damaged, I want a refund.", mode: "PENDING_HUMAN",
        intent: "REFUND", conf: "88%", risk: true, recs: "", orderId: "SYN9D-005671", bound: false,
        messages: [
          { role: "buyer", text: "Please check order SYN9D-005671.", zh: "请核查订单 SYN9D-005671。" },
          { role: "buyer", text: "My item arrived damaged, I want a refund.", zh: "我的商品送达时已损坏，我想申请退款。" },
        ]
      },
      {
        id: "s2", buyer: "Alex M***", platform: "SHOPEE TH", lang: "EN", time: "14:28",
        preview: "Looking for waterproof desk pad for office.", mode: "AI_AUTO",
        intent: "PRODUCT_INQUIRY", conf: "93%", risk: false,
        recs: "① MAT-014 桌面收纳垫 (92%) ② BAG-108 (76%) ③ FAN-203 (64%)",
        orderId: "ORD-20261119-8821", bound: false,
        messages: [
          { role: "buyer", text: "Hi, do you recommend a waterproof desk mat?", zh: "你好，有推荐的防水桌面垫吗？" },
        ]
      },
    ],
    csProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", shop: "Shopee TH", price: "$34.50", vec: "READY", on: true },
      { sku: "MAT-014", name: "桌面皮质收纳垫", shop: "TikTok US", price: "$18.90", vec: "READY", on: true },
      { sku: "FAN-203", name: "便携静音循环扇", shop: "Shopee TH", price: "$29.00", vec: "READY", on: true },
      { sku: "COS-052", name: "焕亮保湿面霜 50ml", shop: "TikTok US", price: "$24.00", vec: "INDEXING", on: true },
    ],
    ticketIdx: 0,
    tickets: [
      { id: "TK-20261119-01", order: "SYN9D-005671", type: "破损全退 $34.50", submitter: "cs", status: "待主管审批", ext: "—" },
      { id: "TK-20261118-09", order: "ORD-881204", type: "补发配件 $0.00", submitter: "林客服", status: "已批准", ext: "UNKNOWN" },
    ],

    // M2
    biSelectedIdx: 0,
    biWidgets: [
      { title: "近30日 GMV 销售额", val: "$125,429.99", metric: "gmv", scope: "全部平台 · 近30天", color: "var(--blue-hover)" },
      { title: "近30日 净利润", val: "$65,529.67", metric: "net_profit", scope: "全部平台 · 近30天", color: "var(--green-text)" },
      { title: "近30日 广告花费", val: "$18,650.16", metric: "ad_spend", scope: "全部平台 · 近30天", color: "var(--amber-text)" },
    ],
    biInsight: "近30天净利率 52.2% (65,529.67 ÷ 125,429.99)，ACOS 14.9%，Amazon 近7天广告花费 $2,933.63 处于安全区间。",

    // M3
    qaBindings: [
      { name: "GMV 销售额 (gmv)", kind: "SIMULATION", platform: "AMAZON", cron: "每5分钟", val: "360,000 USD", status: "SUCCESS" },
      { name: "虾皮销量 (shopify_sale)", kind: "SIMULATION", platform: "SHOPEE", cron: "手动", val: "1,000,000 USD", status: "SUCCESS" },
      { name: "amazon-np (net_profit)", kind: "SIMULATION", platform: "AMAZON", cron: "每15分钟", val: "5,600 USD", status: "SUCCESS" },
      { name: "亚马逊广告 (ad_spend)", kind: "REST API", platform: "AMAZON", cron: "每5分钟", val: "13,000 USD", status: "SUCCESS" },
    ],
    qaChat: [
      { role: "user", text: "各平台近30天净利润是多少？" },
      { role: "assistant", text: "全部平台近 30 天净利润为 65,529.67 USD（GMV 125,429.99 USD，净利率 52.2%）。", note: "口径：按组织、店铺与币种统一折算 USD（多币种未配汇率则分币种列出）。", sql: "SELECT SUM(net_profit_usd), SUM(gmv_usd) FROM metric_snapshots WHERE days=30 [38ms]" },
    ],

    // M4 Selection (Reference Image 27/28 + FR-SEL-09 multi-perspective recommendation)
    m4Tasks: [
      { file: "Amazon SP-API Mock · rate", kind: "演示Mock", scope: "AMAZON/US · 20 SKU · 8周", status: "成功 (160条 · 仅演示)", ok: true, tag: "DEMO_ONLY" },
      { file: "选品周数据_10000条模拟_nov.xlsx", kind: "外购数据", scope: "1250 SKU · US (10,000条)", status: "成功 (估算)", ok: true, tag: "ESTIMATE_ONLY" },
      { file: "weekly_internal_nov.csv", kind: "内部数据", scope: "6 SKU · US/TH (48条)", status: "成功 (纯内部实盘)", ok: true, tag: "READY_REVIEW" },
    ],
    m4Mode: "balanced", // "balanced" | "revenue" | "growth"
    m4AiOpen: true,
    m4Tab: "ALL",
    m4Search: "",
    m4SrcFilter: "ALL",
    m4RegionFilter: "ALL",
    m4MinRev: 0,
    m4Page: 1,
    m4Pool: [
      { sku: "SKU-00515", name: "汽车后备箱整理箱", region: "AMAZON / US", paidQty: 1960, refundQty: 40, grossRev: 68500, discount: 670.46, refundAmt: 1000, trend: 27.5, prevAvg: 200, currAvg: 255, marginKnown: true, margin: 14.2, src: "内部数据", srcCode: "INTERNAL", stage: "AI初筛候选", submitter: "—", missing: "", budget: "$1,200 (50件)", riskNote: "轻小件无侵权命中" },
      { sku: "SKU-00538", name: "可折叠防水洗衣篮", region: "AMAZON / US", paidQty: 1580, refundQty: 30, grossRev: 58200, discount: 540, refundAmt: 1138.06, trend: 31.2, prevAvg: 170, currAvg: 223, marginKnown: false, margin: null, src: "外购数据", srcCode: "PAID_EXTERNAL", stage: "缺成本/待补全", submitter: "—", missing: "缺少采购成本与头程费", budget: "$950 (40件)", riskNote: "需核对 1688 拿货价与实盘利润" },
      { sku: "SKU-00299", name: "防抓宠物汽车座垫", region: "AMAZON / US", paidQty: 1490, refundQty: 25, grossRev: 54800, discount: 410.58, refundAmt: 1200, trend: 16.6, prevAvg: 180, currAvg: 210, marginKnown: true, margin: 16.8, src: "内部数据", srcCode: "INTERNAL", stage: "已提交待审", submitter: "吴选品", missing: "", budget: "$1,500 (60件)", riskNote: "内部实单已满足 10% 利润门槛" },
      { sku: "SKU-00612", name: "磁吸折叠桌面支架", region: "TIKTOK / US", paidQty: 1320, refundQty: 18, grossRev: 44200, discount: 300, refundAmt: 620, trend: 52.4, prevAvg: 130, currAvg: 198, marginKnown: true, margin: 18.5, src: "内部数据", srcCode: "INTERNAL", stage: "AI初筛候选", submitter: "—", missing: "", budget: "$1,050 (45件)", riskNote: "高增高毛利，适合趋势优先推荐" },
      { sku: "SKU-00704", name: "无线真空迷你封口机", region: "SHOPEE / TH", paidQty: 980, refundQty: 22, grossRev: 26800, discount: 200, refundAmt: 450, trend: 19.8, prevAvg: 111, currAvg: 133, marginKnown: true, margin: 15.1, src: "内部数据", srcCode: "INTERNAL", stage: "已批准测款", submitter: "吴选品", missing: "", budget: "$880 (80件)", riskNote: "带电商品已确认空运渠道" },
      { sku: "SKU-00418", name: "便携露营氛围灯串", region: "AMAZON / US", paidQty: 610, refundQty: 45, grossRev: 14200, discount: 180, refundAmt: 920, trend: -8.4, prevAvg: 83, currAvg: 76, marginKnown: true, margin: 6.2, src: "外购数据", srcCode: "PAID_EXTERNAL", stage: "已淘汰", submitter: "吴选品", missing: "利润率<10%且负增长", budget: "—", riskNote: "负增长+低利润直接淘汰" },
    ],

    // M5
    m5Sku: "BAG-108",
    m5Horizon: 7,
    m5Model: "CatBoost · v1",
    demandProfileVer: 1,
    demandProfileMode: "平稳季节 + 短周期波动",
    m5Models: [
      { name: "CatBoost · v1", family: "TREE", minPts: 90, ready: "已接入推理", enabled: true, desc: "按真实日销量滞后值与星期特征训练" },
      { name: "Croston / SBA · v1", family: "INTERMITTENT", minPts: 30, ready: "已接入推理", enabled: true, desc: "适合含大量零销量的间歇需求基线" },
      { name: "Holt-Winters · v1", family: "STATISTICAL", minPts: 56, ready: "已接入推理", enabled: true, desc: "短周期趋势与季节性指数平滑基线" },
      { name: "LightGBM · v1", family: "TREE", minPts: 90, ready: "已接入推理", enabled: true, desc: "树模型日频预测，未接入外生促销特征" },
      { name: "Prophet · v1", family: "STATISTICAL", minPts: 90, ready: "已接入推理", enabled: true, desc: "拟合趋势与周季节性曲线" },
      { name: "SARIMA · v1", family: "STATISTICAL", minPts: 90, ready: "已接入推理", enabled: true, desc: "稳定季节序列统计基线" },
      { name: "TFT / Transformer", family: "DEEP", minPts: 180, ready: "样本不足提示", enabled: true, desc: "建议≥180天真实订单，当前96天仅短样本参考" },
      { name: "TSB · v1", family: "INTERMITTENT", minPts: 30, ready: "已接入推理", enabled: true, desc: "需求概率变化的长尾间歇序列" },
      { name: "TSFM 零样本", family: "FOUNDATION", minPts: 8, ready: "已接入推理", enabled: true, desc: "Chronos-Bolt-Tiny 零样本推理需回测验证" },
    ],
    m5DailyPred: [29, 63, 27, 138, 130, 88, 153],
    m5Eval: [
      { date: "2026-11-11", pred: 29, actual: 32, stockout: false, edited: false },
      { date: "2026-11-12", pred: 63, actual: 58, stockout: false, edited: false },
      { date: "2026-11-13", pred: 27, actual: 35, stockout: true, edited: true },
      { date: "2026-11-14", pred: 138, actual: 132, stockout: false, edited: false },
    ],

    // M6: Strictly separated NORMAL vs SMART
    m6NormalSku: "FAN-203",
    m6NormalSeasonPct: 0,
    m6NormalSeasonRef: "历史同期报表 #2025-Q4",
    m6NormalPromoPct: 0,
    m6NormalPromoRef: "",
    m6NormalLeadDays: 18,
    m6NormalSafetyDays: 4,
    m6NormalInTransit: 0,
    m6NormalPlanIdx: 1,

    m6SmartSku: "BAG-108", // BAG-108 has M5 forecast; COS-052/MAT-014 lack forecast -> FORECAST_REQUIRED!
    m6SmartRoute: "海运标准线 ($1.9/件 · 18天)",
    m6SmartAllocPct: 70,
    m6SmartLeadDays: 18,
    m6SmartSafetyDays: 5,
    m6SmartInTransit: 20,

    m6ApprovalTab: "NORMAL",
    m6Plans: [
      { id: "RP-N-20261119-01", mode: "NORMAL", sku: "FAN-203", shop: "Shopee TH · TH-WH-1", qty: 620, cash: "$6,944", sig: "sig:8a4f..OK", submitter: "张运营", status: "待主管审批" },
      { id: "RP-S-20261119-02", mode: "SMART", sku: "BAG-108", shop: "TikTok US · US-WH-2", qty: 1850, cash: "$12,580", sig: "sig:3e9b..OK", submitter: "张运营", status: "待主管审批" },
    ],
    m6Receipts: [
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第1批 (11-28)", planQty: 620, gotQty: 400, diff: 0, qc: "质检合格 #QC1", who: "赵仓管" },
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第2批 (12-05)", planQty: 620, gotQty: 215, diff: -5, qc: "短装5件差异已登记", who: "赵仓管" },
    ],

    // M7 (Reference Image 30: 1-large+4-small + 8-item delivery checklist)
    m7Sku: "MAT-014",
    m7Platform: "Amazon US",
    m7Lang: "English (US)",
    m7CopyType: "商品标题",
    m7MustTerm: "Waterproof, PU Leather",
    m7BanTerm: "Best, #1, Miracle",
    m7CopyGenCount: 1,
    m7ResultTab: "商品标题",
    m7SelectedTitle: "MAT-014 | Waterproof, PU Leather Premium Desk Pad for Office & Home",
    m7SelectedBullets: "5条核心卖点已就绪（含 Waterproof 防泼水与双面可用特性）",
    m7SelectedDesc: "完整 A+ 段落文案草稿已生成",
    m7SelectedKeywords: "waterproof desk mat, pu leather office pad, large mouse mat (20词)",

    m7ImgWorkflow: "Amazon 白底主图 · v3 (ComfyUI)",
    m7ImgSeed: 101,
    m7PickedImgIdx: 0,
    m7Images: [
      { id: 0, code: "01 / 白底主图", title: "纯白棚拍主图 (85%占比)", editNote: "原始出图", done: true },
      { id: 1, code: "02 / 使用场景", title: "居家办公桌面场景", editNote: "原始出图", done: true },
      { id: 2, code: "03 / 功能卖点", title: "防水泼溅图标对比", editNote: "原始出图", done: true },
      { id: 3, code: "04 / 尺寸规格", title: "800×400mm 尺寸标注", editNote: "原始出图", done: true },
      { id: 4, code: "05 / 包装清单", title: "礼盒+收纳带包装展示", editNote: "原始出图", done: false },
    ],
    m7VidType: "产品展示",
    m7VidWorkflow: "SVD 图生视频 · 15s 竖屏工作流",
    m7VidProgress: 100,
    m7VidDone: true,
    m7AplusDone: false,
    m7PreviewTab: "主图/附图",
    m7ComplianceStatus: "待校验", // 待校验 -> 校验通过 -> 主管已批准导出

    // M8
    m8RoleFilter: "ALL",
    employees: [
      { id: "EMP-101", name: "陈主管", role: "approver", shop: "全部实盘店铺 (Shopee TH + TikTok US)", active: true, lastLogin: "今天 10:12" },
      { id: "EMP-102", name: "王总", role: "manager", shop: "全部实盘店铺 (全局授权与大屏)", active: true, lastLogin: "今天 09:45" },
      { id: "EMP-103", name: "张运营", role: "planner", shop: "全部实盘店铺 (Shopee TH + TikTok US)", active: true, lastLogin: "今天 10:08" },
      { id: "EMP-104", name: "李运营", role: "planner", shop: "TikTok Shop 美区", active: true, lastLogin: "昨天 18:20" },
      { id: "EMP-105", name: "刘数据", role: "bi_analyst", shop: "全部数据源 (只读问数与口径维护)", active: true, lastLogin: "今天 09:30" },
      { id: "EMP-106", name: "吴选品", role: "selector", shop: "Amazon US / 行业机会池", active: true, lastLogin: "今天 10:01" },
      { id: "EMP-107", name: "孙文案", role: "creator", shop: "Amazon US / TikTok US 内容库", active: true, lastLogin: "今天 09:55" },
      { id: "EMP-108", name: "赵仓管", role: "warehouse", shop: "US-WH-1 / US-WH-2 / TH-WH-1", active: true, lastLogin: "今天 09:50" },
      { id: "EMP-109", name: "钱物流", role: "warehouse", shop: "TH-WH-1", active: true, lastLogin: "昨天 17:40" },
      { id: "EMP-110", name: "林客服", role: "cs", shop: "Shopee 泰国主店 + Amazon 沙盒", active: true, lastLogin: "今天 10:16" },
      { id: "EMP-111", name: "周客服", role: "cs", shop: "TikTok Shop 美区", active: true, lastLogin: "今天 08:50" },
      { id: "EMP-112", name: "演示买家01", role: "mock_buyer", shop: "仅演示沙盒 (Mock)", active: true, lastLogin: "演示入口" },
    ],
    auditLogs: [
      { time: "10:15:02", actor: "manager", target: "林客服 (EMP-110)", action: "新增员工授权", detail: "授予角色「客服」，范围：Shopee 泰国主店", ok: true },
      { time: "10:04:19", actor: "selector", target: "M4-3 SKU-00515 测款拍板", action: "权限拦截 (403)", detail: "选品研究员不可自审拍板，需由主管/审批人终审", ok: false },
      { time: "09:51:40", actor: "approver", target: "赵仓管 (EMP-108)", action: "确认仓储权限", detail: "启用 M0-3 分店库存校准与 M6-4 收货凭证登记", ok: true },
    ],
  };
}

export function getRoleTodos(state) {
  const r = state.role;
  const todos = {};
  const pendTk = state.tickets.filter(t => t.status === "待主管审批").length;
  const pendSel = state.m4Pool.filter(x => x.stage === "已提交待审").length;
  const aiCand = state.m4Pool.filter(x => x.stage === "AI初筛候选").length;
  const missSel = state.m4Pool.filter(x => x.stage === "缺成本/待补全").length;
  const pendRp = state.m6Plans.filter(p => p.status === "待主管审批").length;
  const lowInv = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety).length;
  const pendCs = state.csSessions.filter(s => s.mode === "PENDING_HUMAN").length;
  const imgMiss = state.m7Images.filter(im => !im.done).length;

  if (r === "approver") {
    if (pendTk) todos.m1c = `待审 ${pendTk}`;
    if (pendSel) todos.m4c = `待拍板 ${pendSel}`;
    if (pendRp) todos.m6c = `待批 ${pendRp}`;
    if (state.m7ComplianceStatus !== "主管已批准导出") todos.m7d = "待把关";
  } else if (r === "manager") {
    todos.m0a = `${state.shops.length} 店`;
    todos.m2b = "大屏";
    todos.m8a = `授权 ${state.employees.length}`;
  } else if (r === "planner") {
    todos.m2a = "设计";
    todos.m5b = "预测";
    todos.m6a = "测算";
  } else if (r === "bi_analyst") {
    todos.m3a = `调度 ${state.qaBindings.length}`;
    todos.m3b = "问数";
    todos.m5c = "WAPE";
  } else if (r === "selector") {
    if (aiCand + missSel) todos.m4b = `初筛 ${aiCand + missSel}`;
  } else if (r === "creator") {
    if (imgMiss) todos.m7b = `缺图 ${imgMiss}`;
    todos.m7d = "交付";
  } else if (r === "warehouse") {
    if (lowInv) todos.m0c = `预警 ${lowInv}`;
    todos.m6d = "收货";
  } else if (r === "cs") {
    if (pendCs) todos.m1a = `接管 ${pendCs}`;
    if (pendTk) todos.m1c = `跟进 ${pendTk}`;
  } else if (r === "mock_buyer") {
    todos.m1d = "测试入口";
  }
  return todos;
}
