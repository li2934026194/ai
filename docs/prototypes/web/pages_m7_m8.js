import {
  BACKEND_SERVICE_URL, BIZ_ROLES, ROLE_PERSON_NAMES, DEFAULT_M7_IMG_BRIEFS, buildDefaultM7VidSegs, getProductImg, getM7SlotImg, resetM7CreationState, nowDateTimeStr, appendAuditLog
} from "./state.js";

const MATRIX_ROWS = [
  ["01 M8 员工名册与岗位授权", "★ 本组权限", "★ 全局授权", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
  ["02 M0-1 店铺连接与商品主档", "○ 查看状态", "★ 店铺授权", "◆ 成本变更", "○ 只读统计", "○ 查基础资料", "○ 查商品卖点", "○ 查商品规格", "○ 本店订单", "✕ 禁止"],
  ["03 M0-3 分店库存与盘点", "○ 查看水位", "○ 查看水位", "○ 只读参考", "○ 只读参考", "✕ 禁止", "✕ 禁止", "◆ 盘点校准", "✕ 禁止", "✕ 禁止"],
  ["04 M1-2 客服导购商品库", "○ 查看目录", "✕ 禁止", "◆ 导入维护", "✕ 禁止", "✕ 禁止", "○ 参考卖点", "✕ 禁止", "○ 检索推荐", "✕ 禁止"],
  ["05 M1-4 买家咨询模拟测试", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "○ 协同联调", "◆ 发模拟消息"],
  ["06 M1-1 客服会话与建单", "○ 查看会话", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "◆ 接管/建单", "✕ 禁止"],
  ["07 M1-3 售后审批与凭证", "✓ 批准/驳回", "○ 查统计", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "◆ 上传凭证", "✕ 禁止"],
  ["08 M2-1 驾驶舱草稿与发布", "○ 查看发布", "○ 查看发布", "◆ 调整/发布", "◆ 复用指标", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
  ["09 M2-2 正式经营大屏浏览", "○ 看大屏决策", "○ 浏览大屏", "○ 看运营效果", "○ 口径验证", "○ 看类目大盘", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
  ["10 M3-1/2 指标更新与问数", "○ 只读查数", "○ 经营查数", "○ 只读查数", "◆ 维护+问数", "○ 只读查数", "✕ 禁止", "○ 库存只读", "○ 本域只读", "✕ 禁止"],
  ["11 M4-1/2 选品导入与初筛", "○ 查看机会池", "○ 查看进展", "✕ 禁止", "○ 核验口径", "◆ 导入+初筛", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
  ["12 M4-3 选品测款终审拍板", "✓ 同意/淘汰", "○ 查看结论", "✕ 禁止", "✕ 禁止", "✕ 禁自批", "✕ 禁止", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
  ["13 M5-1~3 销量预测与复盘", "○ 复盘误差", "○ 看趋势", "◆ 画像/预测", "○ 误差修正", "○ 新品参考", "✕ 禁止", "○ 预测参考", "✕ 禁止", "✕ 禁止"],
  ["14 M6-1~4 补货审批与收货", "✓ 审批下单", "○ 看资金", "◆ 提交草案", "✕ 禁止", "✕ 禁止", "✕ 禁止", "◆ 登记收货", "✕ 禁止", "✕ 禁止"],
  ["15 M7-1~4 文案套图视频合规", "✓ 上架把关", "○ 查看成品", "○ 提卖点", "✕ 禁止", "○ 交接卖点", "◆ 制作+送检", "✕ 禁止", "✕ 禁止", "✕ 禁止"],
];

function badgeHtml(cell) {
  if (cell.startsWith("★")) return `<span class="pill p-purple">${cell}</span>`;
  if (cell.startsWith("✓")) return `<span class="pill p-red">${cell}</span>`;
  if (cell.startsWith("◆")) return `<span class="pill p-blue">${cell}</span>`;
  if (cell.startsWith("○")) return `<span class="pill p-gray">${cell}</span>`;
  return `<span style="color:#64748b;font-size:12px;">${cell}</span>`;
}

function invalidateM7ApprovalIfNeeded(state) {
  if (state.m7ApprovalRecord || state.m7ComplianceStatus === "主管已批准导出" || state.m7ComplianceStatus === "合规校验通过") {
    state.m7ApprovalRecord = null;
    state.m7ComplianceStatus = "待运行合规检查";
  }
}

function getM7AvailableProducts(state) {
  const approvedNew = state.m4Pool
    .filter(x => x.stage === "已批准测款")
    .map(x => ({
      sku: x.sku, name: x.name, category: x.category || "家居收纳", platform: x.platform || "Amazon US",
      unitPriceUsd: x.unitPriceUsd || 24.9, origin: "M4_APPROVED",
      approver: x.approver || "陈主管", reason: x.decisionReason || "实盘利润率达标批准测款"
    }));
  const seen = new Set(approvedNew.map(p => p.sku));
  const legacyInStore = state.masterProducts
    .filter(p => !seen.has(p.sku))
    .map(p => ({
      sku: p.sku, name: p.name, category: p.cat || p.category || "家居收纳", platform: "Amazon US",
      unitPriceUsd: p.salePriceUsd || 24.9, origin: "IN_STORE_REFRESH",
      approver: "在售老品翻新", reason: "已上架在售商品详情升级"
    }));
  return [...approvedNew, ...legacyInStore];
}

function renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast) {
  const copyCnt = [state.m7SelectedTitle, state.m7SelectedBullets, state.m7SelectedDesc, state.m7SelectedKeywords].filter(Boolean).length;
  const imgCnt = state.m7Images.filter(x => x.done).length;
  const doneCnt = (state.m7SelectedTitle ? 1 : 0) + (state.m7SelectedBullets ? 1 : 0) + (state.m7SelectedDesc ? 1 : 0) + (state.m7SelectedKeywords ? 1 : 0) + (state.m7Images[0].done ? 1 : 0) + (state.m7Images.slice(1).every(x => x.done) ? 1 : 0) + (state.m7AplusDone ? 1 : 0) + (state.m7VidDone ? 1 : 0);
  const steps = [
    { id: "m7a", num: "1", label: "商品文案", status: `${copyCnt}/4`, done: copyCnt === 4 },
    { id: "m7b", num: "2", label: "1+4 电商套图", status: `${imgCnt}/5`, done: imgCnt === 5 },
    { id: "m7c", num: "3", label: "视频与A+长页", status: `${(state.m7VidDone?1:0)+(state.m7AplusDone?1:0)}/2`, done: state.m7VidDone && state.m7AplusDone },
    { id: "m7d", num: "4", label: "合规总览导出", status: `${doneCnt}/8`, done: state.m7ComplianceStatus === "主管已批准导出" },
  ];
  return `
    <div class="card" style="padding:10px 14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;">
          ${steps.map(s => `
            <button type="button" class="btn btn-sm ${pageId===s.id?"btn-primary":""} m7-nav-step" data-pg="${s.id}" style="border-radius:999px;">
              <span>${s.done ? "✓" : s.num}. ${s.label}</span>
              <span class="pill ${s.done?"p-green":pageId===s.id?"p-blue":"p-gray"}" style="margin-left:4px;">${s.status}</span>
            </button>
          `).join('<span style="color:#94a3b8;font-size:12px;">→</span>')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="pill ${doneCnt===8?"p-green":"p-amber"}">交付进度 ${doneCnt}/8</span>
          <button type="button" class="btn btn-sm" id="m7ResetFlowBtn" title="清空当前 8 项创作成果，从 0/8 重新走一遍第 1→4 步">🔄 重置从第1步重走</button>
        </div>
      </div>
    </div>
  `;
}

function bindM7StepBar(state, curM7Prod, goPage, rerender, toast) {
  document.querySelectorAll(".m7-nav-step").forEach(b => b.onclick = () => goPage(b.dataset.pg));
  const rst = document.getElementById("m7ResetFlowBtn");
  if (rst) rst.onclick = () => {
    resetM7CreationState(state, curM7Prod.sku, curM7Prod);
    toast(`已将 ${curM7Prod.sku} 重置为 0/8 待创作状态，请从第 1 步开始`, "info");
    if (state.pageId !== "m7a") goPage("m7a"); else rerender();
  };
}

function checkCopyRules(text, mustStr, banStr, platform) {
  const mustTerms = mustStr.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const banTerms = banStr.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const mustHitsDetail = [];
  const banHitsDetail = [];
  let safeHtml = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  mustTerms.forEach(term => {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const matches = safeHtml.match(re);
    if (matches) mustHitsDetail.push(`${term} (${matches.length}次)`);
    safeHtml = safeHtml.replace(re, `<mark style="background:#dcfce7;color:#065f46;padding:0 3px;border-radius:3px;font-weight:700;">$1</mark>`);
  });

  banTerms.forEach(term => {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const matches = safeHtml.match(re);
    if (matches) banHitsDetail.push(`${term} (${matches.length}处)`);
    safeHtml = safeHtml.replace(re, `<mark style="background:#fee2e2;color:#b91c1c;padding:0 3px;border-radius:3px;font-weight:700;text-decoration:underline;">$1</mark>`);
  });

  const tmRegex = /\b(Dyson|Ziploc|Velcro|Teflon|Thermos)\b/gi;
  const regRegex = /\b(FDA\s+Approved|Sterilize|Cure|Medical\s+Grade|Waterproof)\b/gi;
  const tmHits = text.match(tmRegex) || [];
  const regHits = text.match(regRegex) || [];
  const allCapsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).filter(w => !["USBC", "BPA", "HDMI", "LED"].includes(w));
  const byteLen = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : text.length;

  const maxTitleLen = platform.includes("虾皮") ? 120 : platform.includes("TikTok") ? 150 : 200;
  const overLen = text.length > maxTitleLen;
  return {
    safeHtml,
    mustHits: mustHitsDetail.length,
    mustHitsDetail,
    totalMust: mustTerms.length,
    banHits: banHitsDetail.length + tmHits.length + regHits.length,
    banHitsDetail: [
      ...banHitsDetail,
      ...tmHits.map(t => `商标侵权词:${t}`),
      ...regHits.map(r => `监管敏感词:${r}`)
    ],
    tmHits,
    regHits,
    allCapsWords,
    byteLen,
    len: text.length,
    maxTitleLen,
    overLen
  };
}

export function renderM7_M8(pageId, state, helpers) {
  const { toast, goPage, rerender, commitAction, runAsyncTask, renderAsyncBox, record403 } = helpers;

  const availProds = getM7AvailableProducts(state);
  const curM7Prod = availProds.find(p => p.sku === state.m7Sku) || availProds[0];

  // ==================== M7-1: 多语言商品文案与品牌用语检查 ====================
  if (pageId === "m7a") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const mustList = state.m7MustTerm.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const verTag = Math.max(1, state.m7CopyGenCount);
    const m0Prod = state.masterProducts.find(p => p.sku === curM7Prod.sku) || null;
    const csMatched = state.csCatalog.find(c => c.sku === curM7Prod.sku) || state.csCatalog.find(c => c.sku === "FAN-203") || state.csCatalog[0];
    const csFaqList = state.csCatalog.filter(c => c.docType && c.docType.includes("FAQ"));

    const getCopyPool = (tab) => {
      if (tab === "商品标题") return [
        {
          text: `${curM7Prod.sku} | ${mustList.join(" ")} · Compact Everyday Essential for ${state.m7Platform} (热搜词版 v${verTag})`,
          translation: `【中文对照】${curM7Prod.name}（${curM7Prod.sku}）｜便携无线真空封口机，小巧日常居家保鲜好物，专为${state.m7Platform}热搜词优化（第${verTag}版）`
        },
        {
          text: `${curM7Prod.name} (${curM7Prod.sku}) · ${mustList[0] || "Portable"} Design with Fast Setup & Reliable Quality (卖点版 v${verTag})`,
          translation: `【中文对照】${curM7Prod.name}（${curM7Prod.sku}）｜便携式快速上手设计，密封牢固耐用，突出核心功能卖点（第${verTag}版）`
        },
        {
          text: `New Arrival: ${mustList.slice(0,2).join(" & ")} ${curM7Prod.name} for Home & Travel (${state.m7Platform} 场景版 v${verTag})`,
          translation: `【中文对照】新品推荐：适用于居家厨房与差旅出行的便携无线${curM7Prod.name}，兼顾日常收纳与随行保鲜（第${verTag}版）`
        }
      ];
      if (tab === "五点描述") return [
        {
          text: `• [核心性能] Engineered with ${mustList.join(", ")}, delivering reliable everyday performance for busy shoppers.`,
          translation: `【中文对照】• [核心性能] 集便携、无线与强效真空封口于一体，8秒完成干湿食材锁鲜，满足快节奏家庭日常所需。`
        },
        {
          text: `• [便捷体验] Lightweight body (${curM7Prod.sku}) enables easy one-hand operation for kitchen, dorm, and travel.`,
          translation: `【中文对照】• [便捷体验] 轻巧掌心机身支持单手一键封口，无论是厨房备餐、宿舍零食保存还是露营出行都能轻松收纳。`
        },
        {
          text: `• [测试拦截样例] Best choice with Miracle results and Free gift! (用于测试违禁词逐条拦截提醒)`,
          translation: `【中文对照】• [违禁词测试样例] 含 Best / Miracle / Free 等平台禁用绝对化用词，用于验证系统自动拦截能力。`
        }
      ];
      if (tab === "商品描述") return [
        {
          text: `Upgrade your daily routine with ${curM7Prod.sku} (${curM7Prod.name}). Built around ${mustList.join(" and ")}, tailored for ${state.m7Platform} shoppers (v${verTag}).`,
          translation: `【中文对照】用 ${curM7Prod.name}（${curM7Prod.sku}）焕新您的日常保鲜体验：采用无线便携与高效真空封口设计，专为${state.m7Platform}买家习惯打造（第${verTag}版）。`
        },
        {
          text: `Designed for busy households, ${curM7Prod.name} combines ${mustList[0] || "durable material"} with effortless storage and low maintenance.`,
          translation: `【中文对照】专为繁忙家庭设计，兼具食品级耐用材质与磁吸免占空间收纳，日常清洁省心省力。`
        },
        {
          text: `From daily home prep to weekend trips, ${curM7Prod.sku} keeps essentials organized and ready.`,
          translation: `【中文对照】从工作日分装备餐到周末户外野餐，${curM7Prod.sku} 随时锁住食材新鲜与干爽。`
        }
      ];
      if (tab === "后台搜索词") return [
        {
          text: `${mustList.map(x=>x.toLowerCase()).join(", ")}, ${curM7Prod.sku.toLowerCase()}, compact home organizer, travel essential (20个合规词)`,
          translation: `【中文对照】后台检索词组（核心大词）：便携封口机、无线真空保鲜器、小型家居收纳神器、差旅零食封口必备。`
        },
        {
          text: `portable gadget, ${curM7Prod.name}, gift for family, space saving organizer (20个长尾词)`,
          translation: `【中文对照】后台检索词组（长尾场景词）：便携居家好物、${curM7Prod.name}、家庭实用礼品、省空间家居收纳工具。`
        },
        {
          text: `best miracle free gadget (包含违禁词样例：触发合规拦截)`,
          translation: `【中文对照】违禁搜索词测试样例：包含 best / miracle / free 等平台禁止写入后台词库的词汇。`
        }
      ];
      if (tab === "使用说明与FAQ") return [
        {
          text: `[M1-2 知识库联动 · ${csMatched.sku}] ${csMatched.name} Usage & Troubleshooting: ${csMatched.points}`,
          translation: `【中文对照】联动 M1-2 客服知识库（${csMatched.sku}）：确保上架页说明书与客服应答口径完全一致，减少买家误操作退货。`
        },
        {
          text: `[M1-2 售后高频问答] Q: Red light blinking or weak suction? A: Charge via USB-C for 2h until green; wipe sealing strip dry before pressing firmly for 3s.`,
          translation: `【中文对照】高频排障指引：红灯闪烁或吸力变弱时，请使用 USB-C 充电2小时至绿灯常亮，并擦干加热密封条后按压3秒。`
        },
        {
          text: `[Care & Cleaning Guide] Do not submerge main motor unit in water. Wipe nozzle with a damp cloth after sealing moist snacks.`,
          translation: `【中文对照】日常清洁保养：切勿将主机浸入水中清洗；封口含水渍零食后，请用微湿软布擦拭抽气口即可。`
        }
      ];
      if (tab === "A+模块文案") return [
        {
          text: `A+ Hero: "Seal Freshness Anywhere" | Subhead: Cordless ${curM7Prod.name} keeps snacks & meal-prep 5x fresher | Comparison: USB-C 1200mAh vs Traditional Corded Sealers.`,
          translation: `【中文对照】A+ 品牌横幅主标「随时随地锁住新鲜」，副标题突出5倍保鲜力，底部参数对比表突出无线1200mAh对比传统插电款优势。`
        },
        {
          text: `A+ Lifestyle Trio: Module 1 Kitchen Pantry Organization · Module 2 Dry & Moist Dual-Mode · Module 3 Magnetic Fridge Storage.`,
          translation: `【中文对照】A+ 三段式场景文案：模块1厨房干货收纳、模块2干湿两用模式切换、模块3背部磁吸贴冰箱省空间。`
        },
        {
          text: `A+ Spec Callouts: 10W Fast Heating Strip · 0.35 lbs Ultra-Light Body · Includes 20 BPA-Free Vacuum Bags.`,
          translation: `【中文对照】A+ 核心参数卖点条：10W 快速发热密封条、0.35磅超轻机身，开箱附赠20只不含双酚A真空袋。`
        }
      ];
      if (tab === "规格变体命名") return [
        {
          text: `Variant A: Standard Single Unit (${curM7Prod.sku}-STD) — Compact Body + USB-C Cable | Variant B: Pro Gift Bundle (${curM7Prod.sku}-PRO) — Unit + 20 Vacuum Bags.`,
          translation: `【中文对照】变体命名方案1（标准单机 vs 礼盒套装）：清晰区分单机入门款与含20只真空袋的家庭礼盒装，提升客单价。`
        },
        {
          text: `Capacity Tier Naming: 3 Qt Mini Travel Pack (Ceramic White) / 6 Qt Family Kitchen Pack (Matte Gray + Extra Seal Roll).`,
          translation: `【中文对照】变体命名方案2（按容量与配色区分）：3夸脱差旅便携白款 vs 6夸脱家庭厨房灰款（含备用封口卷袋）。`
        },
        {
          text: `Color & Kit SKU Mapping: Classic Ceramic White (1 Pack) / Kitchen Value Duo (2-Pack Family Share).`,
          translation: `【中文对照】变体命名方案3（单件装 vs 双件家庭分享装）：陶瓷白单件体验装与两件家庭分享装，便于多规格对比选购。`
        }
      ];
      if (tab === "后台属性说明") {
        const attrSummary = m0Prod
          ? `Brand: ${m0Prod.brand || "待补"} | Material: ${m0Prod.material || "待补"} | Dimensions: ${m0Prod.dimensions || "待补"} | Wattage: ${m0Prod.wattage || "待补"} | Weight: ${m0Prod.weightLbs || "待补"} | Control: ${m0Prod.controlMethod || "待补"}`
          : `Brand: CrossPilot Home | Material: Food-Grade ABS | Dimensions: 4.4 x 1.8 x 1.7 in | Wattage: 10W | Weight: 0.35 lbs`;
        return [
          {
            text: `[M0-2 属性联动] ${attrSummary}`,
            translation: `【中文对照】联动 M0-2 商品主档属性：品牌、材质、尺寸、瓦数（10W）、重量（0.35磅）及控制方式结构化字段，供后台属性表直接填报。`
          },
          {
            text: `Power & Safety Specs: Input 5V/2A USB-C, Rated Power ${m0Prod?.wattage || "10W"}, Battery 1200mAh Li-ion, Auto-Shutoff Thermal Protection.`,
            translation: `【中文对照】电气与安全属性：5V/2A USB-C 输入、额定功率 10W、内置 1200mAh 锂电池，支持过热自动断电保护。`
          },
          {
            text: `Packaging & Logistics Attributes: Net Weight ${m0Prod?.weightLbs || "0.35 lbs"}, Color: ${m0Prod?.color || "Ceramic White"}, Origin: CN, HS Code Ready.`,
            translation: `【中文对照】物流与包装属性：净重 0.35 磅、陶瓷白配色，含标准英文成分与海关编码申报说明。`
          }
        ];
      }
      if (tab === "图片ALT文本") return [
        {
          text: `IMG1: Cordless mini vacuum sealer in ceramic white on pure white background | IMG2: Woman sealing fresh strawberries in a home kitchen | IMG3: Close-up of dual dry/moist seal bar | IMG4: Compact 4.4-inch size comparison | IMG5: Flat-lay kit with USB-C cable and bags.`,
          translation: `【中文对照】5张主附图无障碍 ALT 描述：逐张说明白底主机正面、厨房水果封鲜场景、干湿双模发热条细节、4.4英寸掌心尺寸及全套配件清单。`
        },
        {
          text: `Accessible Screen-Reader Set: ${curM7Prod.name} front studio view, kitchen counter usage, LED indicator guide, dimension ruler overlay, and full box contents.`,
          translation: `【中文对照】平台无障碍读屏标准 ALT 套装：覆盖棚拍主视、台面实操、指示灯引导、标尺尺寸与包装内容物五重语义标签。`
        },
        {
          text: `SEO-Friendly ALT Set: Portable ${mustList[0] || "Cordless"} ${curM7Prod.name} white background photo and 4 lifestyle/spec infographics.`,
          translation: `【中文对照】兼顾站内 SEO 检索的 ALT 描述：将核心词自然融入主图及 4 张信息图描述中，提升图片搜索收录权重。`
        }
      ];
      return [
        {
          text: `Compliance & Warranty: UL/FCC/CE tested household appliance (${state.m7Platform} standard). Backed by 12-month manufacturer replacement warranty & 24/7 customer support.`,
          translation: `【中文对照】合规认证与质保声明：通过${state.m7Platform}要求的 UL/FCC/CE 安全测试，提供12个月质保换新与全天候客服支持。`
        },
        {
          text: `Safety & Battery Disclosure: Contains rechargeable lithium-ion battery (UN38.3 compliant). Keep out of reach of children; follow included multilingual manual.`,
          translation: `【中文对照】电池运输与安全声明：内置符合 UN38.3 航运标准的充电锂电池，请放置在儿童接触不到的位置并按说明书规范使用。`
        },
        {
          text: `Brand Authorization & Care Promise: Official CrossPilot Home genuine product with sealed retail packaging and 30-day hassle-free return coverage.`,
          translation: `【中文对照】品牌授权与售后承诺：CrossPilot Home 官方正品密封包装，支持平台 30 天无忧退换保障。`
        }
      ];
    };

    const drafts = getCopyPool(state.m7ResultTab);
    const coreCopyTabs = ["商品标题", "五点描述", "商品描述", "后台搜索词"];
    const extCopyTabs = ["使用说明与FAQ", "A+模块文案", "规格变体命名", "后台属性说明", "图片ALT文本", "认证与保修说明"];
    const copyFilledMap = {
      "商品标题": !!state.m7SelectedTitle,
      "五点描述": !!state.m7SelectedBullets,
      "商品描述": !!state.m7SelectedDesc,
      "后台搜索词": !!state.m7SelectedKeywords,
      "使用说明与FAQ": !!state.m7SelectedFaq,
      "A+模块文案": !!state.m7SelectedAplusCopy,
      "规格变体命名": !!state.m7SelectedVariantCopy,
      "后台属性说明": !!state.m7SelectedAttrCopy,
      "图片ALT文本": !!state.m7SelectedAltCopy,
      "认证与保修说明": !!state.m7SelectedWarrantyCopy,
    };
    const copyCnt = coreCopyTabs.filter(k => copyFilledMap[k]).length;
    const extCopyCnt = extCopyTabs.filter(k => copyFilledMap[k]).length;
    const curImg = getProductImg(curM7Prod.sku, curM7Prod.name, curM7Prod.category);

    const getPickedPair = (tab) => {
      if (tab === "商品标题") return { text: state.m7SelectedTitle, cn: state.m7SelectedTitleCn };
      if (tab === "五点描述") return { text: state.m7SelectedBullets, cn: state.m7SelectedBulletsCn };
      if (tab === "商品描述") return { text: state.m7SelectedDesc, cn: state.m7SelectedDescCn };
      if (tab === "后台搜索词") return { text: state.m7SelectedKeywords, cn: state.m7SelectedKeywordsCn };
      if (tab === "使用说明与FAQ") return { text: state.m7SelectedFaq, cn: state.m7SelectedFaqCn };
      if (tab === "A+模块文案") return { text: state.m7SelectedAplusCopy, cn: state.m7SelectedAplusCopyCn };
      if (tab === "规格变体命名") return { text: state.m7SelectedVariantCopy, cn: state.m7SelectedVariantCopyCn };
      if (tab === "后台属性说明") return { text: state.m7SelectedAttrCopy, cn: state.m7SelectedAttrCopyCn };
      if (tab === "图片ALT文本") return { text: state.m7SelectedAltCopy, cn: state.m7SelectedAltCopyCn };
      return { text: state.m7SelectedWarrantyCopy, cn: state.m7SelectedWarrantyCopyCn };
    };
    const setPickedPair = (tab, text, cn) => {
      if (tab === "商品标题") { state.m7SelectedTitle = text; state.m7SelectedTitleCn = cn; }
      else if (tab === "五点描述") { state.m7SelectedBullets = text; state.m7SelectedBulletsCn = cn; }
      else if (tab === "商品描述") { state.m7SelectedDesc = text; state.m7SelectedDescCn = cn; }
      else if (tab === "后台搜索词") { state.m7SelectedKeywords = text; state.m7SelectedKeywordsCn = cn; }
      else if (tab === "使用说明与FAQ") { state.m7SelectedFaq = text; state.m7SelectedFaqCn = cn; }
      else if (tab === "A+模块文案") { state.m7SelectedAplusCopy = text; state.m7SelectedAplusCopyCn = cn; }
      else if (tab === "规格变体命名") { state.m7SelectedVariantCopy = text; state.m7SelectedVariantCopyCn = cn; }
      else if (tab === "后台属性说明") { state.m7SelectedAttrCopy = text; state.m7SelectedAttrCopyCn = cn; }
      else if (tab === "图片ALT文本") { state.m7SelectedAltCopy = text; state.m7SelectedAltCopyCn = cn; }
      else { state.m7SelectedWarrantyCopy = text; state.m7SelectedWarrantyCopyCn = cn; }
    };

    return {
      headerActions: [
        { label: state.m7ShowCN ? "🈶 隐藏中文对照" : "🈶 显示中文对照", primary: false, onClick: () => { state.m7ShowCN = !state.m7ShowCN; rerender(); } },
        { label: `⚡ 一键采纳 4 类核心文案 (${copyCnt}/4)`, primary: false, disabled: !canCreate, onClick: () => {
          state.m7CopyGenCount = Math.max(1, state.m7CopyGenCount);
          coreCopyTabs.forEach(tb => {
            const first = getCopyPool(tb)[0];
            setPickedPair(tb, first.text, first.translation);
          });
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 一键采纳了 ${curM7Prod.sku} 的 4 类核心合规文案`, ok: true });
          rerender();
          toast("已写入全部 4 类核心合规文案，可继续选扩展文案或进入第 2 步", "success");
        }},
        { label: "下一步：制作 1+4 套图 →", primary: true, onClick: () => goPage("m7b") }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}

        <div class="m7-relay-bar">
          <div>
            <strong>📥 本步输入来源：</strong>
            已从商品主档带入 <strong>${curM7Prod.sku} · ${curM7Prod.name}</strong>（${m0Prod ? `${m0Prod.brand || "CrossPilot"} · ${m0Prod.wattage || "标准规格"} · ${m0Prod.weightLbs || ""}` : curM7Prod.category}），并按 <strong>${state.m7Platform}</strong> 加载品牌用语与合规红线词库。
          </div>
          <span class="pill p-blue">第 1 步选定后将自动同步至套图与视频参考</span>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">第 1 步：选品与品牌用语规范</div></div>
            <div class="field"><label>选择创作商品（联动 M4 批准清单）</label>
              <select id="m7ProdSel" class="select">
                <optgroup label="✓ M4 主管已同意测款（待上新创作）">
                  ${availProds.filter(p=>p.origin==="M4_APPROVED").map(p => `<option value="${p.sku}" ${state.m7Sku===p.sku?"selected":""}>${p.sku} · ${p.name} (主管已批)</option>`).join("")}
                </optgroup>
                <optgroup label="在售老品详情翻新">
                  ${availProds.filter(p=>p.origin==="IN_STORE_REFRESH").map(p => `<option value="${p.sku}" ${state.m7Sku===p.sku?"selected":""}>${p.sku} · ${p.name} (在售翻新)</option>`).join("")}
                </optgroup>
              </select>
            </div>

            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:1px solid ${curM7Prod.origin==="M4_APPROVED"?"#a7f3d0":"var(--border)"};background:${curM7Prod.origin==="M4_APPROVED"?"var(--green-bg)":"#f8fafc"};margin-bottom:10px;">
              <img src="${curImg}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div>
                <div style="margin-bottom:3px;">
                  <span class="pill ${curM7Prod.origin==="M4_APPROVED"?"p-green":"p-blue"}">
                    ${curM7Prod.origin==="M4_APPROVED" ? `✓ 主管已同意测款 (${curM7Prod.approver})` : "在售老品翻新"}
                  </span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);">${curM7Prod.category} · ${curM7Prod.reason}</div>
              </div>
            </div>

            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>目标上架平台</label><select id="m7PlatSel" class="select"><option ${state.m7Platform==="亚马逊美国站"?"selected":""}>亚马逊美国站</option><option ${state.m7Platform==="虾皮泰国站"?"selected":""}>虾皮泰国站</option><option ${state.m7Platform==="TikTok 美区"?"selected":""}>TikTok 美区</option></select></div>
              <div class="field"><label>输出语言</label><select id="m7LangSel" class="select"><option ${state.m7Lang==="English (US)"?"selected":""}>English (US)</option><option ${state.m7Lang==="简体中文"?"selected":""}>简体中文</option></select></div>
            </div>
            <div class="field">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <label style="margin:0;">品牌用语规范（必须包含，绿底高亮）</label>
                <span class="pill p-green" style="font-size:10px;">来源：品牌词库 + SKU卖点</span>
              </div>
              <input id="m7MustTerm" class="input" value="${state.m7MustTerm}" style="margin-top:4px;"/>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">
                ${["USB-C", "BPA-Free", "Compact", "CrossPilot"].map(kw => `<button type="button" class="m7-chip ok m7-add-must" data-w="${kw}">+ ${kw}</button>`).join("")}
              </div>
            </div>
            <div class="field">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <label style="margin:0;">平台违禁词（严禁出现，红底拦截）</label>
                <span class="pill p-red" style="font-size:10px;">来源：${state.m7Platform}红线库</span>
              </div>
              <input id="m7BanTerm" class="input" value="${state.m7BanTerm}" style="margin-top:4px;"/>
              <div style="margin-top:6px;padding:7px 9px;border-radius:7px;background:#fffbeb;border:1px solid #fde68a;font-size:11px;color:#92400e;line-height:1.55;">
                <strong>三层合规词库自动联防提示：</strong><br/>
                • <strong>商标侵权词：</strong>Dyson / Ziploc / Velcro（魔术贴须改写 <code>hook and loop</code>）<br/>
                • <strong>类目监管词：</strong>FDA Approved / Sterilize / Waterproof（建议改写 <code>Water-resistant</code>）<br/>
                • <strong>格式软提示：</strong>避免连续全大写 <code>ALL CAPS</code>；后台搜索词按 <code>250 bytes</code> 核验
              </div>
            </div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>✨ 生成第 ${state.m7CopyGenCount + 1} 版多语言文案草稿</button>

            <div style="margin-top:12px;padding:10px;border-radius:8px;background:#f8fafc;border:1px solid var(--border);font-size:12px;">
              <strong>🔗 已联动 M1-2 客服知识库 FAQ（${csFaqList.length} 条可复用）：</strong>
              <div style="color:var(--text-muted);margin-top:4px;line-height:1.5;">
                ${csFaqList.slice(0,2).map(f => `• <strong>${f.sku} (${f.name})：</strong>${f.points.slice(0,48)}...`).join("<br/>")}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">${curM7Prod.sku} 全套上架文案（核心 4 类 + 扩展 6 类）</div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="btn btn-sm" id="m7ToggleCnBtn">${state.m7ShowCN ? "✓ 中文对照：开" : "中文对照：关"}</button>
                <span class="pill ${copyCnt===4?"p-green":"p-amber"}">核心 ${copyCnt}/4 · 扩展 ${extCopyCnt}/6</span>
              </div>
            </div>

            <div style="font-size:11.5px;font-weight:700;color:var(--text-soft);margin-bottom:4px;">核心 4 类交付文案（计入 8 类上架交付主进度）：</div>
            <div class="utabs" style="margin-bottom:8px;">
              ${coreCopyTabs.map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">
                  ${tb} ${copyFilledMap[tb] ? '<span class="utab-cnt" style="background:var(--green-bg);color:var(--green-text);">✓</span>' : '<span class="utab-cnt">待选</span>'}
                </div>
              `).join("")}
            </div>

            <div style="font-size:11.5px;font-weight:700;color:var(--text-soft);margin-bottom:4px;">真实上架扩展 6 类文案（独立记为 8+N 交付）：</div>
            <div class="utabs" style="margin-bottom:12px;">
              ${extCopyTabs.map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">
                  ${tb} ${copyFilledMap[tb] ? '<span class="utab-cnt" style="background:var(--green-bg);color:var(--green-text);">✓</span>' : '<span class="utab-cnt">可选</span>'}
                </div>
              `).join("")}
            </div>

            ${state.m7CopyGenCount === 0 ? `
              <div style="padding:28px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:10px;">
                <div style="font-weight:700;font-size:14.5px;margin-bottom:6px;">尚未生成「${curM7Prod.name}」文案草稿</div>
                <div style="font-size:12.5px;color:var(--text-soft);margin-bottom:12px;">请点击左侧「✨ 生成第 1 版多语言文案草稿」，或点击右上角一键采纳 4 类核心合规文案。</div>
                <button class="btn btn-primary btn-sm" id="m7EmptyGenBtn" ${!canCreate?"disabled":""}>✨ 立即生成文案草稿</button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${drafts.map((item, idx) => {
                  const txt = item.text;
                  const cn = item.translation;
                  const chk = checkCopyRules(txt, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
                  const isCore = coreCopyTabs.includes(state.m7ResultTab);
                  const blocked = chk.banHits > 0 || (isCore && chk.overLen);
                  const curPicked = getPickedPair(state.m7ResultTab);
                  const isPicked = curPicked.text === txt;
                  return `
                    <div style="background:${isPicked?"#f0fdf4":"#f8fafc"};border:1px solid ${blocked?"#fca5a5":isPicked?"#86efac":"var(--border)"};border-radius:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                      <div style="flex:1;min-width:240px;">
                        <div style="font-weight:600;line-height:1.5;">${chk.safeHtml}</div>
                        ${state.m7ShowCN ? `<div style="margin-top:6px;padding:6px 9px;background:#ffffff;border-left:3px solid var(--blue);border-radius:4px;font-size:12.5px;color:var(--text-muted);line-height:1.5;">${cn}</div>` : ""}
                        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;font-size:12px;">
                          <span class="pill p-green">品牌用语 ${chk.mustHits}/${chk.totalMust} 项</span>
                          <span class="pill ${chk.banHits>0?"p-red":"p-green"}">${chk.banHits>0 ? `命中红线：${chk.banHitsDetail.join("、")}` : "违禁/侵权 0 命中 ✓"}</span>
                          <span class="pill ${isCore && chk.overLen?"p-red":"p-gray"}">字符数 ${chk.len}${isCore ? " / " + chk.maxTitleLen : ""} (${chk.byteLen} bytes)</span>
                          ${chk.allCapsWords.length ? `<span class="pill p-amber">全大写提醒：${chk.allCapsWords.join(",")}</span>` : ""}
                        </div>
                      </div>
                      <button class="btn ${blocked?"btn-danger":isPicked?"btn-success":"btn-primary"} btn-sm m7-pick-copy" data-idx="${idx}" data-ban="${chk.banHits}" data-over="${isCore && chk.overLen?1:0}" ${!canCreate?"disabled":""}>
                        ${blocked ? "含违禁/超长(拦截)" : isPicked ? "已写入清单 ✓" : "写入交付清单 ✓"}
                      </button>
                    </div>
                  `;
                }).join("")}
              </div>
            `}

            ${(() => {
              const curPicked = getPickedPair(state.m7ResultTab);
              if (!curPicked.text) return "";
              const isCoreTab = coreCopyTabs.includes(state.m7ResultTab);
              const origPair = state.m7SelectedOrigMap?.[state.m7ResultTab];
              const isEditedDiff = origPair && origPair.text && origPair.text !== curPicked.text;
              const liveDraftText = state.m7CopyEditing ? state.m7CopyEditDraft : curPicked.text;
              const liveChk = checkCopyRules(liveDraftText, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
              const liveBlocked = liveChk.banHits > 0 || (isCoreTab && liveChk.overLen);
              return `
                <div style="margin-top:14px;padding:12px 14px;border-radius:8px;border:1px solid ${liveBlocked?"#fca5a5":"#a7f3d0"};background:${liveBlocked?"#fef2f2":"#ecfdf5"};">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                    <div style="font-size:12px;font-weight:700;color:${liveBlocked?"#991b1b":"#065f46"};">
                      ✓ 当前「${state.m7ResultTab}」已写入交付清单${isEditedDiff ? "（已人工微调）" : ""}：
                    </div>
                    <div style="display:flex;gap:6px;">
                      ${!state.m7CopyEditing ? `
                        <button type="button" class="btn btn-sm btn-primary" id="m7StartEditCopyBtn" ${!canCreate?"disabled":""}>✏️ 编辑微调</button>
                        ${isEditedDiff ? `<button type="button" class="btn btn-sm" id="m7RestoreOrigCopyBtn" ${!canCreate?"disabled":""}>↩️ 还原 AI 原稿</button>` : ""}
                      ` : `
                        <button type="button" class="btn btn-sm btn-success" id="m7SaveEditCopyBtn" ${!canCreate?"disabled":""}>💾 保存修改</button>
                        <button type="button" class="btn btn-sm" id="m7CancelEditCopyBtn">取消</button>
                      `}
                    </div>
                  </div>
                  ${!state.m7CopyEditing ? `
                    <div style="font-size:13px;font-weight:600;line-height:1.5;">${liveChk.safeHtml}</div>
                    ${state.m7ShowCN && curPicked.cn ? `<div style="font-size:12px;color:#047857;margin-top:4px;">${curPicked.cn}</div>` : ""}
                  ` : `
                    <div class="field" style="margin-bottom:6px;">
                      <label style="font-size:11.5px;">英文正文微调（实时校验违禁词与字数）：</label>
                      <textarea id="m7EditDeliverableTxt" class="textarea" rows="3">${state.m7CopyEditDraft}</textarea>
                    </div>
                    ${state.m7ShowCN ? `
                      <div class="field" style="margin-bottom:6px;">
                        <label style="font-size:11.5px;">中文对照说明微调（可选）：</label>
                        <textarea id="m7EditDeliverableCn" class="textarea" rows="2">${state.m7CopyEditDraftCn}</textarea>
                      </div>
                    ` : ""}
                    <div id="m7EditLiveStatus" style="display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;margin-top:4px;">
                      <span class="pill p-green">品牌用语 ${liveChk.mustHits}/${liveChk.totalMust} 项</span>
                      <span class="pill ${liveChk.banHits>0?"p-red":"p-green"}">${liveChk.banHits>0 ? `命中红线：${liveChk.banHitsDetail.join("、")}` : "违禁/侵权 0 命中 ✓"}</span>
                      <span class="pill ${isCoreTab && liveChk.overLen?"p-red":"p-gray"}">字符数 ${liveChk.len}${isCoreTab ? " / " + liveChk.maxTitleLen : ""}</span>
                    </div>
                  `}
                </div>
              `;
            })()}
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.getElementById("m7ToggleCnBtn").onclick = () => { state.m7ShowCN = !state.m7ShowCN; rerender(); };
        document.querySelectorAll(".m7-add-must").forEach(b => b.onclick = () => {
          const inp = document.getElementById("m7MustTerm");
          const cur = inp.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
          if (!cur.some(x => x.toLowerCase() === b.dataset.w.toLowerCase())) {
            cur.push(b.dataset.w);
            inp.value = cur.join(", ");
            state.m7MustTerm = inp.value;
            rerender();
          }
        });
        document.getElementById("m7ProdSel").onchange = (e) => {
          const picked = availProds.find(p => p.sku === e.target.value);
          resetM7CreationState(state, e.target.value, picked);
          rerender();
          toast(`已切换创作商品为「${picked?.name}」，已重置为 0/8 待创作状态`, "info");
        };
        document.getElementById("m7PlatSel").onchange = (e) => { state.m7Platform = e.target.value; rerender(); };
        document.getElementById("m7LangSel").onchange = (e) => { state.m7Lang = e.target.value; rerender(); };
        document.querySelectorAll(".m7-rtab").forEach(el => el.onclick = () => {
          state.m7ResultTab = el.dataset.tab;
          state.m7CopyEditing = false;
          rerender();
        });
        const triggerCopyGen = () => {
          state.m7MustTerm = document.getElementById("m7MustTerm").value;
          state.m7BanTerm = document.getElementById("m7BanTerm").value;
          state.m7CopyGenCount += 1; rerender(); toast(`已生成第 ${state.m7CopyGenCount} 版文案并完成中英对照与三层用语扫描`);
        };
        document.getElementById("m7GenCopyBtn").onclick = triggerCopyGen;
        const empBtn = document.getElementById("m7EmptyGenBtn");
        if (empBtn) empBtn.onclick = triggerCopyGen;

        document.querySelectorAll(".m7-pick-copy").forEach(b => b.onclick = () => {
          if (Number(b.dataset.ban) > 0 || b.dataset.over === "1") {
            appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 尝试选用含违禁词或超长的 ${curM7Prod.sku} 文案，已被拦截`, ok: false });
            toast("拦截：该版本文案包含违禁/侵权词或超过平台字数上限，不可写入交付清单！", "error");
            return;
          }
          const pickedItem = drafts[Number(b.dataset.idx)];
          if (!pickedItem) return;
          if (!state.m7SelectedOrigMap) state.m7SelectedOrigMap = {};
          state.m7SelectedOrigMap[state.m7ResultTab] = { text: pickedItem.text, cn: pickedItem.translation };
          state.m7CopyEditing = false;
          setPickedPair(state.m7ResultTab, pickedItem.text, pickedItem.translation);
          const curIdx = coreCopyTabs.indexOf(state.m7ResultTab);
          if (curIdx >= 0 && curIdx < 3) {
            const nextEmpty = coreCopyTabs.slice(curIdx + 1).find(t => !getPickedPair(t).text);
            if (nextEmpty) state.m7ResultTab = nextEmpty;
          }
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 将 ${curM7Prod.sku} 的「${state.m7ResultTab}」写入 M7-4 上架交付清单`, ok: true });
          rerender();
          toast("已写入交付清单（支持下方就地编辑微调）！", "success");
        });

        const startEditBtn = document.getElementById("m7StartEditCopyBtn");
        if (startEditBtn) startEditBtn.onclick = () => {
          const cur = getPickedPair(state.m7ResultTab);
          state.m7CopyEditing = true;
          state.m7CopyEditDraft = cur.text || "";
          state.m7CopyEditDraftCn = cur.cn || "";
          rerender();
        };
        const cancelEditBtn = document.getElementById("m7CancelEditCopyBtn");
        if (cancelEditBtn) cancelEditBtn.onclick = () => {
          state.m7CopyEditing = false;
          rerender();
        };
        const restoreOrigBtn = document.getElementById("m7RestoreOrigCopyBtn");
        if (restoreOrigBtn) restoreOrigBtn.onclick = () => {
          const orig = state.m7SelectedOrigMap?.[state.m7ResultTab];
          if (!orig) return;
          setPickedPair(state.m7ResultTab, orig.text, orig.cn);
          state.m7CopyEditing = false;
          invalidateM7ApprovalIfNeeded(state);
          rerender();
          toast("已还原为 AI 原稿文案", "info");
        };
        const editTxtEl = document.getElementById("m7EditDeliverableTxt");
        if (editTxtEl) editTxtEl.oninput = (e) => {
          state.m7CopyEditDraft = e.target.value;
          const isCoreTab = coreCopyTabs.includes(state.m7ResultTab);
          const chk = checkCopyRules(state.m7CopyEditDraft, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
          const statusHost = document.getElementById("m7EditLiveStatus");
          if (statusHost) {
            statusHost.innerHTML = `
              <span class="pill p-green">品牌用语 ${chk.mustHits}/${chk.totalMust} 项</span>
              <span class="pill ${chk.banHits>0?"p-red":"p-green"}">${chk.banHits>0 ? `命中红线：${chk.banHitsDetail.join("、")}` : "违禁/侵权 0 命中 ✓"}</span>
              <span class="pill ${isCoreTab && chk.overLen?"p-red":"p-gray"}">字符数 ${chk.len}${isCoreTab ? " / " + chk.maxTitleLen : ""}</span>
            `;
          }
        };
        const editCnEl = document.getElementById("m7EditDeliverableCn");
        if (editCnEl) editCnEl.oninput = (e) => { state.m7CopyEditDraftCn = e.target.value; };
        const saveEditBtn = document.getElementById("m7SaveEditCopyBtn");
        if (saveEditBtn) saveEditBtn.onclick = () => {
          const nextTxt = (state.m7CopyEditDraft || "").trim();
          if (!nextTxt) { toast("修改后的文案不能为空", "error"); return; }
          const isCoreTab = coreCopyTabs.includes(state.m7ResultTab);
          const chk = checkCopyRules(nextTxt, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
          if (chk.banHits > 0 || (isCoreTab && chk.overLen)) {
            appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 尝试保存含违禁词或超长的微调文案（${state.m7ResultTab}），已被实时拦截`, ok: false });
            toast(`保存拦截：${chk.banHits > 0 ? "命中红线词 " + chk.banHitsDetail.join("、") : "超出字符上限 " + chk.maxTitleLen}`, "error");
            return;
          }
          setPickedPair(state.m7ResultTab, nextTxt, (state.m7CopyEditDraftCn || "").trim());
          state.m7CopyEditing = false;
          invalidateM7ApprovalIfNeeded(state);
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 微调并保存了 ${curM7Prod.sku} 的「${state.m7ResultTab}」`, ok: true });
          rerender();
          toast("已保存微调后的文案并同步至交付清单 ✓", "success");
        };
      }
    };
  }

  // ==================== M7-2: 主图与详情套图制作（1+4 差异构图 + 局部对比 + ComfyUI/IPTC） ====================
  if (pageId === "m7b") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const pickedIdx = Number(state.m7PickedImgIdx) || 0;
    const pickedImg = state.m7Images[pickedIdx] || state.m7Images[0];
    const prodImg = getProductImg(curM7Prod.sku, curM7Prod.name, curM7Prod.category);
    const anyImgDone = state.m7Images.some(x => x.done);
    if (!Array.isArray(state.m7ImgBriefs) || state.m7ImgBriefs.length !== 5) {
      state.m7ImgBriefs = [...DEFAULT_M7_IMG_BRIEFS];
    }
    const curSlotBrief = state.m7ImgBriefs[pickedIdx] ?? DEFAULT_M7_IMG_BRIEFS[pickedIdx];
    const platPrefix = state.m7Platform === "亚马逊美国站"
      ? "Amazon US Compliance (Pure #FFFFFF Main, No Promotional Badges, 2000x2000px)"
      : state.m7Platform === "TikTok 美区"
        ? "TikTok Shop US High-Contrast Lifestyle Framing, 1:1 Mobile-First"
        : "Shopee TH Clean Studio + Bilingual Infographic Callout Ready";
    const wfStyleToken = state.m7ImgWorkflow.includes("场景")
      ? "warm editorial daylight, lifestyle home interior, soft depth-of-field"
      : "clean commercial studio lighting, sharp product silhouette, crisp commercial shadows";
    const styleOptions = ["商业棚拍质感", "自然居家日光", "高对比卖点科技"];
    const angleOptions = ["正面平视", "45° 立体俯拍", "微距细节特写"];
    const ratioOptions = ["1:1 电商方图", "3:4 竖版信息图", "4:5 社媒首图"];
    const negativePresets = ["禁止水印/促销角标", "禁止乱码文字", "禁止产品外观/Logo畸变", "禁止杂乱背景反光"];
    const syncedCopyHint = state.m7SelectedTitle
      ? `已引用 M7-1 标题：${state.m7SelectedTitle.slice(0, 56)}${state.m7SelectedTitle.length > 56 ? "..." : ""}`
      : "M7-1 标题尚未选定（将使用 M0-2 默认商品参数）";

    return {
      headerActions: [
        { label: "← 第 1 步：商品文案", primary: false, onClick: () => goPage("m7a") },
        { label: "第 3 步：视频与 A+ 长页 →", primary: false, onClick: () => goPage("m7c") },
        {
          label: anyImgDone ? "✨ 重新生成 1+4 差异化电商套图" : "✨ 生成 1+4 差异化电商套图", primary: true,
          disabled: !canCreate,
          disabledTitle: "需要「内容创作 / 审核人员」或主管权限",
          onClick: () => {
            runAsyncTask("m7_img_batch", {
              label: `商品 1+4 电商套图生成 · ${curM7Prod.sku} (${curM7Prod.name})`,
              steps: ["调度 ComfyUI 工作流 WF-IMG-v2.1 算力节点", `应用「${state.m7ImgStyle} · ${state.m7ImgAngle} · ${state.m7ImgRatio}」结构化参数`, "自动写入 EU_AI_Label 合规元数据并校验"],
              durationMs: 1100,
              onSuccess: () => {
                state.m7ImgVersion += 1;
                state.m7Images.forEach((im, idx) => {
                  im.done = true;
                  im.edited = false;
                  im.editNote = idx === 0 ? `白底棚拍主图 v${state.m7ImgVersion}` : `第 ${state.m7ImgVersion} 版差异化附图 (${state.m7ImgStyle})`;
                });
                return { summary: `已生成 5 张不同构图电商套图（第 ${state.m7ImgVersion} 版 · 演示图），可点击单张重绘或局部修改`, toastMsg: "1+4 差异化套图生成完成 ✓" };
              }
            });
          }
        }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}
        ${renderAsyncBox("m7_img_batch")}

        <div class="m7-relay-bar">
          <div>
            <strong>📥 本步输入来源：</strong>
            产品图锁定 <strong>${curM7Prod.sku}</strong>；${syncedCopyHint}
          </div>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:600;white-space:nowrap;">
            <input type="checkbox" id="m7ImgSyncCopyChk" ${state.m7ImgSyncCopy ? "checked" : ""}/> 自动同步 M7-1 核心卖点至信息图
          </label>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header">
              <div class="card-title">第 2 步：结构化套图工作台</div>
              <span class="pill p-blue">🔒 主体锁定</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:#f8fafc;margin-bottom:10px;">
              <img src="${prodImg}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div style="min-width:0;">
                <strong style="font-size:13px;">${curM7Prod.sku} · ${curM7Prod.name}</strong>
                <div style="font-size:11.5px;color:var(--text-soft);">${curM7Prod.category} · ${state.m7Platform}</div>
                <div style="font-size:11px;color:var(--blue-hover);margin-top:2px;">主体外观锁定，防止出图变形</div>
              </div>
            </div>

            <div class="field"><label>套图工作流模板</label>
              <select id="m7ImgWfSel" class="select">
                <option ${state.m7ImgWorkflow.includes("白底")?"selected":""}>标准白底主图 + 4张场景卖点附图模板</option>
                <option ${state.m7ImgWorkflow.includes("场景")?"selected":""}>欧美居家生活方式高转化套图模板</option>
              </select>
            </div>

            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>视觉风格</label>
                <select id="m7ImgStyleSel" class="select">
                  ${styleOptions.map(op => `<option ${state.m7ImgStyle===op?"selected":""}>${op}</option>`).join("")}
                </select>
              </div>
              <div class="field"><label>机位视角</label>
                <select id="m7ImgAngleSel" class="select">
                  ${angleOptions.map(op => `<option ${state.m7ImgAngle===op?"selected":""}>${op}</option>`).join("")}
                </select>
              </div>
            </div>

            <div class="field">
              <label>输出画幅比例</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${ratioOptions.map(rt => `<button type="button" class="m7-chip ${state.m7ImgRatio===rt?"active":""} m7-ratio-chip" data-r="${rt}">${rt}</button>`).join("")}
              </div>
            </div>

            <div class="field">
              <label>负向避坑约束（点击开关）</label>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                ${negativePresets.map(ng => {
                  const active = (state.m7ImgNegatives || []).includes(ng);
                  return `<button type="button" class="m7-chip ${active?"danger":""} m7-neg-chip" data-n="${ng}">${active?"✕ ":"+ "}${ng}</button>`;
                }).join("")}
              </div>
            </div>

            <div class="field">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label style="margin:0;">当前图位设计要求（${pickedImg.label}）</label>
                <button type="button" class="btn btn-sm" id="m7ResetBriefBtn">↺ 恢复推荐文案</button>
              </div>
              <textarea id="m7ImgBriefInput" class="textarea" rows="3">${curSlotBrief}</textarea>
              <div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">点击右侧任意图位即可切换并独立编辑要求。</div>
            </div>

            <div class="formula-box" style="margin-bottom:10px;">
              <strong>当前选中图位：</strong>${pickedImg.label}<br/>
              当前状态：<strong>${pickedImg.done ? (pickedImg.edited ? "✓ 已完成局部精修对比（演示图）" : "✓ 已生成差异化套图（演示图）") : "待生成（请点右上角生成按钮）"}</strong>
            </div>
            <div style="display:flex;flex-direction:column;gap:7px;">
              <button class="btn btn-primary" id="m7RegenSlotBtn" style="width:100%;justify-content:center;" ${(!canCreate || !pickedImg.done)?"disabled":""}>🔄 仅重绘当前图位（保持其余 4 张不变）</button>
              <button class="btn btn-sm" id="m7EditPickedBtn" style="width:100%;justify-content:center;" ${(!canCreate || !pickedImg.done)?"disabled":""}>✏️ 局部修改当前选中图位（修改前后对比）</button>
              <button class="btn btn-sm" id="m7GotoM7c" style="width:100%;justify-content:center;">进入第 3 步：制作短视频与 A+ 详情页 →</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">1 张白底主图 + 4 张不同构图附图（第 ${state.m7ImgVersion} 版 · 演示图）</div>
              <span class="pill ${anyImgDone?"p-green":"p-amber"}">${anyImgDone?"5 张已出图 (演示图)":"待点击右上角生成套图"}</span>
            </div>

            ${!anyImgDone ? `
              <div style="padding:36px 20px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:10px;">
                <img src="${prodImg}" style="width:76px;height:76px;border-radius:12px;margin-bottom:10px;opacity:0.75;" alt="${curM7Prod.name}"/>
                <div style="font-weight:700;font-size:14.5px;margin-bottom:5px;">「${curM7Prod.name}」的 5 张电商套图尚未生成 (0/5)</div>
                <div style="font-size:12.5px;color:var(--text-soft);margin-bottom:12px;">将一次性生成：①白底主图、②使用场景图、③核心卖点标注图、④尺寸规格标尺图、⑤包装清单图。</div>
                <button class="btn btn-primary btn-sm" id="m7EmptyImgGenBtn" ${!canCreate?"disabled":""}>✨ 立即生成 1+4 差异化电商套图</button>
              </div>
            ` : `
              <div class="gallery-1plus4">
                ${(() => {
                  const m = state.m7Images[0];
                  const slot0Url = getM7SlotImg(curM7Prod, 0, m.edited);
                  return `
                    <div class="gal-tile large ${pickedIdx===0?"picked":""}" data-imgi="0">
                      <div class="gal-canvas" style="background:#fff;position:relative;">
                        <span class="pill p-gray" style="position:absolute;top:8px;left:8px;font-size:10.5px;">演示图 · ${state.m7ImgRatio.split(" ")[0]}</span>
                        <img src="${slot0Url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="${m.label}"/>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div><strong>${m.label}</strong> <span style="font-size:12px;color:var(--text-soft)">${m.editNote}</span></div>
                        <span class="pill p-green">${m.edited?"已局部精修 ✓":"主图 · 演示图"}</span>
                      </div>
                    </div>
                  `;
                })()}

                <div class="gallery-4small">
                  ${state.m7Images.slice(1).map((m, idx) => {
                    const realIdx = idx + 1;
                    const slotUrl = getM7SlotImg(curM7Prod, realIdx, m.edited);
                    return `
                      <div class="gal-tile ${pickedIdx===realIdx?"picked":""}" data-imgi="${realIdx}">
                        <div class="gal-canvas" style="background:#f8fafc;position:relative;">
                          <span class="pill p-gray" style="position:absolute;top:6px;left:6px;font-size:10px;">演示图</span>
                          <img src="${slotUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" alt="${m.label}"/>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                          <strong style="font-size:12px;">${m.label}</strong>
                          <span class="pill p-green">${m.edited?"已精修✓":"演示图✓"}</span>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `}
          </div>
        </div>

        ${anyImgDone ? `
          <div class="card" style="margin-top:14px;">
            <div class="card-header">
              <div>
                <div class="card-title">🧩 系统 Prompt 编排可视化（业务参数 → 生图指令）</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">已结构化组装：风格「${state.m7ImgStyle}」· 视角「${state.m7ImgAngle}」· 画幅「${state.m7ImgRatio}」· 负向避坑 ${(state.m7ImgNegatives||[]).length} 项</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span class="pill p-amber">演示模拟：未调用真实图像服务</span>
                <button type="button" class="btn btn-sm" id="m7ToggleAdvPromptBtn">${state.m7ShowAdvPrompt ? "收起原始拼接细节 ▲" : "展开高级拼接细节 ▼"}</button>
              </div>
            </div>
            ${state.m7ShowAdvPrompt ? `
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${state.m7Images.map((im, i) => {
                  const slotText = state.m7ImgBriefs[i] || DEFAULT_M7_IMG_BRIEFS[i];
                  const negStr = (state.m7ImgNegatives || []).join(", ") || "none";
                  const copyTag = (state.m7ImgSyncCopy && i >= 1 && state.m7SelectedBullets) ? ` + [M7-1 Copy: ${state.m7SelectedBullets.slice(0, 48)}...]` : "";
                  const assembled = `[${platPrefix}] + [${wfStyleToken}] + [Style: ${state.m7ImgStyle} | Angle: ${state.m7ImgAngle} | Ratio: ${state.m7ImgRatio}] + [Subject: ${curM7Prod.sku} ${curM7Prod.name}] + [Slot ${i + 1} (${im.label}): ${slotText}]${copyTag} --no [${negStr}]`;
                  return `
                    <div style="padding:9px 12px;border-radius:8px;border:1px solid ${pickedIdx===i?"var(--blue)":"var(--border)"};background:${pickedIdx===i?"#eff6ff":"#f8fafc"};font-size:12px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <strong>图位 ${i + 1} · ${im.label}</strong>
                        <span class="pill p-gray">演示模拟参数</span>
                      </div>
                      <div style="color:var(--text-muted);margin-bottom:4px;"><strong>你的业务要求：</strong>${slotText}</div>
                      <div style="font-family:ui-monospace,monospace;font-size:11.5px;background:#fff;padding:6px 8px;border-radius:6px;border:1px solid var(--border);word-break:break-word;">${assembled}</div>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : ""}
          </div>
        ` : ""}

        <div class="grid-2" style="margin-top:14px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title">🖥️ ComfyUI 算力池、工作流版本与批量执行台</div>
              <span class="pill p-blue">当前工作流：${state.m7ActiveWorkflowVer}</span>
            </div>
            <div class="table-wrap" style="margin-bottom:10px;">
              <table>
                <thead><tr><th>节点名称 / 版本</th><th>显存占用</th><th>队列</th><th>状态与调度</th></tr></thead>
                <tbody>
                  ${state.m7GpuPool.map((g, gi) => `
                    <tr style="${!g.healthy?"background:#fef2f2;":""}">
                      <td><strong>${g.id}</strong><div style="font-size:11px;color:var(--text-soft);">${g.model} · ${g.ver}</div></td>
                      <td>${g.vramUsed}</td>
                      <td>${g.queue} 个</td>
                      <td>
                        <span class="pill ${g.healthy?"p-green":"p-red"}">${g.healthy?"健康可接单":"掉线(降级备用)"}</span>
                        <button class="btn btn-sm m7-gpu-toggle" data-gi="${gi}" style="margin-left:4px;">${g.healthy?"模拟掉线":"恢复节点"}</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <div class="field" style="margin-bottom:8px;">
              <label>工作流注册表版本切换</label>
              <select id="m7WfRegSel" class="select">
                ${state.m7WorkflowRegistry.map(wf => `
                  <option value="${wf.id}" ${state.m7ActiveWorkflowVer===wf.id?"selected":""}>${wf.id} · ${wf.name}（${wf.status} · 需显存 ${wf.vramNeed}）</option>
                `).join("")}
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${state.m7BatchJobs.map(b => `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 9px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:${b.ok?"#f8fafc":"#fef2f2"};">
                  <div><strong>${b.sku}</strong> · ${b.node} · ${b.wf} <span style="color:var(--text-soft);">(种子 ${b.seed})</span></div>
                  <span class="pill ${b.ok?"p-green":"p-red"}">${b.status}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">🏷️ AI 人物图片合规元数据校验（IPTC / XMP 终检）</div>
              <span class="pill ${!state.m7AiPersonInAsset?"p-gray":(state.m7IptcWritten && !state.m7IptcDamagedByCrop)?"p-green":"p-red"}">
                ${!state.m7AiPersonInAsset?"不含AI人物":(state.m7IptcWritten && !state.m7IptcDamagedByCrop)?"最终文件校验通过":"元数据缺失/受损拦截"}
              </span>
            </div>
            <div class="formula-box" style="margin-bottom:10px;line-height:1.7;">
              • <strong>最终保存写入节点：</strong>ComfyUI_EU_AI_Label（置于工作流最末端防被覆盖）<br/>
              • <strong>AI 生成媒体标记 (trainedAlgorithmicMedia)：</strong>${(state.m7IptcWritten && !state.m7IptcDamagedByCrop) ? '<span style="color:var(--green-text);font-weight:700;">已写入 ✓</span>' : '<span style="color:var(--red-text);font-weight:700;">未写入/裁剪丢失 ✗</span>'}<br/>
              • <strong>合成人物声明 (contains-synthetic-performer)：</strong>${!state.m7AiPersonInAsset ? "本批无人物出镜（无需）" : (state.m7IptcWritten && !state.m7IptcDamagedByCrop) ? '<span style="color:var(--green-text);font-weight:700;">已写入 ✓</span>' : '<span style="color:var(--red-text);font-weight:700;">缺失阻断上架 ✗</span>'}
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;margin-bottom:10px;cursor:pointer;">
              <input type="checkbox" id="m7AiPersonChk" ${state.m7AiPersonInAsset?"checked":""}/> 本套图包含 AI 合成模特/人物出镜（须强制携带合规元数据）
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
              <button type="button" class="btn btn-sm" id="m7SimCropLossBtn">✂️ 模拟裁剪转码导致标签丢失</button>
              <button type="button" class="btn btn-sm btn-primary" id="m7RewriteIptcBtn" ${!canCreate?"disabled":""}>✓ 重新写入元数据并校验</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.getElementById("m7ImgSyncCopyChk").onchange = (e) => { state.m7ImgSyncCopy = e.target.checked; rerender(); };
        document.getElementById("m7ImgWfSel").onchange = (e) => { state.m7ImgWorkflow = e.target.value; rerender(); };
        document.getElementById("m7ImgStyleSel").onchange = (e) => { state.m7ImgStyle = e.target.value; rerender(); };
        document.getElementById("m7ImgAngleSel").onchange = (e) => { state.m7ImgAngle = e.target.value; rerender(); };
        document.querySelectorAll(".m7-ratio-chip").forEach(b => b.onclick = () => { state.m7ImgRatio = b.dataset.r; rerender(); });
        document.querySelectorAll(".m7-neg-chip").forEach(b => b.onclick = () => {
          const cur = Array.isArray(state.m7ImgNegatives) ? [...state.m7ImgNegatives] : [];
          const val = b.dataset.n;
          const idx = cur.indexOf(val);
          if (idx >= 0) cur.splice(idx, 1); else cur.push(val);
          state.m7ImgNegatives = cur;
          rerender();
        });
        const togAdvBtn = document.getElementById("m7ToggleAdvPromptBtn");
        if (togAdvBtn) togAdvBtn.onclick = () => { state.m7ShowAdvPrompt = !state.m7ShowAdvPrompt; rerender(); };
        const regenSlotBtn = document.getElementById("m7RegenSlotBtn");
        if (regenSlotBtn) regenSlotBtn.onclick = () => {
          state.m7ImgVersion += 1;
          pickedImg.done = true;
          pickedImg.edited = true;
          pickedImg.editNote = `单图重绘 v${state.m7ImgVersion} (${state.m7ImgStyle})`;
          invalidateM7ApprovalIfNeeded(state);
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 单独重绘了 ${curM7Prod.sku} 的「${pickedImg.label}」（其余 4 张不变）`, ok: true });
          rerender();
          toast(`已单独重绘「${pickedImg.label}」（第 ${state.m7ImgVersion} 版），其余 4 张图保持不变 ✓`, "success");
        };
        const briefEl = document.getElementById("m7ImgBriefInput");
        if (briefEl) {
          briefEl.oninput = (e) => {
            state.m7ImgBriefs[pickedIdx] = e.target.value;
            state.m7ImgBrief = e.target.value;
          };
        }
        const resetBriefBtn = document.getElementById("m7ResetBriefBtn");
        if (resetBriefBtn) {
          resetBriefBtn.onclick = () => {
            state.m7ImgBriefs[pickedIdx] = DEFAULT_M7_IMG_BRIEFS[pickedIdx];
            state.m7ImgBrief = DEFAULT_M7_IMG_BRIEFS[pickedIdx];
            rerender();
            toast(`已恢复「${pickedImg.label}」推荐设计要求说明`, "info");
          };
        }
        document.querySelectorAll(".gal-tile").forEach(el => el.onclick = () => {
          const nextIdx = Number(el.dataset.imgi);
          state.m7PickedImgIdx = nextIdx;
          state.m7ImgBrief = state.m7ImgBriefs[nextIdx] || DEFAULT_M7_IMG_BRIEFS[nextIdx];
          rerender();
        });
        document.getElementById("m7GotoM7c").onclick = () => goPage("m7c");
        const empImgBtn = document.getElementById("m7EmptyImgGenBtn");
        if (empImgBtn) empImgBtn.onclick = () => {
          runAsyncTask("m7_img_batch", {
            label: `商品 1+4 电商套图生成 · ${curM7Prod.sku}`,
            steps: ["调度 ComfyUI 工作流 WF-IMG-v2.1", "生成 5 张不同构图电商图", "写入合规元数据"],
            durationMs: 950,
            onSuccess: () => {
              state.m7ImgVersion += 1;
              state.m7Images.forEach((im, idx) => { im.done = true; im.edited = false; im.editNote = idx===0 ? `白底棚拍主图 v${state.m7ImgVersion}` : `第 ${state.m7ImgVersion} 版差异化附图`; });
              return { summary: "已完成 5 张差异化套图生成（演示图）", toastMsg: "1+4 差异化套图已就绪 ✓" };
            }
          });
        };
        document.querySelectorAll(".m7-gpu-toggle").forEach(b => b.onclick = () => {
          const g = state.m7GpuPool[Number(b.dataset.gi)];
          g.healthy = !g.healthy; if (!g.healthy) g.queue = 0;
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} ${g.healthy ? "恢复" : "模拟掉线"}算力节点 ${g.id}`, ok: g.healthy });
          rerender();
        });
        document.getElementById("m7WfRegSel").onchange = (e) => { state.m7ActiveWorkflowVer = e.target.value; rerender(); toast(`工作流版本已切换为 ${state.m7ActiveWorkflowVer}`); };
        document.getElementById("m7AiPersonChk").onchange = (e) => { state.m7AiPersonInAsset = e.target.checked; rerender(); };
        document.getElementById("m7SimCropLossBtn").onclick = () => {
          state.m7IptcDamagedByCrop = true; state.m7IptcWritten = false; state.m7ApprovalRecord = null; state.m7ComplianceStatus = "校验未通过";
          rerender(); toast("裁剪后元数据丢失！已触发阻断", "error");
        };
        document.getElementById("m7RewriteIptcBtn").onclick = () => {
          state.m7IptcDamagedByCrop = false; state.m7IptcWritten = true;
          rerender(); toast("已写入合规元数据并通过最终文件读回校验 ✓", "success");
        };
        document.getElementById("m7EditPickedBtn").onclick = () => {
          const beforeUrl = getM7SlotImg(curM7Prod, pickedImg.id, false);
          const afterUrl = getM7SlotImg(curM7Prod, pickedImg.id, true);
          commitAction({
            title: `局部修改对比 · ${pickedImg.label}`,
            summary: "仅重绘当前图位（提亮产品光泽、优化高光边角），其余 4 张合格图片保持不变。",
            confirmText: "应用局部修改结果",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;margin-bottom:10px;">
                <div style="text-align:center;border:1px solid var(--border);border-radius:8px;padding:8px;">
                  <div style="font-size:12px;font-weight:700;margin-bottom:4px;">修改前 (原图)</div>
                  <img src="${beforeUrl}" style="width:140px;height:140px;object-fit:contain;" alt="修改前"/>
                </div>
                <div style="text-align:center;border:1px solid #86efac;background:#f0fdf4;border-radius:8px;padding:8px;">
                  <div style="font-size:12px;font-weight:700;color:var(--green-text);margin-bottom:4px;">修改后 (精修去反光+暖光质感)</div>
                  <img src="${afterUrl}" style="width:140px;height:140px;object-fit:contain;" alt="修改后"/>
                </div>
              </div>
              <div class="field"><label>局部修改指令 *</label><textarea id="inpaintPrompt" class="textarea">去掉多余反光标签，提亮产品主体的边缘质感与背景氛围光</textarea></div>
            `,
            validate: (wrap) => {
              const el = wrap.querySelector("#inpaintPrompt");
              return el.value.trim() ? [] : [{ el, msg: "请填写局部修改要求" }];
            },
            onConfirm: () => {
              state.m7ImgVersion += 1;
              pickedImg.done = true;
              pickedImg.edited = true;
              pickedImg.editNote = `已局部精修对比 (第 ${state.m7ImgVersion} 版)`;
              return { toastMsg: `已完成「${pickedImg.label}」局部精修对比（其余 4 张不变）` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 对 ${curM7Prod.sku} 的「${pickedImg.label}」提交了局部修改：${wrap.querySelector("#inpaintPrompt").value.trim()}`,
              ok: true
            })
          });
        };
      }
    };
  }

  // ==================== M7-3: 可交互 15 秒短视频播放器 + 可视化 A+ 图文长页生成 ====================
  if (pageId === "m7c") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const isFailMode = state.m7VidWorkflow.includes("未配置");
    const tSec = Number(state.m7VidTimeSec) || 0;
    const segIdx = tSec < 5 ? 0 : tSec < 10 ? 1 : 2;
    if (!Array.isArray(state.m7VidSegs) || state.m7VidSegs.length !== 3) {
      state.m7VidSegs = buildDefaultM7VidSegs(curM7Prod);
    }
    const segData = state.m7VidSegs;
    const curSeg = segData[segIdx] || segData[0];
    const curFrameSlotIdx = Math.max(0, Math.min(4, Number(curSeg.slot) || 0));
    const curFrameImg = getM7SlotImg(curM7Prod, curFrameSlotIdx, state.m7Images[curFrameSlotIdx]?.edited);
    const imgDoneCount = state.m7Images.filter(x => x.done).length;
    const motionOptions = ["微距慢推", "平滑横移", "稳态展示", "轻缓拉远"];
    const voiceOptions = ["美式女声 · 亲和推荐", "美式男声 · 专业测评", "无配音 · 纯字幕节奏"];
    const bgmOptions = ["轻快居家 Acoustic", "科技极简电子感", "无背景音 · 原声"];

    return {
      headerActions: [
        { label: "← 第 2 步：1+4 套图", primary: false, onClick: () => goPage("m7b") },
        { label: "第 4 步：合规总览与导出 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}
        ${renderAsyncBox("m7_vid")}

        <div class="m7-relay-bar">
          <div>
            <strong>📥 本步输入来源：</strong>
            已联动 M7-2 套图（<strong>${imgDoneCount}/5 张</strong>可供分镜选用）与 M7-1 文案（${state.m7SelectedTitle ? "已选定标题/五点，可一键填入分镜字幕" : "尚未选定 M7-1 文案，当前使用默认分镜脚本"}）。
          </div>
          <span class="pill p-blue">支持分镜画面/运镜/字幕独立微调与单镜重做</span>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">第 3 步：短视频与 A+ 详情页创作</div></div>
            <div class="field"><label>制作商品</label><input class="input" readonly value="${curM7Prod.sku} · ${curM7Prod.name}" /></div>
            <div class="field">
              <label>短视频脚本风格</label>
              <div class="grid-2" style="gap:8px;">
                ${["产品展示", "开箱测评", "场景种草", "卖点快剪"].map(vt => `
                  <div class="option-tile ${state.m7VidType===vt?"active":""} m7-vtype" data-t="${vt}"><strong style="font-size:12.5px;">${vt}</strong></div>
                `).join("")}
              </div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>配音音色</label>
                <select id="m7VidVoiceSel" class="select">
                  ${voiceOptions.map(op => `<option ${state.m7VidVoice===op?"selected":""}>${op}</option>`).join("")}
                </select>
              </div>
              <div class="field"><label>背景音乐</label>
                <select id="m7VidBgmSel" class="select">
                  ${bgmOptions.map(op => `<option ${state.m7VidBgm===op?"selected":""}>${op}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="field"><label>视频渲染服务模式</label>
              <select id="m7VidWfSel" class="select">
                <option value="ok" ${!isFailMode?"selected":""}>模拟已配置视频服务（可播放 15 秒分镜成片）</option>
                <option value="fail" ${isFailMode?"selected":""}>未配置视频生成节点（测试如实阻断报错）</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-primary" id="m7GenVidBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>🎬 生成 15 秒种草短视频 (含分镜字幕)</button>
              <button class="btn btn-success" id="m7GenAplusBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>${state.m7AplusDone?"✓ 已生成 A+ 图文详情页（点击刷新）":"📄 一键生成可视化 A+ 图文详情长页"}</button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:14px;min-width:0;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">🎬 15 秒竖屏短视频交互预览器 (${state.m7VidType})</div>
                <span class="pill ${state.m7VidDone?"p-green":"p-amber"}">${state.m7VidDone?"成片可播放":"待生成视频"}</span>
              </div>
              ${!state.m7VidDone ? `
                ${isFailMode ? `
                  <div class="banner banner-red"><span><strong>服务未配置阻断：</strong>当前选择了「未配置视频生成节点」，系统如实拦截不产出空视频；切回「模拟已配置视频服务」即可生成并播放 15 秒分镜。</span></div>
                ` : `
                  <div style="padding:26px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:10px;">
                    <div style="font-weight:700;margin-bottom:6px;">尚未生成「${curM7Prod.name}」的 15 秒种草视频</div>
                    <div style="font-size:12.5px;color:var(--text-soft);">点击左侧「🎬 生成 15 秒种草短视频」，即可在线播放与编辑 3 段分镜动画及双语字幕。</div>
                  </div>
                `}
              ` : `
                <div class="grid-2" style="gap:14px;align-items:start;">
                  <div class="vid-player-frame">
                    <div class="vid-stage" style="background:${curSeg.bg};">
                      <span class="pill p-blue" style="position:absolute;top:10px;left:10px;">${curSeg.range} · ${curSeg.title}</span>
                      <span class="pill p-gray" style="position:absolute;top:38px;left:10px;font-size:10.5px;">演示视频 · ${curSeg.motion || "微距慢推"}</span>
                      <span class="pill ${state.m7VidPlaying?"p-green":"p-gray"}" style="position:absolute;top:10px;right:10px;">${state.m7VidPlaying?"● 播放中":"⏸ 已暂停"}</span>
                      <img src="${curFrameImg}" alt="${curM7Prod.name}" style="${state.m7VidPlaying?"transform:scale(1.06);transition:transform 0.6s ease;":""}"/>
                      <div class="vid-sub-bar">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:2px;">
                          <span style="font-size:10px;color:#93c5fd;">${state.m7VidVoice} · ${state.m7VidBgm}</span>
                        </div>
                        <div style="font-weight:700;">${curSeg.subEN}</div>
                        <div style="font-size:11px;color:#cbd5e1;">${curSeg.subCN}</div>
                      </div>
                    </div>
                    <div class="vid-controls">
                      <button type="button" class="btn btn-sm btn-primary" id="m7VidPlayBtn">${state.m7VidPlaying ? "⏸ 暂停" : "▶ 播放 15s 预览"}</button>
                      <div style="flex:1;height:6px;background:#334155;border-radius:999px;overflow:hidden;">
                        <div style="width:${Math.round((tSec/15)*100)}%;height:100%;background:#38bdf8;transition:width 0.3s linear;"></div>
                      </div>
                      <span style="font-size:12px;font-variant-numeric:tabular-nums;">${String(tSec).padStart(2,"0")}:00 / 15:00</span>
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:8px;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
                      <div style="font-weight:700;font-size:13px;">点击分镜跳转，或直接改画面/字幕：</div>
                      <span class="pill p-gray" style="font-size:10.5px;">演示脚本可实时编辑</span>
                    </div>
                    ${segData.map((sg, idx) => {
                      const slotObj = state.m7Images[Number(sg.slot)] || state.m7Images[0];
                      return `
                        <div class="m7-seg-card ${segIdx===idx?"active":""}">
                          <div style="display:flex;gap:6px;align-items:center;justify-content:space-between;margin-bottom:6px;">
                            <button type="button" class="btn btn-sm m7-vid-seg" data-sec="${idx*5}" style="flex:1;justify-content:flex-start;text-align:left;${segIdx===idx?"border-color:var(--blue);background:var(--blue-bg);color:var(--blue-hover);":""}">
                              <strong>${sg.range}</strong> · ${sg.title}（${slotObj?.label || `图位${Number(sg.slot)+1}`}）
                            </button>
                            <button type="button" class="btn btn-sm m7-regen-seg" data-segi="${idx}" title="仅重做该镜" ${!canCreate?"disabled":""}>🔄 重做本镜</button>
                          </div>
                          <div class="grid-2" style="gap:6px;margin-bottom:6px;">
                            <select class="select m7-seg-slot" data-segi="${idx}" style="font-size:11.5px;padding:4px 6px;">
                              ${state.m7Images.map((im, si) => `<option value="${si}" ${Number(sg.slot)===si?"selected":""}>画面：图位${si+1} ${im.label}</option>`).join("")}
                            </select>
                            <select class="select m7-seg-motion" data-segi="${idx}" style="font-size:11.5px;padding:4px 6px;">
                              ${motionOptions.map(mo => `<option ${sg.motion===mo?"selected":""}>运镜：${mo}</option>`).join("")}
                            </select>
                          </div>
                          <input class="input m7-seg-en" data-segi="${idx}" value="${sg.subEN}" placeholder="英文字幕..." style="font-size:11.5px;padding:4px 7px;margin-bottom:4px;"/>
                          <div style="display:flex;gap:5px;align-items:center;">
                            <input class="input m7-seg-cn" data-segi="${idx}" value="${sg.subCN}" placeholder="中文字幕..." style="font-size:11.5px;padding:4px 7px;flex:1;"/>
                            <button type="button" class="btn btn-sm m7-pull-copy-seg" data-segi="${idx}" style="font-size:11px;padding:4px 7px;">📥 引用M7-1</button>
                          </div>
                        </div>
                      `;
                    }).join("")}
                    <div style="font-size:12px;color:var(--text-muted);background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;line-height:1.6;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <strong>🎞️ 本视频使用的素材来源</strong>
                        <span class="pill p-gray" style="font-size:10.5px;">与上方分镜卡片实时同步</span>
                      </div>
                      ${segData.map((sg, idx) => `• ${sg.range} 分镜${idx+1} → M7-2 图位${Number(sg.slot)+1}（${state.m7Images[Number(sg.slot)]?.label || "主图"} · ${sg.motion || "微距慢推"}）`).join("<br/>")}
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;line-height:1.6;">
                      <strong>分镜一致性校验：</strong>3 段镜头主体外观一致 ✓<br/>
                      ${(state.m7VidLogs || []).slice(-2).join("<br/>")}
                    </div>
                  </div>
                </div>
              `}
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">📄 平台 A+ 图文详情页实时预览</div>
                <span class="pill ${state.m7AplusDone?"p-green":"p-amber"}">${state.m7AplusDone?"A+ 模块已写入清单":"待生成 A+ 长页"}</span>
              </div>
              ${!state.m7AplusDone ? `
                <div style="padding:20px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:8px;font-size:12.5px;color:var(--text-soft);">
                  尚未生成 A+ 图文模块，点击左侧「📄 一键生成可视化 A+ 图文详情长页」即可自动组装品牌横幅、场景卖点与参数对比表。
                </div>
              ` : `
                <div class="aplus-preview-wrap">
                  <div class="aplus-hero">
                    <div>
                      <span class="pill p-blue" style="margin-bottom:6px;">BRAND A+ STORY · ${curM7Prod.category}</span>
                      <div style="font-size:16px;font-weight:800;">${curM7Prod.name} (${curM7Prod.sku})</div>
                      <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">${state.m7SelectedTitle || "专为日常高频场景打造 · 严选合规品质"}</div>
                    </div>
                    <img src="${getM7SlotImg(curM7Prod, 0, false)}" style="width:90px;height:90px;border-radius:10px;background:#fff;padding:4px;" alt="A+主图"/>
                  </div>
                  <div class="grid-2" style="gap:10px;">
                    <div style="border:1px solid var(--border);border-radius:8px;padding:10px;background:#f8fafc;display:flex;gap:10px;align-items:center;">
                      <img src="${getM7SlotImg(curM7Prod, 1, false)}" style="width:68px;height:68px;border-radius:8px;object-fit:contain;" alt="场景图"/>
                      <div style="font-size:12px;"><strong>模块 1 · 沉浸场景展示</strong><div style="color:var(--text-muted);margin-top:2px;">融入居家/桌面真实环境，降低买家想象门槛。</div></div>
                    </div>
                    <div style="border:1px solid var(--border);border-radius:8px;padding:10px;background:#f8fafc;display:flex;gap:10px;align-items:center;">
                      <img src="${getM7SlotImg(curM7Prod, 2, false)}" style="width:68px;height:68px;border-radius:8px;object-fit:contain;" alt="卖点图"/>
                      <div style="font-size:12px;"><strong>模块 2 · 核心性能对比</strong><div style="color:var(--text-muted);margin-top:2px;">直观呈现效率提升与耐用结构优势。</div></div>
                    </div>
                  </div>
                  <div class="table-wrap" style="margin-top:10px;">
                    <table>
                      <thead><tr><th>规格参数对比</th><th>${curM7Prod.sku} 升级款</th><th>普通市场常规款</th></tr></thead>
                      <tbody>
                        <tr><td>核心材质与耐用性</td><td><strong>加厚环保级材质 ✓</strong></td><td>易损耗普通材质</td></tr>
                        <tr><td>装箱配件与质保</td><td><strong>全套配件 + 1年售后 ✓</strong></td><td>单机无备件</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              `}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.querySelectorAll(".m7-vtype").forEach(el => el.onclick = () => { state.m7VidType = el.dataset.t; rerender(); });
        document.getElementById("m7VidVoiceSel").onchange = (e) => { state.m7VidVoice = e.target.value; rerender(); };
        document.getElementById("m7VidBgmSel").onchange = (e) => { state.m7VidBgm = e.target.value; rerender(); };
        document.getElementById("m7VidWfSel").onchange = (e) => {
          state.m7VidWorkflow = e.target.value === "fail" ? "未配置视频生成节点（默认如实报错）" : "模拟已配置视频服务（可播放分镜演示）";
          if (e.target.value === "fail") { state.m7VidDone = false; state.m7VidPlaying = false; }
          rerender();
        };
        document.getElementById("m7GenVidBtn").onclick = () => {
          const failNow = state.m7VidWorkflow.includes("未配置");
          runAsyncTask("m7_vid", {
            label: `短视频制作任务 · ${curM7Prod.sku} (${state.m7VidType})`,
            steps: ["1. 分镜脚本准备与主图载入", `2. 3 段镜头生成（${state.m7VidVoice} · ${state.m7VidBgm}）`, "3. 双语字幕成片合成"],
            durationMs: 1100,
            shouldFail: failNow,
            failReason: "视频生成服务未配置，系统已如实停止输出，不会生成打不开的空文件。",
            onFail: () => { state.m7VidDone = false; state.m7VidPlaying = false; },
            onSuccess: () => {
              state.m7VidDone = true;
              state.m7VidTimeSec = 0;
              state.m7VidPlaying = true;
              state.m7VidLogs = [
                `• [${nowDateTimeStr()}] 阶段 1/3：分镜脚本准备完成（${state.m7VidType}）`,
                `• [${nowDateTimeStr()}] 阶段 2/3：3 段镜头生成完毕（${state.m7VidVoice}）`,
                `• [${nowDateTimeStr()}] 阶段 3/3：15秒双语字幕短视频合成完成 ✓`
              ];
              return { summary: "15 秒种草短视频生成成功，已自动开始播放分镜预览", toastMsg: "短视频生成完成并已写入交付清单！" };
            }
          });
        };
        document.getElementById("m7GenAplusBtn").onclick = () => {
          state.m7AplusDone = true;
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 生成了 ${curM7Prod.sku} 的可视化 A+ 图文详情页`, ok: true });
          rerender();
          toast("已生成可视化 A+ 图文详情长页并写入交付清单 ✓", "success");
        };
        const playBtn = document.getElementById("m7VidPlayBtn");
        if (playBtn) playBtn.onclick = () => {
          state.m7VidPlaying = !state.m7VidPlaying;
          rerender();
        };
        document.querySelectorAll(".m7-vid-seg").forEach(b => b.onclick = () => {
          state.m7VidTimeSec = Number(b.dataset.sec) || 0;
          rerender();
        });
        document.querySelectorAll(".m7-seg-slot").forEach(sel => sel.onchange = (e) => {
          const i = Number(sel.dataset.segi);
          state.m7VidSegs[i].slot = Number(e.target.value);
          state.m7VidTimeSec = i * 5;
          rerender();
        });
        document.querySelectorAll(".m7-seg-motion").forEach(sel => sel.onchange = (e) => {
          const i = Number(sel.dataset.segi);
          state.m7VidSegs[i].motion = e.target.value.replace(/^运镜：/, "");
          rerender();
        });
        document.querySelectorAll(".m7-seg-en").forEach(inp => inp.oninput = (e) => {
          state.m7VidSegs[Number(inp.dataset.segi)].subEN = e.target.value;
        });
        document.querySelectorAll(".m7-seg-cn").forEach(inp => inp.oninput = (e) => {
          state.m7VidSegs[Number(inp.dataset.segi)].subCN = e.target.value;
        });
        document.querySelectorAll(".m7-pull-copy-seg").forEach(b => b.onclick = () => {
          const i = Number(b.dataset.segi);
          const enFallback = i === 0 ? state.m7SelectedTitle : (state.m7SelectedBullets || state.m7SelectedTitle);
          const cnFallback = i === 0 ? state.m7SelectedTitleCn : (state.m7SelectedBulletsCn || state.m7SelectedTitleCn);
          if (!enFallback) {
            toast("M7-1 尚未选定标题或五点描述，请先去第 1 步写入文案", "error");
            return;
          }
          state.m7VidSegs[i].subEN = enFallback.slice(0, 72);
          if (cnFallback) state.m7VidSegs[i].subCN = cnFallback.replace(/【中文对照】/, "").slice(0, 46);
          state.m7VidTimeSec = i * 5;
          rerender();
          toast(`已从 M7-1 同步文案至分镜 ${i + 1} ✓`, "success");
        });
        document.querySelectorAll(".m7-regen-seg").forEach(b => b.onclick = () => {
          const i = Number(b.dataset.segi);
          state.m7VidTimeSec = i * 5;
          state.m7VidLogs = [
            ...(state.m7VidLogs || []),
            `• [${nowDateTimeStr()}] 单镜重做：${state.m7VidSegs[i].range}（图位${Number(state.m7VidSegs[i].slot)+1} · ${state.m7VidSegs[i].motion}）已刷新 ✓`
          ];
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 单独重做了 ${curM7Prod.sku} 短视频分镜 ${i + 1}`, ok: true });
          rerender();
          toast(`已单独重做分镜 ${i + 1}（其余分镜保持不变）✓`, "success");
        });
        if (typeof window !== "undefined") {
          if (state.m7VidDone && state.m7VidPlaying && !window.__m7VidTimer) {
            window.__m7VidTimer = setInterval(() => {
              if (state.pageId !== "m7c" || !state.m7VidPlaying) {
                clearInterval(window.__m7VidTimer);
                window.__m7VidTimer = null;
                return;
              }
              state.m7VidTimeSec = (state.m7VidTimeSec + 1) % 16;
              rerender();
            }, 950);
          } else if ((!state.m7VidPlaying || state.pageId !== "m7c") && window.__m7VidTimer) {
            clearInterval(window.__m7VidTimer);
            window.__m7VidTimer = null;
          }
        }
      }
    };
  }

  // ==================== M7-4: 上架前 8 项交付清单、规则矩阵与合规把关 + 可下载素材包 ====================
  if (pageId === "m7d") {
    const isApprover = state.role === "approver";
    const isCreator = state.role === "creator" || isApprover;
    const auxDoneCount = state.m7Images.slice(1).filter(i => i.done).length;
    const missingAux = state.m7Images.slice(1).filter(i => !i.done).map(i => i.label);

    const ruleMatrix = {
      "亚马逊美国站": {
        "厨房小电": { cert: "UL 电子安全测试 + FCC 射频/电磁兼容声明 + 能效标签", ver: "规则 v2026.11", eff: "2026-10-01" },
        "箱包出行": { cert: "CPSIA 儿童禁用邻苯声明（若含童款）+ 原产地水洗标", ver: "规则 v2026.09", eff: "2026-09-01" },
        "3C配件": { cert: "UL 2056 / UN38.3 锂电运输报告（若带电）+ FCC", ver: "规则 v2026.11", eff: "2026-10-15" },
        "美妆护肤": { cert: "FDA MoCRA 工厂与产品注册 + 全成分英文标签", ver: "规则 v2026.10", eff: "2026-07-01" },
      },
      "虾皮泰国站": {
        "厨房小电": { cert: "泰国 TISI 强制电器安全认证 + 泰文插头说明书", ver: "规则 v2026.10", eff: "2026-08-01" },
        "箱包出行": { cert: "常规纺织品申报（无需特殊前置认证）", ver: "规则 v2026.06", eff: "2026-06-01" },
        "3C配件": { cert: "NBTC 无线通信核准（蓝牙/WiFi类）", ver: "规则 v2026.10", eff: "2026-09-01" },
        "美妆护肤": { cert: "泰国 FDA 化妆品备案号 (อย.) 必填", ver: "规则 v2026.11", eff: "2026-10-01" },
      },
      "TikTok 美区": {
        "厨房小电": { cert: "UL/ETL 安全报告 + 店铺保证金门槛达标 + 短视频无夸大承诺", ver: "规则 v2026.11", eff: "2026-11-01" },
        "箱包出行": { cert: "品牌授权校验 + 实物与短视频画风一致性", ver: "规则 v2026.09", eff: "2026-09-01" },
        "3C配件": { cert: "FCC 声明 + 电池航运合规说明", ver: "规则 v2026.11", eff: "2026-10-15" },
        "美妆护肤": { cert: "FDA 备案 + 禁止医学疗效宣称", ver: "规则 v2026.11", eff: "2026-10-01" },
      }
    };
    const activeRule = (ruleMatrix[state.m7Platform] && ruleMatrix[state.m7Platform][state.m7ComplianceCategory]) || ruleMatrix["亚马逊美国站"]["厨房小电"];
    const hasExpiredCert = state.m7CertRecords.some(c => c.status === "已过期");
    const iptcOk = !state.m7AiPersonInAsset || (state.m7IptcWritten && !state.m7IptcDamagedByCrop);

    const checklist = [
      { label: "1. 商品标题", sub: state.m7SelectedTitle ? state.m7SelectedTitle.slice(0, 36) + "..." : "尚未选定标题（去第 1 步选取）", done: !!state.m7SelectedTitle, jump: "m7a" },
      { label: "2. 五点卖点描述", sub: state.m7SelectedBullets ? state.m7SelectedBullets.slice(0, 36) + "..." : "尚未选定五点描述", done: !!state.m7SelectedBullets, jump: "m7a" },
      { label: "3. 商品详情描述", sub: state.m7SelectedDesc ? state.m7SelectedDesc.slice(0, 36) + "..." : "尚未选定商品描述", done: !!state.m7SelectedDesc, jump: "m7a" },
      { label: "4. 后台搜索词", sub: state.m7SelectedKeywords ? state.m7SelectedKeywords.slice(0, 36) + "..." : "缺少 20 个研究搜索词", done: !!state.m7SelectedKeywords, jump: "m7a" },
      { label: "5. 商品主图 1 (白底)", sub: state.m7Images[0].done ? state.m7Images[0].editNote : "缺少商品主图 1（去第 2 步生成）", done: state.m7Images[0].done, jump: "m7b" },
      { label: `6. 差异化详情附图 (${auxDoneCount}/4张)`, sub: auxDoneCount === 4 ? "附图 2~5 已全部就绪" : `缺少：${missingAux.join("、")}（去第 2 步生成）`, done: auxDoneCount === 4, jump: "m7b" },
      { label: "7. A+ 图文页面", sub: state.m7AplusDone ? "图文详情模块已就绪 ✓" : "尚未生成 A+ 图文（点此一键生成）", done: state.m7AplusDone, jump: "aplus" },
      { label: "8. 商品种草短视频", sub: state.m7VidDone ? `15秒成片 (${state.m7VidType})` : "尚未生成（去第 3 步生成并播放）", done: state.m7VidDone, jump: "m7c" },
    ];
    const doneCnt = checklist.filter(c => c.done).length;

    const extChecklist = [
      { label: "扩展 1. 使用说明与 FAQ", tab: "使用说明与FAQ", val: state.m7SelectedFaq },
      { label: "扩展 2. A+ 模块文案", tab: "A+模块文案", val: state.m7SelectedAplusCopy },
      { label: "扩展 3. 规格变体命名", tab: "规格变体命名", val: state.m7SelectedVariantCopy },
      { label: "扩展 4. 后台属性说明", tab: "后台属性说明", val: state.m7SelectedAttrCopy },
      { label: "扩展 5. 图片 ALT 文本", tab: "图片ALT文本", val: state.m7SelectedAltCopy },
      { label: "扩展 6. 认证与保修说明", tab: "认证与保修说明", val: state.m7SelectedWarrantyCopy },
    ];
    const extDoneCnt = extChecklist.filter(x => !!x.val).length;
    const m0Prod = state.masterProducts.find(p => p.sku === curM7Prod.sku) || null;
    const buyerImgIdx = Math.min(4, Math.max(0, Number(state.m7BuyerImgIdx) || 0));
    const buyerVarList = Array.isArray(m0Prod?.variants) && m0Prod.variants.length ? m0Prod.variants : null;
    const buyerVarIdx = buyerVarList ? Math.min(buyerVarList.length - 1, Math.max(0, Number(state.m7BuyerVariantIdx) || 0)) : 0;
    const activeVariant = buyerVarList ? buyerVarList[buyerVarIdx] : null;
    const activePrice = activeVariant?.priceUsd ?? m0Prod?.salePriceUsd ?? null;
    const activeListPrice = activeVariant?.listPriceUsd ?? m0Prod?.listPriceUsd ?? null;
    const activeStock = activeVariant?.stock ?? m0Prod?.stockQty ?? null;
    const discountPct = (activePrice && activeListPrice && activeListPrice > activePrice)
      ? Math.round((1 - activePrice / activeListPrice) * 100)
      : null;

    const m0MissingBadge = `<button type="button" class="btn btn-sm m7d-jmp" data-pg="m0b" style="padding:2px 8px;font-size:11.5px;color:#b45309;background:#fffbeb;border-color:#fcd34d;">待补（去 M0-2）</button>`;

    const downloadDeliverableHtml = () => {
      if (typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return;
      const htmlDoc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${curM7Prod.sku} 合规上架素材交付包</title><style>body{font-family:sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#0f172a}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px}img{width:100%;border-radius:6px;border:1px solid #e2e8f0}.cn{color:#475569;font-size:13px;margin-top:4px}</style></head><body><h1>CrossPilot 合规上架素材交付包 · ${curM7Prod.sku} ${curM7Prod.name}</h1><p>目标平台：${state.m7Platform} ｜ 类目：${state.m7ComplianceCategory} ｜ 批准主管：${state.m7ApprovalRecord?.approver || "已校验"} (${nowDateTimeStr()})</p><div class="card"><h2>1. 多语言商品文案 (核心 4/4 + 扩展 ${extDoneCnt}/6)</h2><p><strong>标题：</strong>${state.m7SelectedTitle || "未填"}</p>${state.m7SelectedTitleCn?`<div class="cn">${state.m7SelectedTitleCn}</div>`:""}<p><strong>五点：</strong>${state.m7SelectedBullets || "未填"}</p>${state.m7SelectedBulletsCn?`<div class="cn">${state.m7SelectedBulletsCn}</div>`:""}<p><strong>详情：</strong>${state.m7SelectedDesc || "未填"}</p>${state.m7SelectedDescCn?`<div class="cn">${state.m7SelectedDescCn}</div>`:""}<p><strong>搜索词：</strong>${state.m7SelectedKeywords || "未填"}</p>${state.m7SelectedKeywordsCn?`<div class="cn">${state.m7SelectedKeywordsCn}</div>`:""}</div><div class="card"><h2>2. 1+4 差异化电商套图 (5/5 · 演示图)</h2><div class="grid">${state.m7Images.map((m, i) => `<div><img src="${getM7SlotImg(curM7Prod, i, m.edited)}"/><div style="font-size:12px;margin-top:4px;">${m.label}</div></div>`).join("")}</div></div><div class="card"><h2>3. A+ 详情与短视频交付</h2><p>A+ 图文长页：${state.m7AplusDone ? "已包含" : "未生成"} ｜ 15秒短视频：${state.m7VidDone ? state.m7VidType + " (3段分镜)" : "未生成"}</p></div></body></html>`;
      const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${curM7Prod.sku}_合规上架素材包.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    return {
      headerActions: [
        { label: state.m7ShowCN ? "🈶 隐藏中文对照" : "🈶 显示中文对照", primary: false, onClick: () => { state.m7ShowCN = !state.m7ShowCN; rerender(); } },
        { label: "← 第 3 步：视频与 A+", primary: false, onClick: () => goPage("m7c") },
        {
          label: "📦 导出合规上架素材包", primary: true,
          disabled: state.m7ComplianceStatus !== "主管已批准导出",
          disabledTitle: "必须先完成 8/8 创作、运行合规检查并由「主管 / 审批人」批准才可导出",
          onClick: () => {
            commitAction({
              title: `导出合规上架素材包 · ${curM7Prod.sku}`,
              summary: "将立即下载包含多语言文案、1+4 差异化套图与 A+/视频清单的可视化归档文件，供运营提交平台审核。",
              confirmText: "确认导出并下载素材包",
              fieldsHtml: `
                <div class="formula-box">
                  • <strong>归属商品：</strong>${curM7Prod.sku} · ${curM7Prod.name}<br/>
                  • <strong>适用站点与规则：</strong>${state.m7Platform} · ${state.m7ComplianceCategory}（${activeRule.ver}）<br/>
                  • <strong>批准主管：</strong>${state.m7ApprovalRecord?.approver}（${state.m7ApprovalRecord?.time}）<br/>
                  • <strong>导出包清单 (8+${extDoneCnt} 类)：</strong>核心 8 类资产 + ${extDoneCnt} 项扩展上架文案
                </div>
              `,
              onConfirm: () => {
                downloadDeliverableHtml();
                return { toastMsg: `已下载 ${curM7Prod.sku}_合规上架素材包.html (8+${extDoneCnt} 类资产)` };
              },
              audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 导出了 ${curM7Prod.sku} 的合规上架素材包（核心 8/8 + 扩展 ${extDoneCnt}/6）`, ok: true }
            });
          }
        }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}

        <div class="grid-2" style="margin-bottom:14px;align-items:stretch;">
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">🌐 站点 × 类目合规规则矩阵 & 资质有效期</div>
              <span class="pill p-blue">${activeRule.ver} · 生效 ${activeRule.eff}</span>
            </div>
            <div class="grid-2" style="gap:8px;margin-bottom:8px;">
              <div class="field" style="margin-bottom:0;"><label>目标站点（切换即同步规则）</label>
                <select id="m7dPlatSel" class="select">
                  <option ${state.m7Platform==="亚马逊美国站"?"selected":""}>亚马逊美国站</option>
                  <option ${state.m7Platform==="虾皮泰国站"?"selected":""}>虾皮泰国站</option>
                  <option ${state.m7Platform==="TikTok 美区"?"selected":""}>TikTok 美区</option>
                </select>
              </div>
              <div class="field" style="margin-bottom:0;"><label>商品所属类目</label>
                <select id="m7dCatSel" class="select">
                  ${["厨房小电","箱包出行","3C配件","美妆护肤"].map(c => `<option ${state.m7ComplianceCategory===c?"selected":""}>${c}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="formula-box" style="margin-bottom:8px;padding:7px 10px;">
              <strong>当前站点认证要求：</strong>${activeRule.cert}
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${state.m7CertRecords.map((cert, ci) => `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:${cert.status==="已过期"?"#fef2f2":"#f8fafc"};">
                  <div style="min-width:0;"><strong>${cert.name}</strong> <span style="color:var(--text-soft);">· ${cert.owner} · 到期 ${cert.expireDate}</span></div>
                  <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                    <span class="pill ${cert.status==="已过期"?"p-red":"p-green"}">${cert.status}</span>
                    <button type="button" class="btn btn-sm m7d-cert-toggle" data-ci="${ci}">${cert.status==="已过期"?"续期恢复":"模拟过期"}</button>
                  </div>
                </div>
              `).join("")}
            </div>
            ${state.m7Platform === "TikTok 美区" ? `
              <div style="margin-top:8px;padding:6px 10px;border-radius:7px;background:var(--amber-bg);font-size:12px;">
                <strong>TikTok Shop 保证金与违规监测：</strong>${state.m7TiktokDeposit.shop} 当前保证金 $${state.m7TiktokDeposit.depositUsd}（${state.m7TiktokDeposit.status} · 更新于 ${state.m7TiktokDeposit.dataUpdatedAt}）
              </div>
            ` : ""}
          </div>

          <div class="card card-blue" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div class="card-header">
                <div class="card-title">逐条合规检查与主管把关</div>
                <span class="pill ${state.m7ComplianceStatus==="主管已批准导出"?"p-green":state.m7ComplianceStatus==="合规校验通过"?"p-blue":"p-amber"}">${state.m7ComplianceStatus}</span>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.65;">
                ${state.m7ComplianceChecks.length ? state.m7ComplianceChecks.map(ch => `<div>• <strong>${ch.rule}：</strong><span style="color:${ch.pass?"var(--green-text)":"var(--red-text)"}">${ch.detail}</span></div>`).join("") : "请先完成第 1~3 步（核心 8/8 资产就绪）后，点击下方按钮运行逐条合规检查；校验通过后由「主管 / 审批人」批准导出。"}
                ${state.m7ApprovalRecord ? `<div style="margin-top:6px;color:var(--green-text);"><strong>✓ 主管已批准：</strong>${state.m7ApprovalRecord.approver} · ${state.m7ApprovalRecord.time}（${state.m7ApprovalRecord.note}）</div>` : ""}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px dashed var(--border-strong);">
              <button class="btn btn-primary btn-sm" id="m7RunCompBtn" ${!isCreator?"disabled":""}>1. 运行上架合规检查</button>
              <button class="btn btn-success btn-sm" id="m7ApprPubBtn" ${(!isApprover || state.m7ComplianceStatus!=="合规校验通过")?"disabled":""} title="${!isApprover?"需要「主管 / 审批人」权限":"需先通过第 1 步合规检查"}">2. 主管批准发布包</button>
            </div>
          </div>
        </div>

        <div class="split-right-panel">
          <div class="card" style="min-width:0;">
            <div class="card-header">
              <div style="min-width:0;">
                <strong style="font-size:15.5px;">${curM7Prod.sku} · ${curM7Prod.name} (${state.m7Platform}) 成品总览</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Lang} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 来自 M4 主管已同意测款":"在售老品翻新"}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已制作完成</span>
                ${extDoneCnt > 0 ? `<span class="pill p-blue">+${extDoneCnt} 扩展</span>` : ""}
              </div>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["主图/附图", "商品文案", "后台搜索词", "A+ 图文", "种草视频", "买家视角预览"].map(tb => `
                <div class="utab ${state.m7PreviewTab===tb?"active":""} m7d-ptab" data-t="${tb}">${tb}</div>
              `).join("")}
            </div>

            ${state.m7PreviewTab === "主图/附图" ? `
              ${!state.m7Images.some(x=>x.done) ? `
                <div style="padding:30px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:8px;">
                  <div style="font-weight:700;margin-bottom:6px;">套图尚未制作 (0/5)</div>
                  <button class="btn btn-primary btn-sm" id="m7dGoImgBtn">前往第 2 步生成 1+4 差异化套图 →</button>
                </div>
              ` : `
                <div class="gallery-1plus4">
                  <div class="gal-tile large picked">
                    <div class="gal-canvas" style="position:relative;">
                      <span class="pill p-gray" style="position:absolute;top:8px;left:8px;font-size:10.5px;">演示图</span>
                      <img src="${getM7SlotImg(curM7Prod, 0, state.m7Images[0].edited)}" style="width:100%;height:100%;object-fit:contain;" alt="商品主图 1"/>
                    </div>
                    <div style="font-size:12.5px;"><strong>${state.m7Images[0].label}</strong> (${state.m7Images[0].editNote})</div>
                  </div>
                  <div class="gallery-4small">
                    ${state.m7Images.slice(1).map((m, idx) => `
                      <div class="gal-tile">
                        <div class="gal-canvas" style="position:relative;">
                          <span class="pill p-gray" style="position:absolute;top:6px;left:6px;font-size:10px;">演示图</span>
                          <img src="${getM7SlotImg(curM7Prod, idx + 1, m.edited)}" style="width:100%;height:100%;object-fit:contain;opacity:${m.done?1:0.25};" alt="${m.label}"/>
                        </div>
                        <span style="font-size:12px;">${m.label} ${m.done?"✓":"(缺)"}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `}
            ` : state.m7PreviewTab === "商品文案" ? `
              <div style="display:flex;flex-direction:column;gap:10px;background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);overflow-wrap:anywhere;">
                <div>
                  <span class="pill p-blue">商品标题</span>
                  <div style="font-weight:700;margin-top:4px;">${state.m7SelectedTitle || "（未写入，请去第 1 步选定）"}</div>
                  ${state.m7ShowCN && state.m7SelectedTitleCn ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;">${state.m7SelectedTitleCn}</div>` : ""}
                </div>
                <div>
                  <span class="pill p-blue">五点描述</span>
                  <div style="margin-top:4px;">${state.m7SelectedBullets || "（未写入，请去第 1 步选定）"}</div>
                  ${state.m7ShowCN && state.m7SelectedBulletsCn ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;">${state.m7SelectedBulletsCn}</div>` : ""}
                </div>
                <div>
                  <span class="pill p-blue">商品详情描述</span>
                  <div style="margin-top:4px;">${state.m7SelectedDesc || "（未写入，请去第 1 步选定）"}</div>
                  ${state.m7ShowCN && state.m7SelectedDescCn ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;">${state.m7SelectedDescCn}</div>` : ""}
                </div>
                ${extDoneCnt > 0 ? `
                  <div style="border-top:1px dashed var(--border-strong);padding-top:10px;margin-top:4px;">
                    <span class="pill p-purple">已选扩展文案 (${extDoneCnt}/6)</span>
                    ${extChecklist.filter(x=>x.val).map(x => `<div style="font-size:12.5px;margin-top:6px;"><strong>${x.label}：</strong>${x.val}</div>`).join("")}
                  </div>
                ` : ""}
              </div>
            ` : state.m7PreviewTab === "后台搜索词" ? `
              <div style="background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);overflow-wrap:anywhere;">
                <span class="pill p-purple">后台搜索词</span>
                <div style="margin-top:8px;">${state.m7SelectedKeywords || "（未写入，请去第 1 步选定）"}</div>
                ${state.m7ShowCN && state.m7SelectedKeywordsCn ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:6px;">${state.m7SelectedKeywordsCn}</div>` : ""}
              </div>
            ` : state.m7PreviewTab === "A+ 图文" ? `
              ${state.m7AplusDone ? `
                <div class="aplus-preview-wrap">
                  <div class="aplus-hero">
                    <div><strong>${curM7Prod.name} · A+ 品牌详情横幅</strong><div style="font-size:12px;color:#cbd5e1;margin-top:4px;">已通过视觉排版与参数对比表校验</div></div>
                    <img src="${getM7SlotImg(curM7Prod, 1, false)}" style="width:76px;height:76px;border-radius:8px;background:#fff;" alt="A+预览"/>
                  </div>
                </div>
              ` : `<div style="padding:24px;text-align:center;background:#f8fafc;border-radius:8px;">A+ 图文尚未生成，可在右侧清单直接一键生成。</div>`}
            ` : state.m7PreviewTab === "种草视频" ? `
              ${state.m7VidDone ? `
                <div class="vid-player-frame">
                  <div class="vid-stage" style="height:210px;background:linear-gradient(135deg,#0f172a,#1e3a8a);">
                    <span class="pill p-green" style="position:absolute;top:10px;left:10px;">15s 成品可交付 (${state.m7VidType}) · 演示视频</span>
                    <img src="${getM7SlotImg(curM7Prod, 2, false)}" alt="${curM7Prod.name}"/>
                    <div class="vid-sub-bar"><strong>${curM7Prod.sku} · 3段分镜双语字幕成片</strong></div>
                  </div>
                </div>
              ` : `<div style="padding:24px;text-align:center;background:#f8fafc;border-radius:8px;">短视频尚未生成，请前往第 3 步生成。</div>`}
            ` : `
              <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;">
                <div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;">🛍️ 买家视角预览 · 预览，尚未发布（模拟 ${state.m7Platform} 详情页排版，非真实上架）</div>
                  <span class="pill p-amber">${m0Prod?.demoNote ? `含 M0-2 ${m0Prod.demoNote}` : "按 M0-2 商品主档实时渲染"}</span>
                </div>

                <div style="padding:12px;display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:14px;align-items:start;">
                  <div style="min-width:0;">
                    ${!state.m7Images.some(x=>x.done) ? `
                      <div style="padding:24px 10px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:8px;">
                        <div style="font-size:12px;font-weight:700;margin-bottom:6px;">商品主图与附图待生成</div>
                        <button type="button" class="btn btn-primary btn-sm m7d-jmp" data-pg="m7b">待补（去 M7-2）</button>
                      </div>
                    ` : `
                      <div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:#fff;position:relative;text-align:center;">
                        <span class="pill p-gray" style="position:absolute;top:6px;left:6px;font-size:10px;">演示图</span>
                        <img src="${getM7SlotImg(curM7Prod, buyerImgIdx, state.m7Images[buyerImgIdx]?.edited)}" style="width:100%;max-height:200px;object-fit:contain;" alt="买家视角主图"/>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:6px;">
                        ${state.m7Images.map((m, idx) => `
                          <button type="button" class="m7d-buyer-thumb" data-idx="${idx}" style="border:2px solid ${buyerImgIdx===idx?"var(--blue)":"var(--border)"};border-radius:6px;padding:2px;background:#fff;cursor:pointer;opacity:${m.done?1:0.35};">
                            <img src="${getM7SlotImg(curM7Prod, idx, m.edited)}" style="width:100%;height:34px;object-fit:contain;" alt="${m.label}"/>
                          </button>
                        `).join("")}
                      </div>
                      <div style="font-size:11px;color:var(--text-soft);margin-top:5px;">当前预览：${state.m7Images[buyerImgIdx]?.label}（演示图）</div>
                    `}
                  </div>

                  <div style="min-width:0;display:flex;flex-direction:column;gap:10px;overflow-wrap:anywhere;word-break:break-word;">
                    <div style="border-bottom:1px solid var(--border);padding-bottom:8px;">
                      <div style="font-size:11.5px;color:var(--text-soft);margin-bottom:2px;">1. 商品标题 · Brand: ${m0Prod?.brand || m0MissingBadge}</div>
                      ${state.m7SelectedTitle ? `
                        <div style="font-size:15px;font-weight:800;line-height:1.4;">${state.m7SelectedTitle}</div>
                        ${state.m7ShowCN && state.m7SelectedTitleCn ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${state.m7SelectedTitleCn}</div>` : ""}
                      ` : `<div style="font-size:12.5px;color:#b45309;">尚未选定商品标题 <button type="button" class="btn btn-sm m7d-jmp" data-pg="m7a" style="margin-left:6px;">去 M7-1 选定 →</button></div>`}
                    </div>

                    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
                      <div style="font-size:11px;color:var(--text-soft);margin-bottom:3px;">2. 售价 / 划线价 / 实时折扣与库存（联动 M0-2 ${m0Prod?.demoNote ? "· 演示数据" : ""}）</div>
                      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                        ${activePrice != null ? `<span style="font-size:20px;font-weight:800;color:#b91c1c;">$${Number(activePrice).toFixed(2)}</span>` : m0MissingBadge}
                        ${activeListPrice != null ? `<span style="font-size:12.5px;color:var(--text-soft);text-decoration:line-through;">$${Number(activeListPrice).toFixed(2)}</span>` : `<span style="font-size:12px;">划线价：${m0MissingBadge}</span>`}
                        ${discountPct != null ? `<span class="pill p-red">-${discountPct}% OFF</span>` : ""}
                        <span style="font-size:12px;color:var(--green-text);font-weight:700;">库存：${activeStock != null ? `${activeStock} 件可售` : m0MissingBadge}</span>
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;border-radius:6px;background:#f8fafc;border:1px solid var(--border);font-size:12px;color:var(--text-muted);">
                      <strong>3. 买家评分与累计销量：</strong>
                      <span>暂无评分与销量（上架后由平台生成）</span>
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">4. 规格变体选择（联动 M0-2）：</div>
                      ${buyerVarList ? `
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          ${buyerVarList.map((v, vi) => `
                            <button type="button" class="btn btn-sm m7d-buyer-var ${buyerVarIdx===vi?"btn-primary":""}" data-vi="${vi}">
                              ${v.name} · $${Number(v.priceUsd).toFixed(2)}
                            </button>
                          `).join("")}
                        </div>
                      ` : `<div>${m0MissingBadge}</div>`}
                      ${state.m7SelectedVariantCopy ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">文案变体命名：${state.m7SelectedVariantCopy}</div>` : ""}
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">5. 关键属性表（联动 M0-2 商品主档${m0Prod?.demoNote ? " · 演示数据" : ""}）：</div>
                      <div class="table-wrap">
                        <table>
                          <tbody>
                            <tr><td><strong>品牌 Brand</strong></td><td>${m0Prod?.brand || m0MissingBadge}</td><td><strong>容量 Capacity</strong></td><td>${m0Prod?.capacity || m0MissingBadge}</td></tr>
                            <tr><td><strong>材质 Material</strong></td><td>${m0Prod?.material || m0MissingBadge}</td><td><strong>颜色 Color</strong></td><td>${m0Prod?.color || m0MissingBadge}</td></tr>
                            <tr><td><strong>尺寸 Dimensions</strong></td><td>${m0Prod?.dimensions || m0MissingBadge}</td><td><strong>瓦数 Wattage</strong></td><td>${m0Prod?.wattage || m0MissingBadge}</td></tr>
                            <tr><td><strong>重量 Weight</strong></td><td>${m0Prod?.weightLbs || m0MissingBadge}</td><td><strong>控制方式 Control</strong></td><td>${m0Prod?.controlMethod || m0MissingBadge}</td></tr>
                            <tr><td><strong>核心功能 Features</strong></td><td colspan="3">${m0Prod?.features || m0MissingBadge}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      ${state.m7SelectedAttrCopy ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">已选后台属性说明：${state.m7SelectedAttrCopy}</div>` : ""}
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">6. 五点核心卖点 (About this item)：</div>
                      ${state.m7SelectedBullets ? `
                        <div style="font-size:12.5px;line-height:1.5;background:#f8fafc;padding:7px 9px;border-radius:6px;">
                          ${state.m7SelectedBullets}
                          ${state.m7ShowCN && state.m7SelectedBulletsCn ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">${state.m7SelectedBulletsCn}</div>` : ""}
                        </div>
                      ` : `<button type="button" class="btn btn-sm m7d-jmp" data-pg="m7a">待选定五点描述（去 M7-1）→</button>`}
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">7. 商品详细描述：</div>
                      ${state.m7SelectedDesc ? `
                        <div style="font-size:12.5px;line-height:1.5;background:#f8fafc;padding:7px 9px;border-radius:6px;">
                          ${state.m7SelectedDesc}
                          ${state.m7ShowCN && state.m7SelectedDescCn ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">${state.m7SelectedDescCn}</div>` : ""}
                        </div>
                      ` : `<button type="button" class="btn btn-sm m7d-jmp" data-pg="m7a">待选定商品描述（去 M7-1）→</button>`}
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">8. A+ 品牌图文详情模块：</div>
                      ${state.m7AplusDone ? `
                        <div class="aplus-hero" style="padding:9px 11px;">
                          <div style="min-width:0;"><strong style="font-size:12.5px;">${curM7Prod.name} · A+ Story</strong><div style="font-size:11px;color:#cbd5e1;margin-top:2px;">${state.m7SelectedAplusCopy || "已配置品牌横幅 + 场景卖点 + 参数对比表"}</div></div>
                          <img src="${getM7SlotImg(curM7Prod, 1, false)}" style="width:52px;height:52px;border-radius:6px;background:#fff;flex-shrink:0;" alt="A+缩略"/>
                        </div>
                      ` : `<button type="button" class="btn btn-sm m7d-jmp" data-pg="m7c">待生成 A+ 图文（去 M7-3）→</button>`}
                    </div>

                    <div>
                      <div style="font-size:12px;font-weight:700;margin-bottom:4px;">9. 商品主图视频 (15s)：</div>
                      ${state.m7VidDone ? `
                        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#0f172a;color:#fff;font-size:12px;">
                          <span class="pill p-green">▶ 15s 演示视频</span>
                          <span>${state.m7VidType} · 3段分镜双语字幕成片</span>
                        </div>
                      ` : `<button type="button" class="btn btn-sm m7d-jmp" data-pg="m7c">待生成 15s 短视频（去 M7-3）→</button>`}
                    </div>
                  </div>
                </div>
              </div>
            `}
          </div>

          <div class="card" style="padding:12px;margin-bottom:0;">
            <div class="card-header" style="margin-bottom:8px;">
              <div class="card-title" style="font-size:13px;">8 类上架交付清单</div>
              <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已就绪</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${checklist.map(c => `
                <div class="m7d-chk" data-jmp="${c.jump}" title="${c.sub}" style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:${c.done?"#f8fafc":"var(--amber-bg)"};cursor:pointer;">
                  <div style="min-width:0;flex:1;">
                    <div style="font-weight:700;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.label}</div>
                    <div style="font-size:10.5px;color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.sub}</div>
                  </div>
                  <span class="pill ${c.done?"p-green":"p-amber"}" style="font-size:10.5px;padding:1px 6px;flex-shrink:0;">${c.done?"✓":"补齐"}</span>
                </div>
              `).join("")}
            </div>

            <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border-strong);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <strong style="font-size:11.5px;">扩展上架文案清单（8+N 类 · 独立计数）</strong>
                <span class="pill p-blue" style="font-size:10.5px;">${extDoneCnt}/6</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;">
                ${extChecklist.map(ec => `
                  <div class="m7d-ext-chk" data-tab="${ec.tab}" title="${ec.label}" style="display:flex;justify-content:space-between;align-items:center;gap:3px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:${ec.val?"#f0fdf4":"#f8fafc"};cursor:pointer;font-size:10.5px;">
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ec.tab}</span>
                    <span style="color:${ec.val?"var(--green-text)":"var(--text-soft)"};font-weight:700;flex-shrink:0;">${ec.val?"✓":"选"}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.querySelectorAll(".m7d-ptab").forEach(t => t.onclick = () => { state.m7PreviewTab = t.dataset.t; rerender(); });
        document.querySelectorAll(".m7d-buyer-thumb").forEach(b => b.onclick = () => { state.m7BuyerImgIdx = Number(b.dataset.idx) || 0; rerender(); });
        document.querySelectorAll(".m7d-buyer-var").forEach(b => b.onclick = () => { state.m7BuyerVariantIdx = Number(b.dataset.vi) || 0; rerender(); });
        document.querySelectorAll(".m7d-jmp").forEach(b => b.onclick = () => goPage(b.dataset.pg));
        document.querySelectorAll(".m7d-ext-chk").forEach(el => el.onclick = () => {
          state.m7ResultTab = el.dataset.tab;
          goPage("m7a");
        });
        const goImgBtn = document.getElementById("m7dGoImgBtn");
        if (goImgBtn) goImgBtn.onclick = () => goPage("m7b");
        document.getElementById("m7dPlatSel").onchange = (e) => { state.m7Platform = e.target.value; state.m7ApprovalRecord = null; state.m7ComplianceStatus = "待运行合规检查"; rerender(); };
        document.getElementById("m7dCatSel").onchange = (e) => { state.m7ComplianceCategory = e.target.value; state.m7ApprovalRecord = null; state.m7ComplianceStatus = "待运行合规检查"; rerender(); };
        document.querySelectorAll(".m7d-cert-toggle").forEach(b => b.onclick = () => {
          const c = state.m7CertRecords[Number(b.dataset.ci)];
          c.status = c.status === "已过期" ? "有效" : "已过期";
          if (c.status === "已过期") { state.m7ApprovalRecord = null; state.m7ComplianceStatus = "校验未通过"; }
          rerender();
          toast(c.status === "已过期" ? `${c.name} 已过期，已触发阻断！` : `${c.name} 已续期恢复有效`, c.status === "已过期" ? "error" : "success");
        });
        document.querySelectorAll(".m7d-chk").forEach(el => el.onclick = () => {
          const j = el.dataset.jmp;
          if (j === "aplus") {
            state.m7AplusDone = true;
            appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 补充生成了 ${curM7Prod.sku} 的 A+ 图文详情模块`, ok: true });
            rerender(); toast("已补齐 A+ 图文页面模块", "success");
          } else goPage(j);
        });

        document.getElementById("m7RunCompBtn").onclick = () => {
          const banFound = state.m7BanTerm.split(/[,，]/).map(s=>s.trim()).filter(Boolean)
            .filter(w => new RegExp(w, "i").test((state.m7SelectedTitle || "") + " " + (state.m7SelectedBullets || "")));
          const maxL = state.m7Platform.includes("虾皮") ? 120 : state.m7Platform.includes("TikTok") ? 150 : 200;
          const titleOk = Boolean(state.m7SelectedTitle) && state.m7SelectedTitle.length <= maxL;
          const certOk = !hasExpiredCert;
          const readyAll = doneCnt === 8;
          const allOk = banFound.length === 0 && titleOk && iptcOk && certOk && readyAll;
          state.m7ComplianceChecks = [
            { rule: "广告违禁词检查", pass: banFound.length === 0, detail: banFound.length ? `不通过：发现违禁词「${banFound.join("、")}」` : "通过：未发现任何平台违禁词 ✓" },
            { rule: "平台标题与字数限制", pass: titleOk, detail: !state.m7SelectedTitle ? "不通过：尚未写入商品标题（请回第 1 步）" : titleOk ? `通过：当前 ${state.m7SelectedTitle.length} 字（上限 ${maxL} 字）✓` : `不通过：标题已超出 ${maxL} 字限制` },
            { rule: "AI 人物标识元数据核验", pass: iptcOk, detail: iptcOk ? "通过：最终待发布图含标准合成人物与训练标识 ✓" : "不通过：检测到 AI 人物图片元数据丢失或未写入，请回 M7-2 补写重检" },
            { rule: "站点 × 类目认证与资质有效期", pass: certOk, detail: certOk ? `通过：${state.m7Platform} · ${state.m7ComplianceCategory} 资质报告与品牌授权均有效 ✓` : "不通过：存在已过期的质检报告或品牌授权，系统已阻断放行" },
            { rule: "8 类上架资产完整度", pass: readyAll, detail: readyAll ? "通过：8 类交付物全部就绪 ✓" : `不通过：当前 ${doneCnt}/8，仍缺 ${checklist.filter(c=>!c.done).map(c=>c.label).join("、")}` },
          ];
          state.m7ComplianceStatus = allOk ? "合规校验通过" : "校验未通过";
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 对 ${curM7Prod.sku}（${state.m7Platform}）执行了上架前合规检查，结果：${state.m7ComplianceStatus}（${doneCnt}/8 类就绪）`, ok: allOk });
          rerender();
          toast(allOk ? `全部合规校验通过 (8/8)，请主管批准导出！` : `校验未通过：${!readyAll ? `尚缺 ${8-doneCnt} 类资产` : "请查看不通过项"}`, allOk ? "success" : "error");
        };

        document.getElementById("m7ApprPubBtn").onclick = () => {
          commitAction({
            title: `主管批准上架素材包 · ${curM7Prod.sku}`,
            summary: `当前完成度 ${doneCnt}/8 类；批准后将记录审批人、审批时间并解锁「📦 导出合规上架素材包」下载。`,
            confirmText: "确认批准导出",
            fieldsHtml: `<div class="field"><label>主管审批意见 *</label><input id="m7ApprNote" class="input" value="8类资产齐备且用语合规，准予导出上架素材包"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m7ApprNote");
              return el.value.trim() ? [] : [{ el, msg: "请填写主管审批意见" }];
            },
            onConfirm: (wrap) => {
              state.m7ComplianceStatus = "主管已批准导出";
              state.m7ApprovalRecord = { approver: ROLE_PERSON_NAMES[state.role], time: nowDateTimeStr(), note: wrap.querySelector("#m7ApprNote").value.trim() };
              return { toastMsg: `主管已批准导出 ${curM7Prod.sku} 资料包，请点击右上角「📦 导出合规上架素材包」` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 批准了 ${curM7Prod.sku} 的上架合规资料包，意见：${wrap.querySelector("#m7ApprNote").value.trim()}`,
              ok: true
            })
          });
        };
      }
    };
  }

  // ==================== M8-1: 员工名册与九大业务岗位授权 ====================
  if (pageId === "m8a") {
    const canManage = state.role === "manager" || state.role === "approver";
    const activeCount = state.employees.filter(e => e.active).length;
    const filtered = state.employees.filter(e => state.m8RoleFilter === "ALL" || e.role === state.m8RoleFilter);

    return {
      headerActions: [
        { label: "查看权限矩阵与审计日志 →", primary: false, onClick: () => goPage("m8b") },
        {
          label: "+ 新增员工与岗位授权", primary: true,
          disabled: !canManage,
          disabledTitle: "需要「大屏浏览者 / 管理者」或「主管 / 审批人」权限",
          onClick: () => {
            if (!canManage) { record403("M8-1 新增员工", "需要管理者或主管权限"); return; }
            commitAction({
              title: "新增员工档案与业务岗位授权",
              summary: "提交前将校验工号唯一性、姓名必填与企业邮箱格式；建档后立即写入 M8-2 审计台账。",
              confirmText: "确认建档并授权",
              fieldsHtml: `
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>员工工号 * (如 EMP-111, 不可重复)</label><input id="newEmpId" class="input" value="EMP-${101 + state.employees.length}" /></div>
                  <div class="field"><label>员工姓名 *</label><input id="newEmpName" class="input" placeholder="输入真实姓名" value="周宁" /></div>
                </div>
                <div class="field"><label>企业邮箱 *</label><input id="newEmpEmail" class="input" value="zhouning@crosspilot.ai" /></div>
                <div class="field"><label>分配业务岗位 *</label>
                  <select id="newEmpRole" class="select">${BIZ_ROLES.map(r => `<option value="${r.key}">${r.label}</option>`).join("")}</select>
                </div>
                <div id="newEmpRolePreview" class="banner banner-blue" style="margin-bottom:10px;font-size:12.5px;"></div>
                <div class="field"><label>负责店铺 / 数据范围 *</label><select id="newEmpShop" class="select"><option>全部实盘店铺 (Shopee 泰国 + TikTok 美区)</option><option>Shopee 泰国主店</option><option>TikTok Shop 美区</option><option>仅演示沙盒</option></select></div>
              `,
              onMount: (wrap) => {
                const sel = wrap.querySelector("#newEmpRole");
                const upd = () => { wrap.querySelector("#newEmpRolePreview").textContent = `岗位职责：${BIZ_ROLES.find(r=>r.key===sel.value).desc}`; };
                sel.onchange = upd; upd();
              },
              validate: (wrap) => {
                const errs = [];
                const idEl = wrap.querySelector("#newEmpId");
                const nmEl = wrap.querySelector("#newEmpName");
                const emEl = wrap.querySelector("#newEmpEmail");
                const id = idEl.value.trim();
                const nm = nmEl.value.trim();
                const em = emEl.value.trim();
                if (!/^EMP-\d{3,}$/i.test(id)) errs.push({ el: idEl, msg: "工号格式须为 EMP- 加至少 3 位数字（如 EMP-111）" });
                else if (state.employees.some(e => e.id.toUpperCase() === id.toUpperCase())) errs.push({ el: idEl, msg: `工号 ${id} 已存在，不可重复建档` });
                if (!nm) errs.push({ el: nmEl, msg: "员工姓名不能为空" });
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) errs.push({ el: emEl, msg: "请输入合法的企业邮箱格式" });
                return errs;
              },
              onConfirm: (wrap) => {
                const id = wrap.querySelector("#newEmpId").value.trim().toUpperCase();
                const name = wrap.querySelector("#newEmpName").value.trim();
                const email = wrap.querySelector("#newEmpEmail").value.trim();
                const role = wrap.querySelector("#newEmpRole").value;
                const shop = wrap.querySelector("#newEmpShop").value;
                const rObj = BIZ_ROLES.find(r => r.key === role);
                state.employees.unshift({ id, name, email, role, shop, active: true, lastLogin: `${nowDateTimeStr()} (刚刚建档)` });
                return { toastMsg: `已建档员工 ${name} (${id}) · 授予「${rObj.label}」` };
              },
              audit: (wrap) => {
                const rObj = BIZ_ROLES.find(r => r.key === wrap.querySelector("#newEmpRole").value);
                return {
                  sentence: `${ROLE_PERSON_NAMES[state.role]} 新增员工 ${wrap.querySelector("#newEmpName").value.trim()}（${wrap.querySelector("#newEmpId").value.trim().toUpperCase()}），分配岗位「${rObj.label}」，负责范围：${wrap.querySelector("#newEmpShop").value}`,
                  ok: true
                };
              }
            });
          }
        }
      ],
      html: `
        ${!canManage ? `
          <div class="banner banner-amber">
            <span>当前登录岗位为只读模式：新增员工、调岗与停用需要「大屏浏览者 / 管理者」或「主管 / 审批人」权限。</span>
          </div>
        ` : ""}

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">在职 / 总员工数</div><div class="kpi-val" style="color:var(--blue-hover)">${activeCount} / ${state.employees.length} 人</div><div class="kpi-sub">已停用账号 ${state.employees.length - activeCount} 个</div></div>
          <div class="kpi-card"><div class="kpi-label">企业标准业务岗位</div><div class="kpi-val" style="color:var(--purple-text)">9 类岗位</div><div class="kpi-sub">按职责严格隔离审批权</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">职责冲突检查</div><div class="kpi-val" style="color:var(--green-text)">0 冲突</div><div class="kpi-sub">提交人与终审人严格分开</div></div>
          <div class="kpi-card"><div class="kpi-label">操作审计留痕</div><div class="kpi-val" style="color:var(--amber-text)">${state.auditLogs.length} 条</div><div class="kpi-sub">每次变更均可追溯</div></div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">按业务岗位筛选员工名册</div></div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
            <button class="btn btn-sm ${state.m8RoleFilter==="ALL"?"btn-primary":""} m8-rflt" data-r="ALL">全部 (${state.employees.length})</button>
            ${BIZ_ROLES.map(r => {
              const cnt = state.employees.filter(e => e.role === r.key).length;
              return `<button class="btn btn-sm ${state.m8RoleFilter===r.key?"btn-primary":""} m8-rflt" data-r="${r.key}">${r.label} (${cnt})</button>`;
            }).join("")}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>工号</th><th>员工姓名 / 邮箱与最近登录</th><th>当前分配岗位 (变更须确认)</th><th>权限层级</th><th>负责店铺 / 范围</th><th>账号状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(emp => {
                  const rObj = BIZ_ROLES.find(r => r.key === emp.role) || BIZ_ROLES[0];
                  return `
                    <tr>
                      <td class="nowrap"><strong>${emp.id}</strong></td>
                      <td><strong>${emp.name}</strong><div style="font-size:12px;color:var(--text-soft)">${emp.email} · 最近登录：${emp.lastLogin}</div></td>
                      <td>
                        <select class="select m8-emp-role" data-id="${emp.id}" ${!canManage ? "disabled" : ""} style="min-width:190px;">
                          ${BIZ_ROLES.map(r => `<option value="${r.key}" ${emp.role===r.key?"selected":""}>${r.label}</option>`).join("")}
                        </select>
                      </td>
                      <td class="nowrap"><span class="pill ${rObj.pill}">${rObj.tag}</span></td>
                      <td style="font-size:12.5px;">${emp.shop}</td>
                      <td class="nowrap"><span class="pill ${emp.active?"p-green":"p-red"}">${emp.active?"启用中":"已停用"}</span></td>
                      <td class="nowrap"><button class="btn btn-sm ${emp.active?"btn-danger":"btn-success"} m8-emp-toggle" data-id="${emp.id}" ${!canManage?"disabled":""}>${emp.active?"停用账号":"恢复启用"}</button></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m8-rflt").forEach(b => b.onclick = () => { state.m8RoleFilter = b.dataset.r; rerender(); });
        document.querySelectorAll(".m8-emp-role").forEach(sel => sel.onchange = (e) => {
          const emp = state.employees.find(x => x.id === sel.dataset.id);
          const oldRole = emp.role;
          const newRole = e.target.value;
          const oldL = BIZ_ROLES.find(r => r.key === oldRole)?.label;
          const newL = BIZ_ROLES.find(r => r.key === newRole)?.label;
          sel.value = oldRole;
          commitAction({
            title: `确认调整员工岗位 · ${emp.name} (${emp.id})`,
            summary: `该员工岗位将从 <strong>${oldL}</strong> 变更为 <strong>${newL}</strong>，变更后立即生效并记入 M8-2 审计台账。`,
            confirmText: "确认调岗",
            fieldsHtml: `<div class="field"><label>调岗原因（必填）*</label><input id="m8MoveReason" class="input" value="部门业务分工调整"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m8MoveReason");
              return el.value.trim() ? [] : [{ el, msg: "请填写调岗原因" }];
            },
            onConfirm: () => {
              emp.role = newRole;
              emp.lastLogin = `${nowDateTimeStr()} (刚调岗)`;
              return { toastMsg: `已将 ${emp.name} 调岗为「${newL}」` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 将员工 ${emp.name}（${emp.id}）的岗位由「${oldL}」调整为「${newL}」，原因：${wrap.querySelector("#m8MoveReason").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m8-emp-toggle").forEach(b => b.onclick = () => {
          const emp = state.employees.find(x => x.id === b.dataset.id);
          const nextAct = !emp.active;
          commitAction({
            title: `确认${nextAct ? "恢复启用" : "停用"}账号 · ${emp.name} (${emp.id})`,
            danger: !nextAct,
            summary: nextAct ? "恢复后该员工可按所属岗位正常登录操作。" : "停用后该账号在系统内的全部操作权限将立即收回！",
            confirmText: nextAct ? "确认恢复" : "确认停用",
            onConfirm: () => {
              emp.active = nextAct;
              return { toastMsg: `${emp.name} 账号已${nextAct ? "恢复启用" : "停用"}`, toastLevel: nextAct ? "success" : "warn" };
            },
            audit: {
              sentence: `${ROLE_PERSON_NAMES[state.role]} ${nextAct ? "恢复启用" : "停用"}了员工 ${emp.name}（${emp.id}）的账号`,
              ok: true
            }
          });
        });
      }
    };
  }

  // ==================== M8-2: 只读岗位权限矩阵与可读中文审计台账 ====================
  if (pageId === "m8b") {
    const curRoleObj = BIZ_ROLES.find(r => r.key === state.role) || BIZ_ROLES[0];
    const activeRoleIdx = BIZ_ROLES.findIndex(r => r.key === state.role);
    return {
      headerActions: [
        { label: "← 返回员工名册", primary: false, onClick: () => goPage("m8a") },
        {
          label: "清理本轮新增记录(保留示例)", primary: false,
          onClick: () => {
            state.auditLogs = state.auditLogs.filter(l => l.historical);
            try { if (typeof localStorage !== "undefined") localStorage.removeItem("crosspilot_audit_v3"); } catch {}
            rerender(); toast("已清理本轮新增演示日志，保留历史示例基准", "info");
          }
        }
      ],
      html: `
        <div class="card">
          <div class="card-header">
            <div class="card-title">九大业务岗位 × 15 项功能权限矩阵（只读核对）</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="pill p-purple">★ 组织授权</span><span class="pill p-red">✓ 终审拍板</span><span class="pill p-blue">◆ 业务操作</span><span class="pill p-gray">○ 限域查看</span>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="min-width:205px;">功能模块与权限范围</th>
                  ${BIZ_ROLES.map((r, i) => `
                    <th style="min-width:112px;${i===activeRoleIdx?"background:#dbeafe;color:#1d4ed8;border-bottom:2px solid #2563eb;":""}">
                      ${r.label}
                      ${i===activeRoleIdx ? '<div style="font-size:11.5px;font-weight:800;">● 当前岗位</div>' : ""}
                    </th>
                  `).join("")}
                </tr>
              </thead>
              <tbody>
                ${MATRIX_ROWS.map(row => `
                  <tr>
                    <td class="nowrap"><strong>${row[0]}</strong></td>
                    ${row.slice(1).map((cell, ci) => `<td class="nowrap" style="${ci===activeRoleIdx?"background:#eff6ff;":""}">${badgeHtml(cell)}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title" style="color:var(--purple-text);">关键操作与越权拦截审计台账（共 ${state.auditLogs.length} 条 · 管理者可读记录）</div>
            <span class="pill p-green">本地实时保存 ✓</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>发生时间</th><th>操作岗位</th><th>业务操作与审计详情</th><th>执行结果</th></tr></thead>
              <tbody>
                ${state.auditLogs.map(log => `
                  <tr>
                    <td class="nowrap">${log.time}</td>
                    <td class="nowrap"><strong>${BIZ_ROLES.find(r=>r.key===log.actor)?.label || log.actor}</strong></td>
                    <td style="font-size:13px;">${log.sentence}</td>
                    <td class="nowrap"><span class="pill ${log.ok?"p-green":"p-red"}">${log.ok?"已记录":"已拦截"}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {}
    };
  }

  return null;
}
