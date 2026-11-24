export const BACKEND_SERVICE_URL = ""; // 预留后台服务地址；留空表示纯前端演示模式，外部连接服务均如实标注未接入

export const WAREHOUSE_LABELS = {
  "US-WH-2": "美国美西海外仓",
  "TH-WH-1": "泰国曼谷本地仓",
};

// 离线可展示的高清 SVG 商品矢量图（不依赖外部 CDN，永不断裂）
function makeSvgDataUri(bg, accent, label, iconSvg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#ffffff"/></linearGradient></defs>
    <rect width="240" height="240" rx="24" fill="url(#g)" stroke="#e2e8f0" stroke-width="2"/>
    <circle cx="120" cy="108" r="64" fill="${accent}" opacity="0.14"/>
    ${iconSvg}
    <text x="120" y="210" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="17" font-weight="700" fill="#1e293b" text-anchor="middle">${label}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const PRODUCT_IMAGES = {
  "BAG-108": makeSvgDataUri("#eff6ff", "#2563eb", "轻量通勤双肩包", `<rect x="82" y="64" width="76" height="92" rx="18" fill="#2563eb"/><path d="M98 64 C98 44 142 44 142 64" fill="none" stroke="#1d4ed8" stroke-width="7"/><rect x="94" y="102" width="52" height="36" rx="8" fill="#93c5fd"/><line x1="104" y1="114" x2="136" y2="114" stroke="#1e3a8a" stroke-width="4" stroke-linecap="round"/>`),
  "FAN-203": makeSvgDataUri("#ecfeff", "#0891b2", "便携静音循环扇", `<circle cx="120" cy="100" r="46" fill="#0891b2"/><circle cx="120" cy="100" r="36" fill="#cffafe"/><path d="M120 100 L120 68 A14 14 0 0 1 136 92 Z M120 100 L148 118 A14 14 0 0 1 116 126 Z M120 100 L92 112 A14 14 0 0 1 102 76 Z" fill="#0e7490"/><circle cx="120" cy="100" r="8" fill="#164e63"/><rect x="108" y="146" width="24" height="16" rx="4" fill="#0e7490"/><rect x="88" y="160" width="64" height="10" rx="5" fill="#155e75"/>`),
  "MAT-014": makeSvgDataUri("#f0fdf4", "#10b981", "加厚防滑瑜伽垫", `<rect x="64" y="88" width="112" height="44" rx="22" fill="#10b981"/><ellipse cx="78" cy="110" rx="12" ry="22" fill="#047857"/><ellipse cx="78" cy="110" rx="5" ry="11" fill="#a7f3d0"/><path d="M94 94 H158 M94 126 H158" stroke="#ecfdf5" stroke-width="3" stroke-linecap="round"/>`),
  "COS-052": makeSvgDataUri("#fdf2f8", "#db2777", "焕亮保湿面霜", `<rect x="82" y="84" width="76" height="66" rx="14" fill="#f472b6"/><rect x="76" y="66" width="88" height="22" rx="8" fill="#db2777"/><rect x="96" y="104" width="48" height="26" rx="6" fill="#fff1f2"/><circle cx="120" cy="117" r="7" fill="#db2777"/>`),
  "SKU-00515": makeSvgDataUri("#fff7ed", "#ea580c", "后备箱整理箱", `<rect x="68" y="76" width="104" height="72" rx="10" fill="#fb923c"/><rect x="64" y="66" width="112" height="16" rx="6" fill="#ea580c"/><line x1="103" y1="82" x2="103" y2="148" stroke="#ffedd5" stroke-width="4"/><line x1="137" y1="82" x2="137" y2="148" stroke="#ffedd5" stroke-width="4"/>`),
  "SKU-00538": makeSvgDataUri("#eef2ff", "#4f46e5", "防水折叠洗衣篮", `<path d="M78 72 H162 L152 152 H88 Z" fill="#6366f1"/><ellipse cx="120" cy="72" rx="42" ry="10" fill="#4338ca"/><ellipse cx="120" cy="72" rx="34" ry="6" fill="#c7d2fe"/><line x1="94" y1="102" x2="146" y2="102" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/><line x1="96" y1="124" x2="144" y2="124" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/>`),
  "SKU-00299": makeSvgDataUri("#fefce8", "#ca8a04", "宠物防抓汽车垫", `<path d="M70 68 H170 V142 L156 156 H84 L70 142 Z" fill="#eab308"/><rect x="84" y="84" width="72" height="44" rx="8" fill="#fef08a"/><circle cx="104" cy="106" r="6" fill="#a16207"/><circle cx="136" cy="106" r="6" fill="#a16207"/><circle cx="120" cy="118" r="8" fill="#a16207"/>`),
  "SKU-00612": makeSvgDataUri("#f5f3ff", "#7c3aed", "磁吸折叠支架", `<rect x="88" y="144" width="64" height="12" rx="6" fill="#6d28d9"/><line x1="120" y1="144" x2="106" y2="102" stroke="#7c3aed" stroke-width="10" stroke-linecap="round"/><rect x="86" y="64" width="68" height="46" rx="10" fill="#8b5cf6"/><circle cx="120" cy="87" r="14" fill="#ede9fe"/>`),
  "SKU-00704": makeSvgDataUri("#ecfdf5", "#059669", "迷你真空封口机", `<rect x="62" y="92" width="116" height="42" rx="20" fill="#10b981"/><rect x="76" y="106" width="68" height="12" rx="6" fill="#ecfdf5"/><circle cx="158" cy="113" r="8" fill="#047857"/>`),
  "SKU-00418": makeSvgDataUri("#fef2f2", "#dc2626", "露营氛围灯串", `<path d="M68 82 Q120 120 172 82" fill="none" stroke="#475569" stroke-width="4"/><circle cx="80" cy="92" r="11" fill="#fbbf24"/><circle cx="106" cy="104" r="11" fill="#f87171"/><circle cx="134" cy="104" r="11" fill="#fbbf24"/><circle cx="160" cy="92" r="11" fill="#f87171"/>`),
};

export function getProductImg(sku) {
  return PRODUCT_IMAGES[sku] || PRODUCT_IMAGES["BAG-108"];
}

export function nowTimeStr(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function nowDateTimeStr(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${nowTimeStr(d)}`;
}
export function genDocId(prefix) {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${ymd}-${rnd}`;
}
export function relTimeLabel(ts) {
  if (!ts) return "历史演示记录";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 10) return "刚刚更新";
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  return `${Math.floor(sec / 3600)} 小时前`;
}

// 九大业务岗位角色定义
export const BIZ_ROLES = [
  { key: "approver", label: "主管 / 审批人", tag: "终审把关", pill: "p-red", desc: "负责终审把关：售后退款审批、选品测款拍板、补货下单审批、上架合规放行。" },
  { key: "manager", label: "大屏浏览者 / 管理者", tag: "全局管理", pill: "p-purple", desc: "全局运营管理：员工岗位授权、店铺连接管理、查看正式经营大屏、经营问答查数。" },
  { key: "planner", label: "驾驶舱设计者 / 业务运营", tag: "日常运营", pill: "p-blue", desc: "日常运营操作：调整成本变更、维护客服商品库、设计驾驶舱、执行预测与提交补货。" },
  { key: "bi_analyst", label: "数据分析 / BI 人员", tag: "指标分析", pill: "p-blue", desc: "口径与分析：管理指标口径与定时更新、参与智能问数、复用驾驶舱指标。" },
  { key: "selector", label: "选品研究员", tag: "选品研究", pill: "p-green", desc: "选品初筛：导入候选商品、评分对比并提交测款申请（无权直接批准本人提交的测款）。" },
  { key: "creator", label: "内容创作 / 审核人员", tag: "内容制作", pill: "p-amber", desc: "图文视频交付：创作多语言文案、制作主图套图与短视频、提交上架前合规检查。" },
  { key: "warehouse", label: "采购 / 仓库 / 物流人员", tag: "仓配执行", pill: "p-green", desc: "库存与收货：人工盘点校准分店库存、登记分批到货质检与收货凭证。" },
  { key: "cs", label: "客服", tag: "一线客服", pill: "p-gray", desc: "接待与售后：接管买家会话、核验订单四要素、检查回复内容并建单转交主管审批。" },
  { key: "mock_buyer", label: "买家（模拟测试）", tag: "联调测试", pill: "p-gray", desc: "内部联调入口：发送模拟咨询或投诉消息，验证客服自动回复与拦截规则。" },
];

export const ROLE_PERSON_NAMES = {
  approver: "陈主管",
  manager: "王总监",
  planner: "张运营",
  bi_analyst: "周分析",
  selector: "吴选品",
  creator: "林设计",
  warehouse: "赵仓管",
  cs: "李客服",
  mock_buyer: "测试买家",
};

const AUDIT_STORAGE_KEY = "crosspilot_audit_v3";

const INITIAL_AUDIT_LOGS = [
  { time: "09:42:10", actor: "approver", sentence: "陈主管 于 09:42:10 审批通过了选品测款 SKU-00704（无线真空迷你封口机），已创建预测与内容创作任务", ok: true, historical: true },
  { time: "09:30:18", actor: "warehouse", sentence: "赵仓管 于 09:30:18 登记了采购单 PO-20261119-03 第 2 批收货凭证，实收 215 件（少装 5 件）", ok: true, historical: true },
  { time: "09:15:02", actor: "cs", sentence: "李客服 尝试自行批准本人提交的售后工单 TK-20261119-01，系统因职责分离规则拦截", ok: false, historical: true },
];

function loadAuditLogs() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    }
  } catch {}
  return [...INITIAL_AUDIT_LOGS];
}

export function appendAuditLog(state, entry) {
  const actorName = ROLE_PERSON_NAMES[state.role] || "当前操作人";
  const t = nowTimeStr();
  const sentence = entry.sentence || `${actorName} 于 ${t} ${entry.action || "执行了操作"}${entry.target ? `「${entry.target}」` : ""}${entry.detail ? `：${entry.detail}` : ""}`;
  const row = {
    time: t,
    actor: state.role,
    sentence,
    ok: entry.ok !== false,
    historical: false,
  };
  state.auditLogs.unshift(row);
  if (state.auditLogs.length > 80) state.auditLogs.length = 80;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state.auditLogs));
    }
  } catch {}
}

export function getRoleTodos(state) {
  const todos = {};
  if (state.role === "approver") {
    if (state.tickets.some(t => t.status === "待主管审批")) todos.m1c = true;
    if (state.m4Pool.some(x => x.stage === "已提交待审")) todos.m4c = true;
    if (state.m6Plans.some(p => p.status === "待主管审批")) todos.m6c = true;
    if (state.m7ComplianceStatus === "校验通过") todos.m7d = true;
    if (state.costChangeLogs.some(c => c.status === "待主管审批")) todos.m0b = true;
  } else if (state.role === "manager") {
    if (state.shops.some(s => s.health !== "连接正常" || s.mode === "MOCK")) todos.m0a = true;
    todos.m2b = true;
    todos.m8a = true;
  } else if (state.role === "planner") {
    todos.m2a = true;
    todos.m6a = true;
    if (state.inventoryItems.some(i => i.shopMode === "REAL" && i.avail < i.safety)) todos.m6b = true;
  } else if (state.role === "bi_analyst") {
    if (state.qaBindings.some(b => b.status.includes("未连接") || b.status.includes("未响应"))) todos.m3a = true;
    todos.m3b = true;
  } else if (state.role === "selector") {
    if (state.m4Pool.some(x => x.stage === "AI初筛候选" || x.stage === "缺成本/待补全")) todos.m4b = true;
  } else if (state.role === "creator") {
    if (!state.m7VidDone || !state.m7AplusDone) todos.m7d = true;
    if (state.m4Pool.some(x => x.stage === "已批准测款")) todos.m7a = true;
  } else if (state.role === "warehouse") {
    if (state.inventoryItems.some(i => i.shopMode === "REAL" && i.avail < i.safety)) todos.m0c = true;
    if (state.m6Orders.some(o => o.status !== "全部收齐")) todos.m6d = true;
  } else if (state.role === "cs") {
    if (state.csSessions.some(s => s.status === "待人工接管")) todos.m1a = true;
    if (state.tickets.some(t => t.status === "待上传退款凭证")) todos.m1c = true;
  } else if (state.role === "mock_buyer") {
    todos.m1d = true;
  }
  return todos;
}

export function runLocalForecastAlgo(history96, modelName, horizon) {
  const len = history96.length;
  const recent14 = history96.slice(-14);
  const avg14 = recent14.reduce((a, b) => a + b, 0) / recent14.length;
  const zeroRatio = history96.filter(v => v === 0).length / len;

  const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCnts = [0, 0, 0, 0, 0, 0, 0];
  history96.forEach((v, idx) => {
    const wd = idx % 7;
    weekdaySums[wd] += v;
    weekdayCnts[wd] += 1;
  });
  const weekdayAvg = weekdaySums.map((s, i) => s / (weekdayCnts[i] || 1));
  const overallAvg = history96.reduce((a, b) => a + b, 0) / len;

  const out = [];
  for (let d = 0; d < 7; d++) {
    const wdFactor = weekdayAvg[d] / (overallAvg || 1);
    let val = avg14;
    if (modelName.includes("CatBoost") || modelName.includes("LightGBM")) {
      val = avg14 * (0.75 + 0.25 * wdFactor);
    } else if (modelName.includes("Croston") || modelName.includes("TSB")) {
      val = avg14 * (1 - zeroRatio * 0.12);
    } else if (modelName.includes("Holt") || modelName.includes("SARIMA") || modelName.includes("Prophet")) {
      val = avg14 * (0.85 + 0.15 * wdFactor) + (d - 3) * 0.6;
    } else if (modelName.includes("TSFM")) {
      val = avg14 * 1.03 + Math.sin(d) * 3;
    } else {
      val = avg14 * wdFactor;
    }
    if (horizon === 14) val *= 1.02;
    if (horizon === 30) val *= 0.98;
    out.push(Math.max(1, Math.round(val)));
  }
  return out;
}

export function createInitialState() {
  const m5History96 = Array.from({ length: 96 }, (_, i) => {
    const base = 74 + Math.round(Math.sin(i / 4) * 11) + (i % 7 >= 5 ? 10 : -3);
    return i % 19 === 0 ? 0 : Math.max(25, base);
  });

  return {
    role: "approver",
    openModuleId: "M0",
    pageId: "m0a",
    showAnno: false,
    lastDataRefreshAt: "10:15:00 (历史示例基线)",
    lastDataRefreshTs: null,
    asyncTasks: {},

    // M0-1: 店铺授权连接状态
    shops: [
      { id: "shop_th", name: "Shopee 泰国主店", platform: "SHOPEE", region: "TH", mode: "REAL", health: "连接正常", status: "授权有效（演示模式）", permLabels: ["读取订单", "同步库存", "回复消息"], credMask: "尾号 8e41", lastSync: "2026-11-19 10:15", lastSyncTs: null, errNote: "" },
      { id: "shop_us", name: "TikTok Shop 美区", platform: "TIKTOK", region: "US", mode: "REAL", health: "连接正常", status: "授权有效（演示模式）", permLabels: ["读取订单", "履约发货", "回复消息"], credMask: "尾号 2c90", lastSync: "2026-11-19 10:12", lastSyncTs: null, errNote: "" },
      { id: "shop_mk", name: "Amazon 演示沙盒店", platform: "AMAZON", region: "US", mode: "MOCK", health: "仅演示环境", status: "演示测试专用（不计营收）", permLabels: ["模拟买家消息", "联调测试"], credMask: "尾号 0000", lastSync: "2026-11-19 09:40", lastSyncTs: null, errNote: "" },
    ],

    // M0-2: 主商品档案与成本变更审批台账
    masterSearch: "",
    masterShopFilter: "ALL",
    orderShopFilter: "ALL",
    orderStatusFilter: "ALL",
    orderDateFilter: "ALL",
    masterProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", cat: "箱包出行", cost: 4.5, freight: 2.3, status: "在售", mappings: [
        { shop: "TikTok Shop 美区", shopSku: "TT-US-88210", price: "$29.90" },
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-5521", price: "฿890" },
      ] },
      { sku: "FAN-203", name: "便携静音循环扇", cat: "居家小电", cost: 8.2, freight: 3.0, status: "在售", mappings: [
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-9034", price: "฿590" },
      ] },
      { sku: "MAT-014", name: "加厚防滑瑜伽垫", cat: "运动健身", cost: 6.0, freight: 3.5, status: "在售", mappings: [
        { shop: "TikTok Shop 美区", shopSku: "TT-US-31922", price: "$24.90" },
      ] },
      { sku: "COS-052", name: "焕亮保湿面霜", cat: "美妆护肤", cost: null, freight: null, status: "缺成本待补", mappings: [
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-1140", price: "฿420" },
      ] },
    ],
    costChangeLogs: [
      { id: "CC-20261118-01", sku: "BAG-108", oldCost: 4.2, oldFreight: 2.3, newCost: 4.5, newFreight: 2.3, effectiveDate: "2026-11-19", reason: "布料升级单件采购微调", applicant: "张运营", approver: "陈主管", status: "已生效", time: "2026-11-18 16:20" },
    ],
    orders: [
      { orderNo: "SYN9D-005671", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Emily Carter", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountUsd: 34.50, amountDisplay: "$34.50", status: "已签收", refundSyncStatus: "无退款", orderedAt: "2026-11-17 14:22", historical: true, timeline: [
        { step: "买家付款完成", time: "2026-11-17 14:22", done: true },
        { step: "美西仓出库发货 (承运商 UPS)", time: "2026-11-17 19:05", done: true },
        { step: "买家签收完成", time: "2026-11-19 08:40", done: true },
      ] },
      { orderNo: "SPTH-20261119-108", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Nattapong S.", sku: "FAN-203", productName: "便携静音循环扇", qty: 2, amountUsd: 33.80, amountDisplay: "฿1,180 ($33.80)", status: "已发货", refundSyncStatus: "无退款", orderedAt: "2026-11-18 20:10", historical: true, timeline: [
        { step: "买家付款完成", time: "2026-11-18 20:10", done: true },
        { step: "泰国曼谷仓已打包交运", time: "2026-11-19 09:15", done: true },
        { step: "等待买家签收", time: "预计 1-2 日送达", done: false },
      ] },
      { orderNo: "TTUS-20261119-302", shop: "TikTok Shop 美区", mode: "REAL", buyer: "David Miller", sku: "MAT-014", productName: "加厚防滑瑜伽垫", qty: 1, amountUsd: 24.90, amountDisplay: "$24.90", status: "已付款", refundSyncStatus: "无退款", orderedAt: "2026-11-19 09:50", historical: true, timeline: [
        { step: "买家付款完成", time: "2026-11-19 09:50", done: true },
        { step: "待仓库拣货打包", time: "处理中", done: false },
      ] },
      { orderNo: "AMZ-DEMO-9901", shop: "Amazon 演示沙盒店", mode: "MOCK", buyer: "Demo Tester", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountUsd: 29.90, amountDisplay: "$29.90 (仅演示)", status: "仅演示不计营收", refundSyncStatus: "仅演示", orderedAt: "2026-11-19 10:02", historical: true, timeline: [
        { step: "联调测试生成模拟订单", time: "2026-11-19 10:02", done: true },
      ] },
    ],

    // M0-3: 分店分仓独立库存与正式盘点单
    inventoryShopFilter: "ALL",
    inventoryItems: [
      { id: "inv1", sku: "BAG-108", name: "轻量通勤双肩包", shopSku: "TT-US-88210", shopName: "TikTok Shop 美区", shopMode: "REAL", whId: "US-WH-2", whName: "美国美西海外仓", avail: 18, safety: 45, note: "美西仓低库存预警" },
      { id: "inv2", sku: "BAG-108", name: "轻量通勤双肩包", shopSku: "SP-TH-5521", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 52, safety: 30, note: "曼谷仓独立库存" },
      { id: "inv3", sku: "FAN-203", name: "便携静音循环扇", shopSku: "SP-TH-9034", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 43, safety: 60, note: "泰国仓季节热销低于安全线" },
      { id: "inv4", sku: "MAT-014", name: "加厚防滑瑜伽垫", shopSku: "TT-US-31922", shopName: "TikTok Shop 美区", shopMode: "REAL", whId: "US-WH-2", whName: "美国美西海外仓", avail: 120, safety: 50, note: "库存充足" },
      { id: "inv5", sku: "COS-052", name: "焕亮保湿面霜", shopSku: "SP-TH-1140", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 28, safety: 25, note: "暂缺成本卡" },
    ],
    stocktakes: [
      { sheetId: "PD-20261119-01", whName: "泰国曼谷本地仓", sku: "FAN-203", before: 45, after: 43, delta: -2, m5Before: 488, m5After: 490, m6Before: 615, m6After: 617, reason: "历史示例：盘点发现2件外箱破损转残次", who: "赵仓管", time: "2026-11-19 08:20" }
    ],

    // M1: 客服会话、导购商品库、售后工单、联调模拟
    csActiveId: "cs1",
    csTakeoverMap: { cs1: { who: "李客服", at: "10:18:00" }, cs2: { who: "智能客服自动接待", at: "10:15:00" }, cs3: { who: "智能客服自动接待", at: "09:50:00" } },
    csSessions: [
      {
        id: "cs1", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Emily Carter",
        intent: "售后投诉 / 退货诉求", status: "待人工接管", conf: "88%",
        linkedOrder: "SYN9D-005671", linkVerified: false, linkChecks: { buyer: true, amount: true, product: true, time: true },
        msgs: [
          { who: "buyer", text: "Hello, my package arrived with a scratch. Can I get a refund of $34.50?", trans: "买家译文：您好，收到的包裹有划痕，可以退款 $34.50 吗？" },
          { who: "ai", text: "拦截提示：检测到「退款」诉求，智能助手不代客承诺赔付，已转人工接管。", trans: "可先核对订单并转入售后工单由主管审批" },
        ],
        draftZh: "非常抱歉给您带来不便，已收到您反馈的 $34.50 订单问题，我们正在提交主管加急审核处理。",
        draftEn: "We sincerely apologize for the inconvenience. We have received your request regarding the $34.50 order and escalated it for priority review."
      },
      {
        id: "cs2", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Nattapong S.",
        intent: "售前尺寸与防泼水咨询", status: "智能自动接待", conf: "94%",
        linkedOrder: "", linkVerified: false, linkChecks: { buyer: false, amount: false, product: false, time: false },
        msgs: [
          { who: "buyer", text: "Is BAG-108 waterproof for rainy commuting?", trans: "买家译文：BAG-108 这款双肩包雨天通勤防泼水吗？" },
          { who: "ai", text: "匹配本店导购库：轻量通勤双肩包采用防泼水牛津布，可装 15.6 寸电脑，售价 ฿890。", trans: "已附上本店商品直达链接" },
        ],
        draftZh: "您好，BAG-108 采用高密度防泼水面料，可容纳 15.6 寸笔记本电脑，本店售价 ฿890。",
        draftEn: "Hello! BAG-108 uses water-resistant fabric and fits a 15.6-inch laptop, priced at ฿890 in our store."
      },
      {
        id: "cs3", shop: "Amazon 演示沙盒店", mode: "MOCK", buyer: "Demo Buyer (测试)",
        intent: "联调测试咨询", status: "仅限联调演示", conf: "91%",
        linkedOrder: "AMZ-DEMO-9901", linkVerified: true, linkChecks: { buyer: true, amount: true, product: true, time: true },
        msgs: [
          { who: "buyer", text: "Hi, is this commuter backpack suitable for 15-inch laptops?", trans: "测试译文：这款通勤包适合放 15 寸电脑吗？" },
          { who: "ai", text: "测试回执：已命中导购库轻量通勤双肩包，本消息来自联调模拟入口，不计入实盘统计。", trans: "仅联调演示" },
        ],
        draftZh: "您好（测试模式），该双肩包适合 15.6 寸电脑。",
        draftEn: "Hello (Demo), this backpack fits laptops up to 15.6 inches."
      }
    ],
    csCatalog: [
      { sku: "BAG-108", name: "轻量通勤双肩包", shop: "TikTok Shop 美区", domain: "tiktok.com/shop/us-cp", price: "$29.90", status: "索引已就绪", points: "防泼水牛津布 / 15.6寸电脑仓 / 轻量化 580g" },
      { sku: "FAN-203", name: "便携静音循环扇", shop: "Shopee 泰国主店", domain: "shopee.co.th/cp-th", price: "฿590", status: "索引已就绪", points: "USB-C 续航12h / 32dB低噪 / 折叠桌面壁挂" },
      { sku: "MAT-014", name: "加厚防滑瑜伽垫", shop: "TikTok Shop 美区", domain: "tiktok.com/shop/us-cp", price: "$24.90", status: "索引已就绪", points: "10mm加厚TPE / 双面防滑纹路 / 附收纳绑带" },
    ],
    csImportLogs: [
      { file: "本店在售导购词典_11月.xlsx", shop: "TikTok Shop 美区", total: 40, okCount: 40, failCount: 0, failReason: "—", status: "已完成 (40/40)", time: "2026-11-19 09:00" }
    ],
    tickets: [
      { id: "TK-20261119-01", orderNo: "SYN9D-005671", shop: "TikTok Shop 美区", buyer: "Emily Carter", reason: "收到包裹划痕申请退款", orderAmount: 34.50, refundAmount: 34.50, submitter: "李客服", approver: "", approveNote: "", status: "待主管审批", refundSyncStatus: "未打款（待审批）", voucher: "" },
      { id: "TK-20261119-02", orderNo: "SPTH-20261119-108", shop: "Shopee 泰国主店", buyer: "Nattapong S.", reason: "风扇外盒轻微挤压部分补偿", orderAmount: 33.80, refundAmount: 8.00, submitter: "李客服", approver: "陈主管", approveNote: "同意补偿 $8.00 安抚券", status: "待上传退款凭证", refundSyncStatus: "已批待手工打款", voucher: "" },
    ],

    // M2: 驾驶舱草稿版 vs 正式版
    biSelectedIdx: 0,
    biDraftVersion: "草稿 v1.3",
    biPublishedVersion: "正式 v1.2",
    biPublishedAt: "2026-11-19 10:15:00 (历史示例基线)",
    biWidgets: [
      { title: "近30日总销售额", val: "$125,429.99", metricKey: "gmv", scope: "全部实盘店铺 · 近30天", updatedAt: "实时联动订单", color: "var(--blue-hover)" },
      { title: "近30日净利润", val: "$65,529.67", metricKey: "net_profit", scope: "全部实盘店铺 · 近30天", updatedAt: "实时联动订单", color: "var(--green-text)" },
      { title: "近30日广告花费", val: "$18,650.16", metricKey: "ad_spend", scope: "全部实盘店铺 · 近30天", updatedAt: "10:15:00 同步", color: "var(--amber-text)" },
    ],
    biPublishedWidgets: [
      { title: "近30日总销售额", metricKey: "gmv", val: "$125,429.99", sub: "环比 +14.2%", scope: "全部实盘店铺" },
      { title: "实盘订单总数", metricKey: "orders_count", val: "1,536 单", sub: "环比 +9.8%", scope: "全部实盘店铺" },
      { title: "广告花费 (广告占比 14.9%)", metricKey: "ad_spend", val: "$18,650.16", sub: "亚马逊近7天 $2,933.63", scope: "广告账户汇总" },
      { title: "净利润 (净利率 52.2%)", metricKey: "net_profit", val: "$65,529.67", sub: "仅统计实盘订单", scope: "全部实盘店铺" },
    ],
    biPublishHistory: [
      { ver: "正式 v1.2", time: "2026-11-19 10:15:00", by: "张运营", note: "历史示例基准：4 项核心经营指标", widgets: [
        { title: "近30日总销售额", metricKey: "gmv", val: "$125,429.99", sub: "环比 +14.2%", scope: "全部实盘店铺" },
        { title: "实盘订单总数", metricKey: "orders_count", val: "1,536 单", sub: "环比 +9.8%", scope: "全部实盘店铺" },
        { title: "广告花费 (广告占比 14.9%)", metricKey: "ad_spend", val: "$18,650.16", sub: "亚马逊近7天 $2,933.63", scope: "广告账户汇总" },
        { title: "净利润 (净利率 52.2%)", metricKey: "net_profit", val: "$65,529.67", sub: "仅统计实盘订单", scope: "全部实盘店铺" },
      ] },
    ],
    biInsight: "近30天净利率 52.2%，广告花费占比 14.9%，整体处于健康盈利区间。",

    // M3: 经营指标定时更新 & 智能问数
    qaRestBaseUrl: "",
    qaBindings: [
      { metricKey: "gmv", name: "近30日总销售额", formula: "已付款实盘订单实付金额合计 (USD)", kind: "内部汇总", platform: "全部实盘店", cron: "每 5 分钟", val: "360,000 USD", status: "更新正常", lastRun: "10:15:00", nextRun: "10:20:00", errMsg: "", url: "" },
      { metricKey: "shopee_sale", name: "虾皮泰国店销售额", formula: "Shopee TH 已付款订单合计 (USD折算)", kind: "内部汇总", platform: "Shopee TH", cron: "手动更新", val: "1,000,000 USD", status: "更新正常", lastRun: "09:40:00", nextRun: "手动触发", errMsg: "", url: "" },
      { metricKey: "net_profit", name: "店铺经营净利润", formula: "销售净收入 − 商品成本 − 头程与费用", kind: "内部汇总", platform: "全部实盘店", cron: "每 15 分钟", val: "5,600 USD", status: "更新正常", lastRun: "10:00:00", nextRun: "10:15:00", errMsg: "", url: "" },
      { metricKey: "ad_spend", name: "广告投放花费", formula: "外部广告后台近30日扣费汇总", kind: "外部接口取数", platform: "Amazon US", cron: "每 5 分钟", val: "13,000 USD", status: "数据源未响应", lastRun: "10:15:00", nextRun: "待重连", errMsg: "未配置外部广告数据源地址（可点击立即更新重试）", url: "https://广告系统示例地址/ads" },
    ],
    qaChat: [
      { role: "user", text: "各平台近30天净利润是多少？" },
      { role: "assistant", text: "全部实盘店铺近 30 天净利润为 65,529.67 USD（总销售额 125,429.99 USD，净利率 52.2%）。", note: "统计口径：查询条件为 全部实盘店铺 · 近30天 · 已付款订单（不含演示店铺；多币种未统一汇率时分开列示）。", queryDesc: "查询范围：全部实盘店铺 ｜ 时间：近 30 天 ｜ 状态：已付款实盘订单 ｜ 模式：只读查数", feedback: null },
    ],

    // M4: 选品多源导入、初筛、拍板
    m4Tasks: [
      { file: "电商热销测试样本.xlsx", kind: "仅演示数据", scope: "20 款商品 · 8周", status: "已完成 (160条 · 仅演示)", ok: true, tag: "DEMO_ONLY", time: "2026-11-19 09:10:00" },
      { file: "行业大盘周报_10000条_nov.xlsx", kind: "外购行业估算", scope: "1,250 款商品 · 美区", status: "已完成 (估算辅助)", ok: true, tag: "ESTIMATE_ONLY", time: "2026-11-19 09:22:00" },
      { file: "内部实盘选品周报_nov.csv", kind: "内部实盘选品", scope: "6 款商品 · 美区/泰国", status: "已完成 (可送审)", ok: true, tag: "READY_REVIEW", time: "2026-11-19 09:35:00" },
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
      { sku: "SKU-00515", name: "汽车后备箱整理箱", region: "美区渠道", paidQty: 1960, refundQty: 40, grossRev: 68500, discount: 670.46, refundAmt: 1000, trend: 27.5, prevAvg: 200, currAvg: 255, marginKnown: true, margin: 14.2, src: "内部实盘选品", srcCode: "INTERNAL", stage: "初筛候选", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,200 (50件)", riskNote: "轻小件，无外观专利冲突" },
      { sku: "SKU-00538", name: "可折叠防水洗衣篮", region: "美区渠道", paidQty: 1580, refundQty: 30, grossRev: 58200, discount: 540, refundAmt: 1138.06, trend: 31.2, prevAvg: 170, currAvg: 223, marginKnown: false, margin: null, src: "外购行业估算", srcCode: "PAID_EXTERNAL", stage: "缺成本待补全", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "缺少采购价与头程运费", budget: "$950 (40件)", riskNote: "需向供应商核价并核对实盘利润" },
      { sku: "SKU-00299", name: "防抓宠物汽车座垫", region: "美区渠道", paidQty: 1490, refundQty: 25, grossRev: 54800, discount: 410.58, refundAmt: 1200, trend: 16.6, prevAvg: 180, currAvg: 210, marginKnown: true, margin: 16.8, src: "内部实盘选品", srcCode: "INTERNAL", stage: "已提交待审", submitter: "吴选品", submitReason: "内部实单利润率 16.8%（达到 10% 门槛），无侵权风险", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,500 (60件)", riskNote: "内部实单已满足 10% 利润门槛" },
      { sku: "SKU-00612", name: "磁吸折叠桌面支架", region: "TikTok 美区", paidQty: 1320, refundQty: 18, grossRev: 44200, discount: 300, refundAmt: 620, trend: 52.4, prevAvg: 130, currAvg: 198, marginKnown: true, margin: 18.5, src: "内部实盘选品", srcCode: "INTERNAL", stage: "初筛候选", submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,050 (45件)", riskNote: "高增长高毛利，适合趋势优先推荐" },
      { sku: "SKU-00704", name: "无线真空迷你封口机", region: "Shopee 泰国", paidQty: 980, refundQty: 22, grossRev: 26800, discount: 200, refundAmt: 450, trend: 19.8, prevAvg: 111, currAvg: 133, marginKnown: true, margin: 15.1, src: "内部实盘选品", srcCode: "INTERNAL", stage: "已批准测款", submitter: "吴选品", submitReason: "东南亚热销轻小件，利润率 15.1%", approver: "陈主管", decisionReason: "实盘利润率达标，同意首批 80 件测款", evidence: "测款核价单_SKU704.pdf", missing: "", budget: "$880 (80件)", riskNote: "带电商品已确认空运专线" },
      { sku: "SKU-00418", name: "便携露营氛围灯串", region: "美区渠道", paidQty: 610, refundQty: 45, grossRev: 14200, discount: 180, refundAmt: 920, trend: -8.4, prevAvg: 83, currAvg: 76, marginKnown: true, margin: 6.2, src: "外购行业估算", srcCode: "PAID_EXTERNAL", stage: "已淘汰", submitter: "吴选品", submitReason: "对比样本", approver: "陈主管", decisionReason: "利润率低于 10% 且销量下滑，决定淘汰", evidence: "比价淘汰记录.xlsx", missing: "利润率低于10%且趋势下滑", budget: "—", riskNote: "下滑且低利润，直接淘汰" },
    ],

    // M5: 销量预测方案、实时曲线与误差复盘
    m5Sku: "BAG-108",
    m5Horizon: 7,
    m5Model: "CatBoost · v1",
    m5History96,
    m5LastRunMeta: { model: "CatBoost · v1", horizon: 7, range: "2026-08-15 至 2026-11-18（已自动排除今日未完结订单）", runtimeMs: 142, time: "2026-11-19 09:55 (历史示例)" },
    demandProfileVer: 1,
    demandProfileMode: "平稳季节 + 短周期波动",
    m5ProfileLogs: [
      { ver: "v1", who: "张运营", time: "2026-11-18 14:10", change: "初始化画像：平稳季节 + 短周期波动", reason: "结合近96天日常出单节奏设定基线" }
    ],
    m5Models: [
      { name: "CatBoost · v1", bizName: "畅销品星期规律方案", familyLabel: "规律学习型", minPts: 90, bestFor: "工作日/周末销量差异大的稳定爆款", enabled: true, desc: "根据历史每天销量与星期几规律推算未来走势" },
      { name: "Croston / SBA · v1", bizName: "长尾零星出单方案", familyLabel: "低频/偶发型", minPts: 30, bestFor: "经常几天零单、偶尔出几件的长尾款", enabled: true, desc: "专治经常零销量的冷门品，避免预测结果虚高" },
      { name: "Holt-Winters · v1", bizName: "短周期平滑跟涨方案", familyLabel: "趋势平滑型", minPts: 56, bestFor: "近期在缓慢起量或下降的常规品", enabled: true, desc: "平滑过滤偶然单日波动，抓住近期涨跌趋势" },
      { name: "LightGBM · v1", bizName: "多特征日频树方案", familyLabel: "规律学习型", minPts: 90, bestFor: "每天稳定出单、受星期影响大的主力款", enabled: true, desc: "按历史日销量规律推算（暂未接入大促折扣价）" },
      { name: "Prophet · v1", bizName: "换季与季节趋势方案", familyLabel: "趋势平滑型", minPts: 90, bestFor: "受季节/换季波峰波谷影响明显的品", enabled: true, desc: "自动拟合长期趋势与每周固定周期波动" },
      { name: "SARIMA · v1", bizName: "稳定老品基线方案", familyLabel: "趋势平滑型", minPts: 90, bestFor: "卖了很久、销量起伏比较规律的老品", enabled: true, desc: "经典季节序列参考基线，不易受单日异常干扰" },
      { name: "TFT / Transformer", bizName: "长周期深度学习方案", familyLabel: "深度神经网络", minPts: 180, bestFor: "上市半年以上的核心大单品", enabled: true, desc: "需≥180天订单才够稳定，当前96天仅作参考不可硬算" },
      { name: "TSB · v1", bizName: "滞销衰减预警方案", familyLabel: "低频/偶发型", minPts: 30, bestFor: "出单越来越少、可能有滞销风险的长尾品", enabled: true, desc: "出单频率变低时会自动调低未来预期，防囤货积压" },
      { name: "TSFM 零样本", bizName: "新品快速估算方案", familyLabel: "通用预训练", minPts: 8, bestFor: "刚上架 1~2 周、历史数据很少的新品", enabled: true, desc: "只需8天即可快速估算未来销量（需回测验证）" },
    ],
    m5DailyPred: [76, 82, 74, 91, 88, 95, 84],
    m5Eval: [
      { date: "2026-11-15", pred: 74, actual: 78, origActual: 78, stockout: false, edited: false, editReason: "" },
      { date: "2026-11-16", pred: 80, actual: 76, origActual: 76, stockout: false, edited: false, editReason: "" },
      { date: "2026-11-17", pred: 72, actual: 82, origActual: 64, stockout: true, edited: true, editReason: "历史示例：当天仓库断货少卖18件，修正还原真实需求" },
      { date: "2026-11-18", pred: 89, actual: 86, origActual: 86, stockout: false, edited: false, editReason: "" },
    ],
    m5ForecastRegistry: { "BAG-108": true, "FAN-203": false, "MAT-014": false, "COS-052": false },

    // M6: 常规补货 vs 智能补货、审批与分批收货
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
    m6SmartRoute: "海运标准专线 ($1.9/件 · 18天 · 太平洋物流)",
    m6SmartAllocPct: 70,
    m6SmartLeadDays: 18,
    m6SmartSafetyDays: 5,
    m6SmartInTransit: 20,
    m6Routes: [
      { name: "海运标准专线 ($1.9/件 · 18天 · 太平洋物流)", carrier: "太平洋海运", unitPrice: 1.9, days: 18, note: "整柜拼箱标准报价，适合补足常规周期水位" },
      { name: "空运快线 ($5.6/件 · 5天 · 极兔国际空派)", carrier: "极兔国际空派", unitPrice: 5.6, days: 5, note: "加急补货通道，运费较高但5天直达美西仓" },
      { name: "海空联运 ($3.2/件 · 11天 · 中远集运)", carrier: "中远集运", unitPrice: 3.2, days: 11, note: "兼顾时效与成本的均衡方案" },
    ],

    m6ApprovalTab: "NORMAL",
    m6Plans: [
      { id: "RP-N-20261119-01", mode: "NORMAL", sku: "FAN-203", shop: "Shopee 泰国主店 · 泰国曼谷本地仓", qty: 620, cash: "$6,944", sigValid: true, sigNote: "提交时测算单价与当前成本卡一致 ✓", snapshotDesc: "日均30×(18+4)-43=617(平衡方案620件)", submitter: "张运营", approver: "", approveNote: "", poId: "", status: "待主管审批" },
      { id: "RP-S-20261119-02", mode: "SMART", sku: "BAG-108", shop: "TikTok Shop 美区 · 美国美西海外仓", qty: 1320, cash: "$8,976", sigValid: true, sigNote: "提交时预测参数与当前库存快照一致 ✓", snapshotDesc: "M5预测84/天×(18+5)×70%-18-20=1314", submitter: "张运营", approver: "", approveNote: "", poId: "", status: "待主管审批" },
    ],
    m6Orders: [
      { po: "PO-20261119-03", planId: "RP-N-20261118-08", sku: "FAN-203", totalQty: 620, status: "部分收货", createdAt: "2026-11-18 17:00:00", historical: true },
    ],
    m6Receipts: [
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第1批 (历史示例)", planQty: 620, gotQty: 400, diff: 0, diffReason: "正常到货验收合格", qc: "QC-20261119-01", voucher: "第1批签收单照片.jpg", who: "赵仓管", time: "2026-11-19 08:30:00" },
      { po: "PO-20261119-03", sku: "FAN-203", batch: "第2批 (历史示例)", planQty: 620, gotQty: 215, diff: -5, diffReason: "外箱受潮短装 5 件", qc: "QC-20261119-02", voucher: "第2批签收异常单.jpg", who: "赵仓管", time: "2026-11-19 09:10:00" },
    ],

    // M7: 多语言文案、1大4小套图、短视频与上架合规打包
    m7Sku: "SKU-00704",
    m7Platform: "亚马逊美国站",
    m7Lang: "English (US)",
    m7MustTerm: "Portable, Cordless, Vacuum Sealer",
    m7BanTerm: "Best, #1, Miracle, Free",
    m7CopyGenCount: 1,
    m7ResultTab: "商品标题",
    m7SelectedTitle: "SKU-00704 | Portable Cordless Vacuum Sealer for Kitchen Food Storage",
    m7SelectedBullets: "• [核心卖点] Portable & Cordless design seals dry/moist bags in 8 seconds.",
    m7SelectedDesc: "Crafted for daily kitchen organization, SKU-00704 extends food freshness up to 5x.",
    m7SelectedKeywords: "portable vacuum sealer, cordless food saver, mini bag sealer (20个搜索词)",

    m7ImgWorkflow: "标准白底主图模板 (未接入外部绘图服务 · 演示图)",
    m7ImgVersion: 1,
    m7PickedImgIdx: 0,
    m7Images: [
      { id: 0, label: "商品主图 1（白底主图）", title: "纯白棚拍主图 (主体占85%)", editNote: "演示图，非真实生成", done: true },
      { id: 1, label: "商品附图 2（使用场景）", title: "厨房保鲜场景展示", editNote: "演示图，非真实生成", done: true },
      { id: 2, label: "商品附图 3（功能卖点）", title: "抽气封口二合一对比", editNote: "演示图，非真实生成", done: true },
      { id: 3, label: "商品附图 4（尺寸规格）", title: "掌心便携尺寸标注", editNote: "演示图，非真实生成", done: true },
      { id: 4, label: "商品附图 5（包装清单）", title: "主机与附件清单说明", editNote: "待补齐（点击生成或局部修改）", done: false },
    ],
    m7AplusDone: false,
    m7VidType: "产品展示",
    m7VidWorkflow: "未配置视频生成节点（默认如实报错）",
    m7VidDone: false,
    m7VidLogs: [],
    m7PreviewTab: "主图/附图",
    m7ComplianceStatus: "待检查",
    m7ComplianceChecks: [],
    m7ApprovalRecord: null,

    // M8: 员工名册、只读权限矩阵与可读审计台账
    m8RoleFilter: "ALL",
    employees: [
      { id: "EMP-101", name: "陈主管", email: "chen.sup@crosspilot.ai", role: "approver", shop: "全部实盘店铺", active: true, lastLogin: "2026-11-19 10:14" },
      { id: "EMP-102", name: "王总监", email: "wang.dir@crosspilot.ai", role: "manager", shop: "全部实盘店铺", active: true, lastLogin: "2026-11-19 09:50" },
      { id: "EMP-103", name: "张运营", email: "zhang.ops@crosspilot.ai", role: "planner", shop: "Shopee 泰国主店 + TikTok 美区", active: true, lastLogin: "2026-11-19 10:08" },
      { id: "EMP-104", name: "周分析", email: "zhou.bi@crosspilot.ai", role: "bi_analyst", shop: "全部实盘店铺 (只读统计)", active: true, lastLogin: "2026-11-19 09:32" },
      { id: "EMP-105", name: "吴选品", email: "wu.sel@crosspilot.ai", role: "selector", shop: "选品研究池", active: true, lastLogin: "2026-11-19 09:15" },
      { id: "EMP-106", name: "林设计", email: "lin.art@crosspilot.ai", role: "creator", shop: "商品内容创作队列", active: true, lastLogin: "2026-11-19 08:55" },
      { id: "EMP-107", name: "赵仓管", email: "zhao.wh@crosspilot.ai", role: "warehouse", shop: "泰国曼谷本地仓 + 美国美西海外仓", active: true, lastLogin: "2026-11-19 09:42" },
      { id: "EMP-108", name: "李客服", email: "li.cs@crosspilot.ai", role: "cs", shop: "TikTok Shop 美区", active: true, lastLogin: "2026-11-19 10:18" },
      { id: "EMP-109", name: "孙客服", email: "sun.cs@crosspilot.ai", role: "cs", shop: "Shopee 泰国主店", active: true, lastLogin: "2026-11-19 09:11" },
      { id: "EMP-110", name: "刘测试", email: "liu.test@crosspilot.ai", role: "mock_buyer", shop: "仅演示沙盒", active: true, lastLogin: "2026-11-19 08:30" },
    ],
    auditLogs: loadAuditLogs(),
  };
}
