import {
  BACKEND_SERVICE_URL, BIZ_ROLES, ROLE_PERSON_NAMES, getProductImg, nowDateTimeStr, appendAuditLog
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
      sku: x.sku, name: x.name, origin: "M4_APPROVED",
      approver: x.approver || "陈主管", reason: x.decisionReason || "实盘利润率达标批准测款"
    }));
  const legacyInStore = state.masterProducts.map(p => ({
    sku: p.sku, name: p.name, origin: "IN_STORE_REFRESH",
    approver: "在售老品翻新", reason: "已上架在售商品详情升级"
  }));
  return [...approvedNew, ...legacyInStore];
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
    const drafts = state.m7ResultTab === "商品标题" ? [
      `${curM7Prod.sku} | ${mustList.join(" ")} · Compact Everyday Essential for ${state.m7Platform} (热搜词版本 v${state.m7CopyGenCount})`,
      `${curM7Prod.name} (${curM7Prod.sku}) · ${mustList[0] || "Portable"} Design with Fast Setup & Reliable Quality (卖点突出版本 v${state.m7CopyGenCount})`,
      `New Arrival: ${mustList.slice(0,2).join(" & ")} ${curM7Prod.name} for Home & Travel (${state.m7Platform} 场景版本 v${state.m7CopyGenCount})`,
    ] : state.m7ResultTab === "五点描述" ? [
      `• [核心性能] Engineered with ${mustList.join(", ")}, delivering reliable everyday performance for busy shoppers.`,
      `• [便捷体验] Lightweight body (${curM7Prod.sku}) enables easy one-hand operation for kitchen, dorm, and travel.`,
      `• [测试拦截样例] Best choice with Miracle results and Free gift! (用于测试违禁词逐条拦截提醒)`,
    ] : state.m7ResultTab === "商品描述" ? [
      `Upgrade your daily routine with ${curM7Prod.sku} (${curM7Prod.name}). Built around ${mustList.join(" and ")}, tailored for ${state.m7Platform} shoppers (v${state.m7CopyGenCount}).`,
      `Designed for busy households, ${curM7Prod.name} combines ${mustList[0] || "durable material"} with effortless storage and low maintenance.`,
      `From morning meal prep to weekend trips, ${curM7Prod.sku} keeps essentials organized and fresh.`,
    ] : [
      `${mustList.map(x=>x.toLowerCase()).join(", ")}, ${curM7Prod.sku.toLowerCase()}, compact home organizer, travel essential (共20个合规搜索词)`,
      `portable gadget, ${curM7Prod.name}, gift for family, space saving organizer (共20个长尾搜索词)`,
      `best miracle free gadget (包含违禁词样例：触发合规拦截)`,
    ];

    return {
      headerActions: [
        { label: "下一步：制作主图与套图 →", primary: false, onClick: () => goPage("m7b") },
        {
          label: "✨ 生成新一版差异化文案", primary: true,
          disabled: !canCreate,
          disabledTitle: "需要「内容创作 / 审核人员」或主管权限",
          onClick: () => {
            state.m7CopyGenCount += 1;
            appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 为商品 ${curM7Prod.sku} 生成了第 ${state.m7CopyGenCount} 版多语言文案并完成用语扫描`, ok: true });
            rerender();
            toast(`已生成第 ${state.m7CopyGenCount} 版多角度文案并完成品牌用语校验`);
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>直接承接 M4 主管同意测款的新品，按目标平台字数上限和品牌用语规范生成多版本文案，自动高亮命中词并拦截违禁词。</span>
        </div>

        <div class="stepper">
          <div class="step-item done">① 选取 M4 主管已同意测款商品</div>
          <div class="step-item active">② 多版本文案与品牌用语扫描</div>
          <div class="step-item">③ 汇总至 M7-4 合规交付清单</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">选品任务与品牌用语规范</div></div>
            <div class="field"><label>选择创作商品（自动联动 M4 批准清单）</label>
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
              <div class="field"><label>目标上架平台（决定字数上限）</label><select id="m7PlatSel" class="select"><option ${state.m7Platform==="亚马逊美国站"?"selected":""}>亚马逊美国站</option><option ${state.m7Platform==="虾皮泰国站"?"selected":""}>虾皮泰国站</option><option ${state.m7Platform==="TikTok 美区"?"selected":""}>TikTok 美区</option></select></div>
              <div class="field"><label>输出语言</label><select id="m7LangSel" class="select"><option ${state.m7Lang==="English (US)"?"selected":""}>English (US)</option><option ${state.m7Lang==="简体中文"?"selected":""}>简体中文</option></select></div>
            </div>
            <div class="field"><label>品牌用语规范（必须包含，绿底高亮）</label><input id="m7MustTerm" class="input" value="${state.m7MustTerm}"/></div>
            <div class="field"><label>平台违禁词（严禁出现，红底拦截）</label><input id="m7BanTerm" class="input" value="${state.m7BanTerm}"/></div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>✨ 按最新规范生成第 ${state.m7CopyGenCount + 1} 版文案</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">${curM7Prod.sku} 多版本文案草稿（逐条高亮命中与次数）</div>
              <span class="pill p-blue">${state.m7Platform} 上限 ${state.m7Platform.includes("虾皮")?120:state.m7Platform.includes("TikTok")?150:200} 字</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["商品标题", "五点描述", "商品描述", "后台搜索词"].map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">${tb}</div>
              `).join("")}
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
              ${drafts.map(txt => {
                const chk = checkCopyRules(txt, state.m7MustTerm, state.m7BanTerm, state.m7Platform);
                const blocked = chk.banHits > 0 || chk.overLen;
                return `
                  <div style="background:#f8fafc;border:1px solid ${blocked?"#fca5a5":"var(--border)"};border-radius:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:240px;">
                      <div style="font-weight:600;line-height:1.5;">${chk.safeHtml}</div>
                      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;font-size:12px;">
                        <span class="pill p-green">品牌用语命中 ${chk.mustHits}/${chk.totalMust} 项${chk.mustHitsDetail.length ? `（${chk.mustHitsDetail.join("、")}）` : ""}</span>
                        <span class="pill ${chk.banHits>0?"p-red":"p-green"}">${chk.banHits>0 ? `命中违禁词：${chk.banHitsDetail.join("、")}` : "违禁词 0 命中 ✓"}</span>
                        <span class="pill ${chk.overLen?"p-red":"p-gray"}">字符数 ${chk.len} / ${chk.maxTitleLen}</span>
                      </div>
                    </div>
                    <button class="btn ${blocked?"btn-danger":"btn-primary"} btn-sm m7-pick-copy" data-txt="${txt.replace(/"/g, "&quot;")}" data-ban="${chk.banHits}" data-over="${chk.overLen?1:0}" ${!canCreate?"disabled":""}>
                      ${blocked ? "含违禁/超长(禁止选用)" : "写入交付清单 ✓"}
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
          state.m7CopyGenCount += 1; rerender(); toast(`已更新品牌用语规范并生成第 ${state.m7CopyGenCount} 版文案`);
        };
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
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 将 ${curM7Prod.sku} 的「${state.m7ResultTab}」写入 M7-4 上架交付清单`, ok: true });
          toast(`已将「${state.m7ResultTab}」写入 M7-4 整套交付清单！`, "success");
        });
      }
    };
  }

  // ==================== M7-2: 主图与详情套图制作（无参数黑话，清晰标注演示图） ====================
  if (pageId === "m7b") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const pickedImg = state.m7Images[state.m7PickedImgIdx] || state.m7Images[0];
    const prodImg = getProductImg(curM7Prod.sku);

    return {
      headerActions: [
        { label: "← 返回商品文案", primary: false, onClick: () => goPage("m7a") },
        { label: "下一步：短视频制作 →", primary: false, onClick: () => goPage("m7c") },
        {
          label: "✨ 提交图片生成任务（1大4小套图）", primary: true,
          disabled: !canCreate,
          disabledTitle: "需要「内容创作 / 审核人员」或主管权限",
          onClick: () => {
            runAsyncTask("m7_img_batch", {
              label: `商品主图与套图生成任务 · ${curM7Prod.sku}`,
              steps: ["排队等待图片生成服务响应", "生成白底主图与 4 张卖点附图 (演示图模式)", "完成套图排版并更新交付清单"],
              durationMs: 1200,
              onSuccess: () => {
                state.m7ImgVersion += 1;
                state.m7Images.forEach(im => {
                  im.done = true;
                  im.editNote = `演示图（第 ${state.m7ImgVersion} 版），非真实生成`;
                });
                return { summary: `套图任务已完成（当前为演示图，非真实生成，尚未接入专业绘图服务）`, toastMsg: "套图任务已完成（注：当前未接绘图服务，显示为演示图）", toastLevel: "warn" };
              }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>外部服务连接状态：</strong>当前尚未接入专业图片生成服务（处于演示模式），下方展示的均为<strong>「演示图，非真实生成」</strong>，请勿直接当作最终商业精修图上架。</span>
        </div>

        ${renderAsyncBox("m7_img_batch")}

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">商品套图制作要求</div></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <img src="${prodImg}" class="prod-thumb-img" alt="${curM7Prod.name}"/>
              <div>
                <strong>${curM7Prod.sku} · ${curM7Prod.name}</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Platform} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 主管已同意测款":"在售老品翻新"}</div>
              </div>
            </div>
            <div class="field"><label>套图制作模板</label>
              <select id="m7ImgWfSel" class="select">
                <option ${state.m7ImgWorkflow.includes("白底")?"selected":""}>标准白底主图模板 (未接入外部绘图服务 · 演示图)</option>
                <option ${state.m7ImgWorkflow.includes("场景")?"selected":""}>1 张主图 + 4 张卖点场景附图模板 (演示图)</option>
              </select>
            </div>
            <div class="field"><label>画面设计要求说明</label><textarea class="textarea">纯白背景，商品主体占画面 85%，光线柔和清晰，无多余文字水印。</textarea></div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>当前选中图位：</strong>${pickedImg.label}<br/>
              当前状态：<strong>${pickedImg.done ? "已生成演示图" : "缺图待制作"}</strong>（${pickedImg.editNote}）
            </div>
            <button class="btn btn-primary" id="m7EditPickedBtn" style="width:100%;justify-content:center;margin-bottom:8px;" ${!canCreate?"disabled":""}>✏️ 局部修改当前选中图位（保留其余4张）</button>
            <button class="btn btn-sm" id="m7GotoM7d" style="width:100%;justify-content:center;">前往 M7-4 查看 8 类交付清单 →</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">1 张主图 + 4 张详情附图陈列（第 ${state.m7ImgVersion} 版）</div>
              <span class="pill p-amber">演示图，非真实生成</span>
            </div>

            <div class="gallery-1plus4">
              ${(() => {
                const m = state.m7Images[0];
                return `
                  <div class="gal-tile large ${state.m7PickedImgIdx===0?"picked":""}" data-imgi="0">
                    <div class="gal-canvas">
                      <img src="${prodImg}" style="width:155px;height:155px;border-radius:12px;" alt="商品主图 1"/>
                      <span class="pill p-amber" style="position:absolute;bottom:8px;right:8px;">演示图，非真实生成</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <div><strong>${m.label}</strong> <span style="font-size:12px;color:var(--text-soft)">${m.editNote}</span></div>
                      <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"已就绪":"待补齐"}</span>
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
                        <img src="${prodImg}" style="width:68px;height:68px;opacity:${m.done?0.92:0.35};border-radius:8px;" alt="${m.label}"/>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                        <strong style="font-size:12px;">${m.label}</strong>
                        <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"演示图✓":"缺"}</span>
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
            title: `局部修改图位 · ${pickedImg.label}`,
            summary: "仅针对当前选中的这一张图重新调整，其余 4 张合格图片完整保留不覆盖。",
            confirmText: "提交局部修改任务",
            fieldsHtml: `<div class="field"><label>局部修改要求说明 *</label><textarea id="inpaintPrompt" class="textarea">去掉多余反光标签，提亮产品主体的边缘质感</textarea></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#inpaintPrompt");
              return el.value.trim() ? [] : [{ el, msg: "请填写局部修改要求" }];
            },
            onConfirm: () => {
              state.m7ImgVersion += 1;
              pickedImg.done = true;
              pickedImg.editNote = `局部修改演示图（第 ${state.m7ImgVersion} 版），非真实生成`;
              return { toastMsg: `已完成「${pickedImg.label}」局部修改演示（其余 4 张图保持不变）` };
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

  // ==================== M7-3: 短视频制作（进度条 + 分镜→生成→合成阶段日志） ====================
  if (pageId === "m7c") {
    const canCreate = state.role === "creator" || state.role === "approver";
    const isFailMode = state.m7VidWorkflow.includes("未配置");

    return {
      headerActions: [
        { label: "← 返回主图套图", primary: false, onClick: () => goPage("m7b") },
        { label: "前往上架前合规检查 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>外部视频服务状态：</strong>默认状态为「未配置视频生成节点」，直接提交将如实显示失败原因并停止输出；您也可以切换为「模拟已配置服务」体验完整的「分镜脚本 → 画面生成 → 成片合成」进度与日志。</span>
        </div>

        ${renderAsyncBox("m7_vid")}

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">短视频脚本与节点设置</div></div>
            <div class="field"><label>制作商品</label><input class="input" readonly value="${curM7Prod.sku} · ${curM7Prod.name}" /></div>
            <div class="field">
              <label>选择短视频脚本风格</label>
              <div class="grid-2" style="gap:8px;">
                ${["产品展示", "开箱测评", "场景种草", "卖点快剪"].map(vt => `
                  <div class="option-tile ${state.m7VidType===vt?"active":""} m7-vtype" data-t="${vt}"><strong style="font-size:12.5px;">${vt}</strong></div>
                `).join("")}
              </div>
            </div>
            <div class="field"><label>视频生成服务连接状态</label>
              <select id="m7VidWfSel" class="select">
                <option value="fail" ${isFailMode?"selected":""}>未配置视频生成节点（默认 · 测试如实报错）</option>
                <option value="ok" ${!isFailMode?"selected":""}>模拟已配置视频服务（体验分镜→生成→合成进度）</option>
              </select>
            </div>
            <button class="btn btn-primary" id="m7GenVidBtn" style="width:100%;justify-content:center;" ${!canCreate?"disabled":""}>▶ 提交短视频生成任务</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">视频制作进度与阶段日志</div>
              <span class="pill ${state.m7VidDone?"p-green":"p-red"}">${state.m7VidDone?"演示视频已就绪":"未配置视频节点"}</span>
            </div>
            ${!state.m7VidDone ? `
              <div class="banner banner-red">
                <span><strong>发生了什么：</strong>后台尚未接入外部视频生成服务，无法生成真实短视频文件。<strong>影响范围：</strong>仅影响本页短视频生成。<strong>怎么处理：</strong>请联系系统管理员配置视频生成节点，或在左侧切换「模拟已配置视频服务」体验制作流程。</span>
              </div>
            ` : `
              <div class="grid-2">
                <div class="media-card picked">
                  <div class="media-preview dark">
                    <div style="font-size:26px;">▶</div>
                    <strong>15秒竖屏演示视频 (${state.m7VidType})</strong>
                    <span style="font-size:12px;color:#cbd5e1">演示模拟预览，非真实成片</span>
                  </div>
                  <div style="font-weight:700;">产品种草视频（关联商品主图 1）</div>
                  <div style="font-size:12px;color:var(--amber-text);margin:4px 0 8px;">说明：纯前端演示流程，正式成片需接通外部视频渲染节点</div>
                  <button class="btn btn-primary btn-sm" id="m7UseVidBtn">写入上架交付清单 →</button>
                </div>
                <div class="media-card">
                  <div style="font-weight:700;margin-bottom:6px;">制作阶段执行日志</div>
                  <div style="font-size:12.5px;color:var(--text-muted);line-height:1.8;">
                    ${(state.m7VidLogs.length ? state.m7VidLogs : ["• 等待提交制作任务"]).join("<br/>")}
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
          state.m7VidWorkflow = e.target.value === "fail" ? "未配置视频生成节点（默认如实报错）" : "模拟已配置视频服务（分镜→生成→合成）";
          if (e.target.value === "fail") state.m7VidDone = false;
          rerender();
        };
        document.getElementById("m7GenVidBtn").onclick = () => {
          const failNow = state.m7VidWorkflow.includes("未配置");
          runAsyncTask("m7_vid", {
            label: `短视频制作任务 · ${curM7Prod.sku} (${state.m7VidType})`,
            steps: ["1. 分镜脚本准备与主图载入", "2. 视频画面生成处理中", "3. 字幕配乐成片合成"],
            durationMs: 1300,
            shouldFail: failNow,
            failReason: "视频生成服务未配置，系统已如实停止输出，不会生成打不开的空文件。",
            onFail: () => { state.m7VidDone = false; },
            onSuccess: () => {
              state.m7VidDone = true;
              state.m7VidLogs = [
                `• [${nowDateTimeStr()}] 阶段 1/3：分镜脚本准备完成（${state.m7VidType}）`,
                `• [${nowDateTimeStr()}] 阶段 2/3：视频画面生成完成（共 15 秒竖屏镜头）`,
                `• [${nowDateTimeStr()}] 阶段 3/3：成片合成完成（演示预览），已点亮 M7-4 交付清单`
              ];
              return { summary: `短视频演示流程完成（分镜→生成→合成）`, toastMsg: "短视频制作流程已完成（演示模式）" };
            }
          });
        };
        const uv = document.getElementById("m7UseVidBtn");
        if (uv) uv.onclick = () => goPage("m7d");
      }
    };
  }

  // ==================== M7-4: 上架前 8 项交付清单与合规把关 ====================
  if (pageId === "m7d") {
    const isApprover = state.role === "approver";
    const isCreator = state.role === "creator" || isApprover;
    const auxDoneCount = state.m7Images.slice(1).filter(i => i.done).length;
    const missingAux = state.m7Images.slice(1).filter(i => !i.done).map(i => i.label);

    const checklist = [
      { label: "1. 商品标题", sub: state.m7SelectedTitle ? state.m7SelectedTitle.slice(0, 36) + "..." : "尚未选定标题（去文案页选取）", done: !!state.m7SelectedTitle, jump: "m7a" },
      { label: "2. 五点卖点描述", sub: state.m7SelectedBullets ? state.m7SelectedBullets.slice(0, 36) + "..." : "尚未选定五点描述", done: !!state.m7SelectedBullets, jump: "m7a" },
      { label: "3. 商品详情描述", sub: state.m7SelectedDesc ? state.m7SelectedDesc.slice(0, 36) + "..." : "尚未选定商品描述", done: !!state.m7SelectedDesc, jump: "m7a" },
      { label: "4. 后台搜索词", sub: state.m7SelectedKeywords ? state.m7SelectedKeywords.slice(0, 36) + "..." : "缺少 20 个研究搜索词", done: !!state.m7SelectedKeywords, jump: "m7a" },
      { label: "5. 商品主图 1 (白底)", sub: state.m7Images[0].done ? state.m7Images[0].editNote : "缺少商品主图 1", done: state.m7Images[0].done, jump: "m7b" },
      { label: `6. 详情附图 (${auxDoneCount}/4张)`, sub: auxDoneCount === 4 ? "附图 2~5 已全部就绪" : `缺少：${missingAux.join("、")}（点此去补全）`, done: auxDoneCount === 4, jump: "m7b" },
      { label: "7. A+ 图文页面", sub: state.m7AplusDone ? "图文详情模块已就绪 ✓" : "暂未制作 A+ 图文（点此一键补齐）", done: state.m7AplusDone, jump: "aplus" },
      { label: "8. 商品种草短视频", sub: state.m7VidDone ? `15秒演示预览 (${state.m7VidType})` : "尚未生成或节点未配置（点此前往处理）", done: state.m7VidDone, jump: "m7c" },
    ];
    const doneCnt = checklist.filter(c => c.done).length;
    const prodImg = getProductImg(curM7Prod.sku);

    return {
      headerActions: [
        { label: "← 补齐主图与附图", primary: false, onClick: () => goPage("m7b") },
        {
          label: "📦 导出离线合规资料包", primary: true,
          disabled: state.m7ComplianceStatus !== "主管已批准导出",
          disabledTitle: "必须先完成「运行上架合规检查」并由「主管 / 审批人」批准才可导出",
          onClick: () => {
            commitAction({
              title: `导出离线合规资料包 · ${curM7Prod.sku}`,
              summary: "安全说明：仅导出离线资料包清单供运营人工上传电商后台，系统绝不直接修改线上在售店铺！",
              confirmText: "确认导出资料包清单",
              fieldsHtml: `
                <div class="formula-box">
                  • <strong>归属商品：</strong>${curM7Prod.sku} · ${curM7Prod.name}<br/>
                  • <strong>批准主管：</strong>${state.m7ApprovalRecord?.approver}（${state.m7ApprovalRecord?.time}）<br/>
                  • <strong>导出包清单 (${doneCnt}/8 类)：</strong><br/>
                  &nbsp;&nbsp;- 商品多语言文案包.xlsx<br/>
                  &nbsp;&nbsp;- 主图与详情套图包（共 ${auxDoneCount + 1} 张演示图）<br/>
                  ${state.m7AplusDone ? "&nbsp;&nbsp;- A+图文详情模块.html<br/>" : ""}
                  ${state.m7VidDone ? "&nbsp;&nbsp;- 商品种草短视频_15s.mp4（演示预览）<br/>" : ""}
                </div>
              `,
              onConfirm: () => ({ toastMsg: `已导出 ${curM7Prod.sku} 离线合规资料包 (${doneCnt}/8 类资产)` }),
              audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 导出了 ${curM7Prod.sku} 的离线合规上架资料包（共 ${doneCnt}/8 类资产）`, ok: true }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>上架把关规则：</strong>先逐条运行合规检查，再由主管批准并填写审批记录后才可导出资料包（严禁系统自动直推改写线上店铺）。</span>
          <span class="pill ${doneCnt===8?"p-green":"p-amber"}">交付清单完整度：${doneCnt} / 8 类</span>
        </div>

        <div class="split-right-panel">
          <div class="card">
            <div class="card-header">
              <div>
                <strong style="font-size:16px;">${curM7Prod.sku} · ${curM7Prod.name} (${state.m7Platform}) 成品预览</strong>
                <div style="font-size:12px;color:var(--text-soft);">${state.m7Lang} · ${curM7Prod.origin==="M4_APPROVED"?"✓ 来自 M4 主管已同意测款":"在售老品翻新"}</div>
              </div>
              <span class="pill p-blue">成品总览</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["主图/附图", "商品文案", "后台搜索词", "种草视频"].map(tb => `
                <div class="utab ${state.m7PreviewTab===tb?"active":""} m7d-ptab" data-t="${tb}">${tb}</div>
              `).join("")}
            </div>

            ${state.m7PreviewTab === "主图/附图" ? `
              <div class="gallery-1plus4">
                <div class="gal-tile large picked">
                  <div class="gal-canvas"><img src="${prodImg}" style="width:155px;height:155px;border-radius:12px;" alt="商品主图 1"/></div>
                  <div style="font-size:12.5px;"><strong>${state.m7Images[0].label}</strong> (${state.m7Images[0].editNote})</div>
                </div>
                <div class="gallery-4small">
                  ${state.m7Images.slice(1).map(m => `
                    <div class="gal-tile">
                      <div class="gal-canvas"><img src="${prodImg}" style="width:60px;height:60px;opacity:${m.done?0.9:0.25};border-radius:8px;" alt="${m.label}"/></div>
                      <span style="font-size:12px;">${m.label} ${m.done?"✓":"(缺)"}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : state.m7PreviewTab === "商品文案" ? `
              <div style="display:flex;flex-direction:column;gap:10px;background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <div><span class="pill p-blue">商品标题</span><div style="font-weight:700;margin-top:4px;">${state.m7SelectedTitle}</div></div>
                <div><span class="pill p-blue">五点描述</span><div style="margin-top:4px;">${state.m7SelectedBullets}</div></div>
                <div><span class="pill p-blue">商品详情描述</span><div style="margin-top:4px;">${state.m7SelectedDesc}</div></div>
              </div>
            ` : state.m7PreviewTab === "后台搜索词" ? `
              <div style="background:#f8fafc;padding:14px;border-radius:9px;border:1px solid var(--border);">
                <span class="pill p-purple">后台搜索词</span>
                <div style="margin-top:8px;">${state.m7SelectedKeywords}</div>
              </div>
            ` : `
              <div class="media-preview dark" style="height:220px;border-radius:9px;">
                <div style="font-size:28px;">▶</div>
                <strong>${state.m7VidDone ? `15秒演示预览 (${state.m7VidType})` : "短视频尚未生成或节点未配置"}</strong>
              </div>
            `}
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">8 类上架交付清单（缺项点击即可直达补齐）</div>
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
                <div class="card-title">逐条合规检查与主管把关</div>
                <span class="pill ${state.m7ComplianceStatus==="主管已批准导出"?"p-green":state.m7ComplianceStatus==="合规校验通过"?"p-blue":"p-amber"}">${state.m7ComplianceStatus}</span>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.7;">
                ${state.m7ComplianceChecks.length ? state.m7ComplianceChecks.map(ch => `<div>• <strong>${ch.rule}：</strong><span style="color:${ch.pass?"var(--green-text)":"var(--red-text)"}">${ch.detail}</span></div>`).join("") : "尚未运行合规检查，请先点击下方「1. 运行上架合规检查」。"}
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
        document.querySelectorAll(".m7d-ptab").forEach(t => t.onclick = () => { state.m7PreviewTab = t.dataset.t; rerender(); });
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
            .filter(w => new RegExp(w, "i").test(state.m7SelectedTitle + " " + state.m7SelectedBullets));
          const maxL = state.m7Platform.includes("虾皮") ? 120 : state.m7Platform.includes("TikTok") ? 150 : 200;
          const titleOk = state.m7SelectedTitle.length <= maxL;
          state.m7ComplianceChecks = [
            { rule: "广告违禁词检查", pass: banFound.length === 0, detail: banFound.length ? `不通过：发现违禁词「${banFound.join("、")}」` : "通过：未发现任何平台违禁词 ✓" },
            { rule: "平台标题字数限制", pass: titleOk, detail: titleOk ? `通过：当前 ${state.m7SelectedTitle.length} 字（上限 ${maxL} 字）✓` : `不通过：标题已超出 ${maxL} 字限制` },
            { rule: "8 类上架资产完整度", pass: doneCnt === 8, detail: doneCnt === 8 ? "通过：8 类交付物全部就绪 ✓" : `提醒：当前 ${doneCnt}/8 已就绪，仍缺 ${checklist.filter(c=>!c.done).map(c=>c.label).join("、")}` },
          ];
          state.m7ComplianceStatus = (banFound.length === 0 && titleOk) ? "合规校验通过" : "校验未通过";
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 对 ${curM7Prod.sku} 执行了上架前合规检查，结果：${state.m7ComplianceStatus}（${doneCnt}/8 类就绪）`, ok: banFound.length === 0 && titleOk });
          rerender();
          toast(state.m7ComplianceStatus === "合规校验通过" ? `合规检查通过（${doneCnt}/8 类就绪，请主管批准）` : "合规检查未通过，请查看红色不通过原因", state.m7ComplianceStatus === "合规校验通过" ? "success" : "error");
        };

        document.getElementById("m7ApprPubBtn").onclick = () => {
          commitAction({
            title: `主管批准上架资料包 · ${curM7Prod.sku}`,
            summary: `当前完成度 ${doneCnt}/8 类；批准后将记录审批人、审批时间并解锁「导出离线合规资料包」按钮。`,
            confirmText: "确认批准导出",
            fieldsHtml: `<div class="field"><label>主管审批意见 *</label><input id="m7ApprNote" class="input" value="用语合规无违禁词，准予导出资料包交付上架"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m7ApprNote");
              return el.value.trim() ? [] : [{ el, msg: "请填写主管审批意见" }];
            },
            onConfirm: (wrap) => {
              state.m7ComplianceStatus = "主管已批准导出";
              state.m7ApprovalRecord = { approver: ROLE_PERSON_NAMES[state.role], time: nowDateTimeStr(), note: wrap.querySelector("#m7ApprNote").value.trim() };
              return { toastMsg: `主管已批准导出 ${curM7Prod.sku} 资料包，点击右上角即可导出` };
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
        <div class="banner ${canManage?"banner-green":"banner-amber"}">
          <span>${canManage
            ? "组织管理权限已解锁：新增员工校验工号唯一与邮箱格式，调岗与停用账号均须二次确认并实时记录到 M8-2 审计台账。"
            : "当前登录岗位为只读模式：新增员工、调岗与停用需要「大屏浏览者 / 管理者」或「主管 / 审批人」权限。"}</span>
        </div>

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
        <div class="banner banner-blue">
          <span><strong>只读权限矩阵与操作审计台账：</strong>本页矩阵仅供核对（切换体验岗位请统一使用左上角「当前登录岗位」下拉框）；下方每条审计记录均为通俗可读的中文留痕，含越权拦截记录。当前高亮岗位：<strong>${curRoleObj.label}</strong></span>
        </div>

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
