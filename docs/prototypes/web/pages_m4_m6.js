import {
  ROLE_PERSON_NAMES, getProductImg, genDocId, nowDateTimeStr, appendAuditLog, runLocalForecastAlgo
} from "./state.js";

const M4_MODES = {
  balanced: { key: "balanced", label: "综合均衡推荐", wRev: 50, wTrend: 40, wMargin: 10, desc: "适合日常稳健选品：规模与增长并重，兼顾毛利" },
  revenue:  { key: "revenue",  label: "规模创收优先", wRev: 70, wTrend: 20, wMargin: 10, desc: "适合冲销量与资金回笼：优先挑选销售规模大的单品" },
  growth:   { key: "growth",   label: "高增趋势优先", wRev: 25, wTrend: 65, wMargin: 10, desc: "适合抓潜力爆款：优先挑选近期周环比飙升的新品" },
};

function calcM4NetSales(item) { return item.paidQty - item.refundQty; }
function calcM4NetRev(item) { return +(item.grossRev - item.discount - item.refundAmt).toFixed(2); }
function calcM4Score(item, maxRev, modeKey = "balanced") {
  const m = M4_MODES[modeKey] || M4_MODES.balanced;
  const revNorm = Math.min(1, calcM4NetRev(item) / (maxRev || 1));
  const trendNorm = Math.max(0, Math.min(1, item.trend / 60));
  if (item.marginKnown && item.margin !== null) {
    const marginNorm = Math.max(0, Math.min(1, item.margin / 25));
    const score = ((m.wRev / 100) * revNorm + (m.wTrend / 100) * trendNorm + (m.wMargin / 100) * marginNorm) * 100;
    return {
      score: Number(score.toFixed(1)),
      explain: `销量表现(${m.wRev}%) + 增长趋势(${m.wTrend}%) + 利润潜力(${m.wMargin}%)`,
      missingNote: ""
    };
  }
  const sumW = m.wRev + m.wTrend;
  const wR = Math.round((m.wRev / sumW) * 100);
  const wT = 100 - wR;
  const score = ((m.wRev / sumW) * revNorm + (m.wTrend / sumW) * trendNorm) * 100;
  return {
    score: Number(score.toFixed(1)),
    explain: `销量表现(${wR}%) + 增长趋势(${wT}%)`,
    missingNote: "利润数据暂缺，已按其余已知指标折算评分"
  };
}

export function renderM4_M6(pageId, state, helpers) {
  const { toast, goPage, openModal, openDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox } = helpers;

  // ==================== M4-1: 候选商品多源导入 ====================
  if (pageId === "m4a") {
    const canImportM4 = state.role === "selector" || state.role === "planner" || state.role === "approver";
    return {
      headerActions: [
        { label: "进入选品初筛与排行 →", primary: false, onClick: () => goPage("m4b") },
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
                        <thead><tr><th>行号</th><th>商品名称</th><th>8周净销量</th><th>成本状态</th><th>校验结果</th></tr></thead>
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
                    state.m4Tasks.unshift({ file: fname, kind, scope: "新增 2 款商品 · 美区", status: `已完成 (${kind})`, ok: true, tag, time: nowDateTimeStr() });
                    if (kind !== "仅演示数据") {
                      state.m4Pool.unshift({
                        sku: `SKU-${Math.floor(80000 + Math.random()*9000)}`, name: "便携旅行分装瓶套装",
                        region: "美区渠道", paidQty: 1180, refundQty: 40, grossRev: 41200, discount: 310, refundAmt: 480,
                        trend: 24.6, prevAvg: 115, currAvg: 143, marginKnown: kind === "内部实盘选品",
                        margin: kind === "内部实盘选品" ? 15.8 : null,
                        src: kind, srcCode, stage: kind === "内部实盘选品" ? "初筛候选" : "缺成本待补全",
                        submitter: "—", submitReason: "", approver: "", decisionReason: "", evidence: "",
                        missing: kind === "内部实盘选品" ? "" : "外购数据缺实际采购与头程成本", budget: "$1,100 (50件)", riskNote: "轻小件物流友好"
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
            <button class="btn btn-sm btn-primary" id="m4GotoPoolBtn">查看机会池 (${state.m4Pool.length} 款) →</button>
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

  // ==================== M4-2: 选品初筛与三视角评分排行 ====================
  if (pageId === "m4b") {
    const isSelector = state.role === "selector" || state.role === "planner";
    const activeMode = M4_MODES[state.m4Mode] || M4_MODES.balanced;

    const baseFiltered = state.m4Pool.filter(item => {
      const q = state.m4Search.trim().toLowerCase();
      const matchSearch = !q || item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      const matchSrc = state.m4SrcFilter === "ALL" || item.src === state.m4SrcFilter;
      const matchReg = state.m4RegionFilter === "ALL" || item.region.includes(state.m4RegionFilter);
      const matchRev = calcM4NetRev(item) >= state.m4MinRev;
      return matchSearch && matchSrc && matchReg && matchRev;
    });

    const maxRev = Math.max(...state.m4Pool.map(calcM4NetRev), 1);
    const tabFiltered = baseFiltered
      .filter(x => state.m4Tab === "ALL" || x.stage === state.m4Tab)
      .sort((a, b) => calcM4Score(b, maxRev, state.m4Mode).score - calcM4Score(a, maxRev, state.m4Mode).score);

    const rankedPool = [...state.m4Pool].sort((a, b) => calcM4Score(b, maxRev, state.m4Mode).score - calcM4Score(a, maxRev, state.m4Mode).score);
    const top3 = rankedPool.slice(0, 3);
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(tabFiltered.length / pageSize));
    if (state.m4Page > totalPages) state.m4Page = totalPages;
    const paged = tabFiltered.slice((state.m4Page - 1) * pageSize, state.m4Page * pageSize);

    const tabs = [
      { key: "ALL", label: "全部机会" },
      { key: "初筛候选", label: "待初筛评估" },
      { key: "缺成本待补全", label: "缺成本待补全" },
      { key: "已提交待审", label: "已送主管待审" },
      { key: "已批准测款", label: "已批准测款" },
      { key: "已淘汰", label: "已淘汰" },
    ];

    return {
      headerActions: [
        { label: "← 返回选品导入", primary: false, onClick: () => goPage("m4a") },
        { label: "去 M4-3 主管拍板页 →", primary: true, onClick: () => goPage("m4c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>按选品业务侧重点自动排名并核验利润数据，筛选出优质候选提交给主管拍板（缺利润率的商品不可直接批准投产）。</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">🎯 请选择您本次选品的推荐侧重点（系统将实时重排商品榜单）</div>
            <span class="pill p-blue">当前：${activeMode.label}</span>
          </div>
          <div class="grid-3" style="margin-bottom:12px;">
            ${Object.values(M4_MODES).map(m => `
              <div class="option-tile ${state.m4Mode===m.key?"active":""} m4-mode-opt" data-mode="${m.key}" style="text-align:left;padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:13.5px;">${m.label}</strong>
                  <span class="pill ${state.m4Mode===m.key?"p-blue":"p-gray"}">销${m.wRev}/涨${m.wTrend}/利${m.wMargin}</span>
                </div>
                <div style="font-size:12px;color:var(--text-soft);">${m.desc}</div>
              </div>
            `).join("")}
          </div>

          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🏆 本视角重点推荐前三名（点击任意卡片可展开详细评分依据）</div>
          <div class="grid-3">
            ${top3.map((item, idx) => {
              const sc = calcM4Score(item, maxRev, state.m4Mode);
              return `
                <div style="background:#fff;border:1px solid ${idx===0?"var(--blue)":"var(--border)"};border-radius:9px;padding:12px 14px;">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <img src="${getProductImg(item.sku)}" class="prod-thumb-img" alt="${item.name}"/>
                    <div style="min-width:0;flex:1;">
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span class="pill ${idx===0?"p-blue":"p-gray"}">第 ${idx+1} 名</span>
                        <strong style="color:var(--blue-hover);font-size:15px;">${sc.score} 分</strong>
                      </div>
                      <div style="font-weight:700;margin-top:3px;">${item.name}</div>
                      <div style="font-size:12px;color:var(--text-soft);">${item.sku} · ${item.src}</div>
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--text-muted);">
                    评分依据：${sc.explain}${sc.missingNote ? `<br/><span style="color:var(--amber-text);">${sc.missingNote}</span>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="card">
          <div class="filter-bar">
            <div class="filter-item"><label>搜索商品编码或名称</label><input id="m4SearchInp" class="input" placeholder="如：整理箱 / SKU-00515" value="${state.m4Search}"/></div>
            <div class="filter-item">
              <label>数据来源</label>
              <select id="m4SrcSel" class="select">
                <option value="ALL">全部来源</option>
                <option value="内部实盘选品" ${state.m4SrcFilter==="内部实盘选品"?"selected":""}>内部实盘选品</option>
                <option value="外购行业估算" ${state.m4SrcFilter==="外购行业估算"?"selected":""}>外购行业估算</option>
              </select>
            </div>
            <div class="filter-item">
              <label>销售渠道区域</label>
              <select id="m4RegSel" class="select">
                <option value="ALL">全部地区</option>
                <option value="美区" ${state.m4RegionFilter==="美区"?"selected":""}>美区</option>
                <option value="泰国" ${state.m4RegionFilter==="泰国"?"selected":""}>泰国</option>
              </select>
            </div>
            <div class="filter-item">
              <label>最低 8 周净收入</label>
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
                    <span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已提交待审"?"p-purple":item.stage==="初筛候选"?"p-blue":item.stage==="已淘汰"?"p-red":"p-amber"}">${item.stage}</span>
                    <strong style="color:var(--blue-hover);font-size:13.5px;">第 ${rankIdx} 名 · ${sc.score} 分</strong>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12.5px;">
                    <div>8周净收入：<strong>$${netRev.toLocaleString()}</strong></div>
                    <div>净销量：<strong>${netQty} 件</strong></div>
                    <div>周增长趋势：<strong style="color:${item.trend>=0?"var(--green-text)":"var(--red-text)"}">${item.trend>=0?"+":""}${item.trend}%</strong></div>
                    <div>利润率：<strong>${item.marginKnown?item.margin+"%":'<span style="color:var(--amber-text)">数据暂缺</span>'}</strong></div>
                  </div>

                  <details style="background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:7px 10px;font-size:12px;">
                    <summary style="cursor:pointer;font-weight:600;color:var(--blue-hover);">展开评分依据与计算说明</summary>
                    <div style="margin-top:5px;line-height:1.55;color:var(--text-muted);">
                      • <strong>评分构成：</strong>${sc.explain}<br/>
                      ${sc.missingNote ? `• <span style="color:var(--amber-text);"><strong>折算说明：</strong>${sc.missingNote}</span><br/>` : ""}
                      • <strong>风险核查：</strong>${item.riskNote}
                    </div>
                  </details>

                  ${item.missing ? `<div style="font-size:12px;color:var(--amber-text);">⚠ ${item.missing}</div>` : ""}

                  <div style="display:flex;gap:8px;margin-top:auto;padding-top:4px;flex-wrap:wrap;">
                    <button class="btn btn-sm m4-detail" data-sku="${item.sku}">查看明细核对</button>
                    ${(item.stage === "初筛候选" || item.stage === "缺成本待补全")
                      ? `<button class="btn btn-sm btn-primary m4-submit" data-sku="${item.sku}" ${!isSelector?"disabled":""} title="${!isSelector?"需要「选品研究员」或「业务运营」权限":""}">提交主管待审 →</button>`
                      : `<span style="font-size:12px;color:var(--text-soft);align-self:center;">已提交 (${item.submitter})</span>`}
                  </div>
                </div>
              `;
            }).join("")}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m4Page} / ${totalPages} 页 · 每页显示 3 条 · 共 ${tabFiltered.length} 款</span>
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
          toast(`已切换推荐视角：${M4_MODES[state.m4Mode].label}，榜单已重新排序`);
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
            title: `提交选品待主管终审 · ${item.sku} (${item.name})`,
            summary: `提交后将流转至 M4-3 由「主管 / 审批人」最终拍板。${item.marginKnown ? "" : "⚠️ 该款利润数据暂缺，主管页仅允许补采成本或淘汰，不可直接投产。"}`,
            confirmText: "确认提交待审",
            fieldsHtml: `
              <div class="field"><label>初筛推荐理由与风险核查结论（必填）*</label><textarea id="m4SubReason" class="textarea" placeholder="写明推荐依据（销售规模、增长斜率、专利核查结论等）..."></textarea></div>
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
          openDrawer(`${item.sku} · ${item.name}`, `${item.region} · ${item.src}`, `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <img src="${getProductImg(item.sku)}" class="prod-thumb-lg" alt="${item.name}"/>
              <div>
                <strong>${item.name}</strong>
                <div style="font-size:12px;color:var(--text-soft);margin-top:3px;">核查备注：${item.riskNote}</div>
              </div>
            </div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>经营核算明细：</strong><br/>
              1. 净销量 = 支付 ${item.paidQty} − 退款 ${item.refundQty} = <strong>${netQty} 件</strong><br/>
              2. 净收入 = 销售 $${item.grossRev.toLocaleString()} − 折扣 $${item.discount} − 退款 $${item.refundAmt} = <strong>$${netRev.toLocaleString()}</strong><br/>
              3. 周趋势 = 从周均 ${item.prevAvg} 件升至 ${item.currAvg} 件（<strong>${item.trend}%</strong>）<br/>
              4. 经营利润率 = ${item.marginKnown ? `<strong>${item.margin}%</strong>` : "<strong>未知（缺成本，不按0元估算）</strong>"}
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
        { label: "← 返回初筛排行", primary: false, onClick: () => goPage("m4b") },
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
                          8周净收入 <strong>$${netRev.toLocaleString()}</strong> · 周增长 <strong>${item.trend}%</strong> · 利润率 <strong>${item.marginKnown?item.margin+"%":"未知"}</strong> · 测款预算 <strong>${item.budget}</strong>
                        </div>
                        <div style="font-size:12.5px;margin-top:3px;">提交人：<strong>${item.submitter}</strong> ｜ 推荐理由：${item.submitReason || "—"}</div>
                        ${item.approver ? `<div style="font-size:12.5px;color:var(--green-text);margin-top:3px;">✓ 终审人：<strong>${item.approver}</strong> ｜ 意见：${item.decisionReason} ｜ 凭证：${item.evidence}</div>` : ""}
                        ${item.stage === "已批准测款" ? `<div style="font-size:12px;color:var(--blue-hover);margin-top:3px;">🔗 已创建 2 个下游任务：已加入 M5 销量预测池 & M7 商品内容创作队列</div>` : ""}
                      </div>
                    </div>

                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <button class="btn btn-sm btn-success m4c-decide" data-sku="${item.sku}" data-act="已批准测款" ${(!canDecide || !passHardGate)?"disabled":""} title="${!isApprover?"需主管权限":!passHardGate?"须满足内部实盘且利润率≥10%":""}">✓ 同意测款</button>
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
            <div class="formula-inline">算式：预测 ${totalPred} + 安全库存 ${invRow.safety} − 可售 ${invRow.avail} = ${refOrder} 件</div>
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
