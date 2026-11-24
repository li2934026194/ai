import {
  ROLE_PERSON_NAMES, getProductImg, genDocId, nowDateTimeStr, appendAuditLog, runLocalForecastAlgo
} from "./state.js";

const M4_MODES = {
  balanced: { key: "balanced", label: "均衡优选", wRev: 45, wTrend: 35, wMargin: 20, desc: "适合日常选品：平衡近2月销售额、近期涨势与毛利空间，优先推荐可投产单品" },
  revenue:  { key: "revenue",  label: "稳健经营", wRev: 60, wTrend: 15, wMargin: 25, desc: "适合稳现金流：优先挑选销额大、毛利率高、退货率与侵权风险低的老道品类" },
  growth:   { key: "growth",   label: "高增长",   wRev: 20, wTrend: 65, wMargin: 15, desc: "适合抓爆款窗口：优先挑选近8周销量快速攀升、竞品较少的新品机会" },
};

function calcM4NetSales(item) { return item.paidQty - item.refundQty; }
function calcM4NetRev(item) { return +(item.grossRev - item.discount - item.refundAmt).toFixed(2); }

function isProduceReady(item) {
  const reasons = [];
  if (item.srcCode !== "INTERNAL") reasons.push("外购估算数据（须内部实盘才能投产）");
  if (!item.marginKnown || item.margin === null) reasons.push("缺采购与头程成本");
  else if (item.margin < 10) reasons.push(`毛利率 ${item.margin}% 低于 10% 底线`);
  if (item.riskLevel === "高风险") reasons.push("存在高风险隐患");
  return { ok: reasons.length === 0, reasons };
}

function calcM4Priority(item, maxRev, modeKey = "balanced") {
  const m = M4_MODES[modeKey] || M4_MODES.balanced;
  const revNorm = Math.min(1, calcM4NetRev(item) / (maxRev || 1));
  const trendNorm = Math.max(0, Math.min(1, item.trend / 60));
  const ready = isProduceReady(item);
  if (item.marginKnown && item.margin !== null) {
    const marginNorm = Math.max(0, Math.min(1, item.margin / 25));
    const rankVal = ((m.wRev / 100) * revNorm + (m.wTrend / 100) * trendNorm + (m.wMargin / 100) * marginNorm) * 100 + (ready.ok ? 8 : -10);
    return {
      rankVal,
      explain: `依据「${m.label}」策略：近2月销额贡献(${m.wRev}%) + 近8周涨势(${m.wTrend}%) + 预计毛利(${m.wMargin}%)`,
      missingNote: ""
    };
  }
  const sumW = m.wRev + m.wTrend;
  const wR = Math.round((m.wRev / sumW) * 100);
  const wT = 100 - wR;
  const rankVal = ((m.wRev / sumW) * revNorm + (m.wTrend / sumW) * trendNorm) * 100 - 15;
  return {
    rankVal,
    explain: `依据「${m.label}」策略：近2月销额贡献(${wR}%) + 近8周涨势(${wT}%)`,
    missingNote: "采购头程成本暂缺，暂按已知销额与涨势估算优先级（不可直接投产）"
  };
}

export function renderM4_M6(pageId, state, helpers) {
  const { toast, goPage, openModal, openDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox } = helpers;

  // ==================== M4-1: 候选商品多源导入 ====================
  if (pageId === "m4a") {
    const canImportM4 = state.role === "selector" || state.role === "planner" || state.role === "approver";
    return {
      headerActions: [
        { label: "进入选品决策工作台 →", primary: false, onClick: () => goPage("m4b") },
        {
          label: "＋ 从文件导入候选商品", primary: true,
          disabled: !canImportM4,
          disabledTitle: "需要选品研究员、业务运营或主管权限",
          onClick: () => {
            openModal("从本地表格导入候选选品", `
              <div class="banner banner-blue" style="margin-bottom:12px;">
                <span>请先选择表格并确认来源性质：文件名包含「演示/测试」字样时，若选成正式来源会被系统自动拦截防混入。</span>
              </div>
              <div class="field"><label>选择数据来源性质 *</label>
                <select id="m4UpKind" class="select">
                  <option value="内部实盘选品">内部实盘选品（自营真实成交，可送审测款）</option>
                  <option value="外购行业估算">外购行业估算（市场参考，不可直接批投产）</option>
                  <option value="平台热销公开">平台热销公开（榜单观察，不可直接批投产）</option>
                  <option value="仅演示数据">仅演示数据（测试专用）</option>
                </select>
              </div>
              <div class="field"><label>选择本地选品表格（支持预览前 10 行）*</label>
                <input id="m4UpFile" type="file" accept=".csv,.xlsx,.xls" class="input" style="padding-top:6px;"/>
              </div>
              <div id="m4UpPreview" style="margin-bottom:12px;"></div>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button class="btn" id="m4UpCancel">取消</button>
                <button class="btn btn-primary" id="m4UpSubmit">开始导入并校验</button>
              </div>
            `, (root) => {
              const fInput = root.querySelector("#m4UpFile");
              const kindSel = root.querySelector("#m4UpKind");
              const prev = root.querySelector("#m4UpPreview");
              const refreshPreview = () => {
                const f = fInput.files && fInput.files[0];
                if (!f) { prev.innerHTML = ""; return; }
                const n = f.name;
                const kind = kindSel.value;
                if (/mock|demo|演示|测试/i.test(n) && kind !== "仅演示数据") {
                  prev.innerHTML = `<div class="banner banner-red"><span>❌ 校验告警：文件「${n}」带有测试演示字样，却选择了「${kind}」，提交时将被自动拦截！</span></div>`;
                } else {
                  prev.innerHTML = `
                    <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">表格前 10 行数据预览（${n} · ${Math.max(1, Math.round(f.size/1024))} KB）：</div>
                    <div class="table-wrap" style="max-height:150px;">
                      <table>
                        <thead><tr><th>行号</th><th>商品名称</th><th>近2月净销量</th><th>成本状态</th><th>校验结果</th></tr></thead>
                        <tbody>
                          <tr><td>第 1 行</td><td>便携旅行分装瓶套装</td><td>1,140 件</td><td>采购成本 $1.90</td><td><span class="pill p-green">合法</span></td></tr>
                          <tr><td>第 2 行</td><td>折叠硅胶电热水壶</td><td>890 件</td><td>成本缺失（保留空值）</td><td><span class="pill p-amber">提示补全成本</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                  `;
                }
              };
              fInput.onchange = refreshPreview;
              kindSel.onchange = refreshPreview;
              root.querySelector("#m4UpCancel").onclick = () => document.getElementById("modalRoot").innerHTML = "";
              root.querySelector("#m4UpSubmit").onclick = () => {
                const f = fInput.files && fInput.files[0];
                if (!f) { toast("请先选择需要导入的选品表格文件", "error"); return; }
                const fname = f.name;
                const kind = kindSel.value;
                const isMockConflict = /mock|demo|演示|测试/i.test(fname) && kind !== "仅演示数据";
                document.getElementById("modalRoot").innerHTML = "";

                runAsyncTask("m4_import", {
                  label: `正在导入候选选品 · ${fname}`,
                  steps: ["读取文件并做防重校验", "按商品与销售周期校验字段完整性", "写入选品机会池"],
                  durationMs: 1100,
                  shouldFail: isMockConflict,
                  failReason: `拦截原因：文件「${fname}」含测试演示标识，不可作为「${kind}」导入正式选品池！`,
                  onFail: () => {
                    state.m4Tasks.unshift({ file: fname, kind, scope: "校验未通过", status: "失败（含演示字样拦截）", ok: false, tag: "REJECTED", time: nowDateTimeStr() });
                  },
                  onSuccess: () => {
                    const tag = kind === "仅演示数据" ? "DEMO_ONLY" : kind === "内部实盘选品" ? "READY_REVIEW" : "ESTIMATE_ONLY";
                    const srcCode = kind === "内部实盘选品" ? "INTERNAL" : "PAID_EXTERNAL";
                    state.m4Tasks.unshift({ file: fname, kind, scope: "新增 1 款商品 · 家居收纳", status: `已完成 (${kind})`, ok: true, tag, time: nowDateTimeStr() });
                    if (kind !== "仅演示数据") {
                      const isInt = kind === "内部实盘选品";
                      state.m4Pool.unshift({
                        sku: `SKU-${Math.floor(80000 + Math.random()*9000)}`, name: "便携旅行分装瓶套装",
                        category: "家居收纳", priceBand: "$15-30", unitPriceUsd: 21.8, platform: "Amazon US",
                        region: "美区渠道", lifecycle: "快速上升期", riskLevel: "低风险",
                        paidQty: 1180, refundQty: 40, grossRev: 41200, discount: 310, refundAmt: 480,
                        trend: 24.6, prevAvg: 115, currAvg: 143, marginKnown: isInt,
                        margin: isInt ? 15.8 : null,
                        src: kind, srcCode, stage: isInt ? "初筛候选" : "缺成本待补全",
                        submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "",
                        missing: isInt ? "" : "外购数据缺实际采购与头程成本", budget: "$1,100 (50件)",
                        sysAdvice: { badge: isInt ? "建议投产" : "建议补成本再评", tone: isInt ? "p-green" : "p-amber", reason: isInt ? "近2月销额稳、涨势 +24.6% 且毛利率 15.8% 达标，可送审测款" : "销量走势良好但缺采购成本，补齐核价后再决定" },
                        competition: { competitors: 31, topReviews: "280~700条", priceRange: "$16.9 - $26.9", verdict: "竞争温和，轻小件物流友好" },
                        supplyChain: { buyPrice: isInt ? "$1.90" : "待核价", moq: "50 套", leadDays: "8 天", inStock: "义乌现货" },
                        riskDetail: { ip: "常规容器无侵权 ✓", cert: "PET塑料合规 ✓", seasonal: "差旅刚需全年可卖 ✓", refundRate: "2.1%" },
                        timing: { seasonNote: "节假日出行高峰前备货佳", stageNote: "快速上升期" },
                        trend8w: [108, 114, 118, 124, 129, 134, 139, 143]
                      });
                    }
                    return { summary: `文件「${fname}」导入完成（性质：${kind}）`, toastMsg: `选品导入完成：${fname}` };
                  }
                });
              };
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>来源隔离规则：</strong>明确区分<strong>内部实盘选品</strong>、<strong>外购行业估算</strong>、<strong>平台热销公开</strong>与<strong>仅演示数据</strong>；缺失成本的商品保持「未知」，绝不按 0 元伪造高利润。</span>
        </div>

        ${renderAsyncBox("m4_import")}

        <div class="grid-3">
          <div class="card">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><strong>1. 平台热销与演示样本</strong><span class="pill p-blue">辅助观察</span></div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;">用于观察热卖趋势与关键词灵感，演示样本绝不计入经营利润或测款审批。</div>
            <button class="btn btn-sm" id="m4QuickDemoBtn" ${!canImportM4?"disabled":""}>模拟拉取 20 款公开热销榜</button>
          </div>
          <div class="card">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><strong>2. 外购行业参考表</strong><span class="pill p-amber">辅助估算</span></div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;">支持单表最大 25MB；缺失采购成本与头程费用时保持空值，不能直接批准投产。</div>
            <button class="btn btn-sm" id="m4QuickExtBtn" ${!canImportM4?"disabled":""}>点上方导入外购参考表</button>
          </div>
          <div class="card card-green">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><strong>3. 内部实盘选品数据</strong><span class="pill p-green">可送审测款</span></div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;">来自真实自营店铺销售与采购成本核算，是批准正式测款的唯一有效依据。</div>
            <button class="btn btn-sm btn-primary" id="m4GotoPoolBtn">进入选品决策工作台 (${state.m4Pool.length} 款) →</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">选品数据导入任务记录</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>文件名 / 来源渠道</th><th>数据性质分类</th><th>覆盖商品范围</th><th>导入处理结果</th><th>完成时间</th></tr></thead>
              <tbody>
                ${state.m4Tasks.map(t => `
                  <tr>
                    <td class="nowrap"><strong>${t.file}</strong></td>
                    <td class="nowrap"><span class="pill ${t.kind==="内部实盘选品"?"p-green":t.kind==="外购行业估算"?"p-amber":"p-blue"}">${t.kind}</span></td>
                    <td>${t.scope}</td>
                    <td><span class="pill ${t.ok?"p-green":"p-red"}">${t.status}</span></td>
                    <td class="nowrap">${t.time}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m4GotoPoolBtn").onclick = () => goPage("m4b");
        document.getElementById("m4QuickExtBtn").onclick = () => toast("请点击右上角「+ 从文件导入候选商品」选择本地表格并预览导入", "info");
        document.getElementById("m4QuickDemoBtn").onclick = () => {
          runAsyncTask("m4_import", {
            label: "拉取公开热销榜观察样本 (仅观察用)",
            steps: ["连接公开趋势样本", "过滤重复商品编码", "写入演示观察记录"],
            durationMs: 900,
            onSuccess: () => {
              state.m4Tasks.unshift({ file: "公开热销榜_趋势观察.csv", kind: "平台热销公开", scope: "20 款商品 · 8周", status: "已完成 (仅观察)", ok: true, tag: "DEMO_ONLY", time: nowDateTimeStr() });
              return { summary: "已更新 20 款公开热销观察样本（不可单独用于批测款）", toastMsg: "已导入公开热销观察样本", toastLevel: "info" };
            }
          });
        };
      }
    };
  }

  // ==================== M4-2: 选品决策工作台（筛选 · 推荐 · 对比 · 送审） ====================
  if (pageId === "m4b") {
    const isSelector = state.role === "selector" || state.role === "planner";
    const activeMode = M4_MODES[state.m4Mode] || M4_MODES.balanced;
    const allCats = ["ALL", "家居收纳", "宠物用品", "厨房小电", "3C配件", "户外运动"];

    const baseFiltered = state.m4Pool.filter(item => {
      const q = state.m4Search.trim().toLowerCase();
      const matchSearch = !q || item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      const matchCat = state.m4CatTab === "ALL" || item.category === state.m4CatTab;
      const matchPrice = state.m4PriceFilter === "ALL" || item.priceBand === state.m4PriceFilter;
      const matchPlat = state.m4RegionFilter === "ALL" || item.platform === state.m4RegionFilter;
      const matchLife = state.m4LifecycleFilter === "ALL" || item.lifecycle === state.m4LifecycleFilter;
      const matchRisk = state.m4RiskFilter === "ALL" || item.riskLevel === state.m4RiskFilter;
      const matchSrc = state.m4SrcFilter === "ALL" || item.src === state.m4SrcFilter;
      const matchMyCat = !state.m4OnlyMyCats || state.selectorAssignedCats.includes(item.category);
      const matchReady = !state.m4OnlyProduceReady || isProduceReady(item).ok;
      return matchSearch && matchCat && matchPrice && matchPlat && matchLife && matchRisk && matchSrc && matchMyCat && matchReady;
    });

    const maxRev = Math.max(...state.m4Pool.map(calcM4NetRev), 1);
    const rankedPool = [...state.m4Pool].sort((a, b) => calcM4Priority(b, maxRev, state.m4Mode).rankVal - calcM4Priority(a, maxRev, state.m4Mode).rankVal);
    const top3Featured = rankedPool.filter(x => x.stage !== "已淘汰").slice(0, 3);

    const tabFiltered = baseFiltered
      .filter(x => state.m4Tab === "ALL" || x.stage === state.m4Tab)
      .sort((a, b) => calcM4Priority(b, maxRev, state.m4Mode).rankVal - calcM4Priority(a, maxRev, state.m4Mode).rankVal);

    const pageSize = 4;
    const totalPages = Math.max(1, Math.ceil(tabFiltered.length / pageSize));
    if (state.m4Page > totalPages) state.m4Page = totalPages;
    const paged = tabFiltered.slice((state.m4Page - 1) * pageSize, state.m4Page * pageSize);

    const tabs = [
      { key: "ALL", label: "全部候选" },
      { key: "初筛候选", label: "待初筛决定" },
      { key: "缺成本待补全", label: "缺成本待核价" },
      { key: "已提交待审", label: "已送主管拍板" },
      { key: "已批准测款", label: "已批准测款" },
      { key: "已淘汰", label: "已淘汰" },
    ];

    const compareItems = state.m4Pool.filter(x => state.m4CompareIds.includes(x.sku));

    return {
      headerActions: [
        { label: "← 返回选品导入", primary: false, onClick: () => goPage("m4a") },
        { label: "去 M4-3 主管拍板页 →", primary: true, onClick: () => goPage("m4c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>选品员决策规则：</strong>系统已剔除技术算法术语，按<strong>近2月销售额、近8周涨势、预计毛利率与4项风险排查</strong>直接给出「建议投产 / 补成本 / 放弃」结论；缺成本或外购估算数据不能直接投产。</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">✨ 系统精选推荐 · 按经营策略挑选最值得先推的商品</div>
            <span class="pill p-blue">当前策略：${activeMode.label}</span>
          </div>
          <div class="grid-3" style="margin-bottom:14px;">
            ${Object.values(M4_MODES).map(m => `
              <div class="option-tile ${state.m4Mode===m.key?"active":""} m4-mode-opt" data-mode="${m.key}" style="text-align:left;padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:14px;">${m.label}</strong>
                  <span class="pill ${state.m4Mode===m.key?"p-blue":"p-gray"}">${state.m4Mode===m.key?"已选用":"点击切换"}</span>
                </div>
                <div style="font-size:12.5px;color:var(--text-soft);">${m.desc}</div>
              </div>
            `).join("")}
          </div>

          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🏆 系统精选推荐（优先看可投产且涨势稳的 Top 3）：</div>
          <div class="grid-3">
            ${top3Featured.map((item, idx) => {
              const netRev = calcM4NetRev(item);
              const ready = isProduceReady(item);
              return `
                <div style="background:#fff;border:1px solid ${idx===0?"var(--blue)":"var(--border)"};border-radius:9px;padding:14px;display:flex;flex-direction:column;gap:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${getProductImg(item.sku)}" class="prod-thumb-img" alt="${item.name}"/>
                    <div style="min-width:0;flex:1;">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span class="pill ${item.sysAdvice.tone}">【系统建议】${item.sysAdvice.badge}</span>
                        <span style="font-size:12px;color:var(--text-soft);">${item.category}</span>
                      </div>
                      <div style="font-weight:700;margin-top:4px;font-size:14px;">${item.name}</div>
                      <div style="font-size:12px;color:var(--text-soft);">${item.sku} · ${item.platform} · ${item.priceBand}</div>
                    </div>
                  </div>
                  <div style="font-size:12.5px;color:var(--text);background:#f8fafc;border-radius:6px;padding:7px 9px;">
                    <strong>推荐理由：</strong>${item.sysAdvice.reason}
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
                    <span>近2月：<strong>$${netRev.toLocaleString()}</strong></span>
                    <span>涨势：<strong style="color:var(--green-text)">+${item.trend}%</strong></span>
                    <span>毛利：<strong>${item.marginKnown?item.margin+"%":"待核价"}</strong></span>
                  </div>
                  <div style="display:flex;gap:6px;margin-top:auto;">
                    ${(item.stage === "初筛候选" || item.stage === "缺成本待补全")
                      ? `<button class="btn btn-sm btn-primary m4-submit" data-sku="${item.sku}" ${!isSelector?"disabled":""}>${ready.ok?"提交测款拍板 →":"送审核价 →"}</button>`
                      : `<span class="pill p-gray">${item.stage}</span>`}
                    <button class="btn btn-sm m4-detail" data-sku="${item.sku}">看详细依据</button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
            <div class="cat-tabs" style="margin-bottom:0;">
              ${allCats.map(c => `<div class="cat-tab ${state.m4CatTab===c?"active":""} m4-cattab" data-cat="${c}">${c==="ALL"?"全部品类":c}</div>`).join("")}
            </div>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;cursor:pointer;">
                <input type="checkbox" id="m4MyCatChk" ${state.m4OnlyMyCats?"checked":""}/> 只看我负责的类目（${state.selectorAssignedCats.join("/")}）
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:var(--green-text);cursor:pointer;">
                <input type="checkbox" id="m4ReadyChk" ${state.m4OnlyProduceReady?"checked":""}/> 只看可投产（剔除缺成本/外购估算/毛利&lt;10%）
              </label>
            </div>
          </div>

          <div class="filter-bar">
            <div class="filter-item"><label>搜索商品编号或名称</label><input id="m4SearchInp" class="input" placeholder="如：整理箱 / SKU-00515" value="${state.m4Search}"/></div>
            <div class="filter-item">
              <label>价格带</label>
              <select id="m4PriceSel" class="select">
                <option value="ALL">全部价格带</option>
                <option value="<$15" ${state.m4PriceFilter==="<$15"?"selected":""}>低价 (&lt;$15)</option>
                <option value="$15-30" ${state.m4PriceFilter==="$15-30"?"selected":""}>主力 ($15-30)</option>
                <option value="$30-60" ${state.m4PriceFilter==="$30-60"?"selected":""}>中高客单 ($30-60)</option>
              </select>
            </div>
            <div class="filter-item">
              <label>目标平台</label>
              <select id="m4RegSel" class="select">
                <option value="ALL">全部平台</option>
                <option value="Amazon US" ${state.m4RegionFilter==="Amazon US"?"selected":""}>Amazon US</option>
                <option value="TikTok US" ${state.m4RegionFilter==="TikTok US"?"selected":""}>TikTok US</option>
                <option value="Shopee TH" ${state.m4RegionFilter==="Shopee TH"?"selected":""}>Shopee TH</option>
              </select>
            </div>
            <div class="filter-item">
              <label>商品生命周期</label>
              <select id="m4LifeSel" class="select">
                <option value="ALL">全部阶段</option>
                <option value="新品期" ${state.m4LifecycleFilter==="新品期"?"selected":""}>新品期</option>
                <option value="快速上升期" ${state.m4LifecycleFilter==="快速上升期"?"selected":""}>快速上升期</option>
                <option value="成熟期" ${state.m4LifecycleFilter==="成熟期"?"selected":""}>成熟期</option>
                <option value="衰退期" ${state.m4LifecycleFilter==="衰退期"?"selected":""}>衰退期</option>
              </select>
            </div>
            <div class="filter-item">
              <label>风险等级</label>
              <select id="m4RiskSel" class="select">
                <option value="ALL">全部风险</option>
                <option value="低风险" ${state.m4RiskFilter==="低风险"?"selected":""}>低风险</option>
                <option value="中风险" ${state.m4RiskFilter==="中风险"?"selected":""}>中风险</option>
                <option value="高风险" ${state.m4RiskFilter==="高风险"?"selected":""}>高风险</option>
              </select>
            </div>
            <div class="filter-item">
              <label>数据来源</label>
              <select id="m4SrcSel" class="select">
                <option value="ALL">全部来源</option>
                <option value="内部实盘选品" ${state.m4SrcFilter==="内部实盘选品"?"selected":""}>内部实盘选品</option>
                <option value="外购行业估算" ${state.m4SrcFilter==="外购行业估算"?"selected":""}>外购行业估算</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <div class="utabs" style="margin-bottom:0;">
              ${tabs.map(t => {
                const cnt = baseFiltered.filter(x => t.key === "ALL" || x.stage === t.key).length;
                return `<div class="utab ${state.m4Tab===t.key?"active":""} m4-utab" data-t="${t.key}">${t.label} <span class="utab-cnt">${cnt}</span></div>`;
              }).join("")}
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-sm btn-primary" id="m4OpenCompareBtn" ${compareItems.length < 2 ? "disabled" : ""}>横向对比已选 (${compareItems.length}/4 款)</button>
              <button class="btn btn-sm" id="m4BatchSubmitBtn" ${(!isSelector || compareItems.length===0)?"disabled":""}>批量提交测款</button>
              <button class="btn btn-sm" id="m4BatchHoldBtn" ${(!isSelector || compareItems.length===0)?"disabled":""}>批量标为暂观望</button>
              <button class="btn btn-sm btn-danger" id="m4BatchElimBtn" ${(!isSelector || compareItems.length===0)?"disabled":""}>批量淘汰</button>
            </div>
          </div>

          ${paged.length === 0 ? `<div style="padding:28px;text-align:center;color:var(--text-soft);">当前筛选条件下暂无符合要求的候选商品，请放宽上方筛选条件。</div>` : `
            <div class="grid-2">
              ${paged.map(item => {
                const netQty = calcM4NetSales(item);
                const netRev = calcM4NetRev(item);
                const pr = calcM4Priority(item, maxRev, state.m4Mode);
                const ready = isProduceReady(item);
                const checked = state.m4CompareIds.includes(item.sku);
                const maxBar = Math.max(...(item.trend8w || [1]), 1);
                return `
                  <div class="prod-card" style="gap:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                        <input type="checkbox" class="m4-cmp-chk" data-sku="${item.sku}" ${checked?"checked":""} title="勾选加入对比或批量操作" style="width:16px;height:16px;cursor:pointer;"/>
                        <img src="${getProductImg(item.sku)}" class="prod-thumb-img" alt="${item.name}"/>
                        <div style="min-width:0;">
                          <div style="font-size:12px;color:var(--text-soft);">【它是什么】${item.sku} · ${item.category} · ${item.platform} · ${item.priceBand}</div>
                          <strong style="font-size:15px;">${item.name}</strong>
                          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:3px;">
                            <span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}">${item.src}</span>
                            <span class="pill p-blue">${item.lifecycle}</span>
                            <span class="pill ${item.riskLevel==="低风险"?"p-green":item.riskLevel==="高风险"?"p-red":"p-amber"}">${item.riskLevel}</span>
                            <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已提交待审"?"p-purple":item.stage==="初筛候选"?"p-blue":item.stage==="已淘汰"?"p-red":"p-amber"}">${item.stage}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style="background:${item.sysAdvice.tone==="p-green"?"#f0fdf4":item.sysAdvice.tone==="p-red"?"#fef2f2":"#fffbeb"};border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:12.5px;">
                      <strong>【系统建议做什么】</strong><span class="pill ${item.sysAdvice.tone}" style="margin-right:6px;">${item.sysAdvice.badge}</span>${item.sysAdvice.reason}
                      ${!ready.ok ? `<div style="color:var(--amber-text);font-size:12px;margin-top:3px;">投产门槛拦截：${ready.reasons.join("；")}</div>` : ""}
                    </div>

                    <div style="font-size:12.5px;">
                      <div style="font-weight:700;margin-bottom:4px;color:var(--text-muted);">【关键依据】</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8fafc;border-radius:7px;padding:8px 10px;">
                        <div>近2月卖了多少钱：<strong>$${netRev.toLocaleString()}</strong>（${netQty}件）</div>
                        <div>近8周销量涨跌：<strong style="color:${item.trend>=0?"var(--green-text)":"var(--red-text)"}">${item.trend>=0?"+":""}${item.trend}%</strong></div>
                        <div>预计毛利率：<strong>${item.marginKnown?item.margin+"%":'<span style="color:var(--amber-text)">缺成本未知</span>'}</strong></div>
                        <div>近2月退货率：<strong>${item.riskDetail.refundRate}</strong></div>
                      </div>
                    </div>

                    <details style="background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:12.5px;">
                      <summary style="cursor:pointer;font-weight:600;color:var(--blue-hover);">展开深度研判（近8周走势 / 竞品 / 供应链 / 4项风险 / 时机）</summary>
                      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">
                        <div>
                          <strong>1. 近 8 周周销量走势（周均 ${item.prevAvg} → ${item.currAvg} 件）：</strong>
                          <div style="display:flex;align-items:flex-end;gap:4px;height:38px;margin-top:4px;padding:4px 6px;background:#fff;border:1px solid var(--border);border-radius:5px;">
                            ${(item.trend8w || []).map((v, wi) => `<div title="第${wi+1}周: ${v}件" style="flex:1;height:${Math.max(15, Math.round((v/maxBar)*100))}%;background:#3b82f6;border-radius:2px;"></div>`).join("")}
                          </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                          <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:7px;">
                            <strong>2. 竞品格局</strong><br/>
                            在售竞品：${item.competition.competitors} 家<br/>
                            头部评论：${item.competition.topReviews}<br/>
                            主流售价：${item.competition.priceRange}<br/>
                            结论：${item.competition.verdict}
                          </div>
                          <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:7px;">
                            <strong>3. 供应链核价与交期</strong><br/>
                            预估采购价：${item.supplyChain.buyPrice}<br/>
                            起订量(MOQ)：${item.supplyChain.moq}<br/>
                            生产交期：${item.supplyChain.leadDays}<br/>
                            现货：${item.supplyChain.inStock}
                          </div>
                        </div>
                        <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:7px;">
                          <strong>4. 四项风险排查与入场时机：</strong><br/>
                          • 专利排雷：${item.riskDetail.ip} ｜ 认证要求：${item.riskDetail.cert}<br/>
                          • 季节属性：${item.riskDetail.seasonal} ｜ 时机判断：${item.timing.seasonNote}（${item.timing.stageNote}）<br/>
                          • 排序依据：${pr.explain}${pr.missingNote ? `（${pr.missingNote}）` : ""}
                        </div>
                      </div>
                    </details>

                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:4px;flex-wrap:wrap;">
                      <span style="font-size:12px;color:var(--text-soft);">【我能点的下一步】</span>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn btn-sm m4-detail" data-sku="${item.sku}">账目明细</button>
                        ${(item.stage === "初筛候选" || item.stage === "缺成本待补全")
                          ? `<button class="btn btn-sm btn-primary m4-submit" data-sku="${item.sku}" ${!isSelector?"disabled":""} title="${!isSelector?"需要「选品研究员」或「业务运营」权限":""}">${ready.ok?"提交主管拍板 →":"送审核价 →"}</button>`
                          : `<span style="font-size:12px;color:var(--text-soft);align-self:center;">状态：${item.stage} (${item.submitter})</span>`}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m4Page} / ${totalPages} 页 · 每页显示 4 款 · 共 ${tabFiltered.length} 款</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m4PrevPg" ${state.m4Page<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m4NextPg" ${state.m4Page>=totalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m4-mode-opt").forEach(el => el.onclick = () => {
          state.m4Mode = el.dataset.mode; state.m4Page = 1; rerender();
          toast(`已切换选品策略：${M4_MODES[state.m4Mode].label}，推荐顺序已刷新`);
        });
        document.querySelectorAll(".m4-cattab").forEach(el => el.onclick = () => {
          state.m4CatTab = el.dataset.cat; state.m4Page = 1; rerender();
        });
        document.getElementById("m4MyCatChk").onchange = (e) => { state.m4OnlyMyCats = e.target.checked; state.m4Page = 1; rerender(); };
        document.getElementById("m4ReadyChk").onchange = (e) => { state.m4OnlyProduceReady = e.target.checked; state.m4Page = 1; rerender(); };
        document.getElementById("m4SearchInp").oninput = (e) => { state.m4Search = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4PriceSel").onchange = (e) => { state.m4PriceFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RegSel").onchange = (e) => { state.m4RegionFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4LifeSel").onchange = (e) => { state.m4LifecycleFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RiskSel").onchange = (e) => { state.m4RiskFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4SrcSel").onchange = (e) => { state.m4SrcFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.querySelectorAll(".m4-utab").forEach(t => t.onclick = () => { state.m4Tab = t.dataset.t; state.m4Page = 1; rerender(); });
        document.getElementById("m4PrevPg").onclick = () => { state.m4Page -= 1; rerender(); };
        document.getElementById("m4NextPg").onclick = () => { state.m4Page += 1; rerender(); };

        document.querySelectorAll(".m4-cmp-chk").forEach(chk => chk.onchange = () => {
          const sku = chk.dataset.sku;
          if (chk.checked) {
            if (state.m4CompareIds.length >= 4) { chk.checked = false; toast("最多支持同时勾选 4 款商品进行对比", "warn"); return; }
            if (!state.m4CompareIds.includes(sku)) state.m4CompareIds.push(sku);
          } else {
            state.m4CompareIds = state.m4CompareIds.filter(id => id !== sku);
          }
          rerender();
        });

        document.getElementById("m4OpenCompareBtn").onclick = () => {
          const items = state.m4Pool.filter(x => state.m4CompareIds.includes(x.sku));
          openModal(`候选商品横向对比（已选 ${items.length} 款）`, `
            <div class="table-wrap" style="max-height:420px;">
              <table>
                <thead><tr><th>对比维度</th>${items.map(i => `<th>${i.sku}<br/>${i.name}</th>`).join("")}</tr></thead>
                <tbody>
                  <tr><td>品类 / 平台</td>${items.map(i => `<td>${i.category} · ${i.platform}</td>`).join("")}</tr>
                  <tr><td>系统建议</td>${items.map(i => `<td><span class="pill ${i.sysAdvice.tone}">${i.sysAdvice.badge}</span></td>`).join("")}</tr>
                  <tr><td>近2月销售额</td>${items.map(i => `<td><strong>$${calcM4NetRev(i).toLocaleString()}</strong></td>`).join("")}</tr>
                  <tr><td>近8周涨跌</td>${items.map(i => `<td><strong>${i.trend>=0?"+":""}${i.trend}%</strong></td>`).join("")}</tr>
                  <tr><td>预计毛利率</td>${items.map(i => `<td>${i.marginKnown?i.margin+"%":"待核价"}</td>`).join("")}</tr>
                  <tr><td>生命周期 / 竞品数</td>${items.map(i => `<td>${i.lifecycle} · ${i.competition.competitors}家</td>`).join("")}</tr>
                  <tr><td>采购价 / MOQ / 交期</td>${items.map(i => `<td>${i.supplyChain.buyPrice} / ${i.supplyChain.moq} / ${i.supplyChain.leadDays}</td>`).join("")}</tr>
                  <tr><td>风险等级与退货率</td>${items.map(i => `<td>${i.riskLevel} (${i.riskDetail.refundRate})</td>`).join("")}</tr>
                </tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:12px;">
              <button class="btn btn-primary" id="m4CmpClose">关闭对比</button>
            </div>
          `, (root) => { root.querySelector("#m4CmpClose").onclick = () => document.getElementById("modalRoot").innerHTML = ""; });
        };

        const runBatchOp = (opLabel, targetStage, isDanger) => {
          const selected = state.m4Pool.filter(x => state.m4CompareIds.includes(x.sku));
          commitAction({
            title: `二次确认：${opLabel}（共 ${selected.length} 款）`,
            danger: isDanger,
            summary: `即将把已勾选的 ${selected.map(x=>x.sku).join("、")} 批量流转为「${targetStage}」。`,
            confirmText: `确认${opLabel}`,
            fieldsHtml: `<div class="field"><label>批量操作原因（必填）*</label><input id="m4BatReason" class="input" placeholder="如：本批符合家居收纳秋季上新节奏"/></div>`,
            validate: (w) => w.querySelector("#m4BatReason").value.trim() ? [] : [{ el: w.querySelector("#m4BatReason"), msg: "请填写操作原因" }],
            onConfirm: (w) => {
              const rsn = w.querySelector("#m4BatReason").value.trim();
              selected.forEach(item => {
                item.stage = targetStage;
                item.submitter = ROLE_PERSON_NAMES[state.role];
                item.submitReason = rsn;
              });
              state.m4CompareIds = [];
              return { toastMsg: `已完成${opLabel}：共处理 ${selected.length} 款` };
            },
            audit: (w) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 批量将 ${selected.map(x=>x.sku).join("、")} 设为「${targetStage}」，原因：${w.querySelector("#m4BatReason").value.trim()}`,
              ok: true
            })
          });
        };
        document.getElementById("m4BatchSubmitBtn").onclick = () => runBatchOp("批量提交测款", "已提交待审", false);
        document.getElementById("m4BatchHoldBtn").onclick = () => runBatchOp("批量标为暂观望", "缺成本待补全", false);
        document.getElementById("m4BatchElimBtn").onclick = () => runBatchOp("批量淘汰", "已淘汰", true);

        document.querySelectorAll(".m4-submit").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          commitAction({
            title: `提交选品待主管终审 · ${item.sku} (${item.name})`,
            summary: `提交后将流转至 M4-3 由「主管 / 审批人」最终拍板。${item.marginKnown ? "" : "⚠️ 该款采购成本暂缺，主管页仅允许退回核价或淘汰，不可直接投产。"}`,
            confirmText: "确认提交待审",
            fieldsHtml: `
              <div class="field"><label>初筛推荐理由与风险核查结论（必填）*</label><textarea id="m4SubReason" class="textarea" placeholder="写明推荐依据（近2月销额、近8周涨势、专利核查结论等）..."></textarea></div>
              <div class="field"><label>预计测款预算与首批数量（必填）*</label><input id="m4SubBudget" class="input" value="${item.budget}"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const r = wrap.querySelector("#m4SubReason");
              const bg = wrap.querySelector("#m4SubBudget");
              if (!r.value.trim()) errs.push({ el: r, msg: "必须填写推荐理由" });
              if (!bg.value.trim()) errs.push({ el: bg, msg: "必须确认测款预算占用" });
              return errs;
            },
            onConfirm: (wrap) => {
              item.stage = "已提交待审";
              item.submitter = ROLE_PERSON_NAMES[state.role];
              item.submitReason = wrap.querySelector("#m4SubReason").value.trim();
              item.budget = wrap.querySelector("#m4SubBudget").value.trim();
              return { toastMsg: `${item.sku} 已提交至 M4-3 待主管终审` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 将选品 ${item.sku}（${item.name}）提交主管审批，申请测款预算 ${wrap.querySelector("#m4SubBudget").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m4-detail").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          const netQty = calcM4NetSales(item);
          const netRev = calcM4NetRev(item);
          openDrawer(`${item.sku} · ${item.name}`, `${item.category} · ${item.platform} · ${item.src}`, `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <img src="${getProductImg(item.sku)}" class="prod-thumb-lg" alt="${item.name}"/>
              <div>
                <strong>${item.name}</strong>
                <div style="font-size:12.5px;color:var(--text-soft);margin-top:3px;">系统建议：${item.sysAdvice.badge}（${item.sysAdvice.reason}）</div>
              </div>
            </div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>经营核算明细：</strong><br/>
              1. 近2月净销量 = 支付 ${item.paidQty} − 退款 ${item.refundQty} = <strong>${netQty} 件</strong><br/>
              2. 近2月销售额 = 销售 $${item.grossRev.toLocaleString()} − 折扣 $${item.discount} − 退款 $${item.refundAmt} = <strong>$${netRev.toLocaleString()}</strong><br/>
              3. 近8周销量涨跌 = 从周均 ${item.prevAvg} 件变至 ${item.currAvg} 件（<strong>${item.trend>=0?"+":""}${item.trend}%</strong>）<br/>
              4. 预计毛利率 = ${item.marginKnown ? `<strong>${item.margin}%</strong>` : "<strong>未知（缺成本，不按0元估算）</strong>"}
            </div>
          `);
        });
      }
    };
  }

  // ==================== M4-3: 主管测款终审拍板（创建 M5 & M7 下游任务） ====================
  if (pageId === "m4c") {
    const isApprover = state.role === "approver";
    const reviewList = state.m4Pool.filter(x => x.stage === "已提交待审" || x.stage === "已批准测款" || x.stage === "已淘汰");
    const approvedCnt = state.m4Pool.filter(x => x.stage === "已批准测款").length;

    return {
      headerActions: [
        { label: "← 返回选品工作台", primary: false, onClick: () => goPage("m4b") },
        { label: `查看下游预测池 (${approvedCnt}款) →`, primary: false, onClick: () => goPage("m5a") },
        { label: `查看下游内容任务 (${approvedCnt}款) →`, primary: true, onClick: () => goPage("m7a") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>下游任务联动：</strong>已有 <strong>${approvedCnt} 款</strong>商品经主管批准测款，系统已自动为它们创建 <strong>${approvedCnt * 2} 个下游任务</strong>（分别进入 M5 销量预测池 与 M7 内容创作队列）。</span>
        </div>

        <div class="grid-3">
          <div class="kpi-card highlight-purple"><div class="kpi-label">待主管终审选品</div><div class="kpi-val" style="color:var(--purple-text)">${state.m4Pool.filter(x=>x.stage==="已提交待审").length} 款</div><div class="kpi-sub">需主管填写意见拍板</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">已批准测款（下游已建任务）</div><div class="kpi-val" style="color:var(--green-text)">${approvedCnt} 款</div><div class="kpi-sub">已创建 ${approvedCnt * 2} 个 M5/M7 任务</div></div>
          <div class="kpi-card"><div class="kpi-label">已淘汰选品</div><div class="kpi-val">${state.m4Pool.filter(x=>x.stage==="已淘汰").length} 款</div><div class="kpi-sub">未达标品留档防重复入池</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">选品测款终审清单</div>
            <span class="pill ${isApprover?"p-green":"p-amber"}">${isApprover?"主管审批权限已就绪":"需要「主管 / 审批人」权限才可拍板"}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${reviewList.map(item => {
              const netRev = calcM4NetRev(item);
              const passHardGate = item.srcCode === "INTERNAL" && item.marginKnown && item.margin >= 10;
              const isSelfSub = item.submitter === ROLE_PERSON_NAMES[state.role];
              const canDecide = isApprover && !isSelfSub;
              return `
                <div class="card" style="margin:0;background:#f8fafc;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <img src="${getProductImg(item.sku)}" class="prod-thumb-lg" alt="${item.name}"/>
                      <div>
                        <strong style="font-size:15px;">${item.sku} · ${item.name}</strong>
                        <span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}" style="margin-left:6px;">${item.src}</span>
                        <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已淘汰"?"p-red":"p-purple"}" style="margin-left:4px;">${item.stage}</span>
                        <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
                          近2月卖了 <strong>$${netRev.toLocaleString()}</strong> · 近8周涨跌 <strong>${item.trend>=0?"+":""}${item.trend}%</strong> · 预计毛利率 <strong>${item.marginKnown?item.margin+"%":"未知"}</strong> · 测款预算 <strong>${item.budget}</strong>
                        </div>
                        <div style="font-size:12.5px;margin-top:3px;">提交人：<strong>${item.submitter}</strong> ｜ 推荐理由：${item.submitReason || "—"}</div>
                        ${item.approver ? `<div style="font-size:12.5px;color:var(--green-text);margin-top:3px;">✓ 终审人：<strong>${item.approver}</strong> ｜ 意见：${item.decisionReason} ｜ 凭证：${item.evidence}</div>` : ""}
                        ${item.stage === "已批准测款" ? `<div style="font-size:12px;color:var(--blue-hover);margin-top:3px;">🔗 已创建 2 个下游任务：已加入 M5 销量预测池 & M7 商品内容创作队列</div>` : ""}
                      </div>
                    </div>

                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <button class="btn btn-sm btn-success m4c-decide" data-sku="${item.sku}" data-act="已批准测款" ${(!canDecide || !passHardGate)?"disabled":""} title="${!isApprover?"需主管权限":!passHardGate?"须满足内部实盘且毛利率≥10%":""}">✓ 同意测款</button>
                      <button class="btn btn-sm btn-primary m4c-decide" data-sku="${item.sku}" data-act="缺成本待补全" ${!canDecide?"disabled":""}>退回补采成本</button>
                      <button class="btn btn-sm btn-danger m4c-decide" data-sku="${item.sku}" data-act="已淘汰" ${!canDecide?"disabled":""}>✕ 淘汰</button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m4c-decide").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          const act = b.dataset.act;
          commitAction({
            title: `测款终审拍板 · ${item.sku} → ${act}`,
            danger: act === "已淘汰",
            summary: act === "已批准测款" ? "批准后将立即为下游创建「M5 销量预测任务」与「M7 商品文案主图任务」，供运营与内容团队接手。" : "请填写明确拍板原因与佐证单号。",
            confirmText: `确认：${act}`,
            fieldsHtml: `
              <div class="field"><label>主管终审意见（必填）*</label><textarea id="m4cReason" class="textarea" placeholder="${act==="已批准测款"?"如：实盘利润率达标，批准首批测款":"如：请补充最新核价表 / 利润偏低淘汰"}"></textarea></div>
              <div class="field"><label>核价单或审批依据文件名（必填）*</label><input id="m4cEvid" class="input" value="测款核价表_${item.sku}.pdf"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const r = wrap.querySelector("#m4cReason");
              const ev = wrap.querySelector("#m4cEvid");
              if (!r.value.trim()) errs.push({ el: r, msg: "终审决策意见为必填项" });
              if (!ev.value.trim()) errs.push({ el: ev, msg: "请填写佐证依据文件" });
              return errs;
            },
            onConfirm: (wrap) => {
              item.stage = act;
              item.approver = ROLE_PERSON_NAMES[state.role];
              item.decisionReason = wrap.querySelector("#m4cReason").value.trim();
              item.evidence = wrap.querySelector("#m4cEvid").value.trim();
              if (act === "已批准测款") {
                state.m7Sku = item.sku;
                state.m5ForecastRegistry[item.sku] = false;
                return { toastMsg: `${item.sku} 已批准测款！已创建 2 个下游任务（进入 M5 预测池 & M7 内容队列）` };
              }
              return { toastMsg: `终审已拍板：${item.sku} → ${act}`, toastLevel: act === "已淘汰" ? "warn" : "success" };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 对选品 ${item.sku} 拍板「${act}」，意见：${wrap.querySelector("#m4cReason").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M5-1: 商品销量画像与预测方案 ====================
  if (pageId === "m5a") {
    const canEditM5 = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const approvedNewSkus = state.m4Pool.filter(x => x.stage === "已批准测款");
    const recMod = state.m5Models.find(m => m.name === state.m5Model) || state.m5Models[0];

    return {
      headerActions: [{ label: "下一步：执行销量预测 →", primary: true, onClick: () => goPage("m5b") }],
      html: `
        <div class="banner banner-blue">
          <span><strong>运营说明：</strong>系统按商品已有历史天数和出单规律为您匹配预测方案，您只需看<strong>「适合哪种商品」</strong>和<strong>「当前能否使用」</strong>；任何修改和启停均要求填写依据并留存变更记录。</span>
        </div>

        <div class="banner banner-green">
          <span><strong>来自 M4 测款联动任务：</strong>当前共有 <strong>${approvedNewSkus.length} 款</strong>主管已批准测款新品（${approvedNewSkus.map(x=>`${x.sku} ${x.name}`).join("、")}），已进入待预测池。</span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">当前生效画像方案（${state.m5Sku} · 版本 v${state.demandProfileVer}）</div>
            <button class="btn btn-sm btn-primary" id="editDpBtn" ${!canEditM5?"disabled":""}>修改销量特征方案 (版本 +1)</button>
          </div>
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">分析商品</div><div style="font-weight:700;margin-top:6px;">${state.m5Sku}</div></div>
            <div class="kpi-card"><div class="kpi-label">可用销售历史天数</div><div style="font-weight:700;margin-top:6px;">${state.m5History96.length} 天（已排除今日未完结）</div></div>
            <div class="kpi-card"><div class="kpi-label">商品出单规律画像</div><div style="font-weight:700;margin-top:6px;">${state.demandProfileMode}</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">当前生效预测方案</div><div style="font-weight:700;margin-top:6px;color:var(--blue-hover)">${recMod.bizName}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">内置预测方案库（9 套业务策略 · 按销售天数自动校验门槛）</div>
            <span class="pill p-blue">当前历史：${state.m5History96.length} 天</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>预测方案（含后台编号）</th><th>策略类型</th><th>适合哪种商品（业务场景）</th><th>所需销售天数</th><th>当前 ${state.m5History96.length} 天能否使用</th><th>开关状态</th><th>通俗说明</th><th>操作</th></tr></thead>
              <tbody>
                ${state.m5Models.map((m, i) => {
                  const pass = state.m5History96.length >= m.minPts;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${m.bizName}</strong><div style="font-size:12px;color:var(--text-soft);">${m.name}</div></td>
                      <td class="nowrap"><span class="pill p-blue">${m.familyLabel}</span></td>
                      <td style="font-size:12.5px;min-width:170px;"><strong>${m.bestFor}</strong></td>
                      <td class="nowrap">≥ ${m.minPts} 天</td>
                      <td class="nowrap"><span class="pill ${pass?"p-green":"p-amber"}">${pass?"天数足够，可使用 ✓":"天数不足 (缺"+(m.minPts - state.m5History96.length)+"天)"}</span></td>
                      <td class="nowrap"><span class="pill ${m.enabled?"p-green":"p-gray"}">${m.enabled?"已启用":"已停用"}</span></td>
                      <td style="font-size:12.5px;color:var(--text-muted);min-width:180px;">${m.desc}</td>
                      <td class="nowrap"><button class="btn btn-sm m5-toggle" data-i="${i}" ${!canEditM5?"disabled":""}>${m.enabled?"停用":"启用"}</button></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">画像与方案变更记录（改了什么 / 为什么 / 谁改的）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>版本</th><th>修改人</th><th>变更内容</th><th>变更依据</th><th>修改时间</th></tr></thead>
              <tbody>
                ${state.m5ProfileLogs.map(l => `
                  <tr>
                    <td class="nowrap"><strong>${l.ver}</strong></td>
                    <td class="nowrap">${l.who}</td>
                    <td>${l.change}</td>
                    <td style="font-size:12.5px;">${l.reason}</td>
                    <td class="nowrap">${l.time}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("editDpBtn").onclick = () => {
          const oldMode = state.demandProfileMode;
          commitAction({
            title: `修改商品销量画像方案 (v${state.demandProfileVer} → v${state.demandProfileVer + 1})`,
            summary: "保存后将自动升级版本号并记录修改人、变更前后差异与调整原因。",
            confirmText: "确认保存画像方案",
            fieldsHtml: `
              <div class="field"><label>选择新的出单规律模式 *</label>
                <select id="dpModeSel" class="select">
                  <option ${oldMode.includes("平稳")?"selected":""}>平稳季节 + 短周期波动</option>
                  <option ${oldMode.includes("促销")?"selected":""}>促销敏感 + 周季节性</option>
                  <option ${oldMode.includes("间歇")?"selected":""}>长尾间歇性需求</option>
                </select>
              </div>
              <div class="field"><label>本次调整原因（必填）*</label><input id="dpReason" class="input" placeholder="如：黑五促销临近调整为促销敏感模式"/></div>
            `,
            validate: (wrap) => {
              const el = wrap.querySelector("#dpReason");
              return el.value.trim() ? [] : [{ el, msg: "必须填写画像变更原因" }];
            },
            onConfirm: (wrap) => {
              const nextMode = wrap.querySelector("#dpModeSel").value;
              const reason = wrap.querySelector("#dpReason").value.trim();
              state.demandProfileVer += 1;
              state.demandProfileMode = nextMode;
              state.m5ProfileLogs.unshift({
                ver: `v${state.demandProfileVer}`, who: ROLE_PERSON_NAMES[state.role],
                time: nowDateTimeStr(), change: `${oldMode} → ${nextMode}`, reason
              });
              return { toastMsg: `画像方案已升级为 v${state.demandProfileVer} 并记录变更历史` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 将 ${state.m5Sku} 销量画像调整为「${wrap.querySelector("#dpModeSel").value}」（版本 v${state.demandProfileVer}），原因：${wrap.querySelector("#dpReason").value.trim()}`,
              ok: true
            })
          });
        };

        document.querySelectorAll(".m5-toggle").forEach(b => b.onclick = () => {
          const m = state.m5Models[Number(b.dataset.i)];
          const nextState = !m.enabled;
          commitAction({
            title: `${nextState ? "启用" : "停用"}预测方案 · ${m.bizName}`,
            confirmText: `确认${nextState ? "启用" : "停用"}`,
            fieldsHtml: `<div class="field"><label>启停操作依据（必填）*</label><input id="m5TogReason" class="input" placeholder="如：近期预测误差率偏高，暂时停用该方案"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m5TogReason");
              return el.value.trim() ? [] : [{ el, msg: "必须填写启停操作依据" }];
            },
            onConfirm: (wrap) => {
              const rsn = wrap.querySelector("#m5TogReason").value.trim();
              m.enabled = nextState;
              state.m5ProfileLogs.unshift({
                ver: `v${state.demandProfileVer}`, who: ROLE_PERSON_NAMES[state.role],
                time: nowDateTimeStr(), change: `${nextState?"启用":"停用"}方案「${m.bizName}」`, reason: rsn
              });
              return { toastMsg: `方案「${m.bizName}」已${m.enabled ? "启用" : "停用"}` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} ${nextState?"启用":"停用"}了预测方案「${m.bizName}」，依据：${wrap.querySelector("#m5TogReason").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M5-2: 销量预测执行与补货参考 ====================
  if (pageId === "m5b") {
    const canRunFc = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const invRow = state.inventoryItems.find(i => i.sku === state.m5Sku && i.shopMode === "REAL") || state.inventoryItems[0];
    const mult = state.m5Horizon === 14 ? 2.0 : state.m5Horizon === 30 ? 4.25 : 1;
    const totalPred = Math.round(state.m5DailyPred.reduce((a, b) => a + b, 0) * mult);
    const refOrder = Math.max(0, totalPred + invRow.safety - invRow.avail);
    const activeModObj = state.m5Models.find(m => m.name === state.m5Model) || state.m5Models[0];

    const maxY = Math.max(...state.m5DailyPred, 120);
    const pts = state.m5DailyPred.map((v, idx) => {
      const x = 70 + idx * 120;
      const y = Math.round(180 - (v / (maxY * 1.15)) * 140);
      return { x, y, v, label: idx === 6 ? `第${state.m5Horizon}天` : `第${idx + 1}天` };
    });
    const linePts = pts.map(p => `${p.x},${p.y}`).join(" ");
    const polyPts = `${pts.map(p => `${p.x},185`).join(" ")} ${[...pts].reverse().map(p => `${p.x},${Math.max(24, p.y - 24)}`).join(" ")}`;

    return {
      headerActions: [
        { label: "← 调整画像与方案", primary: false, onClick: () => goPage("m5a") },
        { label: "下一步：误差复盘与修正 →", primary: true, onClick: () => goPage("m5c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>执行说明：</strong>本页根据历史已完成订单计算未来销量（自动剔除今日未结束销量），并实时联动 M0-3 当前可售库存给出建议补货参考量。</span>
        </div>

        ${renderAsyncBox("m5_run")}

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item">
              <label>选择预测商品</label>
              <select id="m5SkuSel" class="select">
                <option value="BAG-108" ${state.m5Sku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包</option>
                <option value="FAN-203" ${state.m5Sku==="FAN-203"?"selected":""}>FAN-203 · 便携静音循环扇</option>
                <option value="COS-052" ${state.m5Sku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜</option>
                ${state.m4Pool.filter(x=>x.stage==="已批准测款").map(x=>`<option value="${x.sku}" ${state.m5Sku===x.sku?"selected":""}>${x.sku} · ${x.name} (M4新批准)</option>`).join("")}
              </select>
            </div>
            <div class="filter-item">
              <label>预测未来天数</label>
              <select id="m5HorSel" class="select">
                <option value="7" ${state.m5Horizon===7?"selected":""}>未来 7 天</option>
                <option value="14" ${state.m5Horizon===14?"selected":""}>未来 14 天</option>
                <option value="30" ${state.m5Horizon===30?"selected":""}>未来 30 天</option>
              </select>
            </div>
            <div class="filter-item">
              <label>选用预测方案</label>
              <select id="m5ModSel" class="select">
                ${state.m5Models.filter(m=>m.enabled).map(m=>`<option value="${m.name}" ${state.m5Model===m.name?"selected":""}>${m.bizName} (${m.name})</option>`).join("")}
              </select>
            </div>
            <div><button class="btn btn-primary" id="m5RunBtn" ${!canRunFc?"disabled":""}>▶ 立即计算最新预测</button></div>
          </div>
          <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px;">
            本次计算使用历史范围：<strong>${state.m5LastRunMeta.range}</strong> ｜ 采用方案：<strong>${activeModObj.bizName}</strong> ｜ 运算耗时：<strong>${state.m5LastRunMeta.runtimeMs} 毫秒</strong> ｜ 执行时间：${state.m5LastRunMeta.time}
          </div>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">未来 ${state.m5Horizon} 天预测总销量</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${totalPred} 件</div>
            <div class="kpi-sub">按历史日销量实时算得</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">M0-3 实时可售库存</div>
            <div class="kpi-val">${invRow.avail} 件</div>
            <div class="kpi-sub">${invRow.shopName} · ${invRow.whName}</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">建议补货参考量</div>
            <div class="kpi-val" style="color:var(--green-text)">${refOrder} 件</div>
            <div class="formula-inline">参考计算：预测 ${totalPred} + 安全库存 ${invRow.safety} − 可售 ${invRow.avail} = ${refOrder} 件</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">波动参考带说明</div>
            <div class="kpi-val" style="color:var(--amber-text);font-size:18px;">历史波动参考</div>
            <div class="kpi-sub">由历史偏差推算，非保底承诺</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">未来 ${state.m5Horizon} 天预测销量走势 · ${state.m5Sku}（${activeModObj.bizName}）</div>
            <span class="pill p-amber">浅蓝阴影代表历史波动参考区间</span>
          </div>
          <svg viewBox="0 0 860 230" style="width:100%;height:auto;max-height:245px;display:block;background:#ffffff;border-radius:6px;">
            <line x1="50" y1="35" x2="820" y2="35" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="85" x2="820" y2="85" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="135" x2="820" y2="135" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="185" x2="820" y2="185" stroke="#e2e8f0" stroke-width="1"/>
            <polygon fill="#eff6ff" points="${polyPts}" />
            <polyline fill="none" stroke="#2563eb" stroke-width="2.2" points="${linePts}" />
            ${pts.map(p => `
              <circle cx="${p.x}" cy="${p.y}" r="3.8" fill="#2563eb" stroke="#ffffff" stroke-width="1.4"/>
              <text x="${p.x}" y="${p.y-10}" font-size="11.5" font-weight="600" fill="#1d4ed8" text-anchor="middle">${p.v}件</text>
              <text x="${p.x}" y="203" font-size="11.5" fill="#475569" text-anchor="middle">${p.label}</text>
            `).join("")}
            <circle cx="58" cy="221" r="3" fill="#2563eb"/><text x="66" y="224" font-size="11.5" fill="#475569">蓝线：预测每天销量</text>
            <rect x="240" y="216" width="10" height="8" rx="1.5" fill="#dbeafe"/><text x="255" y="224" font-size="11.5" fill="#475569">浅蓝阴影：根据历史误差计算的参考波动范围</text>
          </svg>
        </div>
      `,
      bind: () => {
        const triggerRecalc = () => {
          state.m5DailyPred = runLocalForecastAlgo(state.m5History96, state.m5Model, state.m5Horizon);
        };
        document.getElementById("m5SkuSel").onchange = (e) => { state.m5Sku = e.target.value; rerender(); };
        document.getElementById("m5HorSel").onchange = (e) => { state.m5Horizon = Number(e.target.value); triggerRecalc(); rerender(); };
        document.getElementById("m5ModSel").onchange = (e) => { state.m5Model = e.target.value; triggerRecalc(); rerender(); };
        document.getElementById("m5RunBtn").onclick = () => {
          const modObj = state.m5Models.find(m => m.name === state.m5Model);
          const lackPts = modObj && state.m5History96.length < modObj.minPts;
          runAsyncTask("m5_run", {
            label: `正在计算销量预测 · ${state.m5Sku} (${modObj.bizName})`,
            steps: ["校验商品历史订单天数是否达标", "剔除当日未完结销量并计算未来走势", "结合 M0-3 最新库存重算建议补货量"],
            durationMs: 900,
            shouldFail: lackPts,
            failReason: `历史天数不足：「${modObj.bizName}」至少需要 ${modObj.minPts} 天订单，当前仅有 ${state.m5History96.length} 天，请改用「畅销品星期规律方案」或「新品快速估算方案」。`,
            onSuccess: () => {
              const t0 = Date.now();
              triggerRecalc();
              state.m5ForecastRegistry[state.m5Sku] = true;
              state.m5LastRunMeta = {
                model: state.m5Model, horizon: state.m5Horizon,
                range: "2026-08-15 至 2026-11-18（已自动排除今日未完结订单）",
                runtimeMs: Math.max(48, Date.now() - t0 + 95), time: nowDateTimeStr()
              };
              return { summary: `已生成 ${state.m5Sku} 未来 ${state.m5Horizon} 天预测，并解锁 M6-2 智能补货`, toastMsg: `预测完成：${state.m5Sku} 未来 ${state.m5Horizon} 天预计需求已更新` };
            }
          });
        };
      }
    };
  }

  // ==================== M5-3: 预测误差率（WAPE）复盘与缺货修正 ====================
  if (pageId === "m5c") {
    const canEditEval = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const sumActual = state.m5Eval.reduce((s, r) => s + r.actual, 0);
    const sumAbs = state.m5Eval.reduce((s, r) => s + Math.abs(r.actual - r.pred), 0);
    const sumBias = state.m5Eval.reduce((s, r) => s + (r.pred - r.actual), 0);
    const wape = ((sumAbs / (sumActual || 1)) * 100).toFixed(2);
    const mae = (sumAbs / state.m5Eval.length).toFixed(1);
    const bias = ((sumBias / (sumActual || 1)) * 100).toFixed(1);
    const grade = Number(wape) <= 5 ? "极准 (≤5%)" : Number(wape) <= 10 ? "优秀 (5~10%)" : Number(wape) <= 20 ? "良好 (10~20%)" : Number(wape) <= 30 ? "一般 (20~30%)" : "偏差较大 (>30%)";

    return {
      headerActions: [
        { label: "← 返回销量预测", primary: false, onClick: () => goPage("m5b") },
        { label: "前往 M6-2 智能补货 →", primary: true, onClick: () => goPage("m6b") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>术语白话解释：</strong><strong>WAPE = 预测误差率</strong>（越低越准，代表平均差了百分之几）；<strong>修正 = 剔除缺货日影响</strong>（仓库断货那天没卖出去不代表没人想买，需标记缺货日还原真实需求，同时永久保留原始订单实销做对比）。</span>
        </div>

        <div class="grid-3">
          <div class="kpi-card highlight-green">
            <div class="kpi-label">预测误差率（WAPE · 越小越准）</div>
            <div class="kpi-val" style="color:var(--green-text)">${wape}%</div>
            <div class="kpi-sub">评级：<strong>${grade}</strong></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">平均每天偏差件数</div>
            <div class="kpi-val">${mae} 件/天</div>
            <div class="kpi-sub">每天平均少算或多算的件数</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">整体偏高 / 偏低倾向</div>
            <div class="kpi-val" style="color:${Number(bias)>=0?"var(--amber-text)":"var(--blue-hover)"}">${Number(bias)>=0?"偏高 +":"偏低 "}${bias}%</div>
            <div class="kpi-sub">${Number(bias)>=0?"预测略高于实际销量":"预测略低于实际销量"}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">逐日预测与实际销量复盘（保留原始订单实销，修正须填原因）</div>
            <button class="btn btn-sm btn-primary" id="m5cSaveBtn" ${!canEditEval?"disabled":""}>💾 确认并保存修正记录</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>销售日期</th><th>当时预测销量</th><th>原始订单实销 (永不覆盖)</th><th>修正后参考需求</th><th>是否缺货日</th><th>修正原因说明</th></tr></thead>
              <tbody>
                ${state.m5Eval.map((r, i) => `
                  <tr>
                    <td class="nowrap"><strong>${r.date}</strong></td>
                    <td class="nowrap">${r.pred} 件</td>
                    <td class="nowrap"><strong>${r.origActual} 件</strong></td>
                    <td class="nowrap">
                      <input type="number" class="input m5c-act-inp" data-i="${i}" value="${r.actual}" style="width:92px;" ${!canEditEval?"disabled":""}/>
                    </td>
                    <td class="nowrap">
                      <label style="font-size:12.5px;cursor:pointer;">
                        <input type="checkbox" class="m5c-so-chk" data-i="${i}" ${r.stockout?"checked":""} ${!canEditEval?"disabled":""}/> 标记为缺货日
                      </label>
                    </td>
                    <td>
                      <input type="text" class="input m5c-rsn-inp" data-i="${i}" value="${r.editReason}" placeholder="修改数值时必填原因（如：断货少卖18件）" ${!canEditEval?"disabled":""}/>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m5cSaveBtn").onclick = () => {
          const actInputs = [...document.querySelectorAll(".m5c-act-inp")];
          const soChecks = [...document.querySelectorAll(".m5c-so-chk")];
          const rsnInputs = [...document.querySelectorAll(".m5c-rsn-inp")];
          const changed = [];
          for (let i = 0; i < state.m5Eval.length; i++) {
            const newVal = Number(actInputs[i].value);
            const isSo = soChecks[i].checked;
            const rsn = rsnInputs[i].value.trim();
            if (newVal < 0 || Number.isNaN(newVal)) { toast("销量不能为负数", "error"); return; }
            if ((newVal !== state.m5Eval[i].actual || isSo !== state.m5Eval[i].stockout) && !rsn) {
              rsnInputs[i].classList.add("input-err");
              toast(`请为 ${state.m5Eval[i].date} 填写修正或标记缺货原因`, "error");
              return;
            }
            if (newVal !== state.m5Eval[i].actual || isSo !== state.m5Eval[i].stockout) {
              changed.push({ i, newVal, isSo, rsn });
            }
          }
          if (!changed.length) { toast("未检测到任何修改", "info"); return; }
          commitAction({
            title: "保存预测复盘修正并重算误差率",
            summary: `共修改 ${changed.length} 天的复盘参考值；系统将永久保留「原始订单实销」作为对比依据，仅更新修正后误差率。`,
            confirmText: "确认保存修正",
            onConfirm: () => {
              changed.forEach(c => {
                state.m5Eval[c.i].actual = c.newVal;
                state.m5Eval[c.i].stockout = c.isSo;
                state.m5Eval[c.i].edited = true;
                state.m5Eval[c.i].editReason = c.rsn;
              });
              return { toastMsg: "预测复盘修正已保存，预测误差率（WAPE）已实时重算" };
            },
            audit: {
              sentence: `${ROLE_PERSON_NAMES[state.role]} 修正了 ${changed.length} 天的预测复盘参考需求（保留原始订单实销），原因：${changed[0].rsn}`,
              ok: true
            }
          });
        };
      }
    };
  }

  // ==================== M6-1: 常规补货测算（完整参数快照 + 三方案对比） ====================
  if (pageId === "m6a") {
    const canPlan = state.role === "planner" || state.role === "approver";
    const invRow = state.inventoryItems.find(i => i.sku === state.m6NormalSku && i.shopMode === "REAL") || state.inventoryItems[2];
    const prod = state.masterProducts.find(p => p.sku === state.m6NormalSku) || state.masterProducts[1];
    const missingCost = prod.cost === null;
    const baseDaily = 30;
    const adjDaily = Math.round(baseDaily * (1 + (state.m6NormalSeasonPct + state.m6NormalPromoPct) / 100));
    const targetInv = adjDaily * (state.m6NormalLeadDays + state.m6NormalSafetyDays);
    const gap = Math.max(0, targetInv - invRow.avail - state.m6NormalInTransit);
    const plans = [
      { label: "保守备货 (85%)", qty: Math.round(gap * 0.85), cash: Math.round(gap * 0.85 * (prod.cost + prod.freight || 11.2)) },
      { label: "平衡推荐 (100%)", qty: gap, cash: Math.round(gap * (prod.cost + prod.freight || 11.2)) },
      { label: "积极备货 (120%)", qty: Math.round(gap * 1.2), cash: Math.round(gap * 1.2 * (prod.cost + prod.freight || 11.2)) },
    ];
    const pickedPlan = plans[state.m6NormalPlanIdx] || plans[1];

    return {
      headerActions: [
        { label: "切换：M6-2 智能补货 →", primary: false, onClick: () => goPage("m6b") },
        { label: "前往 M6-3 审批队列 →", primary: true, onClick: () => goPage("m6c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>常规补货说明：</strong>无预测数据时按近 30 天日均销量（30 件/天）作基线；任何季节或活动调高/调低必须填写业务依据，缺成本卡商品禁止提交。</span>
        </div>

        <div class="grid-4">
          <div class="kpi-card"><div class="kpi-label">日均销量基线 (近30天)</div><div class="kpi-val">${adjDaily} 件/天</div><div class="kpi-sub">基准 30 × 调节 ${state.m6NormalSeasonPct + state.m6NormalPromoPct}%</div></div>
          <div class="kpi-card"><div class="kpi-label">M0-3 当前可售 / 在途</div><div class="kpi-val">${invRow.avail} / ${state.m6NormalInTransit} 件</div><div class="kpi-sub">${invRow.shopName} · ${invRow.whName}</div></div>
          <div class="kpi-card"><div class="kpi-label">目标库存水位</div><div class="kpi-val" style="color:var(--blue-hover)">${targetInv} 件</div><div class="kpi-sub">日均 ${adjDaily} × (交期${state.m6NormalLeadDays}天+安全${state.m6NormalSafetyDays}天)</div></div>
          <div class="kpi-card highlight-blue"><div class="kpi-label">理论补货缺口</div><div class="kpi-val" style="color:var(--blue-hover)">${gap} 件</div><div class="kpi-sub">目标 ${targetInv} − 可售 ${invRow.avail} − 在途 ${state.m6NormalInTransit}</div></div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">补货商品与人工调节参数</div></div>
            <div class="field"><label>选择补货商品</label>
              <select id="m6nSku" class="select">
                <option value="FAN-203" ${state.m6NormalSku==="FAN-203"?"selected":""}>FAN-203 · 便携静音循环扇 (成本完整)</option>
                <option value="COS-052" ${state.m6NormalSku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜 (缺成本禁止提交)</option>
              </select>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>淡旺季调节 (%)</label><input id="m6nSeason" type="number" class="input" value="${state.m6NormalSeasonPct}"/></div>
              <div class="field"><label>旺季调整依据 (非0必填)</label><input id="m6nSeasonRef" class="input" value="${state.m6NormalSeasonRef}" placeholder="如：去年同期销量表"/></div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>大促活动调节 (%)</label><input id="m6nPromo" type="number" class="input" value="${state.m6NormalPromoPct}"/></div>
              <div class="field"><label>活动预算依据 (非0必填)</label><input id="m6nPromoRef" class="input" value="${state.m6NormalPromoRef}" placeholder="如：双12大促备货申请"/></div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>供应商交期 (天)</label><input id="m6nLead" type="number" class="input" value="${state.m6NormalLeadDays}"/></div>
              <div class="field"><label>安全库存天数 (天)</label><input id="m6nSafe" type="number" class="input" value="${state.m6NormalSafetyDays}"/></div>
            </div>
            <div class="field"><label>已在途未入库数量 (件)</label><input id="m6nTrans" type="number" class="input" value="${state.m6NormalInTransit}"/></div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">三档补货方案对比与一键送审</div></div>
            ${missingCost ? `<div class="banner banner-red"><span>❌ 该商品缺少采购与头程成本卡，无法估算占用资金，请先前往 M0-2 发起成本录入申请！</span></div>` : ""}
            <div class="grid-3" style="margin-bottom:14px;">
              ${plans.map((pl, pi) => `
                <div class="option-tile ${state.m6NormalPlanIdx===pi?"active":""} m6n-plan" data-pi="${pi}" style="text-align:left;padding:12px;">
                  <div style="font-weight:700;font-size:13px;">${pl.label}</div>
                  <div style="font-size:20px;font-weight:800;color:var(--blue-hover);margin:4px 0;">${pl.qty} 件</div>
                  <div style="font-size:12px;color:var(--text-soft);">预计资金：$${pl.cash.toLocaleString()}</div>
                </div>
              `).join("")}
            </div>
            <div class="formula-box" style="margin-bottom:12px;">
              <strong>当前选中方案测算快照：</strong><br/>
              • 商品与仓位：${invRow.sku} · ${invRow.shopName} (${invRow.whName})<br/>
              • 测算公式：日均 ${adjDaily} 件 × (交期 ${state.m6NormalLeadDays} 天 + 安全 ${state.m6NormalSafetyDays} 天) − 可售 ${invRow.avail} − 在途 ${state.m6NormalInTransit} = 缺口 ${gap} 件<br/>
              • 选定采购量：<strong>${pickedPlan.qty} 件（预计占用资金 $${pickedPlan.cash.toLocaleString()}）</strong>
            </div>
            <button class="btn btn-primary" id="m6nSubmitBtn" style="width:100%;justify-content:center;" ${(!canPlan || missingCost)?"disabled":""}>提交常规补货草案（提交前二次确认参数快照）→</button>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m6nSku").onchange = (e) => { state.m6NormalSku = e.target.value; rerender(); };
        document.getElementById("m6nSeason").onchange = (e) => { state.m6NormalSeasonPct = Number(e.target.value); rerender(); };
        document.getElementById("m6nSeasonRef").oninput = (e) => { state.m6NormalSeasonRef = e.target.value; };
        document.getElementById("m6nPromo").onchange = (e) => { state.m6NormalPromoPct = Number(e.target.value); rerender(); };
        document.getElementById("m6nPromoRef").oninput = (e) => { state.m6NormalPromoRef = e.target.value; };
        document.getElementById("m6nLead").onchange = (e) => { state.m6NormalLeadDays = Math.max(1, Number(e.target.value)); rerender(); };
        document.getElementById("m6nSafe").onchange = (e) => { state.m6NormalSafetyDays = Math.max(1, Number(e.target.value)); rerender(); };
        document.getElementById("m6nTrans").onchange = (e) => { state.m6NormalInTransit = Math.max(0, Number(e.target.value)); rerender(); };
        document.querySelectorAll(".m6n-plan").forEach(el => el.onclick = () => { state.m6NormalPlanIdx = Number(el.dataset.pi); rerender(); });

        document.getElementById("m6nSubmitBtn").onclick = () => {
          if (state.m6NormalSeasonPct !== 0 && !state.m6NormalSeasonRef.trim()) { toast("淡旺季调节不为 0 时必须填写依据！", "error"); return; }
          if (state.m6NormalPromoPct !== 0 && !state.m6NormalPromoRef.trim()) { toast("活动调节不为 0 时必须填写活动依据！", "error"); return; }
          commitAction({
            title: `核对常规补货参数快照并提交审批 · ${invRow.sku}`,
            summary: "提交后将锁定当前成本卡与参数快照，生成常规补货草案并流转至 M6-3 待主管审批。",
            confirmText: "确认生成补货草案",
            fieldsHtml: `
              <div class="formula-box">
                • <strong>日均需求：</strong>${adjDaily} 件/天（含淡旺季 ${state.m6NormalSeasonPct}% + 活动 ${state.m6NormalPromoPct}%）<br/>
                • <strong>交期与安全：</strong>交期 ${state.m6NormalLeadDays} 天 + 安全 ${state.m6NormalSafetyDays} 天<br/>
                • <strong>库存扣除：</strong>当前可售 ${invRow.avail} 件 + 在途 ${state.m6NormalInTransit} 件<br/>
                • <strong>三档对比：</strong>保守 ${plans[0].qty} / 平衡 ${plans[1].qty} / 积极 ${plans[2].qty}<br/>
                • <strong>本次提交方案：</strong><strong style="color:var(--blue-hover);">${pickedPlan.label} · ${pickedPlan.qty} 件 ($${pickedPlan.cash.toLocaleString()})</strong>
              </div>
            `,
            onConfirm: () => {
              const pid = genDocId("RP-N");
              state.m6Plans.unshift({
                id: pid, mode: "NORMAL", sku: invRow.sku, shop: `${invRow.shopName} · ${invRow.whName}`,
                qty: pickedPlan.qty, cash: `$${pickedPlan.cash.toLocaleString()}`,
                sigValid: true, sigNote: "提交时测算单价与当前成本卡一致 ✓",
                snapshotDesc: `日均${adjDaily}×(${state.m6NormalLeadDays}+${state.m6NormalSafetyDays})-${invRow.avail}-${state.m6NormalInTransit}=${gap} (${pickedPlan.label})`,
                submitter: ROLE_PERSON_NAMES[state.role], approver: "", approveNote: "", poId: "", status: "待主管审批"
              });
              return { toastMsg: `已提交常规补货草案 ${pid}，请由主管在 M6-3 审批` };
            },
            audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 提交了常规补货草案（${invRow.sku}，${pickedPlan.qty} 件，预计 $${pickedPlan.cash.toLocaleString()}）`, ok: true }
          });
        };
      }
    };
  }

  // ==================== M6-2: 智能补货测算（可展开风险与路线报价明细） ====================
  if (pageId === "m6b") {
    const canPlan = state.role === "planner" || state.role === "approver";
    const hasForecast = !!state.m5ForecastRegistry[state.m6SmartSku];
    const invRow = state.inventoryItems.find(i => i.sku === state.m6SmartSku && i.shopMode === "REAL") || state.inventoryItems[0];
    const predDaily = Math.round(state.m5DailyPred.reduce((a, b) => a + b, 0) / state.m5DailyPred.length);
    const covDays = (invRow.avail / (predDaily || 1)).toFixed(1);
    const recQty = Math.max(0, Math.round(predDaily * (state.m6SmartLeadDays + state.m6SmartSafetyDays) * (state.m6SmartAllocPct / 100)) - invRow.avail - state.m6SmartInTransit);
    const routeObj = state.m6Routes.find(r => r.name === state.m6SmartRoute) || state.m6Routes[0];

    return {
      headerActions: [
        { label: "切换：M6-1 常规补货 →", primary: false, onClick: () => goPage("m6a") },
        { label: "前往 M6-3 审批队列 →", primary: true, onClick: () => goPage("m6c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>智能补货规则：</strong>必须直接采用 M5 已完成的未来销量预测；若选择尚未做预测的商品，系统会直接提示先回 M5 完成预测，绝不私自退回拍脑袋估算。</span>
        </div>

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item"><label>选择补货商品</label>
              <select id="m6sSku" class="select">
                <option value="BAG-108" ${state.m6SmartSku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包 (已有 M5 预测)</option>
                <option value="COS-052" ${state.m6SmartSku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜 (无预测 · 将提示拦截)</option>
                <option value="MAT-014" ${state.m6SmartSku==="MAT-014"?"selected":""}>MAT-014 · 加厚防滑瑜伽垫 (无预测 · 将提示拦截)</option>
              </select>
            </div>
            <div class="filter-item"><label>物流承运路线与报价</label>
              <select id="m6sRoute" class="select">
                ${state.m6Routes.map(r => `<option ${state.m6SmartRoute===r.name?"selected":""}>${r.name}</option>`).join("")}
              </select>
            </div>
            <div class="filter-item"><label>该仓分货比例 (%)</label><input id="m6sAlloc" type="number" class="input" value="${state.m6SmartAllocPct}"/></div>
          </div>
        </div>

        ${!hasForecast ? `
          <div class="card" style="border-color:#fca5a5;background:var(--red-bg);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              <div>
                <strong style="color:var(--red-text);font-size:15px;">⛔ 缺少销量预测：请先为 ${state.m6SmartSku} 完成未来销量预测</strong>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">智能补货严禁在没有预测依据的情况下凭经验生成采购单，请先在 M5 销量预测页运行一版预测。</div>
              </div>
              <button class="btn btn-primary" id="m6sGoM5Btn">立即前往 M5 完成预测 →</button>
            </div>
          </div>
        ` : `
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">引用 M5 预测日均销量</div><div class="kpi-val">${predDaily} 件/天</div><div class="kpi-sub">来自 ${state.m5LastRunMeta.model}</div></div>
            <div class="kpi-card ${Number(covDays)<state.m6SmartLeadDays?"highlight-red":""}">
              <div class="kpi-label">当前库存可撑天数</div>
              <div class="kpi-val" style="color:${Number(covDays)<state.m6SmartLeadDays?"var(--red-text)":"var(--green-text)"}">${covDays} 天</div>
              <div class="kpi-sub">可售 ${invRow.avail} ÷ 日均 ${predDaily}（低于交期 ${state.m6SmartLeadDays} 天）</div>
            </div>
            <div class="kpi-card"><div class="kpi-label">分仓分配 & 在途</div><div class="kpi-val">${state.m6SmartAllocPct}% / ${state.m6SmartInTransit}件</div><div class="kpi-sub">${invRow.whName}</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">智能建议采购量</div><div class="kpi-val" style="color:var(--blue-hover)">${recQty} 件</div><div class="kpi-sub">已扣除当前可售与在途库存</div></div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header"><div class="card-title">展开核对「覆盖天数不足」依据</div><span class="pill p-red">断货预警</span></div>
              <details open style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12.5px;">
                <summary style="cursor:pointer;font-weight:700;color:var(--blue-hover);">点击查看引用的 M5 预测数据与缺口计算</summary>
                <div style="margin-top:8px;line-height:1.7;">
                  • <strong>引用预测版本：</strong>${state.m5LastRunMeta.model}（历史区间：${state.m5LastRunMeta.range}）<br/>
                  • <strong>逐日预测销量：</strong>${state.m5DailyPred.join(" / ")} 件（均值 ${predDaily} 件/天）<br/>
                  • <strong>预警原因：</strong>美西仓当前仅剩 <strong>${invRow.avail} 件</strong>，只够卖 <strong>${covDays} 天</strong>，小于海运周期 ${routeObj.days} 天。
                </div>
              </details>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-title">展开核对「物流路线报价」明细</div><span class="pill p-blue">${routeObj.carrier}</span></div>
              <details open style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12.5px;">
                <summary style="cursor:pointer;font-weight:700;color:var(--blue-hover);">点击查看承运商报价与头程运费</summary>
                <div style="margin-top:8px;line-height:1.7;">
                  • <strong>承运商名称：</strong>${routeObj.carrier}<br/>
                  • <strong>单位头程报价：</strong>$${routeObj.unitPrice.toFixed(2)} / 件 ｜ 预计时效：<strong>${routeObj.days} 天</strong><br/>
                  • <strong>路线说明：</strong>${routeObj.note}（本批 ${recQty} 件预估头程运费 $${(recQty * routeObj.unitPrice).toLocaleString()}）
                </div>
              </details>
              <button class="btn btn-primary" id="m6sSubmitBtn" style="width:100%;justify-content:center;margin-top:12px;" ${!canPlan?"disabled":""}>提交智能补货草案（送 M6-3 审批）→</button>
            </div>
          </div>
        `}
      `,
      bind: () => {
        document.getElementById("m6sSku").onchange = (e) => { state.m6SmartSku = e.target.value; rerender(); };
        document.getElementById("m6sRoute").onchange = (e) => {
          state.m6SmartRoute = e.target.value;
          const r = state.m6Routes.find(x => x.name === e.target.value);
          if (r) state.m6SmartLeadDays = r.days;
          rerender();
        };
        document.getElementById("m6sAlloc").onchange = (e) => { state.m6SmartAllocPct = Math.min(100, Math.max(10, Number(e.target.value))); rerender(); };
        const goM5 = document.getElementById("m6sGoM5Btn");
        if (goM5) goM5.onclick = () => { state.m5Sku = state.m6SmartSku; goPage("m5b"); };
        const subBtn = document.getElementById("m6sSubmitBtn");
        if (subBtn) subBtn.onclick = () => {
          commitAction({
            title: `提交智能补货草案 · ${invRow.sku}`,
            summary: `引用预测日均 ${predDaily} 件/天，建议采购 ${recQty} 件（承运商：${routeObj.carrier}），提交后需由「主管 / 审批人」审批。`,
            confirmText: "确认提交智能草案",
            onConfirm: () => {
              const pid = genDocId("RP-S");
              const cash = Math.round(recQty * (6.8 + routeObj.unitPrice));
              state.m6Plans.unshift({
                id: pid, mode: "SMART", sku: invRow.sku, shop: `${invRow.shopName} · ${invRow.whName}`,
                qty: recQty, cash: `$${cash.toLocaleString()}`,
                sigValid: true, sigNote: "提交时预测参数与当前库存快照一致 ✓",
                snapshotDesc: `预测${predDaily}/天×(${state.m6SmartLeadDays}+${state.m6SmartSafetyDays})×${state.m6SmartAllocPct}%-${invRow.avail}-${state.m6SmartInTransit}=${recQty}`,
                submitter: ROLE_PERSON_NAMES[state.role], approver: "", approveNote: "", poId: "", status: "待主管审批"
              });
              return { toastMsg: `智能补货草案 ${pid} 已提交，请主管在 M6-3 审批` };
            },
            audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 提交了智能补货草案（${invRow.sku}，${recQty} 件，承运商 ${routeObj.carrier}）`, ok: true }
          });
        };
      }
    };
  }

  // ==================== M6-3: 补货审批、签名核对与生成采购单 ====================
  if (pageId === "m6c") {
    const isApprover = state.role === "approver";
    const list = state.m6Plans.filter(p => p.mode === state.m6ApprovalTab);

    return {
      headerActions: [
        { label: "← 返回智能补货测算", primary: false, onClick: () => goPage("m6b") },
        { label: "去 M6-4 登记收货凭证 →", primary: true, onClick: () => goPage("m6d") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>审批把关规则：</strong>① 常规与智能补货计划严格分栏审批；② 主管审批前系统自动核对「审批签名一致/不一致」；③ 批准时必须填写意见，批准后自动生成采购单号并流转至 M6-4 收货登记。</span>
        </div>

        <div class="card">
          <div class="utabs" style="margin-bottom:14px;">
            <div class="utab ${state.m6ApprovalTab==="NORMAL"?"active":""} m6c-tab" data-t="NORMAL">常规补货计划列表 <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="NORMAL").length}</span></div>
            <div class="utab ${state.m6ApprovalTab==="SMART"?"active":""} m6c-tab" data-t="SMART">智能补货计划列表 <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="SMART").length}</span></div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>计划编号</th><th>商品与目标仓</th><th>采购数量 / 资金</th><th>审批签名核对</th><th>提交 / 审批人</th><th>状态与采购单流转</th><th>操作</th></tr></thead>
              <tbody>
                ${list.map(p => {
                  const isSelfSub = p.submitter === ROLE_PERSON_NAMES[state.role];
                  const canApprove = isApprover && !isSelfSub && p.sigValid;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${p.id}</strong></td>
                      <td><strong>${p.sku}</strong><div style="font-size:12px;color:var(--text-soft);">${p.shop}</div><div style="font-size:12px;color:var(--text-muted);">${p.snapshotDesc}</div></td>
                      <td class="nowrap"><strong>${p.qty} 件</strong><div style="font-size:12px;color:var(--text-soft);">${p.cash}</div></td>
                      <td><span class="pill ${p.sigValid?"p-green":"p-red"}">${p.sigValid?"签名一致 ✓":"签名不一致 ✕"}</span><div style="font-size:12px;color:var(--text-soft);margin-top:2px;">${p.sigNote}</div></td>
                      <td class="nowrap">提交：${p.submitter}<div style="font-size:12px;color:var(--text-soft);">审批：${p.approver || "待批"}${p.approveNote?` (${p.approveNote})`:""}</div></td>
                      <td class="nowrap">
                        <span class="pill ${p.status==="已批准并下单"?"p-green":p.status==="已驳回"?"p-red":"p-amber"}">${p.status}</span>
                        ${p.poId ? `<div style="font-size:12px;color:var(--blue-hover);font-weight:700;margin-top:3px;">已流转至收货登记：${p.poId}</div>` : ""}
                      </td>
                      <td class="nowrap">
                        ${p.status === "待主管审批" ? `
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-sm btn-success m6c-act" data-id="${p.id}" data-act="APPROVE" ${!canApprove?"disabled":""} title="${!isApprover?"需要主管权限":isSelfSub?"提交人与审批人不可同一人":"签名不一致不可批准"}">批准下单</button>
                            <button class="btn btn-sm btn-danger m6c-act" data-id="${p.id}" data-act="REJECT" ${(!isApprover||isSelfSub)?"disabled":""}>驳回</button>
                          </div>
                        ` : `<span style="font-size:12px;color:var(--text-soft);">处理完成</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m6c-tab").forEach(t => t.onclick = () => { state.m6ApprovalTab = t.dataset.t; rerender(); });
        document.querySelectorAll(".m6c-act").forEach(b => b.onclick = () => {
          const p = state.m6Plans.find(x => x.id === b.dataset.id);
          const isApprove = b.dataset.act === "APPROVE";
          commitAction({
            title: `${isApprove ? "批准补货计划并生成采购单" : "驳回补货计划"} · ${p.id}`,
            danger: !isApprove,
            summary: isApprove ? `签名核对：${p.sigNote}；批准后将自动生成采购单号并流转至 M6-4 待收货列表。` : "驳回后请写明原因退回运营重新调整。",
            confirmText: isApprove ? "确认批准并生成采购单" : "确认驳回",
            fieldsHtml: `<div class="field"><label>主管审批意见（必填）*</label><input id="m6cNote" class="input" placeholder="${isApprove?"如：数量与资金占用合理，准予采购下单":"如：资金占用过高，请按保守方案重算"}"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m6cNote");
              return el.value.trim() ? [] : [{ el, msg: "审批意见为必填项" }];
            },
            onConfirm: (wrap) => {
              p.approver = ROLE_PERSON_NAMES[state.role];
              p.approveNote = wrap.querySelector("#m6cNote").value.trim();
              if (isApprove) {
                const poNo = genDocId("PO");
                p.poId = poNo;
                p.status = "已批准并下单";
                state.m6Orders.unshift({ po: poNo, planId: p.id, sku: p.sku, totalQty: p.qty, status: "待收货", createdAt: nowDateTimeStr(), historical: false });
                return { toastMsg: `已批准并生成采购单 ${poNo}，已流转至 M6-4 收货登记` };
              } else {
                p.status = "已驳回";
                return { toastMsg: `补货计划 ${p.id} 已驳回`, toastLevel: "warn" };
              }
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} ${isApprove?"批准":"驳回"}了补货计划 ${p.id}（${p.sku} ${p.qty}件），意见：${wrap.querySelector("#m6cNote").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M6-4: 到货质检与收货凭证登记（收货不改库存） ====================
  if (pageId === "m6d") {
    const canWh = state.role === "warehouse" || state.role === "approver";
    return {
      headerActions: [
        { label: "← 返回补货审批", primary: false, onClick: () => goPage("m6c") },
        { label: "去 M0-3 人工盘点校准库存 →", primary: true, onClick: () => goPage("m0c") }
      ],
      html: `
        <div class="banner banner-red">
          <span><strong>重要业务红线：</strong>在此登记到货实收数量与质检凭证<strong>绝对不会自动增加 M0-3 可售库存</strong>！卸货验货合格后，请前往 <strong>M0-3 分店库存页</strong>录入正式盘点单才算正式入仓可售。</span>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">待收货采购单列表（点击登记本批次到货）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>采购单号</th><th>来源计划单</th><th>采购商品</th><th>采购总件数</th><th>已累计实收</th><th>收货状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.m6Orders.map(ord => {
                  const gotSum = state.m6Receipts.filter(r => r.po === ord.po).reduce((s, r) => s + r.gotQty, 0);
                  return `
                    <tr>
                      <td class="nowrap"><strong>${ord.po}</strong></td>
                      <td class="nowrap">${ord.planId}</td>
                      <td class="nowrap"><strong>${ord.sku}</strong></td>
                      <td class="nowrap">${ord.totalQty} 件</td>
                      <td class="nowrap"><strong>${gotSum} 件</strong></td>
                      <td class="nowrap"><span class="pill ${ord.status==="全部收齐"?"p-green":"p-amber"}">${ord.status}</span></td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-primary m6d-rec-btn" data-po="${ord.po}" ${!canWh?"disabled":""} title="${!canWh?"需要「采购 / 仓库 / 物流人员」或主管权限":""}">📦 登记收货凭证</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">分批收货与质检差异凭证台账</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>采购单号</th><th>批次</th><th>实收数量</th><th>差异数量与原因</th><th>质检单号 / 凭证附件</th><th>登记人 / 时间</th></tr></thead>
              <tbody>
                ${state.m6Receipts.map(r => `
                  <tr>
                    <td class="nowrap"><strong>${r.po}</strong></td>
                    <td class="nowrap">${r.batch}</td>
                    <td class="nowrap"><strong>${r.gotQty} 件</strong></td>
                    <td><span class="pill ${r.diff<0?"p-red":"p-green"}">${r.diff===0?"全数完好":`短装 ${r.diff} 件`}</span><div style="font-size:12px;color:var(--text-soft);">${r.diffReason}</div></td>
                    <td>${r.qc}<div style="font-size:12px;color:var(--text-soft);">附件：${r.voucher}</div></td>
                    <td class="nowrap">${r.who}<div style="font-size:12px;color:var(--text-soft);">${r.time}</div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m6d-rec-btn").forEach(b => b.onclick = () => {
          const ord = state.m6Orders.find(o => o.po === b.dataset.po);
          const prevGot = state.m6Receipts.filter(r => r.po === ord.po).reduce((s, r) => s + r.gotQty, 0);
          const rem = Math.max(1, ord.totalQty - prevGot);
          const batchNo = state.m6Receipts.filter(r => r.po === ord.po).length + 1;

          commitAction({
            title: `登记第 ${batchNo} 批到货收货凭证 · ${ord.po}`,
            summary: `采购总量 ${ord.totalQty} 件，已收 ${prevGot} 件。提醒：保存后仅写入收货台账，不会自动增加 M0-3 可售库存！`,
            confirmText: "保存收货与质检凭证",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>本次实收件数 *</label><input id="recQty" type="number" class="input" value="${rem}"/></div>
                <div class="field"><label>差异件数（少货填负数，无差异填 0）</label><input id="recDiff" type="number" class="input" value="0"/></div>
              </div>
              <div class="field"><label>差异原因或验货说明（必填）*</label><input id="recDiffRsn" class="input" value="外箱完整，清点数量与送货单一致"/></div>
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>质检报告编号 *</label><input id="recQc" class="input" value="${genDocId("QC")}"/></div>
                <div class="field"><label>签收凭证文件名 *</label><input id="recVch" class="input" value="第${batchNo}批签收照片_${ord.po}.jpg"/></div>
              </div>
            `,
            validate: (wrap) => {
              const errs = [];
              const qEl = wrap.querySelector("#recQty");
              const rEl = wrap.querySelector("#recDiffRsn");
              const qcEl = wrap.querySelector("#recQc");
              const vEl = wrap.querySelector("#recVch");
              if (!(Number(qEl.value) > 0)) errs.push({ el: qEl, msg: "本次实收数量必须大于 0" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写验货或差异原因说明" });
              if (!qcEl.value.trim()) errs.push({ el: qcEl, msg: "请填写质检报告编号" });
              if (!vEl.value.trim()) errs.push({ el: vEl, msg: "请填写收货凭证附件名称" });
              return errs;
            },
            onConfirm: (wrap) => {
              const got = Number(wrap.querySelector("#recQty").value);
              const diff = Number(wrap.querySelector("#recDiff").value) || 0;
              const diffReason = wrap.querySelector("#recDiffRsn").value.trim();
              const qc = wrap.querySelector("#recQc").value.trim();
              const voucher = wrap.querySelector("#recVch").value.trim();
              state.m6Receipts.unshift({
                po: ord.po, sku: ord.sku, batch: `第 ${batchNo} 批`, planQty: ord.totalQty,
                gotQty: got, diff, diffReason, qc, voucher, who: ROLE_PERSON_NAMES[state.role], time: nowDateTimeStr()
              });
              const newSum = prevGot + got;
              ord.status = newSum >= ord.totalQty ? "全部收齐" : "部分收货";
              return { toastMsg: `已登记 ${ord.po} 第 ${batchNo} 批收货凭证（${got} 件）；请前往 M0-3 盘点校准上架库存` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 登记了采购单 ${ord.po} 第 ${batchNo} 批收货凭证（实收 ${wrap.querySelector("#recQty").value} 件），未自动改库存`,
              ok: true
            })
          });
        });
      }
    };
  }

  return null;
}
