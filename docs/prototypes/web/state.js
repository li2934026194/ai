export const BACKEND_SERVICE_URL = ""; // 预留后台服务地址；留空表示纯前端演示模式，外部连接服务均如实标注未接入

export const WAREHOUSE_LABELS = {
  "US-WH-2": "美国美西海外仓",
  "US-WH-1": "美国美东海外仓",
  "TH-WH-1": "泰国曼谷本地仓",
  "MY-WH-1": "马来吉隆坡仓",
};

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
  "ORG-301": makeSvgDataUri("#fff7ed", "#ea580c", "后备箱整理箱", `<rect x="68" y="76" width="104" height="72" rx="10" fill="#fb923c"/><rect x="64" y="66" width="112" height="16" rx="6" fill="#ea580c"/><line x1="103" y1="82" x2="103" y2="148" stroke="#ffedd5" stroke-width="4"/><line x1="137" y1="82" x2="137" y2="148" stroke="#ffedd5" stroke-width="4"/>`),
  "LND-538": makeSvgDataUri("#eef2ff", "#4f46e5", "防水折叠洗衣篮", `<path d="M78 72 H162 L152 152 H88 Z" fill="#6366f1"/><ellipse cx="120" cy="72" rx="42" ry="10" fill="#4338ca"/><ellipse cx="120" cy="72" rx="34" ry="6" fill="#c7d2fe"/><line x1="94" y1="102" x2="146" y2="102" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/><line x1="96" y1="124" x2="144" y2="124" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/>`),
  "PET-204": makeSvgDataUri("#fefce8", "#ca8a04", "防抓宠物汽车垫", `<path d="M70 68 H170 V142 L156 156 H84 L70 142 Z" fill="#eab308"/><rect x="84" y="84" width="72" height="44" rx="8" fill="#fef08a"/><circle cx="104" cy="106" r="6" fill="#a16207"/><circle cx="136" cy="106" r="6" fill="#a16207"/><circle cx="120" cy="118" r="8" fill="#a16207"/>`),
  "MNT-405": makeSvgDataUri("#f5f3ff", "#7c3aed", "磁吸折叠支架", `<rect x="88" y="144" width="64" height="12" rx="6" fill="#6d28d9"/><line x1="120" y1="144" x2="106" y2="102" stroke="#7c3aed" stroke-width="10" stroke-linecap="round"/><rect x="86" y="64" width="68" height="46" rx="10" fill="#8b5cf6"/><circle cx="120" cy="87" r="14" fill="#ede9fe"/>`),
  "VAC-704": makeSvgDataUri("#ecfdf5", "#059669", "迷你真空封口机", `<rect x="62" y="92" width="116" height="42" rx="20" fill="#10b981"/><rect x="76" y="106" width="68" height="12" rx="6" fill="#ecfdf5"/><circle cx="158" cy="113" r="8" fill="#047857"/>`),
  "LMP-418": makeSvgDataUri("#fef2f2", "#dc2626", "露营氛围灯串", `<path d="M68 82 Q120 120 172 82" fill="none" stroke="#475569" stroke-width="4"/><circle cx="80" cy="92" r="11" fill="#fbbf24"/><circle cx="106" cy="104" r="11" fill="#f87171"/><circle cx="134" cy="104" r="11" fill="#fbbf24"/><circle cx="160" cy="92" r="11" fill="#f87171"/>`),
  "BTL-119": makeSvgDataUri("#f0f9ff", "#0284c7", "旅行分装瓶套装", `<rect x="78" y="76" width="24" height="72" rx="8" fill="#38bdf8"/><rect x="108" y="66" width="24" height="82" rx="8" fill="#0284c7"/><rect x="138" y="84" width="24" height="64" rx="8" fill="#7dd3fc"/>`),
  "KET-502": makeSvgDataUri("#fef3c7", "#d97706", "折叠硅胶水壶", `<rect x="78" y="74" width="84" height="72" rx="16" fill="#f59e0b"/><rect x="90" y="60" width="60" height="16" rx="6" fill="#b45309"/><path d="M162 88 C182 88 182 132 162 132" fill="none" stroke="#d97706" stroke-width="7"/>`),
  "BRD-601": makeSvgDataUri("#ecfdf5", "#16a34a", "户外防水野餐垫", `<rect x="64" y="72" width="112" height="76" rx="12" fill="#4ade80"/><line x1="64" y1="110" x2="176" y2="110" stroke="#166534" stroke-width="4"/><line x1="120" y1="72" x2="120" y2="148" stroke="#166534" stroke-width="4"/>`),
  "EAR-712": makeSvgDataUri("#eef2ff", "#4338ca", "运动蓝牙耳机", `<path d="M84 120 C84 74 156 74 156 120" fill="none" stroke="#4338ca" stroke-width="10" stroke-linecap="round"/><rect x="72" y="110" width="24" height="36" rx="10" fill="#6366f1"/><rect x="144" y="110" width="24" height="36" rx="10" fill="#6366f1"/>`),
  "SKU-00515": makeSvgDataUri("#fff7ed", "#ea580c", "后备箱整理箱", `<rect x="68" y="76" width="104" height="72" rx="10" fill="#fb923c"/><rect x="64" y="66" width="112" height="16" rx="6" fill="#ea580c"/><line x1="103" y1="82" x2="103" y2="148" stroke="#ffedd5" stroke-width="4"/><line x1="137" y1="82" x2="137" y2="148" stroke="#ffedd5" stroke-width="4"/>`),
  "SKU-00538": makeSvgDataUri("#eef2ff", "#4f46e5", "防水折叠洗衣篮", `<path d="M78 72 H162 L152 152 H88 Z" fill="#6366f1"/><ellipse cx="120" cy="72" rx="42" ry="10" fill="#4338ca"/><ellipse cx="120" cy="72" rx="34" ry="6" fill="#c7d2fe"/><line x1="94" y1="102" x2="146" y2="102" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/><line x1="96" y1="124" x2="144" y2="124" stroke="#e0e7ff" stroke-width="4" stroke-linecap="round"/>`),
  "SKU-00299": makeSvgDataUri("#fefce8", "#ca8a04", "宠物防抓汽车垫", `<path d="M70 68 H170 V142 L156 156 H84 L70 142 Z" fill="#eab308"/><rect x="84" y="84" width="72" height="44" rx="8" fill="#fef08a"/><circle cx="104" cy="106" r="6" fill="#a16207"/><circle cx="136" cy="106" r="6" fill="#a16207"/><circle cx="120" cy="118" r="8" fill="#a16207"/>`),
  "SKU-00612": makeSvgDataUri("#f5f3ff", "#7c3aed", "磁吸折叠支架", `<rect x="88" y="144" width="64" height="12" rx="6" fill="#6d28d9"/><line x1="120" y1="144" x2="106" y2="102" stroke="#7c3aed" stroke-width="10" stroke-linecap="round"/><rect x="86" y="64" width="68" height="46" rx="10" fill="#8b5cf6"/><circle cx="120" cy="87" r="14" fill="#ede9fe"/>`),
  "SKU-00704": makeSvgDataUri("#ecfdf5", "#059669", "迷你真空封口机", `<rect x="62" y="92" width="116" height="42" rx="20" fill="#10b981"/><rect x="76" y="106" width="68" height="12" rx="6" fill="#ecfdf5"/><circle cx="158" cy="113" r="8" fill="#047857"/>`),
  "SKU-00418": makeSvgDataUri("#fef2f2", "#dc2626", "露营氛围灯串", `<path d="M68 82 Q120 120 172 82" fill="none" stroke="#475569" stroke-width="4"/><circle cx="80" cy="92" r="11" fill="#fbbf24"/><circle cx="106" cy="104" r="11" fill="#f87171"/><circle cx="134" cy="104" r="11" fill="#fbbf24"/><circle cx="160" cy="92" r="11" fill="#f87171"/>`),
};

export function getEvidenceImg(kind = "scratch", label = "买家实拍凭证") {
  if (kind === "box") {
    return makeSvgDataUri("#fff7ed", "#ea580c", label, `<rect x="66" y="72" width="108" height="84" rx="8" fill="#fed7aa" stroke="#ea580c" stroke-width="4"/><path d="M66 96 L112 72 M174 114 L142 156" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/><circle cx="132" cy="112" r="22" fill="none" stroke="#dc2626" stroke-width="4" stroke-dasharray="6 4"/>`);
  }
  if (kind === "voucher") {
    return makeSvgDataUri("#ecfdf5", "#059669", label, `<rect x="74" y="64" width="92" height="100" rx="10" fill="#d1fae5" stroke="#059669" stroke-width="3"/><line x1="90" y1="88" x2="150" y2="88" stroke="#047857" stroke-width="4"/><line x1="90" y1="108" x2="138" y2="108" stroke="#047857" stroke-width="4"/><path d="M102 134 L116 146 L142 122" fill="none" stroke="#059669" stroke-width="6" stroke-linecap="round"/>`);
  }
  return makeSvgDataUri("#fef2f2", "#dc2626", label, `<rect x="72" y="68" width="96" height="90" rx="14" fill="#dbeafe" stroke="#2563eb" stroke-width="3"/><path d="M92 92 L148 134 M144 96 L108 128" stroke="#dc2626" stroke-width="6" stroke-linecap="round"/><circle cx="120" cy="113" r="26" fill="none" stroke="#dc2626" stroke-width="4" stroke-dasharray="6 4"/>`);
}

export function daysOffsetDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function daysOffsetDateTime(offsetDays, hhmm = "10:30") {
  return `${daysOffsetDate(offsetDays)} ${hhmm}`;
}

export function calcProductMargin(p) {
  if (p.cost === null || p.cost === undefined || !p.salePriceUsd) {
    return { known: false, profitUsd: null, marginPct: null, commissionUsd: null, returnLossUsd: null };
  }
  const price = Number(p.salePriceUsd);
  const commissionUsd = +(price * ((p.commissionRate || 0) / 100)).toFixed(2);
  const returnLossUsd = +(price * ((p.returnLossRate || 0) / 100)).toFixed(2);
  const totalCost = Number(p.cost) + Number(p.freight || 0) + commissionUsd + Number(p.lastMile || 0) + Number(p.tariff || 0) + Number(p.adCost || 0) + returnLossUsd;
  const profitUsd = +(price - totalCost).toFixed(2);
  const marginPct = +((profitUsd / price) * 100).toFixed(1);
  return { known: true, profitUsd, marginPct, commissionUsd, returnLossUsd, totalCost: +totalCost.toFixed(2) };
}

export function calcInvCoverage(item) {
  const daily = item.dailySales || 1;
  const coverDays = +(item.avail / daily).toFixed(1);
  if (item.ageDays > 90) {
    return { coverDays, level: "滞销积压", pill: "p-gray", advice: "库龄超90天占用仓储费，建议打折促销清仓或捆绑消化" };
  }
  if (coverDays < 7) {
    return { coverDays, level: "严重缺货(<7天)", pill: "p-red", advice: "不足7天随时断货！立即提交加急补货或空运调拨" };
  }
  if (coverDays <= 14) {
    return { coverDays, level: "即将断货(7-14天)", pill: "p-amber", advice: "7~14天安全缓冲告急，本周内须下常规补货单" };
  }
  return { coverDays, level: "水位健康", pill: "p-green", advice: "可售周转健康，按正常周期监测补货即可" };
}

export function evalShopHealth(s) {
  if (s.mode === "MOCK") {
    return { badge: "仅演示隔离：不计真实营收", pill: "p-blue", urgent: false, triggerText: "演示环境严格与实盘营收隔离" };
  }
  const target = s.authExpireDate && /^\d{4}-\d{2}-\d{2}$/.test(s.authExpireDate) ? new Date(s.authExpireDate + "T00:00:00") : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDays = target ? Math.round((target - today) / 86400000) : 999;

  if ((s.perfScore < 80 || s.disputeRate7d > 2) && s.zeroOrderDays >= 3) {
    return {
      badge: "建议暂停营业",
      pill: "p-red",
      urgent: true,
      triggerText: `绩效分 ${s.perfScore} 分 / 近7天纠纷率 ${s.disputeRate7d}% / 连续 ${s.zeroOrderDays} 天零单`
    };
  }
  if (expDays <= 7) {
    return {
      badge: `限期授权：${Math.max(0, expDays)}天后到期`,
      pill: "p-red",
      urgent: true,
      triggerText: `授权有效期仅剩 ${Math.max(0, expDays)} 天（到期日 ${s.authExpireDate}），超时将停止拉单`
    };
  }
  if ((s.syncFailCount || 0) >= 3 || s.health === "同步异常") {
    return {
      badge: `数据异常：近${s.syncFailCount || 3}次同步失败，请排查`,
      pill: "p-red",
      urgent: true,
      triggerText: `最近连续同步失败 ${s.syncFailCount || 3} 次，建议立即重试同步或核对授权`
    };
  }
  if (s.health === "连接已断开") {
    return { badge: "连接已断开", pill: "p-red", urgent: true, triggerText: s.errNote || "请重新授权恢复连接" };
  }
  return {
    badge: "连接与经营正常",
    pill: "p-green",
    urgent: false,
    triggerText: `绩效 ${s.perfScore} 分 · 纠纷率 ${s.disputeRate7d}% · 授权余 ${expDays} 天`
  };
}

export function computeLiveBusinessStats(state) {
  const realOrders = state.orders.filter(o => o.mode === "REAL");
  const gmv = +realOrders.reduce((s, o) => s + Number(o.amountUsd || 0), 0).toFixed(2);
  const ordersCnt = realOrders.length;
  let netProfit = 0;
  let adSpend = 0;
  const byShop = {};

  state.shops.forEach(sh => {
    byShop[sh.name] = { gmv: 0, count: 0, aov: 0, profit: 0 };
  });

  realOrders.forEach(o => {
    const prod = state.masterProducts.find(p => p.sku === o.sku) || state.masterProducts[0];
    const qty = Number(o.qty || 1);
    const amt = Number(o.amountUsd || 0);
    const unitFixed = Number(prod.cost || 0) + Number(prod.freight || 0) + Number(prod.lastMile || 0) + Number(prod.tariff || 0);
    const unitAd = Number(prod.adCost || 0);
    const commUsd = amt * (Number(prod.commissionRate || 0) / 100);
    const retUsd = amt * (Number(prod.returnLossRate || 0) / 100);
    const orderCost = (unitFixed + unitAd) * qty + commUsd + retUsd;
    const orderProfit = amt - orderCost;

    netProfit += orderProfit;
    adSpend += unitAd * qty;

    if (!byShop[o.shop]) byShop[o.shop] = { gmv: 0, count: 0, aov: 0, profit: 0 };
    byShop[o.shop].gmv += amt;
    byShop[o.shop].count += 1;
    byShop[o.shop].profit += orderProfit;
  });

  Object.values(byShop).forEach(entry => {
    entry.gmv = +entry.gmv.toFixed(2);
    entry.profit = +entry.profit.toFixed(2);
    entry.aov = entry.count > 0 ? +(entry.gmv / entry.count).toFixed(2) : 0;
  });

  netProfit = +netProfit.toFixed(2);
  adSpend = +adSpend.toFixed(2);
  const marginPct = gmv > 0 ? ((netProfit / gmv) * 100).toFixed(1) : "0.0";
  const acosPct = gmv > 0 ? ((adSpend / gmv) * 100).toFixed(1) : "0.0";
  const aov = ordersCnt > 0 ? (gmv / ordersCnt).toFixed(2) : "0.00";
  const realLowStocks = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety);
  const syncedDeltaCnt = realOrders.filter(o => !o.historical).length;

  return { gmv, ordersCnt, netProfit, adSpend, marginPct, acosPct, aov, realLowStocks, syncedDeltaCnt, byShop };
}

export function buildSystemConclusion(pageId, state) {
  const stats = computeLiveBusinessStats(state);
  const realShops = state.shops.filter(s => s.mode === "REAL");
  const alertShops = realShops.filter(s => evalShopHealth(s).urgent);
  const lowMarginProds = state.masterProducts.filter(p => calcProductMargin(p).marginPct < 12);
  const pendingCostLogs = state.costChangeLogs.filter(c => c.status === "待主管审批");
  const invCovs = state.inventoryItems.map(i => ({ item: i, cov: calcInvCoverage(i) }));
  const redInv = invCovs.filter(x => x.cov.pill === "p-red");
  const grayInv = invCovs.filter(x => x.cov.pill === "p-gray");

  if (pageId === "m0a") {
    const first = alertShops[0];
    return {
      tone: alertShops.length ? "red" : "green",
      status: `${realShops.length} 家实盘店中 ${alertShops.length} 家处于异常/限期预警，实盘台账累计销售额 $${stats.gmv.toLocaleString()}（${stats.ordersCnt} 笔）`,
      advice: first ? `建议今日优先处理「${first.name}」（${evalShopHealth(first).badge}）` : "所有实盘店授权与同步均正常，保持常规巡检即可",
      basis: first ? evalShopHealth(first).triggerText : `实盘健康 ${realShops.length}/${realShops.length} 家`
    };
  }
  if (pageId === "m0b") {
    const firstCost = pendingCostLogs[0];
    const firstLow = lowMarginProds[0];
    return {
      tone: pendingCostLogs.length || lowMarginProds.length ? "amber" : "green",
      status: `在档 ${state.masterProducts.length} 款商品（含 ${lowMarginProds.length} 款低毛利标红品）、待批成本变更 ${pendingCostLogs.length} 笔、实盘订单 ${stats.ordersCnt} 笔`,
      advice: firstCost ? `建议主管先复核审批 ${firstCost.sku} 成本单，并核查 ${firstLow ? firstLow.sku : "薄利款"} 售价` : (firstLow ? `建议提高 ${firstLow.sku} 售价或压降物流费` : "全店商品毛利率与订单同步健康"),
      basis: `全站实盘综合净利率 ${stats.marginPct}% · ${lowMarginProds.length} 款毛利＜12%`
    };
  }
  if (pageId === "m0c") {
    const topUrgent = [...redInv].sort((a, b) => a.cov.coverDays - b.cov.coverDays)[0];
    return {
      tone: redInv.length ? "red" : "green",
      status: `4 仓共 ${state.inventoryItems.length} 条记录，其中 ${redInv.length} 项严重缺货（＜7天）、${grayInv.length} 款库龄超 90 天积压`,
      advice: topUrgent ? `建议优先盘点并补货 ${topUrgent.item.sku}（${topUrgent.item.whName}，仅够卖 ${topUrgent.cov.coverDays} 天）` : "各仓库存覆盖天数均在安全缓冲以上",
      basis: `在途总计 ${state.inventoryItems.reduce((s, i) => s + (i.inTransit || 0), 0)} 件 · 严重缺货 ${redInv.length} 项`
    };
  }
  if (pageId === "m1a") {
    const pending = state.csSessions.filter(s => s.status === "待人工接管");
    const aiAuto = state.csSessions.filter(s => s.status === "智能自动接待");
    const humanBusy = state.csSessions.filter(s => s.status === "人工接待中");
    return {
      tone: pending.length ? "amber" : "green",
      status: `共 ${state.csSessions.length} 组会话：智能自动接待 ${aiAuto.length} 组、待人工接管 ${pending.length} 组、人工接待中 ${humanBusy.length} 组`,
      advice: pending.length ? `请先点击「立即接管并去回复」处理「${pending[0].buyer}」（${pending[0].shop}）` : "高风险人工队列已全部接管处理",
      basis: `导购与说明书知识库就绪 ${state.csCatalog.length} 条 · 测试沙盒已隔离`
    };
  }
  if (pageId === "m1b") {
    return {
      tone: "blue",
      status: `已建立本店专属导购与说明书排障知识库 ${state.csCatalog.length} 条，导入失败 ${state.csImportLogs.reduce((s, l) => s + (l.failCount || 0), 0)} 条`,
      advice: "AI 自动回复仅引用本页已就绪的导购与说明书知识，严禁跨店发送他店链接",
      basis: `知识索引就绪 ${state.csCatalog.length} 条 · 导入批次数 ${state.csImportLogs.length}`
    };
  }
  if (pageId === "m1c") {
    const waitAppr = state.tickets.filter(t => t.status === "待主管审批");
    const waitVch = state.tickets.filter(t => t.status === "待上传退款凭证");
    return {
      tone: waitAppr.length + waitVch.length ? "amber" : "green",
      status: `共 ${state.tickets.length} 笔售后工单：待主管审批 ${waitAppr.length} 笔、待传退款凭证 ${waitVch.length} 笔`,
      advice: waitAppr.length ? `请主管先批 ${waitAppr[0].id}（$${waitAppr[0].refundAmount.toFixed(2)}）` : (waitVch.length ? `请客服完成 ${waitVch[0].id} 手工打款后回传凭证关单` : "所有售后退款均已闭环归档"),
      basis: `累计已闭环 ${state.tickets.filter(t => t.status === "已关闭（退款完成）").length} 笔`
    };
  }
  if (pageId === "m1d") {
    return {
      tone: "blue",
      status: `联调沙盒会话共 ${state.csSessions.find(s => s.id === "cs3")?.msgs.length || 0} 条模拟对话（不计真实营收、不发真实消息）`,
      advice: "可发送含退款关键词测试转人工拦截，再到 M1-1 客服页验证回执",
      basis: "测试流量 100% 隔离于实盘店铺"
    };
  }
  if (pageId === "m2a" || pageId === "m2b") {
    return {
      tone: stats.realLowStocks.length ? "amber" : "green",
      status: `实盘近 30 日销售额 $${stats.gmv.toLocaleString()}、净利润 $${stats.netProfit.toLocaleString()}（净利率 ${stats.marginPct}%）、实盘订单 ${stats.ordersCnt} 笔`,
      advice: stats.realLowStocks.length ? `发现 ${stats.realLowStocks.length} 项低库存预警，建议点击异常卡片追问明细或安排补货` : "全站经营指标健康且口径与 M0/M3 完全一致",
      basis: `客单价 $${stats.aov} · 广告占比 ${stats.acosPct}%`
    };
  }
  if (pageId === "m3a") {
    const errList = state.qaBindings.filter(b => b.status !== "更新正常");
    return {
      tone: errList.length ? "amber" : "green",
      status: `${state.qaBindings.length} 项经营指标中 ${state.qaBindings.length - errList.length} 项正常、${errList.length} 项外部接口未响应`,
      advice: errList.length ? `内部指标与 M0/M2 实时一致；外部接口「${errList[0].name}」未连接，待配置后点击立即更新` : "全部指标调度运行正常",
      basis: `内部汇总销售额 $${stats.gmv.toLocaleString()} · 净利润 $${stats.netProfit.toLocaleString()}`
    };
  }
  if (pageId === "m3b") {
    return {
      tone: "blue",
      status: `已连接实时实盘台账（$${stats.gmv.toLocaleString()} / ${stats.ordersCnt} 单 / 净利率 ${stats.marginPct}%），当前共 ${state.qaChat.length} 条问答记录`,
      advice: "可直接提问销售额、净利润、广告占比或低库存预警，系统按统一口径只读现算",
      basis: "只读安全守卫在线 · 修改指令自动拦截"
    };
  }
  if (pageId === "m4a" || pageId === "m4b" || pageId === "m4c") {
    const readyCnt = state.m4Pool.filter(x => x.sysAdvice?.badge === "建议投产" && x.stage === "初筛候选").length;
    const waitCnt = state.m4Pool.filter(x => x.stage === "已提交待审").length;
    return {
      tone: waitCnt || readyCnt ? "blue" : "green",
      status: `选品池共 ${state.m4Pool.length} 款：初筛可立即投产 ${readyCnt} 款、已提交待终审 ${waitCnt} 款、已批准测款 ${state.m4Pool.filter(x => x.stage === "已批准测款").length} 款`,
      advice: pageId === "m4c" ? (waitCnt ? `请主管优先终审待批新品（当前 ${waitCnt} 款待拍板）` : "待审批选品已处理完毕") : (readyCnt ? `建议选品员优先勾选「只看可投产」，将 ${readyCnt} 款高毛利实盘新品送审` : "可先导入本周选品数据或观察行业参考品"),
      basis: `内部实盘选品 ${state.m4Pool.filter(x => x.srcCode === "INTERNAL").length} 款 · 净利率门槛 ≥10%`
    };
  }
  if (pageId === "m5a" || pageId === "m5b" || pageId === "m5c") {
    const predSum = state.m5DailyPred.reduce((a, b) => a + b, 0);
    const wapeNum = (() => {
      const sA = state.m5Eval.reduce((s, r) => s + r.actual, 0);
      const sE = state.m5Eval.reduce((s, r) => s + Math.abs(r.actual - r.pred), 0);
      return ((sE / Math.max(1, sA)) * 100).toFixed(1);
    })();
    return {
      tone: "blue",
      status: `当前画像 v${state.demandProfileVer}（${state.demandProfileMode}），${state.m5Sku} 未来7日预计销量 ${predSum} 件，回测误差率 ${wapeNum}%`,
      advice: pageId === "m5c" ? "若历史某天因断货少卖，请标注缺货日并填写原因还原真实需求" : "确认预测结果后可直接流入 M6-2 智能补货测算采购量",
      basis: `基于近 96 天完结日订单 · 当前方案 ${state.m5Model}`
    };
  }
  if (pageId === "m6a" || pageId === "m6b" || pageId === "m6c" || pageId === "m6d") {
    const waitPo = state.m6Plans.filter(p => p.status === "待主管审批");
    const openOrders = state.m6Orders.filter(o => o.status !== "全部收齐");
    return {
      tone: waitPo.length ? "amber" : "green",
      status: `补货队列：待批草案 ${waitPo.length} 笔、待收货在途采购单 ${openOrders.length} 笔、已登记收货 ${state.m6Receipts.length} 批`,
      advice: waitPo.length ? `建议主管前往 M6-3 核对参数快照签名后批复 ${waitPo[0].id}` : (openOrders.length ? `仓库到货后请在 M6-4 登记收货凭证，再去 M0-3 正式盘点入仓` : "当前补货与收货队列畅通"),
      basis: `美西 BAG-108 剩余 ${state.inventoryItems.find(i => i.id === "inv1")?.avail || 0} 件 · 曼谷 FAN-203 剩余 ${state.inventoryItems.find(i => i.id === "inv3")?.avail || 0} 件`
    };
  }
  if (pageId === "m7a" || pageId === "m7b" || pageId === "m7c" || pageId === "m7d") {
    const imgDone = state.m7Images.filter(i => i.done).length;
    return {
      tone: state.m7ComplianceStatus === "主管已批准导出" ? "green" : "amber",
      status: `当前制作商品 ${state.m7Sku}：套图 ${imgDone}/5 张就绪，A+ ${state.m7AplusDone ? "已就绪" : "待补"}，合规状态「${state.m7ComplianceStatus}」`,
      advice: state.m7ComplianceStatus === "主管已批准导出" ? "已获主管放行，可在 M7-4 右上角导出合规上架素材包" : "补齐 8 类交付清单并核验站点合规与人物标识后送主管批准",
      basis: `M4 已批准测款可制作商品 ${state.m4Pool.filter(x => x.stage === "已批准测款").length} 款`
    };
  }
  if (pageId === "m8a" || pageId === "m8b") {
    return {
      tone: "blue",
      status: `在职员工 ${state.employees.filter(e => e.active).length}/${state.employees.length} 人（覆盖 9 大岗位），审计台账累计 ${state.auditLogs.length} 条记录`,
      advice: "新增与调岗均实时写入中文审计台账；切换岗位体验权限请统一使用左上角岗位选择框",
      basis: `越权拦截记录 ${state.auditLogs.filter(l => !l.ok).length} 条`
    };
  }
  return {
    tone: "blue",
    status: `实盘近 30 日销售额 $${stats.gmv.toLocaleString()}，净利润 $${stats.netProfit.toLocaleString()}（${stats.marginPct}%）`,
    advice: "请按当前岗位待办优先处理紧急任务",
    basis: `实盘订单 ${stats.ordersCnt} 笔 · 低库存预警 ${stats.realLowStocks.length} 项`
  };
}

function pickProductIconByMeta(name = "", category = "") {
  const txt = `${name} ${category}`;
  if (/整理|收纳|洗衣|箱|篮/.test(txt)) {
    return { bg: "#fff7ed", accent: "#ea580c", svg: `<rect x="68" y="76" width="104" height="72" rx="10" fill="#fb923c"/><rect x="64" y="66" width="112" height="16" rx="6" fill="#ea580c"/><line x1="103" y1="82" x2="103" y2="148" stroke="#ffedd5" stroke-width="4"/><line x1="137" y1="82" x2="137" y2="148" stroke="#ffedd5" stroke-width="4"/>` };
  }
  if (/宠物|猫|狗|座垫/.test(txt)) {
    return { bg: "#fefce8", accent: "#ca8a04", svg: `<path d="M70 68 H170 V142 L156 156 H84 L70 142 Z" fill="#eab308"/><rect x="84" y="84" width="72" height="44" rx="8" fill="#fef08a"/><circle cx="104" cy="106" r="6" fill="#a16207"/><circle cx="136" cy="106" r="6" fill="#a16207"/><circle cx="120" cy="118" r="8" fill="#a16207"/>` };
  }
  if (/封口|水壶|厨房|咖啡|研磨|保鲜/.test(txt)) {
    return { bg: "#ecfdf5", accent: "#059669", svg: `<rect x="62" y="92" width="116" height="42" rx="20" fill="#10b981"/><rect x="76" y="106" width="68" height="12" rx="6" fill="#ecfdf5"/><circle cx="158" cy="113" r="8" fill="#047857"/>` };
  }
  if (/支架|3C|耳机|充电|灯|风扇|吸尘/.test(txt)) {
    return { bg: "#f5f3ff", accent: "#7c3aed", svg: `<rect x="88" y="144" width="64" height="12" rx="6" fill="#6d28d9"/><line x1="120" y1="144" x2="106" y2="102" stroke="#7c3aed" stroke-width="10" stroke-linecap="round"/><rect x="86" y="64" width="68" height="46" rx="10" fill="#8b5cf6"/><circle cx="120" cy="87" r="14" fill="#ede9fe"/>` };
  }
  if (/面霜|护肤|美妆|精华|防晒/.test(txt)) {
    return { bg: "#fdf2f8", accent: "#db2777", svg: `<rect x="82" y="84" width="76" height="66" rx="14" fill="#f472b6"/><rect x="76" y="66" width="88" height="22" rx="8" fill="#db2777"/><rect x="96" y="104" width="48" height="26" rx="6" fill="#fff1f2"/><circle cx="120" cy="117" r="7" fill="#db2777"/>` };
  }
  if (/垫|户外|露营|运动|瑜伽/.test(txt)) {
    return { bg: "#f0fdf4", accent: "#10b981", svg: `<rect x="64" y="88" width="112" height="44" rx="22" fill="#10b981"/><ellipse cx="78" cy="110" rx="12" ry="22" fill="#047857"/><ellipse cx="78" cy="110" rx="5" ry="11" fill="#a7f3d0"/><path d="M94 94 H158 M94 126 H158" stroke="#ecfdf5" stroke-width="3" stroke-linecap="round"/>` };
  }
  return { bg: "#eff6ff", accent: "#2563eb", svg: `<rect x="82" y="64" width="76" height="92" rx="18" fill="#2563eb"/><path d="M98 64 C98 44 142 44 142 64" fill="none" stroke="#1d4ed8" stroke-width="7"/><rect x="94" y="102" width="52" height="36" rx="8" fill="#93c5fd"/>` };
}

export function getProductImg(sku, name = "", category = "") {
  if (PRODUCT_IMAGES[sku]) return PRODUCT_IMAGES[sku];
  const meta = pickProductIconByMeta(name, category);
  const label = (name || sku || "待创作商品").slice(0, 8);
  return makeSvgDataUri(meta.bg, meta.accent, label, meta.svg);
}

export function getM7SlotImg(prod, slotIdx, edited = false) {
  const name = prod?.name || prod?.sku || "推荐商品";
  const category = prod?.category || "";
  const meta = pickProductIconByMeta(name, category);
  const shortName = name.slice(0, 9);
  const ac = edited ? "#059669" : meta.accent;

  if (slotIdx === 0) {
    // 1. 白底棚拍主图（85%主体占比）
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" fill="#ffffff"/>
      <ellipse cx="160" cy="246" rx="82" ry="14" fill="#e2e8f0"/>
      <g transform="translate(20,24) scale(1.18)">${meta.svg}</g>
      ${edited ? `<rect x="44" y="34" width="232" height="232" rx="18" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6 4"/><rect x="18" y="14" width="128" height="24" rx="12" fill="#dcfce7"/><text x="82" y="30" font-family="sans-serif" font-size="11" font-weight="700" fill="#065f46" text-anchor="middle">已局部提亮去标 ✓</text>` : `<rect x="196" y="14" width="108" height="22" rx="11" fill="#fef3c7"/><text x="250" y="29" font-family="sans-serif" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">白底主图(待精修)</text>`}
      <text x="160" y="295" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="15" font-weight="700" fill="#0f172a" text-anchor="middle">${shortName} · 纯白主图</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  if (slotIdx === 1) {
    // 2. 使用场景实拍示意图
    const bgTop = edited ? "#ecfeff" : "#fff7ed";
    const desk = edited ? "#cffafe" : "#fed7aa";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <rect width="320" height="240" fill="${bgTop}"/>
      <polygon points="20,0 130,0 90,155 0,155" fill="#ffffff" opacity="0.55"/>
      <rect x="0" y="155" width="320" height="85" fill="${desk}"/>
      <rect x="208" y="56" width="84" height="98" rx="8" fill="#ffffff" opacity="0.7" stroke="#cbd5e1"/>
      <circle cx="250" cy="96" r="18" fill="#bbf7d0"/>
      <g transform="translate(30,22) scale(0.95)">${meta.svg}</g>
      <rect x="14" y="14" width="136" height="24" rx="12" fill="#0f172a" opacity="0.78"/>
      <text x="82" y="30" font-family="sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">${edited?"清晨高亮场景(已改)":"居家日常使用场景"}</text>
      <text x="160" y="218" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#1e293b" text-anchor="middle">${shortName} · 场景实拍构图</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  if (slotIdx === 2) {
    // 3. 功能卖点标注图
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <rect width="320" height="240" fill="#eff6ff"/>
      <g transform="translate(18,22) scale(0.9)">${meta.svg}</g>
      <line x1="168" y1="74" x2="205" y2="54" stroke="${ac}" stroke-width="2"/>
      <rect x="195" y="38" width="112" height="28" rx="8" fill="${ac}"/>
      <text x="251" y="56" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#ffffff" text-anchor="middle">核心卖点① 高效省心</text>
      <line x1="176" y1="112" x2="205" y2="112" stroke="#2563eb" stroke-width="2"/>
      <rect x="195" y="96" width="112" height="28" rx="8" fill="#1d4ed8"/>
      <text x="251" y="114" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#ffffff" text-anchor="middle">核心卖点② 耐用便携</text>
      <line x1="168" y1="146" x2="205" y2="164" stroke="#0891b2" stroke-width="2"/>
      <rect x="195" y="150" width="112" height="28" rx="8" fill="#0891b2"/>
      <text x="251" y="168" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#ffffff" text-anchor="middle">核心卖点③ 多场景用</text>
      <text x="160" y="218" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#1e3a8a" text-anchor="middle">${shortName} · 三大功能卖点图</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  if (slotIdx === 3) {
    // 4. 尺寸规格与参数标尺图
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <rect width="320" height="240" fill="#f8fafc"/>
      <path d="M0 40 H320 M0 80 H320 M0 120 H320 M0 160 H320 M80 0 V240 M160 0 V240 M240 0 V240" stroke="#e2e8f0" stroke-width="1"/>
      <g transform="translate(52,16) scale(0.88)">${meta.svg}</g>
      <line x1="78" y1="176" x2="242" y2="176" stroke="#2563eb" stroke-width="2.5"/>
      <line x1="78" y1="168" x2="78" y2="184" stroke="#2563eb" stroke-width="2.5"/>
      <line x1="242" y1="168" x2="242" y2="184" stroke="#2563eb" stroke-width="2.5"/>
      <rect x="124" y="164" width="72" height="22" rx="6" fill="#2563eb"/>
      <text x="160" y="179" font-family="sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">长 24.5 cm</text>
      <line x1="258" y1="54" x2="258" y2="154" stroke="#059669" stroke-width="2.5"/>
      <rect x="234" y="92" width="76" height="22" rx="6" fill="#059669"/>
      <text x="272" y="107" font-family="sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">净重 380g</text>
      <text x="160" y="218" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#0f172a" text-anchor="middle">${shortName} · 尺寸与净重参数图</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  // 5. 包装清单平铺图
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="#f0fdf4"/>
    <rect x="20" y="24" width="128" height="156" rx="10" fill="#ffffff" stroke="#86efac" stroke-width="2"/>
    <g transform="translate(-8,12) scale(0.74)">${meta.svg}</g>
    <text x="84" y="166" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#166534" text-anchor="middle">主机主体 ×1</text>
    <rect x="162" y="24" width="138" height="44" rx="8" fill="#ffffff" stroke="#86efac" stroke-width="1.5"/>
    <text x="231" y="50" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#1e293b" text-anchor="middle">🔌 专用配件/线材 ×1</text>
    <rect x="162" y="78" width="138" height="44" rx="8" fill="#ffffff" stroke="#86efac" stroke-width="1.5"/>
    <text x="231" y="104" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#1e293b" text-anchor="middle">📖 多语言说明书 ×1</text>
    <rect x="162" y="132" width="138" height="48" rx="8" fill="#ffffff" stroke="#86efac" stroke-width="1.5"/>
    <text x="231" y="160" font-family="sans-serif" font-size="11.5" font-weight="700" fill="#1e293b" text-anchor="middle">📦 彩盒外包装 ×1</text>
    <text x="160" y="218" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#166534" text-anchor="middle">${shortName} · 包装清单全览图</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function buildM4BatchItems(count = 120, kindLabel = "外购行业估算", srcCode = "PAID_EXTERNAL", startNum = 1001) {
  const templates = [
    { name: "折叠抽屉式衣物收纳盒", cat: "家居收纳", plat: "Amazon US", price: 24.9, band: "$15-30", buy: 4.2 },
    { name: "车载吸尘器无线迷你款", cat: "3C配件", plat: "TikTok US", price: 32.5, band: "$30-60", buy: 7.4 },
    { name: "自动感应宠物喂水器", cat: "宠物用品", plat: "Amazon US", price: 38.0, band: "$30-60", buy: 8.6 },
    { name: "便携电动咖啡研磨杯", cat: "厨房小电", plat: "Shopee TH", price: 22.8, band: "$15-30", buy: 5.5 },
    { name: "防水折叠牛津布野餐篮", cat: "户外运动", plat: "Amazon US", price: 28.9, band: "$15-30", buy: 5.1 },
    { name: "壁挂免打孔吹风机架", cat: "家居收纳", plat: "Shopee TH", price: 13.5, band: "<$15", buy: 2.3 },
    { name: "磁吸无线桌面快充座", cat: "3C配件", plat: "TikTok US", price: 29.9, band: "$15-30", buy: 6.1 },
    { name: "宠物硅胶防滑舔食垫", cat: "宠物用品", plat: "TikTok US", price: 14.2, band: "<$15", buy: 2.0 },
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    const num = startNum + i;
    const isInt = srcCode === "INTERNAL" || (srcCode === "MIXED" && i % 5 === 0);
    const isRisk = i % 9 === 4;
    const missingCost = !isInt && i % 2 === 0;
    const trend = isRisk ? -6.5 + (i % 4) : +(8 + (i * 7) % 44).toFixed(1);
    const margin = isRisk ? 6.8 : missingCost ? 12.1 : +(11.5 + ((i * 3) % 14)).toFixed(1);
    const paidQty = 450 + ((i * 137) % 1600);
    const refundQty = isRisk ? Math.round(paidQty * 0.08) : Math.round(paidQty * 0.02);
    const grossRev = +(paidQty * t.price).toFixed(2);
    const refundAmt = +(refundQty * t.price).toFixed(2);
    const stage = isRisk ? "初筛候选" : missingCost ? "临时待核价" : "初筛候选";
    const riskLevel = isRisk ? "高风险" : (i % 4 === 1 ? "中风险" : "低风险");
    const sysAdvice = isRisk
      ? { badge: "建议淘汰", tone: "p-red", reason: `退货偏高或毛利仅 ${margin}%（低于10%底线）` }
      : !isInt || missingCost
      ? { badge: "建议补成本再评", tone: "p-amber", reason: `涨势 +${trend}% 但需核清正式采购报价后再评` }
      : { badge: "建议投产", tone: "p-green", reason: `内部实盘净增 +${trend}%、毛利 ${margin}% 达标，可立即送审` };
    out.push({
      sku: `SKU-${num}`,
      name: `${t.name} #${(i % 12) + 1}`,
      category: t.cat,
      priceBand: t.band,
      unitPriceUsd: t.price,
      platform: t.plat,
      region: t.plat.includes("TH") ? "东南亚渠道" : "美区渠道",
      lifecycle: trend >= 25 ? "快速上升期" : trend < 0 ? "衰退期" : "成熟期",
      riskLevel,
      paidQty,
      refundQty,
      grossRev,
      discount: +(grossRev * 0.015).toFixed(2),
      refundAmt,
      trend,
      prevAvg: Math.round(paidQty / 8),
      currAvg: Math.round((paidQty / 8) * (1 + trend / 100)),
      marginKnown: !missingCost,
      margin,
      src: isInt ? "内部实盘选品" : kindLabel,
      srcCode: isInt ? "INTERNAL" : "PAID_EXTERNAL",
      stage,
      submitter: "吴选品(批量入池)",
      submitReason: "",
      approver: "",
      decisionReason: "",
      evidence: "",
      missing: missingCost ? "采购成本与头程费用待供应商核价" : "",
      budget: `$${Math.round(t.buy * 80 + 300)} (80件)`,
      sysAdvice,
      competition: { competitors: 18 + (i % 55), topReviews: "200~900条", priceRange: `$${(t.price*0.8).toFixed(1)} - $${(t.price*1.2).toFixed(1)}`, verdict: isRisk ? "竞争较激烈" : "竞争温和有机会" },
      supplyChain: { buyPrice: missingCost ? "待核价 (估算$" + t.buy + ")" : "$" + t.buy, moq: "50 件", leadDays: `${8 + (i % 7)} 天`, inStock: missingCost ? "待供应商报价" : "工厂现货" },
      riskDetail: { ip: isRisk ? "存在类似外观隐患" : "专利排查无冲突 ✓", cert: t.cat === "3C配件" || t.cat === "厨房小电" ? "需常规电气/带电合规核验" : "常规材质无特殊门槛 ✓", seasonal: "四季稳销", refundRate: `${((refundQty / paidQty) * 100).toFixed(1)}%` },
      timing: { seasonNote: "当前类目搜索保持活跃", stageNote: trend >= 25 ? "上升期窗口" : "常规跟进" },
      trend8w: Array.from({ length: 8 }, (_, k) => Math.max(20, Math.round((paidQty / 8) * (0.82 + (k * trend) / 700))))
    });
  }
  return out;
}

export const DEFAULT_M7_IMG_BRIEFS = [
  "纯白棚拍主图，商品主体占画面 85%，光线柔和清晰，无多余文字与促销水印。",
  "居家厨房或桌面日常使用场景，自然侧光拍摄，展示真实摆放体积与氛围感。",
  "突出核心功能卖点对比与细节特写，留白清晰便于放置 2 处卖点标注。",
  "正视视角展示产品轮廓，清晰保留长宽高尺寸与净重标注辅助线空间。",
  "俯拍平铺展示主机、电源线、说明书及附赠配件全家福清单。"
];

export function buildDefaultM7VidSegs(sku = "SKU-00704", name = "无线真空迷你封口机") {
  return [
    {
      id: 0, range: "0-5s", title: "分镜1 · 痛点引入", slot: 1,
      motion: "缓慢推近 (Zoom-In)", duration: 5,
      subEN: `Tired of daily clutter? Meet ${sku}!`,
      subCN: `还在被杂乱与受潮困扰？试试 ${name}`,
      bg: "linear-gradient(135deg,#0f172a,#1e3a8a)", ver: 1
    },
    {
      id: 1, range: "5-10s", title: "分镜2 · 核心卖点实操", slot: 2,
      motion: "卖点特写高亮", duration: 5,
      subEN: "Instant Setup · Built for Everyday Efficiency",
      subCN: "一键高效上手 · 8秒锁鲜省空间实测",
      bg: "linear-gradient(135deg,#1e293b,#065f46)", ver: 1
    },
    {
      id: 2, range: "10-15s", title: "分镜3 · 品质清单收尾", slot: 4,
      motion: "全景平移 (Pan)", duration: 5,
      subEN: "Complete Kit Included · Shop Now!",
      subCN: `全套配件开箱即用 · 立即加购 ${sku}`,
      bg: "linear-gradient(135deg,#312e81,#1e293b)", ver: 1
    },
  ];
}

export function resetM7CreationState(state, sku, prodMeta = null) {
  if (sku) state.m7Sku = sku;
  if (prodMeta?.platform) {
    state.m7Platform = prodMeta.platform.includes("Shopee") ? "虾皮泰国站" : prodMeta.platform.includes("TikTok") ? "TikTok 美区" : "亚马逊美国站";
  }
  if (prodMeta?.category) state.m7ComplianceCategory = prodMeta.category;
  state.m7ShowCN = true;
  state.m7CopyGenCount = 0;
  state.m7ResultTab = "商品标题";
  state.m7CopyEditing = false;
  state.m7CopyEditDraft = "";
  state.m7CopyEditDraftCn = "";
  state.m7SelectedOrigMap = {};
  state.m7SelectedTitle = "";
  state.m7SelectedTitleCn = "";
  state.m7SelectedBullets = "";
  state.m7SelectedBulletsCn = "";
  state.m7SelectedDesc = "";
  state.m7SelectedDescCn = "";
  state.m7SelectedKeywords = "";
  state.m7SelectedKeywordsCn = "";
  state.m7SelectedFaq = "";
  state.m7SelectedFaqCn = "";
  state.m7SelectedAplusCopy = "";
  state.m7SelectedAplusCopyCn = "";
  state.m7SelectedVariantCopy = "";
  state.m7SelectedVariantCopyCn = "";
  state.m7SelectedAttrCopy = "";
  state.m7SelectedAttrCopyCn = "";
  state.m7SelectedAltCopy = "";
  state.m7SelectedAltCopyCn = "";
  state.m7SelectedWarrantyCopy = "";
  state.m7SelectedWarrantyCopyCn = "";
  state.m7ImgWorkflow = "标准白底主图 + 4张场景卖点附图模板";
  state.m7ImgStyle = "商业棚拍质感";
  state.m7ImgAngle = "正面平视";
  state.m7ImgRatio = "1:1 电商方图";
  state.m7ImgNegatives = ["禁止水印/促销角标", "禁止乱码文字", "禁止产品外观/Logo畸变", "禁止杂乱背景反光"];
  state.m7ImgSyncCopy = true;
  state.m7ShowAdvPrompt = false;
  state.m7ImgBriefs = [...DEFAULT_M7_IMG_BRIEFS];
  state.m7ImgBrief = DEFAULT_M7_IMG_BRIEFS[0];
  state.m7ImgVersion = 0;
  state.m7PickedImgIdx = 0;
  state.m7Images = [
    { id: 0, label: "商品主图 1（白底主图）", title: "纯白棚拍主图 (主体占85%)", editNote: "待生成", done: false, edited: false },
    { id: 1, label: "商品附图 2（使用场景）", title: "居家使用场景展示", editNote: "待生成", done: false, edited: false },
    { id: 2, label: "商品附图 3（功能卖点）", title: "核心功能卖点标注", editNote: "待生成", done: false, edited: false },
    { id: 3, label: "商品附图 4（尺寸规格）", title: "尺寸规格与净重标尺", editNote: "待生成", done: false, edited: false },
    { id: 4, label: "商品附图 5（包装清单）", title: "主机与配件清单图", editNote: "待生成", done: false, edited: false },
  ];
  state.m7AplusDone = false;
  state.m7VidDone = false;
  state.m7VidPlaying = false;
  state.m7VidTimeSec = 0;
  state.m7VidLogs = [];
  state.m7VidVoice = "美式女声 · 亲和推荐";
  state.m7VidBgm = "轻快居家 Acoustic";
  state.m7VidSegs = buildDefaultM7VidSegs(state.m7Sku, prodMeta?.name || state.m7Sku);
  state.m7BuyerImgIdx = 0;
  state.m7BuyerVariantIdx = 0;
  state.m7ComplianceStatus = "待制作完成";
  state.m7ComplianceChecks = [];
  state.m7ApprovalRecord = null;
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

export const BIZ_ROLES = [
  { key: "approver", label: "主管 / 审批人", tag: "终审把关", pill: "p-red", desc: "负责终审把关：售后退款审批、选品测款拍板、补货下单审批、上架合规放行。" },
  { key: "manager", label: "大屏浏览者 / 管理者", tag: "全局管理", pill: "p-purple", desc: "全局运营管理：员工岗位授权、店铺连接管理、查看正式经营大屏、经营问答查数。" },
  { key: "planner", label: "驾驶舱设计者 / 业务运营", tag: "日常运营", pill: "p-blue", desc: "日常运营操作：调整成本变更、维护客服商品库、设计驾驶舱、执行预测与提交补货。" },
  { key: "bi_analyst", label: "数据分析 / BI 人员", tag: "指标分析", pill: "p-blue", desc: "口径与分析：管理指标口径与定时更新、参与智能问数、复用驾驶舱指标。" },
  { key: "selector", label: "选品研究员", tag: "选品研究", pill: "p-green", desc: "选品研究：负责家居收纳/宠物/厨房小电类目，评估竞品/供应链/风险并提交测款申请。" },
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
  const row = { time: t, actor: state.role, sentence, ok: entry.ok !== false, historical: false };
  state.auditLogs.unshift(row);
  if (state.auditLogs.length > 80) state.auditLogs.length = 80;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state.auditLogs));
  } catch {}
}

export function getRoleTodos(state) {
  const todos = {};
  if (state.role === "approver") {
    if (state.tickets.some(t => t.status === "待主管审批")) todos.m1c = true;
    if (state.m4Pool.some(x => x.stage === "已提交待审")) todos.m4c = true;
    if (state.m6Plans.some(p => p.status === "待主管审批")) todos.m6c = true;
    if (state.m7ComplianceStatus === "合规校验通过") todos.m7d = true;
    if (state.costChangeLogs.some(c => c.status === "待主管审批")) todos.m0b = true;
  } else if (state.role === "manager") {
    if (state.shops.some(s => evalShopHealth(s).urgent || s.mode === "MOCK")) todos.m0a = true;
    todos.m2b = true;
    todos.m8a = true;
  } else if (state.role === "planner") {
    todos.m2a = true;
    todos.m6a = true;
    if (state.inventoryItems.some(i => i.shopMode === "REAL" && i.avail < i.safety)) todos.m6b = true;
  } else if (state.role === "bi_analyst") {
    if (state.qaBindings.some(b => b.status.includes("未响应"))) todos.m3a = true;
    todos.m3b = true;
  } else if (state.role === "selector") {
    if (state.m4Pool.some(x => x.stage === "初筛候选" || x.stage === "临时待核价")) todos.m4b = true;
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

/**
 * 动态计算当前登录岗位的「今日必办事项（3-5条）」，完全从 state 真实数据实时得出
 */
export function computeRoleWorkbenchTodos(state) {
  const list = [];
  const role = state.role;

  if (role === "approver") {
    state.tickets.filter(t => t.status === "待主管审批").forEach(t => list.push({
      title: `审批售后退款工单 ${t.id}（申请退 $${t.refundAmount.toFixed(2)}）`,
      bizObj: `${t.orderNo} · 买家 ${t.buyer}`,
      source: `由「${t.submitter}」从 M1-1 核验后提交`,
      deadline: "今日 18:00 前处理（超时影响店铺绩效）",
      targetPage: "m1c", urgent: true
    }));
    state.m4Pool.filter(x => x.stage === "已提交待审").forEach(x => list.push({
      title: `终审拍板选品测款：${x.sku} ${x.name}`,
      bizObj: `${x.category} · 申请预算 ${x.budget}`,
      source: `由「${x.submitter}」从 M4-2 选品工作台送审`,
      deadline: "本周测款窗口内（批准后自动转 M5/M7）",
      targetPage: "m4c", urgent: true
    }));
    state.m6Plans.filter(p => p.status === "待主管审批").forEach(p => list.push({
      title: `审批补货下单计划 ${p.id}（${p.sku} ${p.qty}件）`,
      bizObj: `${p.shop} · 预计资金 ${p.cash}`,
      source: `由「${p.submitter}」从 ${p.mode==="SMART"?"M6-2 智能补货":"M6-1 常规补货"} 提交`,
      deadline: "今日 17:00 前下单防断货",
      targetPage: "m6c", urgent: true
    }));
    if (state.m7ComplianceStatus !== "主管已批准导出") {
      list.push({
        title: `把关商品 ${state.m7Sku} 上架前 8 项交付物并放行导出`,
        bizObj: `${state.m7Sku} · 合规状态：${state.m7ComplianceStatus}`,
        source: "来自 M7-4 内容制作团队送审",
        deadline: "上架排期前完成检查",
        targetPage: "m7d", urgent: false
      });
    }
  } else if (role === "selector") {
    const readyList = state.m4Pool.filter(x => x.stage === "初筛候选" && x.sysAdvice.badge === "建议投产");
    if (readyList.length > 0) {
      list.push({
        title: `优先送审 ${readyList.length} 款「系统建议投产」高潜新品`,
        bizObj: readyList.map(x => x.name).join("、"),
        source: "来自 M4-1 内部实盘选品导入",
        deadline: "今日下班前提交给主管拍板",
        targetPage: "m4b", urgent: true
      });
    }
    state.m4Pool.filter(x => x.stage === "临时待核价").forEach(x => list.push({
      title: `联系供应商复核正式报价：${x.sku} ${x.name}`,
      bizObj: `${x.category} · ${x.missing || "待复核正式采购与头程报价"}`,
      source: "M4-1 外购行业估算数据导入",
      deadline: "3 日内核清正式报价后再决定是否送审",
      targetPage: "m4b", urgent: false
    }));
    list.push({
      title: "导入本周最新各站点选品数据表",
      bizObj: `当前选品池共 ${state.m4Pool.length} 款候选商品`,
      source: "本周自营销售报表与行业参考榜",
      deadline: "每周一 12:00 前完成清洗导入",
      targetPage: "m4a", urgent: false
    });
  } else if (role === "cs") {
    state.csSessions.filter(s => s.status === "待人工接管").forEach(s => list.push({
      title: `人工接管高风险买家会话：${s.buyer}（${s.intent}）`,
      bizObj: `${s.shop} · 关联订单 ${s.linkedOrder || "待匹配订单"}`,
      source: "智能助手识别退款关键词自动转人工",
      deadline: "15 分钟内响应并核验四要素",
      targetPage: "m1a", urgent: true
    }));
    state.tickets.filter(t => t.status === "待上传退款凭证").forEach(t => list.push({
      title: `上传手工打款退款凭证并关闭工单：${t.id}`,
      bizObj: `订单 ${t.orderNo} · 已批退款 $${t.refundAmount.toFixed(2)}`,
      source: `主管「${t.approver}」已批准`,
      deadline: "今日完成平台后台打款并回传截图",
      targetPage: "m1c", urgent: true
    }));
    list.push({
      title: "核对本店在售导购商品库话术与链接",
      bizObj: `当前已就绪 ${state.csCatalog.length} 款本店在售商品`,
      source: "来自 M0-2 在售商品清单同步",
      deadline: "日常巡检防串店发错链接",
      targetPage: "m1b", urgent: false
    });
  } else if (role === "warehouse") {
    state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety).forEach(i => list.push({
      title: `紧急盘点与核实低库存仓位：${i.whName} ${i.sku}`,
      bizObj: `${i.name} · 当前可售 ${i.avail} 件（安全水位 ${i.safety} 件）`,
      source: "M0-3 分店分仓库存水位自动预警",
      deadline: "今日 16:00 前盘点确认并触发补货",
      targetPage: "m0c", urgent: true
    }));
    state.m6Orders.filter(o => o.status !== "全部收齐").forEach(o => list.push({
      title: `登记到货质检与分批收货凭证：${o.po}`,
      bizObj: `${o.sku} · 采购总计 ${o.totalQty} 件（当前：${o.status}）`,
      source: "来自 M6-3 主管批准生成的采购单",
      deadline: "货车到仓当日完成清点登记（登记后再去M0-3盘点）",
      targetPage: "m6d", urgent: true
    }));
    list.push({
      title: "日常巡检各海外仓账实核对与盘点留痕",
      bizObj: `共 ${state.inventoryItems.length} 条分店分仓库存记录`,
      source: "M0-3 分店分仓库存台账",
      deadline: "每周完成 1 次例行抽盘",
      targetPage: "m0c", urgent: false
    });
  } else if (role === "planner") {
    state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety).forEach(i => list.push({
      title: `处理断货风险商品补货测算：${i.sku} ${i.name}`,
      bizObj: `${i.whName} 仅剩 ${i.avail} 件（低于安全线 ${i.safety} 件）`,
      source: "M0-3 实时库存预警联动 M5/M6",
      deadline: "今日提交补货草案送主管审批",
      targetPage: state.m5ForecastRegistry[i.sku] ? "m6b" : "m6a", urgent: true
    }));
    list.push({
      title: `核对并发布最新经营驾驶舱（${state.biDraftVersion}）`,
      bizObj: `当前草稿含 ${state.biWidgets.length} 项核心经营指标`,
      source: "M3-1 指标口径与 M0 实盘订单汇总",
      deadline: "每日晨会前确认正式大屏数据一致",
      targetPage: "m2a", urgent: false
    });
    const lowMProds = state.masterProducts.filter(p => calcProductMargin(p).marginPct < 12);
    if (lowMProds.length) {
      list.push({
        title: "复核低毛利标红商品成本或调价方案",
        bizObj: lowMProds.map(p => `${p.sku} ${p.name}`).join("、"),
        source: "M0-2 商品毛利预警检测",
        deadline: "本周内完成调价或供应链降本",
        targetPage: "m0b", urgent: false
      });
    }
  } else if (role === "creator") {
    state.m4Pool.filter(x => x.stage === "已批准测款").forEach(x => list.push({
      title: `为新品制作多语言上架文案：${x.sku} ${x.name}`,
      bizObj: `${x.category} · ${x.platform}`,
      source: `来自 M4-3「${x.approver}」批准测款任务`,
      deadline: "3 日内完成文案、套图与合规送检",
      targetPage: "m7a", urgent: true
    }));
    const missingImgs = state.m7Images.filter(im => !im.done).length;
    if (missingImgs > 0) {
      list.push({
        title: `补齐商品套图缺项（还缺 ${missingImgs} 张附图）`,
        bizObj: state.m7Images.filter(im => !im.done).map(im => im.label).join("、"),
        source: "M7-4 整套交付清单缺项检测",
        deadline: "交付上架包前须补全全部 5 张套图",
        targetPage: "m7b", urgent: true
      });
    }
    if (!state.m7VidDone || !state.m7AplusDone) {
      list.push({
        title: "完成 A+ 图文 / 短视频并提交 M7-4 上架合规检查",
        bizObj: "当前 8 类交付资产尚有未就绪项",
        source: "M7 内容交付流水线",
        deadline: "提交主管把关导出前完成",
        targetPage: "m7d", urgent: false
      });
    }
  } else if (role === "manager") {
    state.shops.forEach(s => {
      const h = evalShopHealth(s);
      if (h.urgent) {
        list.push({
          title: `处理店铺预警：${s.name}（${h.badge}）`,
          bizObj: `${s.platform} · ${h.triggerText}`,
          source: "M0-1 店铺授权与健康巡检",
          deadline: "今日优先处理，防止订单断流或绩效扣分",
          targetPage: "m0a", urgent: true
        });
      }
    });
    list.push({
      title: `查看今日正式经营大屏（${state.biPublishedVersion}）与异常指标`,
      bizObj: `已接入 ${state.shops.filter(s=>s.mode==="REAL").length} 家实盘店 · 发现 ${state.inventoryItems.filter(i=>i.shopMode==="REAL"&&i.avail<i.safety).length} 项低库存预警`,
      source: "来自 M2-1 已发布大屏",
      deadline: "每日经营早会必看",
      targetPage: "m2b", urgent: true
    });
    list.push({
      title: `审核员工名册与岗位授权变更（共 ${state.employees.length} 人）`,
      bizObj: `最近审计记录 ${state.auditLogs.length} 条`,
      source: "M8 组织管理与操作审计",
      deadline: "每周复核 1 次高权限岗位配置",
      targetPage: "m8a", urgent: false
    });
  } else if (role === "bi_analyst") {
    state.qaBindings.filter(b => b.status !== "更新正常").forEach(b => list.push({
      title: `排查未响应指标数据源：${b.name}`,
      bizObj: `${b.kind} · ${b.errMsg}`,
      source: "M3-1 指标定时更新巡检",
      deadline: "配置外部数据源地址后立即重试更新",
      targetPage: "m3a", urgent: true
    }));
    list.push({
      title: "复盘 M5 销量预测误差率（WAPE）与缺货日修正",
      bizObj: `${state.m5Sku} 近期 4 天回测误差复盘`,
      source: "M5-2 历史预测与 M0-2 实盘订单对比",
      deadline: "每周校准 1 次以提升补货准度",
      targetPage: "m5c", urgent: true
    });
    list.push({
      title: "使用智能问数助手核对各平台净利率口径",
      bizObj: "与 M2 驾驶舱共用同一实盘订单事实口径",
      source: "M3-2 只读问数引擎",
      deadline: "随时响应管理层追问",
      targetPage: "m3b", urgent: false
    });
  } else if (role === "mock_buyer") {
    list.push({
      title: "发送售前商品咨询模拟消息，检验客服自动推荐",
      bizObj: "演示测试专用店铺 · 不会发真实外部消息",
      source: "M1-4 联调测试入口",
      deadline: "联调期间随时测试",
      targetPage: "m1d", urgent: true
    });
    list.push({
      title: "发送售后退款投诉模拟消息，检验敏感词人工拦截",
      bizObj: "触发转人工后可在 M1-1 核对结果",
      source: "M1-4 联调测试入口",
      deadline: "联调期间随时测试",
      targetPage: "m1d", urgent: false
    });
    list.push({
      title: "核验测试会话是否在 M1-1 明确标注「仅限联调演示」",
      bizObj: "确保测试流量与实盘订单严格隔离",
      source: "M1-4 → M1-1 联调验收",
      deadline: "每次联调测试后复核",
      targetPage: "m1a", urgent: false
    });
  }

  return list.slice(0, 5);
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
    openModuleId: "G2",
    pageId: "home",
    showAnno: false,
    lastDataRefreshAt: "10:15:00 (历史示例基线)",
    lastDataRefreshTs: null,
    asyncTasks: {},

    // M0-1
    shops: [
      { id: "shop_th", name: "Shopee 泰国主店", platform: "SHOPEE", region: "TH", mode: "REAL", health: "连接正常", status: "授权有效（演示模式）", permLabels: ["读取订单", "同步库存", "回复消息"], credMask: "尾号 8e41", lastSync: daysOffsetDateTime(0, "10:15"), lastSyncTs: null, errNote: "", monthlyGmv: 0, orderCount: 0, mainCategory: "居家小电 / 个护", owner: "张运营", currency: "THB", timezone: "UTC+7 (曼谷)", authExpireDate: daysOffsetDate(68), nextSyncAt: "每15分钟", syncFailCount: 0, openedAt: "2024-03-12", perfScore: 96, disputeRate7d: 0.4, returnRate: 1.8, lateShipRate: 0.5, policyViolations: 0, zeroOrderDays: 0 },
      { id: "shop_us", name: "TikTok Shop 美区", platform: "TIKTOK", region: "US", mode: "REAL", health: "连接正常", status: "授权有效（演示模式）", permLabels: ["读取订单", "履约发货", "回复消息"], credMask: "尾号 2c90", lastSync: daysOffsetDateTime(0, "10:12"), lastSyncTs: null, errNote: "", monthlyGmv: 0, orderCount: 0, mainCategory: "箱包出行 / 运动健身", owner: "张运营", currency: "USD", timezone: "UTC-8 (美西)", authExpireDate: daysOffsetDate(45), nextSyncAt: "每10分钟", syncFailCount: 0, openedAt: "2024-06-05", perfScore: 93, disputeRate7d: 0.8, returnRate: 2.3, lateShipRate: 0.9, policyViolations: 0, zeroOrderDays: 0 },
      { id: "shop_amz_us", name: "Amazon 美国精品店", platform: "AMAZON", region: "US", mode: "REAL", health: "授权即将过期", status: "授权将于4天后到期", permLabels: ["读取订单", "同步库存", "FBA配送查询"], credMask: "尾号 5a17", lastSync: daysOffsetDateTime(0, "09:50"), lastSyncTs: null, errNote: "授权凭证将于 4 天后过期，请尽快重新授权防断流", monthlyGmv: 0, orderCount: 0, mainCategory: "家居收纳 / 厨房小电", owner: "陈主管", currency: "USD", timezone: "UTC-5 (美东)", authExpireDate: daysOffsetDate(4), nextSyncAt: "每15分钟", syncFailCount: 0, openedAt: "2023-11-18", perfScore: 91, disputeRate7d: 1.1, returnRate: 2.9, lateShipRate: 0.4, policyViolations: 0, zeroOrderDays: 0, mailRelayOk: true, mailRelayAddr: "amz-relay-us@crosspilot.mail" },
      { id: "shop_laz_my", name: "Lazada 马来旗舰店", platform: "LAZADA", region: "MY", mode: "REAL", health: "同步异常", status: "连续同步失败3次", permLabels: ["读取订单", "同步库存"], credMask: "尾号 7f03", lastSync: daysOffsetDateTime(-1, "18:40"), lastSyncTs: null, errNote: "连续同步失败 3 次（平台限流或授权失效），请重试同步或重新授权", monthlyGmv: 0, orderCount: 0, mainCategory: "3C配件 / 居家小电", owner: "周分析", currency: "MYR", timezone: "UTC+8 (吉隆坡)", authExpireDate: daysOffsetDate(31), nextSyncAt: "待人工重试", syncFailCount: 3, openedAt: "2025-01-20", perfScore: 88, disputeRate7d: 0.9, returnRate: 2.1, lateShipRate: 1.2, policyViolations: 0, zeroOrderDays: 0 },
      { id: "shop_ebay_uk", name: "eBay 英国站", platform: "EBAY", region: "UK", mode: "REAL", health: "经营预警", status: "绩效偏低且连续4天零新单", permLabels: ["读取订单", "履约发货", "售后同步"], credMask: "尾号 3b82", lastSync: daysOffsetDateTime(-4, "09:30"), lastSyncTs: null, errNote: "绩效分 76 分（＜80）、近7天纠纷率 2.6% 且连续 4 天零新单", monthlyGmv: 0, orderCount: 0, mainCategory: "宠物用品 / 户外运动", owner: "吴选品", currency: "GBP", timezone: "UTC+0 (伦敦)", authExpireDate: daysOffsetDate(82), nextSyncAt: "每30分钟", syncFailCount: 0, openedAt: "2024-09-01", perfScore: 76, disputeRate7d: 2.6, returnRate: 5.4, lateShipRate: 3.1, policyViolations: 1, zeroOrderDays: 4 },
      { id: "shop_sp_sg", name: "Shopee 新加坡站", platform: "SHOPEE", region: "SG", mode: "REAL", health: "连接正常", status: "授权有效（演示模式）", permLabels: ["读取订单", "同步库存", "回复消息"], credMask: "尾号 9d14", lastSync: daysOffsetDateTime(0, "10:05"), lastSyncTs: null, errNote: "", monthlyGmv: 0, orderCount: 0, mainCategory: "美妆护肤 / 家居收纳", owner: "张运营", currency: "SGD", timezone: "UTC+8 (新加坡)", authExpireDate: daysOffsetDate(53), nextSyncAt: "每15分钟", syncFailCount: 0, openedAt: "2025-04-10", perfScore: 95, disputeRate7d: 0.3, returnRate: 1.4, lateShipRate: 0.3, policyViolations: 0, zeroOrderDays: 0 },
      { id: "shop_mk", name: "Amazon 演示沙盒店", platform: "AMAZON", region: "US", mode: "MOCK", health: "仅演示环境", status: "演示测试专用（不计营收）", permLabels: ["模拟买家消息", "联调测试"], credMask: "尾号 0000", lastSync: daysOffsetDateTime(0, "09:40"), lastSyncTs: null, errNote: "", monthlyGmv: 0, orderCount: 0, mainCategory: "全品类联调测试", owner: "刘测试", currency: "USD", timezone: "UTC-8 (美西)", authExpireDate: "长期有效(沙盒)", nextSyncAt: "手动联调", syncFailCount: 0, openedAt: "2025-08-01", perfScore: 100, disputeRate7d: 0, returnRate: 0, lateShipRate: 0, policyViolations: 0, zeroOrderDays: 0 },
    ],

    // M0-2
    masterSearch: "",
    masterShopFilter: "ALL",
    m0bProdPage: 1,
    orderSearch: "",
    orderShopFilter: "ALL",
    orderStatusFilter: "ALL",
    orderDateFilter: "ALL",
    orderDateCustomStart: daysOffsetDate(-14),
    orderDateCustomEnd: daysOffsetDate(0),
    m0bOrdPage: 1,
    masterProducts: [
      { sku: "BAG-108", name: "轻量通勤双肩包", cat: "箱包出行", salePriceUsd: 29.9, cost: 4.5, freight: 2.3, commissionRate: 12, lastMile: 4.8, tariff: 1.6, adCost: 5.4, returnLossRate: 2.5, listedAt: "2025-03-18", sales30d: 640, tag: "爆款", owner: "张运营", status: "在售", costSources: { cost: "义乌箱包厂报价单 Q3-2026-041", freight: "太平洋美西海运合约 #HY-2026", commission: "TikTok US 箱包类目费率表", lastMile: "UPS 美西本土配送价目表", tariff: "美国纺织箱包进口税则 12%", ad: "近30天站内广告后台摊销", ret: "近90天实盘退货率统计", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "TikTok Shop 美区", shopSku: "TT-US-88210", price: "$29.90" },
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-5521", price: "฿890" },
      ] },
      { sku: "FAN-203", name: "便携静音循环扇", cat: "居家小电", salePriceUsd: 18.5, cost: 6.2, freight: 2.4, commissionRate: 10, lastMile: 2.1, tariff: 0.8, adCost: 2.0, returnLossRate: 2.0, listedAt: "2025-05-09", sales30d: 520, tag: "爆款", owner: "张运营", status: "在售", costSources: { cost: "顺德小电厂报价单 SD-2026-118", freight: "曼谷专线陆海报价 #TH-09", commission: "Shopee TH 小电类目费率表", lastMile: "泰国极兔本土尾程协议", tariff: "泰国小电进口综合税", ad: "近30天广告花费分摊", ret: "近90天售后退损统计", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-9034", price: "฿590" },
        { shop: "Lazada 马来旗舰店", shopSku: "LZ-MY-2031", price: "RM82" },
      ] },
      { sku: "MAT-014", name: "加厚防滑瑜伽垫", cat: "运动健身", salePriceUsd: 24.9, cost: 5.5, freight: 3.1, commissionRate: 12, lastMile: 4.5, tariff: 1.3, adCost: 2.8, returnLossRate: 3.0, listedAt: "2025-04-22", sales30d: 410, tag: "爆款", owner: "张运营", status: "在售", costSources: { cost: "南通运动器材报价单 NT-2026-072", freight: "美西大件海运拼箱 #HY-2026", commission: "TikTok US 运动健身费率表", lastMile: "USPS 重货分区配送表", tariff: "美国运动器材进口税", ad: "近30天投流均摊", ret: "近90天实盘退货统计", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "TikTok Shop 美区", shopSku: "TT-US-31922", price: "$24.90" },
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-014", price: "$26.90" },
      ] },
      { sku: "COS-052", name: "焕亮保湿面霜", cat: "美妆护肤", salePriceUsd: 12.25, cost: 2.57, freight: 0.86, commissionRate: 6.0, lastMile: 0.69, tariff: 0.31, adCost: 0.88, returnLossRate: 3.0, listedAt: "2026-10-12", sales30d: 185, tag: "潜力", owner: "吴选品", status: "在售", rmbNote: "฿420≈¥88.2 · 采购¥18.5+头程¥6.2+佣金¥5.3+尾程¥5.0+关税¥2.2+广告¥6.3+退损¥2.6=成本¥46.1，毛利¥42.1 (47.7%)", costSources: { cost: "供应商报价单 Q3-2026-089 (¥18.5/件)", freight: "泰国曼谷护肤专线报价 (¥6.2/件)", commission: "Shopee 跨境类目费率表 6.0%", lastMile: "泰国曼谷本地仓尾程协议 (¥5.0/件)", tariff: "泰国化妆品进口税率 (¥2.2/件)", ad: "近30天站内搜索广告分摊 (¥6.3/件)", ret: "近30天统计区间退货损耗 3.0%", fx: `汇率基准 ${daysOffsetDate(0)} (1 USD ≈ ¥7.20 / ฿34.3)` }, mappings: [
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-1140", price: "฿420" },
        { shop: "Shopee 新加坡站", shopSku: "SP-SG-1140", price: "S$16.5" },
      ] },
      { sku: "ORG-301", name: "汽车后备箱整理箱", cat: "家居收纳", salePriceUsd: 35.5, cost: 5.4, freight: 3.8, commissionRate: 15, lastMile: 5.9, tariff: 2.1, adCost: 6.1, returnLossRate: 2.0, listedAt: "2025-07-15", sales30d: 580, tag: "爆款", owner: "陈主管", status: "在售", costSources: { cost: "义乌收纳厂报价单 YW-2026-301", freight: "美东整柜海运分摊 #AMZ-E04", commission: "Amazon US 家居类目佣金 15%", lastMile: "FBA 标准大件配送费表", tariff: "美国塑料/布艺制品税", ad: "近30天 SP 广告分摊", ret: "近90天实盘退货率 2.0%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-301", price: "$35.50" },
      ] },
      { sku: "PET-204", name: "防抓宠物汽车座垫", cat: "宠物用品", salePriceUsd: 36.8, cost: 6.1, freight: 3.5, commissionRate: 15, lastMile: 5.4, tariff: 1.8, adCost: 6.4, returnLossRate: 1.8, listedAt: "2025-08-21", sales30d: 395, tag: "潜力", owner: "吴选品", status: "在售", costSources: { cost: "江苏宠物用品厂报价 JS-2026-204", freight: "美东专线海运 #AMZ-E04", commission: "Amazon US 宠物类目佣金 15%", lastMile: "FBA 尾程配送费表", tariff: "美国宠物纺织品关税", ad: "近30天广告投放分摊", ret: "近90天退货损耗 1.8%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-204", price: "$36.80" },
        { shop: "eBay 英国站", shopSku: "EB-UK-204", price: "£28.90" },
      ] },
      { sku: "MNT-405", name: "磁吸折叠桌面支架", cat: "3C配件", salePriceUsd: 26.5, cost: 3.6, freight: 1.7, commissionRate: 12, lastMile: 3.6, tariff: 1.1, adCost: 5.8, returnLossRate: 1.5, listedAt: "2026-06-11", sales30d: 470, tag: "潜力", owner: "张运营", status: "在售", costSources: { cost: "深圳精密五金报价 SZ-2026-405", freight: "空海联运轻小件专线 #TT-US02", commission: "TikTok US 3C配件佣金 12%", lastMile: "USPS 轻小包配送表", tariff: "美国铝合金配件税", ad: "近30天短视频投流均摊", ret: "近90天退货损耗 1.5%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "TikTok Shop 美区", shopSku: "TT-US-405", price: "$26.50" },
        { shop: "Lazada 马来旗舰店", shopSku: "LZ-MY-405", price: "RM115" },
      ] },
      { sku: "VAC-704", name: "无线真空迷你封口机", cat: "家居收纳", salePriceUsd: 27.3, cost: 4.1, freight: 2.0, commissionRate: 10, lastMile: 2.6, tariff: 0.9, adCost: 5.6, returnLossRate: 2.2, listedAt: "2026-09-02", sales30d: 312, tag: "潜力", owner: "张运营", status: "在售", costSources: { cost: "宁波小电厂报价 NB-2026-704", freight: "带电空运专线 #SEA-B02", commission: "Shopee 跨境家居小电 10%", lastMile: "新加坡/泰国本土尾程", tariff: "东南亚小电进口税", ad: "近30天站内关键词广告", ret: "近90天实盘退货率 2.2%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Shopee 泰国主店", shopSku: "SP-TH-704", price: "฿850" },
        { shop: "Shopee 新加坡站", shopSku: "SP-SG-704", price: "S$35.9" },
      ] },
      { sku: "SKU-00704", name: "无线真空迷你封口机", cat: "厨房小电", salePriceUsd: 24.9, listPriceUsd: 34.9, stockQty: 180, brand: "CrossPilot Home", capacity: "12cm 封口宽幅 / 1200mAh 电池", material: "食品级 ABS + 陶瓷发热丝", color: "陶瓷白 / 哑光灰", dimensions: "4.4 × 1.8 × 1.7 in (11.2 × 4.5 × 4.2 cm)", features: "干湿两用抽气封口 · USB-C 快充 · 磁吸冰箱贴", wattage: "10W", weightLbs: "0.35 lbs", controlMethod: "一键双模触控按键", variants: [
        { name: "标准单机版 (Standard)", priceUsd: 24.9, listPriceUsd: 34.9, stock: 180 },
        { name: "旗舰礼盒装+20只真空袋 (Pro Bundle)", priceUsd: 31.9, listPriceUsd: 42.9, stock: 95 },
      ], demoNote: "演示数据", cost: 4.1, freight: 2.0, commissionRate: 15, lastMile: 3.1, tariff: 0.9, adCost: 3.5, returnLossRate: 2.0, listedAt: "2026-11-10", sales30d: 120, tag: "测款新品", owner: "张运营", status: "测款待上架", costSources: { cost: "宁波小电厂报价 NB-2026-704 (演示数据)", freight: "带电空运专线 #US-B02 (演示数据)", commission: "Amazon US 厨房小电 15%", lastMile: "FBA 轻小件尾程费", tariff: "美国小电进口税", ad: "新品测款预算摊销", ret: "同类目参考退货率 2.0%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-00704", price: "$24.90" },
      ] },
      { sku: "LMP-418", name: "便携露营氛围灯串", cat: "运动健身", salePriceUsd: 13.8, cost: 3.9, freight: 1.8, commissionRate: 15, lastMile: 3.1, tariff: 0.7, adCost: 1.4, returnLossRate: 5.5, listedAt: "2025-04-02", sales30d: 64, tag: "滞销", owner: "吴选品", status: "在售", costSources: { cost: "中山灯饰厂报价 ZS-2026-418", freight: "带电池海运专线 #UK-03", commission: "Amazon/eBay 户外佣金 15%", lastMile: "本土小包尾程费", tariff: "目的国照明税率", ad: "近30天清仓广告分摊", ret: "近90天高退货率 5.5%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "eBay 英国站", shopSku: "EB-UK-418", price: "£10.90" },
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-418", price: "$13.80" },
      ] },
      { sku: "BTL-119", name: "便携旅行分装瓶套装", cat: "箱包出行", salePriceUsd: 14.9, cost: 3.4, freight: 1.6, commissionRate: 15, lastMile: 3.8, tariff: 0.8, adCost: 2.2, returnLossRate: 3.0, listedAt: "2025-11-12", sales30d: 148, tag: "滞销", owner: "周分析", status: "在售", costSources: { cost: "台州日用品报价 TZ-2026-119", freight: "美东标准海运 #AMZ-E04", commission: "Amazon US 旅游配件 15%", lastMile: "FBA 小件配送费", tariff: "塑料制品进口税", ad: "近30天站内广告摊销", ret: "近90天实盘退货率 3.0%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-119", price: "$14.90" },
        { shop: "Shopee 新加坡站", shopSku: "SP-SG-119", price: "S$19.9" },
      ] },
      { sku: "KET-502", name: "折叠硅胶电热水壶", cat: "居家小电", salePriceUsd: 31.0, cost: 6.4, freight: 2.8, commissionRate: 12, lastMile: 4.2, tariff: 1.4, adCost: 5.2, returnLossRate: 2.0, listedAt: "2026-03-25", sales30d: 265, tag: "潜力", owner: "陈主管", status: "在售", costSources: { cost: "佛山电器报价单 FS-2026-502", freight: "新马直达海运 #MY-01", commission: "Shopee/eBay 家电佣金 12%", lastMile: "新马英国本土尾程", tariff: "小家电进口综合税", ad: "近30天广告花费分摊", ret: "近90天实盘退货率 2.0%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Shopee 新加坡站", shopSku: "SP-SG-502", price: "S$41.9" },
        { shop: "eBay 英国站", shopSku: "EB-UK-502", price: "£24.50" },
      ] },
      { sku: "LND-538", name: "可折叠防水洗衣篮", cat: "家居收纳", salePriceUsd: 37.5, cost: 9.8, freight: 4.5, commissionRate: 15, lastMile: 5.8, tariff: 2.1, adCost: 4.8, returnLossRate: 2.5, listedAt: "2026-10-28", sales30d: 190, tag: "潜力", owner: "吴选品", status: "在售", costSources: { cost: "临海家居布艺报价单 Q3-2026-538", freight: "美东大件海运报价 #AMZ-E06", commission: "Amazon US 家居类目费率 15%", lastMile: "FBA 标准大件尾程费", tariff: "美国纺织收纳品进口税", ad: "近30天新品启动广告分摊", ret: "同类目参考退货率 2.5%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Amazon 美国精品店", shopSku: "AMZ-US-538", price: "$37.50" },
      ] },
      { sku: "BRD-601", name: "户外防水野餐垫", cat: "运动健身", salePriceUsd: 26.0, cost: 4.6, freight: 2.5, commissionRate: 12, lastMile: 4.0, tariff: 1.1, adCost: 4.2, returnLossRate: 1.8, listedAt: "2025-06-14", sales30d: 92, tag: "滞销", owner: "吴选品", status: "在售", costSources: { cost: "杭州户外纺织报价 HZ-2026-601", freight: "英国海运专线 #UK-02", commission: "eBay UK 户外类目费率 12%", lastMile: "RoyalMail 中件配送费", tariff: "英国纺织品进口税", ad: "近30天广告花费分摊", ret: "近90天实盘退货率 1.8%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "eBay 英国站", shopSku: "EB-UK-601", price: "£20.50" },
      ] },
      { sku: "EAR-712", name: "开放式运动蓝牙耳机", cat: "3C配件", salePriceUsd: 39.9, cost: 7.2, freight: 1.8, commissionRate: 12, lastMile: 3.5, tariff: 1.6, adCost: 8.8, returnLossRate: 2.5, listedAt: "2026-07-08", sales30d: 342, tag: "潜力", owner: "周分析", status: "在售", costSources: { cost: "东莞声学厂报价单 DG-2026-712", freight: "带电空运专线 #MY-AIR", commission: "Lazada/TikTok 消费电子 12%", lastMile: "本土快递配送费", tariff: "音频类电子关税", ad: "近30天高曝光投流分摊", ret: "近90天退货损耗 2.5%", fx: `汇率基准 ${daysOffsetDate(0)}` }, mappings: [
        { shop: "Lazada 马来旗舰店", shopSku: "LZ-MY-712", price: "RM179" },
        { shop: "TikTok Shop 美区", shopSku: "TT-US-712", price: "$39.90" },
      ] },
    ],
    costChangeLogs: [
      { id: "CC-V6-2026-06", sku: "LMP-418", oldCost: 3.6, oldFreight: 1.8, newCost: 3.9, newFreight: 1.8, newCommission: 15, newLastMile: 3.1, newTariff: 0.7, newAdCost: 1.4, effectiveDate: daysOffsetDate(1), reason: "电池灯串铜线涨价，需确认是否触发低毛利调价", applicant: "张运营", approver: "", status: "待主管审批", time: daysOffsetDateTime(0, "09:45") },
      { id: "CC-V5-2026-05", sku: "BAG-108", oldCost: 4.2, oldFreight: 2.3, newCost: 4.5, newFreight: 2.3, newCommission: 12, newLastMile: 4.8, newTariff: 1.6, newAdCost: 3.2, effectiveDate: daysOffsetDate(-2), reason: "第3版成本：拉链与防水牛津布加厚升级", applicant: "张运营", approver: "陈主管", status: "已生效", time: daysOffsetDateTime(-3, "16:20") },
      { id: "CC-V4-2026-04", sku: "ORG-301", oldCost: 5.8, oldFreight: 4.1, newCost: 5.4, newFreight: 3.8, newCommission: 15, newLastMile: 5.9, newTariff: 2.1, newAdCost: 4.0, effectiveDate: daysOffsetDate(-9), reason: "整柜海运阶梯降本，单件采购及头程下降", applicant: "张运营", approver: "陈主管", status: "已生效", time: daysOffsetDateTime(-10, "14:15") },
      { id: "CC-V3-2026-03", sku: "FAN-203", oldCost: 6.5, oldFreight: 2.6, newCost: 6.2, newFreight: 2.4, newCommission: 10, newLastMile: 2.1, newTariff: 0.8, newAdCost: 2.0, effectiveDate: daysOffsetDate(-15), reason: "泰国曼谷直发物流合约续签降费", applicant: "周分析", approver: "陈主管", status: "已生效", time: daysOffsetDateTime(-16, "11:08") },
      { id: "CC-V2-2026-02", sku: "MAT-014", oldCost: 5.2, oldFreight: 3.0, newCost: 5.5, newFreight: 3.1, newCommission: 12, newLastMile: 4.5, newTariff: 1.3, newAdCost: 2.8, effectiveDate: daysOffsetDate(-24), reason: "美西港口旺季附加费调整", applicant: "张运营", approver: "陈主管", status: "已生效", time: daysOffsetDateTime(-25, "15:40") },
      { id: "CC-V1-2026-01", sku: "BAG-108", oldCost: 4.0, oldFreight: 2.1, newCost: 4.2, newFreight: 2.3, newCommission: 12, newLastMile: 4.8, newTariff: 1.6, newAdCost: 3.2, effectiveDate: daysOffsetDate(-42), reason: "第2版成本：新增15.6寸加厚电脑隔层", applicant: "吴选品", approver: "陈主管", status: "已生效", time: daysOffsetDateTime(-43, "10:05") },
    ],
    orders: [
      { orderNo: "SYN9D-005671", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Emily Carter", countryCity: "美国 · 洛杉矶", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountLocal: "$34.50", amountUsd: 34.50, amountDisplay: "$34.50", status: "已签收", trackingNo: "1Z999AA10123456784", payStatus: "已支付", source: "广告流量", disputeStatus: "售后沟通中", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-2, "14:22"), historical: true, isHistoryDemo: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-2, "14:22"), done: true },
        { step: "美西仓拣货完成", time: daysOffsetDateTime(-2, "16:10"), done: true },
        { step: "美西仓出库发货 (UPS · 1Z999AA10123456784)", time: daysOffsetDateTime(-2, "19:05"), done: true },
        { step: "买家签收完成（历史示例数据，关联 M1 客服会话）", time: daysOffsetDateTime(0, "08:40"), done: true },
      ] },
      { orderNo: "SPTH-2026-108", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Nattapong S.", countryCity: "泰国 · 曼谷", sku: "FAN-203", productName: "便携静音循环扇", qty: 2, amountLocal: "฿1,180", amountUsd: 33.80, amountDisplay: "฿1,180 ($33.80)", status: "已发货", trackingNo: "THKEX88291045", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-1, "20:10"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-1, "20:10"), done: true },
        { step: "曼谷仓拣货打包", time: daysOffsetDateTime(0, "08:20"), done: true },
        { step: "泰国极兔交运 (THKEX88291045)", time: daysOffsetDateTime(0, "09:15"), done: true },
        { step: "等待买家签收", time: "预计 1-2 日送达", done: false },
      ] },
      { orderNo: "AMZUS-77412", shop: "Amazon 美国精品店", mode: "REAL", buyer: "Michael Chen", countryCity: "美国 · 纽约", sku: "ORG-301", productName: "汽车后备箱整理箱", qty: 1, amountLocal: "$35.50", amountUsd: 35.50, amountDisplay: "$35.50", status: "已完成", trackingNo: "TBA309812744", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-6, "11:15"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-6, "11:15"), done: true },
        { step: "美东仓出库发货 (Amazon Logistics · TBA309812744)", time: daysOffsetDateTime(-6, "16:30"), done: true },
        { step: "买家签收并确认完成", time: daysOffsetDateTime(-3, "15:20"), done: true },
      ] },
      { orderNo: "TTUS-30291", shop: "TikTok Shop 美区", mode: "REAL", buyer: "David Miller", countryCity: "美国 · 西雅图", sku: "MAT-014", productName: "加厚防滑瑜伽垫", qty: 1, amountLocal: "$24.90", amountUsd: 24.90, amountDisplay: "$24.90", status: "已付款", trackingNo: "待分配物流单号", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(0, "09:50"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(0, "09:50"), done: true },
        { step: "美西仓待拣货打包", time: "处理中", done: false },
      ] },
      { orderNo: "EBUK-55201", shop: "eBay 英国站", mode: "REAL", buyer: "Oliver Grant", countryCity: "英国 · 伦敦", sku: "PET-204", productName: "防抓宠物汽车座垫", qty: 1, amountLocal: "£28.90", amountUsd: 36.80, amountDisplay: "£28.90 ($36.80)", status: "退款中", trackingNo: "RM992014421GB", payStatus: "部分冻结", source: "自然流量", disputeStatus: "物流破损争议", refundSyncStatus: "退款核实中", orderedAt: daysOffsetDateTime(-4, "17:40"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-4, "17:40"), done: true },
        { step: "发出包裹 (RoyalMail · RM992014421GB)", time: daysOffsetDateTime(-3, "10:12"), done: true },
        { step: "买家发起物流破损纠纷退款", time: daysOffsetDateTime(-1, "13:05"), done: true },
      ] },
      { orderNo: "LZMY-41082", shop: "Lazada 马来旗舰店", mode: "REAL", buyer: "Aisyah Rahman", countryCity: "马来 · 吉隆坡", sku: "EAR-712", productName: "开放式运动蓝牙耳机", qty: 1, amountLocal: "RM179", amountUsd: 39.90, amountDisplay: "RM179 ($39.90)", status: "已签收", trackingNo: "MYPOS7721903", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-3, "13:20"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-3, "13:20"), done: true },
        { step: "吉隆坡仓发货 (PosLaju · MYPOS7721903)", time: daysOffsetDateTime(-2, "09:30"), done: true },
        { step: "买家签收完成", time: daysOffsetDateTime(-1, "16:45"), done: true },
      ] },
      { orderNo: "SPSG-60912", shop: "Shopee 新加坡站", mode: "REAL", buyer: "Wei Ming Tan", countryCity: "新加坡 · 裕廊", sku: "VAC-704", productName: "无线真空迷你封口机", qty: 2, amountLocal: "S$71.8", amountUsd: 54.60, amountDisplay: "S$71.8 ($54.60)", status: "已完成", trackingNo: "SGSPX9082144", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-8, "12:15"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-8, "12:15"), done: true },
        { step: "打包交运 (SPX · SGSPX9082144)", time: daysOffsetDateTime(-8, "18:00"), done: true },
        { step: "签收完成结算", time: daysOffsetDateTime(-5, "11:10"), done: true },
      ] },
      { orderNo: "AMZUS-77488", shop: "Amazon 美国精品店", mode: "REAL", buyer: "Sarah Jenkins", countryCity: "美国 · 芝加哥", sku: "PET-204", productName: "防抓宠物汽车座垫", qty: 1, amountLocal: "$36.80", amountUsd: 36.80, amountDisplay: "$36.80", status: "已发货", trackingNo: "TBA309912004", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-1, "15:12"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-1, "15:12"), done: true },
        { step: "美东仓交运 (TBA309912004)", time: daysOffsetDateTime(0, "07:45"), done: true },
      ] },
      { orderNo: "TTUS-30315", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Jessica Lopez", countryCity: "美国 · 迈阿密", sku: "MNT-405", productName: "磁吸折叠桌面支架", qty: 2, amountLocal: "$53.00", amountUsd: 53.00, amountDisplay: "$53.00", status: "已完成", trackingNo: "USPS9400111202", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-5, "19:33"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-5, "19:33"), done: true },
        { step: "美西仓发货 (USPS9400111202)", time: daysOffsetDateTime(-4, "11:20"), done: true },
        { step: "买家签收完成", time: daysOffsetDateTime(-2, "14:05"), done: true },
      ] },
      { orderNo: "SPTH-2026-141", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Ploychanok K.", countryCity: "泰国 · 清迈", sku: "COS-052", productName: "焕亮保湿面霜", qty: 2, amountLocal: "฿840", amountUsd: 24.10, amountDisplay: "฿840 ($24.10)", status: "已完成", trackingNo: "THKEX88300112", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-10, "10:45"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-10, "10:45"), done: true },
        { step: "曼谷仓发货 (THKEX88300112)", time: daysOffsetDateTime(-9, "14:00"), done: true },
        { step: "买家签收完成", time: daysOffsetDateTime(-7, "17:20"), done: true },
      ] },
      { orderNo: "AMZUS-77502", shop: "Amazon 美国精品店", mode: "REAL", buyer: "Robert Kim", countryCity: "美国 · 达拉斯", sku: "BTL-119", productName: "便携旅行分装瓶套装", qty: 3, amountLocal: "$44.70", amountUsd: 44.70, amountDisplay: "$44.70", status: "已完成", trackingNo: "TBA310004881", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-12, "08:55"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-12, "08:55"), done: true },
        { step: "美东仓发货 (TBA310004881)", time: daysOffsetDateTime(-11, "13:40"), done: true },
        { step: "签收完成", time: daysOffsetDateTime(-9, "16:12"), done: true },
      ] },
      { orderNo: "EBUK-55238", shop: "eBay 英国站", mode: "REAL", buyer: "Amelia Hughes", countryCity: "英国 · 曼彻斯特", sku: "KET-502", productName: "折叠硅胶电热水壶", qty: 1, amountLocal: "£24.50", amountUsd: 31.00, amountDisplay: "£24.50 ($31.00)", status: "已签收", trackingNo: "RM992018874GB", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-7, "16:18"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-7, "16:18"), done: true },
        { step: "发货 (RM992018874GB)", time: daysOffsetDateTime(-6, "11:05"), done: true },
        { step: "买家签收", time: daysOffsetDateTime(-4, "14:40"), done: true },
      ] },
      { orderNo: "LZMY-41109", shop: "Lazada 马来旗舰店", mode: "REAL", buyer: "Farah Nabila", countryCity: "马来 · 槟城", sku: "FAN-203", productName: "便携静音循环扇", qty: 1, amountLocal: "RM82", amountUsd: 18.50, amountDisplay: "RM82 ($18.50)", status: "已发货", trackingNo: "MYPOS7729004", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-2, "21:14"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-2, "21:14"), done: true },
        { step: "吉隆坡仓发货 (MYPOS7729004)", time: daysOffsetDateTime(-1, "10:30"), done: true },
      ] },
      { orderNo: "SPSG-60955", shop: "Shopee 新加坡站", mode: "REAL", buyer: "Rachel Lim", countryCity: "新加坡 · 淡滨尼", sku: "KET-502", productName: "折叠硅胶电热水壶", qty: 1, amountLocal: "S$41.9", amountUsd: 31.00, amountDisplay: "S$41.9 ($31.00)", status: "已付款", trackingNo: "待打单出库", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(0, "08:15"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(0, "08:15"), done: true },
        { step: "待打包出库", time: "排队处理中", done: false },
      ] },
      { orderNo: "AMZUS-77530", shop: "Amazon 美国精品店", mode: "REAL", buyer: "Daniel Brooks", countryCity: "美国 · 奥斯汀", sku: "LMP-418", productName: "便携露营氛围灯串", qty: 1, amountLocal: "$13.80", amountUsd: 13.80, amountDisplay: "$13.80", status: "退款中", trackingNo: "TBA310099412", payStatus: "退款冻结", source: "自然流量", disputeStatus: "质量问题退货", refundSyncStatus: "待退货质检", orderedAt: daysOffsetDateTime(-15, "13:10"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-15, "13:10"), done: true },
        { step: "美东仓发货 (TBA310099412)", time: daysOffsetDateTime(-14, "16:20"), done: true },
        { step: "买家申请退货退款", time: daysOffsetDateTime(-9, "10:40"), done: true },
      ] },
      { orderNo: "TTUS-30344", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Brandon Lee", countryCity: "美国 · 圣何塞", sku: "EAR-712", productName: "开放式运动蓝牙耳机", qty: 1, amountLocal: "$39.90", amountUsd: 39.90, amountDisplay: "$39.90", status: "已签收", trackingNo: "1Z999AA10123991231", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-5, "22:08"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-5, "22:08"), done: true },
        { step: "美西仓发货 (1Z999AA10123991231)", time: daysOffsetDateTime(-4, "17:15"), done: true },
        { step: "买家签收", time: daysOffsetDateTime(-1, "11:50"), done: true },
      ] },
      { orderNo: "SPTH-2026-166", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Somchai P.", countryCity: "泰国 · 普吉", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountLocal: "฿890", amountUsd: 25.50, amountDisplay: "฿890 ($25.50)", status: "已完成", trackingNo: "THKEX88310445", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-18, "14:40"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-18, "14:40"), done: true },
        { step: "曼谷仓发货 (THKEX88310445)", time: daysOffsetDateTime(-17, "12:10"), done: true },
        { step: "买家签收并确认完成", time: daysOffsetDateTime(-14, "16:30"), done: true },
      ] },
      { orderNo: "EBUK-55269", shop: "eBay 英国站", mode: "REAL", buyer: "George Wright", countryCity: "英国 · 伯明翰", sku: "BRD-601", productName: "户外防水野餐垫", qty: 1, amountLocal: "£20.50", amountUsd: 26.00, amountDisplay: "£20.50 ($26.00)", status: "已完成", trackingNo: "RM992023109GB", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-21, "09:12"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-21, "09:12"), done: true },
        { step: "伦敦交运 (RM992023109GB)", time: daysOffsetDateTime(-20, "15:00"), done: true },
        { step: "签收完成", time: daysOffsetDateTime(-18, "10:15"), done: true },
      ] },
      { orderNo: "AMZUS-77561", shop: "Amazon 美国精品店", mode: "REAL", buyer: "Chloe Davis", countryCity: "美国 · 波士顿", sku: "ORG-301", productName: "汽车后备箱整理箱", qty: 2, amountLocal: "$71.00", amountUsd: 71.00, amountDisplay: "$71.00", status: "已完成", trackingNo: "TBA310201188", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-11, "18:22"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-11, "18:22"), done: true },
        { step: "美东仓发货 (TBA310201188)", time: daysOffsetDateTime(-10, "13:10"), done: true },
        { step: "签收完成", time: daysOffsetDateTime(-8, "15:55"), done: true },
      ] },
      { orderNo: "LZMY-41145", shop: "Lazada 马来旗舰店", mode: "REAL", buyer: "Jason Tan", countryCity: "马来 · 新山", sku: "MNT-405", productName: "磁吸折叠桌面支架", qty: 1, amountLocal: "RM115", amountUsd: 25.60, amountDisplay: "RM115 ($25.60)", status: "已完成", trackingNo: "MYPOS7731201", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-14, "11:08"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-14, "11:08"), done: true },
        { step: "吉隆坡仓发货 (MYPOS7731201)", time: daysOffsetDateTime(-13, "10:00"), done: true },
        { step: "签收完成", time: daysOffsetDateTime(-11, "17:40"), done: true },
      ] },
      { orderNo: "TTUS-30389", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Kevin White", countryCity: "美国 · 亚特兰大", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountLocal: "$29.90", amountUsd: 29.90, amountDisplay: "$29.90", status: "已发货", trackingNo: "1Z999AA10124112200", payStatus: "已支付", source: "广告流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-1, "11:45"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-1, "11:45"), done: true },
        { step: "美西仓出库 (1Z999AA10124112200)", time: daysOffsetDateTime(0, "06:30"), done: true },
      ] },
      { orderNo: "SPSG-60990", shop: "Shopee 新加坡站", mode: "REAL", buyer: "Mei Ling Ong", countryCity: "新加坡 · 宏茂桥", sku: "BTL-119", productName: "便携旅行分装瓶套装", qty: 1, amountLocal: "S$19.9", amountUsd: 14.90, amountDisplay: "S$19.9 ($14.90)", status: "已完成", trackingNo: "SGSPX9089112", payStatus: "已支付", source: "自然流量", disputeStatus: "无纠纷", refundSyncStatus: "无退款", orderedAt: daysOffsetDateTime(-24, "16:05"), historical: true, timeline: [
        { step: "买家付款完成", time: daysOffsetDateTime(-24, "16:05"), done: true },
        { step: "打包发货 (SGSPX9089112)", time: daysOffsetDateTime(-23, "10:15"), done: true },
        { step: "签收完成", time: daysOffsetDateTime(-21, "14:20"), done: true },
      ] },
      { orderNo: "AMZ-DEMO-9901", shop: "Amazon 演示沙盒店", mode: "MOCK", buyer: "Demo Tester", countryCity: "测试沙盒 · 虚拟地址", sku: "BAG-108", productName: "轻量通勤双肩包", qty: 1, amountLocal: "$29.90", amountUsd: 29.90, amountDisplay: "$29.90 (仅演示)", status: "仅演示不计营收", trackingNo: "DEMO-TRK-9901", payStatus: "沙盒模拟", source: "联调测试", disputeStatus: "无纠纷", refundSyncStatus: "仅演示", orderedAt: daysOffsetDateTime(0, "10:02"), historical: true, timeline: [
        { step: "联调测试生成模拟订单（不计真实营收）", time: daysOffsetDateTime(0, "10:02"), done: true },
      ] },
      { orderNo: "AMZ-DEMO-9902", shop: "Amazon 演示沙盒店", mode: "MOCK", buyer: "Demo Buyer 2", countryCity: "测试沙盒 · 虚拟地址", sku: "FAN-203", productName: "便携静音循环扇", qty: 2, amountLocal: "$37.00", amountUsd: 37.00, amountDisplay: "$37.00 (仅演示)", status: "仅演示不计营收", trackingNo: "DEMO-TRK-9902", payStatus: "沙盒模拟", source: "联调测试", disputeStatus: "无纠纷", refundSyncStatus: "仅演示", orderedAt: daysOffsetDateTime(-3, "15:18"), historical: true, timeline: [
        { step: "联调测试生成模拟订单（不计真实营收）", time: daysOffsetDateTime(-3, "15:18"), done: true },
      ] },
    ],

    // M0-3
    inventoryShopFilter: "ALL",
    inventoryWhFilter: "ALL",
    inventoryStatusFilter: "ALL",
    inventorySearch: "",
    m0cInvPage: 1,
    inventoryItems: [
      { id: "inv1", sku: "BAG-108", name: "轻量通勤双肩包", shopSku: "TT-US-88210", shopName: "TikTok Shop 美区", shopMode: "REAL", whId: "US-WH-2", whName: "美国美西海外仓", avail: 18, inTransit: 120, locked: 9, pendingQc: 15, safety: 45, dailySales: 12, ageDays: 14, lastMoveAt: daysOffsetDateTime(0, "06:30"), turnoverDays: 12, storageFeeRate: 0.45, note: "美西仓严重缺货预警" },
      { id: "inv2", sku: "BAG-108", name: "轻量通勤双肩包", shopSku: "SP-TH-5521", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 52, inTransit: 0, locked: 4, pendingQc: 0, safety: 30, dailySales: 5, ageDays: 22, lastMoveAt: daysOffsetDateTime(-1, "16:20"), turnoverDays: 18, storageFeeRate: 0.25, note: "即将断货缓冲期" },
      { id: "inv3", sku: "FAN-203", name: "便携静音循环扇", shopSku: "SP-TH-9034", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 43, inTransit: 200, locked: 12, pendingQc: 25, safety: 60, dailySales: 8, ageDays: 19, lastMoveAt: daysOffsetDateTime(0, "09:15"), turnoverDays: 15, storageFeeRate: 0.30, note: "泰国仓季节热销低于安全线" },
      { id: "inv4", sku: "MAT-014", name: "加厚防滑瑜伽垫", shopSku: "TT-US-31922", shopName: "TikTok Shop 美区", shopMode: "REAL", whId: "US-WH-2", whName: "美国美西海外仓", avail: 180, inTransit: 60, locked: 14, pendingQc: 0, safety: 50, dailySales: 7, ageDays: 28, lastMoveAt: daysOffsetDateTime(-1, "11:40"), turnoverDays: 26, storageFeeRate: 0.55, note: "库存健康" },
      { id: "inv5", sku: "COS-052", name: "焕亮保湿面霜", shopSku: "SP-TH-1140", shopName: "Shopee 泰国主店", shopMode: "REAL", whId: "TH-WH-1", whName: "泰国曼谷本地仓", avail: 48, inTransit: 0, locked: 6, pendingQc: 10, safety: 25, dailySales: 4, ageDays: 35, lastMoveAt: daysOffsetDateTime(-2, "14:10"), turnoverDays: 20, storageFeeRate: 0.20, note: "美妆热销补货观察中" },
      { id: "inv6", sku: "ORG-301", name: "汽车后备箱整理箱", shopSku: "AMZ-US-301", shopName: "Amazon 美国精品店", shopMode: "REAL", whId: "US-WH-1", whName: "美国美东海外仓", avail: 92, inTransit: 150, locked: 18, pendingQc: 0, safety: 80, dailySales: 11, ageDays: 18, lastMoveAt: daysOffsetDateTime(0, "07:45"), turnoverDays: 16, storageFeeRate: 0.65, note: "覆盖8.4天即将断货" },
      { id: "inv7", sku: "PET-204", name: "防抓宠物汽车座垫", shopSku: "AMZ-US-204", shopName: "Amazon 美国精品店", shopMode: "REAL", whId: "US-WH-1", whName: "美国美东海外仓", avail: 210, inTransit: 0, locked: 11, pendingQc: 0, safety: 60, dailySales: 9, ageDays: 25, lastMoveAt: daysOffsetDateTime(-1, "15:12"), turnoverDays: 23, storageFeeRate: 0.58, note: "库存健康" },
      { id: "inv8", sku: "MNT-405", name: "磁吸折叠桌面支架", shopSku: "TT-US-405", shopName: "TikTok Shop 美区", shopMode: "REAL", whId: "US-WH-2", whName: "美国美西海外仓", avail: 42, inTransit: 100, locked: 15, pendingQc: 20, safety: 70, dailySales: 10, ageDays: 12, lastMoveAt: daysOffsetDateTime(-2, "11:20"), turnoverDays: 10, storageFeeRate: 0.35, note: "不足5天严重缺货" },
      { id: "inv9", sku: "MNT-405", name: "磁吸折叠桌面支架", shopSku: "LZ-MY-405", shopName: "Lazada 马来旗舰店", shopMode: "REAL", whId: "MY-WH-1", whName: "马来吉隆坡仓", avail: 145, inTransit: 0, locked: 5, pendingQc: 0, safety: 40, dailySales: 6, ageDays: 31, lastMoveAt: daysOffsetDateTime(-3, "10:00"), turnoverDays: 24, storageFeeRate: 0.22, note: "库存健康" },
      { id: "inv10", sku: "VAC-704", name: "无线真空迷你封口机", shopSku: "SP-SG-704", shopName: "Shopee 新加坡站", shopMode: "REAL", whId: "MY-WH-1", whName: "马来吉隆坡仓", avail: 164, inTransit: 80, locked: 8, pendingQc: 12, safety: 50, dailySales: 6, ageDays: 16, lastMoveAt: daysOffsetDateTime(-1, "09:10"), turnoverDays: 27, storageFeeRate: 0.28, note: "库存健康" },
      { id: "inv11", sku: "LMP-418", name: "便携露营氛围灯串", shopSku: "AMZ-US-418", shopName: "Amazon 美国精品店", shopMode: "REAL", whId: "US-WH-1", whName: "美国美东海外仓", avail: 136, inTransit: 0, locked: 2, pendingQc: 0, safety: 30, dailySales: 2, ageDays: 118, lastMoveAt: daysOffsetDateTime(-9, "10:40"), turnoverDays: 68, storageFeeRate: 0.42, note: "库龄118天滞销积压" },
      { id: "inv12", sku: "BTL-119", name: "便携旅行分装瓶套装", shopSku: "AMZ-US-119", shopName: "Amazon 美国精品店", shopMode: "REAL", whId: "US-WH-1", whName: "美国美东海外仓", avail: 94, inTransit: 0, locked: 3, pendingQc: 0, safety: 40, dailySales: 4, ageDays: 96, lastMoveAt: daysOffsetDateTime(-11, "13:40"), turnoverDays: 34, storageFeeRate: 0.30, note: "库龄96天滞销积压" },
      { id: "inv13", sku: "KET-502", name: "折叠硅胶电热水壶", shopSku: "SP-SG-502", shopName: "Shopee 新加坡站", shopMode: "REAL", whId: "MY-WH-1", whName: "马来吉隆坡仓", avail: 65, inTransit: 90, locked: 7, pendingQc: 15, safety: 55, dailySales: 6, ageDays: 29, lastMoveAt: daysOffsetDateTime(0, "08:15"), turnoverDays: 19, storageFeeRate: 0.36, note: "覆盖10.8天即将断货" },
      { id: "inv14", sku: "BRD-601", name: "户外防水野餐垫", shopSku: "EB-UK-601", shopName: "eBay 英国站", shopMode: "REAL", whId: "US-WH-1", whName: "美国美东海外仓", avail: 112, inTransit: 0, locked: 1, pendingQc: 0, safety: 25, dailySales: 3, ageDays: 105, lastMoveAt: daysOffsetDateTime(-18, "10:15"), turnoverDays: 42, storageFeeRate: 0.48, note: "库龄105天滞销积压" },
      { id: "inv15", sku: "EAR-712", name: "开放式运动蓝牙耳机", shopSku: "LZ-MY-712", shopName: "Lazada 马来旗舰店", shopMode: "REAL", whId: "MY-WH-1", whName: "马来吉隆坡仓", avail: 78, inTransit: 100, locked: 9, pendingQc: 18, safety: 60, dailySales: 9, ageDays: 21, lastMoveAt: daysOffsetDateTime(-2, "16:45"), turnoverDays: 14, storageFeeRate: 0.32, note: "覆盖8.7天即将断货" },
    ],
    stocktakes: [
      { sheetId: "PD-2026-005", whName: "泰国曼谷本地仓", sku: "FAN-203", before: 45, after: 43, delta: -2, diffType: "盘亏", reviewer: "张运营", poNo: "PO-20261119-03", coverBefore: "5.6天", coverAfter: "5.4天", m5Before: 488, m5After: 490, m6Before: 615, m6After: 617, reason: "历史示例数据：盘点发现2件外箱破损转残次", who: "赵仓管", time: daysOffsetDateTime(0, "08:20") },
      { sheetId: "PD-2026-004", whName: "美国美西海外仓", sku: "BAG-108", before: 21, after: 18, delta: -3, diffType: "盘亏", reviewer: "陈主管", poNo: "无关联采购单", coverBefore: "1.8天", coverAfter: "1.5天", m5Before: 614, m5After: 617, m6Before: 249, m6After: 252, reason: "复核发现3件拉链瑕疵退库隔离", who: "赵仓管", time: daysOffsetDateTime(-2, "16:40") },
      { sheetId: "PD-2026-003", whName: "美国美东海外仓", sku: "ORG-301", before: 86, after: 92, delta: 6, diffType: "盘盈", reviewer: "张运营", poNo: "PO-20261108-01", coverBefore: "7.8天", coverAfter: "8.4天", m5Before: 310, m5After: 304, m6Before: 164, m6After: 158, reason: "清点角落托盘找回多装入库6件", who: "赵仓管", time: daysOffsetDateTime(-5, "14:15") },
      { sheetId: "PD-2026-002", whName: "马来吉隆坡仓", sku: "VAC-704", before: 164, after: 164, delta: 0, diffType: "账实相符", reviewer: "陈主管", poNo: "PO-20261102-04", coverBefore: "27.3天", coverAfter: "27.3天", m5Before: 120, m5After: 120, m6Before: 0, m6After: 0, reason: "月度例行抽盘账实完全一致", who: "赵仓管", time: daysOffsetDateTime(-8, "11:30") },
      { sheetId: "PD-2026-001", whName: "美国美东海外仓", sku: "LMP-418", before: 140, after: 136, delta: -4, diffType: "盘亏", reviewer: "周分析", poNo: "无关联采购单", coverBefore: "70.0天", coverAfter: "68.0天", m5Before: 0, m5After: 0, m6Before: 0, m6After: 0, reason: "滞销仓长期存放4件灯珠受潮报废", who: "赵仓管", time: daysOffsetDateTime(-12, "15:05") },
    ],

    // M1
    csViewMode: "queue",
    csShopFilter: "ALL",
    csActiveId: "cs1",
    csTakeoverMap: {
      cs1: { who: "待客服接管", at: "尚未接管" },
      cs4: { who: "待客服接管", at: "尚未接管" },
      cs2: { who: "智能客服自动接待", at: "10:15:00" },
      cs5: { who: "智能客服自动接待", at: "10:08:00" },
      cs3: { who: "智能客服自动接待", at: "09:50:00" },
    },
    csSessions: [
      {
        id: "cs1", shop: "TikTok Shop 美区", mode: "REAL", buyer: "Emily Carter",
        bizType: "售后退换赔", intent: "收到包裹划痕 · 买家已提交仅退款清单", status: "待人工接管",
        serviceMode: "WAIT_HUMAN", conf: "88%",
        kbHit: "",
        handoffReason: "买家点击【申请退款/退换货】提交仅退款 $34.50 并上传 2 张实拍照片，触发资金赔付熔断转人工",
        linkedOrder: "SYN9D-005671", linkVerified: false, linkChecks: { buyer: true, amount: true, product: true, time: true },
        buyerAfterSales: {
          submitted: true,
          afterSalesType: "仅退款（不退货）",
          goodsStatus: "已收到货（已拆封验货）",
          reasonCategory: "商品破损或划痕",
          amountUsd: 34.50,
          note: "外箱压扁且背包正面有明显划痕，希望直接退款 $34.50",
          photos: [
            { kind: "scratch", label: "商品正面划痕特写.jpg" },
            { kind: "box", label: "破损外箱+快递面单.jpg" },
          ],
          submittedAt: daysOffsetDateTime(0, "10:16")
        },
        msgs: [
          { who: "buyer", text: "Hello, my package arrived with a scratch. I submitted a refund request of $34.50 with photos.", trans: "买家译文：您好，收到的包裹有划痕，我已上传照片并申请退款 $34.50。" },
          { who: "ai", text: "熔断提示：检测到买家提交售后退款清单与举证照片，智能助手已停止自动答复并转交人工坐席。", trans: "请人工接管核对照片与订单四要素，并填写初审结论转主管审批" },
        ],
        draftZh: "非常抱歉给您带来不便，已收到您上传的破损实拍照片与 $34.50 退款申请，我已加急核验并提交主管审核。",
        draftEn: "We sincerely apologize for the inconvenience. We have received your damage photos and $34.50 refund request, and escalated it for priority review."
      },
      {
        id: "cs4", shop: "TikTok Shop 美区", mode: "REAL", buyer: "David Miller",
        bizType: "物流履约异常", intent: "发货催单与清关超期咨询", status: "待人工接管",
        serviceMode: "WAIT_HUMAN", conf: "76%",
        kbHit: "",
        handoffReason: "识别到「催单/待拣货超期」且AI置信度仅 76%（低于85%自动发送阈值），转人工跟进仓库",
        linkedOrder: "TTUS-30291", linkVerified: true, linkChecks: { buyer: true, amount: true, product: true, time: true },
        buyerAfterSales: null,
        msgs: [
          { who: "buyer", text: "Order TTUS-30291 was paid earlier today, why is tracking still pending?", trans: "买家译文：订单 TTUS-30291 今天已付款，为什么还没看到物流单号？" },
          { who: "ai", text: "转人工说明：已关联订单 TTUS-30291（美西仓待拣货打包），因涉及履约催办已排队待人工客服跟进确认出库时间。", trans: "建议客服查询仓库波次后回复买家预计发货时间" },
        ],
        draftZh: "您好，订单 TTUS-30291（加厚防滑瑜伽垫）已进入美西仓今日下午拣货波次，预计今天 18:00 前生成 UPS 运单号并同步给您。",
        draftEn: "Hello! Your order TTUS-30291 is scheduled for afternoon picking at our US West warehouse and your UPS tracking number will be updated before 6:00 PM today."
      },
      {
        id: "cs2", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Nattapong S.",
        bizType: "售前导购", intent: "售前尺寸与防泼水咨询", status: "智能自动接待",
        serviceMode: "AI_AUTO", conf: "94%",
        kbHit: "导购库 · BAG-108 防泼水牛津布与15.6寸电脑仓说明",
        handoffReason: "",
        linkedOrder: "", linkVerified: false, linkChecks: { buyer: false, amount: false, product: false, time: false },
        buyerAfterSales: null,
        msgs: [
          { who: "buyer", text: "Is BAG-108 waterproof for rainy commuting?", trans: "买家译文：BAG-108 这款双肩包雨天通勤防泼水吗？" },
          { who: "ai", text: "匹配本店导购库：轻量通勤双肩包采用防泼水牛津布，可装 15.6 寸电脑，售价 ฿890。", trans: "知识来源：M1-2 导购词典（置信度 94%，已自动发送）" },
        ],
        draftZh: "您好，BAG-108 采用高密度防泼水面料，可容纳 15.6 寸笔记本电脑，本店售价 ฿890。",
        draftEn: "Hello! BAG-108 uses water-resistant fabric and fits a 15.6-inch laptop, priced at ฿890 in our store."
      },
      {
        id: "cs5", shop: "Shopee 泰国主店", mode: "REAL", buyer: "Ploy K.",
        bizType: "使用说明与排障", intent: "循环扇拆洗步骤与红灯闪烁排障", status: "智能自动接待",
        serviceMode: "AI_AUTO", conf: "96%",
        kbHit: "说明书FAQ · FAN-203 前网罩拆洗与充电红灯提示",
        handoffReason: "",
        linkedOrder: "SPTH-2026-108", linkVerified: true, linkChecks: { buyer: true, amount: true, product: true, time: true },
        buyerAfterSales: null,
        msgs: [
          { who: "buyer", text: "How do I remove the front cover of FAN-203 to clean, and why does the red indicator blink?", trans: "买家译文：FAN-203 循环扇前网罩怎么拆下来清洗？充电时红灯闪烁正常吗？" },
          { who: "ai", text: "已命中 M1-2 使用说明库：① 断电后逆时针轻旋前网罩即可取下水洗（机身后壳勿浸水）；② 充电时红灯慢闪表示正在快充中，充满后自动转绿灯常亮，属于正常现象。", trans: "知识来源：FAN-203 官方使用说明书 FAQ（置信度 96%，无需人工介入）" },
        ],
        draftZh: "您好，FAN-203 前网罩可断电后逆时针旋转拆洗；充电时红灯慢闪属正常充电提示，充满后转绿灯。",
        draftEn: "Hi! Power off FAN-203 and twist the front grille counter-clockwise to wash. A slow blinking red light means normal charging and turns solid green when full."
      },
      {
        id: "cs3", shop: "Amazon 演示沙盒店", mode: "MOCK", buyer: "Demo Buyer (测试)",
        bizType: "联调测试", intent: "联调测试咨询", status: "仅限联调演示",
        serviceMode: "AI_AUTO", conf: "91%",
        kbHit: "导购库 · BAG-108 (沙盒联调)",
        handoffReason: "",
        linkedOrder: "AMZ-DEMO-9901", linkVerified: true, linkChecks: { buyer: true, amount: true, product: true, time: true },
        buyerAfterSales: null,
        msgs: [
          { who: "buyer", text: "Hi, is this commuter backpack suitable for 15-inch laptops?", trans: "测试译文：这款通勤包适合放 15 寸电脑吗？" },
          { who: "ai", text: "测试回执：已命中导购库轻量通勤双肩包，本消息来自联调模拟入口，不计入实盘统计。", trans: "仅联调演示" },
        ],
        draftZh: "您好（测试模式），该双肩包适合 15.6 寸电脑。",
        draftEn: "Hello (Demo), this backpack fits laptops up to 15.6 inches."
      }
    ],
    csCatalog: [
      { sku: "BAG-108", name: "轻量通勤双肩包", docType: "商品导购", shop: "TikTok Shop 美区", domain: "tiktok.com/shop/us-cp", price: "$29.90", status: "索引已就绪", indexErr: "", points: "防泼水牛津布 / 15.6寸独立加厚电脑仓 / 轻量化 580g / 侧袋可放700ml水杯" },
      { sku: "FAN-203", name: "便携静音循环扇", docType: "使用说明与排障FAQ", shop: "Shopee 泰国主店", domain: "shopee.co.th/cp-th", price: "฿590", status: "索引已就绪", indexErr: "", points: "【拆洗】断电逆时针旋开前网罩水洗，主机禁止浸水；【指示灯】红灯慢闪=充电中，绿灯=充满；USB-C 续航12h" },
      { sku: "MAT-014", name: "加厚防滑瑜伽垫", docType: "使用说明与排障FAQ", shop: "TikTok Shop 美区", domain: "tiktok.com/shop/us-cp", price: "$24.90", status: "索引已就绪", indexErr: "", points: "【开箱气味】环保TPE材质新拆封会有轻微原材料味，阴凉通风24小时即散；【保养】湿布擦拭勿暴晒" },
      { sku: "LMP-418", name: "便携露营氛围灯串", docType: "使用说明与排障FAQ", shop: "Amazon 美国精品店", domain: "amazon.com/dp/cp-lmp", price: "$13.80", status: "索引失败", indexErr: "上次批处理第 4 批向量写入超时，需点击右侧「重建索引」恢复检索", points: "【遥控配对】长按电池盒开关键3秒待灯闪后按遥控ON；【防水】灯珠IP65防雨，电池盒需防浸泡" },
    ],
    csImportLogs: [
      { file: "本店在售导购与说明书FAQ_11月.xlsx", shop: "全平台店铺(按店隔离)", total: 40, okCount: 40, failCount: 0, failReason: "全部校验通过，无失败行", status: "已完成 (40/40)", time: daysOffsetDateTime(0, "09:00") }
    ],
    tickets: [
      {
        id: "TK-20261119-01", orderNo: "SYN9D-005671", shop: "TikTok Shop 美区", buyer: "Emily Carter",
        sku: "BAG-108", afterSalesType: "仅退款（不退货）", goodsStatus: "已收到货（已拆封验货）",
        reasonCategory: "商品破损或划痕", reason: "收到包裹外箱变形且背包正面有明显划痕，买家申请仅退款",
        liability: "物流运输破损",
        handoffReason: "买家上传破损照片并申请全额退款 $34.50，触发资金赔付熔断转人工",
        evidencePhotos: [
          { kind: "scratch", label: "商品正面划痕特写.jpg" },
          { kind: "box", label: "破损外箱+快递面单.jpg" },
        ],
        skuCostUsd: 4.50, returnShipEstUsd: 14.20,
        csReviewSummary: "已核验订单四要素（今早 08:40 签收），划痕特写与外箱快递面单同框真实无误；该品采购成本 $4.50，退回美西仓尾程运费约 $14.20（高于货值），曾尝试协商 $10 部分补偿被买家拒绝。建议批准「仅退款」$34.50，同步凭面单向 UPS 申报破损理赔。",
        orderAmount: 34.50, refundAmount: 34.50, submitter: "李客服", approver: "待陈主管审批",
        approveNote: "", status: "待主管审批", refundSyncStatus: "未打款（待审批）", voucher: "待审批后上传打款截图"
      },
      {
        id: "TK-20261119-02", orderNo: "SPTH-2026-108", shop: "Shopee 泰国主店", buyer: "Nattapong S.",
        sku: "FAN-203", afterSalesType: "部分补偿（安抚留货）", goodsStatus: "已收到货（已拆封验货）",
        reasonCategory: "商品破损或划痕", reason: "风扇彩盒边角轻微挤压，机器功能完好，协商补偿 $8.00 留货",
        liability: "物流运输破损",
        handoffReason: "买家反馈外盒压损要求退货，人工协商改为小额补偿留货",
        evidencePhotos: [
          { kind: "box", label: "彩盒挤压照片.jpg" },
        ],
        skuCostUsd: 6.20, returnShipEstUsd: 9.80,
        csReviewSummary: "经确认循环扇开机正常仅外盒挤压，成功说服买家留货不再退回，节省双向运费 $9.80，建议补偿 $8.00。",
        orderAmount: 33.80, refundAmount: 8.00, submitter: "李客服", approver: "陈主管",
        approveNote: "留货比退运划算，同意补偿 $8.00", status: "待上传退款凭证", refundSyncStatus: "已批待手工打款", voucher: "待财务/客服上传平台退款截图"
      },
    ],

    // M2（全部从 computeLiveBusinessStats(state) 实时得出，零硬编码假数）
    biSelectedIdx: 0,
    biPreviewDevice: "desktop",
    biTheme: "classic",
    biSimulateCardFail: false,
    biDraftVersion: "草稿 v1.3",
    biPublishedVersion: "正式 v1.2",
    biPublishedAt: daysOffsetDateTime(0, "10:15") + " (实时联动实盘订单)",
    biWidgets: [
      { title: "近30日总销售额", val: "实时汇总", metricKey: "gmv", scope: "全部实盘店铺 · 实盘台账", updatedAt: "实时联动订单", color: "var(--blue-hover)" },
      { title: "近30日净利润", val: "实时汇总", metricKey: "net_profit", scope: "逐单扣减8项完整成本", updatedAt: "实时联动成本卡", color: "var(--green-text)" },
      { title: "近30日广告花费", val: "实时汇总", metricKey: "ad_spend", scope: "全部实盘订单广告分摊", updatedAt: "实时联动订单", color: "var(--amber-text)" },
    ],
    biPublishedWidgets: [
      { title: "近30日总销售额", metricKey: "gmv", val: "实时汇总", sub: "实盘台账实时汇总", scope: "全部实盘店铺" },
      { title: "实盘订单总数", metricKey: "orders_count", val: "实时汇总", sub: "已剔除演示沙盒店", scope: "全部实盘店铺" },
      { title: "广告花费与占比", metricKey: "ad_spend", val: "实时汇总", sub: "按订单广告分摊统计", scope: "全部实盘店铺" },
      { title: "净利润与净利率", metricKey: "net_profit", val: "实时汇总", sub: "逐单扣减8项成本", scope: "全部实盘店铺" },
    ],
    biPublishHistory: [
      { ver: "正式 v1.2", time: daysOffsetDateTime(0, "10:15"), by: "张运营", note: "历史示例基准：4 项核心经营指标（全部关联统一实盘数据源）", widgets: [
        { title: "近30日总销售额", metricKey: "gmv", val: "实时汇总", sub: "实盘台账实时汇总", scope: "全部实盘店铺" },
        { title: "实盘订单总数", metricKey: "orders_count", val: "实时汇总", sub: "已剔除演示沙盒店", scope: "全部实盘店铺" },
        { title: "广告花费与占比", metricKey: "ad_spend", val: "实时汇总", sub: "按订单广告分摊统计", scope: "全部实盘店铺" },
        { title: "净利润与净利率", metricKey: "net_profit", val: "实时汇总", sub: "逐单扣减8项成本", scope: "全部实盘店铺" },
      ] },
    ],

    // M3（内部汇总指标全量引用 computeLiveBusinessStats(state)）
    qaRestBaseUrl: "",
    qaBindings: [
      { metricKey: "gmv", name: "近30日总销售额", formula: "实盘订单实付金额合计 (USD)", kind: "内部汇总", platform: "全部实盘店", cron: "每 5 分钟", val: "实时汇总", status: "更新正常", lastRun: "10:15:00", nextRun: "10:20:00", errMsg: "", url: "" },
      { metricKey: "shopee_sale", name: "虾皮泰国店销售额", formula: "Shopee 泰国主店实盘订单合计 (USD折算)", kind: "内部汇总", platform: "Shopee 泰国主店", cron: "手动更新", val: "实时汇总", status: "更新正常", lastRun: "09:40:00", nextRun: "手动触发", errMsg: "", url: "" },
      { metricKey: "net_profit", name: "店铺经营净利润", formula: "逐单实付 − 采购 − 头程 − 佣金 − 尾程 − 关税 − 广告 − 退货损耗", kind: "内部汇总", platform: "全部实盘店", cron: "每 15 分钟", val: "实时汇总", status: "更新正常", lastRun: "10:00:00", nextRun: "10:15:00", errMsg: "", url: "" },
      { metricKey: "ad_spend", name: "广告投放花费", formula: "实盘订单广告分摊合计（外部广告接口待配置）", kind: "外部接口取数", platform: "Amazon US", cron: "每 5 分钟", val: "实时汇总", status: "数据源未响应", lastRun: "10:15:00", nextRun: "待重连", errMsg: "未配置外部广告数据源地址（内部仍按单品广告费分摊计算）", url: "https://广告系统示例地址/ads" },
    ],
    qaChat: [
      { role: "user", text: "各平台近30天总销售额和净利润是多少？" },
      { role: "assistant", metricLiveSummary: true, text: "已连接实盘台账实时汇总结果，下方数字与 M0-1、M2 经营大屏完全一致。", note: "统计口径：查询条件为 全部实盘店铺 · 实盘已付款订单（不含演示店铺）。", queryDesc: "查询范围：全部实盘店铺 ｜ 状态：实盘订单台账实时汇总 ｜ 模式：只读查数", feedback: null },
    ],

    // M4 Selection (完全围绕选品员实战决策重做)
    m4Tasks: [
      { file: "电商热销测试样本.xlsx", kind: "仅演示数据", scope: "20 款商品 · 8周", status: "已完成 (160条 · 仅演示)", ok: true, tag: "DEMO_ONLY", time: "2026-11-19 09:10:00" },
      { file: "行业大盘周报_10000条_nov.xlsx", kind: "外购行业估算", scope: "1,250 款商品 · 美区", status: "已完成 (估算辅助)", ok: true, tag: "ESTIMATE_ONLY", time: "2026-11-19 09:22:00" },
      { file: "内部实盘选品周报_nov.csv", kind: "内部实盘选品", scope: "6 款商品 · 美区/泰国", status: "已完成 (可送审)", ok: true, tag: "READY_REVIEW", time: "2026-11-19 09:35:00" },
    ],
    selectorAssignedCats: ["家居收纳", "宠物用品", "厨房小电"],
    m4Mode: "balanced",
    m4QuickFilter: "ALL",
    m4SortBy: "priority",
    m4ViewMode: "table",
    m4PageSize: 15,
    m4ShowAdvPanel: false,
    m4LastImportSummary: null,
    m4Tab: "ALL",
    m4CatTab: "ALL",
    m4PriceFilter: "ALL",
    m4LifecycleFilter: "ALL",
    m4RiskFilter: "ALL",
    m4Search: "",
    m4SrcFilter: "ALL",
    m4RegionFilter: "ALL",
    m4OnlyProduceReady: false,
    m4OnlyMyCats: false,
    m4CompareIds: [],
    m4Page: 1,
    m4ShowTrendPanel: false,
    m4Weights: { demand: 25, competition: 15, profit: 25, logistics: 10, compliance: 10, trend: 15 },
    m4Pool: [
      {
        sku: "SKU-00515", name: "汽车后备箱整理箱", category: "家居收纳", priceBand: "$30-60", unitPriceUsd: 35.5,
        platform: "Amazon US", region: "美区渠道", lifecycle: "快速上升期", riskLevel: "低风险",
        paidQty: 1960, refundQty: 40, grossRev: 68500, discount: 670.46, refundAmt: 1000, trend: 27.5, prevAvg: 200, currAvg: 255,
        marginKnown: true, margin: 14.2, src: "内部实盘选品", srcCode: "INTERNAL", stage: "初筛候选",
        submitter: "吴选品(待送审)", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,200 (50件)",
        sysAdvice: { badge: "建议投产", tone: "p-green", reason: "近2月卖了$6.7万、销量环比+27.5%、利润率14.2%且无侵权风险，可立即送审测款" },
        competition: { competitors: 28, topReviews: "320~850条", priceRange: "$29.9 - $42.9", verdict: "竞争温和，新链接易起量" },
        supplyChain: { buyPrice: "$5.40", moq: "50 件", leadDays: "10 天", inStock: "义乌仓现货充足" },
        riskDetail: { ip: "外观专利已排雷无命中 ✓", cert: "无带电/无认证门槛 ✓", seasonal: "四季刚需不压货 ✓", refundRate: "2.0%（远低于类目均值 4.8%）" },
        timing: { seasonNote: "年底自驾出行采购旺季临近", stageNote: "处于快速上升期，建议本周内启动首单测款" },
        trend8w: [185, 198, 204, 212, 224, 236, 246, 255]
      },
      {
        sku: "SKU-00538", name: "可折叠防水洗衣篮", category: "家居收纳", priceBand: "$30-60", unitPriceUsd: 37.5,
        platform: "Amazon US", region: "美区渠道", lifecycle: "快速上升期", riskLevel: "中风险",
        paidQty: 1580, refundQty: 30, grossRev: 58200, discount: 540, refundAmt: 1138.06, trend: 31.2, prevAvg: 170, currAvg: 223,
        marginKnown: true, margin: 11.3, src: "外购行业估算", srcCode: "PAID_EXTERNAL", stage: "临时待核价",
        submitter: "吴选品(核价中)", submitReason: "外购估算暂按同类布艺箱参考价测算", approver: "", decisionReason: "", evidence: "", missing: "同类参考采购区间 $8.5-$10.5，待供应商二次确认正式报价", budget: "$950 (40件)",
        sysAdvice: { badge: "建议补成本再评", tone: "p-amber", reason: "销量在涨(+31.2%)但系外购估算参考(暂估毛利11.3%，同类采购区间$8.5-$10.5)，核实正式报价后再评" },
        competition: { competitors: 46, topReviews: "500~1,400条", priceRange: "$25.9 - $39.9", verdict: "中度竞争，需控成本拼性价比" },
        supplyChain: { buyPrice: "$9.80 (同类参考 $8.5-$10.5)", moq: "80 件", leadDays: "14 天", inStock: "需确认布料交期" },
        riskDetail: { ip: "常规结构无专利冲突 ✓", cert: "常规纺织品无需认证 ✓", seasonal: "开学季与搬家季需求突出", refundRate: "1.9%（较稳定）" },
        timing: { seasonNote: "当前销量持续抬头，先核清正式采购报价", stageNote: "快速上升期，待复核正式采购价后决定" },
        trend8w: [152, 165, 174, 182, 194, 205, 214, 223]
      },
      {
        sku: "SKU-00299", name: "防抓宠物汽车座垫", category: "宠物用品", priceBand: "$30-60", unitPriceUsd: 36.8,
        platform: "Amazon US", region: "美区渠道", lifecycle: "成熟期", riskLevel: "低风险",
        paidQty: 1490, refundQty: 25, grossRev: 54800, discount: 410.58, refundAmt: 1200, trend: 16.6, prevAvg: 180, currAvg: 210,
        marginKnown: true, margin: 16.8, src: "内部实盘选品", srcCode: "INTERNAL", stage: "已提交待审",
        submitter: "吴选品", submitReason: "内部实单利润率 16.8%（达到 10% 门槛），无侵权风险", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,500 (60件)",
        sysAdvice: { badge: "建议投产", tone: "p-green", reason: "老牌刚需且利润率 16.8% 稳健，已完成初筛正等待主管拍板" },
        competition: { competitors: 35, topReviews: "420~1,100条", priceRange: "$28.9 - $45.0", verdict: "需求稳固，复购与口碑好" },
        supplyChain: { buyPrice: "$6.10", moq: "60 件", leadDays: "12 天", inStock: "江苏工厂常备现货" },
        riskDetail: { ip: "无品牌/外观侵权 ✓", cert: "常规用品无需特殊认证 ✓", seasonal: "全年稳定无淡季 ✓", refundRate: "1.7%（极低退货）" },
        timing: { seasonNote: "全年平稳销售", stageNote: "成熟稳健期，适合稳定现金流" },
        trend8w: [176, 180, 184, 189, 195, 201, 206, 210]
      },
      {
        sku: "SKU-00612", name: "磁吸折叠桌面支架", category: "3C配件", priceBand: "$15-30", unitPriceUsd: 26.5,
        platform: "TikTok US", region: "TikTok 美区", lifecycle: "新品期", riskLevel: "低风险",
        paidQty: 1320, refundQty: 18, grossRev: 44200, discount: 300, refundAmt: 620, trend: 52.4, prevAvg: 130, currAvg: 198,
        marginKnown: true, margin: 18.5, src: "内部实盘选品", srcCode: "INTERNAL", stage: "初筛候选",
        submitter: "吴选品(待送审)", submitReason: "", approver: "", decisionReason: "", evidence: "", missing: "", budget: "$1,050 (45件)",
        sysAdvice: { badge: "建议投产", tone: "p-green", reason: "近2月增速飙升 +52.4%、利润率高达 18.5%，正值爆款爬坡黄金窗口" },
        competition: { competitors: 19, topReviews: "90~350条", priceRange: "$19.9 - $29.9", verdict: "蓝海高增，竞争对手还很少" },
        supplyChain: { buyPrice: "$3.60", moq: "45 件", leadDays: "7 天", inStock: "深圳工厂现货秒发" },
        riskDetail: { ip: "已确认外观不涉及Magsafe专利 ✓", cert: "纯结构件无电池无需认证 ✓", seasonal: "无明显季节限制 ✓", refundRate: "1.4%（极低）" },
        timing: { seasonNote: "短视频带货热度正起", stageNote: "新品爆发早期，抓紧窗口抢占坑位" },
        trend8w: [115, 126, 138, 148, 162, 175, 186, 198]
      },
      {
        sku: "SKU-00704", name: "无线真空迷你封口机", category: "厨房小电", priceBand: "$15-30", unitPriceUsd: 27.3,
        platform: "Shopee TH", region: "Shopee 泰国", lifecycle: "快速上升期", riskLevel: "中风险",
        paidQty: 980, refundQty: 22, grossRev: 26800, discount: 200, refundAmt: 450, trend: 19.8, prevAvg: 111, currAvg: 133,
        marginKnown: true, margin: 15.1, src: "内部实盘选品", srcCode: "INTERNAL", stage: "已批准测款",
        submitter: "吴选品", submitReason: "东南亚热销轻小件，利润率 15.1%", approver: "陈主管", decisionReason: "实盘利润率达标，同意首批 80 件测款", evidence: "测款核价单_SKU704.pdf", missing: "", budget: "$880 (80件)",
        sysAdvice: { badge: "建议投产", tone: "p-green", reason: "已获主管批准首批 80 件测款，东南亚厨房小件增速稳、毛利 15.1%" },
        competition: { competitors: 24, topReviews: "150~600条", priceRange: "$18.5 - $29.0", verdict: "类目中等偏蓝海" },
        supplyChain: { buyPrice: "$4.10", moq: "80 件", leadDays: "9 天", inStock: "宁波工厂备货充足" },
        riskDetail: { ip: "公模无侵权 ✓", cert: "含锂电池需走空运带电专线", seasonal: "全年刚需 ✓", refundRate: "2.2%（正常范围）" },
        timing: { seasonNote: "泰国雨季食物防潮需求旺盛", stageNote: "已正式进入下游预测与上架制作" },
        trend8w: [104, 108, 112, 118, 122, 127, 130, 133]
      },
      {
        sku: "SKU-00418", name: "便携露营氛围灯串", category: "户外运动", priceBand: "<$15", unitPriceUsd: 13.8,
        platform: "Amazon US", region: "美区渠道", lifecycle: "衰退期", riskLevel: "高风险",
        paidQty: 610, refundQty: 45, grossRev: 14200, discount: 180, refundAmt: 920, trend: -8.4, prevAvg: 83, currAvg: 76,
        marginKnown: true, margin: 6.2, src: "外购行业估算", srcCode: "PAID_EXTERNAL", stage: "已淘汰",
        submitter: "吴选品", submitReason: "对比样本", approver: "陈主管", decisionReason: "利润率低于 10% 且销量下滑，决定淘汰", evidence: "比价淘汰记录.xlsx", missing: "利润率低于10%且趋势下滑", budget: "不投产 (预算 $0)",
        sysAdvice: { badge: "建议放弃", tone: "p-red", reason: "利润率仅 6.2%（不达10%底线）且销量下滑 -8.4%，退货率偏高" },
        competition: { competitors: 120, topReviews: "2,000+条", priceRange: "$9.9 - $15.9", verdict: "严重红海价格战" },
        supplyChain: { buyPrice: "$2.90", moq: "200 件", leadDays: "15 天", inStock: "需排产" },
        riskDetail: { ip: "外观同质化高", cert: "户外防水与电池安全风险", seasonal: "强季节性，入冬迅速下滑", refundRate: "7.4%（严重偏高）" },
        timing: { seasonNote: "露营旺季已过，进入衰退期", stageNote: "已淘汰归档" },
        trend8w: [92, 89, 86, 84, 82, 80, 78, 76]
      },
    ],

    // M5
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
    m5ForecastRegistry: {
      "BAG-108": true, "FAN-203": true, "MAT-014": true, "COS-052": true,
      "ORG-301": true, "PET-204": true, "MNT-405": true, "VAC-704": true,
      "LMP-418": true, "BTL-119": true, "KET-502": true, "LND-538": true,
      "BRD-601": true, "EAR-712": true, "NEW-901": false
    },

    // M6
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

    // M7（默认 0/8 待创作状态，支持从第 1 步走到第 4 步并随时重置）
    m7Sku: "SKU-00704",
    m7Platform: "亚马逊美国站",
    m7Lang: "English (US)",
    m7ShowCN: true,
    m7MustTerm: "Portable, Cordless, Vacuum Sealer",
    m7BanTerm: "Best, #1, Miracle, Free",
    m7CopyGenCount: 0,
    m7ResultTab: "商品标题",
    m7CopyEditing: false,
    m7CopyEditDraft: "",
    m7CopyEditDraftCn: "",
    m7SelectedOrigMap: {},
    m7SelectedTitle: "",
    m7SelectedTitleCn: "",
    m7SelectedBullets: "",
    m7SelectedBulletsCn: "",
    m7SelectedDesc: "",
    m7SelectedDescCn: "",
    m7SelectedKeywords: "",
    m7SelectedKeywordsCn: "",
    m7SelectedFaq: "",
    m7SelectedFaqCn: "",
    m7SelectedAplusCopy: "",
    m7SelectedAplusCopyCn: "",
    m7SelectedVariantCopy: "",
    m7SelectedVariantCopyCn: "",
    m7SelectedAttrCopy: "",
    m7SelectedAttrCopyCn: "",
    m7SelectedAltCopy: "",
    m7SelectedAltCopyCn: "",
    m7SelectedWarrantyCopy: "",
    m7SelectedWarrantyCopyCn: "",

    m7ImgWorkflow: "标准白底主图 + 4张场景卖点附图模板",
    m7ImgStyle: "商业棚拍质感",
    m7ImgAngle: "正面平视",
    m7ImgRatio: "1:1 电商方图",
    m7ImgNegatives: ["禁止水印/促销角标", "禁止乱码文字", "禁止产品外观/Logo畸变", "禁止杂乱背景反光"],
    m7ImgSyncCopy: true,
    m7ShowAdvPrompt: false,
    m7ImgBriefs: [...DEFAULT_M7_IMG_BRIEFS],
    m7ImgBrief: DEFAULT_M7_IMG_BRIEFS[0],
    m7ImgVersion: 0,
    m7PickedImgIdx: 0,
    m7Images: [
      { id: 0, label: "商品主图 1（白底主图）", title: "纯白棚拍主图 (主体占85%)", editNote: "待生成", done: false, edited: false },
      { id: 1, label: "商品附图 2（使用场景）", title: "居家使用场景展示", editNote: "待生成", done: false, edited: false },
      { id: 2, label: "商品附图 3（功能卖点）", title: "核心功能卖点标注", editNote: "待生成", done: false, edited: false },
      { id: 3, label: "商品附图 4（尺寸规格）", title: "尺寸规格与净重标尺", editNote: "待生成", done: false, edited: false },
      { id: 4, label: "商品附图 5（包装清单）", title: "主机与配件清单图", editNote: "待生成", done: false, edited: false },
    ],
    m7AplusDone: false,
    m7VidType: "产品展示",
    m7VidWorkflow: "模拟已配置视频服务（可播放分镜演示）",
    m7VidDone: false,
    m7VidPlaying: false,
    m7VidTimeSec: 0,
    m7VidLogs: [],
    m7VidVoice: "美式女声 · 亲和推荐",
    m7VidBgm: "轻快居家 Acoustic",
    m7VidSegs: buildDefaultM7VidSegs("SKU-00704", "无线真空迷你封口机"),
    m7BuyerImgIdx: 0,
    m7BuyerVariantIdx: 0,
    m7PreviewTab: "主图/附图",
    m7ComplianceStatus: "待制作完成",
    m7ComplianceCategory: "厨房小电",
    m7AiPersonInAsset: true,
    m7IptcWritten: true,
    m7IptcDamagedByCrop: false,
    m7CertRecords: [
      { id: "CERT-01", name: "厨房电器安全检测报告 (UL/CE)", owner: "陈主管", expireDate: daysOffsetDate(112), status: "有效" },
      { id: "CERT-02", name: "CrossPilot 自有品牌授权书", owner: "王总监", expireDate: daysOffsetDate(45), status: "有效" },
    ],
    m7TiktokDeposit: { shop: "TikTok 美区", depositUsd: 500, status: "保证金充足 · 无违规扣分", violationPoints: 0, dataUpdatedAt: daysOffsetDateTime(0, "09:30") },
    m7GpuPool: [
      { id: "GPU-节点01", model: "RTX 4090 (24GB)", vramUsed: "14.2 / 24 GB", queue: 1, healthy: true, ver: "ComfyUI 0.3.2" },
      { id: "GPU-节点02", model: "L40S 备用节点 (48GB)", vramUsed: "6.0 / 48 GB", queue: 0, healthy: true, ver: "ComfyUI 0.3.2" },
    ],
    m7ActiveWorkflowVer: "WF-IMG-v2.1",
    m7WorkflowRegistry: [
      { id: "WF-IMG-v2.1", name: "电商白底+场景套图标准版", platform: "Amazon / TikTok / Shopee", vramNeed: "12 GB", complianceNode: "EU_AI_Label 终节点写入", status: "已发布" },
      { id: "WF-IMG-v2.0", name: "上一版精修稳定备份", platform: "全平台通用", vramNeed: "10 GB", complianceNode: "EU_AI_Label 终节点写入", status: "可回滚备用" },
      { id: "WF-VID-v1.2", name: "15秒种草短视频分镜拼接流", platform: "TikTok / Amazon", vramNeed: "18 GB", complianceNode: "视频片尾标识节点", status: "待接入算力" },
    ],
    m7BatchJobs: [
      { sku: "SKU-00704", name: "无线真空迷你封口机", node: "GPU-节点01", wf: "WF-IMG-v2.1", seed: "8492017", status: "已完成 (5/5图)", ok: true },
      { sku: "BAG-108", name: "轻量通勤双肩包", node: "GPU-节点02", wf: "WF-IMG-v2.1", seed: "3910442", status: "已完成 (5/5图)", ok: true },
      { sku: "FAN-203", name: "便携静音循环扇", node: "GPU-节点01", wf: "WF-IMG-v2.1", seed: "5520189", status: "单品失败(显存超限)，不影响前两项结果", ok: false },
    ],
    m7ComplianceChecks: [],
    m7ApprovalRecord: null,

    // M8
    m8RoleFilter: "ALL",
    employees: [
      { id: "EMP-101", name: "陈主管", email: "chen.sup@crosspilot.ai", role: "approver", shop: "全部实盘店铺", active: true, lastLogin: "2026-11-19 10:14" },
      { id: "EMP-102", name: "王总监", email: "wang.dir@crosspilot.ai", role: "manager", shop: "全部实盘店铺", active: true, lastLogin: "2026-11-19 09:50" },
      { id: "EMP-103", name: "张运营", email: "zhang.ops@crosspilot.ai", role: "planner", shop: "Shopee 泰国主店 + TikTok 美区", active: true, lastLogin: "2026-11-19 10:08" },
      { id: "EMP-104", name: "周分析", email: "zhou.bi@crosspilot.ai", role: "bi_analyst", shop: "全部实盘店铺 (只读统计)", active: true, lastLogin: "2026-11-19 09:32" },
      { id: "EMP-105", name: "吴选品", email: "wu.sel@crosspilot.ai", role: "selector", shop: "负责：家居收纳 / 宠物用品 / 厨房小电", active: true, lastLogin: "2026-11-19 09:15" },
      { id: "EMP-106", name: "林设计", email: "lin.art@crosspilot.ai", role: "creator", shop: "商品内容创作队列", active: true, lastLogin: "2026-11-19 08:55" },
      { id: "EMP-107", name: "赵仓管", email: "zhao.wh@crosspilot.ai", role: "warehouse", shop: "泰国曼谷本地仓 + 美国美西海外仓", active: true, lastLogin: "2026-11-19 09:42" },
      { id: "EMP-108", name: "李客服", email: "li.cs@crosspilot.ai", role: "cs", shop: "TikTok Shop 美区", active: true, lastLogin: "2026-11-19 10:18" },
      { id: "EMP-109", name: "孙客服", email: "sun.cs@crosspilot.ai", role: "cs", shop: "Shopee 泰国主店", active: true, lastLogin: "2026-11-19 09:11" },
      { id: "EMP-110", name: "刘测试", email: "liu.test@crosspilot.ai", role: "mock_buyer", shop: "仅演示沙盒", active: true, lastLogin: "2026-11-19 08:30" },
    ],
    auditLogs: loadAuditLogs(),
  };
}
