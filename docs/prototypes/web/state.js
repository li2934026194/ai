export const API_BASE = ""; // 预留后端 API 基址；留空表示纯前端演示模拟态，B类外部服务不伪造成功

export function pad2(n) { return String(n).padStart(2, "0"); }
export function nowTimeStr(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
export function nowDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function nowDateTimeStr(d = new Date()) {
  return `${nowDateStr(d)} ${nowTimeStr(d)}`;
}
export function genDocId(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${ymd}-${rnd}`;
}
export function relTimeLabel(ts) {
  if (!ts) return "历史示例";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 15) return "刚刚更新";
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  return `${Math.floor(diff / 3600)}小时前`;
}

function makeSvgImg(bg, accent, label, iconSvg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#ffffff"/></linearGradient></defs><rect width="120" height="120" rx="14" fill="url(#g)"/><rect x="3" y="3" width="114" height="114" rx="12" fill="none" stroke="${accent}" stroke-opacity="0.22" stroke-width="1.5"/>${iconSvg}<rect x="10" y="92" width="100" height="19" rx="6" fill="${accent}" fill-opacity="0.9"/><text x="60" y="105" text-anchor="middle" font-family="sans-serif" font-size="10.5" font-weight="700" fill="#ffffff">${label}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const PRODUCT_IMAGES = {
  "BAG-108": makeSvgImg("#dbeafe", "#2563eb", "双肩包 BAG-108", `<path d="M38 42c0-11 9-18 22-18s22 7 22 18v34c0 5-4 9-9 9H47c-5 0-9-4-9-9V42z" fill="#1e40af"/><path d="M48 24c0-5 5-9 12-9s12 4 12 9" fill="none" stroke="#1e40af" stroke-width="4"/><rect x="46" y="48" width="28" height="20" rx="5" fill="#60a5fa"/><line x1="49" y1="56" x2="71" y2="56" stroke="#fff" stroke-width="2.5"/>`),
  "FAN-203": makeSvgImg("#d1fae5", "#059669", "循环扇 FAN-203", `<circle cx="60" cy="46" r="22" fill="#047857"/><circle cx="60" cy="46" r="17" fill="#ecfdf5"/><circle cx="60" cy="46" r="5" fill="#047857"/><path d="M60 41c8-10 14-4 6 3m-11 2c-10-8-4-14 3-6m2 11c-8 10-14 4-6-3m11-2c10 8 4 14-3 6" fill="#10b981"/><rect x="55" y="68" width="10" height="14" rx="3" fill="#047857"/><ellipse cx="60" cy="83" rx="18" ry="4.5" fill="#065f46"/>`),
  "MAT-014": makeSvgImg("#ede9fe", "#7c3aed", "收纳垫 MAT-014", `<rect x="20" y="32" width="80" height="48" rx="8" fill="#5b21b6"/><rect x="25" y="37" width="70" height="38" rx="5" fill="none" stroke="#ddd6fe" stroke-dasharray="4 3" stroke-width="1.8"/><rect x="70" y="46" width="18" height="22" rx="4" fill="#a78bfa"/><circle cx="79" cy="53" r="3" fill="#fff"/>`),
  "COS-052": makeSvgImg("#fef3c7", "#d97706", "保湿霜 COS-052", `<rect x="37" y="42" width="46" height="38" rx="9" fill="#f59e0b"/><rect x="42" y="29" width="36" height="15" rx="5" fill="#92400e"/><rect x="44" y="51" width="32" height="18" rx="4" fill="#fffbeb"/><text x="60" y="63" text-anchor="middle" font-size="9" font-weight="700" fill="#b45309">50ml</text>`),
  "SKU-00515": makeSvgImg("#dbeafe", "#1d4ed8", "后备箱整理箱", `<rect x="22" y="36" width="76" height="44" rx="6" fill="#1e293b"/><line x1="47" y1="36" x2="47" y2="80" stroke="#60a5fa" stroke-width="2.5"/><line x1="73" y1="36" x2="73" y2="80" stroke="#60a5fa" stroke-width="2.5"/><rect x="20" y="31" width="80" height="8" rx="3" fill="#2563eb"/>`),
  "SKU-00538": makeSvgImg("#fef3c7", "#b45309", "折叠防水洗衣篮", `<path d="M32 34h56l-6 46H38z" fill="#fbbf24" stroke="#92400e" stroke-width="2"/><ellipse cx="60" cy="34" rx="28" ry="6" fill="#fde68a" stroke="#92400e" stroke-width="2"/><path d="M40 48h40M42 62h36" stroke="#92400e" stroke-width="2" stroke-dasharray="4 3"/>`),
  "SKU-00299": makeSvgImg("#dcfce7", "#047857", "防抓宠物座垫", `<path d="M26 32h68v48H26z" rx="8" fill="#065f46"/><rect x="33" y="38" width="54" height="36" rx="5" fill="#10b981"/><circle cx="52" cy="54" r="4" fill="#fff"/><circle cx="68" cy="54" r="4" fill="#fff"/><path d="M52 63q8 5 16 0" stroke="#fff" stroke-width="2.5" fill="none"/>`),
  "SKU-00612": makeSvgImg("#ede9fe", "#6d28d9", "磁吸桌面支架", `<circle cx="60" cy="40" r="15" fill="#4c1d95"/><circle cx="60" cy="40" r="9" fill="#c4b5fd"/><rect x="56" y="54" width="8" height="22" rx="3" fill="#4c1d95"/><ellipse cx="60" cy="79" rx="22" ry="5" fill="#6d28d9"/>`),
  "SKU-00704": makeSvgImg("#cffafe", "#0e7490", "真空迷你封口机", `<rect x="24" y="42" width="72" height="26" rx="10" fill="#0e7490"/><rect x="33" y="49" width="38" height="12" rx="4" fill="#a5f3fc"/><circle cx="83" cy="55" r="5" fill="#34d399"/>`),
  "SKU-00418": makeSvgImg("#fee2e2", "#b91c1c", "露营氛围灯串", `<path d="M24 38q18 22 36 0t36 0" fill="none" stroke="#64748b" stroke-width="2.5"/><circle cx="34" cy="48" r="6" fill="#f59e0b"/><circle cx="60" cy="44" r="6" fill="#ef4444"/><circle cx="86" cy="48" r="6" fill="#f59e0b"/>`),
};

export function getProductImg(sku) {
  return PRODUCT_IMAGES[sku] || makeSvgImg("#f1f5f9", "#475569", sku || "SKU", `<rect x="35" y="30" width="50" height="44" rx="8" fill="#64748b"/>`);
}

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

export const WAREHOUSE_LABELS = {
  "US-WH-2": "美国美西海外仓 (US-WH-2)",
  "US-WH-1": "美国美东海外仓 (US-WH-1)",
  "TH-WH-1": "泰国曼谷本地仓 (TH-WH-1)",
  "MOCK-US": "Amazon 测试沙盒仓 (MOCK-US)",
};

export function loadSavedAudits() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("crosspilot_audit_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    }
  } catch {}
  return [
    { time: "2026-11-19 10:15:02", actor: "manager", target: "林客服 (EMP-110)", action: "新增员工授权", detail: "授予角色「客服」，范围：Shopee 泰国主店（历史示例数据）", ok: true, historical: true },
    { time: "2026-11-19 10:04:19", actor: "selector", target: "M4-3 SKU-00515 测款拍板", action: "权限拦截 (403)", detail: "选品研究员不可自审拍板，需由主管/审批人终审（历史示例数据）", ok: false, historical: true },
    { time: "2026-11-19 09:51:40", actor: "approver", target: "赵仓管 (EMP-108)", action: "确认仓储权限", detail: "启用 M0-3 分店库存校准与 M6-4 收货凭证登记（历史示例数据）", ok: true, historical: true },
  ];
}

export function createInitialState() {
  // Deterministic 96-day history for BAG-108 (excluding today's unfinished day)
  const m5History96 = Array.from({ length: 96 }, (_, idx) => {
    const base = 62 + Math.round(14 * Math.sin(idx / 5)) + (idx % 7 === 5 || idx % 7 === 6 ? 18 : 0) + Math.floor(idx / 12);
    return Math.max(12, base);
  });

  return {
    role: "manager",
    pageId: "m4b",
    openModuleId: "m4",
    showAnno: false,
    stockSyncedAt: "2026-11-19 09:50:12 (历史示例)",
    stockSyncedTs: null,
    asyncTasks: {},

    // M0: Shops, Master Products, Orders, Store×Warehouse Independent Stock
    shops: [
      { id: "shop_th", name: "Shopee 泰国主店", platform: "SHOPEE", region: "TH", mode: "REAL", status: "Token有效 (演示态)", scopes: ["orders.read", "inventory.read", "cs.reply"], tokenMask: "shpk_live_****8e41", lastSync: "2026-11-19 10:15 (历史示例)", lastSyncTs: null },
      { id: "shop_us", name: "TikTok Shop 美区", platform: "TIKTOK", region: "US", mode: "REAL", status: "Token有效 (演示态)", scopes: ["orders.read", "fulfillment.read", "cs.reply"], tokenMask: "ttsp_live_****2c90", lastSync: "2026-11-19 10:12 (历史示例)", lastSyncTs: null },
      { id: "shop_mk", name: "Amazon 演示沙盒店", platform: "AMAZON", region: "US", mode: "MOCK", status: "仅限演示沙盒", scopes: ["mock.inbound"], tokenMask: "amzn_mock_****0000", lastSync: "2026-11-19 09:40 (历史示例)", lastSyncTs: null },
    ],
    m0bSearch: "",
    m0bTypeFilter: "ALL",
    m0bOrderShopFilter: "ALL",
    m0bOrderStatusFilter: "ALL",
    m0bOrderPage: 1,
    masterProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", cat: "箱包出行", cost: 6.8, ship: 2.4, priceNum: 34.5, price: "$34.50", shops: ["Shopee 泰国主店 (SH-BAG108)", "TikTok 美区 (TT-BAG108)", "Amazon 演示沙盒"], costVer: "v4", mode: "一货多店", costNote: "含防泼水尼龙布料升级" },
      { sku: "FAN-203", name: "便携静音循环扇", cat: "小家电", cost: 11.2, ship: 3.1, priceNum: 29.0, price: "$29.00", shops: ["Shopee 泰国主店 (SH-FAN203)"], costVer: "v2", mode: "泰国专卖", costNote: "无刷电机+泰标插头" },
      { sku: "MAT-014", name: "桌面皮质收纳垫", cat: "办公家居", cost: 4.5, ship: 1.8, priceNum: 18.9, price: "$18.90", shops: ["TikTok 美区 (TT-MAT014)", "Amazon 演示沙盒"], costVer: "v3", mode: "美区主推", costNote: "双面 PU 压纹" },
      { sku: "COS-052", name: "焕亮保湿面霜 50ml", cat: "美妆护肤", cost: 5.2, ship: 1.9, priceNum: 24.0, price: "$24.00", shops: ["TikTok 美区 (TT-COS052)"], costVer: "v1", mode: "美区专卖", costNote: "美区 FDA 备案批次" },
    ],
    costChangeLogs: [
      { time: "2026-11-18 16:20", sku: "BAG-108", ver: "v4", oldCost: "$6.50+$2.40", newCost: "$6.80+$2.40", effective: "2026-11-19", reason: "面料加厚升级", approver: "陈主管", historical: true },
    ],
    orders: [
      { id: "ORD-20261119-8821", shopId: "shop_th", shopName: "Shopee 泰国主店", mode: "REAL", status: "PAID", buyer: "Alex M***", sku: "BAG-108", qty: 2, currency: "THB", amount: 1490, amountUsd: 42.6, time: "2026-11-19 10:12:04", historical: true, note: "历史示例数据" },
      { id: "ORD-20261119-9044", shopId: "shop_us", shopName: "TikTok Shop 美区", mode: "REAL", status: "DELIVERED", buyer: "Emily R***", sku: "MAT-014", qty: 3, currency: "USD", amount: 56.7, amountUsd: 56.7, time: "2026-11-19 09:48:31", historical: true, note: "历史示例数据" },
      { id: "SYN9D-005671", shopId: "shop_mk", shopName: "Amazon 演示沙盒店", mode: "MOCK", status: "SHIPPED", buyer: "Mock Buyer", sku: "BAG-108", qty: 1, currency: "USD", amount: 34.5, amountUsd: 34.5, time: "2026-11-19 09:15:00", historical: true, note: "仅 M1 客服演示(不计实利)", csSessionId: "s1" },
      { id: "ORD-20261119-7712", shopId: "shop_th", shopName: "Shopee 泰国主店", mode: "REAL", status: "SHIPPED", buyer: "Somchai K***", sku: "FAN-203", qty: 1, currency: "THB", amount: 1015, amountUsd: 29.0, time: "2026-11-19 08:30:19", historical: true, note: "历史示例数据" },
      { id: "ORD-20261118-6601", shopId: "shop_us", shopName: "TikTok Shop 美区", mode: "REAL", status: "PAID", buyer: "Jason L***", sku: "COS-052", qty: 2, currency: "USD", amount: 48.0, amountUsd: 48.0, time: "2026-11-18 22:14:52", historical: true, note: "历史示例数据" },
    ],
    m0cShopFilter: "ALL",
    m0cSearch: "",
    inventoryItems: [
      { id: "inv1", sku: "BAG-108", name: "轻量通勤双肩包", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-BAG108", wh: "US-WH-2", whName: "美国美西海外仓 (US-WH-2)", avail: 18, locked: 4, safety: 25, updated: "09:50:12 (历史示例)", note: "一货多店·美区独立海外仓" },
      { id: "inv2", sku: "BAG-108", name: "轻量通勤双肩包", shopId: "shop_th", shopName: "Shopee 泰国主店", shopMode: "REAL", shopSku: "SH-BAG108", wh: "TH-WH-1", whName: "泰国曼谷本地仓 (TH-WH-1)", avail: 52, locked: 3, safety: 30, updated: "09:50:12 (历史示例)", note: "同款SKU在泰仓独立库存" },
      { id: "inv3", sku: "FAN-203", name: "便携静音循环扇", shopId: "shop_th", shopName: "Shopee 泰国主店", shopMode: "REAL", shopSku: "SH-FAN203", wh: "TH-WH-1", whName: "泰国曼谷本地仓 (TH-WH-1)", avail: 43, locked: 2, safety: 60, updated: "09:50:12 (历史示例)", note: "泰国站专卖商品" },
      { id: "inv4", sku: "MAT-014", name: "桌面皮质收纳垫", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-MAT014", wh: "US-WH-1", whName: "美国美东海外仓 (US-WH-1)", avail: 120, locked: 6, safety: 40, updated: "09:50:12 (历史示例)", note: "美区主推商品" },
      { id: "inv5", sku: "COS-052", name: "焕亮保湿面霜 50ml", shopId: "shop_us", shopName: "TikTok Shop 美区", shopMode: "REAL", shopSku: "TT-COS052", wh: "US-WH-1", whName: "美国美东海外仓 (US-WH-1)", avail: 6, locked: 1, safety: 35, updated: "09:50:12 (历史示例)", note: "美区专卖·极低库存" },
      { id: "inv6", sku: "BAG-108", name: "轻量通勤双肩包 (演示)", shopId: "shop_mk", shopName: "Amazon 演示沙盒店", shopMode: "MOCK", shopSku: "MK-BAG108", wh: "MOCK-US", whName: "Amazon 测试沙盒仓 (MOCK-US)", avail: 99, locked: 0, safety: 20, updated: "09:40:00 (历史示例)", note: "仅演示教学用，绝不计入实盘" },
    ],
    stocktakes: [
      { id: "PD-20261119-0001", sku: "FAN-203", whName: "泰国曼谷本地仓 (TH-WH-1)", oldQty: 45, newQty: 43, reason: "历史示例数据：循环盘点损耗2件", actor: "赵仓管", time: "2026-11-19 09:50:12", historical: true },
    ],

    // M1
    csActiveId: "s1",
    csShopFilter: "ALL",
    csSearch: "",
    csSessions: [
      {
        id: "s1", buyer: "Mock Buyer", platform: "AMAZON US", shopName: "Amazon 演示沙盒店", shopDomain: "amazon.com", lang: "EN", time: "14:32 (历史示例)",
        preview: "My item arrived damaged, I want a refund.", mode: "PENDING_HUMAN",
        takenBy: "", takenAt: "",
        intent: "REFUND", conf: "88%", risk: true, recs: "", orderId: "SYN9D-005671", bound: false, boundSnapshot: null,
        messages: [
          { role: "buyer", text: "Please check order SYN9D-005671 ($34.50).", zh: "请核查订单 SYN9D-005671（$34.50）。" },
          { role: "buyer", text: "My item arrived damaged, I want a refund.", zh: "我的商品送达时已损坏，我想申请退款。" },
        ]
      },
      {
        id: "s2", buyer: "Alex M***", platform: "SHOPEE TH", shopName: "Shopee 泰国主店", shopDomain: "shopee.co.th", lang: "EN", time: "14:28 (历史示例)",
        preview: "Looking for backpack under $35.", mode: "AI_AUTO",
        takenBy: "", takenAt: "",
        intent: "PRODUCT_INQUIRY", conf: "93%", risk: false,
        recs: "① BAG-108 轻量通勤双肩包 ($34.50) ② FAN-203 便携静音循环扇 ($29.00)",
        orderId: "ORD-20261119-8821", bound: false, boundSnapshot: null,
        messages: [
          { role: "buyer", text: "Hi, do you recommend a commuter backpack under $35?", zh: "你好，有推荐 35 美元以内的通勤双肩包吗？" },
        ]
      },
    ],
    csProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", shop: "Shopee TH", domain: "shopee.co.th", price: "$34.50", useCase: "15寸通勤防泼水", vec: "READY (演示向量)", on: true },
      { sku: "MAT-014", name: "桌面皮质收纳垫", shop: "TikTok US", domain: "shop.tiktok.com", price: "$18.90", useCase: "防水双面办公桌垫", vec: "READY (演示向量)", on: true },
      { sku: "FAN-203", name: "便携静音循环扇", shop: "Shopee TH", domain: "shopee.co.th", price: "$29.00", useCase: "桌面静音无线长续航", vec: "READY (演示向量)", on: true },
      { sku: "COS-052", name: "焕亮保湿面霜 50ml", shop: "TikTok US", domain: "shop.tiktok.com", price: "$24.00", useCase: "日常保湿修护", vec: "INDEXING (模拟队列)", on: true },
    ],
    csImportLogs: [
      { file: "cs_kb_shopee_th_v2.xlsx", shop: "Shopee TH", total: 24, okCount: 24, failCount: 0, status: "SUCCESS (演示模拟)", time: "2026-11-19 09:20:00", note: "历史示例数据" },
    ],
    ticketIdx: 0,
    tickets: [
      { id: "TK-20261119-01", order: "SYN9D-005671", orderAmount: 34.50, refundAmount: 34.50, type: "破损全退 $34.50", reason: "快递外箱压损，买家上传破损照", submitter: "cs", approver: "", approveNote: "", status: "待主管审批", ext: "—", voucher: "" },
      { id: "TK-20261118-09", order: "ORD-881204", orderAmount: 45.00, refundAmount: 0.00, type: "补发配件 $0.00", reason: "缺小零件补发", submitter: "林客服", approver: "陈主管", approveNote: "核实照片属实，同意补发", status: "已批准(凭证已回填)", ext: "人工凭证已登记", voucher: "VCH-20261118-88.png" },
    ],

    // M2: Draft vs Published Dual Versions
    biSelectedIdx: 0,
    biDraftVersion: "v1.3-draft",
    biPublishedVersion: "v1.2",
    biPublishedAt: "2026-11-19 10:15:00 (历史示例)",
    biPublishHistory: [
      { ver: "v1.2", time: "2026-11-19 10:15:00", by: "张运营", note: "历史示例数据：标准4指标总览", widgets: null },
    ],
    biWidgets: [
      { title: "近30日 GMV 销售额", val: "$125,429.99", metric: "gmv", scope: "全部平台 · 近30天", color: "var(--blue-hover)" },
      { title: "近30日 净利润", val: "$65,529.67", metric: "net_profit", scope: "全部平台 · 近30天", color: "var(--green-text)" },
      { title: "近30日 广告花费", val: "$18,650.16", metric: "ad_spend", scope: "全部平台 · 近30天", color: "var(--amber-text)" },
    ],
    biPublishedWidgets: [
      { title: "GMV 销售额", metric: "gmv", val: "$125,429.99", sub: "+14.2% 环比" },
      { title: "订单总数", metric: "orders_count", val: "1,536 单", sub: "+9.8% 环比" },
      { title: "广告花费 (ACOS 14.9%)", metric: "ad_spend", val: "$18,650.16", sub: "Amazon近7天 $2,933.63" },
      { title: "净利润 (净利率 52.2%)", metric: "net_profit", val: "$65,529.67", sub: "仅统计纯实盘订单" },
    ],
    biInsight: "近30天净利率 52.2% (65,529.67 ÷ 125,429.99)，ACOS 14.9%，Amazon 近7天广告花费 $2,933.63 处于安全区间。",

    // M3
    qaRestBaseUrl: "",
    qaBindings: [
      { code: "gmv", name: "GMV 销售额 (gmv)", kind: "SIMULATION", platform: "AMAZON", cron: "每5分钟", val: "360,000 USD", status: "SUCCESS (演示)", lastRun: "10:15:00", nextRun: "10:20:00", url: "" },
      { code: "shopify_sale", name: "虾皮销量 (shopify_sale)", kind: "SIMULATION", platform: "SHOPEE", cron: "手动", val: "1,000,000 USD", status: "SUCCESS (演示)", lastRun: "09:40:00", nextRun: "手动触发", url: "" },
      { code: "net_profit", name: "amazon-np (net_profit)", kind: "SIMULATION", platform: "AMAZON", cron: "每15分钟", val: "5,600 USD", status: "SUCCESS (演示)", lastRun: "10:00:00", nextRun: "10:15:00", url: "" },
      { code: "ad_spend", name: "亚马逊广告 (ad_spend)", kind: "REST API", platform: "AMAZON", cron: "每5分钟", val: "13,000 USD", status: "未连接后端 (模拟值)", lastRun: "10:15:00", nextRun: "10:20:00", url: "https://api.example.com/v1/{platform}/ads" },
    ],
    qaChat: [
      { role: "user", text: "各平台近30天净利润是多少？" },
      { role: "assistant", text: "全部平台近 30 天净利润为 65,529.67 USD（GMV 125,429.99 USD，净利率 52.2%）。", note: "口径：当前实时汇总值与实盘订单快照一致（多币种未配汇率则分币种列出）。", sql: "SELECT SUM(net_profit_usd), SUM(gmv_usd) FROM metric_snapshots WHERE days=30 [38ms]", feedback: null },
    ],

    // M4 Selection
    m4Tasks: [
      { file: "Amazon SP-API Mock · rate", kind: "演示Mock", scope: "AMAZON/US · 20 SKU · 8周", status: "成功 (160条 · 仅演示)", ok: true, tag: "DEMO_ONLY", time: "2026-11-19 09:10:00" },
      { file: "选品周数据_10000条模拟_nov.xlsx", kind: "外购数据", scope: "1250 SKU · US (10,000条)", status: "成功 (估算)", ok: true, tag: "ESTIMATE_ONLY", time: "2026-11-19 09:22:00" },
      { file: "weekly_internal_nov.csv", kind: "内部数据", scope: "6 SKU · US/TH (48条)", status: "成功 (纯内部实盘)", ok: true, tag: "READY_REVIEW", time: "2026-11-19 09:35:00" },
    ],
    m4Mode: "balanced",
    m4AiOpen: true,
    m4Tab: "ALL",
    m4Search: "",
    m4SrcFilter: "ALL",
    m4RegionFilter: "ALL",
    m4MinRev: 0,
    m4Page: 1,
    m4Pool: [
      { sku: "SKU-00515", name: "汽车后备箱整理箱", region: "AMAZON / US", paidQty: 1960, refundQty: 40, grossRev: 68500, discount: 670.46, refundAmt: 1000, trend: 27.5, prevAvg: 200, currAvg: 255, marginKnown: true, margin: 14.2, src: "内部数据", srcCode: "INTERNAL", stage: "AI初筛候选", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,200 (50件)", riskNote: "轻小件无侵权命中" },
      { sku: "SKU-00538", name: "可折叠防水洗衣篮", region: "AMAZON / US", paidQty: 1580, refundQty: 30, grossRev: 58200, discount: 540, refundAmt: 1138.06, trend: 31.2, prevAvg: 170, currAvg: 223, marginKnown: false, margin: null, src: "外购数据", srcCode: "PAID_EXTERNAL", stage: "缺成本/待补全", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "缺少采购成本与头程费", budget: "$950 (40件)", riskNote: "需核对 1688 拿货价与实盘利润" },
      { sku: "SKU-00299", name: "防抓宠物汽车座垫", region: "AMAZON / US", paidQty: 1490, refundQty: 25, grossRev: 54800, discount: 410.58, refundAmt: 1200, trend: 16.6, prevAvg: 180, currAvg: 210, marginKnown: true, margin: 16.8, src: "内部数据", srcCode: "INTERNAL", stage: "已提交待审", submitter: "吴选品", submitReason: "纯内部实单且利润率 16.8% ≥ 10%，无侵权风险", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,500 (60件)", riskNote: "内部实单已满足 10% 利润门槛" },
      { sku: "SKU-00612", name: "磁吸折叠桌面支架", region: "TIKTOK / US", paidQty: 1320, refundQty: 18, grossRev: 44200, discount: 300, refundAmt: 620, trend: 52.4, prevAvg: 130, currAvg: 198, marginKnown: true, margin: 18.5, src: "内部数据", srcCode: "INTERNAL", stage: "AI初筛候选", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,050 (45件)", riskNote: "高增高毛利，适合趋势优先推荐" },
      { sku: "SKU-00704", name: "无线真空迷你封口机", region: "SHOPEE / TH", paidQty: 980, refundQty: 22, grossRev: 26800, discount: 200, refundAmt: 450, trend: 19.8, prevAvg: 111, currAvg: 133, marginKnown: true, margin: 15.1, src: "内部数据", srcCode: "INTERNAL", stage: "已批准测款", submitter: "吴选品", submitReason: "东南亚热销轻小件，毛利15.1%", approver: "陈主管", decisionReason: "纯内部实单利润率达标，批准小批测款", evidence: "测款核价表_SKU704.pdf", missing: "", budget: "$880 (80件)", riskNote: "带电商品已确认空运渠道" },
      { sku: "SKU-00418", name: "便携露营氛围灯串", region: "AMAZON / US", paidQty: 610, refundQty: 45, grossRev: 14200, discount: 180, refundAmt: 920, trend: -8.4, prevAvg: 83, currAvg: 76, marginKnown: true, margin: 6.2, src: "外购数据", srcCode: "PAID_EXTERNAL", stage: "已淘汰", submitter: "吴选品", submitReason: "对比样本", approver: "陈主管", decisionReason: "利润率低于10%且趋势负增长，淘汰", evidence: "比价淘汰记录.xlsx", missing: "利润率<10%且负增长", budget: "—", riskNote: "负增长+低利润直接淘汰" },
    ],

    // M5: Forecasting (with real 96-day history & local deterministic forecast computation)
    m5Sku: "BAG-108",
    m5Horizon: 7,
    m5Model: "CatBoost · v1",
    m5History96,
    m5LastRunMeta: { model: "CatBoost · v1", horizon: 7, range: "2026-08-15 ~ 2026-11-18 (已排除11-19未完结日)", runtimeMs: 142, time: "2026-11-19 09:55 (历史示例)" },
    demandProfileVer: 1,
    demandProfileMode: "平稳季节 + 短周期波动",
    m5Models: [
      { name: "CatBoost · v1", family: "TREE", minPts: 90, ready: "本地规则模拟", enabled: true, desc: "按真实日销量滞后值与星期特征训练" },
      { name: "Croston / SBA · v1", family: "INTERMITTENT", minPts: 30, ready: "本地规则模拟", enabled: true, desc: "适合含大量零销量的间歇需求基线" },
      { name: "Holt-Winters · v1", family: "STATISTICAL", minPts: 56, ready: "本地规则模拟", enabled: true, desc: "短周期趋势与季节性指数平滑基线" },
      { name: "LightGBM · v1", family: "TREE", minPts: 90, ready: "本地规则模拟", enabled: true, desc: "树模型日频预测，未接入外生促销特征" },
      { name: "Prophet · v1", family: "STATISTICAL", minPts: 90, ready: "本地规则模拟", enabled: true, desc: "拟合趋势与周季节性曲线" },
      { name: "SARIMA · v1", family: "STATISTICAL", minPts: 90, ready: "本地规则模拟", enabled: true, desc: "稳定季节序列统计基线" },
      { name: "TFT / Transformer", family: "DEEP", minPts: 180, ready: "样本不足提示", enabled: true, desc: "建议≥180天真实订单，当前96天仅短样本参考" },
      { name: "TSB · v1", family: "INTERMITTENT", minPts: 30, ready: "本地规则模拟", enabled: true, desc: "需求概率变化的长尾间歇序列" },
      { name: "TSFM 零样本", family: "FOUNDATION", minPts: 8, ready: "本地规则模拟", enabled: true, desc: "Chronos-Bolt-Tiny 零样本推理需回测验证" },
    ],
    m5DailyPred: [76, 82, 74, 91, 88, 95, 84],
    m5Eval: [
      { date: "2026-11-15", pred: 74, actual: 78, origActual: 78, stockout: false, edited: false, editReason: "" },
      { date: "2026-11-16", pred: 80, actual: 76, origActual: 76, stockout: false, edited: false, editReason: "" },
      { date: "2026-11-17", pred: 72, actual: 82, origActual: 64, stockout: true, edited: true, editReason: "历史示例：缺货18件修正还原真实需求" },
      { date: "2026-11-18", pred: 89, actual: 86, origActual: 86, stockout: false, edited: false, editReason: "" },
    ],
    m5ForecastRegistry: { "BAG-108": true, "FAN-203": false, "MAT-014": false, "COS-052": false },

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

    m6SmartSku: "BAG-108",
    m6SmartRoute: "海运标准线 ($1.9/件 · 18天)",
    m6SmartAllocPct: 70,
    m6SmartLeadDays: 18,
    m6SmartSafetyDays: 5,
    m6SmartInTransit: 20,

    m6ApprovalTab: "NORMAL",
    m6Plans: [
      { id: "RP-N-20261119-01", mode: "NORMAL", sku: "FAN-203", shop: "Shopee 泰国主店 · 泰国曼谷本地仓", qty: 620, cash: "$6,944", sig: "sig:8a4f..OK", sigValid: true, snapshotDesc: "日均30×(18+4)-43=617(平衡620)", submitter: "张运营", approver: "", approveNote: "", poId: "", status: "待主管审批" },
      { id: "RP-S-20261119-02", mode: "SMART", sku: "BAG-108", shop: "TikTok Shop 美区 · 美国美西海外仓", qty: 1320, cash: "$8,976", sig: "sig:3e9b..OK", sigValid: true, snapshotDesc: "M5预测84/天×(18+5)×70%-18-20=1314", submitter: "张运营", approver: "", approveNote: "", poId: "", status: "待主管审批" },
    ],
    m6Orders: [
      { po: "PO-20261119-03", planId: "RP-N-20261118-08", sku: "FAN-203", totalQty: 620, status: "部分收货", createdAt: "2026-11-18 17:00:00", historical: true },
    ],
    m6Receipts: [
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第1批 (历史示例)", planQty: 620, gotQty: 400, diff: 0, diffReason: "正常到货", qc: "QC-20261119-01", voucher: "receipt_batch1.jpg", who: "赵仓管", time: "2026-11-19 08:30:00" },
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第2批 (历史示例)", planQty: 620, gotQty: 215, diff: -5, diffReason: "物流外箱受潮少装5件", qc: "QC-20261119-02", voucher: "receipt_batch2.jpg", who: "赵仓管", time: "2026-11-19 09:10:00" },
    ],

    // M7: Linked with M4-3 Approved SKUs + Legacy In-Store Refresh SKUs
    m7Sku: "SKU-00704",
    m7Platform: "Amazon US",
    m7Lang: "English (US)",
    m7CopyType: "商品标题",
    m7MustTerm: "Portable, Cordless, Vacuum Sealer",
    m7BanTerm: "Best, #1, Miracle, Free",
    m7CopyGenCount: 1,
    m7ResultTab: "商品标题",
    m7SelectedTitle: "SKU-00704 | Portable Cordless Vacuum Sealer for Kitchen Food Storage",
    m7SelectedBullets: "• [Bullet 1] Portable & Cordless design seals dry/moist bags in 8 seconds.",
    m7SelectedDesc: "Crafted for daily kitchen organization, SKU-00704 extends food freshness up to 5x.",
    m7SelectedKeywords: "portable vacuum sealer, cordless food saver, mini bag sealer (20个研究词)",

    m7ImgWorkflow: "Amazon 白底主图 · v3 (ComfyUI 未连接·演示占位)",
    m7ImgSeed: 101,
    m7PickedImgIdx: 0,
    m7Images: [
      { id: 0, code: "01 / 白底主图", title: "纯白棚拍主图 (85%占比)", editNote: "演示占位图 · 未连ComfyUI", done: true },
      { id: 1, code: "02 / 使用场景", title: "厨房保鲜场景展示", editNote: "演示占位图 · 未连ComfyUI", done: true },
      { id: 2, code: "03 / 功能卖点", title: "抽气封口二合一对比", editNote: "演示占位图 · 未连ComfyUI", done: true },
      { id: 3, code: "04 / 尺寸规格", title: "掌心便携尺寸标注", editNote: "演示占位图 · 未连ComfyUI", done: true },
      { id: 4, code: "05 / 包装清单", title: "主机+Type-C线+真空袋", editNote: "待补齐", done: false },
    ],
    m7VidType: "产品展示",
    m7VidWorkflow: "未配置 ComfyUI SVD 节点 (默认诚实报错)",
    m7VidDone: false,
    m7VidLogs: [],
    m7AplusDone: false,
    m7PreviewTab: "主图/附图",
    m7ComplianceStatus: "待校验",
    m7ComplianceChecks: [],
    m7ApprovalRecord: null,

    // M8
    m8RoleFilter: "ALL",
    employees: [
      { id: "EMP-101", name: "陈主管", email: "chen.approver@crosspilot.ai", role: "approver", shop: "全部实盘店铺 (Shopee TH + TikTok US)", active: true, lastLogin: "2026-11-19 10:12 (历史示例)" },
      { id: "EMP-102", name: "王总", email: "wang.mgr@crosspilot.ai", role: "manager", shop: "全部实盘店铺 (全局授权与大屏)", active: true, lastLogin: "2026-11-19 09:45 (历史示例)" },
      { id: "EMP-103", name: "张运营", email: "zhang.ops@crosspilot.ai", role: "planner", shop: "全部实盘店铺 (Shopee TH + TikTok US)", active: true, lastLogin: "2026-11-19 10:08 (历史示例)" },
      { id: "EMP-104", name: "李运营", email: "li.ops@crosspilot.ai", role: "planner", shop: "TikTok Shop 美区", active: true, lastLogin: "2026-11-18 18:20 (历史示例)" },
      { id: "EMP-105", name: "刘数据", email: "liu.bi@crosspilot.ai", role: "bi_analyst", shop: "全部数据源 (只读问数与口径维护)", active: true, lastLogin: "2026-11-19 09:30 (历史示例)" },
      { id: "EMP-106", name: "吴选品", email: "wu.sel@crosspilot.ai", role: "selector", shop: "Amazon US / 行业机会池", active: true, lastLogin: "2026-11-19 10:01 (历史示例)" },
      { id: "EMP-107", name: "孙文案", email: "sun.gc@crosspilot.ai", role: "creator", shop: "Amazon US / TikTok US 内容库", active: true, lastLogin: "2026-11-19 09:55 (历史示例)" },
      { id: "EMP-108", name: "赵仓管", email: "zhao.wh@crosspilot.ai", role: "warehouse", shop: "美西/美东/泰国仓", active: true, lastLogin: "2026-11-19 09:50 (历史示例)" },
      { id: "EMP-109", name: "钱物流", email: "qian.wh@crosspilot.ai", role: "warehouse", shop: "泰国曼谷本地仓", active: true, lastLogin: "2026-11-18 17:40 (历史示例)" },
      { id: "EMP-110", name: "林客服", email: "lin.cs@crosspilot.ai", role: "cs", shop: "Shopee 泰国主店 + Amazon 沙盒", active: true, lastLogin: "2026-11-19 10:16 (历史示例)" },
      { id: "EMP-111", name: "周客服", email: "zhou.cs@crosspilot.ai", role: "cs", shop: "TikTok Shop 美区", active: true, lastLogin: "2026-11-19 08:50 (历史示例)" },
      { id: "EMP-112", name: "演示买家01", email: "mock.buyer@crosspilot.ai", role: "mock_buyer", shop: "仅演示沙盒 (Mock)", active: true, lastLogin: "演示入口" },
    ],
    auditLogs: loadSavedAudits(),
  };
}

export function appendAuditLog(state, entry) {
  const rec = {
    time: nowDateTimeStr(),
    actor: state.role,
    target: entry.target || "系统操作",
    action: entry.action || "操作",
    detail: entry.detail || "",
    ok: entry.ok !== false,
    historical: false,
  };
  state.auditLogs.unshift(rec);
  if (state.auditLogs.length > 100) state.auditLogs.length = 100;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("crosspilot_audit_v2", JSON.stringify(state.auditLogs));
    }
  } catch {}
  return rec;
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
