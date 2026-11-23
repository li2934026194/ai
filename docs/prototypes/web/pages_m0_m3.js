export function renderM0_M3(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, rerender } = helpers;

  // ==================== M0a: Shops & Master Data ====================
  if (pageId === "m0a") {
    return {
      headerActions: [
        { label: "触发同步任务", primary: false, onClick: () => toast("已向 Shopee TH / TikTok US 下发增量拉取任务，幂等哈希去重中…") },
        { label: "+ 接入新店铺", primary: true, onClick: () => openModal("接入新跨境店铺 (OAuth2)", `
          <div class="field"><label>目标平台</label><select class="select"><option>Shopee</option><option>TikTok Shop</option><option>Amazon SP-API</option></select></div>
          <div class="field"><label>店铺名称</label><input class="input" value="Shopee 马来西亚分店"/></div>
          <div class="field"><label>接入模式</label><select class="select"><option>REAL（实盘授权）</option><option>MOCK（仅限演示沙盒）</option></select></div>
          <button class="btn btn-primary" id="saveShopBtn">保存并测试 OAuth</button>
        `, () => {
          document.getElementById("saveShopBtn").onclick = () => { closeModal(); toast("店铺 OAuth 校验成功（演示已留痕）"); };
        }) }
      ],
      html: `
        <div class="grid-3">
          <div class="kpi-card">
            <div class="kpi-label">已接入店铺 <span class="anno-tag t-blue">1</span></div>
            <div class="kpi-val" style="color:var(--blue-hover)">3 家</div>
            <div class="kpi-sub">Shopee TH / TikTok US / Amazon Mock</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">标准化订单主数据</div>
            <div class="kpi-val" style="color:var(--green-text)">1,536 单</div>
            <div class="kpi-sub">orders + order_items 统一口径</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">SKU 商品主档</div>
            <div class="kpi-val" style="color:var(--purple-text)">128 个</div>
            <div class="kpi-sub">关联 platform_sku 与多站点状态</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 店铺连接与 OAuth 凭证状态</div>
            <span class="pill p-amber">Mock 与 Real 严格隔离</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>店铺名称</th><th>平台 / 站点</th><th>模式</th><th>授权状态</th><th>最近同步</th><th>操作</th></tr></thead>
              <tbody>
                <tr><td><strong>Shopee 泰国主店</strong></td><td>SHOPEE · TH</td><td><span class="pill p-green">REAL</span></td><td><span class="pill p-green">Token有效</span></td><td>2026-11-19 10:15</td><td><button class="btn btn-sm m0-sync">立即同步</button></td></tr>
                <tr><td><strong>TikTok Shop 美区</strong></td><td>TIKTOK · US</td><td><span class="pill p-green">REAL</span></td><td><span class="pill p-green">Token有效</span></td><td>2026-11-19 10:12</td><td><button class="btn btn-sm m0-sync">立即同步</button></td></tr>
                <tr><td><strong>Amazon 演示沙盒店</strong></td><td>AMAZON · US</td><td><span class="pill p-amber">MOCK</span></td><td><span class="pill p-amber">仅限演示</span></td><td>2026-11-19 09:40</td><td><span class="pill p-gray">禁用实盘统计</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-purple">3</span> 订单与商品主数据落库明细（orders / products）</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>订单 / SKU 编号</th><th>来源店铺</th><th>状态</th><th>金额 / 数量</th><th>幂等哈希校验</th><th>下游可用模块</th></tr></thead>
              <tbody>
                <tr><td><strong>ORD-20261119-8821</strong></td><td>Shopee TH</td><td><span class="pill p-green">PAID</span></td><td>THB 1,490 / 2件</td><td>sha256:9f2a..OK</td><td>M1 / M2 / M3 / M5</td></tr>
                <tr><td><strong>SYN9D-005671</strong></td><td>Amazon Mock</td><td><span class="pill p-blue">SHIPPED</span></td><td>USD 34.50 / 1件</td><td>sha256:3c1d..OK</td><td>仅演示(不计实利)</td></tr>
                <tr><td><strong>SKU: BAG-108</strong></td><td>全平台主档</td><td><span class="pill p-green">ACTIVE</span></td><td>成本 $6.8 / 售价 $34.5</td><td>version: v4</td><td>M4 / M5 / M6 / M7</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m0-sync").forEach(b => b.onclick = () => toast("增量订单与商品拉取完成，sha256 幂等校验 0 重复"));
      }
    };
  }

  // ==================== M0b: Independent Stock & RBAC ====================
  if (pageId === "m0b") {
    return {
      headerActions: [
        { label: "同步仓库库存", primary: true, onClick: () => { state.stockSyncedAt = new Date().toTimeString().slice(0,8); rerender(); toast("独立仓库库存同步完成：" + state.stockSyncedAt); } }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 红线规则：仓库真实库存仅由本页同步或人工盘点更新；M6 补货收货凭证仅留痕，绝不自动改写可售库存。</span>
          <span>最近同步：${state.stockSyncedAt}</span>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">各仓 SKU 独立库存水位（inventory_snapshots）</div>
            <button class="btn btn-sm" id="gotoM6Btn">去 M6 补货测算 →</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>SKU / 品名</th><th>仓库</th><th>当前可售</th><th>已锁定</th><th>安全库存</th><th>水位状态</th><th>最近盘点</th></tr></thead>
              <tbody>
                <tr><td><strong>BAG-108 · 轻量通勤双肩包</strong></td><td>US-WH-2</td><td><strong>18 件</strong></td><td>4 件</td><td>25 件</td><td><span class="pill p-red">低库存预警</span></td><td>2026-11-19 ${state.stockSyncedAt}</td></tr>
                <tr><td><strong>FAN-203 · 便携静音循环扇</strong></td><td>TH-WH-1</td><td><strong>43 件</strong></td><td>2 件</td><td>60 件</td><td><span class="pill p-amber">低库存预警</span></td><td>2026-11-19 ${state.stockSyncedAt}</td></tr>
                <tr><td><strong>MAT-014 · 桌面皮质收纳垫</strong></td><td>US-WH-1</td><td><strong>120 件</strong></td><td>6 件</td><td>40 件</td><td><span class="pill p-green">库存充足</span></td><td>2026-11-19 ${state.stockSyncedAt}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-purple">2</span> 系统 6 大实现角色 RBAC 权限矩阵（pilot/rbac/service.py + SRS §1.5）</div>
            <span class="pill p-purple">当前体验角色：${state.role}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>代码角色</th><th>对应业务岗位 (SRS §1.5)</th><th>核心可操作权限</th><th>严禁 / 职责分离(SoD)边界</th></tr></thead>
              <tbody>
                <tr><td><span class="pill p-gray">viewer</span></td><td>观察员 / 只读访客</td><td>查看大屏(M2)、问数(M3)、预测(M5)</td><td>禁止任何写入与审批操作</td></tr>
                <tr><td><span class="pill p-blue">planner</span></td><td>客服 / 选品 / 补货运营专员</td><td>客服回复、M4初筛入待选清单、M6提交补货草案</td><td>不得审批自己提交的工单/选品/补货</td></tr>
                <tr><td><span class="pill p-purple">approver</span></td><td>运营主管 / 财务审批人</td><td>M1售后工单审批、M4测款终审、M6补货审批</td><td>必须与提交人为不同账号 (SoD)</td></tr>
                <tr><td><span class="pill p-green">warehouse</span></td><td>仓管与采购履约专员</td><td>同步独立库存、M6登记采购/质检/分批收货凭证</td><td>不可越权审批财务补货预算</td></tr>
                <tr><td><span class="pill p-amber">auditor / admin</span></td><td>审计员 / 系统管理员</td><td>全链路审计日志核验、6角色授权与模型启停</td><td>auditor 仅只读审计日志</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("gotoM6Btn").onclick = () => goPage("m6a");
      }
    };
  }

  // ==================== M1a: CS 3-Column Workbench ====================
  if (pageId === "m1a") {
    const activeSess = state.csSessions.find(s => s.id === state.csActiveId) || state.csSessions[0];
    return {
      headerActions: [
        { label: "去推荐商品库", primary: false, onClick: () => goPage("m1b") },
        { label: "人工接管当前会话", primary: true, onClick: () => { activeSess.mode = "HUMAN"; rerender(); toast(`会话 ${activeSess.id} 已由人工接管 (HUMAN)`); } }
      ],
      html: `
        <div class="split-3col-cs">
          <!-- Left: Session Queue -->
          <div class="card" style="padding:12px;">
            <div class="card-header" style="margin-bottom:8px;">
              <div class="card-title" style="font-size:13.5px;"><span class="anno-tag t-blue">1</span> 会话队列 (${state.csSessions.length})</div>
            </div>
            ${state.csSessions.map(s => `
              <div class="session-item ${s.id === activeSess.id ? "active" : ""}" data-sid="${s.id}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="font-size:12.5px;">${s.buyer}</strong>
                  <span style="font-size:11px;color:var(--text-soft)">${s.time}</span>
                </div>
                <div style="font-size:11.5px;color:var(--text-muted);margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.preview}</div>
                <span class="pill ${s.mode === "PENDING_HUMAN" ? "p-purple" : s.mode === "HUMAN" ? "p-blue" : "p-green"}">${s.mode}</span>
              </div>
            `).join("")}
            <button class="btn btn-sm" id="gotoSimBuyerBtn" style="width:100%;justify-content:center;margin-top:6px;">+ 从模拟买家入口发消息</button>
          </div>

          <!-- Center: Chat + Alert + Rec + Reply -->
          <div class="card" style="padding:14px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div>
                <strong>${activeSess.buyer}</strong>
                <span style="color:var(--text-soft);font-size:12px;margin-left:6px;">${activeSess.platform} · ${activeSess.lang} · ${activeSess.intent}</span>
              </div>
              <span class="pill ${activeSess.mode === "PENDING_HUMAN" ? "p-purple" : activeSess.mode === "HUMAN" ? "p-blue" : "p-green"}">${activeSess.mode}</span>
            </div>

            <div style="max-height:210px;overflow-y:auto;margin-bottom:10px;">
              ${activeSess.messages.map(m => `
                <div class="chat-bubble ${m.role === "agent" ? "user" : ""}">
                  <div>${m.text}</div>
                  ${m.zh ? `<div class="chat-trans" style="${m.role==="agent"?"color:#dbeafe":""}">译文：${m.zh}</div>` : ""}
                </div>
              `).join("")}
            </div>

            ${activeSess.risk ? `
              <div class="banner banner-amber" style="margin-bottom:10px;">
                <div>
                  <div><span class="anno-tag t-green">2</span> 售后投诉待人工接管（命中敏感拦截）</div>
                  <div style="font-size:11.5px;font-weight:400;margin-top:2px;">规则：MONEY_REQUEST / AFTER_SALES_COMPLAINT 禁止 AI 自动承诺赔付</div>
                </div>
                <button class="btn btn-primary btn-sm" id="takeoverInlineBtn">${activeSess.mode === "HUMAN" ? "已人工接管 ✓" : "人工接管"}</button>
              </div>
            ` : `
              <div class="banner banner-blue" style="margin-bottom:10px;">
                <span><span class="anno-tag t-green">2</span> 商品推荐 · 置信度前3名：${activeSess.recs}</span>
              </div>
            `}

            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <strong style="font-size:12px;">最新意图分析：${activeSess.intent} · ${activeSess.conf} 置信度</strong>
                <span class="pill p-blue">AUTO_TRANSLATION</span>
              </div>
              ${activeSess.risk ? `
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <span class="pill p-amber">! MONEY_REQUEST</span>
                  <span class="pill p-red">! AFTER_SALES_COMPLAINT</span>
                </div>
              ` : `<div style="font-size:11.5px;color:var(--text-muted)">商品推荐检索完成，可直接插入商品卖点回复买家。</div>`}
            </div>

            <div class="field">
              <label>中文拟定回复（自动生成外语预览）</label>
              <textarea id="csZhInput" class="textarea" style="min-height:54px;">您好，已为您核实订单损坏情况，现为您提交退款工单审核。</textarea>
            </div>
            <div class="field">
              <label>外语买家回复（可人工微调后再发送）</label>
              <textarea id="csEnInput" class="textarea" style="min-height:52px;">Hello, we have verified your damaged item and submitted a refund review.</textarea>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11.5px;color:var(--text-soft)">发送前请核对外语内容</span>
              <button class="btn btn-primary" id="csSendBtn">发送外语回复</button>
            </div>
          </div>

          <!-- Right: Customer & Order Verification -->
          <div class="card" style="padding:14px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div class="card-title" style="font-size:13.5px;"><span class="anno-tag t-purple">3</span> 客户与关联订单</div>
            </div>
            <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">客户名称</span><strong>${activeSess.buyer}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">来源平台</span><strong>${activeSess.platform}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">识别语言</span><strong>${activeSess.lang}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">当前意图</span><strong>${activeSess.intent}</strong></div>
            </div>

            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;">
              <div style="font-size:12px;font-weight:700;color:var(--blue-hover);margin-bottom:4px;">匹配到候选订单</div>
              <div style="font-weight:700;">${activeSess.orderId}</div>
              <div style="font-size:11.5px;color:var(--text-muted);margin:3px 0;">SHIPPED · USD 34.50</div>
              <div style="font-size:11.5px;color:var(--text-soft);margin-bottom:8px;">轻量通勤双肩包 BAG-108 ×1</div>
              <button class="btn btn-primary btn-sm" id="bindOrderBtn" style="width:100%;justify-content:center;">${activeSess.bound ? "已核验并绑定 ✓" : "人工核验并绑定订单"}</button>
            </div>

            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;">
              <div style="font-weight:700;font-size:12.5px;margin-bottom:4px;">跳转创建售后工单</div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">核验订单后，进入独立【售后工单审批页】提交与审批，保持聊天页整洁。</div>
              <button class="btn btn-sm" id="gotoTicketsBtn" style="width:100%;justify-content:center;border-color:var(--blue);color:var(--blue);">前往售后工单页 →</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".session-item").forEach(el => {
          el.onclick = () => { state.csActiveId = el.dataset.sid; rerender(); };
        });
        const tkBtn = document.getElementById("takeoverInlineBtn");
        if (tkBtn) tkBtn.onclick = () => { activeSess.mode = "HUMAN"; rerender(); toast("已人工接管该售后会话"); };
        document.getElementById("bindOrderBtn").onclick = () => { activeSess.bound = true; rerender(); toast(`已核验并绑定订单 ${activeSess.orderId}`); };
        document.getElementById("gotoTicketsBtn").onclick = () => goPage("m1c");
        document.getElementById("gotoSimBuyerBtn").onclick = () => goPage("m1d");
        const zh = document.getElementById("csZhInput");
        const en = document.getElementById("csEnInput");
        zh.oninput = () => {
          en.value = `[EN Auto-Preview] ${zh.value.trim() ? "Thank you for contacting CrossPilot support. We are handling: " + zh.value.slice(0, 42) + "..." : ""}`;
        };
        document.getElementById("csSendBtn").onclick = () => {
          const text = en.value.trim();
          if (!text) return;
          activeSess.messages.push({ role: "agent", text, zh: zh.value.trim() });
          rerender();
          toast("已发送外语回复至模拟买家通道");
        };
      }
    };
  }

  // ==================== M1b: Recommended Products KB ====================
  if (pageId === "m1b") {
    const filtered = state.csProducts.filter(p => state.csShopFilter === "ALL" || p.shop === state.csShopFilter);
    return {
      headerActions: [
        { label: "重建向量索引", primary: false, onClick: () => toast("已刷新 pgvector 向量索引 (142 SKU)") },
        { label: "+ 批量导入 XLSX", primary: true, onClick: () => openModal("批量导入推荐商品 (XLSX)", `
          <div class="field"><label>1. 选择目标店铺</label><select class="select"><option>Shopee 泰国主店</option><option>TikTok US</option></select></div>
          <div class="field"><label>2. 选择 .xlsx 商品资料表</label><div style="border:2px dashed var(--blue-border);border-radius:8px;padding:18px;text-align:center;background:#f8fafc;"><strong>点击或拖拽 recommendation_items.xlsx</strong><div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">必填列：SKU / 标题 / 卖点 / 价格</div></div></div>
          <div class="banner banner-green" style="margin-bottom:12px;">预校验结果：新增 18 条，格式错误 0 条，待写入 pgvector</div>
          <button class="btn btn-primary" id="confirmImportKb">确认导入并生成向量</button>
        `, () => {
          document.getElementById("confirmImportKb").onclick = () => {
            state.csProducts.unshift({ sku: "DESK-901", name: "铝合金折叠笔记本支架", shop: "Shopee TH", price: "$26.00", vec: "已向量化", on: true });
            closeModal(); rerender(); toast("XLSX 导入成功：新增商品 DESK-901 并已向量化");
          };
        }) }
      ],
      html: `
        <div class="card">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <strong>店铺筛选：</strong>
            ${["ALL", "Shopee TH", "TikTok US"].map(sh => `<button class="btn btn-sm ${state.csShopFilter === sh ? "btn-primary" : ""} shop-flt" data-shop="${sh}">${sh === "ALL" ? "全部店铺" : sh}</button>`).join("")}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> 推荐商品清单（参与咨询自动 Top-3 匹配）</div>
            <span class="pill p-green"><span class="anno-tag t-green">2</span> 支持 XLSX 批量向量化</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>商品名称</th><th>所属店铺</th><th>参考售价</th><th>向量状态</th><th>推荐开关</th></tr></thead>
              <tbody>
                ${filtered.map((p, idx) => `
                  <tr>
                    <td><strong>${p.sku}</strong></td>
                    <td>${p.name}</td>
                    <td>${p.shop}</td>
                    <td>${p.price}</td>
                    <td><span class="pill ${p.vec === "已向量化" ? "p-green" : "p-amber"}">${p.vec}</span></td>
                    <td><button class="btn btn-sm toggle-kb" data-idx="${idx}">${p.on ? "已启用 ✓" : "已停用"}</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".shop-flt").forEach(b => b.onclick = () => { state.csShopFilter = b.dataset.shop; rerender(); });
        document.querySelectorAll(".toggle-kb").forEach(b => b.onclick = () => {
          const item = filtered[Number(b.dataset.idx)];
          item.on = !item.on; rerender(); toast(`${item.sku} 推荐开关已${item.on ? "开启" : "停用"}`);
        });
      }
    };
  }

  // ==================== M1d: Mock Buyer Simulator ====================
  if (pageId === "m1d") {
    return {
      headerActions: [
        { label: "返回客服三栏工作台 →", primary: true, onClick: () => goPage("m1a") }
      ],
      html: `
        <div class="card" style="max-width:720px;">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> 模拟买家消息发送器（教学 / 演示专用入口）</div>
          </div>
          <div class="field"><label>买家昵称与平台</label><input id="simBuyerName" class="input" value="Demo Buyer · AMAZON US" /></div>
          <div class="field">
            <label>快捷测试场景</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm sim-preset" data-msg="Do you have a waterproof desk mat for home office?">场景A：咨询推荐 (触发Top-3推荐)</button>
              <button class="btn btn-sm sim-preset" data-msg="My parcel SYN9D-005671 arrived broken, I demand a full refund!">场景B：损坏退款 (触发人工接管拦截)</button>
            </div>
          </div>
          <div class="field"><label>买家发送内容（英文/多语）</label><textarea id="simBuyerMsg" class="textarea">Do you have a waterproof desk mat for home office?</textarea></div>
          <button class="btn btn-primary" id="sendSimMsgBtn">发送买家消息并进入工作台 →</button>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".sim-preset").forEach(b => b.onclick = () => { document.getElementById("simBuyerMsg").value = b.dataset.msg; });
        document.getElementById("sendSimMsgBtn").onclick = () => {
          const msg = document.getElementById("simBuyerMsg").value.trim();
          const isRefund = /refund|broken|damaged/i.test(msg);
          const id = "s" + Date.now();
          state.csSessions.unshift({
            id,
            buyer: document.getElementById("simBuyerName").value.split("·")[0].trim(),
            platform: "AMAZON US",
            lang: "EN",
            time: "刚刚",
            preview: msg,
            mode: isRefund ? "PENDING_HUMAN" : "AI_AUTO",
            intent: isRefund ? "REFUND" : "PRODUCT_INQUIRY",
            conf: isRefund ? "91%" : "94%",
            risk: isRefund,
            recs: "① MAT-014 桌面收纳垫 (95%) ② BAG-108 (72%)",
            orderId: "SYN9D-005671",
            bound: false,
            messages: [{ role: "buyer", text: msg, zh: isRefund ? "我的包裹破损了，要求全额退款！" : "请问你们有适合居家办公的防水桌面垫吗？" }]
          });
          state.csActiveId = id;
          goPage("m1a");
          toast(isRefund ? "命中退款风险词，已置为 PENDING_HUMAN" : "已触发咨询推荐 Top-3 检索");
        };
      }
    };
  }

  // ==================== M1c: After-sales Tickets & SoD Approval ====================
  if (pageId === "m1c") {
    const canApprove = state.role === "approver" || state.role === "admin";
    return {
      headerActions: [
        { label: "返回客服工作台", primary: false, onClick: () => goPage("m1a") },
        { label: "+ 新建售后工单", primary: true, onClick: () => {
          state.tickets.unshift({ id: "TK-20261119-02", order: "SYN9D-005671", type: "破损补发 $15.00", submitter: state.role, status: "待主管审批", ext: "—" });
          rerender(); toast("已新建售后工单 TK-20261119-02");
        } }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 外部退款同步边界：审批通过后写入审计台账，平台侧退款结果标记 <code>external_status = UNKNOWN</code>（不伪造平台已打款）。</span>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">2</span> 售后审批队列（planner 提交 → approver 拍板）</div></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>工单编号</th><th>关联订单</th><th>类型/金额</th><th>提交人</th><th>状态</th><th>平台回执</th></tr></thead>
                <tbody>
                  ${state.tickets.map((t, i) => `
                    <tr class="tk-row" data-idx="${i}" style="cursor:pointer;${i===state.ticketIdx?"background:#eff6ff":""}">
                      <td><strong>${t.id}</strong></td><td>${t.order}</td><td>${t.type}</td><td>${t.submitter}</td>
                      <td><span class="pill ${t.status==="已批准"?"p-green":t.status==="已驳回"?"p-red":"p-amber"}">${t.status}</span></td>
                      <td><span class="pill p-gray">${t.ext}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title">工单详情 · ${state.tickets[state.ticketIdx].id}</div></div>
            ${(() => {
              const t = state.tickets[state.ticketIdx];
              const sodSame = t.submitter === state.role;
              return `
                <div style="font-size:12.5px;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
                  <div>关联订单：<strong>${t.order}</strong></div>
                  <div>提交客服：<strong>${t.submitter}</strong></div>
                  <div>当前登录角色：<strong>${state.role}</strong> ${!canApprove ? '<span class="pill p-red">无审批权限</span>' : sodSame ? '<span class="pill p-red">触发SoD：不可自审</span>' : '<span class="pill p-green">SoD 校验通过 ✓</span>'}</div>
                  <div>申请类型：<strong>${t.type}</strong></div>
                </div>
                <div class="banner banner-blue" style="margin-bottom:12px;">并发防重锁：SELECT ... FOR UPDATE 已就绪</div>
                <div style="display:flex;gap:10px;">
                  <button class="btn btn-success" id="approveTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""}>批准退款 (写入审计)</button>
                  <button class="btn btn-danger" id="rejectTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""}>驳回工单</button>
                </div>
                ${!canApprove ? '<div style="font-size:11.5px;color:var(--red-text);margin-top:8px;">提示：请在左侧切换角色为 <strong>approver</strong> 后再审批。</div>' : ""}
              `;
            })()}
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".tk-row").forEach(r => r.onclick = () => { state.ticketIdx = Number(r.dataset.idx); rerender(); });
        const ab = document.getElementById("approveTkBtn");
        if (ab) ab.onclick = () => { const t = state.tickets[state.ticketIdx]; t.status = "已批准"; t.ext = "UNKNOWN"; rerender(); toast("工单已加行锁批准，external_status = UNKNOWN"); };
        const rb = document.getElementById("rejectTkBtn");
        if (rb) rb.onclick = () => { state.tickets[state.ticketIdx].status = "已驳回"; rerender(); toast("工单已驳回并记录原因"); };
      }
    };
  }

  // ==================== M2a: BI Designer ====================
  if (pageId === "m2a") {
    return {
      headerActions: [
        { label: "保存草稿", primary: false, onClick: () => toast("驾驶舱布局 JSON 已保存至草稿表") },
        { label: "发布并查看大屏 →", primary: true, onClick: () => { goPage("m2b"); toast("驾驶舱已发布至只读大屏"); } }
      ],
      html: `
        <div class="split-bi">
          <div class="card" style="padding:12px;">
            <div class="card-header"><div class="card-title" style="font-size:13px;"><span class="anno-tag t-blue">1</span> 组件库 (点击添加)</div></div>
            ${["KPI 指标卡", "折线趋势图", "柱状对比图", "平台占比饼图", "AI 经营解读卡"].map(c => `
              <button class="btn btn-sm bi-add-comp" data-comp="${c}" style="width:100%;justify-content:flex-start;margin-bottom:8px;">+ ${c}</button>
            `).join("")}
          </div>

          <div class="card" style="background:#f8fafc;border:1.5px dashed var(--blue-border);">
            <div class="card-header">
              <div class="card-title" style="color:var(--blue-hover);"><span class="anno-tag t-green">2</span> 驾驶舱画布预览（12列栅格）</div>
              <span class="pill p-blue">当前已放 ${state.biWidgets.length} 个组件</span>
            </div>
            <div class="grid-2" style="margin-bottom:12px;">
              ${state.biWidgets.map((w, i) => `
                <div class="kpi-card" style="cursor:pointer;${i===state.biSelectedIdx?"border:1.5px solid var(--blue)":""}" data-wi="${i}">
                  <div class="kpi-label">${w.title} ${i===state.biSelectedIdx?'<span class="pill p-blue">已选中</span>':""}</div>
                  <div class="kpi-val" style="color:${w.color}">${w.val}</div>
                  <div class="kpi-sub">绑定口径：${w.metric} · ${w.scope}</div>
                </div>
              `).join("")}
            </div>
            <div class="banner banner-blue" style="flex-direction:column;align-items:flex-start;">
              <strong>AI 经营解读卡（自动读取当前筛选结果）</strong>
              <span style="font-weight:400;">${state.biInsight}</span>
            </div>
          </div>

          <div class="card" style="padding:14px;">
            <div class="card-header"><div class="card-title" style="font-size:13px;"><span class="anno-tag t-purple">3</span> 选中组件属性</div></div>
            ${(() => {
              const w = state.biWidgets[state.biSelectedIdx] || state.biWidgets[0];
              return `
                <div class="field"><label>组件标题</label><input id="biPropTitle" class="input" value="${w.title}"/></div>
                <div class="field"><label>绑定统一指标</label><select id="biPropMetric" class="select"><option ${w.metric==="gmv"?"selected":""}>gmv</option><option ${w.metric==="net_profit"?"selected":""}>net_profit</option><option ${w.metric==="ad_spend"?"selected":""}>ad_spend</option></select></div>
                <div class="field"><label>时间范围</label><select id="biPropScope" class="select"><option>全部平台 · 近30天</option><option>Amazon · 近7天</option></select></div>
                <button class="btn btn-primary btn-sm" id="biApplyProp" style="width:100%;justify-content:center;margin-bottom:8px;">应用到画布</button>
                <button class="btn btn-sm" id="biGenAiBtn" style="width:100%;justify-content:center;">重新生成 AI 解读</button>
              `;
            })()}
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll("[data-wi]").forEach(el => el.onclick = () => { state.biSelectedIdx = Number(el.dataset.wi); rerender(); });
        document.querySelectorAll(".bi-add-comp").forEach(b => b.onclick = () => {
          state.biWidgets.push({ title: b.dataset.comp + " (新增)", val: "$18,650.16", metric: "ad_spend", scope: "全部平台 · 近30天", color: "var(--amber-text)" });
          state.biSelectedIdx = state.biWidgets.length - 1; rerender(); toast("已添加到画布");
        });
        document.getElementById("biApplyProp").onclick = () => {
          const w = state.biWidgets[state.biSelectedIdx];
          w.title = document.getElementById("biPropTitle").value;
          w.metric = document.getElementById("biPropMetric").value;
          w.scope = document.getElementById("biPropScope").value;
          rerender(); toast("组件属性已更新");
        };
        document.getElementById("biGenAiBtn").onclick = () => {
          state.biInsight = "AI 解读更新：近30天净利润 $65,529.67（净利率 52.2%），Amazon 广告花费 $2,933.63（近7天）保持健康 ROI。";
          rerender(); toast("AI 经营解读已刷新");
        };
      }
    };
  }

  // ==================== M2b: Published BI Dashboard ====================
  if (pageId === "m2b") {
    return {
      headerActions: [
        { label: "返回设计工作台", primary: false, onClick: () => goPage("m2a") },
        { label: "刷新全部指标", primary: true, onClick: () => toast("4张卡片并发刷新完成（口径版本 v1.2）") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><span class="anno-tag t-blue">1</span> 数据截止：2026-11-19 10:15:00  |  指标口径版本：v1.2（与 M3 智能问数同源 metric_snapshots）</span>
          <span class="pill p-green">4卡并发拉取成功</span>
        </div>
        <div class="grid-4">
          <div class="kpi-card"><div class="kpi-label">GMV 销售额</div><div class="kpi-val" style="color:var(--blue-hover)">$125,429.99</div><div class="kpi-sub">+14.2% 环比 · 10:15</div></div>
          <div class="kpi-card"><div class="kpi-label">订单总数</div><div class="kpi-val" style="color:var(--green-text)">1,536 单</div><div class="kpi-sub">+9.8% 环比 · 10:15</div></div>
          <div class="kpi-card"><div class="kpi-label">广告花费</div><div class="kpi-val" style="color:var(--amber-text)">$18,650.16</div><div class="kpi-sub">ACOS 14.8% · 10:14</div></div>
          <div class="kpi-card"><div class="kpi-label">净利润</div><div class="kpi-val" style="color:var(--purple-text)">$65,529.67</div><div class="kpi-sub">净利率 52.2% · 10:15</div></div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 多平台每日 GMV 与利润趋势</div></div>
            <svg viewBox="0 0 500 180" style="width:100%;height:190px;background:#fafcff;border-radius:8px;border:1px solid #e2e8f0;">
              <polyline fill="none" stroke="#2563eb" stroke-width="3" points="30,140 95,120 160,126 225,88 290,76 355,54 420,44 475,28" />
              <polyline fill="none" stroke="#10b981" stroke-width="2.5" points="30,158 95,148 160,150 225,130 290,122 355,108 420,98 475,86" />
              <text x="30" y="172" font-size="11" fill="#64748b">11-12</text>
              <text x="225" y="172" font-size="11" fill="#64748b">11-15</text>
              <text x="445" y="172" font-size="11" fill="#64748b">11-19</text>
              <text x="340" y="22" font-size="11" fill="#2563eb" font-weight="bold">● GMV</text>
              <text x="410" y="22" font-size="11" fill="#10b981" font-weight="bold">● 净利润</text>
            </svg>
          </div>
          <div class="card card-blue">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-purple">3</span> AI 经营摘要与联动问数</div></div>
            <p style="margin-top:0;color:var(--text-muted)">1. <strong>同源验证</strong>：与智能问数共用 <code>metric_snapshots</code>，零偏差。<br><br>2. <strong>广告观察</strong>：Amazon 近7天广告花费 <strong>$2,933.63</strong>，处于安全阈值内。<br><br>3. <strong>快速深挖</strong>：点击下方按钮带上下文跳至 M3 智能问答继续追问。</p>
            <button class="btn btn-primary" id="biGotoQaBtn">带着当前指标去问数 →</button>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("biGotoQaBtn").onclick = () => goPage("m3b");
      }
    };
  }

  // ==================== M3a: QA Metrics & Celery Sync ====================
  if (pageId === "m3a") {
    return {
      headerActions: [
        { label: "前往经营智能问答 →", primary: true, onClick: () => goPage("m3b") }
      ],
      html: `
        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 新增指标与接口绑定配置</div></div>
          <div class="banner banner-amber" style="margin-bottom:12px;">REST 接入前需配置后端环境变量 <code>METRIC_REST_BASE_URL</code>；多平台路径须包含 <code>{platform}</code>。</div>
          <div class="grid-4">
            <div class="field"><label>指标代码</label><input id="m3Code" class="input" value="conversion_rate"/></div>
            <div class="field"><label>指标名称</label><input id="m3Name" class="input" value="转化率"/></div>
            <div class="field"><label>取值方式</label><select class="select"><option>内置汇总</option><option>REST API</option></select></div>
            <div class="field"><label>JSON 路径</label><input class="input" value="data.value"/></div>
          </div>
          <button class="btn btn-primary btn-sm" id="addMetricBtn">保存并创建绑定</button>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 数据绑定与 Celery Beat 周期调度（每分钟巡检到期任务）</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>绑定 / 指标</th><th>接口类型</th><th>平台</th><th>调度周期</th><th>最新指标数据</th><th>同步状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.qaBindings.map((b, i) => `
                  <tr>
                    <td><strong>${b.name}</strong></td>
                    <td><span class="pill p-blue">${b.kind}</span></td>
                    <td>${b.platform}</td>
                    <td>${b.cron}</td>
                    <td><strong>${b.val}</strong></td>
                    <td><span class="pill p-green">${b.status}</span></td>
                    <td><button class="btn btn-sm run-sync-btn" data-i="${i}">▶ 立即同步</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("addMetricBtn").onclick = () => {
          const code = document.getElementById("m3Code").value.trim();
          const name = document.getElementById("m3Name").value.trim();
          state.qaBindings.unshift({ name: `${name} (${code})`, kind: "REST API", platform: "全部平台", cron: "每15分钟", val: "3.42%", status: "SUCCESS" });
          rerender(); toast(`已新增指标绑定：${name}`);
        };
        document.querySelectorAll(".run-sync-btn").forEach(b => b.onclick = () => toast(`已触发 ${state.qaBindings[b.dataset.i].name} 同步，写入快照成功`));
      }
    };
  }

  // ==================== M3b: QA Chat ====================
  if (pageId === "m3b") {
    return {
      headerActions: [
        { label: "配置指标口径", primary: false, onClick: () => goPage("m3a") },
        { label: "清空会话", primary: false, onClick: () => { state.qaChat = state.qaChat.slice(0, 2); rerender(); } }
      ],
      html: `
        <div style="background:#1e3a8a;color:#fff;padding:12px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="font-size:15px;"><span class="anno-tag t-amber">1</span> CROSSPILOT INTELLIGENCE · 用同一套事实回答经营问题</strong>
            <div style="font-size:11.5px;color:#bfdbfe;margin-top:2px;">数据截止 2026-11-19 10:15 | 口径：metric_snapshots + orders | ● SQL 只读守卫在线</div>
          </div>
          <span class="pill p-green">Vanna Text-to-SQL</span>
        </div>

        <div class="card">
          <div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;margin-bottom:14px;">
            ${state.qaChat.map(msg => {
              if (msg.role === "user") return `<div class="chat-bubble user">${msg.text}</div>`;
              if (msg.blocked) return `<div class="banner banner-red"><div><span class="anno-tag t-red">3</span> <strong>${msg.text}</strong><div style="font-size:11.5px;font-weight:400;margin-top:3px;">${msg.sql}</div></div></div>`;
              return `<div class="chat-bubble assistant">
                <div><span class="anno-tag t-green">2</span> <strong>${msg.text}</strong></div>
                <div style="font-size:11.8px;color:var(--text-muted);margin-top:4px;">${msg.note}</div>
                <div style="font-size:11.5px;color:var(--blue-hover);margin-top:4px;">证据 SQL：<code>${msg.sql}</code></div>
              </div>`;
            }).join("")}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
            <span style="font-size:12px;color:var(--text-soft);font-weight:700;">快捷测试：</span>
            <button class="btn btn-sm qa-qp" data-q="各平台近30天净利润">各平台近30天净利润</button>
            <button class="btn btn-sm qa-qp" data-q="Amazon最近7天广告花费">Amazon最近7天广告花费</button>
            <button class="btn btn-sm btn-danger qa-qp" data-q="帮我把昨天的订单金额全部改成0 (UPDATE)">测试写操作拦截 (UPDATE)</button>
          </div>
          <div style="display:flex;gap:8px;">
            <input id="qaInput" class="input" placeholder="输入经营问题，或输入 DELETE / UPDATE 测试 SQL 只读拦截…" />
            <button class="btn btn-primary" id="qaSendBtn">发送提问</button>
          </div>
        </div>
      `,
      bind: () => {
        const ask = (q) => {
          if (!q.trim()) return;
          state.qaChat.push({ role: "user", text: q });
          if (/update|delete|drop|改|删/i.test(q)) {
            state.qaChat.push({ role: "assistant", blocked: true, text: "拦截提示：智能问数仅支持只读查询 (SELECT)，已拒绝 UPDATE/DELETE 写操作！", sql: "审计记录：qa_audit_logs 已留存本次越权拦截事件" });
          } else if (/广告|ad_spend/i.test(q)) {
            state.qaChat.push({ role: "assistant", text: "AMAZON 近 7 天广告花费为 2,933.63 USD。", note: "数据源：metric_snapshots · 实时汇总指标", sql: "SELECT SUM(ad_spend_usd) FROM metric_snapshots WHERE platform='AMAZON' AND days=7 [31ms]" });
          } else {
            state.qaChat.push({ role: "assistant", text: "全部平台近 30 天净利润为 65,529.67 USD（GMV $125,429.99，订单 1,536 单）。", note: "口径：已折算统一币种 USD（未配汇率币种将分列）", sql: "SELECT SUM(net_profit_usd) FROM metric_snapshots WHERE days=30 [38ms]" });
          }
          rerender();
        };
        document.getElementById("qaSendBtn").onclick = () => ask(document.getElementById("qaInput").value);
        document.querySelectorAll(".qa-qp").forEach(b => b.onclick = () => ask(b.dataset.q));
      }
    };
  }

  return null;
}
