export const SRS_ROLES = [
  { key: "approver", label: "主管 / 审批人", code: "approver", pill: "p-red", desc: "终审拍板：M1售后审批、M4选品测款/淘汰、M6补货批准、M7发布把关" },
  { key: "manager", label: "大屏浏览者 / 管理者", code: "viewer/manager", pill: "p-purple", desc: "全局管理：M8员工授权管理、M0店铺OAuth、M2看发布大屏、M3经营问数" },
  { key: "planner", label: "驾驶舱设计者 / 业务运营", code: "planner", pill: "p-blue", desc: "业务编排：M2驾驶舱设计发布、M5销量预测、M6补货测算提交草案" },
  { key: "bi_analyst", label: "数据分析 / BI 人员", code: "bi_analyst", pill: "p-blue", desc: "指标口径：M3指标绑定与Celery调度、M2指标配置复用、只读问数" },
  { key: "selector", label: "选品研究员", code: "selector", pill: "p-blue", desc: "选品初筛：M4三源数据接入、机会池初筛提交待选清单（不可自批）" },
  { key: "creator", label: "内容创作 / 审核人员", code: "creator", pill: "p-purple", desc: "内容生成：M7文案/主图/短视频生成与违禁词检查，提交审批" },
  { key: "warehouse", label: "采购 / 仓库 / 物流人员", code: "warehouse", pill: "p-green", desc: "仓储履约：M0-2独立库存校准同步、M6采购/质检/分批收货凭证登记" },
  { key: "cs", label: "客服", code: "cs", pill: "p-blue", desc: "一线接待：M1三栏工作台接管、双语回复、订单核验与提交售后工单" },
  { key: "mock_buyer", label: "买家（模拟）", code: "mock_buyer", pill: "p-gray", desc: "教学演示入口：仅可访问M1-3模拟买家入口发送英文咨询或投诉" },
];

const MATRIX_ROWS = [
  ["01 M8 员工名册与角色授权", "★ 本组权限", "★ 全局授权", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["02 M0-1 店铺 OAuth 与主数据", "○ 查看状态", "★ 店铺授权", "◆ 维护成本卡", "○ 只读统计", "○ 查商品基础", "○ 查商品卖点", "○ 查SKU规格", "○ 本店订单", "— 禁止"],
  ["03 M0-2 独立库存同步与盘点", "○ 查看水位", "○ 查看水位", "○ 只读参考", "○ 只读参考", "— 禁止", "— 禁止", "◆ 同步/校准", "— 禁止", "— 禁止"],
  ["04 M1-2 推荐商品库 (XLSX→向量)", "○ 查看目录", "— 禁止", "◆ 导入/维护", "— 禁止", "— 禁止", "○ 参考卖点", "— 禁止", "○ 检索Top-3", "— 禁止"],
  ["05 M1-3 模拟买家入站入口", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "○ 联调测试", "◆ 发英文消息"],
  ["06 M1-1 客服工作台与售后建单", "○ 查看会话", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "◆ 接管/建单", "— 禁止"],
  ["07 M1-4 售后工单审批 (行锁+SoD)", "✓ 批准/驳回", "○ 查统计", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止(不可自批)", "— 禁止"],
  ["08 M2-1 驾驶舱低代码设计发布", "○ 查看发布", "○ 查看发布", "◆ 编排/发布", "◆ 复用指标", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["09 M2-2 已发布经营大屏浏览", "○ 看大屏决策", "○ 浏览大屏", "○ 看运营效果", "○ 口径验证", "○ 看类目大盘", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["10 M3-1/2 指标调度与智能问数", "○ 只读问数", "○ 经营问数", "○ 只读问数", "◆ 维护+问数", "○ 只读查数", "— 禁止", "○ 库存只读", "○ 本域只读", "— 禁止"],
  ["11 M4-1/2 选品接入与初筛提交", "○ 查看机会池", "○ 查看进展", "— 禁止", "○ 核验口径", "◆ 接入+初筛", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["12 M4-2 选品测款终审拍板", "✓ 测款/淘汰", "○ 查看结论", "— 禁止", "— 禁止", "— 禁止(不可自批)", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["13 M5-1/2 销量预测与WAPE评估", "○ 复盘WAPE", "○ 看趋势", "◆ 画像/预测", "○ 回测评估", "○ 新品参考", "— 禁止", "○ 预测参考", "— 禁止", "— 禁止"],
  ["14 M6-1/2 补货测算与审批履约", "✓ 审批补货", "○ 看资金", "◆ 提交草案", "— 禁止", "— 禁止", "— 禁止", "◆ 采购/收货", "— 禁止", "— 禁止"],
  ["15 M7-1~4 文案图视频合规选用", "✓ 发布把关", "○ 查看成品", "○ 提卖点", "— 禁止", "○ 交接卖点", "◆ 生成+检查", "— 禁止", "— 禁止", "— 禁止"],
];

function badgeHtml(cell) {
  if (cell.startsWith("★")) return `<span class="pill p-purple">${cell}</span>`;
  if (cell.startsWith("✓")) return `<span class="pill p-red">${cell}</span>`;
  if (cell.startsWith("◆")) return `<span class="pill p-blue">${cell}</span>`;
  if (cell.startsWith("○")) return `<span class="pill p-gray">${cell}</span>`;
  return `<span style="color:#94a3b8;font-size:11.5px;">${cell}</span>`;
}

export function renderM8(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, rerender } = helpers;
  const canManage = state.role === "manager" || state.role === "approver";

  // ==================== M8a: Employee Roster & Role Assignment ====================
  if (pageId === "m8a") {
    const activeCount = state.employees.filter(e => e.active).length;
    const filtered = state.employees.filter(e => state.m8RoleFilter === "ALL" || e.role === state.m8RoleFilter);

    return {
      headerActions: [
        { label: "查看9角色权限矩阵 →", primary: false, onClick: () => goPage("m8b") },
        {
          label: "+ 新增员工与角色授权",
          primary: true,
          onClick: () => {
            if (!canManage) {
              state.auditLogs.unshift({
                time: new Date().toTimeString().slice(0, 8),
                actor: state.role,
                target: "新增员工",
                action: "权限拦截 (403 RBAC)",
                detail: "仅「大屏浏览者/管理者」或「主管/审批人」可新增员工授权",
                ok: false,
              });
              rerender();
              toast("权限不足：请切换为「大屏浏览者/管理者」或「主管/审批人」后再新增员工！");
              return;
            }
            openModal("新增员工与 SRS §1.5 角色授权", `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>员工工号</label><input id="newEmpId" class="input" value="EMP-${101 + state.employees.length}" /></div>
                <div class="field"><label>员工姓名</label><input id="newEmpName" class="input" placeholder="如：林晓" value="周宁" /></div>
              </div>
              <div class="field">
                <label>分配 SRS §1.5 业务角色（单人单岗 · 严格SoD）</label>
                <select id="newEmpRole" class="select">
                  ${SRS_ROLES.map(r => `<option value="${r.key}">${r.label} (${r.code})</option>`).join("")}
                </select>
              </div>
              <div id="newEmpRolePreview" class="banner banner-blue" style="margin-bottom:10px;font-size:12px;"></div>
              <div class="field"><label>负责店铺 / 数据域</label><select id="newEmpShop" class="select"><option>全部实盘店铺 (Shopee TH + TikTok US)</option><option>Shopee 泰国主店</option><option>TikTok Shop 美区</option><option>仅演示沙盒 (Mock)</option></select></div>
              <button class="btn btn-primary" id="saveNewEmpBtn" style="width:100%;justify-content:center;">确认建档并写入授权台账</button>
            `, () => {
              const sel = document.getElementById("newEmpRole");
              const updPreview = () => {
                const info = SRS_ROLES.find(r => r.key === sel.value);
                document.getElementById("newEmpRolePreview").textContent = `职责边界：${info.desc}`;
              };
              sel.onchange = updPreview;
              updPreview();
              document.getElementById("saveNewEmpBtn").onclick = () => {
                const id = document.getElementById("newEmpId").value.trim() || "EMP-NEW";
                const name = document.getElementById("newEmpName").value.trim() || "新员工";
                const role = sel.value;
                const shop = document.getElementById("newEmpShop").value;
                const roleObj = SRS_ROLES.find(r => r.key === role);
                state.employees.unshift({ id, name, role, shop, active: true, lastLogin: "刚刚建档" });
                state.auditLogs.unshift({
                  time: new Date().toTimeString().slice(0, 8),
                  actor: state.role,
                  target: `${name} (${id})`,
                  action: "新增员工授权",
                  detail: `授予角色「${roleObj.label}」，范围：${shop}`,
                  ok: true,
                });
                closeModal();
                rerender();
                toast(`已新增员工 ${name}，分配角色：${roleObj.label}`);
              };
            });
          }
        }
      ],
      html: `
        ${!canManage ? `
          <div class="banner banner-amber">
            <span><span class="anno-tag t-amber">1</span> 当前登录角色为 <strong>${SRS_ROLES.find(r=>r.key===state.role)?.label || state.role}</strong>（仅限只读查看或受限访问），调岗与新增员工需管理员授权。</span>
            <button class="btn btn-sm btn-primary" id="m8SwitchMgrBtn">切为「大屏浏览者/管理者」体验授权</button>
          </div>
        ` : `
          <div class="banner banner-green">
            <span><span class="anno-tag t-amber">1</span> 当前已解锁组织授权管理权限：可直接新增员工、切换 SRS §1.5 九大职位或停用离职账号（变更自动写审计日志）。</span>
          </div>
        `}

        <div class="grid-4">
          <div class="kpi-card">
            <div class="kpi-label"><span class="anno-tag t-blue">2</span> 在职 / 总员工数</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${activeCount} / ${state.employees.length} 人</div>
            <div class="kpi-sub">停用账号 ${state.employees.length - activeCount} 个</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">SRS §1.5 标准角色</div>
            <div class="kpi-val" style="color:var(--purple-text)">9 类岗位</div>
            <div class="kpi-sub">与需求规格书一字不差对齐</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">SoD 互斥冲突</div>
            <div class="kpi-val" style="color:var(--green-text)">0 冲突</div>
            <div class="kpi-sub">提交人与终审人严格隔离</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">审计留痕条数</div>
            <div class="kpi-val" style="color:var(--amber-text)">${state.auditLogs.length} 条</div>
            <div class="kpi-sub">授权变更与403拦截全记录</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">3</span> 按 SRS §1.5 九大角色筛选（点击查看各岗位人数与明细）</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <button class="btn btn-sm ${state.m8RoleFilter==="ALL"?"btn-primary":""} m8-rflt" data-r="ALL">全部 (${state.employees.length})</button>
            ${SRS_ROLES.map(r => {
              const cnt = state.employees.filter(e => e.role === r.key).length;
              return `<button class="btn btn-sm ${state.m8RoleFilter===r.key?"btn-primary":""} m8-rflt" data-r="${r.key}">${r.label} (${cnt})</button>`;
            }).join("")}
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>工号</th><th>员工姓名</th><th>SRS §1.5 职位角色 (可调岗)</th><th>底层权限组</th><th>店铺 / 数据范围</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${filtered.map(emp => {
                  const rObj = SRS_ROLES.find(r => r.key === emp.role) || SRS_ROLES[0];
                  return `
                    <tr>
                      <td><strong>${emp.id}</strong></td>
                      <td><strong>${emp.name}</strong><div style="font-size:11px;color:var(--text-soft)">最近登录: ${emp.lastLogin}</div></td>
                      <td>
                        <select class="select m8-emp-role" data-id="${emp.id}" ${!canManage ? "disabled" : ""} style="min-width:190px;">
                          ${SRS_ROLES.map(r => `<option value="${r.key}" ${emp.role===r.key?"selected":""}>${r.label}</option>`).join("")}
                        </select>
                      </td>
                      <td><span class="pill ${rObj.pill}">${rObj.code}</span></td>
                      <td style="font-size:12px;">${emp.shop}</td>
                      <td><span class="pill ${emp.active?"p-green":"p-red"}">${emp.active?"启用中":"已停用"}</span></td>
                      <td>
                        <button class="btn btn-sm ${emp.active?"btn-danger":"btn-success"} m8-emp-toggle" data-id="${emp.id}" ${!canManage ? "disabled" : ""}>
                          ${emp.active ? "停用账号" : "恢复启用"}
                        </button>
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
        const sw = document.getElementById("m8SwitchMgrBtn");
        if (sw) sw.onclick = () => {
          state.role = "manager";
          document.getElementById("roleSelect").value = "manager";
          rerender();
          toast("已切换为「大屏浏览者 / 管理者」，可进行员工授权操作");
        };
        document.querySelectorAll(".m8-rflt").forEach(b => b.onclick = () => {
          state.m8RoleFilter = b.dataset.r;
          rerender();
        });
        document.querySelectorAll(".m8-emp-role").forEach(sel => sel.onchange = (e) => {
          const emp = state.employees.find(x => x.id === sel.dataset.id);
          const oldLabel = SRS_ROLES.find(r => r.key === emp.role)?.label;
          emp.role = e.target.value;
          const newLabel = SRS_ROLES.find(r => r.key === emp.role)?.label;
          state.auditLogs.unshift({
            time: new Date().toTimeString().slice(0, 8),
            actor: state.role,
            target: `${emp.name} (${emp.id})`,
            action: "调整员工职位",
            detail: `${oldLabel} → ${newLabel}`,
            ok: true,
          });
          rerender();
          toast(`已将 ${emp.name} 调岗为「${newLabel}」`);
        });
        document.querySelectorAll(".m8-emp-toggle").forEach(b => b.onclick = () => {
          const emp = state.employees.find(x => x.id === b.dataset.id);
          emp.active = !emp.active;
          state.auditLogs.unshift({
            time: new Date().toTimeString().slice(0, 8),
            actor: state.role,
            target: `${emp.name} (${emp.id})`,
            action: emp.active ? "恢复账号" : "停用账号",
            detail: `账号状态变更为：${emp.active ? "启用中" : "已停用"}`,
            ok: true,
          });
          rerender();
          toast(`${emp.name} 账号已${emp.active ? "恢复启用" : "停用"}`);
        });
      }
    };
  }

  // ==================== M8b: 9-Role Permission Matrix & Audit Logs ====================
  if (pageId === "m8b") {
    const curRoleObj = SRS_ROLES.find(r => r.key === state.role) || SRS_ROLES[0];
    const activeRoleIdx = SRS_ROLES.findIndex(r => r.key === state.role);
    return {
      headerActions: [
        { label: "← 返回员工名册与角色分配", primary: false, onClick: () => goPage("m8a") },
        { label: "模拟触发一次越权拦截", primary: true, onClick: () => {
          state.auditLogs.unshift({
            time: new Date().toTimeString().slice(0, 8),
            actor: state.role,
            target: "M6-2 补货审批 RP-08",
            action: "SoD 拦截 (403)",
            detail: "提交人与审批人同为当前账号，触发职责分离保护",
            ok: false,
          });
          rerender();
          toast("已模拟记录一条 SoD 越权拦截审计日志");
        } }
      ],
      html: `
        <div class="banner banner-blue">
          <span><span class="anno-tag t-blue">1</span> 点击下方矩阵表头任意角色名称，即可即时切换当前演练角色！当前高亮列：<strong>${curRoleObj.label}</strong>（${curRoleObj.desc}）</span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> SRS §1.5 九大业务角色 × 15 项核心功能权限矩阵</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="pill p-purple">★ 治理授权</span>
              <span class="pill p-red">✓ 终审拍板</span>
              <span class="pill p-blue">◆ 业务操作</span>
              <span class="pill p-gray">○ 限域只读</span>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="min-width:190px;">功能模块 / 权限点</th>
                  ${SRS_ROLES.map((r, i) => `
                    <th style="cursor:pointer;min-width:105px;${i===activeRoleIdx?"background:#dbeafe;color:#1d4ed8;border-bottom:2px solid #2563eb;":""}" class="m8-col-switch" data-role="${r.key}" title="点击切换体验该角色">
                      ${r.label}
                      ${i===activeRoleIdx ? '<div style="font-size:10px;font-weight:800;">● 当前体验</div>' : '<div style="font-size:10px;color:#94a3b8;">点击切换</div>'}
                    </th>
                  `).join("")}
                </tr>
              </thead>
              <tbody>
                ${MATRIX_ROWS.map(row => `
                  <tr>
                    <td><strong>${row[0]}</strong></td>
                    ${row.slice(1).map((cell, ci) => `
                      <td style="${ci===activeRoleIdx?"background:#eff6ff;":""}">${badgeHtml(cell)}</td>
                    `).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title" style="color:var(--purple-text);"><span class="anno-tag t-purple">3</span> 角色变更与敏感越权拦截审计日志（rbac_audit_logs）</div>
            <span class="pill p-purple">不可篡改留痕</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>时间</th><th>操作人角色</th><th>目标对象</th><th>动作类型</th><th>详细说明</th><th>结果</th></tr></thead>
              <tbody>
                ${state.auditLogs.map(log => `
                  <tr>
                    <td>${log.time}</td>
                    <td><strong>${SRS_ROLES.find(r=>r.key===log.actor)?.label || log.actor}</strong></td>
                    <td>${log.target}</td>
                    <td><span class="pill ${log.ok?"p-blue":"p-red"}">${log.action}</span></td>
                    <td style="font-size:12px;">${log.detail}</td>
                    <td><span class="pill ${log.ok?"p-green":"p-red"}">${log.ok?"已记录":"已拦截"}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m8-col-switch").forEach(th => th.onclick = () => {
          state.role = th.dataset.role;
          document.getElementById("roleSelect").value = state.role;
          rerender();
          toast(`已切换体验角色为：${SRS_ROLES.find(r=>r.key===state.role)?.label}`);
        });
      }
    };
  }

  return null;
}
