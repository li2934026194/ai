import { SRS_ROLES } from "./state.js";

const MATRIX_ROWS = [
  ["01 M8 员工名册与角色授权", "★ 本组权限", "★ 全局授权", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止", "— 禁止"],
  ["02 M0-1 店铺 OAuth 与主数据", "○ 查看状态", "★ 店铺授权", "◆ 维护成本卡", "○ 只读统计", "○ 查商品基础", "○ 查商品卖点", "○ 查SKU规格", "○ 本店订单", "— 禁止"],
  ["03 M0-3 分店独立库存校准", "○ 查看水位", "○ 查看水位", "○ 只读参考", "○ 只读参考", "— 禁止", "— 禁止", "◆ 盘点/校准", "— 禁止", "— 禁止"],
  ["04 M1-2 推荐商品库 (XLSX→向量)", "○ 查看目录", "— 禁止", "◆ 导入/维护", "— 禁止", "— 禁止", "○ 参考卖点", "— 禁止", "○ 检索Top-3", "— 禁止"],
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
  return `<span style="color:#94a3b8;font-size:11.3px;">${cell}</span>`;
}

export function renderM7_M8(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, rerender } = helpers;

  // ==================== M7a: Listing Copywriting ====================
  if (pageId === "m7a") {
    return {
      headerActions: [
        { label: "去 AI 商品主图 (1大4小) →", primary: false, onClick: () => goPage("m7b") },
        { label: "✨ 重新生成文案草稿", primary: true, onClick: () => { state.m7CopyGenCount += 1; rerender(); toast("已按任务卡约束生成新一版多语言草稿"); } }
      ],
      html: `
        <div class="stepper">
          <div class="step-item done">① 商品事实与任务卡约束</div>
          <div class="step-item active">② 生成4类文案并选入清单</div>
          <div class="step-item">③ 前往 M7-4 整套交付校验</div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 商品与任务卡约束</div></div>
            <div class="field"><label>选择商品</label>
              <select id="m7ProdSel" class="select">
                <option value="MAT-014" ${state.m7Sku==="MAT-014"?"selected":""}>MAT-014 · 桌面皮质收纳垫</option>
                <option value="BAG-108" ${state.m7Sku==="BAG-108"?"selected":""}>BAG-108 · 轻量通勤双肩包</option>
                <option value="FAN-203" ${state.m7Sku==="FAN-203"?"selected":""}>FAN-203 · 便携静音循环扇</option>
              </select>
            </div>
            <div class="grid-2" style="gap:8px;">
              <div class="field"><label>目标平台</label><select id="m7PlatSel" class="select"><option ${state.m7Platform==="Amazon US"?"selected":""}>Amazon US</option><option ${state.m7Platform==="Shopee TH"?"selected":""}>Shopee TH</option><option ${state.m7Platform==="TikTok Shop"?"selected":""}>TikTok Shop</option></select></div>
              <div class="field"><label>语言</label><select id="m7LangSel" class="select"><option ${state.m7Lang==="English (US)"?"selected":""}>English (US)</option><option ${state.m7Lang==="简体中文"?"selected":""}>简体中文</option></select></div>
            </div>
            <div class="field"><label><span class="anno-tag t-green">2</span> 必用术语（逗号分隔）</label><input id="m7MustTerm" class="input" value="${state.m7MustTerm}"/></div>
            <div class="field"><label>排除词 / 广告违禁词</label><input id="m7BanTerm" class="input" value="${state.m7BanTerm}"/></div>
            <button class="btn btn-primary" id="m7GenCopyBtn" style="width:100%;justify-content:center;">✨ 生成第 ${state.m7CopyGenCount + 1} 版全套文案</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-purple">3</span> ${state.m7Sku} 草稿结果（按区块写入 M7-4 交付清单）</div>
              <span class="pill p-green">必用词 ✓ · 禁忌词 0 命中</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["商品标题", "五点描述", "商品描述", "后台搜索词"].map(tb => `
                <div class="utab ${state.m7ResultTab===tb?"active":""} m7-rtab" data-tab="${tb}">${tb}</div>
              `).join("")}
            </div>

            <div style="display:flex;flex-direction:column;gap:9px;">
              ${[1, 2, 3].map(i => {
                const txt = state.m7ResultTab === "商品标题"
                  ? `${state.m7Sku} | ${state.m7MustTerm} Desk Mat for Office & Home (Draft v${state.m7CopyGenCount}-${i})`
                  : state.m7ResultTab === "五点描述"
                    ? `• [Bullet ${i}] ${state.m7MustTerm} surface protects your desk against spills and scratches.`
                    : state.m7ResultTab === "商品描述"
                      ? `Crafted with ${state.m7MustTerm}, ${state.m7Sku} upgrades any workspace (${state.m7Platform} v${state.m7CopyGenCount}-${i}).`
                      : `waterproof desk mat, pu leather office pad, large mouse mat, ${state.m7Sku.toLowerCase()} (20个研究词 #${i})`;
                return `
                  <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:220px;">
                      <div style="font-weight:700;">${txt}</div>
                      <div style="font-size:11.2px;color:var(--green-text);margin-top:2px;">创作提示：必用词命中 ✓ · 排除词(${state.m7BanTerm}) 0处（正式送检见 M7-4）</div>
                    </div>
                    <button class="btn btn-primary btn-sm m7-pick-copy" data-txt="${txt}">写入交付清单 ✓</button>
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
          state.m7CopyGenCount += 1; rerender(); toast("已生成新一轮文案草稿");
        };
        document.querySelectorAll(".m7-pick-copy").forEach(b => b.onclick = () => {
          const val = b.dataset.txt;
          if (state.m7ResultTab === "商品标题") state.m7SelectedTitle = val;
          else if (state.m7ResultTab === "五点描述") state.m7SelectedBullets = val;
          else if (state.m7ResultTab === "商品描述") state.m7SelectedDesc = val;
          else state.m7SelectedKeywords = val;
          toast(`已将「${state.m7ResultTab}」写入 M7-4 整套交付清单！`);
        });
      }
    };
  }

  // ==================== M7b: 1-Large + 4-Small ComfyUI Gallery (Reference Image 30) ====================
  if (pageId === "m7b") {
    const pickedImg = state.m7Images[state.m7PickedImgIdx] || state.m7Images[0];
    return {
      headerActions: [
        { label: "← Listing 文案", primary: false, onClick: () => goPage("m7a") },
        { label: "去 AI 短视频 →", primary: false, onClick: () => goPage("m7c") },
        { label: "✨ ComfyUI 批量重绘 5 张套图", primary: true, onClick: () => {
          state.m7ImgSeed += 1;
          state.m7Images.forEach(im => { im.done = true; });
          rerender(); toast("ComfyUI 已出图 1主图+4附图（MIME 校验 image/png 通过）");
        } }
      ],
      html: `
        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> ComfyUI 视觉工作流参数</div></div>
            <div class="field"><label>目标商品</label><input class="input" readonly value="${state.m7Sku} · ${state.m7Platform}" /></div>
            <div class="field"><label>工作流版本</label>
              <select id="m7ImgWfSel" class="select">
                <option ${state.m7ImgWorkflow.includes("白底")?"selected":""}>Amazon 白底主图 · v3 (ComfyUI)</option>
                <option ${state.m7ImgWorkflow.includes("场景")?"selected":""}>电商 1大+4小 套图流水线 · v4</option>
              </select>
            </div>
            <div class="field"><label>Prompt 规范约束</label><textarea class="textarea">纯白背景 (#FFFFFF)，主体占画面 85%，柔和棚拍光影，无多余水印，真实校验 image/png。</textarea></div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>当前选中图位：</strong>${pickedImg.code}<br/>
              状态：<strong>${pickedImg.done ? "已生成 image/png ✓" : "待补生成"}</strong>（${pickedImg.editNote}）
            </div>
            <button class="btn btn-primary" id="m7EditPickedBtn" style="width:100%;justify-content:center;margin-bottom:8px;">✏️ 局部修改当前选中图位</button>
            <button class="btn btn-sm" id="m7GotoM7d" style="width:100%;justify-content:center;">前往 M7-4 查看整套交付清单 →</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-green">2</span> 电商套图陈列（01 白底主图 + 02~05 四张产品附图 · Seed #${state.m7ImgSeed}）</div>
              <span class="pill p-green">真实 PNG 二进制校验</span>
            </div>

            <div class="gallery-1plus4">
              <!-- Large: 01 Main White Background -->
              ${(() => {
                const m = state.m7Images[0];
                return `
                  <div class="gal-tile large ${state.m7PickedImgIdx===0?"picked":""}" data-imgi="0">
                    <div class="gal-canvas">
                      <svg viewBox="0 0 220 150" style="width:200px;height:140px;">
                        <rect x="25" y="25" width="170" height="96" rx="14" fill="#64748b"/>
                        <rect x="35" y="35" width="150" height="76" rx="10" fill="none" stroke="#e2e8f0" stroke-dasharray="5 4"/>
                        <text x="110" y="77" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${state.m7Sku} · 01 主图</text>
                      </svg>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <div><strong>${m.code}</strong> <span style="font-size:11px;color:var(--text-soft)">${m.editNote}</span></div>
                      <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"已就绪":"待生成"}</span>
                    </div>
                  </div>
                `;
              })()}

              <!-- Small 4: 02 Scene, 03 Selling Points, 04 Dimensions, 05 Package -->
              <div class="gallery-4small">
                ${state.m7Images.slice(1).map((m, idx) => {
                  const realIdx = idx + 1;
                  return `
                    <div class="gal-tile ${state.m7PickedImgIdx===realIdx?"picked":""}" data-imgi="${realIdx}">
                      <div class="gal-canvas" style="background:${realIdx===1?"#f1f5f9":"#ffffff"};">
                        <svg viewBox="0 0 140 80" style="width:120px;height:68px;">
                          <rect x="18" y="14" width="104" height="52" rx="8" fill="${realIdx===2?"#475569":realIdx===3?"#334155":"#64748b"}"/>
                          <text x="70" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">${m.code.split("/")[1].trim()}</text>
                        </svg>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                        <strong style="font-size:11.5px;">${m.code}</strong>
                        <span class="pill ${m.done?"p-green":"p-amber"}">${m.done?"✓":"缺"}</span>
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
          openModal(`局部修改 · ${pickedImg.code}（保留其余合格套图不变）`, `
            <div class="banner banner-blue" style="margin-bottom:10px;">遵循 SRS M04-A05：仅重绘当前选中图位，不重写其他 4 张合格主图/附图！</div>
            <div class="field"><label>局部重绘指令 (Inpainting / Prompt)</label><textarea id="inpaintPrompt" class="textarea">移除右下角多余品牌标识，增强桌面防水水珠反光质感</textarea></div>
            <button class="btn btn-primary" id="runInpaintBtn" style="width:100%;justify-content:center;">下发 ComfyUI 局部重绘并更新套图</button>
          `, () => {
            document.getElementById("runInpaintBtn").onclick = () => {
              pickedImg.done = true;
              pickedImg.editNote = "局部重绘 v2";
              closeModal(); rerender();
              toast(`已完成「${pickedImg.code}」局部修改并保留其余附图不变`);
            };
          });
        };
      }
    };
  }

  // ==================== M7c: ComfyUI Short Video ====================
  if (pageId === "m7c") {
    return {
      headerActions: [
        { label: "← AI 商品主图", primary: false, onClick: () => goPage("m7b") },
        { label: "前往整套交付与合规审核 →", primary: true, onClick: () => goPage("m7d") }
      ],
      html: `
        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 短视频生成参数（img_097）</div></div>
            <div class="field"><label>目标商品</label><input class="input" readonly value="${state.m7Sku} · ${state.m7Platform}" /></div>
            <div class="field">
              <label>视频脚本类型</label>
              <div class="grid-2" style="gap:8px;">
                ${["产品展示", "开箱测评", "场景种草", "卖点快剪"].map(vt => `
                  <div class="option-tile ${state.m7VidType===vt?"active":""} m7-vtype" data-t="${vt}"><strong style="font-size:12px;">${vt}</strong></div>
                `).join("")}
              </div>
            </div>
            <div class="field"><label>视频工作流状态</label>
              <select id="m7VidWfSel" class="select">
                <option value="ok" ${state.m7VidWorkflow.includes("SVD")?"selected":""}>SVD 图生视频 · 15s 竖屏工作流 (已配置)</option>
                <option value="fail" ${state.m7VidWorkflow.includes("未配置")?"selected":""}>模拟未配置 ComfyUI 视频节点 (测试报错)</option>
              </select>
            </div>
            <button class="btn btn-primary" id="m7GenVidBtn" style="width:100%;justify-content:center;">▶ 下发 /prompt 并轮询 /sync</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="anno-tag t-green">2</span> 渲染状态与 MP4 校验结果</div>
              <span class="pill ${state.m7VidDone?"p-green":"p-red"}">${state.m7VidDone?"video/mp4 已入库 ✓":"FAILED：未配置节点"}</span>
            </div>
            ${!state.m7VidDone ? `
              <div class="banner banner-red">
                <span>SRS AC-GC-02 诚实边界：ComfyUI 未检测到有效 SVD 视频节点或返回空输出，已标记 FAILED 并记录错误，绝不生成占位假视频！</span>
              </div>
            ` : `
              <div class="grid-2">
                <div class="media-card picked">
                  <div class="media-preview dark">
                    <div style="font-size:24px;">▶</div>
                    <strong>15s 竖屏 MP4 (${state.m7VidType})</strong>
                    <span style="font-size:11px;color:#94a3b8">1080 × 1920 · 30fps · /view 下载</span>
                  </div>
                  <div style="font-weight:700;">产品种草视频（已关联 01 主图）</div>
                  <div style="font-size:11.5px;color:var(--green-text);margin:4px 0 8px;">MIME video/mp4 校验通过 ✓</div>
                  <button class="btn btn-primary btn-sm" id="m7UseVidBtn">确认写入交付清单 →</button>
                </div>
                <div class="media-card">
                  <div style="font-weight:700;margin-bottom:6px;">/sync 异步追踪日志</div>
                  <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
                    • POST /prompt → prompt_id: <code>svd-9921a</code><br/>
                    • GET /sync → /history/svd-9921a COMPLETED<br/>
                    • GET /view → 二进制字节存入 <code>GenerationMedia</code><br/>
                    • 已点亮 M7-4「产品种草视频」交付项 ✓
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
          if (e.target.value === "fail") {
            state.m7VidWorkflow = "未配置节点";
            state.m7VidDone = false;
            toast("已触发 SRS AC-GC-02：ComfyUI 视频节点未配置，返回真实 FAILED");
          } else {
            state.m7VidWorkflow = "SVD 图生视频 · 15s 竖屏工作流";
            state.m7VidDone = true;
            toast("SVD 工作流就绪，MP4 已入库");
          }
          rerender();
        };
        document.getElementById("m7GenVidBtn").onclick = () => {
          if (state.m7VidWorkflow === "未配置节点") { toast("ComfyUI 报错：节点缺失，请先配置工作流"); return; }
          state.m7VidDone = true; rerender(); toast("/sync 返回 COMPLETED，MP4 已入库并同步至 M7-4");
        };
        const uv = document.getElementById("m7UseVidBtn");
        if (uv) uv.onclick = () => goPage("m7d");
      }
    };
  }

  // ==================== M7d: Full 8-Item Delivery Checklist & Compliance (Reference Image 30) ====================
  if (pageId === "m7d") {
    const isApprover = state.role === "approver";
    const isCreator = state.role === "creator" || isApprover;
    const auxDoneCount = state.m7Images.slice(1).filter(i => i.done).length;
    const checklist = [
      { label: "标题", sub: state.m7SelectedTitle.slice(0, 32) + "...", done: !!state.m7SelectedTitle, jump: "m7a" },
      { label: "五点描述", sub: state.m7SelectedBullets.slice(0, 32) + "...", done: !!state.m7SelectedBullets, jump: "m7a" },
      { label: "商品描述", sub: state.m7SelectedDesc.slice(0, 32) + "...", done: !!state.m7SelectedDesc, jump: "m7a" },
      { label: "后台搜索词 · 20个研究词", sub: state.m7SelectedKeywords.slice(0, 32) + "...", done: !!state.m7SelectedKeywords, jump: "m7a" },
      { label: "白底主图 (01)", sub: `image/png · ${state.m7Images[0].editNote}`, done: state.m7Images[0].done, jump: "m7b" },
      { label: `产品附图 (${auxDoneCount}/4张)`, sub: auxDoneCount === 4 ? "02~05 全部就绪" : "缺 05/包装清单，点击前往补全", done: auxDoneCount === 4, jump: "m7b" },
      { label: "A+ 页面", sub: state.m7AplusDone ? "图文排版草稿已生成" : "暂未生成（点击一键补齐）", done: state.m7AplusDone, jump: "aplus" },
      { label: "产品种草视频", sub: state.m7VidDone ? `15s MP4 (${state.m7VidType})` : "未完成/FAILED", done: state.m7VidDone, jump: "m7c" },
    ];
    const doneCnt = checklist.filter(c => c.done).length;

    return {
      headerActions: [
        { label: "← 补齐主图/附图", primary: false, onClick: () => goPage("m7b") },
        { label: "导出整套上架资料包", primary: true, onClick: () => toast("已导出离线合规包（严守系统边界：不直接改写线上 Amazon/TikTok 店铺）") }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 合规与发布边界 (SRS §9.1)：运行独立 <code>ComplianceCheck</code> 后由「主管/审批人」批准导出，绝不自动推改线上店铺；缺项时明确提示部分完成。</span>
          <span class="pill ${doneCnt===8?"p-green":"p-amber"}">整套交付完成度：${doneCnt} / 8 类</span>
        </div>

        <div class="split-right-panel">
          <!-- Left: Real E-commerce Finished Listing Preview (Reference Image 30) -->
          <div class="card">
            <div class="card-header">
              <div>
                <strong style="font-size:15.5px;">${state.m7Sku} · ${state.m7Platform} 整套上架成品预览</strong>
                <div style="font-size:11.5px;color:var(--text-soft);">${state.m7Lang} · 跨模态资产已汇总</div>
              </div>
              <span class="pill p-blue">成品预览</span>
            </div>

            <div class="utabs" style="margin-bottom:12px;">
              ${["主图/附图", "Listing 文案", "后台搜索词", "种草视频"].map(tb => `
                <div class="utab ${state.m7PreviewTab===tb?"active":""} m7d-ptab" data-t="${tb}">${tb}</div>
              `).join("")}
            </div>

            ${state.m7PreviewTab === "主图/附图" ? `
              <div class="gallery-1plus4">
                <div class="gal-tile large picked">
                  <div class="gal-canvas">
                    <svg viewBox="0 0 220 150" style="width:190px;height:130px;">
                      <rect x="25" y="25" width="170" height="96" rx="14" fill="#64748b"/>
                      <text x="110" y="77" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${state.m7Sku} · 01主图</text>
                    </svg>
                  </div>
                  <div style="font-size:12px;"><strong>01 / 白底主图</strong> (${state.m7Images[0].editNote})</div>
                </div>
                <div class="gallery-4small">
                  ${state.m7Images.slice(1).map(m => `
                    <div class="gal-tile">
                      <div class="gal-canvas"><strong style="font-size:11.5px;color:var(--text-soft)">${m.done ? m.code : m.code + " (缺)"}</strong></div>
                      <span style="font-size:11px;">${m.title}</span>
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
                <span class="pill p-purple">后台搜索词 · 20个研究词</span>
                <div style="margin-top:8px;font-family:monospace;">${state.m7SelectedKeywords}</div>
              </div>
            ` : `
              <div class="media-preview dark" style="height:220px;border-radius:9px;">
                <div style="font-size:28px;">▶</div>
                <strong>${state.m7VidDone ? `15s 竖屏带货视频 (${state.m7VidType})` : "短视频暂未生成 / FAILED"}</strong>
              </div>
            `}
          </div>

          <!-- Right: 8-Item Delivery Checklist + Compliance Check (Reference Image 30) -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><span class="anno-tag t-green">2</span> 整套交付清单（8 类内容）</div>
                <span class="pill ${doneCnt===8?"p-green":"p-amber"}">${doneCnt}/8 已就绪</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:7px;">
                ${checklist.map(c => `
                  <div class="m7d-chk" data-jmp="${c.jump}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:${c.done?"#f8fafc":"#fffbeb"};cursor:pointer;">
                    <div style="min-width:0;">
                      <div style="font-weight:700;font-size:12.3px;">${c.label}</div>
                      <div style="font-size:11px;color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.sub}</div>
                    </div>
                    <span class="pill ${c.done?"p-green":"p-amber"}">${c.done?"已就绪 ✓":"去补齐 →"}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card card-blue">
              <div class="card-header">
                <div class="card-title"><span class="anno-tag t-purple">3</span> 内容合规校验 & 主管把关</div>
                <span class="pill ${state.m7ComplianceStatus==="主管已批准导出"?"p-green":state.m7ComplianceStatus==="校验通过"?"p-blue":"p-amber"}">${state.m7ComplianceStatus}</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                • 禁忌词 (${state.m7BanTerm}) 扫描：<strong>0 命中 ✓</strong><br/>
                • 媒体真实校验：<strong>image/png & video/mp4</strong>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" id="m7RunCompBtn" ${!isCreator?"disabled":""}>1. 运行独立 ComplianceCheck</button>
                <button class="btn btn-success btn-sm" id="m7ApprPubBtn" ${(!isApprover || state.m7ComplianceStatus!=="校验通过")?"disabled":""}>2. 主管批准发布包</button>
              </div>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m7d-ptab").forEach(t => t.onclick = () => { state.m7PreviewTab = t.dataset.t; rerender(); });
        document.querySelectorAll(".m7d-chk").forEach(el => el.onclick = () => {
          const j = el.dataset.jmp;
          if (j === "aplus") { state.m7AplusDone = true; rerender(); toast("已补充生成 A+ 页面图文模块"); }
          else goPage(j);
        });
        document.getElementById("m7RunCompBtn").onclick = () => {
          state.m7ComplianceStatus = "校验通过"; rerender();
          toast("独立 ComplianceCheck 记录已生成（校验通过，等待主管/审批人把关）");
        };
        document.getElementById("m7ApprPubBtn").onclick = () => {
          state.m7ComplianceStatus = "主管已批准导出"; rerender();
          toast("主管已批准导出上架包（严守红线：不直连改写线上店铺）");
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
        { label: "查看9角色权限矩阵 →", primary: false, onClick: () => goPage("m8b") },
        {
          label: "+ 新增员工与角色授权", primary: true, onClick: () => {
            if (!canManage) {
              state.auditLogs.unshift({ time: new Date().toTimeString().slice(0, 8), actor: state.role, target: "新增员工", action: "权限拦截 (403)", detail: "仅大屏浏览者/管理者或主管/审批人可授权", ok: false });
              rerender(); toast("权限不足：请切换为「大屏浏览者/管理者」或「主管/审批人」");
              return;
            }
            openModal("新增员工与 SRS §1.5 角色授权", `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>员工工号</label><input id="newEmpId" class="input" value="EMP-${101 + state.employees.length}" /></div>
                <div class="field"><label>员工姓名</label><input id="newEmpName" class="input" value="周宁" /></div>
              </div>
              <div class="field"><label>分配 SRS §1.5 业务角色</label>
                <select id="newEmpRole" class="select">${SRS_ROLES.map(r => `<option value="${r.key}">${r.label} (${r.code})</option>`).join("")}</select>
              </div>
              <div id="newEmpRolePreview" class="banner banner-blue" style="margin-bottom:10px;font-size:12px;"></div>
              <div class="field"><label>负责店铺 / 数据域</label><select id="newEmpShop" class="select"><option>全部实盘店铺 (Shopee TH + TikTok US)</option><option>Shopee 泰国主店</option><option>TikTok Shop 美区</option><option>仅演示沙盒 (Mock)</option></select></div>
              <button class="btn btn-primary" id="saveNewEmpBtn" style="width:100%;justify-content:center;">确认建档并写入审计台账</button>
            `, () => {
              const sel = document.getElementById("newEmpRole");
              const upd = () => { document.getElementById("newEmpRolePreview").textContent = `职责边界：${SRS_ROLES.find(r=>r.key===sel.value).desc}`; };
              sel.onchange = upd; upd();
              document.getElementById("saveNewEmpBtn").onclick = () => {
                const id = document.getElementById("newEmpId").value.trim();
                const name = document.getElementById("newEmpName").value.trim();
                const role = sel.value;
                const shop = document.getElementById("newEmpShop").value;
                const rObj = SRS_ROLES.find(r => r.key === role);
                state.employees.unshift({ id, name, role, shop, active: true, lastLogin: "刚刚建档" });
                state.auditLogs.unshift({ time: new Date().toTimeString().slice(0, 8), actor: state.role, target: `${name} (${id})`, action: "新增员工授权", detail: `授予「${rObj.label}」，范围：${shop}`, ok: true });
                closeModal(); rerender(); toast(`已新增员工 ${name}（${rObj.label}）`);
              };
            });
          }
        }
      ],
      html: `
        ${!canManage ? `
          <div class="banner banner-amber">
            <span><span class="anno-tag t-amber">1</span> 当前登录角色为只读/受限模式，新增员工与调岗需「大屏浏览者/管理者」或「主管/审批人」。</span>
            <button class="btn btn-sm btn-primary" id="m8SwitchMgrBtn">切为「大屏浏览者/管理者」体验</button>
          </div>
        ` : `<div class="banner banner-green"><span><span class="anno-tag t-amber">1</span> 组织授权权限已解锁：支持按 SRS §1.5 九大职位筛选、在线调岗与账号启停（变更自动写入审计日志）。</span></div>`}

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">在职 / 总员工数</div><div class="kpi-val" style="color:var(--blue-hover)">${activeCount} / ${state.employees.length} 人</div><div class="kpi-sub">停用账号 ${state.employees.length - activeCount} 个</div></div>
          <div class="kpi-card"><div class="kpi-label">SRS §1.5 标准角色</div><div class="kpi-val" style="color:var(--purple-text)">9 类岗位</div><div class="kpi-sub">一字不改对齐需求规格书</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">SoD 互斥冲突</div><div class="kpi-val" style="color:var(--green-text)">0 冲突</div><div class="kpi-sub">提交人与终审人严格隔离</div></div>
          <div class="kpi-card"><div class="kpi-label">审计留痕条数</div><div class="kpi-val" style="color:var(--amber-text)">${state.auditLogs.length} 条</div><div class="kpi-sub">授权变更与403拦截全记录</div></div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 按 SRS §1.5 九大角色筛选人数与明细</div></div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
            <button class="btn btn-sm ${state.m8RoleFilter==="ALL"?"btn-primary":""} m8-rflt" data-r="ALL">全部 (${state.employees.length})</button>
            ${SRS_ROLES.map(r => {
              const cnt = state.employees.filter(e => e.role === r.key).length;
              return `<button class="btn btn-sm ${state.m8RoleFilter===r.key?"btn-primary":""} m8-rflt" data-r="${r.key}">${r.label} (${cnt})</button>`;
            }).join("")}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>工号</th><th>员工姓名</th><th>SRS §1.5 职位角色 (下拉调岗)</th><th>权限组</th><th>店铺 / 数据范围</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(emp => {
                  const rObj = SRS_ROLES.find(r => r.key === emp.role) || SRS_ROLES[0];
                  return `
                    <tr>
                      <td class="nowrap"><strong>${emp.id}</strong></td>
                      <td class="nowrap"><strong>${emp.name}</strong><div style="font-size:11px;color:var(--text-soft)">${emp.lastLogin}</div></td>
                      <td>
                        <select class="select m8-emp-role" data-id="${emp.id}" ${!canManage ? "disabled" : ""} style="min-width:190px;">
                          ${SRS_ROLES.map(r => `<option value="${r.key}" ${emp.role===r.key?"selected":""}>${r.label}</option>`).join("")}
                        </select>
                      </td>
                      <td class="nowrap"><span class="pill ${rObj.pill}">${rObj.code}</span></td>
                      <td style="font-size:12px;">${emp.shop}</td>
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
        const sw = document.getElementById("m8SwitchMgrBtn");
        if (sw) sw.onclick = () => { state.role = "manager"; document.getElementById("roleSelect").value = "manager"; rerender(); };
        document.querySelectorAll(".m8-rflt").forEach(b => b.onclick = () => { state.m8RoleFilter = b.dataset.r; rerender(); });
        document.querySelectorAll(".m8-emp-role").forEach(sel => sel.onchange = (e) => {
          const emp = state.employees.find(x => x.id === sel.dataset.id);
          const oldL = SRS_ROLES.find(r => r.key === emp.role)?.label;
          emp.role = e.target.value;
          const newL = SRS_ROLES.find(r => r.key === emp.role)?.label;
          state.auditLogs.unshift({ time: new Date().toTimeString().slice(0, 8), actor: state.role, target: `${emp.name} (${emp.id})`, action: "调整员工职位", detail: `${oldL} → ${newL}`, ok: true });
          rerender(); toast(`已将 ${emp.name} 调岗为「${newL}」`);
        });
        document.querySelectorAll(".m8-emp-toggle").forEach(b => b.onclick = () => {
          const emp = state.employees.find(x => x.id === b.dataset.id);
          emp.active = !emp.active;
          state.auditLogs.unshift({ time: new Date().toTimeString().slice(0, 8), actor: state.role, target: `${emp.name} (${emp.id})`, action: emp.active ? "恢复账号" : "停用账号", detail: `状态变更为：${emp.active ? "启用中" : "已停用"}`, ok: true });
          rerender(); toast(`${emp.name} 账号已${emp.active ? "恢复启用" : "停用"}`);
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
        { label: "← 返回员工名册", primary: false, onClick: () => goPage("m8a") },
        { label: "模拟触发越权拦截", primary: true, onClick: () => {
          state.auditLogs.unshift({ time: new Date().toTimeString().slice(0, 8), actor: state.role, target: "M6-3 补货审批 RP-08", action: "SoD 拦截 (403)", detail: "提交人与审批人同为当前账号，触发职责分离保护", ok: false });
          rerender(); toast("已记录一条 SoD 越权拦截审计日志");
        } }
      ],
      html: `
        <div class="banner banner-blue">
          <span><span class="anno-tag t-blue">1</span> 点击表头任意角色即可切换当前登录角色，并实时联动左侧菜单待办角标！当前高亮：<strong>${curRoleObj.label}</strong></span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> SRS §1.5 九大业务角色 × 15 项核心功能权限矩阵</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="pill p-purple">★ 治理授权</span><span class="pill p-red">✓ 终审拍板</span><span class="pill p-blue">◆ 业务操作</span><span class="pill p-gray">○ 限域只读</span>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="min-width:190px;">功能模块 / 权限点</th>
                  ${SRS_ROLES.map((r, i) => `
                    <th style="cursor:pointer;min-width:104px;${i===activeRoleIdx?"background:#dbeafe;color:#1d4ed8;border-bottom:2px solid #2563eb;":""}" class="m8-col-switch" data-role="${r.key}">
                      ${r.label}
                      ${i===activeRoleIdx ? '<div style="font-size:10px;font-weight:800;">● 当前体验</div>' : '<div style="font-size:10px;color:#94a3b8;">点击切换</div>'}
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
          <div class="card-header"><div class="card-title" style="color:var(--purple-text);"><span class="anno-tag t-purple">3</span> 角色变更与敏感越权拦截审计日志（rbac_audit_logs）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>时间</th><th>操作人角色</th><th>目标对象</th><th>动作类型</th><th>详细说明</th><th>结果</th></tr></thead>
              <tbody>
                ${state.auditLogs.map(log => `
                  <tr>
                    <td class="nowrap">${log.time}</td>
                    <td class="nowrap"><strong>${SRS_ROLES.find(r=>r.key===log.actor)?.label || log.actor}</strong></td>
                    <td class="nowrap">${log.target}</td>
                    <td class="nowrap"><span class="pill ${log.ok?"p-blue":"p-red"}">${log.action}</span></td>
                    <td style="font-size:12px;">${log.detail}</td>
                    <td class="nowrap"><span class="pill ${log.ok?"p-green":"p-red"}">${log.ok?"已记录":"已拦截"}</span></td>
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
