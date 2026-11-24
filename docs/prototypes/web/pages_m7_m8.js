import {
  API_BASE, SRS_ROLES, getProductImg, genDocId, nowDateTimeStr, appendAuditLog
} from "./state.js";

const MATRIX_ROWS = [
  ["01 M8 员工名册与角色授权", "★ 本组权限", "★ 全局授权", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["02 M0-1 店铺 OAuth 与主数据", "○ 查看状态", "★ 店铺授权", "◆ 维护成本卡", "○ 只读统计", "○ 查商品基础", "○ 查商品卖点", "○ 查SKU规格", "○ 本店订单", "— 禁止"],
  ["03 M0-3 分店独立库存校准", "○ 查看水位", "○ 查看水位", "○ 只读参考", "○ 只读参考", "— 禁止", "— 禁止", "◆ 盘点/校准", "— 禁止", "— 禁止"],
  ["04 M1-2 客服导购商品库 (XLSX→向量)", "○ 查看目录", "— 禁止", "◆ 导入/维护", "— 禁止", "— 禁止", "○ 参考卖点", "— 禁止", "○ 检索Top-3", "— 禁止"],
  ["05 M1-3 模拟买家入站入口", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "○ 联调测试", "◆ 发英文消息"],
  ["06 M1-1 客服工作台与售后建单", "○ 查看会话", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "◆ 接管/建单", "— 禁止"],
  ["07 M1-4 售后工单审批 (行锁+SoD)", "✓ 批准/驳回", "○ 查统计", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁自批", "— 禁止"],
  ["08 M2-1 驾驶舱低代码设计发布", "○ 查看发布", "○ 查看发布", "◆ 编排/发布", "◆ 复用指标", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["09 M2-2 已发布经营大屏浏览", "○ 看大屏决策", "○ 浏览大屏", "○ 看运营效果", "○ 口径验证", "○ 看类目大盘", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["10 M3-1/2 指标调度与智能问数", "○ 只读问数", "○ 经营问数", "○ 只读问数", "◆ 维护+问数", "○ 只读查数", "— 禁止", "○ 库存只读", "○ 本域只读", "— 禁止"],
  ["11 M4-1/2 选品接入与初筛提交", "○ 查看机会池", "○ 查看进展", "— 禁止", "○ 核验口径", "◆ 接入+初筛", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["12 M4-3 选品测款终审拍板", "✓ 测款/淘汰", "○ 查看结论", "— 禁止", "— 禁止", "— 禁自批", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["13 M5-1~3 销量预测与WAPE评估", "○ 复盘WAPE", "○ 看趋势", "◆ 画像/预测", "○ 回测评估", "○ 新品参考", "— 禁止", "○ 预测参考", "— 禁止", "— 禁止"],
  ["14 M6-1~4 补货测算与审批履约", "✓ 审批补货", "○ 看资金", "◆ 提交草案", "— 禁止", "— 禁止", "— 禁止", "◆ 采购/收货", "— 禁止", "— 禁止"],
  ["15 M7-1~4 文案1大4小主图视频交付", "✓ 发布把关", "○ 查看成品", "○ 提卖点", "— 禁止", "○ 交接卖点", "◆ 生成+校验", "— 禁止", "— 禁止", "— 禁止"],
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
      sku: x.sku, name: x.name, origin: "M4_APPROVED",
      approver: x.approver || "陈主管", reason: x.decisionReason || "利润率达标批准测款"
    }));
  const legacyInStore = state.masterProducts.map(p => ({
    sku: p.sku, name: p.name, origin: "IN_STORE_REFRESH",
    approver: "老品在售翻新", reason: "已上架店铺 SKU 详情页升级"
  }));
  return [...approvedNew, ...legacyInStore];
}

function highlightAndCheckCopy(text, mustStr, banStr, platform) {
  const mustTerms = mustStr.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const banTerms = banStr.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  let mustHits = 0;
  let banHits = 0;
  let safeHtml = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  mustTerms.forEach(term => {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    if (re.test(safeHtml)) mustHits++;
    safeHtml = safeHtml.replace(re, `<mark style="background:#dcfce7;color:#065f46;padding:0 3px;border-radius:3px;font-weight:700;">$1</mark>`);
  });
  banTerms.forEach(term => {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    if (re.test(safeHtml)) banHits++;
    safeHtml = safeHtml.replace(re, `<mark style="background:#fee2e2;color:#b91c1c;padding:0 3px;border-radius:3px;font-weight:700;text-decoration:underline;">$1</mark>`);
  });

  const maxTitleLen = platform === "Shopee TH" ? 120 : platform === "TikTok Shop" ? 150 : 200;
  const overLen = text.length > maxTitleLen;
  return { safeHtml, mustHits, totalMust: mustTerms.length, banHits, len: text.length, maxTitleLen, overLen };
}

export function renderM7_M8(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, rerender, commitAction, runAsyncTask, renderAsyncBox, record403 } = helpers;

  const availProds = getM7AvailableProducts(state);
  const curM7Prod = availProds.find(p => p.sku === state.m7Sku) || availProds[0];

  // ==================== M7a: Listing Copywriting ====================
  if (pageId === "m7a") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const mustList = state.m7MustTerm.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const drafts = state.m7ResultTab === "商品标题" ? [
      `${curM7Prod.sku} | ${mustList.join(" ")} — Compact Everyday Essential for ${state.m7Platform} (v${state.m7CopyGenCount}-SEO)`,
      `${curM7Prod.name} (${curM7Prod.sku}) · ${mustList[0] || "Premium"} Design with Fast Setup & Reliable Quality (v${state.m7CopyGenCount}-卖点)`,
      `[New Release] ${mustList.slice(0,2).join(" & ")} ${curM7Prod.name} for Home & Travel (${state.m7Platform} v${state.m7CopyGenCount}-场景)`,
    ] : state.m7ResultTab === "五点描述" ? [
      `• [核心性能] Engineered with ${mustList.join(", ")}, delivering reliable everyday performance for ${state.m7Platform} shoppers.`,
      `• [便捷体验] Lightweight body (${curM7Prod.sku}) enables 1-hand operation anywhere—ideal for kitchen, dorm, and travel.`,
      `• [售后保障] Best choice for gift giving? (测试含禁忌词 Best：用于校验实时拦截与标红效果)`,
    ] : state.m7ResultTab === "商品描述" ? [
      `Upgrade your daily routine with ${curM7Prod.sku} (${curM7Prod.name}). Built around ${mustList.join(" and ")}, this edition meets ${state.m7Platform} standards (v${state.m7CopyGenCount}).`,
      `Designed for busy households, ${curM7Prod.name} combines ${mustList[0] || "durable material"} with effortless storage and low maintenance.`,
      `[A+ 叙事风格] From morning prep to weekend trips, ${curM7Prod.sku} keeps essentials fresh and organized.`,
    ] : [
      `${mustList.map(x=>x.toLowerCase()).join(", ")}, ${curM7Prod.sku.toLowerCase()}, compact home organizer, travel essential (20个研究词 #SEO)`,
      `portable gadget, ${curM7Prod.name}, gift for family, space saving organizer (20个研究词 #长尾)`,
      `best miracle free gadget (测试含禁忌词 Best/Miracle/Free：触发违禁扫描拦截)`,
    ];

    return {
      headerActions: [
        { label: "去 AI 商品主图 (1大4小) →", primary: false, onClick: () => goPage("m7b") },
        {
          label: "✨ 重新生成文案草稿", primary: true,
          disabled: !canCreate,
          onClick: () => {
            state.m7CopyGenCount += 1;
            appendAuditLog(state, { target: `M7-1 文案生成 (${curM7Prod.sku})`, action: `生成第 ${state.m7CopyGenCount} 版文案`, detail: `${state.m7Platform} · ${state.m7Lang}`, ok: true });
            rerender();
            toast(`已生成第 ${state.m7CopyGenCount} 版差异化文案并完成术语扫描`);
          }
        }
      ],
      html: `
        <div class="stepper">
          <div class="step-item done">① M4 主管已同意测款 / 老品任务卡</div>
          <div class="step-item active">② 多版本文案与禁忌词真实扫描</div>
          <div class="step-item">③ 写入 M7-4 整套交付与合规校验</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">商品准入与任务卡约束</div></div>
            <div class="field"><label>选择创作商品（联动 M4-3 主管批准清单）</label>
              <select id="m7ProdSel" class="select">
                <optgroup label="✓ M4 主管已同意测款（可上新创作）">
                  ${availProds.filter(p=>p.origin==="M4_APPROVED").map(p => `<option value="${p.sku}" ${state.m7Sku===p.sku?"selected":""}>${p.sku} · ${p.name} (主管已批)</option>`).join("")}
                </optgroup>
                <optgroup label="在售老品详情页翻新">
                  ${availProds.filter(p=>p.origin==="IN_STORE_REFRESH").map(p => `<option value="${p.sku}" ${state.m7Sku===p.sku?"selected":""}>${p.sku} · ${p.name} (在售翻新)</option>`).join("")}
                </optgroup>
              </select>
            </div>

            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:1px solid ${curM7Prod.origin==="M4_APPROVED"?"#a7f3d0":"var(--border)"};background:${curM7Prod.origin==="M4_APPROVED"?"var(--green-bg)":"#f8fafc"};margin-bottom:10px;">
              <img src="${getProductImg(curM7Prod.sku)}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div>
                <div style="margin-bottom:3px;">
                  <span class="pill ${curM7Prod.origin==="M4_APPROVED"?"p-green":"p-blue"}">
                    ${curM7Prod.origin==="M4_APPROVED" ? `✓ 主管已同意测款 (${curM7Prod.approver})` : "在售老品翻新"}
                  </span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);">${curM7Prod.reason}</div>
              </div>
            </div>

            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>目标平台 (决定字数上限)</label><select id="m7PlatSel" class="select"><option ${state.m7Platform==="Amazon US"?"selected":""}>Amazon US</option><option ${state.m7Platform==="Shopee TH"?"selected":""}>Shopee TH</option><option ${state.m7Platform==="TikTok Shop"?"selected":""}>TikTok Shop</option></select></div>
              <div class="field"><label>语言</label><select id="m7LangSel" class="select"><option ${state.m7Lang==="English (US)"?"selected":""}>English (US)</option><option ${state.m7Lang==="简体中文"?"selected":""}>简体中文</option></select></div>
            </div>
            <div class="field"><label>必用术语（逗号分隔，绿底高亮）</label><input id="m7MustTerm" class="input" value="${state.m7MustTerm}"/></div>
            <div class="field"><label>禁忌词 / 违禁词（逗号分隔，红底拦截）</label><input id="m7BanTerm" class="input" value="${state.m7BanTerm}"/></div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>✨ 生成第 ${state.m7CopyGenCount + 1} 版全套文案</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">${curM7Prod.sku} 多版本草稿（实时扫描必用词 & 禁忌词）</div>
              <span class="pill p-blue">${state.m7Platform} 上限 ${state.m7Platform==="Shopee TH"?120:state.m7Platform==="TikTok Shop"?150:200} 字符</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["商品标题", "五点描述", "商品描述", "后台搜索词"].map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">${tb}</div>
              `).join("")}
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
              ${drafts.map((txt, idx) => {
                const chk = highlightAndCheckCopy(txt, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
                const blocked = chk.banHits > 0 || chk.overLen;
                return `
                  <div style="background:#f8fafc;border:1px solid ${blocked?"#fca5a5":"var(--border)"};border-radius:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:240px;">
                      <div style="font-weight:600;line-height:1.5;">${chk.safeHtml}</div>
                      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;font-size:12px;">
                        <span class="pill p-green">必用词命中 ${chk.mustHits}/${chk.totalMust}</span>
                        <span class="pill ${chk.banHits>0?"p-red":"p-green"}">禁忌词命中 ${chk.banHits} 处</span>
                        <span class="pill ${chk.overLen?"p-red":"p-gray"}">字符数 ${chk.len} / ${chk.maxTitleLen}</span>
                      </div>
                    </div>
                    <button class="btn ${blocked?"btn-danger":"btn-primary"} btn-sm m7-pick-copy" data-txt="${txt.replace(/"/g, "&quot;")}" data-ban="${chk.banHits}" data-over="${chk.overLen?1:0}" ${!canCreate?"disabled":""}>
                      ${blocked ? "含违禁/超长(不可写入)" : "写入交付清单 ✓"}
                    </button>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m7ProdSel").onchange = (e) => { state.m7Sku = e.target.value; rerender(); };
        document.getElementById("m7PlatSel").onchange = (e) => { state.m7Platform = e.target.value; rerender(); };
        document.getElementById("m7LangSel").onchange = (e) => { state.m7Lang = e.target.value; rerender(); };
        document.querySelectorAll(".m7-rtab").forEach(el => el.onclick = () => { state.m7ResultTab = el.dataset.tab; rerender(); });
        document.getElementById("m7GenCopyBtn").onclick = () => {
          state.m7MustTerm = document.getElementById("m7MustTerm").value;
          state.m7BanTerm = document.getElementById("m7BanTerm").value;
          state.m7CopyGenCount += 1; rerender(); toast(`已更新术语约束并生成第 ${state.m7CopyGenCount} 版文案`);
        };
        document.querySelectorAll(".m7-pick-copy").forEach(b => b.onclick = () => {
          if (Number(b.dataset.ban) > 0 || b.dataset.over === "1") {
            appendAuditLog(state, { target: `M7-1 文案拦截 (${curM7Prod.sku})`, action: "禁忌词/超长拦截", detail: b.dataset.txt.slice(0, 60), ok: false });
            toast("拦截：该草稿包含禁忌词或超过平台字数限制，禁止写入交付清单！", "error");
            return;
          }
          const val = b.dataset.txt;
          if (state.m7ResultTab === "商品标题") state.m7SelectedTitle = val;
          else if (state.m7ResultTab === "五点描述") state.m7SelectedBullets = val;
          else if (state.m7ResultTab === "商品描述") state.m7SelectedDesc = val;
          else state.m7SelectedKeywords = val;
          appendAuditLog(state, { target: `M7-1 写入交付 (${curM7Prod.sku})`, action: `选用${state.m7ResultTab}`, detail: val.slice(0, 60), ok: true });
          toast(`已将「${state.m7ResultTab}」写入 M7-4 整套交付清单！`, "success");
        });
      }
    };
  }

  // ==================== M7b: 1-Large + 4-Small Gallery (Honest ComfyUI Simulation Boundary) ====================
  if (pageId === "m7b") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const pickedImg = state.m7Images[state.m7PickedImgIdx] || state.m7Images[0];
    const prodImg = getProductImg(curM7Prod.sku);

    return {
      headerActions: [
        { label: "← Listing 文案", primary: false, onClick: () => goPage("m7a") },
        { label: "去 AI 短视频 →", primary: false, onClick: () => goPage("m7c") },
        {
          label: "✨ 模拟下发 ComfyUI 重绘 5 张套图", primary: true,
          disabled: !canCreate,
          onClick: () => {
            runAsyncTask("m7_img_batch", {
              label: `ComfyUI 套图生成 · ${curM7Prod.sku}`,
              steps: ["校验 ComfyUI 节点连通性 (未配置API_BASE)", "使用演示占位模式递增 Seed", "刷新 1主图+4附图 占位陈列"],
              durationMs: 1100,
              onSuccess: () => {
                state.m7ImgSeed += 1;
                state.m7Images.forEach(im => {
                  im.done = true;
                  im.editNote = `演示占位图 (Seed #${state.m7ImgSeed}) · 未连真实ComfyUI`;
                });
                return { summary: `已刷新演示占位套图 Seed #${state.m7ImgSeed} (非真实生图)`, toastMsg: "演示占位套图已更新（注：未连接真实 ComfyUI 节点）", toastLevel: "warn" };
              }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span>⚠️ <strong>B类服务诚实边界：</strong>ComfyUI 真实出图需后端 GPU 节点支持（当前 <code>API_BASE</code> 未配置），下方图位均为<strong>「演示占位图」</strong>，绝不冒充真实渲染后的商品图。</span>
        </div>
        ${renderAsyncBox("m7_img_batch")}

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">ComfyUI 视觉工作流参数</div></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <img src="${prodImg}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div>
                <strong>${curM7Prod.sku} · ${curM7Prod.name}</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Platform} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 主管已同意测款":"在售老品翻新"}</div>
              </div>
            </div>
            <div class="field"><label>工作流版本</label>
              <select id="m7ImgWfSel" class="select">
                <option ${state.m7ImgWorkflow.includes("白底")?"selected":""}>Amazon 白底主图 · v3 (ComfyUI 未连接·演示占位)</option>
                <option ${state.m7ImgWorkflow.includes("场景")?"selected":""}>电商 1大+4小 套图流水线 · v4 (演示占位)</option>
              </select>
            </div>
            <div class="field"><label>Prompt 规范约束</label><textarea class="textarea">纯白背景 (#FFFFFF)，主体占画面 85%，柔和棚拍光影，无多余水印。</textarea></div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>当前选中图位：</strong>${pickedImg.code}<br/>
              状态：<strong>${pickedImg.done ? "演示占位图已就绪" : "待补齐"}</strong>（${pickedImg.editNote}）
            </div>
            <button class="btn btn-primary" id="m7EditPickedBtn" style="width:100%;justify-content:center;margin-bottom:8px;" ${!canCreate?"disabled":""}>✏️ 局部修改当前选中图位</button>
            <button class="btn btn-sm" id="m7GotoM7d" style="width:100%;justify-content:center;">前往 M7-4 查看整套交付清单 →</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">电商套图陈列（01 主图 + 02~05 附图 · Seed #${state.m7ImgSeed}）</div>
              <span class="pill p-amber">演示占位模式 · 未连 ComfyUI</span>
            </div>

            <div class="gallery-1plus4">
              ${(() => {
                const m = state.m7Images[0];
                return `
                  <div class="gal-tile large ${state.m7PickedImgIdx===0?"picked":""}" data-imgi="0">
                    <div class="gal-canvas">
                      <img src="${prodImg}" style="width:155px;height:155px;border-radius:12px;" alt="主图"/>
                      <span class="pill p-amber" style="position:absolute;bottom:8px;right:8px;">演示占位 · Seed#${state.m7ImgSeed}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <div><strong>${m.code}</strong> <span style="font-size:12px;color:var(--text-soft)">${m.editNote}</span></div>
                      <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"已就绪":"待生成"}</span>
                    </div>
                  </div>
                `;
              })()}

              <div class="gallery-4small">
                ${state.m7Images.slice(1).map((m, idx) => {
                  const realIdx = idx + 1;
                  return `
                    <div class="gal-tile ${state.m7PickedImgIdx===realIdx?"picked":""}" data-imgi="${realIdx}">
                      <div class="gal-canvas" style="background:${realIdx===1?"#f1f5f9":"#ffffff"};">
                        <img src="${prodImg}" style="width:68px;height:68px;opacity:${m.done?0.92:0.35};border-radius:8px;" alt="${m.code}"/>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                        <strong style="font-size:12px;">${m.code}</strong>
                        <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"占位✓":"缺"}</span>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m7ImgWfSel").onchange = (e) => { state.m7ImgWorkflow = e.target.value; };
        document.querySelectorAll(".gal-tile").forEach(el => el.onclick = () => { state.m7PickedImgIdx = Number(el.dataset.imgi); rerender(); });
        document.getElementById("m7GotoM7d").onclick = () => goPage("m7d");
        document.getElementById("m7EditPickedBtn").onclick = () => {
          commitAction({
            title: `局部修改 · ${pickedImg.code}（保留其余 4 张图不变）`,
            summary: "遵循 SRS M04-A05：仅重绘当前选中图位，不重写其他合格图片（当前为演示占位模拟）。",
            confirmText: "执行局部修改",
            fieldsHtml: `<div class="field"><label>局部重绘指令 (Inpainting Prompt) *</label><textarea id="inpaintPrompt" class="textarea">移除多余标识，增强产品边缘高光质感</textarea></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#inpaintPrompt");
              return el.value.trim() ? [] : [{ el, msg: "请输入局部重绘指令" }];
            },
            onConfirm: () => {
              state.m7ImgSeed += 1;
              pickedImg.done = true;
              pickedImg.editNote = `局部重绘占位 (Seed #${state.m7ImgSeed})`;
              return { toastMsg: `已模拟更新「${pickedImg.code}」并保留其余图位不变` };
            },
            audit: (wrap) => ({ target: `M7-2 局部改图 (${curM7Prod.sku})`, action: `局部重绘 ${pickedImg.code}`, detail: wrap.querySelector("#inpaintPrompt").value.trim(), ok: true })
          });
        };
      }
    };
  }

  // ==================== M7c: ComfyUI Short Video (Honest /sync & Failure Boundary) ====================
  if (pageId === "m7c") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const isFailMode = state.m7VidWorkflow.includes("未配置");
    return {
      headerActions: [
        { label: "← AI 商品主图", primary: false, onClick: () => goPage("m7b") },
        { label: "前往整套交付与合规审核 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        <div class="banner banner-amber">
          <span>⚠️ <strong>B类服务诚实边界 (AC-GC-02)：</strong>默认节点状态为「未配置 ComfyUI SVD 节点」，直接触发将返回真实 <code>FAILED</code>；切换为「模拟已配置节点」可演示 <code>/prompt → /sync</code> 轮询进度与日志（仍标明为演示模拟态）。</span>
        </div>
        ${renderAsyncBox("m7_vid")}

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">短视频生成参数</div></div>
            <div class="field"><label>目标商品</label><input class="input" readonly value="${curM7Prod.sku} · ${curM7Prod.name}" /></div>
            <div class="field">
              <label>视频脚本类型</label>
              <div class="grid-2" style="gap:8px;">
                ${["产品展示", "开箱测评", "场景种草", "卖点快剪"].map(vt => `
                  <div class="option-tile ${state.m7VidType===vt?"active":""} m7-vtype" data-t="${vt}"><strong style="font-size:12.5px;">${vt}</strong></div>
                `).join("")}
              </div>
            </div>
            <div class="field"><label>ComfyUI SVD 节点状态</label>
              <select id="m7VidWfSel" class="select">
                <option value="fail" ${isFailMode?"selected":""}>未配置 ComfyUI SVD 节点 (默认 · 测试真实报错)</option>
                <option value="ok" ${!isFailMode?"selected":""}>模拟已配置 SVD 节点 · 15s 竖屏工作流 (演示轮询)</option>
              </select>
            </div>
            <button class="btn btn-primary" id="m7GenVidBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>▶ 下发 /prompt 并轮询 /sync</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">渲染状态与 /sync 轮询日志</div>
              <span class="pill ${state.m7VidDone?"p-green":"p-red"}">${state.m7VidDone?"演示模拟 MP4 已就绪":"FAILED：未配置节点"}</span>
            </div>
            ${!state.m7VidDone ? `
              <div class="banner banner-red">
                <span>SRS AC-GC-02 诚实边界：ComfyUI 未检测到有效 SVD 视频节点（API_BASE=${API_BASE || "未配置"}），已标记 FAILED 并停止输出，绝不生成假 MP4 文件！</span>
              </div>
            ` : `
              <div class="grid-2">
                <div class="media-card picked">
                  <div class="media-preview dark">
                    <div style="font-size:26px;">▶</div>
                    <strong>15s 竖屏演示预览 (${state.m7VidType})</strong>
                    <span style="font-size:12px;color:#cbd5e1">演示模拟态 · 未连真实 GPU 节点</span>
                  </div>
                  <div style="font-weight:700;">产品种草视频（关联 01 主图）</div>
                  <div style="font-size:12px;color:var(--amber-text);margin:4px 0 8px;">注：纯前端演示模拟回执，正式 MP4 需连后端节点</div>
                  <button class="btn btn-primary btn-sm" id="m7UseVidBtn">确认写入交付清单 →</button>
                </div>
                <div class="media-card">
                  <div style="font-weight:700;margin-bottom:6px;">/sync 异步轮询日志</div>
                  <div style="font-size:12.5px;color:var(--text-muted);line-height:1.75;">
                    ${(state.m7VidLogs.length ? state.m7VidLogs : ["• POST /prompt → 待触发"]).join("<br/>")}
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m7-vtype").forEach(el => el.onclick = () => { state.m7VidType = el.dataset.t; rerender(); });
        document.getElementById("m7VidWfSel").onchange = (e) => {
          state.m7VidWorkflow = e.target.value === "fail" ? "未配置 ComfyUI SVD 节点 (默认诚实报错)" : "SVD 图生视频 · 15s 竖屏工作流 (演示模拟)";
          if (e.target.value === "fail") state.m7VidDone = false;
          rerender();
        };
        document.getElementById("m7GenVidBtn").onclick = () => {
          const failNow = state.m7VidWorkflow.includes("未配置");
          runAsyncTask("m7_vid", {
            label: `ComfyUI SVD 短视频任务 · ${curM7Prod.sku}`,
            steps: ["POST /prompt 提交工作流", "GET /sync 轮询渲染进度", "校验输出流写入交付清单"],
            durationMs: 1200,
            shouldFail: failNow,
            failReason: "未配置 ComfyUI SVD 视频节点或节点超时 (AC-GC-02 诚实失败)",
            onFail: () => { state.m7VidDone = false; },
            onSuccess: () => {
              state.m7VidDone = true;
              const pid = "svd-" + Math.random().toString(16).slice(2, 7);
              state.m7VidLogs = [
                `• [${nowDateTimeStr()}] POST /prompt → prompt_id: ${pid}`,
                `• GET /sync → RUNNING (48% · 首帧编码)`,
                `• GET /sync → COMPLETED (模拟回执 · 15s ${state.m7VidType})`,
                `• 已点亮 M7-4「产品种草视频」交付项`
              ];
              return { summary: `模拟轮询完成 (${pid})`, toastMsg: "短视频模拟轮询完成（演示态）" };
            }
          });
        };
        const uv = document.getElementById("m7UseVidBtn");
        if (uv) uv.onclick = () => goPage("m7d");
      }
    };
  }

  // ==================== M7d: Full 8-Item Delivery Checklist & Compliance ====================
  if (pageId === "m7d") {
    const isApprover = state.role === "approver";
    const isCreator = state.role === "creator" || isApprover;
    const auxDoneCount = state.m7Images.slice(1).filter(i => i.done).length;
    const missingAux = state.m7Images.slice(1).filter(i => !i.done).map(i => i.code);
    const checklist = [
      { label: "1. 商品标题", sub: state.m7SelectedTitle ? state.m7SelectedTitle.slice(0, 38) + "..." : "未选择标题", done: !!state.m7SelectedTitle, jump: "m7a" },
      { label: "2. 五点描述", sub: state.m7SelectedBullets ? state.m7SelectedBullets.slice(0, 38) + "..." : "未选择五点描述", done: !!state.m7SelectedBullets, jump: "m7a" },
      { label: "3. 商品描述", sub: state.m7SelectedDesc ? state.m7SelectedDesc.slice(0, 38) + "..." : "未选择商品描述", done: !!state.m7SelectedDesc, jump: "m7a" },
      { label: "4. 后台搜索词", sub: state.m7SelectedKeywords ? state.m7SelectedKeywords.slice(0, 38) + "..." : "缺20个研究词", done: !!state.m7SelectedKeywords, jump: "m7a" },
      { label: "5. 白底主图 (01)", sub: state.m7Images[0].done ? `占位已就绪 (${state.m7Images[0].editNote})` : "缺01主图", done: state.m7Images[0].done, jump: "m7b" },
      { label: `6. 产品附图 (${auxDoneCount}/4张)`, sub: auxDoneCount === 4 ? "02~05 全部就绪" : `缺 ${missingAux.join("、")}（点击去补齐）`, done: auxDoneCount === 4, jump: "m7b" },
      { label: "7. A+ 图文页面", sub: state.m7AplusDone ? "图文模块已生成 ✓" : "暂未生成（点击一键补齐A+图文）", done: state.m7AplusDone, jump: "aplus" },
      { label: "8. 产品种草视频", sub: state.m7VidDone ? `15s 演示预览 (${state.m7VidType})` : "未生成 / FAILED（点击前往 M7-3 处理）", done: state.m7VidDone, jump: "m7c" },
    ];
    const doneCnt = checklist.filter(c => c.done).length;
    const prodImg = getProductImg(curM7Prod.sku);

    return {
      headerActions: [
        { label: "← 补齐主图/附图", primary: false, onClick: () => goPage("m7b") },
        {
          label: "导出离线合规资料包", primary: true,
          disabled: state.m7ComplianceStatus !== "主管已批准导出",
          disabledTitle: "必须先完成 ComplianceCheck 并由「主管/审批人」批准才可导出",
          onClick: () => {
            commitAction({
              title: `导出离线合规上架包 · ${curM7Prod.sku}`,
              summary: "严守系统边界：仅导出离线资料包清单供运营手动上传店铺后台，绝不直连改写线上店铺！",
              confirmText: "确认导出清单",
              fieldsHtml: `
                <div class="formula-box">
                  • 归属商品：<strong>${curM7Prod.sku} · ${curM7Prod.name}</strong><br/>
                  • 批准主管：<strong>${state.m7ApprovalRecord?.approver}</strong> (${state.m7ApprovalRecord?.time})<br/>
                  • 导出包内容 (${doneCnt}/8 类)：Listing_Copy.json + Images_Pack(${auxDoneCount+1}张占位) ${state.m7VidDone?"+ Video_15s.mp4":""} ${state.m7AplusDone?"+ APlus_HTML":""}
                </div>
              `,
              onConfirm: () => ({ toastMsg: `已导出 ${curM7Prod.sku} 离线合规资料包 (${doneCnt}/8类资产)` }),
              audit: { target: `M7-4 导出资料包 (${curM7Prod.sku})`, action: "导出离线合规包", detail: `包含 ${doneCnt}/8 类交付物`, ok: true }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>合规与发布边界：</strong>独立运行 <code>ComplianceCheck</code> 逐条核验后，由「主管/审批人」批准导出，绝不直接改写线上店铺；当前完成度 <strong>${doneCnt}/8 类</strong>。</span>
          <span class="pill ${doneCnt===8?"p-green":"p-amber"}">整套交付完成度：${doneCnt} / 8 类</span>
        </div>

        <div class="split-right-panel">
          <div class="card">
            <div class="card-header">
              <div>
                <strong style="font-size:16px;">${curM7Prod.sku} · ${curM7Prod.name} (${state.m7Platform}) 成品预览</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Lang} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 来自 M4 主管已同意测款":"在售老品翻新"}</div>
              </div>
              <span class="pill p-blue">跨模态成品预览</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["主图/附图", "Listing 文案", "后台搜索词", "种草视频"].map(tb => `
                <div class="utab ${state.m7PreviewTab===tb?"active":""} m7d-ptab" data-t="${tb}">${tb}</div>
              `).join("")}
            </div>

            ${state.m7PreviewTab === "主图/附图" ? `
              <div class="gallery-1plus4">
                <div class="gal-tile large picked">
                  <div class="gal-canvas"><img src="${prodImg}" style="width:155px;height:155px;border-radius:12px;" alt="主图"/></div>
                  <div style="font-size:12.5px;"><strong>01 / 白底主图</strong> (${state.m7Images[0].editNote})</div>
                </div>
                <div class="gallery-4small">
                  ${state.m7Images.slice(1).map(m => `
                    <div class="gal-tile">
                      <div class="gal-canvas"><img src="${prodImg}" style="width:60px;height:60px;opacity:${m.done?0.9:0.25};border-radius:8px;" alt="${m.code}"/></div>
                      <span style="font-size:12px;">${m.code} ${m.done?"✓":"(缺)"}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : state.m7PreviewTab === "Listing 文案" ? `
              <div style="display:flex;flex-direction:column;gap:10px;background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <div><span class="pill p-blue">商品标题</span><div style="font-weight:700;margin-top:4px;">${state.m7SelectedTitle}</div></div>
                <div><span class="pill p-blue">五点描述</span><div style="margin-top:4px;">${state.m7SelectedBullets}</div></div>
                <div><span class="pill p-blue">商品描述</span><div style="margin-top:4px;">${state.m7SelectedDesc}</div></div>
              </div>
            ` : state.m7PreviewTab === "后台搜索词" ? `
              <div style="background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <span class="pill p-purple">后台搜索词</span>
                <div style="margin-top:8px;font-family:monospace;">${state.m7SelectedKeywords}</div>
              </div>
            ` : `
              <div class="media-preview dark" style="height:220px;border-radius:9px;">
                <div style="font-size:28px;">▶</div>
                <strong>${state.m7VidDone ? `15s 演示预览 (${state.m7VidType})` : "短视频尚未生成 / FAILED"}</strong>
              </div>
            `}
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">整套交付清单（8 类资产 · 点击缺项跳转补齐）</div>
                <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已就绪</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${checklist.map(c => `
                  <div class="m7d-chk" data-jmp="${c.jump}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;border:1px solid var(--border);border-radius:8px;background:${c.done?"#f8fafc":"var(--amber-bg)"};cursor:pointer;">
                    <div style="min-width:0;">
                      <div style="font-weight:700;font-size:13px;">${c.label}</div>
                      <div style="font-size:12px;color:var(--text-soft);">${c.sub}</div>
                    </div>
                    <span class="pill ${c.done?"p-green":"p-amber"}">${c.done?"已就绪 ✓":"去补齐 →"}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card card-blue">
              <div class="card-header">
                <div class="card-title">ComplianceCheck & 主管把关</div>
                <span class="pill ${state.m7ComplianceStatus==="主管已批准导出"?"p-green":state.m7ComplianceStatus==="校验通过"?"p-blue":"p-amber"}">${state.m7ComplianceStatus}</span>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;">
                ${state.m7ComplianceChecks.length ? state.m7ComplianceChecks.map(ch => `<div>• ${ch.rule}：<strong style="color:${ch.pass?"var(--green-text)":"var(--amber-text)"}">${ch.detail}</strong></div>`).join("") : "尚未运行合规校验，请先点击下方「1. 运行 ComplianceCheck」。"}
                ${state.m7ApprovalRecord ? `<div style="margin-top:6px;color:var(--green-text);"><strong>✓ 已批准：</strong>${state.m7ApprovalRecord.approver} · ${state.m7ApprovalRecord.time}</div>` : ""}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" id="m7RunCompBtn" ${!isCreator?"disabled":""}>1. 运行 ComplianceCheck</button>
                <button class="btn btn-success btn-sm" id="m7ApprPubBtn" ${(!isApprover || state.m7ComplianceStatus!=="校验通过")?"disabled":""} title="${!isApprover?"需「主管/审批人」权限 — 请在左上角切换角色":"需先校验通过"}">2. 主管批准发布包</button>
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m7d-ptab").forEach(t => t.onclick = () => { state.m7PreviewTab = t.dataset.t; rerender(); });
        document.querySelectorAll(".m7d-chk").forEach(el => el.onclick = () => {
          const j = el.dataset.jmp;
          if (j === "aplus") {
            state.m7AplusDone = true;
            appendAuditLog(state, { target: `M7-4 补齐 A+ (${curM7Prod.sku})`, action: "生成 A+ 图文模块", detail: "已就绪", ok: true });
            rerender(); toast("已补充生成 A+ 页面图文模块", "success");
          } else goPage(j);
        });

        document.getElementById("m7RunCompBtn").onclick = () => {
          const banFound = state.m7BanTerm.split(/[,，]/).map(s=>s.trim()).filter(Boolean)
            .filter(w => new RegExp(w, "i").test(state.m7SelectedTitle + " " + state.m7SelectedBullets));
          state.m7ComplianceChecks = [
            { rule: "广告禁忌词扫描", pass: banFound.length === 0, detail: banFound.length ? `命中禁忌词：${banFound.join(",")}` : "0 命中 ✓" },
            { rule: "平台标题字符上限", pass: state.m7SelectedTitle.length <= 200, detail: `${state.m7SelectedTitle.length}/200 字符 ✓` },
            { rule: "整套 8 类资产完备度", pass: doneCnt === 8, detail: doneCnt === 8 ? "8/8 全部就绪 ✓" : `${doneCnt}/8 部分完成（缺项已标黄，支持带缺项提示送审）` },
          ];
          state.m7ComplianceStatus = banFound.length === 0 ? "校验通过" : "校验未通过";
          appendAuditLog(state, { target: `M7-4 合规检查 (${curM7Prod.sku})`, action: "ComplianceCheck", detail: `${state.m7ComplianceStatus} (${doneCnt}/8)`, ok: banFound.length === 0 });
          rerender();
          toast(banFound.length ? "合规校验未通过：检测到禁忌词" : `ComplianceCheck 通过（${doneCnt}/8 类就绪，待主管审批）`, banFound.length ? "error" : "success");
        };

        document.getElementById("m7ApprPubBtn").onclick = () => {
          commitAction({
            title: `主管批准内容交付发布包 · ${curM7Prod.sku}`,
            summary: `当前完成度 ${doneCnt}/8 类；批准后解锁离线合规包导出按钮（不直接推改线上店铺）。`,
            confirmText: "确认批准导出",
            fieldsHtml: `<div class="field"><label>主管审批意见 *</label><input id="m7ApprNote" class="input" value="文案合规无违禁词，准予导出资料包"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m7ApprNote");
              return el.value.trim() ? [] : [{ el, msg: "请填写主管审批意见" }];
            },
            onConfirm: (wrap) => {
              state.m7ComplianceStatus = "主管已批准导出";
              state.m7ApprovalRecord = { approver: "陈主管 (approver)", time: nowDateTimeStr(), note: wrap.querySelector("#m7ApprNote").value.trim() };
              return { toastMsg: `主管已批准导出 ${curM7Prod.sku} 资料包` };
            },
            audit: (wrap) => ({ target: `M7-4 发布把关 (${curM7Prod.sku})`, action: "主管批准导出包", detail: wrap.querySelector("#m7ApprNote").value.trim(), ok: true })
          });
        };
      }
    };
  }

  // ==================== M8a: Employee Roster & SRS §1.5 9-Role Assignment ====================
  if (pageId === "m8a") {
    const canManage = state.role === "manager" || state.role === "approver";
    const activeCount = state.employees.filter(e => e.active).length;
    const filtered = state.employees.filter(e => state.m8RoleFilter === "ALL" || e.role === state.m8RoleFilter);

    return {
      headerActions: [
        { label: "查看9角色权限矩阵与审计 →", primary: false, onClick: () => goPage("m8b") },
        {
          label: "+ 新增员工与角色授权", primary: true,
          disabled: !canManage,
          disabledTitle: "需「大屏浏览者/管理者」或「主管/审批人」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canManage) { record403("M8-1 新增员工", "无组织授权权限"); return; }
            commitAction({
              title: "新增员工与 SRS §1.5 角色授权",
              summary: "将严格校验工号唯一性、姓名必填与企业邮箱格式；授权后立即写入 M8-2 审计台账。",
              confirmText: "确认建档并授权",
              fieldsHtml: `
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>员工工号 * (如 EMP-113, 唯一)</label><input id="newEmpId" class="input" value="EMP-${101 + state.employees.length}" /></div>
                  <div class="field"><label>员工姓名 *</label><input id="newEmpName" class="input" placeholder="输入真实姓名" value="周宁" /></div>
                </div>
                <div class="field"><label>企业邮箱 *</label><input id="newEmpEmail" class="input" value="zhouning@crosspilot.ai" /></div>
                <div class="field"><label>分配 SRS §1.5 业务角色 *</label>
                  <select id="newEmpRole" class="select">${SRS_ROLES.map(r => `<option value="${r.key}">${r.label} (${r.code})</option>`).join("")}</select>
                </div>
                <div id="newEmpRolePreview" class="banner banner-blue" style="margin-bottom:10px;font-size:12.5px;"></div>
                <div class="field"><label>负责店铺 / 数据域 *</label><select id="newEmpShop" class="select"><option>全部实盘店铺 (Shopee TH + TikTok US)</option><option>Shopee 泰国主店</option><option>TikTok Shop 美区</option><option>仅演示沙盒 (Mock)</option></select></div>
              `,
              onMount: (wrap) => {
                const sel = wrap.querySelector("#newEmpRole");
                const upd = () => { wrap.querySelector("#newEmpRolePreview").textContent = `职责边界：${SRS_ROLES.find(r=>r.key===sel.value).desc}`; };
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
                if (!/^EMP-\d{3,}$/i.test(id)) errs.push({ el: idEl, msg: "工号格式须为 EMP- 加至少3位数字（如 EMP-113）" });
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
                const rObj = SRS_ROLES.find(r => r.key === role);
                state.employees.unshift({ id, name, email, role, shop, active: true, lastLogin: `${nowDateTimeStr()} (刚刚建档)` });
                return { toastMsg: `已建档员工 ${name} (${id}) · 授予「${rObj.label}」` };
              },
              audit: (wrap) => {
                const rObj = SRS_ROLES.find(r => r.key === wrap.querySelector("#newEmpRole").value);
                return {
                  target: `M8-1 员工 ${wrap.querySelector("#newEmpName").value.trim()} (${wrap.querySelector("#newEmpId").value.trim()})`,
                  action: "新增员工授权",
                  detail: `授予「${rObj.label}」，范围：${wrap.querySelector("#newEmpShop").value}`,
                  ok: true
                };
              }
            });
          }
        }
      ],
      html: `
        <div class="banner ${canManage?"banner-green":"banner-amber"}">
          <span>${canManage
            ? "组织授权权限已解锁：新增校验工号唯一/邮箱格式，调岗与停用均需二次确认并实时写入 M8-2 审计台账。"
            : "当前角色为只读模式：新增员工、调岗与停用需「大屏浏览者/管理者」或「主管/审批人」权限（请在左上角角色下拉切换）。"}</span>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">在职 / 总员工数</div><div class="kpi-val" style="color:var(--blue-hover)">${activeCount} / ${state.employees.length} 人</div><div class="kpi-sub">停用账号 ${state.employees.length - activeCount} 个</div></div>
          <div class="kpi-card"><div class="kpi-label">SRS §1.5 标准角色</div><div class="kpi-val" style="color:var(--purple-text)">9 类岗位</div><div class="kpi-sub">一字不改对齐需求规格书</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">SoD 互斥冲突</div><div class="kpi-val" style="color:var(--green-text)">0 冲突</div><div class="kpi-sub">提交人与终审人严格隔离</div></div>
          <div class="kpi-card"><div class="kpi-label">实时审计留痕</div><div class="kpi-val" style="color:var(--amber-text)">${state.auditLogs.length} 条</div><div class="kpi-sub">已持久化至本地审计列表</div></div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">按 SRS §1.5 九大角色筛选人数与明细</div></div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
            <button class="btn btn-sm ${state.m8RoleFilter==="ALL"?"btn-primary":""} m8-rflt" data-r="ALL">全部 (${state.employees.length})</button>
            ${SRS_ROLES.map(r => {
              const cnt = state.employees.filter(e => e.role === r.key).length;
              return `<button class="btn btn-sm ${state.m8RoleFilter===r.key?"btn-primary":""} m8-rflt" data-r="${r.key}">${r.label} (${cnt})</button>`;
            }).join("")}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>工号</th><th>员工姓名 / 邮箱</th><th>SRS §1.5 职位角色 (需确认调岗)</th><th>权限组</th><th>店铺 / 数据范围</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(emp => {
                  const rObj = SRS_ROLES.find(r => r.key === emp.role) || SRS_ROLES[0];
                  return `
                    <tr>
                      <td class="nowrap"><strong>${emp.id}</strong></td>
                      <td><strong>${emp.name}</strong><div style="font-size:12px;color:var(--text-soft)">${emp.email || ""} · ${emp.lastLogin}</div></td>
                      <td>
                        <select class="select m8-emp-role" data-id="${emp.id}" ${!canManage ? "disabled" : ""} style="min-width:190px;">
                          ${SRS_ROLES.map(r => `<option value="${r.key}" ${emp.role===r.key?"selected":""}>${r.label}</option>`).join("")}
                        </select>
                      </td>
                      <td class="nowrap"><span class="pill ${rObj.pill}">${rObj.code}</span></td>
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
          const oldL = SRS_ROLES.find(r => r.key === oldRole)?.label;
          const newL = SRS_ROLES.find(r => r.key === newRole)?.label;
          sel.value = oldRole; // revert until confirmed
          commitAction({
            title: `确认调整员工岗位 · ${emp.name} (${emp.id})`,
            summary: `岗位将从 <strong>${oldL}</strong> 变更为 <strong>${newL}</strong>，并立即写入审计台账。`,
            confirmText: "确认调岗",
            fieldsHtml: `<div class="field"><label>调岗原因 *</label><input id="m8MoveReason" class="input" value="业务分工调整"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m8MoveReason");
              return el.value.trim() ? [] : [{ el, msg: "请填写调岗原因" }];
            },
            onConfirm: () => {
              emp.role = newRole;
              emp.lastLogin = `${nowDateTimeStr()} (刚调岗)`;
              return { toastMsg: `已将 ${emp.name} 调岗为「${newL}」` };
            },
            audit: (wrap) => ({ target: `M8-1 调岗 ${emp.name} (${emp.id})`, action: "调整员工职位", detail: `${oldL} → ${newL} · ${wrap.querySelector("#m8MoveReason").value.trim()}`, ok: true })
          });
        });

        document.querySelectorAll(".m8-emp-toggle").forEach(b => b.onclick = () => {
          const emp = state.employees.find(x => x.id === b.dataset.id);
          const nextAct = !emp.active;
          commitAction({
            title: `确认${nextAct ? "恢复启用" : "停用"}账号 · ${emp.name} (${emp.id})`,
            danger: !nextAct,
            summary: nextAct ? "恢复后该员工可按所属角色重新登录操作。" : "停用后该账号所有在途权限将立即失效！",
            confirmText: nextAct ? "确认恢复" : "确认停用",
            onConfirm: () => {
              emp.active = nextAct;
              return { toastMsg: `${emp.name} 账号已${nextAct ? "恢复启用" : "停用"}`, toastLevel: nextAct ? "success" : "warn" };
            },
            audit: { target: `M8-1 账号 ${emp.name} (${emp.id})`, action: nextAct ? "恢复账号" : "停用账号", detail: `状态变更：${nextAct ? "启用中" : "已停用"}`, ok: true }
          });
        });
      }
    };
  }

  // ==================== M8b: Read-Only 9-Role Permission Matrix & Live Audit Logs ====================
  if (pageId === "m8b") {
    const curRoleObj = SRS_ROLES.find(r => r.key === state.role) || SRS_ROLES[0];
    const activeRoleIdx = SRS_ROLES.findIndex(r => r.key === state.role);
    return {
      headerActions: [
        { label: "← 返回员工名册", primary: false, onClick: () => goPage("m8a") },
        {
          label: "清空新增审计(保留示例)", primary: false,
          onClick: () => {
            state.auditLogs = state.auditLogs.filter(l => l.historical);
            try { if (typeof localStorage !== "undefined") localStorage.removeItem("crosspilot_audit_v2"); } catch {}
            rerender(); toast("已清理本轮新增演示日志，保留历史示例基准", "info");
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>只读权限矩阵与真实审计台账：</strong>本页矩阵仅供只读核对（需切换体验角色请使用左上角全局「当前登录角色」下拉框）；所有敏感操作与 403 拦截都会实时记录在下表！当前高亮：<strong>${curRoleObj.label}</strong></span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">SRS §1.5 九大业务角色 × 15 项核心功能权限矩阵（只读视图）</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="pill p-purple">★ 治理授权</span><span class="pill p-red">✓ 终审拍板</span><span class="pill p-blue">◆ 业务操作</span><span class="pill p-gray">○ 限域只读</span>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="min-width:210px;">功能模块 / 权限点</th>
                  ${SRS_ROLES.map((r, i) => `
                    <th style="min-width:112px;${i===activeRoleIdx?"background:#dbeafe;color:#1d4ed8;border-bottom:2px solid #2563eb;":""}">
                      ${r.label}
                      ${i===activeRoleIdx ? '<div style="font-size:11.5px;font-weight:800;">● 当前登录</div>' : ""}
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
            <div class="card-title" style="color:var(--purple-text);">实时操作与越权拦截审计日志（rbac_audit_logs · 共 ${state.auditLogs.length} 条）</div>
            <span class="pill p-green">本地持久化留痕 ✓</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>操作时间</th><th>操作人角色</th><th>目标对象</th><th>动作类型</th><th>详细说明</th><th>结果</th></tr></thead>
              <tbody>
                ${state.auditLogs.map(log => `
                  <tr>
                    <td class="nowrap">${log.time}</td>
                    <td class="nowrap"><strong>${SRS_ROLES.find(r=>r.key===log.actor)?.label || log.actor}</strong></td>
                    <td class="nowrap">${log.target}</td>
                    <td class="nowrap"><span class="pill ${log.ok?"p-blue":"p-red"}">${log.action}</span></td>
                    <td style="font-size:12.5px;">${log.detail}</td>
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
