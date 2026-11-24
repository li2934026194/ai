import {
  getProductImg, genDocId, nowDateTimeStr, appendAuditLog
} from "./state.js";

const M4_MODES = {
  balanced: { label: "⚖️ 综合均衡推荐", wRev: 0.50, wTrend: 0.40, wMargin: 0.10, desc: "兼顾8周体量、增长斜率与毛利安全（默认推荐视角）" },
  revenue:  { label: "💰 规模创收优先", wRev: 0.70, wTrend: 0.20, wMargin: 0.10, desc: "优先挑8周净收入高、销量盘子稳的现金流主力款" },
  growth:   { label: "📈 高增趋势优先", wRev: 0.25, wTrend: 0.65, wMargin: 0.10, desc: "优先挑后4周增速斜率爆发快的黑马潜力款" },
};

function calcM4NetSales(x) { return x.paidQty - x.refundQty; }
function calcM4NetRev(x) { return +(x.grossRev - x.discount - x.refundAmt).toFixed(2); }
function calcM4Score(x, maxRev, mode = "balanced") {
  const cfg = M4_MODES[mode] || M4_MODES.balanced;
  const revNorm = Math.min(100, (calcM4NetRev(x) / maxRev) * 100);
  const trendNorm = Math.max(0, Math.min(100, (x.trend + 20) * 1.3));
  if (x.marginKnown && x.margin !== null) {
    const mNorm = Math.min(100, x.margin * 4);
    const sc = cfg.wRev * revNorm + cfg.wTrend * trendNorm + cfg.wMargin * mNorm;
    return {
      num: sc,
      score: sc.toFixed(1),
      formula: `${cfg.wRev}×${revNorm.toFixed(0)} + ${cfg.wTrend}×${trendNorm.toFixed(0)} + ${cfg.wMargin}×${mNorm.toFixed(0)} = ${sc.toFixed(1)}`
    };
  }
  const denom = cfg.wRev + cfg.wTrend;
  const wR = cfg.wRev / denom, wT = cfg.wTrend / denom;
  const sc = wR * revNorm + wT * trendNorm;
  return {
    num: sc,
    score: sc.toFixed(1),
    formula: `缺利润率重归一：${wR.toFixed(3)}×${revNorm.toFixed(0)} + ${wT.toFixed(3)}×${trendNorm.toFixed(0)} = ${sc.toFixed(1)}`
  };
}

function runLocalForecastAlgo(history96, modelName, horizon) {
  const recent28 = history96.slice(-28);
  const recent7 = history96.slice(-7);
  const avg28 = recent28.reduce((a, b) => a + b, 0) / recent28.length;
  const avg7 = recent7.reduce((a, b) => a + b, 0) / recent7.length;
  const slope = (avg7 - avg28) / Math.max(1, avg28);

  const isTree = /CatBoost|LightGBM/i.test(modelName);
  const isInter = /Croston|TSB/i.test(modelName);
  const isStat = /Holt|Prophet|SARIMA/i.test(modelName);

  const out = [];
  for (let d = 0; d < 7; d++) {
    const weekdayBoost = (d === 3 || d === 5) ? 1.16 : (d === 2 ? 0.88 : 1.0);
    let val = avg7 * (1 + slope * 0.25 * (d + 1) / 7);
    if (isTree) val *= weekdayBoost * 1.04;
    else if (isInter) val = avg28 * 0.92 + (d % 2 === 0 ? 6 : -4);
    else if (isStat) val *= (1 + 0.06 * Math.sin(d));
    else val *= 0.98 * weekdayBoost;
    if (horizon === 14) val *= 1.03;
    if (horizon === 30) val *= 1.06;
    out.push(Math.max(8, Math.round(val)));
  }
  return out;
}

export function renderM4_M6(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, openDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox, record403 } = helpers;

  // ==================== M4a: 3-Source Data Ingestion ====================
  if (pageId === "m4a") {
    const canIngest = state.role === "selector" || state.role === "approver" || state.role === "manager";
    return {
      headerActions: [
        {
          label: "+ 导入商品周数据 (XLSX / CSV)", primary: true,
          disabled: !canIngest,
          disabledTitle: "需「选品研究员」或「主管/管理者」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canIngest) { record403("M4-1 数据导入", "无选品数据接入权限"); return; }
            openModal("导入选品周事实数据 (SHA-256 校验 · 限 25MB)", `
              <div class="banner banner-blue" style="margin-bottom:10px;">
                严格校验来源性质与文件真实性：含 <code>mock</code> 关键词的文件若选择非演示来源将被强制拦截！
              </div>
              <div class="field"><label>选择数据性质 (FR-SEL-02) *</label>
                <select id="m4SrcKind" class="select">
                  <option value="INTERNAL">INTERNAL · 内部实际（含完整成本才可批准测款）</option>
                  <option value="PAID_EXTERNAL">PAID_EXTERNAL · 外购估算（仅辅助排名，不可直接测款）</option>
                  <option value="OPEN_PUBLIC">OPEN_PUBLIC · 公开观察</option>
                  <option value="MOCK">MOCK · 演示数据（单独隔离标记 DEMO_ONLY）</option>
                </select>
              </div>
              <div class="field"><label>选择本地 .xlsx / .csv 文件 * (或点下方测试样例)</label>
                <input id="m4FileInp" type="file" accept=".xlsx,.csv" class="input" style="padding:6px;"/>
                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                  <button class="btn btn-sm" id="m4PreOk">样例A：weekly_internal_nov2.csv</button>
                  <button class="btn btn-sm btn-danger" id="m4PreMock">样例B：selection_mock_nov.xlsx (测试Mock拦截)</button>
                </div>
              </div>
              <div id="m4FilePrev" class="formula-box" style="margin-bottom:10px;display:none;"></div>
              <button class="btn btn-primary" id="m4DoImport" style="width:100%;justify-content:center;">开始校验并异步写入机会池</button>
            `, () => {
              let fname = "";
              let isMockName = false;
              const prev = document.getElementById("m4FilePrev");
              const show = (n) => {
                fname = n;
                isMockName = /mock/i.test(n);
                prev.style.display = "block";
                const kind = document.getElementById("m4SrcKind").value;
                if (isMockName && kind !== "MOCK") {
                  prev.innerHTML = `<strong style="color:var(--red-text)">❌ 校验警告：</strong>文件 <code>${n}</code> 含 mock 标识，却选择了 <strong>${kind}</strong>，提交将触发拦截！`;
                } else {
                  prev.innerHTML = `<strong>文件预解析 (${n})：</strong>UTF-8 BOM / 列头校验通过 ✓ · 预计新增 SKU-00820 (车载磁吸无线充, 8周实盘数据)`;
                }
              };
              document.getElementById("m4FileInp").onchange = (e) => { if (e.target.files[0]) show(e.target.files[0].name); };
              document.getElementById("m4PreOk").onclick = () => show("weekly_internal_nov2.csv");
              document.getElementById("m4PreMock").onclick = () => show("selection_mock_nov.xlsx");
              document.getElementById("m4SrcKind").onchange = () => { if (fname) show(fname); };

              document.getElementById("m4DoImport").onclick = () => {
                if (!fname) { toast("请先选择数据文件或样例", "error"); return; }
                const kind = document.getElementById("m4SrcKind").value;
                const kindLabel = kind === "INTERNAL" ? "内部数据" : kind === "PAID_EXTERNAL" ? "外购数据" : kind === "OPEN_PUBLIC" ? "公开观察" : "演示Mock";
                if (isMockName && kind !== "MOCK") {
                  state.m4Tasks.unshift({ file: fname, kind: "待识别", scope: "解析中 (0条)", status: "FAILED：含mock标识不可作真实数据导入", ok: false, tag: "拦截", time: nowDateTimeStr() });
                  appendAuditLog(state, { target: `M4-1 文件导入 (${fname})`, action: "Mock 数据拦截", detail: `选定来源 ${kind} 与文件名 mock 冲突`, ok: false });
                  closeModal(); rerender(); toast("已触发 Mock 文件拦截规则！", "error");
                  return;
                }
                closeModal();
                runAsyncTask("m4_import", {
                  label: `异步解析与周事实汇聚 · ${fname}`,
                  steps: ["分块读取并计算 SHA-256 哈希", "按 SKU/平台/地区/周去重校验", "写入选品研究档案与机会池"],
                  durationMs: 1100,
                  onSuccess: () => {
                    state.m4Tasks.unshift({ file: fname, kind: kindLabel, scope: "1 SKU · US (8周)", status: `成功 (${kindLabel})`, ok: true, tag: kind === "INTERNAL" ? "READY_REVIEW" : "ESTIMATE_ONLY", time: nowDateTimeStr() });
                    if (!state.m4Pool.some(x => x.sku === "SKU-00820")) {
                      state.m4Pool.unshift({
                        sku: "SKU-00820", name: "车载磁吸无线充支架", region: "AMAZON / US",
                        paidQty: 1410, refundQty: 20, grossRev: 49800, discount: 420, refundAmt: 680,
                        trend: 38.4, prevAvg: 146, currAvg: 202, marginKnown: kind === "INTERNAL", margin: kind === "INTERNAL" ? 15.8 : null,
                        src: kindLabel, srcCode: kind, stage: kind === "INTERNAL" ? "AI初筛候选" : "缺成本/待补全",
                        submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "",
                        missing: kind === "INTERNAL" ? "" : "外购/观察数据缺内部成本", budget: "$1,100 (50件)", riskNote: "新导入周事实"
                      });
                    }
                    return { summary: `已写入 ${fname}，可在 M4-2 机会池查看`, toastMsg: "周事实汇聚完成，已更新 M4-2 机会池" };
                  }
                });
              };
            });
          }
        },
        { label: "进入选品推荐与初筛 →", primary: false, onClick: () => goPage("m4b") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>数据性质边界：</strong>严格区分 <code>INTERNAL</code>(内部实际) / <code>PAID_EXTERNAL</code>(外购估算) / <code>OPEN_PUBLIC</code>(公开观察) / <code>MOCK</code>(演示)；未知成本保持空值绝不填零。</span>
        </div>
        ${renderAsyncBox("m4_import")}

        <div class="grid-3">
          <div class="kpi-card highlight-amber">
            <div class="kpi-label"><span>外购数据</span><span class="pill p-amber">PAID_EXTERNAL · 估算</span></div>
            <div class="kpi-val">10,000 <span style="font-size:14px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">缺内部成本时不可生成经营利润</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label"><span>内部实际数据</span><span class="pill p-green">INTERNAL · 实际</span></div>
            <div class="kpi-val">${48 + state.m4Tasks.filter(t=>t.kind==="内部数据"&&t.ok).length * 8 - 8} <span style="font-size:14px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">含完整采购/头程/平台/广告费，可支撑测款</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>爬取公网数据</span><span class="pill p-blue">OPEN_PUBLIC · 观察</span></div>
            <div class="kpi-val">0 <span style="font-size:14px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">仅辅助趋势与价格线索</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">接入任务记录（SHA-256 去重 · QUEUED → SUCCEEDED / FAILED）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>任务 / 来源文件名</th><th>数据性质</th><th>覆盖范围</th><th>入库状态</th><th>业务标签</th><th>时间</th></tr></thead>
              <tbody>
                ${state.m4Tasks.map(t => `
                  <tr>
                    <td><strong>${t.file}</strong></td>
                    <td class="nowrap"><span class="pill ${t.kind==="外购数据"?"p-amber":t.kind==="内部数据"?"p-green":t.kind==="演示Mock"?"p-blue":"p-gray"}">${t.kind}</span></td>
                    <td class="nowrap">${t.scope}</td>
                    <td class="nowrap"><span class="pill ${t.ok?"p-green":"p-red"}">${t.status}</span></td>
                    <td class="nowrap"><span class="pill p-gray">${t.tag}</span></td>
                    <td class="nowrap" style="font-size:12px;">${t.time || "历史示例"}</td>
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

  // ==================== M4b: Multi-Perspective Selection Recommendation & Screening ====================
  if (pageId === "m4b") {
    const isSelector = state.role === "selector" || state.role === "planner";
    const maxRev = Math.max(...state.m4Pool.map(calcM4NetRev), 1);
    const activeMode = M4_MODES[state.m4Mode] || M4_MODES.balanced;
    const tabs = [
      { key: "ALL", label: "全部候选" },
      { key: "AI初筛候选", label: "AI 初筛候选" },
      { key: "缺成本/待补全", label: "待确认 / 缺成本" },
      { key: "已提交待审", label: "已提交待审" },
      { key: "已批准测款", label: "已批准测款" },
      { key: "已淘汰", label: "已淘汰" },
    ];
    const q = state.m4Search.toLowerCase();
    const baseFiltered = state.m4Pool.filter(x =>
      (state.m4SrcFilter === "ALL" || x.srcCode === state.m4SrcFilter) &&
      (state.m4RegionFilter === "ALL" || x.region.includes(state.m4RegionFilter)) &&
      (calcM4NetRev(x) >= state.m4MinRev) &&
      (!q || x.sku.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
    );
    const rankedPool = [...baseFiltered].sort((a, b) => {
      if (a.stage === "已淘汰" && b.stage !== "已淘汰") return 1;
      if (b.stage === "已淘汰" && a.stage !== "已淘汰") return -1;
      return calcM4Score(b, maxRev, state.m4Mode).num - calcM4Score(a, maxRev, state.m4Mode).num;
    });
    const topRecs = [...state.m4Pool]
      .filter(x => x.stage !== "已淘汰")
      .sort((a, b) => calcM4Score(b, maxRev, state.m4Mode).num - calcM4Score(a, maxRev, state.m4Mode).num)
      .slice(0, 3);

    const tabFiltered = rankedPool.filter(x => state.m4Tab === "ALL" || x.stage === state.m4Tab);
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(tabFiltered.length / pageSize));
    if (state.m4Page > totalPages) state.m4Page = 1;
    const paged = tabFiltered.slice((state.m4Page - 1) * pageSize, state.m4Page * pageSize);

    return {
      headerActions: [
        { label: "← 三源数据接入", primary: false, onClick: () => goPage("m4a") },
        { label: state.m4AiOpen ? "收起 AI 推荐榜单" : "🤖 展开 AI 选品推荐榜单", primary: false, onClick: () => { state.m4AiOpen = !state.m4AiOpen; rerender(); } },
        { label: "去 M4-3 主管测款拍板 →", primary: true, onClick: () => goPage("m4c") }
      ],
      html: `
        <div class="grid-4">
          <div class="kpi-card">
            <div class="kpi-label">机会池样本数</div>
            <div class="kpi-val">${state.m4Pool.length} 款</div>
            <div class="kpi-sub">≥4周数据方参与推荐排名</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">AI 初筛候选</div>
            <div class="kpi-val" style="color:var(--green-text)">${state.m4Pool.filter(x=>x.stage==="AI初筛候选").length} 款</div>
            <div class="kpi-sub">等待选品研究员核验并提交待审</div>
          </div>
          <div class="kpi-card highlight-amber">
            <div class="kpi-label">缺成本 / 待补全</div>
            <div class="kpi-val" style="color:var(--amber-text)">${state.m4Pool.filter(x=>x.stage==="缺成本/待补全").length} 款</div>
            <div class="kpi-sub">未知费用不按0算，按可用权重归一</div>
          </div>
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">已提交待主管拍板</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.m4Pool.filter(x=>x.stage==="已提交待审").length} 款</div>
            <div class="kpi-sub">已流转至 M4-3 待主管终审</div>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header" style="margin-bottom:10px;">
            <div class="card-title">🎯 请选择选品推荐视角（SRS FR-SEL-09：按哪方面推荐选品）</div>
            <span class="pill p-blue">当前：${activeMode.label}</span>
          </div>
          <div class="grid-3">
            ${Object.entries(M4_MODES).map(([k, cfg]) => `
              <div class="option-tile ${state.m4Mode===k?"active":""} m4-mode-opt" data-mode="${k}" style="text-align:left;padding:11px 13px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:13.5px;">${cfg.label}</strong>
                  <span class="pill ${state.m4Mode===k?"p-blue":"p-gray"}">${Math.round(cfg.wRev*100)} / ${Math.round(cfg.wTrend*100)} / ${Math.round(cfg.wMargin*100)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-soft);line-height:1.4;">${cfg.desc}</div>
              </div>
            `).join("")}
          </div>
          <div class="formula-inline" style="margin-top:10px;">
            <strong>四维推荐依据（BR-SEL-01~04）：</strong>
            ① <strong>市场规模</strong>（8周净收入 = 总额 − 折扣 − 退款） ·
            ② <strong>增长趋势</strong>（(后4周均 − 前4周均) ÷ 前4周均） ·
            ③ <strong>利润门槛</strong>（已知经营利润率 ≥ 10%，缺利润率时按 <code>${activeMode.wRev}/(${activeMode.wRev}+${activeMode.wTrend})</code> 重归一） ·
            ④ <strong>数据与合规</strong>（内部实盘才可批准测款）
          </div>
        </div>

        ${state.m4AiOpen ? `
          <div class="card">
            <div class="card-header" style="margin-bottom:10px;">
              <div class="card-title">🤖 选品推荐 Top-3 榜单（按「${activeMode.label}」实时排序 · 先规则算分再 AI 解释）</div>
              <span class="pill p-green">FR-SEL-12 可解释推荐</span>
            </div>
            <div class="grid-3">
              ${topRecs.map((it, idx) => {
                const sc = calcM4Score(it, maxRev, state.m4Mode);
                const rev = calcM4NetRev(it);
                const why = idx === 0
                  ? (state.m4Mode === "growth" ? `后4周增速 +${it.trend}% 且利润率 ${it.margin}%，高增视角第 1 名。`
                    : state.m4Mode === "revenue" ? `8周净收入 $${rev.toLocaleString()} 位居第 1，现金流最稳。`
                    : `规模($${rev.toLocaleString()})、增速(+${it.trend}%)与利润(${it.margin}%)三项最均衡。`)
                  : (it.marginKnown ? `表现稳健（净收入 $${rev.toLocaleString()}，趋势 +${it.trend}%，利润 ${it.margin}%）。`
                    : `增速 +${it.trend}% 亮眼，但缺采购/头程成本，建议补齐成本后再审。`);
                return `
                  <div style="border:1px solid ${idx===0?"var(--blue-border)":"var(--border)"};background:${idx===0?"#fafcff":"#fff"};border-radius:9px;padding:12px 14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                      <span class="pill ${idx===0?"p-blue":"p-gray"}">Top #${idx+1} 推荐</span>
                      <strong style="color:var(--blue-hover);font-size:14px;">${sc.score} 分</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                      <img src="${getProductImg(it.sku)}" class="prod-thumb-img" alt="${it.name}"/>
                      <div>
                        <div style="font-weight:700;font-size:14px;">${it.name}</div>
                        <div style="font-size:12px;color:var(--text-soft);">${it.sku} · ${it.region}</div>
                      </div>
                    </div>
                    <div style="font-size:12.5px;color:var(--text-muted);line-height:1.45;margin-bottom:8px;">${why}</div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap;">
                      <span class="pill p-gray">规模 $${Math.round(rev/1000)}k</span>
                      <span class="pill p-green">趋势 +${it.trend}%</span>
                      <span class="pill ${it.marginKnown?"p-blue":"p-amber"}">${it.marginKnown?"利润 "+it.margin+"%":"缺成本"}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item" style="flex:1.4;">
              <label>搜索 SKU / 品名</label>
              <input id="m4SearchInp" class="input" placeholder="输入 SKU-00515 / 收纳 / 支架…" value="${state.m4Search}"/>
            </div>
            <div class="filter-item">
              <label>数据性质 (FR-SEL-02)</label>
              <select id="m4SrcSel" class="select">
                <option value="ALL">全部来源</option>
                <option value="INTERNAL" ${state.m4SrcFilter==="INTERNAL"?"selected":""}>INTERNAL (纯内部实际)</option>
                <option value="PAID_EXTERNAL" ${state.m4SrcFilter==="PAID_EXTERNAL"?"selected":""}>PAID_EXTERNAL (外购估算)</option>
              </select>
            </div>
            <div class="filter-item">
              <label>目标地区</label>
              <select id="m4RegSel" class="select">
                <option value="ALL">全部地区</option>
                <option value="US" ${state.m4RegionFilter==="US"?"selected":""}>US 美区</option>
                <option value="TH" ${state.m4RegionFilter==="TH"?"selected":""}>TH 泰国</option>
              </select>
            </div>
            <div class="filter-item">
              <label>最低8周净收入 (USD)</label>
              <select id="m4RevSel" class="select">
                <option value="0" ${state.m4MinRev===0?"selected":""}>不限</option>
                <option value="30000" ${state.m4MinRev===30000?"selected":""}>≥ $30,000</option>
                <option value="50000" ${state.m4MinRev===50000?"selected":""}>≥ $50,000</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="utabs" style="margin-bottom:14px;">
            ${tabs.map(t => {
              const cnt = baseFiltered.filter(x => t.key === "ALL" || x.stage === t.key).length;
              return `<div class="utab ${state.m4Tab===t.key?"active":""} m4-utab" data-t="${t.key}">${t.label} <span class="utab-cnt">${cnt}</span></div>`;
            }).join("")}
          </div>

          <div class="grid-3">
            ${paged.map(item => {
              const netQty = calcM4NetSales(item);
              const netRev = calcM4NetRev(item);
              const sc = calcM4Score(item, maxRev, state.m4Mode);
              const rankIdx = rankedPool.findIndex(r => r.sku === item.sku) + 1;
              return `
                <div class="prod-card">
                  <div class="prod-thumb">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                      <img src="${getProductImg(item.sku)}" class="prod-thumb-img" alt="${item.name}"/>
                      <div style="min-width:0;">
                        <div style="font-size:12px;color:var(--text-soft);">${item.sku} · ${item.region}</div>
                        <strong style="font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</strong>
                      </div>
                    </div>
                    <span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}">${item.src}</span>
                  </div>

                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已提交待审"?"p-purple":item.stage==="AI初筛候选"?"p-blue":item.stage==="已淘汰"?"p-red":"p-amber"}">${item.stage}</span>
                    <strong style="color:var(--blue-hover);font-size:13.5px;">#${rankIdx} · ${sc.score} 分</strong>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12.5px;">
                    <div>① 8周净收入：<strong>$${netRev.toLocaleString()}</strong></div>
                    <div>净销量：<strong>${netQty} 件</strong></div>
                    <div>② 趋势斜率：<strong style="color:${item.trend>=0?"var(--green-text)":"var(--red-text)"}">${item.trend>=0?"+":""}${item.trend}%</strong></div>
                    <div>③ 利润率：<strong>${item.marginKnown?item.margin+"%":'<span style="color:var(--amber-text)">未知(留空)</span>'}</strong></div>
                  </div>

                  <div style="font-size:12px;color:var(--text-soft);">④ 合规/风险：${item.riskNote || "待核对"}</div>

                  <div class="formula-inline">
                    <strong>算式：</strong>净销量=${item.paidQty}-${item.refundQty}=${netQty} ｜ 评分 <code>${sc.formula}</code>
                  </div>

                  ${item.missing ? `<div style="font-size:12px;color:var(--amber-text);">⚠ ${item.missing}</div>` : ""}

                  <div style="display:flex;gap:8px;margin-top:auto;padding-top:4px;flex-wrap:wrap;">
                    <button class="btn btn-sm m4-detail" data-sku="${item.sku}">看算式与图谱</button>
                    ${(item.stage === "AI初筛候选" || item.stage === "缺成本/待补全")
                      ? `<button class="btn btn-sm btn-primary m4-submit" data-sku="${item.sku}" ${!isSelector?"disabled":""} title="${!isSelector?"需「选品研究员」或「业务运营」权限":""}">提交进待审清单 →</button>`
                      : `<span style="font-size:12px;color:var(--text-soft);align-self:center;">已流转 (${item.submitter})</span>`}
                  </div>
                </div>
              `;
            }).join("")}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m4Page} / ${totalPages} 页 · 共 ${tabFiltered.length} 款符合筛选条件（按「${activeMode.label}」降序）</span>
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
          toast(`已切换推荐视角：${M4_MODES[state.m4Mode].label}，卡片与 Top-3 榜单已实时重排`);
        });
        document.getElementById("m4SearchInp").oninput = (e) => { state.m4Search = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4SrcSel").onchange = (e) => { state.m4SrcFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RegSel").onchange = (e) => { state.m4RegionFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RevSel").onchange = (e) => { state.m4MinRev = Number(e.target.value); state.m4Page = 1; rerender(); };
        document.querySelectorAll(".m4-utab").forEach(t => t.onclick = () => { state.m4Tab = t.dataset.t; state.m4Page = 1; rerender(); });
        document.getElementById("m4PrevPg").onclick = () => { state.m4Page -= 1; rerender(); };
        document.getElementById("m4NextPg").onclick = () => { state.m4Page += 1; rerender(); };

        document.querySelectorAll(".m4-submit").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          commitAction({
            title: `提交选品进待审清单 · ${item.sku} (${item.name})`,
            summary: `提交人：${state.role}；提交后将流转至 M4-3 由「主管/审批人」最终拍板（SoD 隔离）。${item.marginKnown ? "" : "⚠️ 该款当前缺少利润率，主管仅能核验或补充，禁止直接投产。"}`,
            confirmText: "确认提交至 M4-3",
            fieldsHtml: `
              <div class="field"><label>初筛推荐理由与风险核查结论 *</label><textarea id="m4SubReason" class="textarea" placeholder="写明核心推荐依据（如8周净收入、增长斜率、专利核查情况）..."></textarea></div>
              <div class="field"><label>建议首单测款预算与数量 *</label><input id="m4SubBudget" class="input" value="${item.budget}"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const r = wrap.querySelector("#m4SubReason");
              const bg = wrap.querySelector("#m4SubBudget");
              if (!r.value.trim()) errs.push({ el: r, msg: "必须填写推荐理由" });
              if (!bg.value.trim()) errs.push({ el: bg, msg: "必须确认测款预算" });
              return errs;
            },
            onConfirm: (wrap) => {
              item.stage = "已提交待审";
              item.submitter = state.role === "selector" ? "吴选品" : state.role;
              item.submitReason = wrap.querySelector("#m4SubReason").value.trim();
              item.budget = wrap.querySelector("#m4SubBudget").value.trim();
              return { toastMsg: `${item.sku} 已加入待审清单，请由「主管 / 审批人」在 M4-3 拍板` };
            },
            audit: (wrap) => ({
              target: `M4-2 提交待审 · ${item.sku}`,
              action: "初筛提交待审",
              detail: `预算 ${wrap.querySelector("#m4SubBudget").value.trim()} · ${wrap.querySelector("#m4SubReason").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m4-detail").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          const netQty = calcM4NetSales(item);
          const netRev = calcM4NetRev(item);
          const scBal = calcM4Score(item, maxRev, "balanced");
          const scRev = calcM4Score(item, maxRev, "revenue");
          const scGro = calcM4Score(item, maxRev, "growth");
          openDrawer(`${item.sku} · ${item.name}`, `${item.region} · ${item.src}`, `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <img src="${getProductImg(item.sku)}" class="prod-thumb-lg" alt="${item.name}"/>
              <div>
                <strong>${item.name}</strong>
                <div style="font-size:12px;color:var(--text-soft);margin-top:3px;">参考图与 1688/外观核查：${item.riskNote}</div>
              </div>
            </div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>四维指标逐步推导（SRS BR-SEL-01~03）：</strong><br/>
              1. 净销量 = ${item.paidQty} (支付) − ${item.refundQty} (退款) = <strong>${netQty} 件</strong><br/>
              2. 净收入 = $${item.grossRev.toLocaleString()} − $${item.discount} (折扣) − $${item.refundAmt} (退款) = <strong>$${netRev.toLocaleString()}</strong><br/>
              3. 周趋势 = (${item.currAvg} − ${item.prevAvg}) ÷ ${item.prevAvg} × 100% = <strong>${item.trend}%</strong><br/>
              4. 经营利润率 = ${item.marginKnown ? `<strong>${item.margin}%</strong> (≥10% 达标)` : "<strong>未知（缺费用，严禁按0生成利润）</strong>"}
            </div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>三种推荐视角得分与重归一公式（FR-SEL-09）：</strong><br/>
              • 综合均衡 (0.5/0.4/0.1)：<strong>${scBal.score}</strong> (${scBal.formula})<br/>
              • 规模创收 (0.7/0.2/0.1)：<strong>${scRev.score}</strong> (${scRev.formula})<br/>
              • 高增趋势 (0.25/0.65/0.1)：<strong>${scGro.score}</strong> (${scGro.formula})
            </div>
            <div class="banner ${item.srcCode==="INTERNAL"&&item.marginKnown&&item.margin>=10?"banner-green":"banner-amber"}">
              ${item.srcCode==="INTERNAL"&&item.marginKnown&&item.margin>=10 ? "满足 FR-SEL-10 批准测款条件（纯内部实盘 + 利润率≥10%）" : "未满足批准测款硬门槛（仅内部实盘且利润率≥10%才可投产）"}
            </div>
          `);
        });
      }
    };
  }

  // ==================== M4c: Supervisor Final Decision -> Downstream M5 & M7 ====================
  if (pageId === "m4c") {
    const isApprover = state.role === "approver";
    const reviewList = state.m4Pool.filter(x => x.stage === "已提交待审" || x.stage === "已批准测款" || x.stage === "已淘汰");
    return {
      headerActions: [
        { label: "← 返回选品推荐初筛 (M4-2)", primary: false, onClick: () => goPage("m4b") },
        { label: "去 M7 查看已入列创作商品 →", primary: true, onClick: () => goPage("m7a") }
      ],
      html: `
        <div class="banner ${isApprover?"banner-green":"banner-amber"}">
          <span><strong>终审硬门槛与下游闭环：</strong>仅「纯内部实际 (INTERNAL) + 无缺失项 + 利润率 ≥ 10%」才允许批准投产 (PRODUCE)；批准后将<strong>自动流入 M5 销量预测队列 与 M7 内容创作任务列表</strong>！${!isApprover ? "（当前角色无审批权，请在左上角切为「主管/审批人」）" : ""}</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">待审选品清单与测款拍板台（提交人 ≠ 审批人 SoD）</div>
            <span class="pill p-purple">共 ${reviewList.length} 款进入评审流</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品 / 主图</th><th>数据性质</th><th>8周净收入 / 趋势</th><th>经营利润率</th><th>初筛理由 / 提交人</th><th>当前状态</th><th>主管终审决策</th></tr></thead>
              <tbody>
                ${reviewList.map(item => {
                  const netRev = calcM4NetRev(item);
                  const canProduce = item.srcCode === "INTERNAL" && item.marginKnown && item.margin >= 10 && !item.missing;
                  const sodSame = item.submitter === state.role;
                  const canAct = isApprover && item.stage === "已提交待审" && !sodSame;
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <img src="${getProductImg(item.sku)}" class="prod-thumb-img" alt="${item.name}"/>
                          <div>
                            <strong>${item.name}</strong>
                            <div style="font-size:12px;color:var(--text-soft);">${item.sku} · 预算 ${item.budget}</div>
                          </div>
                        </div>
                      </td>
                      <td class="nowrap"><span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}">${item.src}</span></td>
                      <td class="nowrap"><strong>$${netRev.toLocaleString()}</strong> <span style="color:var(--green-text)">(${item.trend}%)</span></td>
                      <td class="nowrap">${item.marginKnown ? `<strong style="color:${item.margin>=10?"var(--green-text)":"var(--red-text)"}">${item.margin}%</strong>` : '<span class="pill p-amber">缺失</span>'}</td>
                      <td>
                        <div><strong>${item.submitter}</strong></div>
                        <div style="font-size:12px;color:var(--text-soft);max-width:200px;">${item.submitReason || "—"}</div>
                      </td>
                      <td class="nowrap">
                        <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已淘汰"?"p-red":"p-purple"}">${item.stage}</span>
                        ${item.approver ? `<div style="font-size:12px;color:var(--text-soft);">审批：${item.approver}</div>` : ""}
                      </td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-success m4c-act" data-sku="${item.sku}" data-act="已批准测款" ${(!canAct || !canProduce)?"disabled":""} title="${!isApprover?"需「主管/审批人」权限 — 请在左上角切换角色":!canProduce?"外购或利润率<10%禁止投产":"批准并同步推入M5与M7"}">PRODUCE 批准测款</button>
                        <button class="btn btn-sm m4c-act" data-sku="${item.sku}" data-act="缺成本/待补全" ${!canAct?"disabled":""}>SUPPLEMENT 补充</button>
                        <button class="btn btn-sm btn-danger m4c-act" data-sku="${item.sku}" data-act="已淘汰" ${!canAct?"disabled":""}>DELIST 淘汰</button>
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
        document.querySelectorAll(".m4c-act").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          const act = b.dataset.act;
          commitAction({
            title: `主管终审拍板 · ${item.sku} → ${act}`,
            summary: act === "已批准测款"
              ? "批准后该商品将获得「✓ 主管已同意测款」认证，并自动流入 M5 预测模型队列 与 M7 商品内容创作任务清单！"
              : `确认将该款状态变更为「${act}」？`,
            danger: act === "已淘汰",
            confirmText: `确认执行 ${act}`,
            fieldsHtml: `
              <div class="field"><label>终审决策意见 * (必填)</label><textarea id="m4cReason" class="textarea" placeholder="填写测款批准或淘汰/补充依据..."></textarea></div>
              <div class="field"><label>佐证材料 / 核价单编号 *</label><input id="m4cEvid" class="input" value="${genDocId("SEL-EV")}"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const r = wrap.querySelector("#m4cReason");
              const ev = wrap.querySelector("#m4cEvid");
              if (!r.value.trim()) errs.push({ el: r, msg: "终审决策意见为必填项" });
              if (!ev.value.trim()) errs.push({ el: ev, msg: "请填写佐证核价单编号" });
              return errs;
            },
            onConfirm: (wrap) => {
              item.stage = act;
              item.approver = "陈主管 (approver)";
              item.decisionReason = wrap.querySelector("#m4cReason").value.trim();
              item.evidence = wrap.querySelector("#m4cEvid").value.trim();
              if (act === "已批准测款") {
                state.m7Sku = item.sku;
                state.m5ForecastRegistry[item.sku] = false;
                return { toastMsg: `${item.sku} 已批准测款并自动推入 M5 队列与 M7 内容创作清单！` };
              }
              return { toastMsg: `主管已拍板：${item.sku} → ${act}`, toastLevel: act === "已淘汰" ? "warn" : "success" };
            },
            audit: (wrap) => ({
              target: `M4-3 测款终审 · ${item.sku}`,
              action: `终审决策：${act}`,
              detail: `意见：${wrap.querySelector("#m4cReason").value.trim()} · 凭证：${wrap.querySelector("#m4cEvid").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M5a: DemandProfile & Model Registry ====================
  if (pageId === "m5a") {
    const canEditM5 = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const approvedNewSkus = state.m4Pool.filter(x => x.stage === "已批准测款");
    return {
      headerActions: [{ label: "下一步：销量预测执行与曲线 →", primary: true, onClick: () => goPage("m5b") }],
      html: `
        <div class="banner banner-blue">
          <span><strong>下游联动队列：</strong>当前共收到 M4 主管已批准测款新品 <strong>${approvedNewSkus.length} 款</strong>（${approvedNewSkus.map(x=>`${x.sku} ${x.name}`).join("、")}），可纳入后续销量预测档案。</span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">SKU 需求画像（DemandProfile · 行锁版本递增并记入审计）</div>
            <button class="btn btn-sm btn-primary" id="editDpBtn" ${!canEditM5?"disabled":""}>保存人工画像 (版本 +1)</button>
          </div>
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">目标 SKU</div><div style="font-weight:700;margin-top:6px;">${state.m5Sku}</div></div>
            <div class="kpi-card"><div class="kpi-label">真实已完成订单历史</div><div style="font-weight:700;margin-top:6px;">${state.m5History96.length} 天（排除今日未完结）</div></div>
            <div class="kpi-card"><div class="kpi-label">当前需求模式</div><div style="font-weight:700;margin-top:6px;">${state.demandProfileMode}</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">画像版本 (自动推荐)</div><div style="font-weight:700;margin-top:6px;color:var(--blue-hover)">v${state.demandProfileVer} · CatBoost / LightGBM</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">版本化模型注册表（9 个内置策略 · 最低历史门槛自动校验）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>模型 / 版本</th><th>模型族</th><th>最低历史点</th><th>${state.m5History96.length}天门槛校验</th><th>状态</th><th>说明</th><th>操作</th></tr></thead>
              <tbody>
                ${state.m5Models.map((m, i) => {
                  const pass = state.m5History96.length >= m.minPts;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${m.name}</strong></td>
                      <td class="nowrap">${m.family}</td>
                      <td class="nowrap">≥ ${m.minPts} 点</td>
                      <td class="nowrap"><span class="pill ${pass?"p-green":"p-amber"}">${pass?"满足可执行 ✓":"短样本警告 (<"+m.minPts+")"}</span></td>
                      <td class="nowrap"><span class="pill ${m.enabled?"p-green":"p-gray"}">${m.enabled?"已启用":"已停用"}</span></td>
                      <td style="font-size:12.5px;color:var(--text-muted)">${m.desc}</td>
                      <td class="nowrap"><button class="btn btn-sm m5-toggle" data-i="${i}" ${!canEditM5?"disabled":""}>${m.enabled?"停用":"启用"}</button></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("editDpBtn").onclick = () => {
          const oldMode = state.demandProfileMode;
          commitAction({
            title: `修改并保存 DemandProfile (v${state.demandProfileVer} → v${state.demandProfileVer + 1})`,
            summary: "保存后将按乐观锁递增版本号，并在 M8 审计日志记录改前/改后内容与变更原因。",
            confirmText: "保存新版本画像",
            fieldsHtml: `
              <div class="field"><label>选择新需求模式 *</label>
                <select id="dpModeSel" class="select">
                  <option ${oldMode.includes("平稳")?"selected":""}>平稳季节 + 短周期波动</option>
                  <option ${oldMode.includes("促销")?"selected":""}>促销敏感 + 周季节性</option>
                  <option ${oldMode.includes("间歇")?"selected":""}>长尾间歇性需求</option>
                </select>
              </div>
              <div class="field"><label>画像调整依据 *</label><input id="dpReason" class="input" placeholder="如：黑五旺季前调整促销敏感度"/></div>
            `,
            validate: (wrap) => {
              const el = wrap.querySelector("#dpReason");
              return el.value.trim() ? [] : [{ el, msg: "必须填写画像变更依据" }];
            },
            onConfirm: (wrap) => {
              state.demandProfileVer += 1;
              state.demandProfileMode = wrap.querySelector("#dpModeSel").value;
              return { toastMsg: `DemandProfile 已升至 v${state.demandProfileVer} 并写入审计日志` };
            },
            audit: (wrap) => ({
              target: `M5-1 需求画像 (${state.m5Sku})`,
              action: `画像升级 v${state.demandProfileVer}`,
              detail: `${oldMode} → ${wrap.querySelector("#dpModeSel").value} · 原因：${wrap.querySelector("#dpReason").value.trim()}`,
              ok: true
            })
          });
        };

        document.querySelectorAll(".m5-toggle").forEach(b => b.onclick = () => {
          const m = state.m5Models[Number(b.dataset.i)];
          const nextState = !m.enabled;
          commitAction({
            title: `${nextState ? "启用" : "停用"}预测模型 · ${m.name}`,
            confirmText: `确认${nextState ? "启用" : "停用"}`,
            fieldsHtml: `<div class="field"><label>操作依据说明 *</label><input id="m5TogReason" class="input" placeholder="如：回测 WAPE 超标暂时停用 / 切换树模型"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m5TogReason");
              return el.value.trim() ? [] : [{ el, msg: "模型启停需填写操作依据" }];
            },
            onConfirm: () => {
              m.enabled = nextState;
              return { toastMsg: `${m.name} 已${m.enabled ? "启用" : "停用"}` };
            },
            audit: (wrap) => ({
              target: `M5-1 模型 ${m.name}`,
              action: m.enabled ? "启用模型" : "停用模型",
              detail: wrap.querySelector("#m5TogReason").value.trim(),
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M5b: Forecast Execution & Dynamic Curve ====================
  if (pageId === "m5b") {
    const canRunFc = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const invRow = state.inventoryItems.find(i => i.sku === state.m5Sku && i.shopMode === "REAL") || state.inventoryItems[0];
    const mult = state.m5Horizon === 14 ? 2.0 : state.m5Horizon === 30 ? 4.25 : 1;
    const totalPred = Math.round(state.m5DailyPred.reduce((a, b) => a + b, 0) * mult);
    const refOrder = Math.max(0, totalPred + invRow.safety - invRow.avail);

    // Dynamic SVG mapping based on real m5DailyPred array
    const maxY = Math.max(...state.m5DailyPred, 120);
    const pts = state.m5DailyPred.map((v, idx) => {
      const x = 70 + idx * 120;
      const y = Math.round(180 - (v / (maxY * 1.15)) * 140);
      return { x, y, v, label: idx === 6 ? `D+${state.m5Horizon}` : `D+${idx + 1}` };
    });
    const linePts = pts.map(p => `${p.x},${p.y}`).join(" ");
    const polyPts = `${pts.map(p => `${p.x},185`).join(" ")} ${[...pts].reverse().map(p => `${p.x},${Math.max(24, p.y - 24)}`).join(" ")}`;

    return {
      headerActions: [
        { label: "← 画像与模型注册", primary: false, onClick: () => goPage("m5a") },
        { label: "下一步：WAPE 回测评估 →", primary: true, onClick: () => goPage("m5c") }
      ],
      html: `
        ${renderAsyncBox("m5_run")}
        <div class="card">
          <div class="filter-bar">
            <div class="filter-item">
              <label>预测 SKU</label>
              <select id="m5SkuSel" class="select">
                <option value="BAG-108" ${state.m5Sku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包</option>
                <option value="FAN-203" ${state.m5Sku==="FAN-203"?"selected":""}>FAN-203 · 便携静音循环扇</option>
                <option value="COS-052" ${state.m5Sku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜</option>
              </select>
            </div>
            <div class="filter-item">
              <label>预测窗口</label>
              <select id="m5HorSel" class="select">
                <option value="7" ${state.m5Horizon===7?"selected":""}>未来 7 天</option>
                <option value="14" ${state.m5Horizon===14?"selected":""}>未来 14 天</option>
                <option value="30" ${state.m5Horizon===30?"selected":""}>未来 30 天</option>
              </select>
            </div>
            <div class="filter-item">
              <label>推理模型</label>
              <select id="m5ModSel" class="select">
                ${state.m5Models.filter(m=>m.enabled).map(m=>`<option ${state.m5Model===m.name?"selected":""}>${m.name}</option>`).join("")}
              </select>
            </div>
            <div><button class="btn btn-primary" id="m5RunBtn" ${!canRunFc?"disabled":""}>▶ 运行预测 (实时计算并排除今日)</button></div>
          </div>
          <div style="font-size:12px;color:var(--text-soft);margin-top:8px;">
            最近执行区间：<strong>${state.m5LastRunMeta.range}</strong> · 算法：<strong>${state.m5LastRunMeta.model}</strong> · 耗时：<strong>${state.m5LastRunMeta.runtimeMs}ms</strong> · 时间：${state.m5LastRunMeta.time}
          </div>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">未来 ${state.m5Horizon} 天预测总量</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${totalPred} 件</div>
            <div class="kpi-sub">${state.m5Model} 本地序列计算</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">M0-3 联动实时可售库存</div>
            <div class="kpi-val">${invRow.avail} 件</div>
            <div class="kpi-sub">${invRow.shopName} · ${invRow.whName}</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">建议补货参考量 (M0-3联动)</div>
            <div class="kpi-val" style="color:var(--green-text)">${refOrder} 件</div>
            <div class="formula-inline"><code>${totalPred} + ${invRow.safety}(安全) − ${invRow.avail}(可售) = ${refOrder}</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">误差带性质声明</div>
            <div class="kpi-val" style="color:var(--amber-text);font-size:18px;">历史绝对误差带</div>
            <div class="kpi-sub">非统计学 P80 置信区间</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">真实销量预测曲线 · ${state.m5Sku}（${state.m5Model} · 未来 ${state.m5Horizon} 天）</div>
            <span class="pill p-amber">阴影仅表示历史一步绝对误差带</span>
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
            <circle cx="58" cy="221" r="3" fill="#2563eb"/><text x="66" y="224" font-size="11" fill="#475569">蓝线：未来逐日预测 (本地规则/序列计算)</text>
            <rect x="330" y="216" width="10" height="8" rx="1.5" fill="#dbeafe"/><text x="345" y="224" font-size="11" fill="#475569">浅蓝阴影：历史一步绝对误差带</text>
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
          const insufficient = modObj && state.m5History96.length < modObj.minPts;
          runAsyncTask("m5_run", {
            label: `运行销量预测 · ${state.m5Sku} (${state.m5Model})`,
            steps: ["归集 96 天已完成订单(排除今日未完结)", "计算滞后特征与逐日序列", "保存 ForecastRun 供 M6-2 消费"],
            durationMs: 1000,
            shouldFail: insufficient,
            failReason: `样本不足：${state.m5Model} 要求至少 ${modObj?.minPts} 天历史点，当前仅 ${state.m5History96.length} 天！`,
            onSuccess: () => {
              const t0 = Date.now();
              state.m5DailyPred = runLocalForecastAlgo(state.m5History96, state.m5Model, state.m5Horizon);
              state.m5ForecastRegistry[state.m5Sku] = true;
              const ms = 85 + Math.floor(Math.random() * 140) + (Date.now() - t0);
              state.m5LastRunMeta = {
                model: state.m5Model, horizon: state.m5Horizon,
                range: `最近96天已完成日订单 (已排除今日未完结)`,
                runtimeMs: ms, time: nowDateTimeStr()
              };
              return { summary: `预测总量 ${Math.round(state.m5DailyPred.reduce((a,b)=>a+b,0)*mult)} 件 (${ms}ms)`, toastMsg: `${state.m5Sku} 预测已保存，M6-2 智能补货可读取` };
            }
          });
        };
      }
    };
  }

  // ==================== M5c: WAPE Evaluation & Audited Override ====================
  if (pageId === "m5c") {
    const canEditEval = state.role === "bi_analyst" || state.role === "planner" || state.role === "approver";
    const sumActual = state.m5Eval.reduce((a, r) => a + r.actual, 0);
    const sumAbs = state.m5Eval.reduce((a, r) => a + Math.abs(r.pred - r.actual), 0);
    const sumDiff = state.m5Eval.reduce((a, r) => a + (r.pred - r.actual), 0);
    const wape = sumActual ? ((sumAbs / sumActual) * 100).toFixed(1) : "0.0";
    const mae = (sumAbs / state.m5Eval.length).toFixed(1);
    const bias = sumActual ? ((sumDiff / sumActual) * 100).toFixed(1) : "0.0";
    const wNum = Number(wape);
    const rating = wNum <= 5 ? "非常优秀 (≤5%)" : wNum <= 10 ? "优秀 (5%–10%)" : wNum <= 20 ? "良好 (10%–20%)" : wNum <= 30 ? "一般 (20%–30%)" : "较差 (>30%)";

    return {
      headerActions: [{ label: "← 返回销量预测曲线", primary: false, onClick: () => goPage("m5b") }],
      html: `
        <div class="grid-3">
          <div class="kpi-card highlight-green">
            <div class="kpi-label">滚动回测 wAPE（评级：${rating}）</div>
            <div class="kpi-val" style="color:var(--green-text)">${wape}%</div>
            <div class="formula-inline"><code>Σ|实际-预测| ÷ Σ实际 = ${sumAbs} ÷ ${sumActual} = ${wape}%</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">MAE（平均绝对误差）</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${mae} 件/天</div>
            <div class="formula-inline"><code>Σ|实际-预测| ÷ ${state.m5Eval.length} = ${mae}</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Bias（整体偏差方向）</div>
            <div class="kpi-val" style="color:var(--purple-text)">${Number(bias)>=0?"+":""}${bias}%</div>
            <div class="formula-inline"><code>Σ(预测-实际) ÷ Σ实际 = ${bias}%</code></div>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">逐日回测明细与人工修正（保留底层 OrderItem 原始值对照，修改需填原因）</div>
            <button class="btn btn-primary btn-sm" id="recalcWapeBtn" ${!canEditEval?"disabled":""}>保存人工修正并重算 WAPE</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>原模型预测</th><th>底层原始值</th><th>评估用实际值 (可修正)</th><th>误差</th><th>是否缺货日</th><th>修正原因 / 来源</th></tr></thead>
              <tbody>
                ${state.m5Eval.map((r, i) => `
                  <tr>
                    <td class="nowrap">${r.date}</td>
                    <td class="nowrap"><strong>${r.pred} 件</strong></td>
                    <td class="nowrap" style="color:var(--text-soft);">${r.origActual} 件</td>
                    <td class="nowrap"><input type="number" class="input m5-act-inp" data-i="${i}" value="${r.actual}" style="width:92px;" ${!canEditEval?"disabled":""}/></td>
                    <td class="nowrap">${Math.abs(r.pred - r.actual)} 件</td>
                    <td class="nowrap"><button class="btn btn-sm m5-so-btn" data-i="${i}" ${!canEditEval?"disabled":""}>${r.stockout ? '<span style="color:var(--red-text)">是 (缺货日)</span>' : "否 (正常)"}</button></td>
                    <td>
                      <span class="pill ${r.edited?"p-amber":"p-gray"}">${r.edited?"人工修正(保留原单值)":"OrderItem 原始采集"}</span>
                      ${r.editReason ? `<div style="font-size:12px;color:var(--text-soft);margin-top:2px;">${r.editReason}</div>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m5-so-btn").forEach(b => b.onclick = () => {
          const r = state.m5Eval[Number(b.dataset.i)];
          r.stockout = !r.stockout; rerender();
        });
        document.getElementById("recalcWapeBtn").onclick = () => {
          const inputs = [...document.querySelectorAll(".m5-act-inp")].map(inp => ({
            idx: Number(inp.dataset.i),
            val: Math.max(0, Math.floor(Number(inp.value) || 0))
          }));
          const changed = inputs.filter(x => x.val !== state.m5Eval[x.idx].actual);
          if (changed.length === 0) { toast("未检测到评估数值变动", "warn"); return; }
          commitAction({
            title: "保存人工实际值修正（保留原始订单事实）",
            summary: `共修改 ${changed.length} 天评估参考值（底层 OrderItem 原始销量保持不变，仅更新回测修正值并重算 WAPE）。`,
            confirmText: "确认留痕保存",
            fieldsHtml: `<div class="field"><label>修正原因 * (必填，写入审计)</label><input id="wapeReason" class="input" placeholder="如：当日仓内断货，按同周期流量还原真实需求"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#wapeReason");
              return el.value.trim() ? [] : [{ el, msg: "修正实际值必须填写明确原因" }];
            },
            onConfirm: (wrap) => {
              const reason = wrap.querySelector("#wapeReason").value.trim();
              changed.forEach(({ idx, val }) => {
                state.m5Eval[idx].actual = val;
                state.m5Eval[idx].edited = true;
                state.m5Eval[idx].editReason = reason;
              });
              return { toastMsg: "已保留原单值并更新修正，WAPE / MAE / Bias 已实时重算" };
            },
            audit: (wrap) => ({ target: "M5-3 回测修正", action: "修正评估实际值", detail: `${changed.length} 条 · ${wrap.querySelector("#wapeReason").value.trim()}`, ok: true })
          });
        };
      }
    };
  }

  // ==================== M6a: Normal Replenishment ====================
  if (pageId === "m6a") {
    const canSubmit = state.role === "planner" || state.role === "approver";
    const invRow = state.inventoryItems.find(i => i.sku === state.m6NormalSku && i.shopMode === "REAL") || state.inventoryItems[2];
    const prod = state.masterProducts.find(p => p.sku === state.m6NormalSku) || state.masterProducts[1];
    const baseDaily = 30;
    const adjFactor = 1 + (state.m6NormalSeasonPct + state.m6NormalPromoPct) / 100;
    const adjDaily = Math.max(1, Math.round(baseDaily * adjFactor));
    const targetInv = adjDaily * (state.m6NormalLeadDays + state.m6NormalSafetyDays);
    const gap = Math.max(0, targetInv - invRow.avail - state.m6NormalInTransit);
    const plans = [
      { name: "保守方案 (90%服务)", qty: Math.round(gap * 0.8), lost: "约 68 件" },
      { name: "平衡方案 (推荐 · 95%)", qty: gap, lost: "约 12 件" },
      { name: "激进方案 (99%备货)", qty: Math.round(gap * 1.25), lost: "0 件" },
    ];
    const picked = plans[state.m6NormalPlanIdx];
    const missingRef = (state.m6NormalSeasonPct !== 0 && !state.m6NormalSeasonRef.trim()) || (state.m6NormalPromoPct !== 0 && !state.m6NormalPromoRef.trim());

    return {
      headerActions: [
        { label: "对比：去 M6-2 智能补货 →", primary: false, onClick: () => goPage("m6b") },
        {
          label: "提交普通补货草案 (NORMAL) →", primary: true,
          disabled: !canSubmit,
          disabledTitle: "需「业务运营(planner)」或「主管」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canSubmit) { record403("M6-1 提交普通补货", "无运营提交权限"); return; }
            if (missingRef) { toast("SRS FR-RP-04 拦截：非零淡旺季/活动调整必须填写报表或预算依据！", "error"); return; }
            const rpId = genDocId("RP-N");
            commitAction({
              title: `确认提交普通补货草案 · ${rpId}`,
              summary: "以下为完整测算参数快照（提交后将锁定事实签名，流转至 M6-3 普通计划队列等待主管审批）：",
              confirmText: "确认提交草案",
              fieldsHtml: `
                <div class="formula-box">
                  • SKU 与目的仓：<strong>${invRow.sku} · ${invRow.shopName} · ${invRow.whName}</strong><br/>
                  • 日均代理：<strong>${adjDaily} 件/天</strong>（30天代理 × (1+${state.m6NormalSeasonPct+state.m6NormalPromoPct}%)）<br/>
                  • 交期/安全：<strong>${state.m6NormalLeadDays}天 + ${state.m6NormalSafetyDays}天</strong> ｜ 在途：${state.m6NormalInTransit} 件<br/>
                  • 当前可售 (M0-3)：<strong>${invRow.avail} 件</strong> ｜ 理论缺口：${gap} 件<br/>
                  • 选用方案：<strong>${picked.name} → ${picked.qty} 件</strong>（成本卡 ${prod.costVer} · 占用 $${Math.round(picked.qty * prod.cost).toLocaleString()}）
                </div>
              `,
              onConfirm: () => {
                state.m6Plans.unshift({
                  id: rpId, mode: "NORMAL", sku: invRow.sku,
                  shop: `${invRow.shopName} · ${invRow.whName}`, qty: picked.qty,
                  cash: "$" + Math.round(picked.qty * prod.cost).toLocaleString(),
                  sig: `sig:${rpId.slice(-4)}..OK`, sigValid: true,
                  snapshotDesc: `日均${adjDaily}×(${state.m6NormalLeadDays}+${state.m6NormalSafetyDays})-${invRow.avail}-${state.m6NormalInTransit}=${gap}(选${picked.qty})`,
                  submitter: state.role === "planner" ? "张运营" : state.role, approver: "", approveNote: "", poId: "", status: "待主管审批"
                });
                state.m6ApprovalTab = "NORMAL";
                goPage("m6c");
                return { toastMsg: `普通补货草案 ${rpId} 已提交至 M6-3 独立队列` };
              },
              audit: { target: `M6-1 提交 ${rpId}`, action: "提交普通补货草案", detail: `${invRow.sku} ${picked.qty}件 (${picked.name})`, ok: true }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>普通补货分支 (planning_mode = NORMAL)：</strong>缺 M5 预测时允许用「近30天销量÷30 = 30件/天」代理；非零人工调节必须填依据，缺成本卡禁止提交！</span>
        </div>

        <div class="grid-5">
          <div class="kpi-card"><div class="kpi-label">日均需求 (30天代理)</div><div class="kpi-val">${adjDaily} 件/天</div><div class="formula-inline"><code>30 × (1 + ${state.m6NormalSeasonPct+state.m6NormalPromoPct}%)</code></div></div>
          <div class="kpi-card"><div class="kpi-label">M0-3 当前可售</div><div class="kpi-val">${invRow.avail} 件</div><div class="kpi-sub">${invRow.whName}</div></div>
          <div class="kpi-card"><div class="kpi-label">目标库存水位</div><div class="kpi-val" style="color:var(--blue-hover)">${targetInv} 件</div><div class="formula-inline"><code>${adjDaily}×(${state.m6NormalLeadDays}+${state.m6NormalSafetyDays})</code></div></div>
          <div class="kpi-card highlight-blue"><div class="kpi-label">理论缺口 (M0-3联动)</div><div class="kpi-val" style="color:var(--blue-hover)">${gap} 件</div><div class="formula-inline"><code>${targetInv}-${invRow.avail}-${state.m6NormalInTransit}</code></div></div>
          <div class="kpi-card"><div class="kpi-label">成本卡校验</div><div class="kpi-val" style="color:var(--green-text);font-size:19px;">$${prod.cost} (${prod.costVer} ✓)</div><div class="kpi-sub">占用现金 $${Math.round(picked.qty * prod.cost).toLocaleString()}</div></div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">普通补货参数与人工调节依据</div></div>
            <div class="field"><label>商品 / 目的仓</label>
              <select id="m6nSku" class="select">
                <option value="FAN-203" ${state.m6NormalSku==="FAN-203"?"selected":""}>FAN-203 · Shopee TH (泰国曼谷本地仓)</option>
                <option value="BAG-108" ${state.m6NormalSku==="BAG-108"?"selected":""}>BAG-108 · TikTok US (美国美西海外仓)</option>
              </select>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>供货交期 (天)</label><input id="m6nLead" type="number" class="input" value="${state.m6NormalLeadDays}"/></div>
              <div class="field"><label>安全备货 (天)</label><input id="m6nSafe" type="number" class="input" value="${state.m6NormalSafetyDays}"/></div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>淡旺季调整 (%)</label><input id="m6nSea" type="number" class="input" value="${state.m6NormalSeasonPct}"/></div>
              <div class="field"><label>淡旺季依据 (非0必填)</label><input id="m6nSeaRef" class="input" value="${state.m6NormalSeasonRef}"/></div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>活动销量提升 (%)</label><input id="m6nPro" type="number" class="input" value="${state.m6NormalPromoPct}"/></div>
              <div class="field"><label>活动预算编号 (非0必填)</label><input id="m6nProRef" class="input" placeholder="如：PROMO-1111" value="${state.m6NormalPromoRef}"/></div>
            </div>
            <div class="field"><label>已确认在途数量 (件)</label><input id="m6nTr" type="number" class="input" value="${state.m6NormalInTransit}"/></div>
            ${missingRef ? '<div class="banner banner-red" style="font-size:12px;">校验失败：非零调整百分比必须填写依据编号！</div>' : ""}
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title">三方案定量比较 & 逐日基线代理明细</div></div>
            <div class="table-wrap" style="margin-bottom:12px;">
              <table>
                <thead><tr><th>方案类型</th><th>采购件数</th><th>潜在失销风险</th><th>占用采购现金</th><th>选择</th></tr></thead>
                <tbody>
                  ${plans.map((p, i) => `
                    <tr class="${state.m6NormalPlanIdx===i?"row-selected":""}">
                      <td><strong>${p.name}</strong></td>
                      <td class="nowrap"><strong>${p.qty} 件</strong></td>
                      <td class="nowrap">${p.lost}</td>
                      <td class="nowrap"><strong>$${Math.round(p.qty * prod.cost).toLocaleString()}</strong></td>
                      <td class="nowrap"><button class="btn btn-sm ${state.m6NormalPlanIdx===i?"btn-primary":""} m6n-pick" data-i="${i}">${state.m6NormalPlanIdx===i?"已选中 ✓":"选中"}</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>日期</th><th>30天销量基线</th><th>调整后日需求</th><th>口径说明</th></tr></thead>
                <tbody>
                  ${["2026-11-20","2026-11-21","2026-11-22"].map(d => `
                    <tr><td>${d}</td><td>${baseDaily} 件</td><td><strong>${adjDaily} 件</strong></td><td>近30天销量代理 × (1 + ${state.m6NormalSeasonPct+state.m6NormalPromoPct}%)</td></tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m6nSku").onchange = (e) => { state.m6NormalSku = e.target.value; rerender(); };
        document.getElementById("m6nLead").oninput = (e) => { state.m6NormalLeadDays = Math.max(1, Number(e.target.value)||1); rerender(); };
        document.getElementById("m6nSafe").oninput = (e) => { state.m6NormalSafetyDays = Math.max(0, Number(e.target.value)||0); rerender(); };
        document.getElementById("m6nSea").oninput = (e) => { state.m6NormalSeasonPct = Number(e.target.value)||0; rerender(); };
        document.getElementById("m6nSeaRef").oninput = (e) => { state.m6NormalSeasonRef = e.target.value; rerender(); };
        document.getElementById("m6nPro").oninput = (e) => { state.m6NormalPromoPct = Number(e.target.value)||0; rerender(); };
        document.getElementById("m6nProRef").oninput = (e) => { state.m6NormalPromoRef = e.target.value; rerender(); };
        document.getElementById("m6nTr").oninput = (e) => { state.m6NormalInTransit = Math.max(0, Number(e.target.value)||0); rerender(); };
        document.querySelectorAll(".m6n-pick").forEach(b => b.onclick = () => { state.m6NormalPlanIdx = Number(b.dataset.i); rerender(); });
      }
    };
  }

  // ==================== M6b: Smart Replenishment ====================
  if (pageId === "m6b") {
    const canSubmit = state.role === "planner" || state.role === "approver";
    const hasForecast = !!state.m5ForecastRegistry[state.m6SmartSku];
    const invRow = state.inventoryItems.find(i => i.sku === state.m6SmartSku && i.shopMode === "REAL") || state.inventoryItems[0];
    const prod = state.masterProducts.find(p => p.sku === state.m6SmartSku) || state.masterProducts[0];
    const predDaily = Math.round(state.m5DailyPred.reduce((a, b) => a + b, 0) / state.m5DailyPred.length);
    const covDays = (invRow.avail / Math.max(1, predDaily)).toFixed(1);
    const targetInv = Math.round(predDaily * (state.m6SmartLeadDays + state.m6SmartSafetyDays) * (state.m6SmartAllocPct / 100));
    const recQty = Math.max(0, targetInv - invRow.avail - state.m6SmartInTransit);

    return {
      headerActions: [
        { label: "← 对比普通补货 (M6-1)", primary: false, onClick: () => goPage("m6a") },
        {
          label: "提交智能补货计划 (SMART) →", primary: true,
          disabled: !canSubmit || !hasForecast,
          disabledTitle: !hasForecast ? "FORECAST_REQUIRED：缺 M5 未来预测禁止提交" : "需「业务运营(planner)」权限",
          onClick: () => {
            if (!hasForecast) { toast("FORECAST_REQUIRED：缺未来预测，智能分支严格禁止提交！", "error"); return; }
            if (!canSubmit) { record403("M6-2 提交智能补货", "无运营提交权限"); return; }
            const rpId = genDocId("RP-S");
            commitAction({
              title: `确认提交智能补货计划 · ${rpId}`,
              summary: "将锁定 M5 预测引用、分仓分配比例与路线报价依据，流转至 M6-3 智能计划队列等待主管审批：",
              confirmText: "确认提交计划",
              fieldsHtml: `
                <div class="formula-box">
                  • SKU 与目的仓：<strong>${invRow.sku} · ${invRow.shopName} · ${invRow.whName}</strong><br/>
                  • M5 预测日均：<strong>${predDaily} 件/天</strong> ｜ 覆盖天数：<strong>${covDays} 天</strong><br/>
                  • 物流路线：<strong>${state.m6SmartRoute}</strong> ｜ 仓位分配：<strong>${state.m6SmartAllocPct}%</strong><br/>
                  • 建议采购量：<strong>${recQty} 件</strong>（占用采购现金 $${Math.round(recQty * prod.cost).toLocaleString()}）
                </div>
              `,
              onConfirm: () => {
                state.m6Plans.unshift({
                  id: rpId, mode: "SMART", sku: invRow.sku,
                  shop: `${invRow.shopName} · ${invRow.whName}`, qty: recQty,
                  cash: "$" + Math.round(recQty * prod.cost).toLocaleString(),
                  sig: `sig:${rpId.slice(-4)}..OK`, sigValid: true,
                  snapshotDesc: `M5预测${predDaily}/天×(${state.m6SmartLeadDays}+${state.m6SmartSafetyDays})×${state.m6SmartAllocPct}%-${invRow.avail}-${state.m6SmartInTransit}=${recQty}`,
                  submitter: state.role === "planner" ? "张运营" : state.role, approver: "", approveNote: "", poId: "", status: "待主管审批"
                });
                state.m6ApprovalTab = "SMART";
                goPage("m6c");
                return { toastMsg: `智能补货计划 ${rpId} 已提交至 M6-3 独立队列` };
              },
              audit: { target: `M6-2 提交 ${rpId}`, action: "提交智能补货计划", detail: `${invRow.sku} ${recQty}件 · ${state.m6SmartRoute}`, ok: true }
            });
          }
        }
      ],
      html: `
        <div class="card">
          <div class="filter-bar">
            <div class="filter-item">
              <label>选择分析 SKU（切到 COS-052 可测试 FORECAST_REQUIRED 拦截）</label>
              <select id="m6sSku" class="select">
                <option value="BAG-108" ${state.m6SmartSku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包 (${state.m5ForecastRegistry["BAG-108"]?"已有 M5 预测 ✓":"缺预测"})</option>
                <option value="COS-052" ${state.m6SmartSku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜 (${state.m5ForecastRegistry["COS-052"]?"已有 M5 预测 ✓":"无未来预测 · 测试拦截"})</option>
                <option value="MAT-014" ${state.m6SmartSku==="MAT-014"?"selected":""}>MAT-014 · 桌面皮质收纳垫 (${state.m5ForecastRegistry["MAT-014"]?"已有 M5 预测 ✓":"无未来预测 · 测试拦截"})</option>
              </select>
            </div>
            <div class="filter-item">
              <label>物流路线与时效</label>
              <select id="m6sRoute" class="select">
                <option ${state.m6SmartRoute.includes("海运")?"selected":""}>海运标准线 ($1.9/件 · 18天)</option>
                <option ${state.m6SmartRoute.includes("空运")?"selected":""}>空运加急线 ($4.8/件 · 7天)</option>
              </select>
            </div>
            <div class="filter-item">
              <label>目标仓分配比例 (%)</label>
              <input id="m6sAlloc" type="number" class="input" value="${state.m6SmartAllocPct}" min="10" max="100"/>
            </div>
            <div><button class="btn btn-sm" id="m6RouteDetailBtn">查看路线报价依据</button></div>
          </div>
        </div>

        ${!hasForecast ? `
          <div class="banner banner-red">
            <span><strong>阻断错误 [FORECAST_REQUIRED]：</strong>当前 SKU (${state.m6SmartSku}) 尚无覆盖未来日期的 M5 销量预测！智能补货严禁使用 30 天历史销量代理。</span>
            <button class="btn btn-primary btn-sm" id="gotoM5bFix">去 M5-2 运行并保存未来预测 →</button>
          </div>
        ` : `
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">M5 日均预测需求</div><div class="kpi-val" style="color:var(--blue-hover)">${predDaily} 件/天</div><div class="kpi-sub">直接消费 M5 未来曲线</div></div>
            <div class="kpi-card"><div class="kpi-label">当前可售 / 覆盖天数</div><div class="kpi-val" style="color:${Number(covDays)<state.m6SmartLeadDays?"var(--red-text)":"var(--green-text)"}">${invRow.avail} 件 (${covDays}天)</div><div class="formula-inline"><code>覆盖天数 = ${invRow.avail} ÷ ${predDaily} = ${covDays}天</code></div></div>
            <div class="kpi-card highlight-amber"><div class="kpi-label">预计库存风险</div><div class="kpi-val" style="color:${Number(covDays)<state.m6SmartLeadDays?"var(--red-text)":"var(--green-text)"}">${Number(covDays)<state.m6SmartLeadDays?"高风险":"风险可控"}</div><div class="kpi-sub">覆盖 ${covDays}天 vs 交期 ${state.m6SmartLeadDays}天</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">智能建议采购量 (M0-3联动)</div><div class="kpi-val" style="color:var(--blue-hover)">${recQty} 件</div><div class="formula-inline"><code>${predDaily}×(${state.m6SmartLeadDays}+${state.m6SmartSafetyDays})×${state.m6SmartAllocPct}% - ${invRow.avail} - ${state.m6SmartInTransit}</code></div></div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header"><div class="card-title">M5 已保存未来逐日预测曲线（不调训练接口，仅只读消费）</div></div>
              <svg viewBox="0 0 540 185" style="width:100%;height:auto;max-height:190px;display:block;background:#ffffff;border-radius:6px;">
                <line x1="25" y1="40" x2="515" y2="40" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="25" y1="95" x2="515" y2="95" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="25" y1="150" x2="515" y2="150" stroke="#e2e8f0" stroke-width="1"/>
                <polyline fill="none" stroke="#2563eb" stroke-width="2.2" points="45,122 100,72 155,108 210,48 265,90 320,56 375,96 430,45 490,82" />
                <text x="45" y="169" font-size="11" fill="#475569">今天 (${invRow.avail}件)</text>
                <text x="495" y="169" font-size="11" fill="#475569" text-anchor="end">未来 ${state.m5Horizon} 天 (${state.m5Model})</text>
              </svg>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-title">全仓 SKU 库存风险巡检表（点击行查看风险明细）</div></div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>SKU · 存放仓库</th><th>日均预测</th><th>可售库存</th><th>覆盖天数</th><th>状态</th></tr></thead>
                  <tbody>
                    <tr class="m6s-risk-row" data-sku="BAG-108" style="cursor:pointer;"><td><strong>BAG-108 · 美西仓</strong></td><td>${predDaily} 件</td><td>${invRow.avail} 件</td><td>${covDays} 天</td><td><span class="pill ${Number(covDays)<state.m6SmartLeadDays?"p-red":"p-green"}">${Number(covDays)<state.m6SmartLeadDays?"高风险":"安全"}</span></td></tr>
                    <tr class="m6s-risk-row" data-sku="COS-052" style="cursor:pointer;"><td><strong>COS-052 · 美东仓</strong></td><td>${state.m5ForecastRegistry["COS-052"]?"已预测":"缺少预测"}</td><td>${state.inventoryItems.find(x=>x.sku==="COS-052").avail} 件</td><td>—</td><td><span class="pill p-amber">${state.m5ForecastRegistry["COS-052"]?"可切入":"FORECAST_REQUIRED"}</span></td></tr>
                    <tr class="m6s-risk-row" data-sku="MAT-014" style="cursor:pointer;"><td><strong>MAT-014 · 美东仓</strong></td><td>缺少预测</td><td>${state.inventoryItems.find(x=>x.sku==="MAT-014").avail} 件</td><td>—</td><td><span class="pill p-amber">缺少预测</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `}
      `,
      bind: () => {
        document.getElementById("m6sSku").onchange = (e) => { state.m6SmartSku = e.target.value; rerender(); };
        document.getElementById("m6sRoute").onchange = (e) => {
          state.m6SmartRoute = e.target.value;
          state.m6SmartLeadDays = e.target.value.includes("空运") ? 7 : 18;
          rerender();
        };
        document.getElementById("m6sAlloc").oninput = (e) => { state.m6SmartAllocPct = Math.max(10, Math.min(100, Number(e.target.value)||70)); rerender(); };
        const fixBtn = document.getElementById("gotoM5bFix");
        if (fixBtn) fixBtn.onclick = () => { state.m5Sku = state.m6SmartSku; goPage("m5b"); };
        document.getElementById("m6RouteDetailBtn").onclick = () => {
          openDrawer("物流路线报价与分仓分配依据", `${state.m6SmartSku} · 货代历史报价单对比`, `
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>1. 海运标准线 (默认推荐)：</strong>$1.90 / 件 · 全程采购+海运入仓 18 天 · 单件运费占比低<br/>
              <strong>2. 空运加急线 (防断货应急)：</strong>$4.80 / 件 · 7 天入仓 · 覆盖天数低于 10 天时建议切入
            </div>
            <div class="banner banner-blue">当前分配比例 ${state.m6SmartAllocPct}% · 建议采购 ${recQty} 件 · 总运费估算 $${(recQty * (state.m6SmartRoute.includes("空运")?4.8:1.9)).toFixed(0)}</div>
          `);
        };
        document.querySelectorAll(".m6s-risk-row").forEach(r => r.onclick = () => {
          openDrawer(`库存风险明细 · ${r.dataset.sku}`, "M0-3 实时仓位 × M5 预测校验", `
            <div class="formula-box">
              • 只有先在 M5-2 生成并保存未来预测后，M6-2 智能分支才允许重算交期覆盖风险；<br/>
              • 可在上方切换「空运 7 天」观察交期缩短后风险等级与采购建议量的动态变化！
            </div>
          `);
        });
      }
    };
  }

  // ==================== M6c: Plan Verification & Supervisor Approval -> PO Generation ====================
  if (pageId === "m6c") {
    const canApprove = state.role === "approver";
    const list = state.m6Plans.filter(p => p.mode === state.m6ApprovalTab);
    return {
      headerActions: [
        { label: "去 M6-4 采购单与分批收货凭证 →", primary: true, onClick: () => goPage("m6d") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>列表隔离与真实流转：</strong>普通补货 (NORMAL) 与智能补货 (SMART) 严格隔离；主管批准时将<strong>重新校验事实签名 (一致才准批)</strong>，批准后<strong>真实生成采购单号流入 M6-4</strong>！</span>
        </div>

        <div class="card">
          <div class="utabs" style="margin-bottom:14px;">
            <div class="utab ${state.m6ApprovalTab==="NORMAL"?"active":""} m6c-tab" data-m="NORMAL">普通补货计划 (NORMAL) <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="NORMAL").length}</span></div>
            <div class="utab ${state.m6ApprovalTab==="SMART"?"active":""} m6c-tab" data-m="SMART">智能补货计划 (SMART) <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="SMART").length}</span></div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>计划编号</th><th>SKU · 店铺/仓</th><th>采购件数 / 现金</th><th>事实签名重算校验</th><th>提交人</th><th>状态 / 采购单</th><th>主管审批操作</th></tr></thead>
              <tbody>
                ${list.map(p => {
                  const sodSame = p.submitter === state.role;
                  const canAct = canApprove && p.status === "待主管审批" && !sodSame;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${p.id}</strong><div style="font-size:12px;color:var(--text-soft);">${p.mode}</div></td>
                      <td><strong>${p.sku}</strong><div style="font-size:12px;color:var(--text-soft);">${p.shop}</div><div style="font-size:12px;color:var(--blue-hover);">${p.snapshotDesc}</div></td>
                      <td class="nowrap"><strong>${p.qty} 件</strong><div style="font-size:12px;">${p.cash}</div></td>
                      <td class="nowrap">
                        <span class="pill ${p.sigValid?"p-green":"p-red"}">${p.sigValid ? `重算一致 (${p.sig})` : "签名不一致 (需退回重算)"}</span>
                        <div><button class="btn btn-sm m6c-toggle-sig" data-id="${p.id}" style="margin-top:4px;">${p.sigValid?"模拟签名篡改测试":"恢复签名一致"}</button></div>
                      </td>
                      <td class="nowrap">${p.submitter}</td>
                      <td class="nowrap">
                        <span class="pill ${p.status==="已批准"?"p-green":p.status==="已驳回"?"p-red":"p-amber"}">${p.status}</span>
                        ${p.poId ? `<div style="font-size:12px;color:var(--blue-hover);margin-top:3px;"><strong>已生成 ${p.poId}</strong></div>` : ""}
                      </td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-success m6c-act" data-id="${p.id}" data-act="已批准" ${(!canAct || !p.sigValid)?"disabled":""} title="${!canApprove?"需「主管/审批人」权限 — 请在左上角切换角色":!p.sigValid?"签名校验不一致禁止批准":"批准并生成采购单流入M6-4"}">批准生成采购单</button>
                        <button class="btn btn-sm btn-danger m6c-act" data-id="${p.id}" data-act="已驳回" ${!canAct?"disabled":""}>驳回</button>
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
        document.querySelectorAll(".m6c-tab").forEach(t => t.onclick = () => { state.m6ApprovalTab = t.dataset.m; rerender(); });
        document.querySelectorAll(".m6c-toggle-sig").forEach(b => b.onclick = () => {
          const p = state.m6Plans.find(x => x.id === b.dataset.id);
          p.sigValid = !p.sigValid;
          rerender();
          toast(p.sigValid ? "事实签名重算一致 ✓" : "已模拟事实签名不一致（拦截批准操作）", p.sigValid ? "success" : "warn");
        });
        document.querySelectorAll(".m6c-act").forEach(b => b.onclick = () => {
          const p = state.m6Plans.find(x => x.id === b.dataset.id);
          const act = b.dataset.act;
          const newPo = genDocId("PO");
          commitAction({
            title: `主管${act === "已批准" ? "批准补货并生成采购单" : "驳回补货计划"} · ${p.id}`,
            summary: act === "已批准"
              ? `签名重算一致 (${p.sig})；批准后将正式生成采购单 <strong>${newPo}</strong> 并推入 M6-4 待收货履约台账。`
              : "驳回后需由业务运营重新校准数据后再提交。",
            danger: act === "已驳回",
            confirmText: act === "已批准" ? `批准并生成 ${newPo}` : "确认驳回",
            fieldsHtml: `<div class="field"><label>审批意见 * (必填)</label><textarea id="m6cNote" class="textarea" placeholder="填写资金/交期审核结论..."></textarea></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m6cNote");
              return el.value.trim() ? [] : [{ el, msg: "必须填写审批意见" }];
            },
            onConfirm: (wrap) => {
              p.status = act;
              p.approver = "陈主管 (approver)";
              p.approveNote = wrap.querySelector("#m6cNote").value.trim();
              if (act === "已批准") {
                p.poId = newPo;
                state.m6Orders.unshift({
                  po: newPo, planId: p.id, sku: p.sku, totalQty: p.qty,
                  status: "待收货", createdAt: nowDateTimeStr(), historical: false
                });
                return { toastMsg: `已批准 ${p.id} 并生成采购单 ${newPo} 流入 M6-4！` };
              }
              return { toastMsg: `已驳回 ${p.id}`, toastLevel: "warn" };
            },
            audit: (wrap) => ({
              target: `M6-3 补货审批 · ${p.id}`,
              action: act === "已批准" ? `批准生成 ${newPo}` : "驳回补货计划",
              detail: wrap.querySelector("#m6cNote").value.trim(),
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M6d: Purchase Order & Multi-batch Receipt Vouchers ====================
  if (pageId === "m6d") {
    const canWh = state.role === "warehouse";
    return {
      headerActions: [
        { label: "去 M0-3 分店独立库存人工校准 →", primary: false, onClick: () => goPage("m0c") },
        {
          label: "+ 登记分批到货与质检凭证", primary: true,
          disabled: !canWh,
          disabledTitle: "需「采购 / 仓库 / 物流人员」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canWh) { record403("M6-4 登记收货凭证", "非仓储人员不可登记"); return; }
            commitAction({
              title: "登记分批到货与质检凭证",
              summary: "红线提示：登记收货凭证<strong>绝不自动加减 M0-3 可售库存</strong>，实际入库数量须仓管前往 M0-3 盘点确认！",
              confirmText: "保存收货凭证",
              fieldsHtml: `
                <div class="field"><label>选择采购单 *</label>
                  <select id="rcPoSel" class="select">
                    ${state.m6Orders.map(o => `<option value="${o.po}" data-sku="${o.sku}" data-tot="${o.totalQty}">${o.po} · ${o.sku} (计划 ${o.totalQty} 件 · ${o.status})</option>`).join("")}
                  </select>
                </div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>批次说明 *</label><input id="rcBatch" class="input" value="第 ${state.m6Receipts.length + 1} 批到货"/></div>
                  <div class="field"><label>本次实收合格件数 (>0) *</label><input id="rcQty" type="number" class="input" value="100"/></div>
                </div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>差异数量 (实收-应收, 可为负)</label><input id="rcDiff" type="number" class="input" value="0"/></div>
                  <div class="field"><label>质检报告编号 *</label><input id="rcQc" class="input" value="${genDocId("QC")}"/></div>
                </div>
                <div class="field"><label>差异原因与上传凭证编号 *</label><input id="rcReason" class="input" value="抽检合格，外箱完好 (签收单号 #SIGN-01)"/></div>
              `,
              validate: (wrap) => {
                const errs = [];
                const qEl = wrap.querySelector("#rcQty");
                const qcEl = wrap.querySelector("#rcQc");
                const rEl = wrap.querySelector("#rcReason");
                if (!(Number(qEl.value) > 0)) errs.push({ el: qEl, msg: "实收件数必须大于 0" });
                if (!qcEl.value.trim()) errs.push({ el: qcEl, msg: "质检报告编号不能为空" });
                if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写收货说明或差异原因" });
                return errs;
              },
              onConfirm: (wrap) => {
                const sel = wrap.querySelector("#rcPoSel");
                const po = sel.value;
                const sku = sel.options[sel.selectedIndex].dataset.sku;
                const planQty = Number(sel.options[sel.selectedIndex].dataset.tot);
                const gotQty = Math.floor(Number(wrap.querySelector("#rcQty").value));
                const diff = Math.floor(Number(wrap.querySelector("#rcDiff").value) || 0);
                const qc = wrap.querySelector("#rcQc").value.trim();
                const diffReason = wrap.querySelector("#rcReason").value.trim();
                const batch = wrap.querySelector("#rcBatch").value.trim();
                state.m6Receipts.unshift({
                  po, sku, batch, planQty, gotQty, diff, diffReason, qc,
                  voucher: `${qc}.pdf`, who: "赵仓管 (warehouse)", time: nowDateTimeStr()
                });
                const poObj = state.m6Orders.find(x => x.po === po);
                if (poObj) poObj.status = diff === 0 && gotQty >= planQty ? "全部到货已核验" : "部分收货";
                return { toastMsg: `已登记 ${po} 收货凭证（M0-3 库存未自动改写，请前往 M0-3 盘点校准）` };
              },
              audit: (wrap) => ({
                target: `M6-4 收货凭证 · ${wrap.querySelector("#rcPoSel").value}`,
                action: "登记收货与质检凭证",
                detail: `实收 ${wrap.querySelector("#rcQty").value} 件 · 质检 ${wrap.querySelector("#rcQc").value}`,
                ok: true
              })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-red">
          <span><strong>安全红线 (AC-RP-04)：</strong>分批收货差异与质检凭证仅保存至履约台账，<strong>绝不自动加减 M0-3 可售库存</strong>！实际库存变化必须由仓管在 M0-3 人工盘点校准。</span>
          <button class="btn btn-sm btn-primary" id="m6dToM0c">去 M0-3 盘点更新库存 →</button>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">已批准采购单列表（由 M6-3 审批生成）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>采购单号</th><th>来源补货计划</th><th>SKU</th><th>计划采购总数</th><th>状态</th><th>生成时间</th></tr></thead>
              <tbody>
                ${state.m6Orders.map(o => `
                  <tr>
                    <td class="nowrap"><strong>${o.po}</strong> ${o.historical?'<span class="pill p-gray">历史示例</span>':'<span class="pill p-blue">M6-3 新批生成</span>'}</td>
                    <td class="nowrap">${o.planId}</td>
                    <td class="nowrap"><strong>${o.sku}</strong></td>
                    <td class="nowrap"><strong>${o.totalQty} 件</strong></td>
                    <td class="nowrap"><span class="pill ${o.status.includes("全部")?"p-green":"p-amber"}">${o.status}</span></td>
                    <td class="nowrap">${o.createdAt}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">分批收货与质检差异凭证台账（receipt_batches）</div>
            <span class="pill ${canWh?"p-green":"p-gray"}">${canWh ? "warehouse 凭证权限已解锁 ✓" : "只读（登记需采购/仓库/物流角色）"}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>采购单号</th><th>SKU</th><th>收货批次</th><th>计划总数</th><th>本次实收</th><th>差异</th><th>质检单 / 差异说明</th><th>经办人与时间</th></tr></thead>
              <tbody>
                ${state.m6Receipts.map(r => `
                  <tr>
                    <td class="nowrap"><strong>${r.po}</strong></td>
                    <td class="nowrap">${r.sku}</td>
                    <td class="nowrap">${r.batch}</td>
                    <td class="nowrap">${r.planQty} 件</td>
                    <td class="nowrap"><strong>${r.gotQty} 件</strong></td>
                    <td class="nowrap"><span class="pill ${r.diff<0?"p-red":"p-green"}">${r.diff}</span></td>
                    <td><strong>${r.qc}</strong><div style="font-size:12px;color:var(--text-soft);">${r.diffReason}</div></td>
                    <td class="nowrap">${r.who}<div style="font-size:12px;color:var(--text-soft);">${r.time}</div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m6dToM0c").onclick = () => goPage("m0c");
      }
    };
  }

  return null;
}
