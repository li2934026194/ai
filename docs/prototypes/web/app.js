import { MODULE_DEFS, PAGE_META } from "./annotations.js";
import { renderM0_M3 } from "./pages_m0_m3.js";
import { renderM4_M7 } from "./pages_m4_m7.js";

const ROLE_HINTS = {
  planner: "可处理客服、M4初筛入清单、M6提交补货；不可拍板终审/批准",
  approver: "可终审 M1售后、M4测款拍板、M6补货批准（受 SoD 约束）",
  warehouse: "可同步 M0 独立库存、登记 M6 采购/质检/分批收货凭证",
  viewer: "只读观察员：可看 M2 大屏、M3 问数、M5 预测，禁止写入",
  auditor: "合规审计员：只读审计全链路日志与权限记录",
  admin: "系统管理员：全功能与模型注册启停调试权限",
};

const state = {
  role: "planner",
  pageId: "m7a",
  showAnno: true,
  stockSyncedAt: "09:50:12",

  // M1
  csActiveId: "s1",
  csShopFilter: "ALL",
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
      recs: "① MAT-014 桌面收纳垫 (92%) ② BAG-108 (76%) ③ 便携包 (64%)",
      orderId: "ORD-20261119-8821", bound: false,
      messages: [
        { role: "buyer", text: "Hi, do you recommend a waterproof desk mat?", zh: "你好，有推荐的防水桌面垫吗？" },
      ]
    },
  ],
  csProducts: [
    { sku: "BAG-108", name: "轻量通勤双肩包", shop: "Shopee TH", price: "$34.50", vec: "已向量化", on: true },
    { sku: "MAT-014", name: "桌面皮质收纳垫", shop: "Shopee TH", price: "$18.90", vec: "已向量化", on: true },
    { sku: "FAN-203", name: "便携静音循环扇", shop: "TikTok US", price: "$29.00", vec: "已向量化", on: true },
    { sku: "COS-052", name: "焕亮保湿面霜 50ml", shop: "TikTok US", price: "$24.00", vec: "待更新", on: true },
  ],
  ticketIdx: 0,
  tickets: [
    { id: "TK-20261119-01", order: "SYN9D-005671", type: "破损全退 $34.50", submitter: "planner", status: "待主管审批", ext: "—" },
    { id: "TK-20261118-09", order: "ORD-881204", type: "补发配件 $0.00", submitter: "staff_lin", status: "已批准", ext: "UNKNOWN" },
  ],

  // M2
  biSelectedIdx: 0,
  biWidgets: [
    { title: "近30日 GMV 销售额", val: "$125,429.99", metric: "gmv", scope: "全部平台 · 近30天", color: "var(--blue-hover)" },
    { title: "近30日 净利润", val: "$65,529.67", metric: "net_profit", scope: "全部平台 · 近30天", color: "var(--green-text)" },
  ],
  biInsight: "近30天净利润率达 52.2%，Amazon 近7天广告花费 $2,933.63 处于安全区间。",

  // M3
  qaBindings: [
    { name: "GMV 销售额 (gmv)", kind: "SIMULATION", platform: "AMAZON", cron: "每5分钟", val: "360,000 USD", status: "SUCCESS" },
    { name: "虾皮销量 (shopify_sale)", kind: "SIMULATION", platform: "SHOPEE", cron: "手动", val: "1,000,000 USD", status: "SUCCESS" },
    { name: "amazon-np (net_profit)", kind: "SIMULATION", platform: "AMAZON", cron: "每15分钟", val: "5,600 USD", status: "SUCCESS" },
    { name: "亚马逊广告 (ad_spend)", kind: "REST API", platform: "AMAZON", cron: "每5分钟", val: "13,000 USD", status: "SUCCESS" },
  ],
  qaChat: [
    { role: "user", text: "各平台近30天净利润是多少？" },
    { role: "assistant", text: "全部平台近 30 天净利润为 65,529.67 USD。", note: "口径：按组织、店铺与币种统一折算 USD（未配汇率分币种列出）。", sql: "SELECT SUM(net_profit_usd) FROM metric_snapshots WHERE days=30 [38ms]" },
  ],

  // M4
  m4Tasks: [
    { file: "Amazon SP-API Mock · rate", kind: "演示Mock", scope: "AMAZON/US · 20 SKU · 8周", status: "成功 (160条)", ok: true, tag: "演示" },
    { file: "选品周数据_10000条模拟_nov.xlsx", kind: "外购数据", scope: "1250 SKU · US (10,000条)", status: "成功", ok: true, tag: "待评估" },
    { file: "weekly_internal.csv", kind: "内部数据", scope: "1 SKU · US (1条)", status: "成功", ok: true, tag: "待评估" },
  ],
  m4Pool: [
    { sku: "SKU-00515", name: "汽车后备箱整理箱", region: "AMAZON / US", rev: "$66,829.54", trend: "+27.5%", src: "外购数据", stage: "已提交待审", submitter: "planner", score: 86, budget: "$1,200 (50件)" },
    { sku: "SKU-00538", name: "可折叠洗衣篮", region: "AMAZON / US", rev: "$56,521.94", trend: "+31.2%", src: "外购数据", stage: "仅研究估算", submitter: "planner", score: 81, budget: "$950 (40件)" },
    { sku: "SKU-00299", name: "宠物汽车座垫", region: "AMAZON / US", rev: "$53,189.42", trend: "+16.6%", src: "外购数据", stage: "已批准测款", submitter: "planner_wu", score: 89, budget: "$1,500 (60件)" },
  ],

  // M5
  demandProfileVer: 1,
  demandProfileMode: "平稳季节 + 短周期波动",
  m5Models: [
    { name: "CatBoost · v1", family: "TREE", minPts: "≥ 90 点", ready: "已接入推理", enabled: true, desc: "按真实日销量滞后值与星期特征训练" },
    { name: "Croston / SBA · v1", family: "INTERMITTENT", minPts: "≥ 30 点", ready: "已接入推理", enabled: true, desc: "适合含大量零销量的间歇需求基线" },
    { name: "Holt-Winters · v1", family: "STATISTICAL", minPts: "≥ 56 点", ready: "已接入推理", enabled: true, desc: "短周期趋势与季节性指数平滑基线" },
    { name: "LightGBM · v1", family: "TREE", minPts: "≥ 90 点", ready: "已接入推理", enabled: true, desc: "树模型日频预测，未接入外生促销特征" },
    { name: "Prophet · v1", family: "STATISTICAL", minPts: "≥ 90 点", ready: "已接入推理", enabled: true, desc: "拟合趋势与周季节性曲线" },
    { name: "SARIMA · v1", family: "STATISTICAL", minPts: "≥ 90 点", ready: "已接入推理", enabled: true, desc: "稳定季节序列统计基线" },
    { name: "TFT / Transformer", family: "DEEP", minPts: "≥ 180 点", ready: "样本不足提示", enabled: true, desc: "建议≥180天真实订单，当前96天仅短样本参考" },
    { name: "TSB · v1", family: "INTERMITTENT", minPts: "≥ 30 点", ready: "已接入推理", enabled: true, desc: "需求概率变化的长尾间歇序列" },
    { name: "TSFM 零样本", family: "FOUNDATION", minPts: "≥ 8 点", ready: "已接入推理", enabled: true, desc: "Chronos-Bolt-Tiny 零样本推理需回测验证" },
  ],
  m5Eval: [
    { date: "2026-11-11", pred: 29, actual: 32, edited: false },
    { date: "2026-11-12", pred: 63, actual: 58, edited: false },
    { date: "2026-11-13", pred: 27, actual: 35, edited: true },
  ],

  // M6
  m6Branch: "normal",
  m6SelectedPlan: 1,
  m6Plans: [
    { name: "保守方案 (90%服务)", qty: 480, lost: "约 68 件", cash: "$5,376", profit: "+$4,120" },
    { name: "平衡方案 (推荐 · 95%)", qty: 620, lost: "约 12 件", cash: "$6,944", profit: "+$5,860" },
    { name: "激进方案 (99%备货)", qty: 800, lost: "0 件", cash: "$8,960", profit: "+$6,150" },
  ],
  m6Submitter: "planner",
  m6Status: "待主管审批",
  m6Receipts: [
    { batch: "第1批 (11-28)", qty: "400件 (差0)", qc: "质检合格 #QC1", who: "wh_zhao" },
    { batch: "第2批 (12-05)", qty: "215件 (-5短装)", qc: "差异已登记", who: "wh_zhao" },
  ],

  // M7
  m7Sku: "MAT-014",
  m7CopyType: "商品标题",
  m7MustTerm: "Waterproof, PU Leather",
  m7BanTerm: "Best, #1, Miracle",
  m7CopyGenCount: 1,
  m7ResultTab: "商品标题 (5)",
  m7SelectedCopy: "1. MAT-014 | Waterproof, PU Leather Premium Design for Office & Home",
  m7ImgType: "白底主图",
  m7ImgSeed: 101,
  m7PickedImgIdx: 0,
  m7VidType: "产品展示",
  m7VidProgress: 68,
  m7Published: false,
};

function toast(msg) {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBd">
      <div class="modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:16px;">${title}</strong>
          <button class="btn btn-sm" id="modalCloseBtn">✕</button>
        </div>
        <div>${bodyHtml}</div>
      </div>
    </div>
  `;
  document.getElementById("modalCloseBtn").onclick = closeModal;
  document.getElementById("modalBd").onclick = (e) => { if (e.target.id === "modalBd") closeModal(); };
  if (onMount) onMount();
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function goPage(pageId) {
  state.pageId = pageId;
  window.location.hash = pageId;
  rerender();
}

function findModuleOfPage(pageId) {
  return MODULE_DEFS.find(m => m.pages.some(p => p.id === pageId)) || MODULE_DEFS[0];
}

function rerender() {
  const mod = findModuleOfPage(state.pageId);
  const meta = PAGE_META[state.pageId];

  // Role hint
  document.getElementById("roleHint").textContent = ROLE_HINTS[state.role] || "";

  // Sidebar
  document.getElementById("sidebarNav").innerHTML = MODULE_DEFS.map(m => `
    <div class="nav-item ${m.id === mod.id ? "active" : ""}" data-firstpage="${m.pages[0].id}">
      <span>${m.label}</span>
      <span class="nav-badge">${m.badge}</span>
    </div>
  `).join("");
  document.querySelectorAll(".nav-item").forEach(el => {
    el.onclick = () => goPage(el.dataset.firstpage);
  });

  // Top Header
  document.getElementById("breadcrumb").textContent = meta.breadcrumb;
  document.getElementById("pageTitle").textContent = meta.title;
  document.getElementById("pageSubtitle").textContent = meta.subtitle;

  // Sub-page nav buttons
  document.getElementById("subnavButtons").innerHTML = mod.pages.map(p => `
    <button class="subnav-btn ${p.id === state.pageId ? "active" : ""}" data-pid="${p.id}">
      ${p.id === state.pageId ? "● " : ""}${p.label}
    </button>
  `).join("");
  document.querySelectorAll(".subnav-btn").forEach(b => {
    b.onclick = () => goPage(b.dataset.pid);
  });

  // Page render
  const helpers = { toast, goPage, openModal, closeModal, rerender };
  const view = renderM0_M3(state.pageId, state, helpers) || renderM4_M7(state.pageId, state, helpers);

  const actBox = document.getElementById("headerActions");
  actBox.innerHTML = "";
  (view.headerActions || []).forEach(a => {
    const btn = document.createElement("button");
    btn.className = `btn ${a.primary ? "btn-primary" : ""}`;
    btn.textContent = a.label;
    btn.onclick = a.onClick;
    actBox.appendChild(btn);
  });

  document.getElementById("pageBody").innerHTML = view.html;
  if (view.bind) view.bind();

  // Annotations & Ledger
  const grid = document.getElementById("workspaceGrid");
  const ledger = document.getElementById("ledgerPanel");
  document.getElementById("annoStateText").textContent = state.showAnno ? "已展开" : "已收起";
  if (state.showAnno) {
    grid.classList.remove("anno-hidden");
    ledger.classList.remove("hidden");
  } else {
    grid.classList.add("anno-hidden");
    ledger.classList.add("hidden");
  }

  document.getElementById("annoPageTitle").textContent = `功能块注释 · ${state.pageId.toUpperCase()}`;
  document.getElementById("annoCards").innerHTML = meta.blocks.map((b, idx) => `
    <div class="anno-card" style="border-left-color:${b.color};">
      <div class="anno-card-head">
        <span class="anno-tag" style="background:${b.color};">${idx + 1}</span>
        <span>${b.title}</span>
      </div>
      <div class="anno-line anno-k-step">【对应步骤】${b.step}</div>
      <div class="anno-line anno-k-srs">【SRS依据】${b.srs}</div>
      <div class="anno-line anno-k-tech">【技术支撑】${b.tech}</div>
    </div>
  `).join("");

  document.getElementById("ledgerGrid").innerHTML = meta.ledger.map(([term, kind, src]) => `
    <div class="ledger-row">
      <span class="ledger-term">${term}</span>
      <span class="${kind.includes("SRS") || kind.includes("pilot") || kind.includes("img") ? "ledger-kind-srs" : "ledger-kind-mock"}">${kind}</span>
      <span class="ledger-src">${src}</span>
    </div>
  `).join("");
}

// Init
document.getElementById("roleSelect").onchange = (e) => {
  state.role = e.target.value;
  rerender();
  toast(`已切换登录角色为：${state.role}`);
};
document.getElementById("toggleAnnoBtn").onclick = () => {
  state.showAnno = !state.showAnno;
  rerender();
};

const initHash = window.location.hash.replace("#", "");
if (PAGE_META[initHash]) state.pageId = initHash;
rerender();
