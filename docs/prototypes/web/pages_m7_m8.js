import {
  BACKEND_SERVICE_URL, BIZ_ROLES, ROLE_PERSON_NAMES, getProductImg, getM7SlotImg, resetM7CreationState, nowDateTimeStr, appendAuditLog
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

function getM7AvailableProducts(state) {
  const approvedNew = state.m4Pool
    .filter(x => x.stage === "已批准测款")
    .map(x => ({
      sku: x.sku, name: x.name, category: x.category || "家居收纳", platform: x.platform || "Amazon US",
      unitPriceUsd: x.unitPriceUsd || 24.9, origin: "M4_APPROVED",
      approver: x.approver || "陈主管", reason: x.decisionReason || "实盘利润率达标批准测款"
    }));
  const legacyInStore = state.masterProducts.map(p => ({
    sku: p.sku, name: p.name, category: p.category || "家居收纳", platform: "Amazon US",
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

  const maxTitleLen = platform.includes("虾皮") ? 120 : platform.includes("TikTok") ? 150 : 200;
  const overLen = text.length > maxTitleLen;
  return {
    safeHtml,
    mustHits: mustHitsDetail.length,
    mustHitsDetail,
    totalMust: mustTerms.length,
    banHits: banHitsDetail.length,
    banHitsDetail,
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
    const getCopyPool = (tab) => tab === "商品标题" ? [
      `${curM7Prod.sku} | ${mustList.join(" ")} · Compact Everyday Essential for ${state.m7Platform} (热搜词版 v${verTag})`,
      `${curM7Prod.name} (${curM7Prod.sku}) · ${mustList[0] || "Portable"} Design with Fast Setup & Reliable Quality (卖点版 v${verTag})`,
      `New Arrival: ${mustList.slice(0,2).join(" & ")} ${curM7Prod.name} for Home & Travel (${state.m7Platform} 场景版 v${verTag})`,
    ] : tab === "五点描述" ? [
      `• [核心性能] Engineered with ${mustList.join(", ")}, delivering reliable everyday performance for busy shoppers.`,
      `• [便捷体验] Lightweight body (${curM7Prod.sku}) enables easy one-hand operation for kitchen, dorm, and travel.`,
      `• [测试拦截样例] Best choice with Miracle results and Free gift! (用于测试违禁词逐条拦截提醒)`,
    ] : tab === "商品描述" ? [
      `Upgrade your daily routine with ${curM7Prod.sku} (${curM7Prod.name}). Built around ${mustList.join(" and ")}, tailored for ${state.m7Platform} shoppers (v${verTag}).`,
      `Designed for busy households, ${curM7Prod.name} combines ${mustList[0] || "durable material"} with effortless storage and low maintenance.`,
      `From daily home prep to weekend trips, ${curM7Prod.sku} keeps essentials organized and ready.`,
    ] : [
      `${mustList.map(x=>x.toLowerCase()).join(", ")}, ${curM7Prod.sku.toLowerCase()}, compact home organizer, travel essential (20个合规词)`,
      `portable gadget, ${curM7Prod.name}, gift for family, space saving organizer (20个长尾词)`,
      `best miracle free gadget (包含违禁词样例：触发合规拦截)`,
    ];
    const drafts = getCopyPool(state.m7ResultTab);
    const copyFilledMap = {
      "商品标题": !!state.m7SelectedTitle,
      "五点描述": !!state.m7SelectedBullets,
      "商品描述": !!state.m7SelectedDesc,
      "后台搜索词": !!state.m7SelectedKeywords,
    };
    const copyCnt = Object.values(copyFilledMap).filter(Boolean).length;
    const curImg = getProductImg(curM7Prod.sku, curM7Prod.name, curM7Prod.category);

    return {
      headerActions: [
        { label: `⚡ 一键采纳 4 类推荐合规文案 (${copyCnt}/4)`, primary: false, disabled: !canCreate, onClick: () => {
          state.m7CopyGenCount = Math.max(1, state.m7CopyGenCount);
          state.m7SelectedTitle = getCopyPool("商品标题")[0];
          state.m7SelectedBullets = getCopyPool("五点描述")[0];
          state.m7SelectedDesc = getCopyPool("商品描述")[0];
          state.m7SelectedKeywords = getCopyPool("后台搜索词")[0];
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 一键采纳了 ${curM7Prod.sku} 的 4 类合规文案`, ok: true });
          rerender();
          toast("已写入全部 4 类合规文案，可点击「下一步：制作 1+4 套图」继续", "success");
        }},
        { label: "下一步：制作 1+4 套图 →", primary: true, onClick: () => goPage("m7b") }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}

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
            <div class="field"><label>品牌用语规范（必须包含，绿底高亮）</label><input id="m7MustTerm" class="input" value="${state.m7MustTerm}"/></div>
            <div class="field"><label>平台违禁词（严禁出现，红底拦截）</label><input id="m7BanTerm" class="input" value="${state.m7BanTerm}"/></div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>✨ 生成第 ${state.m7CopyGenCount + 1} 版多语言文案草稿</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">${curM7Prod.sku} 多版本文案草稿（逐类点选写入交付清单）</div>
              <span class="pill ${copyCnt===4?"p-green":"p-amber"}">已写入 ${copyCnt}/4 类文案</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["商品标题", "五点描述", "商品描述", "后台搜索词"].map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">
                  ${tb} ${copyFilledMap[tb] ? '<span class="utab-cnt" style="background:var(--green-bg);color:var(--green-text);">✓</span>' : '<span class="utab-cnt">待选</span>'}
                </div>
              `).join("")}
            </div>

            ${state.m7CopyGenCount === 0 ? `
              <div style="padding:28px;text-align:center;background:#f8fafc;border:1px dashed var(--border-strong);border-radius:10px;">
                <div style="font-weight:700;font-size:14.5px;margin-bottom:6px;">尚未生成「${curM7Prod.name}」文案草稿</div>
                <div style="font-size:12.5px;color:var(--text-soft);margin-bottom:12px;">请点击左侧「✨ 生成第 1 版多语言文案草稿」，或点击右上角一键采纳 4 类合规文案。</div>
                <button class="btn btn-primary btn-sm" id="m7EmptyGenBtn" ${!canCreate?"disabled":""}>✨ 立即生成文案草稿</button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${drafts.map(txt => {
                  const chk = checkCopyRules(txt, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
                  const blocked = chk.banHits > 0 || chk.overLen;
                  const currentPickedVal = state.m7ResultTab === "商品标题" ? state.m7SelectedTitle : state.m7ResultTab === "五点描述" ? state.m7SelectedBullets : state.m7ResultTab === "商品描述" ? state.m7SelectedDesc : state.m7SelectedKeywords;
                  const isPicked = currentPickedVal === txt;
                  return `
                    <div style="background:${isPicked?"#f0fdf4":"#f8fafc"};border:1px solid ${blocked?"#fca5a5":isPicked?"#86efac":"var(--border)"};border-radius:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                      <div style="flex:1;min-width:240px;">
                        <div style="font-weight:600;line-height:1.5;">${chk.safeHtml}</div>
                        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;font-size:12px;">
                          <span class="pill p-green">品牌用语 ${chk.mustHits}/${chk.totalMust} 项</span>
                          <span class="pill ${chk.banHits>0?"p-red":"p-green"}">${chk.banHits>0 ? `命中违禁词：${chk.banHitsDetail.join("、")}` : "违禁词 0 命中 ✓"}</span>
                          <span class="pill ${chk.overLen?"p-red":"p-gray"}">字符数 ${chk.len} / ${chk.maxTitleLen}</span>
                        </div>
                      </div>
                      <button class="btn ${blocked?"btn-danger":isPicked?"btn-success":"btn-primary"} btn-sm m7-pick-copy" data-txt="${txt.replace(/"/g, "&quot;")}" data-ban="${chk.banHits}" data-over="${chk.overLen?1:0}" ${!canCreate?"disabled":""}>
                        ${blocked ? "含违禁/超长(拦截)" : isPicked ? "已写入清单 ✓" : "写入交付清单 ✓"}
                      </button>
                    </div>
                  `;
                }).join("")}
              </div>
            `}
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.getElementById("m7ProdSel").onchange = (e) => {
          const picked = availProds.find(p => p.sku === e.target.value);
          resetM7CreationState(state, e.target.value, picked);
          rerender();
          toast(`已切换创作商品为「${picked?.name}」，已重置为 0/8 待创作状态`, "info");
        };
        document.getElementById("m7PlatSel").onchange = (e) => { state.m7Platform = e.target.value; rerender(); };
        document.getElementById("m7LangSel").onchange = (e) => { state.m7Lang = e.target.value; rerender(); };
        document.querySelectorAll(".m7-rtab").forEach(el => el.onclick = () => { state.m7ResultTab = el.dataset.tab; rerender(); });
        const triggerCopyGen = () => {
          state.m7MustTerm = document.getElementById("m7MustTerm").value;
          state.m7BanTerm = document.getElementById("m7BanTerm").value;
          state.m7CopyGenCount += 1; rerender(); toast(`已生成第 ${state.m7CopyGenCount} 版文案并完成用语扫描`);
        };
        document.getElementById("m7GenCopyBtn").onclick = triggerCopyGen;
        const empBtn = document.getElementById("m7EmptyGenBtn");
        if (empBtn) empBtn.onclick = triggerCopyGen;

        document.querySelectorAll(".m7-pick-copy").forEach(b => b.onclick = () => {
          if (Number(b.dataset.ban) > 0 || b.dataset.over === "1") {
            appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 尝试选用含违禁词或超长的 ${curM7Prod.sku} 文案，已被拦截`, ok: false });
            toast("拦截：该版本文案包含违禁词或超过平台字数上限，不可写入交付清单！", "error");
            return;
          }
          const val = b.dataset.txt;
          if (state.m7ResultTab === "商品标题") state.m7SelectedTitle = val;
          else if (state.m7ResultTab === "五点描述") state.m7SelectedBullets = val;
          else if (state.m7ResultTab === "商品描述") state.m7SelectedDesc = val;
          else state.m7SelectedKeywords = val;
          const nextOrder = ["商品标题", "五点描述", "商品描述", "后台搜索词"];
          const curIdx = nextOrder.indexOf(state.m7ResultTab);
          if (curIdx >= 0 && curIdx < 3) {
            const nextEmpty = nextOrder.slice(curIdx + 1).find(t =>
              (t==="五点描述" && !state.m7SelectedBullets) || (t==="商品描述" && !state.m7SelectedDesc) || (t==="后台搜索词" && !state.m7SelectedKeywords)
            );
            if (nextEmpty) state.m7ResultTab = nextEmpty;
          }
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 将 ${curM7Prod.sku} 的「${state.m7ResultTab}」写入 M7-4 上架交付清单`, ok: true });
          rerender();
          toast("已写入！请继续选其余文案或进入第 2 步", "success");
        });
      }
    };
  }

  // ==================== M7-2: 主图与详情套图制作（1+4 差异构图 + 局部对比 + ComfyUI/IPTC） ====================
  if (pageId === "m7b") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const pickedImg = state.m7Images[state.m7PickedImgIdx] || state.m7Images[0];
    const prodImg = getProductImg(curM7Prod.sku, curM7Prod.name, curM7Prod.category);
    const anyImgDone = state.m7Images.some(x => x.done);

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
              steps: ["调度 ComfyUI 工作流 WF-IMG-v2.1 算力节点", "渲染白底主图 + 场景/卖点/尺寸/清单 4 张附图", "自动写入 EU_AI_Label 合规元数据并校验"],
              durationMs: 1100,
              onSuccess: () => {
                state.m7ImgVersion += 1;
                state.m7Images.forEach((im, idx) => {
                  im.done = true;
                  im.edited = false;
                  im.editNote = idx === 0 ? `白底棚拍主图 v${state.m7ImgVersion}` : `第 ${state.m7ImgVersion} 版差异化附图`;
                });
                return { summary: `已生成 5 张不同构图电商套图（第 ${state.m7ImgVersion} 版），可点击单张查看或局部修改`, toastMsg: "1+4 差异化套图生成完成 ✓" };
              }
            });
          }
        }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}
        ${renderAsyncBox("m7_img_batch")}

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">第 2 步：1+4 套图要求与局部修改</div></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <img src="${prodImg}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div>
                <strong>${curM7Prod.sku} · ${curM7Prod.name}</strong>
                <div style="font-size:12px;color:var(--text-soft);">${curM7Prod.category} · ${state.m7Platform}</div>
              </div>
            </div>
            <div class="field"><label>套图工作流模板</label>
              <select id="m7ImgWfSel" class="select">
                <option ${state.m7ImgWorkflow.includes("白底")?"selected":""}>标准白底主图 + 4张场景卖点附图模板</option>
                <option ${state.m7ImgWorkflow.includes("场景")?"selected":""}>欧美居家生活方式高转化套图模板</option>
              </select>
            </div>
            <div class="field"><label>画面设计要求说明</label><textarea class="textarea">图1纯白棚拍占85%；图2居家实景；图3双卖点标注；图4长宽高净重标尺；图5主机配件清单。</textarea></div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>当前选中图位：</strong>${pickedImg.label}<br/>
              当前状态：<strong>${pickedImg.done ? (pickedImg.edited ? "✓ 已完成局部精修对比" : "✓ 已生成差异化套图") : "待生成（请点右上角生成按钮）"}</strong>
            </div>
            <button class="btn btn-primary" id="m7EditPickedBtn" style="width:100%;justify-content:center;margin-bottom:8px;" ${(!canCreate || !pickedImg.done)?"disabled":""}>✏️ 局部修改当前选中图位（修改前后对比）</button>
            <button class="btn btn-sm" id="m7GotoM7c" style="width:100%;justify-content:center;">进入第 3 步：制作短视频与 A+ 详情页 →</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">1 张白底主图 + 4 张不同构图附图（第 ${state.m7ImgVersion} 版）</div>
              <span class="pill ${anyImgDone?"p-green":"p-amber"}">${anyImgDone?"5 张已差异化出图":"待点击右上角生成套图"}</span>
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
                    <div class="gal-tile large ${state.m7PickedImgIdx===0?"picked":""}" data-imgi="0">
                      <div class="gal-canvas" style="background:#fff;">
                        <img src="${slot0Url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="${m.label}"/>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div><strong>${m.label}</strong> <span style="font-size:12px;color:var(--text-soft)">${m.editNote}</span></div>
                        <span class="pill p-green">${m.edited?"已局部精修 ✓":"主图 ✓"}</span>
                      </div>
                    </div>
                  `;
                })()}

                <div class="gallery-4small">
                  ${state.m7Images.slice(1).map((m, idx) => {
                    const realIdx = idx + 1;
                    const slotUrl = getM7SlotImg(curM7Prod, realIdx, m.edited);
                    return `
                      <div class="gal-tile ${state.m7PickedImgIdx===realIdx?"picked":""}" data-imgi="${realIdx}">
                        <div class="gal-canvas" style="background:#f8fafc;">
                          <img src="${slotUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" alt="${m.label}"/>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                          <strong style="font-size:12px;">${m.label}</strong>
                          <span class="pill p-green">${m.edited?"已精修✓":"已出图✓"}</span>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `}
          </div>
        </div>

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
        document.getElementById("m7ImgWfSel").onchange = (e) => { state.m7ImgWorkflow = e.target.value; };
        document.querySelectorAll(".gal-tile").forEach(el => el.onclick = () => { state.m7PickedImgIdx = Number(el.dataset.imgi); rerender(); });
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
              return { summary: "已完成 5 张差异化套图生成", toastMsg: "1+4 差异化套图已就绪 ✓" };
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
          state.m7IptcDamagedByCrop = true; state.m7IptcWritten = false; state.m7ComplianceStatus = "校验未通过";
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
    const segData = [
      { range: "0-5s", title: "分镜1 · 痛点引入", subCN: `还在被杂乱困扰？试试 ${curM7Prod.name}`, subEN: `Tired of daily clutter? Meet ${curM7Prod.sku}!`, slot: 1, bg: "linear-gradient(135deg,#0f172a,#1e3a8a)" },
      { range: "5-10s", title: "分镜2 · 核心卖点实操", subCN: "一键高效上手 · 省心省空间实测", subEN: "Instant Setup · Built for Everyday Efficiency", slot: 2, bg: "linear-gradient(135deg,#1e293b,#065f46)" },
      { range: "10-15s", title: "分镜3 · 品质清单收尾", subCN: `全套配件开箱即用 · 立即加购 ${curM7Prod.sku}`, subEN: "Complete Kit Included · Shop Now!", slot: 4, bg: "linear-gradient(135deg,#312e81,#1e293b)" },
    ];
    const curSeg = segData[segIdx];
    const curFrameImg = getM7SlotImg(curM7Prod, curSeg.slot, false);

    return {
      headerActions: [
        { label: "← 第 2 步：1+4 套图", primary: false, onClick: () => goPage("m7b") },
        { label: "第 4 步：合规总览与导出 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}
        ${renderAsyncBox("m7_vid")}

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

          <div style="display:flex;flex-direction:column;gap:14px;">
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
                    <div style="font-size:12.5px;color:var(--text-soft);">点击左侧「🎬 生成 15 秒种草短视频」，即可在线播放 3 段分镜动画与双语字幕。</div>
                  </div>
                `}
              ` : `
                <div class="grid-2" style="gap:14px;align-items:start;">
                  <div class="vid-player-frame">
                    <div class="vid-stage" style="background:${curSeg.bg};">
                      <span class="pill p-blue" style="position:absolute;top:10px;left:10px;">${curSeg.range} · ${curSeg.title}</span>
                      <span class="pill ${state.m7VidPlaying?"p-green":"p-gray"}" style="position:absolute;top:10px;right:10px;">${state.m7VidPlaying?"● 播放中":"⏸ 已暂停"}</span>
                      <img src="${curFrameImg}" alt="${curM7Prod.name}" style="${state.m7VidPlaying?"transform:scale(1.06);transition:transform 0.6s ease;":""}"/>
                      <div class="vid-sub-bar">
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
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="font-weight:700;font-size:13px;">点击分镜段快速跳转画面：</div>
                    ${segData.map((sg, idx) => `
                      <button type="button" class="btn btn-sm m7-vid-seg" data-sec="${idx*5}" style="justify-content:flex-start;text-align:left;${segIdx===idx?"border-color:var(--blue);background:var(--blue-bg);color:var(--blue-hover);":""}">
                        <strong>${sg.range}</strong> · ${sg.title}（${sg.subCN}）
                      </button>
                    `).join("")}
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
        document.getElementById("m7VidWfSel").onchange = (e) => {
          state.m7VidWorkflow = e.target.value === "fail" ? "未配置视频生成节点（默认如实报错）" : "模拟已配置视频服务（可播放分镜演示）";
          if (e.target.value === "fail") { state.m7VidDone = false; state.m7VidPlaying = false; }
          rerender();
        };
        document.getElementById("m7GenVidBtn").onclick = () => {
          const failNow = state.m7VidWorkflow.includes("未配置");
          runAsyncTask("m7_vid", {
            label: `短视频制作任务 · ${curM7Prod.sku} (${state.m7VidType})`,
            steps: ["1. 分镜脚本准备与主图载入", "2. 3 段镜头生成处理中", "3. 双语字幕成片合成"],
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
                `• [${nowDateTimeStr()}] 阶段 2/3：3 段镜头生成完毕`,
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

    const downloadDeliverableHtml = () => {
      if (typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return;
      const htmlDoc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${curM7Prod.sku} 合规上架素材交付包</title><style>body{font-family:sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#0f172a}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px}img{width:100%;border-radius:6px;border:1px solid #e2e8f0}</style></head><body><h1>CrossPilot 合规上架素材交付包 · ${curM7Prod.sku} ${curM7Prod.name}</h1><p>目标平台：${state.m7Platform} ｜ 类目：${state.m7ComplianceCategory} ｜ 批准主管：${state.m7ApprovalRecord?.approver || "已校验"} (${nowDateTimeStr()})</p><div class="card"><h2>1. 多语言商品文案 (4/4)</h2><p><strong>标题：</strong>${state.m7SelectedTitle || "未填"}</p><p><strong>五点：</strong>${state.m7SelectedBullets || "未填"}</p><p><strong>详情：</strong>${state.m7SelectedDesc || "未填"}</p><p><strong>搜索词：</strong>${state.m7SelectedKeywords || "未填"}</p></div><div class="card"><h2>2. 1+4 差异化电商套图 (5/5)</h2><div class="grid">${state.m7Images.map((m, i) => `<div><img src="${getM7SlotImg(curM7Prod, i, m.edited)}"/><div style="font-size:12px;margin-top:4px;">${m.label}</div></div>`).join("")}</div></div><div class="card"><h2>3. A+ 详情与短视频交付</h2><p>A+ 图文长页：${state.m7AplusDone ? "已包含" : "未生成"} ｜ 15秒短视频：${state.m7VidDone ? state.m7VidType + " (3段分镜)" : "未生成"}</p></div></body></html>`;
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
                  • <strong>导出包清单 (${doneCnt}/8 类)：</strong>多语言文案 4 类 + 1+4 差异化套图 + A+图文页面 + 15s 分镜视频
                </div>
              `,
              onConfirm: () => {
                downloadDeliverableHtml();
                return { toastMsg: `已下载 ${curM7Prod.sku}_合规上架素材包.html (${doneCnt}/8 类资产)` };
              },
              audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 导出了 ${curM7Prod.sku} 的合规上架素材包（共 ${doneCnt}/8 类资产）`, ok: true }
            });
          }
        }
      ],
      html: `
        ${renderM7StepBar(pageId, state, curM7Prod, goPage, rerender, toast)}

        <div class="split-right-panel">
          <div class="card">
            <div class="card-header">
              <div>
                <strong style="font-size:16px;">${curM7Prod.sku} · ${curM7Prod.name} (${state.m7Platform}) 成品总览</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Lang} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 来自 M4 主管已同意测款":"在售老品翻新"}</div>
              </div>
              <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已制作完成</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["主图/附图", "商品文案", "后台搜索词", "A+ 图文", "种草视频"].map(tb => `
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
                    <div class="gal-canvas"><img src="${getM7SlotImg(curM7Prod, 0, state.m7Images[0].edited)}" style="width:100%;height:100%;object-fit:contain;" alt="商品主图 1"/></div>
                    <div style="font-size:12.5px;"><strong>${state.m7Images[0].label}</strong> (${state.m7Images[0].editNote})</div>
                  </div>
                  <div class="gallery-4small">
                    ${state.m7Images.slice(1).map((m, idx) => `
                      <div class="gal-tile">
                        <div class="gal-canvas"><img src="${getM7SlotImg(curM7Prod, idx + 1, m.edited)}" style="width:100%;height:100%;object-fit:contain;opacity:${m.done?1:0.25};" alt="${m.label}"/></div>
                        <span style="font-size:12px;">${m.label} ${m.done?"✓":"(缺)"}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `}
            ` : state.m7PreviewTab === "商品文案" ? `
              <div style="display:flex;flex-direction:column;gap:10px;background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <div><span class="pill p-blue">商品标题</span><div style="font-weight:700;margin-top:4px;">${state.m7SelectedTitle || "（未写入，请去第 1 步选定）"}</div></div>
                <div><span class="pill p-blue">五点描述</span><div style="margin-top:4px;">${state.m7SelectedBullets || "（未写入，请去第 1 步选定）"}</div></div>
                <div><span class="pill p-blue">商品详情描述</span><div style="margin-top:4px;">${state.m7SelectedDesc || "（未写入，请去第 1 步选定）"}</div></div>
              </div>
            ` : state.m7PreviewTab === "后台搜索词" ? `
              <div style="background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <span class="pill p-purple">后台搜索词</span>
                <div style="margin-top:8px;">${state.m7SelectedKeywords || "（未写入，请去第 1 步选定）"}</div>
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
            ` : `
              ${state.m7VidDone ? `
                <div class="vid-player-frame">
                  <div class="vid-stage" style="height:210px;background:linear-gradient(135deg,#0f172a,#1e3a8a);">
                    <span class="pill p-green" style="position:absolute;top:10px;left:10px;">15s 成品可交付 (${state.m7VidType})</span>
                    <img src="${getM7SlotImg(curM7Prod, 2, false)}" alt="${curM7Prod.name}"/>
                    <div class="vid-sub-bar"><strong>${curM7Prod.sku} · 3段分镜双语字幕成片</strong></div>
                  </div>
                </div>
              ` : `<div style="padding:24px;text-align:center;background:#f8fafc;border-radius:8px;">短视频尚未生成，请前往第 3 步生成。</div>`}
            `}
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">8 类上架交付清单（缺项点击即可直达补齐）</div>
                <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已就绪</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${checklist.map(c => `
                  <div class="m7d-chk" data-jmp="${c.jump}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:${c.done?"#f8fafc":"var(--amber-bg)"};cursor:pointer;">
                    <div style="min-width:0;">
                      <div style="font-weight:700;font-size:12.5px;">${c.label}</div>
                      <div style="font-size:11.5px;color:var(--text-soft);">${c.sub}</div>
                    </div>
                    <span class="pill ${c.done?"p-green":"p-amber"}">${c.done?"已就绪 ✓":"去补齐 →"}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div class="card-title">🌐 站点 × 类目合规规则矩阵 & 资质有效期</div>
                <span class="pill p-blue">${activeRule.ver} · 生效 ${activeRule.eff}</span>
              </div>
              <div class="grid-2" style="gap:8px;margin-bottom:8px;">
                <div class="field" style="margin-bottom:0;"><label>切换目标站点（切换即同步规则）</label>
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
              <div class="formula-box" style="margin-bottom:8px;">
                <strong>当前站点认证要求：</strong>${activeRule.cert}
              </div>
              <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px;">
                ${state.m7CertRecords.map((cert, ci) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 9px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:${cert.status==="已过期"?"#fef2f2":"#f8fafc"};">
                    <div><strong>${cert.name}</strong> · 责任人 ${cert.owner} · 到期 ${cert.expireDate}</div>
                    <div>
                      <span class="pill ${cert.status==="已过期"?"p-red":"p-green"}">${cert.status}</span>
                      <button type="button" class="btn btn-sm m7d-cert-toggle" data-ci="${ci}" style="margin-left:4px;">${cert.status==="已过期"?"续期恢复":"模拟过期"}</button>
                    </div>
                  </div>
                `).join("")}
              </div>
              ${state.m7Platform === "TikTok 美区" ? `
                <div style="padding:7px 10px;border-radius:7px;background:var(--amber-bg);font-size:12px;">
                  <strong>TikTok Shop 保证金与违规监测：</strong>${state.m7TiktokDeposit.shop} 当前保证金 $${state.m7TiktokDeposit.depositUsd}（${state.m7TiktokDeposit.status} · 更新于 ${state.m7TiktokDeposit.dataUpdatedAt}）
                </div>
              ` : ""}
            </div>

            <div class="card card-blue">
              <div class="card-header">
                <div class="card-title">逐条合规检查与主管把关</div>
                <span class="pill ${state.m7ComplianceStatus==="主管已批准导出"?"p-green":state.m7ComplianceStatus==="合规校验通过"?"p-blue":"p-amber"}">${state.m7ComplianceStatus}</span>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.7;">
                ${state.m7ComplianceChecks.length ? state.m7ComplianceChecks.map(ch => `<div>• <strong>${ch.rule}：</strong><span style="color:${ch.pass?"var(--green-text)":"var(--red-text)"}">${ch.detail}</span></div>`).join("") : "需先完成第 1~3 步（8/8 资产就绪）后，点击下方运行合规检查。"}
                ${state.m7ApprovalRecord ? `<div style="margin-top:6px;color:var(--green-text);"><strong>✓ 主管已批准：</strong>${state.m7ApprovalRecord.approver} · ${state.m7ApprovalRecord.time}（${state.m7ApprovalRecord.note}）</div>` : ""}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" id="m7RunCompBtn" ${!isCreator?"disabled":""}>1. 运行上架合规检查</button>
                <button class="btn btn-success btn-sm" id="m7ApprPubBtn" ${(!isApprover || state.m7ComplianceStatus!=="合规校验通过")?"disabled":""} title="${!isApprover?"需要「主管 / 审批人」权限":"需先通过第 1 步合规检查"}">2. 主管批准发布包</button>
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        bindM7StepBar(state, curM7Prod, goPage, rerender, toast);
        document.querySelectorAll(".m7d-ptab").forEach(t => t.onclick = () => { state.m7PreviewTab = t.dataset.t; rerender(); });
        const goImgBtn = document.getElementById("m7dGoImgBtn");
        if (goImgBtn) goImgBtn.onclick = () => goPage("m7b");
        document.getElementById("m7dPlatSel").onchange = (e) => { state.m7Platform = e.target.value; state.m7ComplianceStatus = "待运行合规检查"; rerender(); };
        document.getElementById("m7dCatSel").onchange = (e) => { state.m7ComplianceCategory = e.target.value; state.m7ComplianceStatus = "待运行合规检查"; rerender(); };
        document.querySelectorAll(".m7d-cert-toggle").forEach(b => b.onclick = () => {
          const c = state.m7CertRecords[Number(b.dataset.ci)];
          c.status = c.status === "已过期" ? "有效" : "已过期";
          if (c.status === "已过期") state.m7ComplianceStatus = "校验未通过";
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
