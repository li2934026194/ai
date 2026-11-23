function calcM4NetSales(x) { return x.paidQty - x.refundQty; }
function calcM4NetRev(x) { return +(x.grossRev - x.discount - x.refundAmt).toFixed(2); }
function calcM4Score(x, maxRev) {
  const revNorm = Math.min(100, (calcM4NetRev(x) / maxRev) * 100);
  const trendNorm = Math.max(0, Math.min(100, (x.trend + 20) * 1.6));
  if (x.marginKnown && x.margin !== null) {
    const mNorm = Math.min(100, x.margin * 4);
    const sc = 0.5 * revNorm + 0.4 * trendNorm + 0.1 * mNorm;
    return { score: sc.toFixed(1), formula: `0.5×${revNorm.toFixed(0)} + 0.4×${trendNorm.toFixed(0)} + 0.1×${mNorm.toFixed(0)} = ${sc.toFixed(1)}` };
  }
  const wR = (0.5 / 0.9), wT = (0.4 / 0.9);
  const sc = wR * revNorm + wT * trendNorm;
  return { score: sc.toFixed(1), formula: `缺利润率重归一：0.556×${revNorm.toFixed(0)} + 0.444×${trendNorm.toFixed(0)} = ${sc.toFixed(1)}` };
}

export function renderM4_M6(pageId, state, helpers) {
  const { toast, goPage, openDrawer, closeDetailDrawer, rerender } = helpers;

  // ==================== M4a: 3-Source Data Ingestion ====================
  if (pageId === "m4a") {
    return {
      headerActions: [
        { label: "模拟上传含mock文件名(测试拦截)", primary: false, onClick: () => {
          state.m4Tasks.unshift({ file: "选品周数据_mock_未选演示.xlsx", kind: "待识别", scope: "解析中 (0条)", status: "FAILED：含mock标识不可作真实数据导入", ok: false, tag: "拦截" });
          rerender(); toast("已触发 Mock 文件拦截规则！");
        } },
        { label: "+ 导入商品周数据", primary: true, onClick: () => {
          state.m4Tasks.unshift({ file: "weekly_internal_batch2.csv", kind: "内部数据", scope: "12 SKU · US/TH (96条)", status: "SUCCEEDED (纯内部实盘)", ok: true, tag: "READY_REVIEW" });
          rerender(); toast("已完成 UTF-8 BOM 解析与 SHA-256 校验，入库 96 条内部周事实");
        } }
      ],
      html: `
        <div class="banner banner-blue">
          <span>隔离说明：严格区分 INTERNAL(实际) / PAID_EXTERNAL(估算) / OPEN_PUBLIC(观察) / MOCK(演示)。外购估算不得支撑实际经营利润！</span>
          <button class="btn btn-primary btn-sm" id="gotoM4bBtn">进入选品初筛工作台 →</button>
        </div>

        <div class="grid-3">
          <div class="kpi-card highlight-amber">
            <div class="kpi-label"><span><span class="anno-tag t-blue">1</span> 外购数据</span><span class="pill p-amber">PAID_EXTERNAL · 估算</span></div>
            <div class="kpi-val">10,000 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">缺内部成本时不可生成经营利润</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label"><span>内部实际数据</span><span class="pill p-green">INTERNAL · 实际</span></div>
            <div class="kpi-val">48 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">含完整采购/头程/平台/广告费，可支撑测款</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>爬取公网数据</span><span class="pill p-blue">OPEN_PUBLIC · 观察</span></div>
            <div class="kpi-val">0 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">仅辅助趋势与价格线索</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 接入任务记录（SHA-256 去重 · QUEUED → SUCCEEDED / FAILED）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>任务 / 来源文件名</th><th>数据性质</th><th>覆盖范围</th><th>入库状态</th><th>业务标签</th></tr></thead>
              <tbody>
                ${state.m4Tasks.map(t => `
                  <tr>
                    <td><strong>${t.file}</strong></td>
                    <td class="nowrap"><span class="pill ${t.kind==="外购数据"?"p-amber":t.kind==="内部数据"?"p-green":t.kind==="演示Mock"?"p-blue":"p-gray"}">${t.kind}</span></td>
                    <td class="nowrap">${t.scope}</td>
                    <td class="nowrap"><span class="pill ${t.ok?"p-green":"p-red"}">${t.status}</span></td>
                    <td class="nowrap"><span class="pill p-gray">${t.tag}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => { document.getElementById("gotoM4bBtn").onclick = () => goPage("m4b"); }
    };
  }

  // ==================== M4b: Selection Pool & Screening (Reference Image 27/28) ====================
  if (pageId === "m4b") {
    const isSelector = state.role === "selector" || state.role === "planner";
    const maxRev = Math.max(...state.m4Pool.map(calcM4NetRev), 1);
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
    const tabFiltered = baseFiltered.filter(x => state.m4Tab === "ALL" || x.stage === state.m4Tab);
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(tabFiltered.length / pageSize));
    if (state.m4Page > totalPages) state.m4Page = 1;
    const paged = tabFiltered.slice((state.m4Page - 1) * pageSize, state.m4Page * pageSize);

    return {
      headerActions: [
        { label: "← 三源数据接入", primary: false, onClick: () => goPage("m4a") },
        { label: "去 M4-3 主管测款拍板 →", primary: true, onClick: () => goPage("m4c") }
      ],
      html: `
        <div class="grid-4">
          <div class="kpi-card">
            <div class="kpi-label">机会池样本数</div>
            <div class="kpi-val">${state.m4Pool.length} 款</div>
            <div class="kpi-sub">≥4周数据方参与趋势排序</div>
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

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item" style="flex:1.4;">
              <label><span class="anno-tag t-blue">1</span> 搜索 SKU / 品名</label>
              <input id="m4SearchInp" class="input" placeholder="输入 SKU-00515 / 收纳 / 封口机…" value="${state.m4Search}"/>
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
          <div class="formula-box" style="margin-top:10px;">
            <strong>📐 SRS §6.2/6.3 核心计算公式：</strong>
            净销量 = 支付件数 − 退款件数 ｜ 净收入 = 总额 − 折扣 − 退款金额 ｜ 趋势 = (后半均 − 前半均) ÷ 前半均 ｜ 均衡评分 = <strong>0.5×净收入 + 0.4×趋势 + 0.1×利润率</strong>（利润率未知时不按0算，按 0.5/0.9 与 0.4/0.9 重归一）
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
              const sc = calcM4Score(item, maxRev);
              return `
                <div class="prod-card">
                  <div class="prod-thumb">
                    <div>
                      <div style="font-size:11px;color:var(--text-soft);">${item.sku} · ${item.region}</div>
                      <strong style="font-size:14.5px;">${item.name}</strong>
                    </div>
                    <span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}">${item.src}</span>
                  </div>

                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已提交待审"?"p-purple":item.stage==="AI初筛候选"?"p-blue":item.stage==="已淘汰"?"p-red":"p-amber"}">${item.stage}</span>
                    <strong style="color:var(--blue-hover);font-size:13px;">AI 评分 ${sc.score}</strong>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
                    <div>8周净收入：<strong style="color:var(--text-dark)">$${netRev.toLocaleString()}</strong></div>
                    <div>净销量：<strong>${netQty} 件</strong></div>
                    <div>趋势：<strong style="color:${item.trend>=0?"var(--green-text)":"var(--red-text)"}">${item.trend>=0?"+":""}${item.trend}%</strong></div>
                    <div>利润率：<strong>${item.marginKnown?item.margin+"%":'<span style="color:var(--amber-text)">未知(留空)</span>'}</strong></div>
                  </div>

                  <div class="formula-inline">
                    <strong>📐 算式：</strong>净销量=${item.paidQty}-${item.refundQty}=${netQty}；趋势=(${item.currAvg}-${item.prevAvg})÷${item.prevAvg}=${item.trend}%<br/>
                    评分：<code>${sc.formula}</code>
                  </div>

                  ${item.missing ? `<div style="font-size:11.3px;color:var(--amber-text);">⚠ ${item.missing}</div>` : ""}

                  <div style="display:flex;gap:8px;margin-top:auto;padding-top:4px;">
                    <button class="btn btn-sm m4-detail" data-sku="${item.sku}">查看算式详情</button>
                    ${(item.stage === "AI初筛候选" || item.stage === "缺成本/待补全")
                      ? `<button class="btn btn-sm btn-primary m4-submit" data-sku="${item.sku}" ${!isSelector?"disabled":""}>提交进待审清单 →</button>`
                      : `<span style="font-size:11.5px;color:var(--text-soft);align-self:center;">已流转 (${item.submitter})</span>`}
                  </div>
                </div>
              `;
            }).join("")}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <span style="font-size:12px;color:var(--text-soft);">第 ${state.m4Page} / ${totalPages} 页 · 共 ${tabFiltered.length} 款符合筛选条件</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m4PrevPg" ${state.m4Page<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m4NextPg" ${state.m4Page>=totalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m4SearchInp").oninput = (e) => { state.m4Search = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4SrcSel").onchange = (e) => { state.m4SrcFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RegSel").onchange = (e) => { state.m4RegionFilter = e.target.value; state.m4Page = 1; rerender(); };
        document.getElementById("m4RevSel").onchange = (e) => { state.m4MinRev = Number(e.target.value); state.m4Page = 1; rerender(); };
        document.querySelectorAll(".m4-utab").forEach(t => t.onclick = () => { state.m4Tab = t.dataset.t; state.m4Page = 1; rerender(); });
        document.getElementById("m4PrevPg").onclick = () => { state.m4Page -= 1; rerender(); };
        document.getElementById("m4NextPg").onclick = () => { state.m4Page += 1; rerender(); };
        document.querySelectorAll(".m4-submit").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          item.stage = "已提交待审"; item.submitter = state.role === "selector" ? "吴选品" : state.role;
          rerender(); toast(`${item.sku} 已加入待审清单，请由「主管 / 审批人」在 M4-3 终审拍板`);
        });
        document.querySelectorAll(".m4-detail").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          const netQty = calcM4NetSales(item);
          const netRev = calcM4NetRev(item);
          openDrawer(`${item.sku} · ${item.name}`, `${item.region} · ${item.src}`, `
            <div class="formula-box" style="margin-bottom:12px;">
              <strong>📐 全部指标逐步推导（SRS BR-SEL-01~03）：</strong><br/>
              1. 净销量 = ${item.paidQty} (支付) − ${item.refundQty} (退款) = <strong>${netQty} 件</strong><br/>
              2. 净收入 = $${item.grossRev.toLocaleString()} − $${item.discount} (折扣) − $${item.refundAmt} (退款) = <strong>$${netRev.toLocaleString()}</strong><br/>
              3. 周趋势 = (${item.currAvg} − ${item.prevAvg}) ÷ ${item.prevAvg} × 100% = <strong>${item.trend}%</strong><br/>
              4. 经营利润率 = ${item.marginKnown ? `<strong>${item.margin}%</strong> (≥10% 达标)` : "<strong>未知（缺费用，严禁按0生成利润）</strong>"}
            </div>
            <div class="banner ${item.srcCode==="INTERNAL"&&item.marginKnown&&item.margin>=10?"banner-green":"banner-amber"}">
              ${item.srcCode==="INTERNAL"&&item.marginKnown&&item.margin>=10 ? "满足 FR-SEL-10 批准测款条件（纯内部实盘 + 利润率≥10%）" : "未满足批准测款硬门槛（仅内部实盘且利润率≥10%才可投产）"}
            </div>
          `);
        });
      }
    };
  }

  // ==================== M4c: Supervisor Final Decision (approver) ====================
  if (pageId === "m4c") {
    const isApprover = state.role === "approver";
    const reviewList = state.m4Pool.filter(x => x.stage === "已提交待审" || x.stage === "已批准测款" || x.stage === "已淘汰");
    return {
      headerActions: [
        { label: "← 返回机会池初筛 (M4-2)", primary: false, onClick: () => goPage("m4b") },
        !isApprover
          ? { label: "切为「主管/审批人」测试拍板", primary: true, onClick: () => { state.role = "approver"; document.getElementById("roleSelect").value = "approver"; rerender(); } }
          : { label: "当前：主管终审模式 ✓", primary: false, onClick: () => {} }
      ],
      html: `
        <div class="banner ${isApprover?"banner-green":"banner-amber"}">
          <span><span class="anno-tag t-purple">1</span> SRS FR-SEL-10/11 终审硬门槛：仅「纯内部实际 (INTERNAL) + 无缺失项 + 利润率 ≥ 10%」才允许批准投产 (PRODUCE)；否则仅可 SUPPLEMENT (补充) 或 DELIST (淘汰)。</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">2</span> 待审选品清单与测款拍板台（提交人 ≠ 审批人 SoD）</div>
            <span class="pill p-purple">共 ${reviewList.length} 款进入评审流</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品 / SKU</th><th>数据性质</th><th>8周净收入 / 趋势</th><th>经营利润率</th><th>初筛提交人</th><th>当前状态</th><th>主管终审决策 (PRODUCE/SUPPLEMENT/DELIST)</th></tr></thead>
              <tbody>
                ${reviewList.map(item => {
                  const netRev = calcM4NetRev(item);
                  const canProduce = item.srcCode === "INTERNAL" && item.marginKnown && item.margin >= 10 && !item.missing;
                  const canAct = isApprover && item.stage === "已提交待审";
                  return `
                    <tr>
                      <td><strong>${item.name}</strong><div style="font-size:11px;color:var(--text-soft)">${item.sku} · 预算 ${item.budget}</div></td>
                      <td class="nowrap"><span class="pill ${item.srcCode==="INTERNAL"?"p-green":"p-amber"}">${item.src}</span></td>
                      <td class="nowrap"><strong>$${netRev.toLocaleString()}</strong> <span style="color:var(--green-text)">(${item.trend}%)</span></td>
                      <td class="nowrap">${item.marginKnown ? `<strong style="color:${item.margin>=10?"var(--green-text)":"var(--red-text)"}">${item.margin}%</strong>` : '<span class="pill p-amber">缺失</span>'}</td>
                      <td class="nowrap">${item.submitter}</td>
                      <td class="nowrap"><span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已淘汰"?"p-red":"p-purple"}">${item.stage}</span></td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-success m4c-act" data-sku="${item.sku}" data-act="已批准测款" ${(!canAct || !canProduce)?"disabled":""} title="${!canProduce?"外购或利润率<10%禁止投产":""}">PRODUCE 批准测款</button>
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
          item.stage = b.dataset.act;
          rerender(); toast(`主管已拍板：${item.sku} → ${item.stage}`);
        });
      }
    };
  }

  // ==================== M5a: DemandProfile & Model Registry ====================
  if (pageId === "m5a") {
    return {
      headerActions: [{ label: "下一步：销量预测执行与曲线 →", primary: true, onClick: () => goPage("m5b") }],
      html: `
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> SKU 需求画像（DemandProfile · 行锁版本递增）</div>
            <button class="btn btn-sm" id="editDpBtn">保存人工画像 (版本 +1)</button>
          </div>
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">目标 SKU</div><div style="font-weight:700;margin-top:5px;">BAG-108 · 轻量通勤双肩包</div></div>
            <div class="kpi-card"><div class="kpi-label">真实已完成订单历史</div><div style="font-weight:700;margin-top:5px;">96 天（有单 90 天）</div></div>
            <div class="kpi-card"><div class="kpi-label">当前需求模式</div><div style="font-weight:700;margin-top:5px;">${state.demandProfileMode}</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">画像版本 (自动推荐)</div><div style="font-weight:700;margin-top:5px;color:var(--blue-hover)">v${state.demandProfileVer} · CatBoost / LightGBM</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 版本化模型注册表（9 个内置策略 · 最低历史门槛自动校验）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>模型 / 版本</th><th>模型族</th><th>最低历史点</th><th>BAG-108 (96天) 门槛校验</th><th>状态</th><th>说明</th><th>操作</th></tr></thead>
              <tbody>
                ${state.m5Models.map((m, i) => {
                  const pass = 96 >= m.minPts;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${m.name}</strong></td>
                      <td class="nowrap">${m.family}</td>
                      <td class="nowrap">≥ ${m.minPts} 点</td>
                      <td class="nowrap"><span class="pill ${pass?"p-green":"p-amber"}">${pass?"满足可执行 ✓":"短样本警告 (<"+m.minPts+")"}</span></td>
                      <td class="nowrap"><span class="pill ${m.enabled?"p-green":"p-gray"}">${m.enabled?"已启用":"已停用"}</span></td>
                      <td style="font-size:12px;color:var(--text-muted)">${m.desc}</td>
                      <td class="nowrap"><button class="btn btn-sm m5-toggle" data-i="${i}">${m.enabled?"停用":"启用"}</button></td>
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
          state.demandProfileVer += 1;
          state.demandProfileMode = state.demandProfileMode.includes("平稳") ? "促销敏感 + 周季节性" : "平稳季节 + 短周期波动";
          rerender(); toast(`DemandProfile 已保存（版本锁校验通过），v${state.demandProfileVer}`);
        };
        document.querySelectorAll(".m5-toggle").forEach(b => b.onclick = () => {
          const m = state.m5Models[Number(b.dataset.i)];
          m.enabled = !m.enabled; rerender(); toast(`${m.name} 已${m.enabled?"启用":"停用"}`);
        });
      }
    };
  }

  // ==================== M5b: Forecast Execution & Curve ====================
  if (pageId === "m5b") {
    const invRow = state.inventoryItems.find(i => i.id === "inv1");
    const mult = state.m5Horizon === 14 ? 1.95 : state.m5Horizon === 30 ? 4.1 : 1;
    const totalPred = Math.round(state.m5DailyPred.reduce((a, b) => a + b, 0) * mult);
    const refOrder = Math.max(0, totalPred + invRow.safety - invRow.avail);
    return {
      headerActions: [
        { label: "← 画像与模型注册", primary: false, onClick: () => goPage("m5a") },
        { label: "下一步：WAPE 回测评估 →", primary: true, onClick: () => goPage("m5c") }
      ],
      html: `
        <div class="card">
          <div class="filter-bar">
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
            <div><button class="btn btn-primary" id="m5RunBtn">▶ 运行预测 (排除当日未完结订单)</button></div>
          </div>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">未来 ${state.m5Horizon} 天预测总量</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${totalPred} 件</div>
            <div class="kpi-sub">${state.m5Model} 逐日向上取整</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">M0-3 联动实时可售库存</div>
            <div class="kpi-val">${invRow.avail} 件</div>
            <div class="kpi-sub">${invRow.shopName} · ${invRow.wh}</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">建议补货参考量</div>
            <div class="kpi-val" style="color:var(--green-text)">${refOrder} 件</div>
            <div class="formula-inline"><code>${totalPred} + ${invRow.safety}(安全) − ${invRow.avail}(可售) = ${refOrder}</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">误差带性质声明</div>
            <div class="kpi-val" style="color:var(--amber-text);font-size:17px;">历史绝对误差带</div>
            <div class="kpi-sub">非统计学 P80 置信区间</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">1</span> 真实销量预测曲线 · BAG-108（${state.m5Model} · 未来 ${state.m5Horizon} 天）</div>
            <span class="pill p-amber">阴影仅表示历史一步绝对误差带</span>
          </div>
          <svg viewBox="0 0 860 230" style="width:100%;height:auto;max-height:245px;display:block;background:#ffffff;border-radius:6px;">
            <line x1="50" y1="35" x2="820" y2="35" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="85" x2="820" y2="85" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="135" x2="820" y2="135" stroke="#f1f5f9" stroke-width="1"/>
            <line x1="50" y1="185" x2="820" y2="185" stroke="#e2e8f0" stroke-width="1"/>
            <polygon fill="#eff6ff" points="70,185 190,185 310,185 430,185 550,185 670,185 790,185 790,32 670,68 550,48 430,44 310,104 190,82 70,122" />
            <polyline fill="none" stroke="#2563eb" stroke-width="2" points="70,160 190,132 310,164 430,68 550,76 670,114 790,54" />
            ${[[70,160,state.m5DailyPred[0],"D+1"],[190,132,state.m5DailyPred[1],"D+2"],[310,164,state.m5DailyPred[2],"D+3"],[430,68,state.m5DailyPred[3],"D+4"],[550,76,state.m5DailyPred[4],"D+5"],[670,114,state.m5DailyPred[5],"D+6"],[790,54,state.m5DailyPred[6],"D+"+state.m5Horizon]].map(([x,y,v,d])=>`
              <circle cx="${x}" cy="${y}" r="3.5" fill="#2563eb" stroke="#ffffff" stroke-width="1.2"/>
              <text x="${x}" y="${y-10}" font-size="10.5" font-weight="600" fill="#1d4ed8" text-anchor="middle">${Math.round(v*(mult>1?1.1:1))}件</text>
              <text x="${x}" y="203" font-size="10.5" fill="#64748b" text-anchor="middle">${d}</text>
            `).join("")}
            <circle cx="58" cy="221" r="3" fill="#2563eb"/><text x="66" y="224" font-size="10" fill="#475569">蓝线：未来逐日预测</text>
            <rect x="190" y="216" width="10" height="8" rx="1.5" fill="#dbeafe"/><text x="205" y="224" font-size="10" fill="#64748b">浅蓝阴影：历史绝对误差带（非置信区间）</text>
          </svg>
        </div>
      `,
      bind: () => {
        document.getElementById("m5HorSel").onchange = (e) => { state.m5Horizon = Number(e.target.value); rerender(); };
        document.getElementById("m5ModSel").onchange = (e) => { state.m5Model = e.target.value; rerender(); };
        document.getElementById("m5RunBtn").onclick = () => toast(`已运行 ${state.m5Model} 预测未来 ${state.m5Horizon} 天，并同步更新 M6-2 智能补货参考`);
      }
    };
  }

  // ==================== M5c: WAPE Evaluation & Manual Override ====================
  if (pageId === "m5c") {
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
            <div class="kpi-label">滚动回测 wAPE（业务评级：${rating}）</div>
            <div class="kpi-val" style="color:var(--green-text)">${wape}%</div>
            <div class="formula-inline"><code>Σ|实际-预测| ÷ Σ实际 = ${sumAbs} ÷ ${sumActual} = ${wape}%</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">MAE（平均绝对误差）</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${mae} 件/天</div>
            <div class="formula-inline"><code>Σ|实际-预测| ÷ 天数 = ${sumAbs} ÷ ${state.m5Eval.length} = ${mae}</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Bias（整体偏差方向）</div>
            <div class="kpi-val" style="color:var(--purple-text)">${Number(bias)>=0?"+":""}${bias}%</div>
            <div class="formula-inline"><code>Σ(预测-实际) ÷ Σ实际 = ${sumDiff} ÷ ${sumActual} = ${bias}%</code></div>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-purple">1</span> 逐日回测明细与人工实际值修正（直接修改数字并保存，上方算式实时重算）</div>
            <button class="btn btn-primary btn-sm" id="recalcWapeBtn">保存人工修正并重算指标</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>原模型预测</th><th>真实实际销量 (可人工修正)</th><th>绝对误差 |实际-预测|</th><th>是否缺货日 (FR-FC-11)</th><th>数值来源</th></tr></thead>
              <tbody>
                ${state.m5Eval.map((r, i) => `
                  <tr>
                    <td class="nowrap">${r.date}</td>
                    <td class="nowrap"><strong>${r.pred} 件</strong></td>
                    <td class="nowrap"><input type="number" class="input m5-act-inp" data-i="${i}" value="${r.actual}" style="width:88px;"/></td>
                    <td class="nowrap">${Math.abs(r.pred - r.actual)} 件</td>
                    <td class="nowrap"><button class="btn btn-sm m5-so-btn" data-i="${i}">${r.stockout ? '<span style="color:var(--red-text)">是 (库存受限日)</span>' : "否 (正常售卖)"}</button></td>
                    <td class="nowrap"><span class="pill ${r.edited?"p-amber":"p-gray"}">${r.edited?"人工修正(保留原单值)":"OrderItem 原始采集"}</span></td>
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
          document.querySelectorAll(".m5-act-inp").forEach(inp => {
            const idx = Number(inp.dataset.i);
            const val = Math.max(0, Number(inp.value) || 0);
            if (val !== state.m5Eval[idx].actual) { state.m5Eval[idx].actual = val; state.m5Eval[idx].edited = true; }
          });
          rerender(); toast("已留痕保存人工修正，wAPE / MAE / Bias 公式已重算");
        };
      }
    };
  }

  // ==================== M6a: Normal Replenishment (img_082 faithful) ====================
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
        { label: "提交普通补货草案 (NORMAL) →", primary: true, onClick: () => {
          if (!canSubmit) { toast("仅「驾驶舱设计者/业务运营」可提交补货草案"); return; }
          if (missingRef) { toast("SRS FR-RP-04 拦截：非零淡旺季/活动调整必须填写报表或预算依据！"); return; }
          state.m6Plans.unshift({
            id: "RP-N-" + Date.now().toString().slice(-6), mode: "NORMAL", sku: invRow.sku,
            shop: `${invRow.shopName} · ${invRow.wh}`, qty: picked.qty,
            cash: "$" + Math.round(picked.qty * prod.cost).toLocaleString(),
            sig: "sig:norm..OK", submitter: state.role === "planner" ? "张运营" : state.role, status: "待主管审批"
          });
          goPage("m6c"); toast("普通补货计划已提交至 M6-3 独立普通计划队列");
        } }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 普通补货分支 (planning_mode = NORMAL · 对齐 img_082)：缺 M5 预测时允许用「近30天销量÷30 = 30件/天」代理；非零人工调节必须填依据，缺成本卡禁止提交！</span>
        </div>

        <div class="grid-5">
          <div class="kpi-card"><div class="kpi-label">日均需求 (30天代理)</div><div class="kpi-val">${adjDaily} 件/天</div><div class="formula-inline"><code>30 × (1 + ${state.m6NormalSeasonPct+state.m6NormalPromoPct}%)</code></div></div>
          <div class="kpi-card"><div class="kpi-label">M0-3 当前可售</div><div class="kpi-val">${invRow.avail} 件</div><div class="kpi-sub">${invRow.wh}</div></div>
          <div class="kpi-card"><div class="kpi-label">目标库存水位</div><div class="kpi-val" style="color:var(--blue-hover)">${targetInv} 件</div><div class="formula-inline"><code>${adjDaily}×(${state.m6NormalLeadDays}+${state.m6NormalSafetyDays})</code></div></div>
          <div class="kpi-card highlight-blue"><div class="kpi-label">理论缺口 (建议)</div><div class="kpi-val" style="color:var(--blue-hover)">${gap} 件</div><div class="formula-inline"><code>${targetInv}-${invRow.avail}-${state.m6NormalInTransit}</code></div></div>
          <div class="kpi-card"><div class="kpi-label">成本卡校验</div><div class="kpi-val" style="color:var(--green-text);font-size:17px;">$${prod.cost} (${prod.costVer} ✓)</div><div class="kpi-sub">占用现金 $${Math.round(picked.qty * prod.cost).toLocaleString()}</div></div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">2</span> 普通补货参数与人工调节依据 (img_082)</div></div>
            <div class="field"><label>商品 / 目的仓</label>
              <select id="m6nSku" class="select">
                <option value="FAN-203" ${state.m6NormalSku==="FAN-203"?"selected":""}>FAN-203 · Shopee TH (TH-WH-1)</option>
                <option value="BAG-108" ${state.m6NormalSku==="BAG-108"?"selected":""}>BAG-108 · TikTok US (US-WH-2)</option>
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
            ${missingRef ? '<div class="banner banner-red" style="font-size:11.5px;">校验失败：非零调整百分比必须填写依据编号！</div>' : ""}
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-green">3</span> 三方案定量比较 & 逐日基线代理明细</div></div>
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
        document.getElementById("m6nSeaRef").oninput = (e) => { state.m6NormalSeasonRef = e.target.value; };
        document.getElementById("m6nPro").oninput = (e) => { state.m6NormalPromoPct = Number(e.target.value)||0; rerender(); };
        document.getElementById("m6nProRef").oninput = (e) => { state.m6NormalPromoRef = e.target.value; };
        document.getElementById("m6nTr").oninput = (e) => { state.m6NormalInTransit = Math.max(0, Number(e.target.value)||0); rerender(); };
        document.querySelectorAll(".m6n-pick").forEach(b => b.onclick = () => { state.m6NormalPlanIdx = Number(b.dataset.i); rerender(); });
      }
    };
  }

  // ==================== M6b: Smart Replenishment (img_083 faithful + FORECAST_REQUIRED) ====================
  if (pageId === "m6b") {
    const canSubmit = state.role === "planner" || state.role === "approver";
    const hasForecast = state.m6SmartSku === "BAG-108"; // Only BAG-108 has saved M5 forecast!
    const invRow = state.inventoryItems.find(i => i.sku === state.m6SmartSku && i.shopMode === "REAL") || state.inventoryItems[0];
    const prod = state.masterProducts.find(p => p.sku === state.m6SmartSku) || state.masterProducts[0];
    const predDaily = 81;
    const covDays = (invRow.avail / predDaily).toFixed(1);
    const targetInv = Math.round(predDaily * (state.m6SmartLeadDays + state.m6SmartSafetyDays) * (state.m6SmartAllocPct / 100));
    const recQty = Math.max(0, targetInv - invRow.avail - state.m6SmartInTransit);

    return {
      headerActions: [
        { label: "← 对比普通补货 (M6-1)", primary: false, onClick: () => goPage("m6a") },
        { label: "提交智能补货计划 (SMART) →", primary: true, onClick: () => {
          if (!hasForecast) { toast("FORECAST_REQUIRED：缺未来预测，智能分支严格禁止提交！"); return; }
          if (!canSubmit) { toast("仅「驾驶舱设计者/业务运营」可提交补货计划"); return; }
          state.m6Plans.unshift({
            id: "RP-S-" + Date.now().toString().slice(-6), mode: "SMART", sku: invRow.sku,
            shop: `${invRow.shopName} · ${invRow.wh}`, qty: recQty,
            cash: "$" + Math.round(recQty * prod.cost).toLocaleString(),
            sig: "sig:smart..OK", submitter: state.role === "planner" ? "张运营" : state.role, status: "待主管审批"
          });
          goPage("m6c"); toast("智能补货计划已提交至 M6-3 独立智能计划队列");
        } }
      ],
      html: `
        <div class="card">
          <div class="filter-bar">
            <div class="filter-item">
              <label><span class="anno-tag t-blue">1</span> 选择分析 SKU（切到 COS-052 可实测缺预测拦截）</label>
              <select id="m6sSku" class="select">
                <option value="BAG-108" ${state.m6SmartSku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包 (已有 M5 CatBoost 未来预测 ✓)</option>
                <option value="COS-052" ${state.m6SmartSku==="COS-052"?"selected":""}>COS-052 · 焕亮保湿面霜 (无未来预测 · 测试 FORECAST_REQUIRED)</option>
                <option value="MAT-014" ${state.m6SmartSku==="MAT-014"?"selected":""}>MAT-014 · 桌面皮质收纳垫 (无未来预测 · 测试 FORECAST_REQUIRED)</option>
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
          </div>
        </div>

        ${!hasForecast ? `
          <div class="banner banner-red">
            <span><span class="anno-tag t-red">2</span> 阻断错误 [FORECAST_REQUIRED]：当前 SKU (${state.m6SmartSku}) 尚无覆盖未来日期的 M5 销量预测！智能补货严禁使用 30 天历史销量代理。</span>
            <button class="btn btn-primary btn-sm" id="gotoM5bFix">去 M5-2 生成未来预测 →</button>
          </div>
        ` : `
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">M5 日均预测需求</div><div class="kpi-val" style="color:var(--blue-hover)">${predDaily} 件/天</div><div class="kpi-sub">直接读取 CatBoost 未来曲线</div></div>
            <div class="kpi-card"><div class="kpi-label">当前可售 / 覆盖天数</div><div class="kpi-val" style="color:var(--red-text)">${invRow.avail} 件 (${covDays}天)</div><div class="formula-inline"><code>覆盖天数 = ${invRow.avail} ÷ ${predDaily} = ${covDays}天</code></div></div>
            <div class="kpi-card highlight-amber"><div class="kpi-label">预计库存风险</div><div class="kpi-val" style="color:var(--red-text)">高风险</div><div class="kpi-sub">覆盖 ${covDays}天 &lt; 交期 ${state.m6SmartLeadDays}天</div></div>
            <div class="kpi-card highlight-blue"><div class="kpi-label">智能建议采购量</div><div class="kpi-val" style="color:var(--blue-hover)">${recQty} 件</div><div class="formula-inline"><code>${predDaily}×(${state.m6SmartLeadDays}+${state.m6SmartSafetyDays})×${state.m6SmartAllocPct}% - ${invRow.avail} - ${state.m6SmartInTransit}</code></div></div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> M5 已保存未来逐日预测曲线（不调训练接口，仅只读消费）</div></div>
              <svg viewBox="0 0 540 185" style="width:100%;height:auto;max-height:190px;display:block;background:#ffffff;border-radius:6px;">
                <line x1="25" y1="40" x2="515" y2="40" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="25" y1="95" x2="515" y2="95" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="25" y1="150" x2="515" y2="150" stroke="#e2e8f0" stroke-width="1"/>
                <polyline fill="none" stroke="#2563eb" stroke-width="2" points="45,122 100,72 155,108 210,48 265,90 320,56 375,96 430,45 490,82" />
                <text x="45" y="169" font-size="10" fill="#64748b">今天 (${invRow.avail}件)</text>
                <text x="495" y="169" font-size="10" fill="#64748b" text-anchor="end">未来 28 天 (CatBoost)</text>
              </svg>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-title"><span class="anno-tag t-purple">3</span> 全仓 SKU 库存风险巡检表 (img_083)</div></div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>SKU</th><th>日均预测</th><th>可售库存</th><th>覆盖天数</th><th>状态</th></tr></thead>
                  <tbody>
                    <tr><td><strong>BAG-108 · US-WH-2</strong></td><td>81 件</td><td>${invRow.avail} 件</td><td>${covDays} 天</td><td><span class="pill p-red">高风险</span></td></tr>
                    <tr><td><strong>COS-052 · US-WH-1</strong></td><td>缺少预测</td><td>6 件</td><td>—</td><td><span class="pill p-amber">FORECAST_REQUIRED</span></td></tr>
                    <tr><td><strong>MAT-014 · US-WH-1</strong></td><td>缺少预测</td><td>120 件</td><td>—</td><td><span class="pill p-amber">缺少预测</span></td></tr>
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
        if (fixBtn) fixBtn.onclick = () => goPage("m5b");
      }
    };
  }

  // ==================== M6c: Plan Verification & Supervisor Approval ====================
  if (pageId === "m6c") {
    const canApprove = state.role === "approver";
    const list = state.m6Plans.filter(p => p.mode === state.m6ApprovalTab);
    return {
      headerActions: [
        { label: "去 M6-4 采购与收货凭证 →", primary: true, onClick: () => goPage("m6d") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><span class="anno-tag t-blue">1</span> 列表隔离 (AC-RP-01)：普通补货 (NORMAL) 与智能补货 (SMART) 通过 <code>planning_mode</code> 严格分开展示，互不混入；审批需提交人 ≠ 审批人。</span>
        </div>

        <div class="card">
          <div class="utabs" style="margin-bottom:14px;">
            <div class="utab ${state.m6ApprovalTab==="NORMAL"?"active":""} m6c-tab" data-m="NORMAL">普通补货计划 (NORMAL) <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="NORMAL").length}</span></div>
            <div class="utab ${state.m6ApprovalTab==="SMART"?"active":""} m6c-tab" data-m="SMART">智能补货计划 (SMART) <span class="utab-cnt">${state.m6Plans.filter(p=>p.mode==="SMART").length}</span></div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>计划编号</th><th>模式</th><th>SKU · 店铺/仓</th><th>采购件数</th><th>占用现金</th><th>签名重算</th><th>提交人</th><th>状态</th><th>主管审批操作</th></tr></thead>
              <tbody>
                ${list.map(p => {
                  const canAct = canApprove && p.status === "待主管审批";
                  return `
                    <tr>
                      <td class="nowrap"><strong>${p.id}</strong></td>
                      <td class="nowrap"><span class="pill ${p.mode==="SMART"?"p-purple":"p-blue"}">${p.mode}</span></td>
                      <td><strong>${p.sku}</strong><div style="font-size:11px;color:var(--text-soft)">${p.shop}</div></td>
                      <td class="nowrap"><strong>${p.qty} 件</strong></td>
                      <td class="nowrap">${p.cash}</td>
                      <td class="nowrap"><span class="pill p-green">${p.sig}</span></td>
                      <td class="nowrap">${p.submitter}</td>
                      <td class="nowrap"><span class="pill ${p.status==="已批准"?"p-green":p.status==="已驳回"?"p-red":"p-amber"}">${p.status}</span></td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-success m6c-act" data-id="${p.id}" data-act="已批准" ${!canAct?"disabled":""}>批准生成采购单</button>
                        <button class="btn btn-sm btn-danger m6c-act" data-id="${p.id}" data-act="已驳回" ${!canAct?"disabled":""}>驳回</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
          ${!canApprove ? '<div style="margin-top:10px;"><button class="btn btn-sm" id="m6cSwAppr">切为「主管 / 审批人」测试审批</button></div>' : ""}
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m6c-tab").forEach(t => t.onclick = () => { state.m6ApprovalTab = t.dataset.m; rerender(); });
        const sw = document.getElementById("m6cSwAppr");
        if (sw) sw.onclick = () => { state.role = "approver"; document.getElementById("roleSelect").value = "approver"; rerender(); };
        document.querySelectorAll(".m6c-act").forEach(b => b.onclick = () => {
          const p = state.m6Plans.find(x => x.id === b.dataset.id);
          p.status = b.dataset.act; rerender(); toast(`主管已完成审批：${p.id} → ${p.status}`);
        });
      }
    };
  }

  // ==================== M6d: Purchase Order & Multi-batch Receipt Vouchers ====================
  if (pageId === "m6d") {
    const canWh = state.role === "warehouse";
    return {
      headerActions: [
        { label: "去 M0-3 分店独立库存确认变化 →", primary: false, onClick: () => goPage("m0c") },
        { label: "+ 登记第3批到货凭证", primary: true, onClick: () => {
          if (!canWh) { toast("仅「采购 / 仓库 / 物流人员」可登记到货与质检凭证"); return; }
          state.m6Receipts.push({ po: "PO-20261119-03", sku: "FAN-203", batch: "第3批 (12-06)", planQty: 620, gotQty: 5, diff: 0, qc: "补齐短装·合格 #QC3", who: "赵仓管" });
          rerender(); toast("已登记第3批收货凭证（仅写履约台账，绝不自动改 M0-3 库存）");
        } }
      ],
      html: `
        <div class="banner banner-red">
          <span><span class="anno-tag t-red">1</span> 安全红线 (AC-RP-04)：采购单分批收货差异与质检凭证仅保存至履约审计表，绝不自动加减 M0-3 可售库存！实际库存变化必须由仓管在 M0-3 独立盘点完成。</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 采购履约与分批收货差异凭证台账（receipt_batches）</div>
            ${!canWh ? '<button class="btn btn-sm" id="m6dSwWh">切为「采购/仓库/物流人员」登记凭证</button>' : '<span class="pill p-green">warehouse 凭证权限已解锁 ✓</span>'}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>采购单号</th><th>SKU</th><th>收货批次</th><th>计划总数</th><th>本次实收</th><th>差异数量</th><th>质检/差异凭证</th><th>经办仓管</th></tr></thead>
              <tbody>
                ${state.m6Receipts.map(r => `
                  <tr>
                    <td class="nowrap"><strong>${r.po}</strong></td>
                    <td class="nowrap">${r.sku}</td>
                    <td class="nowrap">${r.batch}</td>
                    <td class="nowrap">${r.planQty} 件</td>
                    <td class="nowrap"><strong>${r.gotQty} 件</strong></td>
                    <td class="nowrap"><span class="pill ${r.diff<0?"p-red":"p-green"}">${r.diff}</span></td>
                    <td><span class="pill ${r.diff<0?"p-amber":"p-green"}">${r.qc}</span></td>
                    <td class="nowrap">${r.who}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        const sw = document.getElementById("m6dSwWh");
        if (sw) sw.onclick = () => { state.role = "warehouse"; document.getElementById("roleSelect").value = "warehouse"; rerender(); };
      }
    };
  }

  return null;
}
