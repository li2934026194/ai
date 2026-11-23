export function renderM4_M7(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, rerender } = helpers;

  // ==================== M4a: Selection 3-Source Ingestion ====================
  if (pageId === "m4a") {
    return {
      headerActions: [
        { label: "模拟上传含mock文件名(测试拦截)", primary: false, onClick: () => {
          state.m4Tasks.unshift({ file: "选品周数据_mock_未选演示.xlsx", kind: "待识别", scope: "解析中 (0条)", status: "失败：含mock标识不可作真实数据导入", ok: false, tag: "拦截" });
          rerender(); toast("已触发 Mock 文件拦截规则！");
        } },
        { label: "+ 导入商品周数据", primary: true, onClick: () => {
          state.m4Tasks.unshift({ file: "选品周数据_nov_batch2.xlsx", kind: "外购数据", scope: "300 SKU · US (2,400条)", status: "成功", ok: true, tag: "待评估" });
          rerender(); toast("已导入外购估算周事实 2,400 条");
        } }
      ],
      html: `
        <div class="banner banner-blue">
          <span>隔离说明：当前已入库 160 条模拟周事实。演示/外购估算数据绝不计入内部实际利润！</span>
          <button class="btn btn-primary btn-sm" id="gotoM4bBtn">进入选品初筛工作台 →</button>
        </div>

        <div class="grid-3">
          <div class="kpi-card" style="border-top:3px solid var(--amber);">
            <div style="display:flex;justify-content:space-between;"><strong><span class="anno-tag t-blue">1</span> 外购数据</strong><span class="pill p-amber">估算</span></div>
            <div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">地区销量、销售额、竞品与受众估算</div>
            <div class="kpi-val">10,000 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">2 个已登记数据源</div>
          </div>
          <div class="kpi-card" style="border-top:3px solid var(--green);">
            <div style="display:flex;justify-content:space-between;"><strong>内部数据</strong><span class="pill p-green">实际</span></div>
            <div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">订单、采购、生产、物流、广告与财务</div>
            <div class="kpi-val">0 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">1 个已登记数据源</div>
          </div>
          <div class="kpi-card" style="border-top:3px solid var(--blue);">
            <div style="display:flex;justify-content:space-between;"><strong>爬取公网数据</strong><span class="pill p-blue">观察</span></div>
            <div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">商品信息、价格、竞争与趋势线索</div>
            <div class="kpi-val">0 <span style="font-size:13px;font-weight:500;">条周事实</span></div>
            <div class="kpi-sub">0 个已登记数据源</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 接入任务记录（来源引用、SHA256文件哈希可追溯）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>任务 / 来源文件名</th><th>性质</th><th>覆盖范围</th><th>入库状态 / 校验说明</th><th>质量标签</th></tr></thead>
              <tbody>
                ${state.m4Tasks.map(t => `
                  <tr>
                    <td><strong>${t.file}</strong></td>
                    <td><span class="pill ${t.kind==="外购数据"?"p-amber":t.kind==="内部数据"?"p-green":t.kind==="演示Mock"?"p-blue":"p-gray"}">${t.kind}</span></td>
                    <td>${t.scope}</td>
                    <td><span class="pill ${t.ok?"p-green":"p-red"}">${t.status}</span></td>
                    <td>${t.tag}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("gotoM4bBtn").onclick = () => goPage("m4b");
      }
    };
  }

  // ==================== M4b: Selection Workflow (planner -> approver) ====================
  if (pageId === "m4b") {
    const isPlanner = state.role === "planner" || state.role === "admin";
    const isApprover = state.role === "approver" || state.role === "admin";
    return {
      headerActions: [
        { label: "← 选品数据接入", primary: false, onClick: () => goPage("m4a") },
        { label: isApprover ? "当前：approver 终审模式" : "切换为 approver 测试拍板", primary: true, onClick: () => {
          state.role = isApprover ? "planner" : "approver";
          document.getElementById("roleSelect").value = state.role;
          rerender();
          toast(`已切换角色为 ${state.role}`);
        } }
      ],
      html: `
        <div class="card" style="padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <strong><span class="anno-tag t-blue">1</span> 选品角色接力流：</strong>
            <span class="pill p-blue">① 机会池 AI 初筛 (planner)</span>
            <span>──提交──▶</span>
            <span class="pill p-purple">② 待选清单复核 (approver)</span>
            <span>──▶</span>
            <span class="pill p-green">③ 测款 / 上架 / 淘汰</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 阶段一：商品机会池（planner 初筛并提交进待选清单）</div>
            <span class="pill p-blue">当前操作角色：${state.role}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品 / SKU</th><th>平台/地区</th><th>8周预估净收入</th><th>趋势</th><th>数据来源</th><th>状态</th><th>planner 操作</th></tr></thead>
              <tbody>
                ${state.m4Pool.map((item, idx) => `
                  <tr>
                    <td><strong>${item.name}</strong><div style="font-size:11px;color:var(--text-soft)">${item.sku}</div></td>
                    <td>${item.region}</td>
                    <td><strong>${item.rev}</strong></td>
                    <td style="color:var(--green-text);font-weight:700;">${item.trend}</td>
                    <td><span class="pill p-amber">${item.src}</span></td>
                    <td><span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已提交待审"?"p-purple":item.stage==="已淘汰"?"p-red":"p-gray"}">${item.stage}</span></td>
                    <td>
                      ${item.stage === "仅研究估算" ? `<button class="btn btn-sm btn-primary m4-shortlist" data-i="${idx}" ${!isPlanner?"disabled":""}>加入待选清单 +</button>` : `<span style="color:var(--text-soft);font-size:12px;">已流转</span>`}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title" style="color:var(--purple-text);"><span class="anno-tag t-purple">3</span> 阶段二：待选清单与测款拍板（仅 approver 可做最终决策）</div>
            ${!isApprover ? '<span class="pill p-red">当前角色不可拍板（请点右上角切为 approver）</span>' : '<span class="pill p-green">approver 终审已解锁 ✓</span>'}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>待审商品 / SKU</th><th>初筛提交人</th><th>AI 评分与风险提示</th><th>建议测款预算</th><th>状态</th><th>approver 最终拍板</th></tr></thead>
              <tbody>
                ${state.m4Pool.filter(x => x.stage !== "仅研究估算").map(item => `
                  <tr>
                    <td><strong>${item.name}</strong> (${item.sku})</td>
                    <td>${item.submitter}</td>
                    <td>${item.score}分 · 外部估算，缺真实毛利</td>
                    <td>${item.budget}</td>
                    <td><span class="pill ${item.stage==="已批准测款"?"p-green":item.stage==="已淘汰"?"p-red":"p-purple"}">${item.stage}</span></td>
                    <td style="display:flex;gap:6px;">
                      <button class="btn btn-sm btn-success m4-decide" data-sku="${item.sku}" data-act="已批准测款" ${(!isApprover || item.stage!=="已提交待审")?"disabled":""}>批准测款</button>
                      <button class="btn btn-sm btn-danger m4-decide" data-sku="${item.sku}" data-act="已淘汰" ${(!isApprover || item.stage!=="已提交待审")?"disabled":""}>驳回淘汰</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m4-shortlist").forEach(b => b.onclick = () => {
          const item = state.m4Pool[Number(b.dataset.i)];
          item.stage = "已提交待审";
          item.submitter = state.role;
          rerender(); toast(`${item.sku} 已加入待选清单，等待 approver 终审拍板`);
        });
        document.querySelectorAll(".m4-decide").forEach(b => b.onclick = () => {
          const item = state.m4Pool.find(x => x.sku === b.dataset.sku);
          item.stage = b.dataset.act;
          rerender(); toast(`approver 已拍板：${item.sku} → ${item.stage}`);
        });
      }
    };
  }

  // ==================== M5a: Forecast DemandProfile & Models ====================
  if (pageId === "m5a") {
    return {
      headerActions: [
        { label: "执行销量预测与WAPE评估 →", primary: true, onClick: () => goPage("m5b") }
      ],
      html: `
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> SKU 需求画像（DemandProfile）与适用模式匹配</div>
            <button class="btn btn-sm" id="editDpBtn">编辑需求画像 (版本+1)</button>
          </div>
          <div class="grid-4">
            <div class="kpi-card"><div class="kpi-label">目标 SKU</div><div style="font-weight:700;margin-top:6px;">BAG-108 · 轻量通勤双肩包</div></div>
            <div class="kpi-card"><div class="kpi-label">真实历史点数</div><div style="font-weight:700;margin-top:6px;">96 天（有单 90 天）</div></div>
            <div class="kpi-card"><div class="kpi-label">需求画像模式</div><div style="font-weight:700;margin-top:6px;">${state.demandProfileMode}</div></div>
            <div class="kpi-card"><div class="kpi-label">画像版本号</div><div style="font-weight:700;margin-top:6px;color:var(--blue-hover)">v${state.demandProfileVer} (规则推荐 CatBoost)</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 版本化模型注册表（9 个内置算法 · 历史点门槛自动校验）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>模型 / 版本</th><th>模型族</th><th>建议历史</th><th>推理状态</th><th>当前状态</th><th>说明</th><th>操作</th></tr></thead>
              <tbody>
                ${state.m5Models.map((m, i) => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.family}</td>
                    <td>${m.minPts}</td>
                    <td><span class="pill ${m.ready==="已接入推理"?"p-blue":"p-amber"}">${m.ready}</span></td>
                    <td><span class="pill ${m.enabled?"p-green":"p-gray"}">${m.enabled?"已启用":"已停用"}</span></td>
                    <td style="font-size:12px;color:var(--text-muted)">${m.desc}</td>
                    <td><button class="btn btn-sm m5-toggle" data-i="${i}">${m.enabled?"停用":"启用"}</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("editDpBtn").onclick = () => {
          state.demandProfileVer += 1;
          state.demandProfileMode = state.demandProfileMode.includes("平稳") ? "促销敏感 + 周季节性" : "平稳季节 + 短周期波动";
          rerender(); toast(`DemandProfile 已保存，版本递增为 v${state.demandProfileVer}`);
        };
        document.querySelectorAll(".m5-toggle").forEach(b => b.onclick = () => {
          const m = state.m5Models[Number(b.dataset.i)];
          m.enabled = !m.enabled; rerender(); toast(`${m.name} 已${m.enabled?"启用":"停用"}`);
        });
      }
    };
  }

  // ==================== M5b: Forecast Execution & WAPE Evaluation ====================
  if (pageId === "m5b") {
    const totalActual = state.m5Eval.reduce((a, r) => a + r.actual, 0);
    const totalAbsErr = state.m5Eval.reduce((a, r) => a + Math.abs(r.pred - r.actual), 0);
    const wape = ((totalAbsErr / totalActual) * 100).toFixed(1);
    return {
      headerActions: [
        { label: "← 画像与模型注册", primary: false, onClick: () => goPage("m5a") },
        { label: "运行未来7天预测", primary: true, onClick: () => toast("已基于 96 天已完成订单重新执行 CatBoost-v1 预测（合计 626 件）") }
      ],
      html: `
        <div class="grid-4">
          <div class="kpi-card"><div class="kpi-label"><span class="anno-tag t-blue">1</span> 预测总销量 (7天)</div><div class="kpi-val" style="color:var(--blue-hover)">626 件</div><div class="kpi-sub">CatBoost-v1 逐日向上取整</div></div>
          <div class="kpi-card"><div class="kpi-label">滚动回测 wAPE</div><div class="kpi-val" style="color:var(--green-text)">${wape}%</div><div class="kpi-sub">随下方人工修正实时重算</div></div>
          <div class="kpi-card"><div class="kpi-label">建议补货量</div><div class="kpi-val" style="color:var(--purple-text)">633 件</div><div class="kpi-sub">可售 18 · 安全库存 25</div></div>
          <div class="kpi-card"><div class="kpi-label">误差带性质</div><div class="kpi-val" style="color:var(--amber-text);font-size:18px;">历史绝对误差带</div><div class="kpi-sub">非统计学置信区间</div></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 销量预测趋势 · BAG-108 (未来7天 + 绝对误差带)</div></div>
            <svg viewBox="0 0 500 200" style="width:100%;height:200px;background:#fafcff;border-radius:8px;border:1px solid #e2e8f0;">
              <polygon fill="#dbeafe" opacity="0.7" points="40,165 110,165 180,165 250,165 320,165 390,165 460,165 460,30 390,52 320,40 250,38 180,75 110,65 40,95" />
              <polyline fill="none" stroke="#2563eb" stroke-width="3" points="40,145 110,120 180,148 250,62 320,70 390,102 460,48" />
              ${[[40,145,"29"],[110,120,"63"],[180,148,"27"],[250,62,"138"],[320,70,"130"],[390,102,"88"],[460,48,"153"]].map(([x,y,v])=>`
                <circle cx="${x}" cy="${y}" r="4.5" fill="#2563eb"/><text x="${x}" y="${y-10}" font-size="11" font-weight="bold" fill="#1d4ed8" text-anchor="middle">${v}件</text>
              `).join("")}
              <text x="40" y="190" font-size="11" fill="#64748b">11-11</text>
              <text x="250" y="190" font-size="11" fill="#64748b">11-14</text>
              <text x="440" y="190" font-size="11" fill="#64748b">11-17</text>
            </svg>
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title" style="color:var(--purple-text);"><span class="anno-tag t-purple">3</span> WAPE 评估复盘与人工修正留痕</div></div>
            <div class="table-wrap" style="margin-bottom:10px;">
              <table>
                <thead><tr><th>日期</th><th>原预测</th><th>实际值 (可修正)</th><th>偏差</th><th>来源</th></tr></thead>
                <tbody>
                  ${state.m5Eval.map((r, i) => `
                    <tr>
                      <td>${r.date}</td>
                      <td>${r.pred}</td>
                      <td><input type="number" class="input m5-act-inp" data-i="${i}" value="${r.actual}" style="width:72px;padding:4px 6px;"/></td>
                      <td>${r.pred - r.actual}</td>
                      <td><span class="pill ${r.edited?"p-amber":"p-gray"}">${r.edited?"人工修正":"订单采集"}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary btn-sm" id="recalcWapeBtn">保存修正并重算 wAPE (保留原始订单值)</button>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("recalcWapeBtn").onclick = () => {
          document.querySelectorAll(".m5-act-inp").forEach(inp => {
            const idx = Number(inp.dataset.i);
            const val = Number(inp.value) || 0;
            if (val !== state.m5Eval[idx].actual) {
              state.m5Eval[idx].actual = val;
              state.m5Eval[idx].edited = true;
            }
          });
          rerender(); toast("已留痕保存人工修正并重算 wAPE");
        };
      }
    };
  }

  // ==================== M6a: Replenishment Steps 1-3 ====================
  if (pageId === "m6a") {
    return {
      headerActions: [
        { label: "下一步：提交审批与履约 →", primary: true, onClick: () => goPage("m6b") }
      ],
      html: `
        <div class="stepper-5">
          <div class="step-item done">1 需求预测与分支</div>
          <div class="step-item done">2 成本与交期参数</div>
          <div class="step-item active">3 三方案比较</div>
          <div class="step-item">4 提交与SoD审批</div>
          <div class="step-item">5 采购与收货凭证</div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 步骤 1-2：双分支输入选择 & 成本交期核验（FAN-203 · TH-WH-1）</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <button class="btn ${state.m6Branch==="normal"?"btn-primary":""}" id="m6BrNormal">● 普通补货（近30天销量代理 30件/天）</button>
            <button class="btn ${state.m6Branch==="smart"?"btn-primary":""}" id="m6BrSmart">● 智能补货（读取 M5 预测模型 + 多仓风险）</button>
          </div>
          <div style="font-size:12.5px;color:var(--text-muted);">
            当前可售：<strong>43件</strong> | 目标库存：<strong>660件</strong> | 理论缺口：<strong>617件</strong> | 单件采购价：<strong>$11.20 (成本卡 v2 ✓)</strong> | 完整交期：<strong>18天</strong>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 步骤 3：保守 / 平衡 / 激进 三方案定量比较（calculation_version: v3.1）</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>方案类型</th><th>建议采购件数</th><th>预计到货日</th><th>潜在失销风险</th><th>占用现金</th><th>增量利润贡献</th><th>选择</th></tr></thead>
              <tbody>
                ${state.m6Plans.map((p, i) => `
                  <tr style="${state.m6SelectedPlan===i?"background:#eff6ff":""}">
                    <td><strong>${p.name}</strong></td>
                    <td><strong>${p.qty} 件</strong></td>
                    <td>2026-12-07</td>
                    <td>${p.lost}</td>
                    <td>${p.cash}</td>
                    <td style="color:var(--green-text);font-weight:700;">${p.profit}</td>
                    <td><button class="btn btn-sm ${state.m6SelectedPlan===i?"btn-primary":""} m6-pick" data-i="${i}">${state.m6SelectedPlan===i?"已选中 ✓":"选为草案"}</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m6BrNormal").onclick = () => { state.m6Branch = "normal"; rerender(); };
        document.getElementById("m6BrSmart").onclick = () => { state.m6Branch = "smart"; rerender(); toast("已切换至智能补货分支（同步读取 M5 预测与多仓覆盖天数）"); };
        document.querySelectorAll(".m6-pick").forEach(b => b.onclick = () => { state.m6SelectedPlan = Number(b.dataset.i); rerender(); });
      }
    };
  }

  // ==================== M6b: Replenishment Steps 4-5 ====================
  if (pageId === "m6b") {
    const plan = state.m6Plans[state.m6SelectedPlan];
    const canApprove = state.role === "approver" || state.role === "admin";
    const canWh = state.role === "warehouse" || state.role === "admin";
    const sodSame = state.m6Submitter === state.role;
    return {
      headerActions: [
        { label: "← 返回步骤1-3三方案比较", primary: false, onClick: () => goPage("m6a") }
      ],
      html: `
        <div class="banner banner-red">
          <span><span class="anno-tag t-red">1</span> 安全红线：采购单分批收货差异与质检凭证仅写入履约审计台账，绝不自动改写仓库真实可售库存（见 M0 独立库存页）。</span>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">2</span> 步骤 4：计划签名校验与 SoD 审批</div></div>
            <div style="font-size:12.5px;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
              <div>计划编号：<strong>RP-20261119-08 (v1)</strong></div>
              <div>选定方案：<strong>${plan.name} · ${plan.qty} 件 · ${plan.cash}</strong></div>
              <div>参数快照签名：<strong>sig:8a4f..重算校验一致 ✓</strong></div>
              <div>数量口径：<strong>RULE_FIXED (AI仅生成摘要)</strong></div>
              <div>提交人：<strong>${state.m6Submitter}</strong> | 当前审批角色：<strong>${state.role}</strong></div>
              <div>审批状态：<span class="pill ${state.m6Status==="已批准"?"p-green":"p-amber"}">${state.m6Status}</span></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-success btn-sm" id="m6ApproveBtn" ${(!canApprove || sodSame || state.m6Status==="已批准")?"disabled":""}>批准并生成采购单 (approver)</button>
              <button class="btn btn-sm" id="m6SwitchApprBtn">切为 approver 体验审批</button>
            </div>
          </div>

          <div class="card card-blue">
            <div class="card-header">
              <div class="card-title" style="color:var(--blue-hover);"><span class="anno-tag t-purple">3</span> 步骤 5：采购履约与分批收货差异凭证</div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">采购单：<strong>PO-20261119-03</strong> | 物流单号：<strong>SF-INT-992018</strong></div>
            <div class="table-wrap" style="margin-bottom:10px;">
              <table>
                <thead><tr><th>收货批次</th><th>实收 / 差异</th><th>质检凭证</th><th>仓管经办</th></tr></thead>
                <tbody>
                  ${state.m6Receipts.map(r => `
                    <tr><td>${r.batch}</td><td>${r.qty}</td><td><span class="pill p-green">${r.qc}</span></td><td>${r.who}</td></tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary btn-sm" id="m6AddReceiptBtn" ${!canWh?"disabled":""}>登记第3批到货凭证 (需 warehouse 角色)</button>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m6SwitchApprBtn").onclick = () => {
          state.role = "approver";
          document.getElementById("roleSelect").value = "approver";
          rerender();
        };
        const ab = document.getElementById("m6ApproveBtn");
        if (ab) ab.onclick = () => { state.m6Status = "已批准"; rerender(); toast("SoD 校验通过，已批准并生成采购单 PO-20261119-03"); };
        const rb = document.getElementById("m6AddReceiptBtn");
        if (rb) rb.onclick = () => {
          state.m6Receipts.push({ batch: "第3批 (12-06)", qty: "5件 (补齐短装)", qc: "质检合格 #QC3", who: state.role });
          rerender(); toast("已登记收货凭证（仅留痕，不自动改写 M0 仓库库存）");
        };
      }
    };
  }

  // ==================== M7a: Listing Copywriting ====================
  if (pageId === "m7a") {
    return {
      headerActions: [
        { label: "去 AI 商品主图页 →", primary: false, onClick: () => goPage("m7b") },
        { label: "✨ 立即生成文案", primary: true, onClick: () => { state.m7CopyGenCount += 1; rerender(); toast("已按任务卡约束生成 5 组多语言 Listing 文案！"); } }
      ],
      html: `
        <div class="stepper">
          <div class="step-item done">① 输入产品与约束</div>
          <div class="step-item done">② 生成多版本文案</div>
          <div class="step-item active">③ 合规审核与选用</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 选择商品与创作约束</div></div>
            <div class="field">
              <label>选择商品</label>
              <select id="m7ProdSel" class="select">
                <option ${state.m7Sku==="MAT-014"?"selected":""} value="MAT-014">MAT-014 · 桌面收纳垫</option>
                <option ${state.m7Sku==="BAG-108"?"selected":""} value="BAG-108">BAG-108 · 轻量通勤双肩包</option>
                <option ${state.m7Sku==="FAN-203"?"selected":""} value="FAN-203">FAN-203 · 便携静音循环扇</option>
              </select>
            </div>
            <div class="field">
              <label>文案生成类型</label>
              <div class="grid-2" style="gap:8px;">
                ${["商品标题", "五点描述", "广告文案", "搜索关键词"].map(tp => `
                  <div class="option-tile ${state.m7CopyType===tp?"active":""} m7-type" data-t="${tp}">
                    <strong style="font-size:12.5px;">${tp}</strong>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>目标平台</label><select class="select"><option>Amazon US</option><option>Shopee TH</option><option>TikTok Shop</option></select></div>
              <div class="field"><label>语言</label><select class="select"><option>English (US)</option><option>简体中文</option><option>Thai (TH)</option></select></div>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">
              <div style="font-weight:700;font-size:12.5px;margin-bottom:6px;"><span class="anno-tag t-green">2</span> Listing 任务卡 · 批量草稿约束</div>
              <div class="field"><label>必用术语（逗号分隔）</label><input id="m7MustTerm" class="input" value="${state.m7MustTerm}"/></div>
              <div class="field"><label>排除词 / 禁忌词</label><input id="m7BanTerm" class="input" value="${state.m7BanTerm}"/></div>
            </div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;">✨ 生成营销文案 (第${state.m7CopyGenCount}版)</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-purple">3</span> 生成结果 · ${state.m7Sku} ${state.m7CopyType}</div>
              <span class="pill p-green">● 生成完成</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              ${["商品标题 (5)", "五点描述 (5)", "搜索关键词", "完整描述"].map(tb => `
                <button class="btn btn-sm ${state.m7ResultTab===tb?"btn-primary":""} m7-rtab" data-tab="${tb}">${tb}</button>
              `).join("")}
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
              ${[1, 2, 3, 4].map(i => {
                const txt = `${i}. ${state.m7Sku} | ${state.m7MustTerm} Premium Design for Office & Home (Draft v${state.m7CopyGenCount}-${i})`;
                return `
                  <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div>
                      <div style="font-weight:700;">${txt}</div>
                      <div style="font-size:11.5px;color:var(--green-text);margin-top:3px;">术语检查：${state.m7MustTerm} ✓ · 禁忌词(${state.m7BanTerm})命中：0 处 ✓</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn-sm m7-copy-btn">复制</button>
                      <button class="btn btn-primary btn-sm m7-pick-copy" data-txt="${txt}">使用并检查</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
            <div class="banner banner-blue">
              <span>文案完成后，点击独立页面按钮继续生成视觉资产：</span>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-sm" id="m7JumpImg">AI 商品主图生成 →</button>
                <button class="btn btn-sm" id="m7JumpVid">AI 短视频生成 →</button>
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m7ProdSel").onchange = (e) => { state.m7Sku = e.target.value; rerender(); };
        document.querySelectorAll(".m7-type").forEach(el => el.onclick = () => { state.m7CopyType = el.dataset.t; rerender(); });
        document.querySelectorAll(".m7-rtab").forEach(el => el.onclick = () => { state.m7ResultTab = el.dataset.tab; rerender(); });
        document.getElementById("m7GenCopyBtn").onclick = () => {
          state.m7MustTerm = document.getElementById("m7MustTerm").value;
          state.m7BanTerm = document.getElementById("m7BanTerm").value;
          state.m7CopyGenCount += 1; rerender(); toast("已生成新一轮合规文案草稿");
        };
        document.querySelectorAll(".m7-copy-btn").forEach(b => b.onclick = () => toast("已复制到剪贴板"));
        document.querySelectorAll(".m7-pick-copy").forEach(b => b.onclick = () => {
          state.m7SelectedCopy = b.dataset.txt;
          goPage("m7d"); toast("已选用文案并跳转至【合规审核与选用】页");
        });
        document.getElementById("m7JumpImg").onclick = () => goPage("m7b");
        document.getElementById("m7JumpVid").onclick = () => goPage("m7c");
      }
    };
  }

  // ==================== M7b: ComfyUI Image Generation ====================
  if (pageId === "m7b") {
    return {
      headerActions: [
        { label: "← Listing 文案生成", primary: false, onClick: () => goPage("m7a") },
        { label: "去 AI 短视频生成 →", primary: false, onClick: () => goPage("m7c") },
        { label: "✨ 立即生成商品图片", primary: true, onClick: () => { state.m7ImgSeed += 1; rerender(); toast("ComfyUI 图像工作流已出图 4 张（已校验 image/png）"); } }
      ],
      html: `
        <div class="stepper">
          <div class="step-item done">① 输入商品与图型</div>
          <div class="step-item done">② ComfyUI 队列出图</div>
          <div class="step-item active">③ MIME 校验与选用</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 主图生成参数配置</div></div>
            <div class="field"><label>目标商品</label><input class="input" readonly value="${state.m7Sku} · 桌面收纳垫" /></div>
            <div class="field">
              <label>图像生成类型</label>
              <div class="grid-2" style="gap:8px;">
                ${["白底主图", "家居场景", "细节特写", "尺寸信息图"].map(it => `
                  <div class="option-tile ${state.m7ImgType===it?"active":""} m7-itype" data-t="${it}">
                    <strong style="font-size:12.5px;">${it}</strong>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="field"><label>ComfyUI 工作流版本</label><select class="select"><option>Amazon 白底主图 · v3 (ComfyUI)</option><option>家居场景光影 · v2</option></select></div>
            <div class="field"><label><span class="anno-tag t-green">2</span> Prompt 规范要求</label><textarea class="textarea">纯白背景 (#FFFFFF)，产品占画面 85%，高级柔和棚拍阴影，无多余文字与水印，符合 Amazon 主图规范。</textarea></div>
            <button class="btn btn-primary" id="m7GenImgBtn" style="width:100%;justify-content:center;">✨ 生成商品图片 (ComfyUI)</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-purple">3</span> 生成结果（4 宫格主图预览 · MIME 与分辨率校验）</div>
              <span class="pill p-green">4张已就绪 · Seed #${state.m7ImgSeed}</span>
            </div>
            <div class="grid-2">
              ${["方案 A · 标准纯白棚拍", "方案 B · 45° 俯角质感", "方案 C · 极简微阴影款", "方案 D · 细节缝线特写"].map((title, idx) => `
                <div class="media-card ${state.m7PickedImgIdx===idx?"picked":""}">
                  <div class="media-preview" style="background:${idx===1?"#f1f5f9":"#ffffff"};">
                    <svg viewBox="0 0 180 110" style="width:150px;height:100px;">
                      <rect x="25" y="20" width="130" height="72" rx="10" fill="${idx===2?"#475569":"#64748b"}" />
                      <rect x="33" y="28" width="114" height="56" rx="6" fill="none" stroke="#cbd5e1" stroke-dasharray="4 3" />
                      <text x="90" y="60" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold">${state.m7Sku} · #${idx+1}</text>
                    </svg>
                  </div>
                  <div style="font-weight:700;font-size:13px;">${title}</div>
                  <div style="font-size:11.5px;color:var(--green-text);margin:3px 0 8px;">image/png · 2000×2000px · 无水印 ✓</div>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm ${state.m7PickedImgIdx===idx?"btn-primary":""} m7-pick-img" data-i="${idx}">${state.m7PickedImgIdx===idx?"已选中入库 ✓":"选用此图"}</button>
                    <button class="btn btn-sm m7-dl-img">下载 PNG</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m7-itype").forEach(el => el.onclick = () => { state.m7ImgType = el.dataset.t; rerender(); });
        document.getElementById("m7GenImgBtn").onclick = () => { state.m7ImgSeed += 1; rerender(); toast("已生成新一批 4 宫格主图"); };
        document.querySelectorAll(".m7-pick-img").forEach(b => b.onclick = () => { state.m7PickedImgIdx = Number(b.dataset.i); rerender(); toast("已将主图加入选用台账"); });
        document.querySelectorAll(".m7-dl-img").forEach(b => b.onclick = () => toast("MIME magic-byte 校验为 image/png，已触发二进制流下载"));
      }
    };
  }

  // ==================== M7c: ComfyUI Short Video ====================
  if (pageId === "m7c") {
    return {
      headerActions: [
        { label: "← AI 商品主图生成", primary: false, onClick: () => goPage("m7b") },
        { label: "前往合规审核与选用 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        <div class="stepper">
          <div class="step-item done">① 输入视频脚本</div>
          <div class="step-item done">② SVD / /sync 渲染</div>
          <div class="step-item active">③ MP4 二进制校验</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 短视频生成参数（img_097）</div></div>
            <div class="field"><label>目标商品</label><input class="input" readonly value="${state.m7Sku} · TikTok Shop / Amazon" /></div>
            <div class="field">
              <label>视频脚本类型</label>
              <div class="grid-2" style="gap:8px;">
                ${["产品展示", "开箱测评", "场景种草", "卖点快剪"].map(vt => `
                  <div class="option-tile ${state.m7VidType===vt?"active":""} m7-vtype" data-t="${vt}">
                    <strong style="font-size:12.5px;">${vt}</strong>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="field"><label>视频工作流版本</label><select class="select"><option>SVD 图生视频 · 15s 竖屏工作流</option><option>未配置节点测试(触发诚实报错)</option></select></div>
            <div class="banner banner-amber" style="margin-bottom:10px;font-size:11.8px;font-weight:500;">
              能力边界：未配置 ComfyUI 视频节点时直接返回真实错误，绝不伪造播放视频。
            </div>
            <button class="btn btn-primary" id="m7GenVidBtn" style="width:100%;justify-content:center;">▶ 生成短视频 (ComfyUI /sync)</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-green">2</span> 短视频预览与 /sync 状态轮询</div>
              <button class="btn btn-sm" id="m7PollVidBtn">刷新 /sync 进度</button>
            </div>
            <div class="grid-2">
              <div class="media-card picked">
                <div class="media-preview dark">
                  <div style="font-size:24px;">▶</div>
                  <strong>15s 竖屏 MP4 (${state.m7VidType})</strong>
                  <span style="font-size:11px;color:#94a3b8">1080 × 1920 · 30fps</span>
                </div>
                <div style="font-weight:700;">片段 1 · 产品 360° 展示</div>
                <div style="font-size:11.5px;color:var(--green-text);margin:4px 0 8px;">video/mp4 校验通过 · 已就绪 ✓</div>
                <button class="btn btn-primary btn-sm" id="m7UseVidBtn">选用此视频并去审核 →</button>
              </div>
              <div class="media-card">
                <div class="media-preview dark">
                  <div style="font-size:20px;">⏳ ${state.m7VidProgress}%</div>
                  <strong>12s 桌面防水泼溅实测</strong>
                  <span style="font-size:11px;color:#94a3b8">/sync 队列渲染中</span>
                </div>
                <div style="font-weight:700;">片段 2 · 场景防水实测</div>
                <div style="font-size:11.5px;color:var(--amber-text);margin:4px 0 8px;">点击右上角「刷新 /sync 进度」推进渲染</div>
                <button class="btn btn-sm" disabled>${state.m7VidProgress===100?"已就绪":"渲染中…"}</button>
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m7-vtype").forEach(el => el.onclick = () => { state.m7VidType = el.dataset.t; rerender(); });
        document.getElementById("m7GenVidBtn").onclick = () => { state.m7VidProgress = 68; rerender(); toast("已下发 ComfyUI 视频任务，开启 /sync 轮询"); };
        document.getElementById("m7PollVidBtn").onclick = () => { state.m7VidProgress = 100; rerender(); toast("/sync 返回 COMPLETED：片段2 MP4 已就绪！"); };
        document.getElementById("m7UseVidBtn").onclick = () => goPage("m7d");
      }
    };
  }

  // ==================== M7d: Content Compliance & Final Selection ====================
  if (pageId === "m7d") {
    return {
      headerActions: [
        { label: "← 返回文案页", primary: false, onClick: () => goPage("m7a") },
        { label: "写入平台选用台账", primary: true, onClick: () => { state.m7Published = true; rerender(); toast("已写入选用记录（不直接推送线上店铺）"); } }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">2</span> 发布边界声明：确认选用仅在系统内保存「已选用」状态与导出包，绝不直接改写线上 Amazon / TikTok 商品。</span>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-purple">1</span> 跨模态资产合规复检与选用台账（${state.m7Sku}）</div>
            <span class="pill ${state.m7Published?"p-green":"p-blue"}">${state.m7Published?"已写入平台选用台账 ✓":"待确认选用"}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>内容资产类型</th><th>当前已选版本</th><th>合规 / MIME 校验结果</th><th>选用状态</th><th>快速调整</th></tr></thead>
              <tbody>
                <tr><td><strong>Listing 文案</strong></td><td>${state.m7SelectedCopy}</td><td><span class="pill p-green">0违禁词 · 必用词齐备 ✓</span></td><td><span class="pill p-blue">已选用</span></td><td><button class="btn btn-sm" id="backM7a">更换文案</button></td></tr>
                <tr><td><strong>商品主图</strong></td><td>方案 #${state.m7PickedImgIdx+1} · 2000×2000 PNG</td><td><span class="pill p-green">image/png · 无水印 ✓</span></td><td><span class="pill p-blue">已选用</span></td><td><button class="btn btn-sm" id="backM7b">更换主图</button></td></tr>
                <tr><td><strong>带货短视频</strong></td><td>片段1 · 15s 竖屏 MP4 (${state.m7VidType})</td><td><span class="pill p-green">video/mp4 · 1080×1920 ✓</span></td><td><span class="pill p-blue">已选用</span></td><td><button class="btn btn-sm" id="backM7c">更换视频</button></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("backM7a").onclick = () => goPage("m7a");
        document.getElementById("backM7b").onclick = () => goPage("m7b");
        document.getElementById("backM7c").onclick = () => goPage("m7c");
      }
    };
  }

  return null;
}
