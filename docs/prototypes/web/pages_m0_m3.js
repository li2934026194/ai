import {
  API_BASE, WAREHOUSE_LABELS, getProductImg, genDocId, nowDateTimeStr, nowTimeStr, relTimeLabel, appendAuditLog
} from "./state.js";

export function renderM0_M3(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, openDrawer, closeDetailDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox, computeLiveBusinessStats, record403 } = helpers;

  // ==================== M0a: Shop OAuth Connections ====================
  if (pageId === "m0a") {
    const canManageShop = state.role === "manager" || state.role === "approver";
    const syncTaskHtml = renderAsyncBox("m0_sync");
    const oauthTaskHtml = renderAsyncBox("m0_oauth");

    return {
      headerActions: [
        { label: "去商品与订单主数据 →", primary: false, onClick: () => goPage("m0b") },
        {
          label: "+ 接入新店铺 (OAuth2)", primary: true,
          disabled: !canManageShop,
          disabledTitle: "需「大屏浏览者/管理者」或「主管/审批人」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canManageShop) { record403("M0-1 接入新店铺", "当前角色无店铺 OAuth 授权权限"); return; }
            commitAction({
              title: "接入新跨境店铺 (OAuth2 模拟授权流程)",
              summary: `环境边界：当前 API_BASE=${API_BASE || "(未配置)"}，本步将按「B类外部服务」执行 OAuth2 授权跳转模拟与失败分支演示，不连真实平台后台。`,
              confirmText: "发起模拟跳转授权 →",
              fieldsHtml: `
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>目标平台 *</label><select id="newShopPlat" class="select"><option>SHOPEE</option><option>TIKTOK</option><option>AMAZON</option><option>LAZADA</option></select></div>
                  <div class="field"><label>站点 *</label><select id="newShopReg" class="select"><option>MY</option><option>TH</option><option>US</option><option>SG</option></select></div>
                </div>
                <div class="field"><label>店铺名称 * (不可与已有店铺重名)</label><input id="newShopName" class="input" value="Shopee 马来西亚分店"/></div>
                <div class="field"><label>接入模式 *</label>
                  <select id="newShopMode" class="select">
                    <option value="REAL">REAL（实盘授权 · 订单计入经营利润）</option>
                    <option value="MOCK">MOCK（测试沙盒 · 仅用于客服演示，绝不混入实利）</option>
                  </select>
                </div>
                <div class="field"><label>授权 Scope 勾选 * (至少选1项)</label>
                  <div style="display:flex;gap:12px;flex-wrap:wrap;padding:6px 0;">
                    <label style="display:inline-flex;align-items:center;gap:4px;font-weight:500;"><input type="checkbox" class="oauth-sc" value="orders.read" checked/> orders.read</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;font-weight:500;"><input type="checkbox" class="oauth-sc" value="inventory.read" checked/> inventory.read</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;font-weight:500;"><input type="checkbox" class="oauth-sc" value="cs.reply"/> cs.reply</label>
                  </div>
                </div>
                <div class="field"><label>回调分支测试 (B类诚实模拟)</label>
                  <select id="oauthOutcome" class="select">
                    <option value="OK">模拟回调成功（生成脱敏 Token 演示凭证）</option>
                    <option value="FAIL">模拟授权拒签 / 回调超时（测试失败与重试）</option>
                  </select>
                </div>
              `,
              validate: (wrap) => {
                const errs = [];
                const nameEl = wrap.querySelector("#newShopName");
                const nm = nameEl.value.trim();
                if (!nm) errs.push({ el: nameEl, msg: "请填写店铺名称" });
                else if (state.shops.some(s => s.name === nm)) errs.push({ el: nameEl, msg: `店铺「${nm}」已存在，禁止重复接入` });
                const scopes = [...wrap.querySelectorAll(".oauth-sc:checked")];
                if (scopes.length === 0) errs.push({ el: wrap.querySelector(".oauth-sc"), msg: "请至少勾选一项 OAuth Scope 权限" });
                return errs;
              },
              onConfirm: (wrap) => {
                const name = wrap.querySelector("#newShopName").value.trim();
                const platform = wrap.querySelector("#newShopPlat").value;
                const region = wrap.querySelector("#newShopReg").value;
                const mode = wrap.querySelector("#newShopMode").value;
                const scopes = [...wrap.querySelectorAll(".oauth-sc:checked")].map(c => c.value);
                const shouldFail = wrap.querySelector("#oauthOutcome").value === "FAIL";
                const maskPrefix = platform.slice(0, 4).toLowerCase();
                const maskCode = Math.random().toString(16).slice(2, 6);

                runAsyncTask("m0_oauth", {
                  label: `OAuth2 授权回调 · ${name}`,
                  steps: ["跳转平台授权页", "接收授权码换取 Token", "写入脱敏凭证与隔离策略"],
                  durationMs: 1100,
                  shouldFail,
                  failReason: "B类模拟：用户取消授权或 OAuth 回调状态码 401（未连接真实平台 OAuth 服务）",
                  onSuccess: () => {
                    state.shops.push({
                      id: "shop_" + Date.now(),
                      name, platform, region, mode, scopes,
                      tokenMask: `${maskPrefix}_${mode.toLowerCase()}_****${maskCode}`,
                      status: mode === "REAL" ? "Token有效 (演示态)" : "仅限演示沙盒",
                      lastSync: `${nowDateTimeStr()} (刚刚接入)`,
                      lastSyncTs: Date.now()
                    });
                    return { summary: `已生成脱敏 Token (${maskPrefix}_****${maskCode}) · 仅演示模拟态`, toastMsg: `${name} OAuth 模拟回调成功` };
                  }
                });
                return { toastMsg: "已发起 OAuth2 授权跳转任务…", toastLevel: "info" };
              },
              audit: (wrap) => ({
                target: `M0-1 店铺授权 · ${wrap.querySelector("#newShopName").value.trim()}`,
                action: "发起 OAuth2 授权流程",
                detail: `平台=${wrap.querySelector("#newShopPlat").value}, 模式=${wrap.querySelector("#newShopMode").value} (演示模拟)`,
                ok: true
              })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span>⚠️ <strong>能力边界提示：</strong>OAuth2 真实回调属于 B 类外部依赖（当前 <code>API_BASE</code> 未配置），授权结果与 Token 均为<strong>演示模拟状态</strong>；支持 REAL 实盘与 MOCK 沙盒严格隔离。</span>
        </div>
        ${oauthTaskHtml}
        ${syncTaskHtml}

        <div class="grid-3">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">已接入店铺</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.shops.length} 家</div>
            <div class="kpi-sub">实盘 ${state.shops.filter(s=>s.mode==="REAL").length} 家 · 演示沙盒 ${state.shops.filter(s=>s.mode==="MOCK").length} 家</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">凭证状态 (脱敏存储)</div>
            <div class="kpi-val" style="color:var(--green-text)">演示态就绪</div>
            <div class="kpi-sub">明文密钥不入普通日志，仅展示掩码</div>
          </div>
          <div class="kpi-card highlight-amber">
            <div class="kpi-label">Mock 环境隔离状态</div>
            <div class="kpi-val" style="color:var(--amber-text)">严格隔离</div>
            <div class="kpi-sub">沙盒订单仅流向 M1 客服演示，不计入实利</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 店铺连接与 OAuth 凭证状态</div>
            <span class="pill p-amber">Mock 与 Real 严格隔离</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>店铺名称</th><th>平台 / 站点</th><th>数据模式</th><th>授权 Scope / 脱敏 Token</th><th>最近同步</th><th>操作</th></tr></thead>
              <tbody>
                ${state.shops.map((s, idx) => `
                  <tr>
                    <td><strong>${s.name}</strong></td>
                    <td class="nowrap">${s.platform} · ${s.region}</td>
                    <td class="nowrap"><span class="pill ${s.mode==="REAL"?"p-green":"p-amber"}">${s.mode}</span></td>
                    <td>
                      <div style="font-size:12px;"><code>${s.tokenMask}</code></div>
                      <div style="font-size:12px;color:var(--text-soft);">${(s.scopes || []).join(", ")}</div>
                    </td>
                    <td class="nowrap">
                      <div>${s.lastSync}</div>
                      ${s.lastSyncTs ? `<div style="font-size:12px;color:var(--green-text);">${relTimeLabel(s.lastSyncTs)}</div>` : `<span class="pill p-gray">历史示例数据</span>`}
                    </td>
                    <td class="nowrap">
                      <button class="btn btn-sm m0-sync" data-i="${idx}" ${!canManageShop?"disabled":""} title="${!canManageShop?"需管理者或主管权限":""}">立即同步订单</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m0-sync").forEach(b => b.onclick = () => {
          const s = state.shops[Number(b.dataset.i)];
          commitAction({
            title: `确认同步店铺订单 · ${s.name}`,
            summary: `将通过模拟拉取任务生成增量订单（含幂等去重校验），实时写入 M0-2 订单主表${s.mode==="REAL"?"并更新 M2 大屏 GMV":"（MOCK 店仅限演示，不计入实盘利润）"}。`,
            confirmText: "开始同步",
            onConfirm: () => {
              runAsyncTask("m0_sync", {
                label: `增量订单同步 · ${s.name}`,
                steps: ["拉取平台增量订单", "按订单号与哈希去重", "写入 M0-2 订单主表"],
                durationMs: 1000,
                onSuccess: () => {
                  const prod = state.masterProducts[Math.floor(Math.random() * 3)];
                  const newId = genDocId(s.mode === "MOCK" ? "SYN9D" : "ORD");
                  const qty = 1 + Math.floor(Math.random() * 2);
                  const usd = +(prod.priceNum * qty).toFixed(2);
                  state.orders.unshift({
                    id: newId, shopId: s.id, shopName: s.name, mode: s.mode,
                    status: "PAID", buyer: "Live Sync Buyer***", sku: prod.sku, qty,
                    currency: s.region === "TH" ? "THB" : "USD",
                    amount: s.region === "TH" ? Math.round(usd * 35) : usd,
                    amountUsd: usd, time: nowDateTimeStr(), historical: false,
                    note: s.mode === "MOCK" ? "仅 M1 客服演示(不计实利)" : "刚刚同步(已计入实盘)"
                  });
                  s.lastSync = nowDateTimeStr();
                  s.lastSyncTs = Date.now();
                  return {
                    summary: `新增 1 条 (${newId}) / 去重 2 条 / 失败 0 条`,
                    toastMsg: `${s.name} 同步完成：新增 1 条 (${newId})，去重 2 条`
                  };
                }
              });
              return { toastMsg: "同步任务已入队 (QUEUED)…", toastLevel: "info" };
            },
            audit: { target: `M0-1 订单同步 · ${s.name}`, action: "触发增量订单同步", detail: `模式=${s.mode}`, ok: true }
          });
        });
      }
    };
  }

  // ==================== M0b: Product Master & Orders ====================
  if (pageId === "m0b") {
    const canEditCost = state.role === "planner" || state.role === "approver" || state.role === "manager";
    const q = state.m0bSearch.toLowerCase();
    const filteredProds = state.masterProducts.filter(p =>
      (state.m0bTypeFilter === "ALL" || p.mode === state.m0bTypeFilter) &&
      (!q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );

    const filteredOrders = state.orders.filter(o =>
      (state.m0bOrderShopFilter === "ALL" || o.shopId === state.m0bOrderShopFilter) &&
      (state.m0bOrderStatusFilter === "ALL" || o.status === state.m0bOrderStatusFilter)
    );
    const oPageSize = 4;
    const oTotalPages = Math.max(1, Math.ceil(filteredOrders.length / oPageSize));
    if (state.m0bOrderPage > oTotalPages) state.m0bOrderPage = 1;
    const pagedOrders = filteredOrders.slice((state.m0bOrderPage - 1) * oPageSize, state.m0bOrderPage * oPageSize);

    return {
      headerActions: [
        { label: "← 店铺授权接入", primary: false, onClick: () => goPage("m0a") },
        { label: "前往分店独立库存中心 →", primary: true, onClick: () => goPage("m0c") }
      ],
      html: `
        <div class="card">
          <div class="filter-bar">
            <div class="filter-item" style="flex:2;">
              <label>搜索主 SKU / 商品名称</label>
              <input id="m0bSearchInp" class="input" placeholder="输入 BAG-108 / 洗衣 / 面霜…" value="${state.m0bSearch}"/>
            </div>
            <div class="filter-item">
              <label>经营覆盖方式</label>
              <select id="m0bTypeSel" class="select">
                <option value="ALL">全部模式</option>
                <option value="一货多店" ${state.m0bTypeFilter==="一货多店"?"selected":""}>一货多店</option>
                <option value="泰国专卖" ${state.m0bTypeFilter==="泰国专卖"?"selected":""}>泰国专卖</option>
                <option value="美区主推" ${state.m0bTypeFilter==="美区主推"?"selected":""}>美区主推</option>
                <option value="美区专卖" ${state.m0bTypeFilter==="美区专卖"?"selected":""}>美区专卖</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> 内部主商品档案（各店共用商品主档，按店独立定价与核算成本）</div>
            <span class="pill p-blue">共 ${filteredProds.length} 个商品（含主图与成本卡版本）</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品主图 & 名称</th><th>各店铺上架与商品编号</th><th>拿货 + 头程总成本</th><th>参考售价 / 预估毛利</th><th>覆盖模式</th><th>操作</th></tr></thead>
              <tbody>
                ${filteredProds.map(p => {
                  const totalCost = +(p.cost + p.ship).toFixed(2);
                  const grossMargin = (((p.priceNum - totalCost) / p.priceNum) * 100).toFixed(1);
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <img src="${getProductImg(p.sku)}" alt="${p.name}" class="prod-thumb-img"/>
                          <div>
                            <strong>${p.name}</strong>
                            <div style="font-size:12px;color:var(--text-soft);">${p.sku} · ${p.cat}</div>
                          </div>
                        </div>
                      </td>
                      <td>${p.shops.map(sh => `<span class="pill p-gray" style="margin:2px 3px 2px 0;">${sh}</span>`).join("")}</td>
                      <td class="nowrap">
                        <strong>$${totalCost.toFixed(2)}</strong>
                        <div style="font-size:12px;color:var(--text-soft);">拿货 $${p.cost.toFixed(2)} + 头程 $${p.ship.toFixed(2)} <span class="pill p-green">${p.costVer}</span></div>
                      </td>
                      <td class="nowrap">
                        <strong>${p.price}</strong>
                        <div style="font-size:12px;color:var(--green-text);">毛利率 ${grossMargin}%</div>
                      </td>
                      <td class="nowrap"><span class="pill p-blue">${p.mode}</span></td>
                      <td class="nowrap">
                        <button class="btn btn-sm m0b-detail" data-sku="${p.sku}">看各仓分布</button>
                        <button class="btn btn-sm m0b-cost" data-sku="${p.sku}" ${!canEditCost?"disabled":""} title="${!canEditCost?"需业务运营/管理者/主管权限":""}">调成本卡</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-purple">2</span> 跨平台订单明细台账（点击任意订单行可查看详情与推进状态）</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <select id="m0bOrdShop" class="select" style="width:160px;height:30px;">
                <option value="ALL">全部店铺</option>
                ${state.shops.map(s => `<option value="${s.id}" ${state.m0bOrderShopFilter===s.id?"selected":""}>${s.name}</option>`).join("")}
              </select>
              <select id="m0bOrdStatus" class="select" style="width:130px;height:30px;">
                <option value="ALL">全部状态</option>
                <option value="PAID" ${state.m0bOrderStatusFilter==="PAID"?"selected":""}>PAID 已付款</option>
                <option value="SHIPPED" ${state.m0bOrderStatusFilter==="SHIPPED"?"selected":""}>SHIPPED 已发货</option>
                <option value="DELIVERED" ${state.m0bOrderStatusFilter==="DELIVERED"?"selected":""}>DELIVERED 已妥投</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>订单编号</th><th>归属店铺</th><th>买家 / 商品</th><th>实付金额</th><th>订单状态</th><th>防重与营收口径</th><th>操作</th></tr></thead>
              <tbody>
                ${pagedOrders.map(o => `
                  <tr class="m0b-ord-row" data-oid="${o.id}" style="cursor:pointer;">
                    <td class="nowrap">
                      <strong>${o.id}</strong>
                      <div style="font-size:12px;color:var(--text-soft);">${o.time}</div>
                    </td>
                    <td class="nowrap">${o.shopName} <span class="pill ${o.mode==="REAL"?"p-green":"p-amber"}">${o.mode}</span></td>
                    <td><strong>${o.buyer}</strong><div style="font-size:12px;color:var(--text-soft);">${o.sku} × ${o.qty}件</div></td>
                    <td class="nowrap"><strong>${o.currency} ${o.amount}</strong><div style="font-size:12px;color:var(--text-soft);">≈ $${o.amountUsd.toFixed(2)}</div></td>
                    <td class="nowrap"><span class="pill ${o.status==="DELIVERED"?"p-green":o.status==="SHIPPED"?"p-blue":"p-amber"}">${o.status}</span></td>
                    <td>
                      <span class="pill ${o.mode==="REAL"?"p-green":"p-amber"}">${o.mode==="REAL"?"防重已入账 · 计入真实营收":"仅测试演示 · 不计入真实营收"}</span>
                      ${o.historical ? `<span class="pill p-gray" style="margin-left:4px;">历史示例数据</span>` : `<span class="pill p-blue" style="margin-left:4px;">新同步</span>`}
                    </td>
                    <td class="nowrap">
                      <button class="btn btn-sm m0b-ord-btn" data-oid="${o.id}">订单明细</button>
                      ${o.id === "SYN9D-005671" ? `<button class="btn btn-sm btn-primary m0b-jump-cs" data-sid="${o.csSessionId}">去客服会话 →</button>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <span style="font-size:12px;color:var(--text-soft);">第 ${state.m0bOrderPage} / ${oTotalPages} 页 · 共 ${filteredOrders.length} 笔订单</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m0bOrdPrev" ${state.m0bOrderPage<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m0bOrdNext" ${state.m0bOrderPage>=oTotalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0bSearchInp").oninput = (e) => { state.m0bSearch = e.target.value; rerender(); };
        document.getElementById("m0bTypeSel").onchange = (e) => { state.m0bTypeFilter = e.target.value; rerender(); };
        document.getElementById("m0bOrdShop").onchange = (e) => { state.m0bOrderShopFilter = e.target.value; state.m0bOrderPage = 1; rerender(); };
        document.getElementById("m0bOrdStatus").onchange = (e) => { state.m0bOrderStatusFilter = e.target.value; state.m0bOrderPage = 1; rerender(); };
        document.getElementById("m0bOrdPrev").onclick = () => { state.m0bOrderPage -= 1; rerender(); };
        document.getElementById("m0bOrdNext").onclick = () => { state.m0bOrderPage += 1; rerender(); };

        document.querySelectorAll(".m0b-jump-cs").forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          state.csActiveId = b.dataset.sid || "s1";
          goPage("m1a");
        });

        document.querySelectorAll(".m0b-detail").forEach(b => b.onclick = () => {
          const p = state.masterProducts.find(x => x.sku === b.dataset.sku);
          const stockRows = state.inventoryItems.filter(i => i.sku === p.sku);
          const logs = state.costChangeLogs.filter(c => c.sku === p.sku);
          openDrawer(`${p.sku} · ${p.name}`, `成本卡 ${p.costVer} · 各仓库存与成本变更历史`, `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <img src="${getProductImg(p.sku)}" class="prod-thumb-lg" alt="${p.name}"/>
              <div class="formula-box" style="flex:1;margin:0;">
                <strong>单件落地成本：</strong>$${p.cost.toFixed(2)}(采购) + $${p.ship.toFixed(2)}(头程) = <strong>$${(p.cost + p.ship).toFixed(2)}</strong>
              </div>
            </div>
            <div class="drawer-sec-label">各店铺独立库存现状：</div>
            ${stockRows.map(s => `
              <div class="anno-card" style="border-left-color:${s.shopMode==="REAL"?"#10b981":"#f59e0b"};margin-bottom:8px;">
                <div><strong>${s.shopName}</strong> <span class="pill ${s.shopMode==="REAL"?"p-green":"p-amber"}">${s.shopMode}</span></div>
                <div style="font-size:12px;margin-top:4px;">店铺商品编号：<code>${s.shopSku}</code> · 存放仓库：<strong>${s.whName}</strong></div>
                <div style="font-size:12px;margin-top:3px;">当前可售：<strong>${s.avail} 件</strong> · 锁定：${s.locked} 件 · 安全线：${s.safety} 件</div>
              </div>
            `).join("")}
            <div class="drawer-sec-label" style="margin-top:12px;">成本卡版本变更留痕：</div>
            ${logs.length ? logs.map(l => `<div class="ledger-row"><strong>${l.ver}</strong> (${l.effective})：${l.oldCost} → ${l.newCost} · 原因：${l.reason} · 审批：${l.approver}</div>`).join("") : '<div style="font-size:12px;color:var(--text-soft);">暂无近期变更</div>'}
            <button class="btn btn-primary btn-sm" id="drGotoInv" style="margin-top:12px;">去 M0-3 分店独立库存中心盘点 →</button>
          `, () => {
            document.getElementById("drGotoInv").onclick = () => { closeDetailDrawer(); goPage("m0c"); };
          });
        });

        document.querySelectorAll(".m0b-cost").forEach(b => b.onclick = () => {
          const p = state.masterProducts.find(x => x.sku === b.dataset.sku);
          const nextVer = "v" + (Number(p.costVer.replace("v", "")) + 1);
          commitAction({
            title: `调整成本卡 · ${p.sku} (${p.costVer} → ${nextVer})`,
            summary: "影响面提示：成本卡版本升级将实时影响 M2 经营利润核算、M3 智能问数毛利、M5 预测参考金额与 M6 补货占用现金测算！",
            confirmText: "提交生效新成本卡",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>新采购单价 (USD) *</label><input id="cNewCost" type="number" step="0.1" class="input" value="${p.cost}"/></div>
                <div class="field"><label>新头程运费 (USD) *</label><input id="cNewShip" type="number" step="0.1" class="input" value="${p.ship}"/></div>
              </div>
              <div class="field"><label>生效日期 *</label><input id="cEffDate" type="date" class="input" value="${nowDateTimeStr().slice(0,10)}"/></div>
              <div class="field"><label>变更原因说明 *</label><input id="cReason" class="input" placeholder="如：供应商原料调价 / 航运旺季附加费"/></div>
              <div class="field"><label>审批复核人 * (不可与当前操作人同名)</label><input id="cAppr" class="input" value="${state.role==="approver"?"王总":"陈主管"}"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const cEl = wrap.querySelector("#cNewCost");
              const sEl = wrap.querySelector("#cNewShip");
              const dEl = wrap.querySelector("#cEffDate");
              const rEl = wrap.querySelector("#cReason");
              const aEl = wrap.querySelector("#cAppr");
              if (!(Number(cEl.value) > 0)) errs.push({ el: cEl, msg: "采购单价必须大于 0" });
              if (Number(sEl.value) < 0 || sEl.value === "") errs.push({ el: sEl, msg: "头程运费不能小于 0" });
              if (!dEl.value) errs.push({ el: dEl, msg: "请选择成本卡生效日期" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "必须填写成本变更原因" });
              if (!aEl.value.trim()) errs.push({ el: aEl, msg: "必须指定复核审批人" });
              return errs;
            },
            onConfirm: (wrap) => {
              const nc = Number(wrap.querySelector("#cNewCost").value);
              const ns = Number(wrap.querySelector("#cNewShip").value);
              const eff = wrap.querySelector("#cEffDate").value;
              const reason = wrap.querySelector("#cReason").value.trim();
              const appr = wrap.querySelector("#cAppr").value.trim();
              const oldCostStr = `$${p.cost.toFixed(2)}+$${p.ship.toFixed(2)}`;
              p.cost = nc; p.ship = ns; p.costVer = nextVer;
              state.costChangeLogs.unshift({
                time: nowDateTimeStr(), sku: p.sku, ver: nextVer,
                oldCost: oldCostStr, newCost: `$${nc.toFixed(2)}+$${ns.toFixed(2)}`,
                effective: eff, reason, approver: appr, historical: false
              });
              return { toastMsg: `${p.sku} 成本卡已升级至 ${nextVer}（M2/M6 资金测算已联动）` };
            },
            audit: (wrap) => ({
              target: `M0-2 成本卡 · ${p.sku}`,
              action: `升级成本卡至 ${nextVer}`,
              detail: `原因：${wrap.querySelector("#cReason").value.trim()} · 复核人：${wrap.querySelector("#cAppr").value.trim()}`,
              ok: true
            })
          });
        });

        const openOrderDetail = (oid) => {
          const o = state.orders.find(x => x.id === oid);
          if (!o) return;
          const nextStatus = o.status === "PAID" ? "SHIPPED" : o.status === "SHIPPED" ? "DELIVERED" : null;
          openDrawer(`订单明细 · ${o.id}`, `${o.shopName} · ${o.mode}`, `
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
              <div>当前状态：<span class="pill ${o.status==="DELIVERED"?"p-green":o.status==="SHIPPED"?"p-blue":"p-amber"}">${o.status}</span></div>
              <div>买家昵称：<strong>${o.buyer}</strong></div>
              <div>购买商品：<strong>${o.sku} × ${o.qty} 件</strong></div>
              <div>实付金额：<strong>${o.currency} ${o.amount} (≈ $${o.amountUsd.toFixed(2)})</strong></div>
              <div>下单时间：<strong>${o.time}</strong></div>
              <div>数据口径：<strong>${o.note}</strong></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${nextStatus ? `<button class="btn btn-primary btn-sm" id="advOrderBtn">推进订单状态 → ${nextStatus}</button>` : `<span class="pill p-green">已完结妥投 (DELIVERED) ✓</span>`}
              ${o.id === "SYN9D-005671" ? `<button class="btn btn-sm" id="ordToCsBtn">跳至 M1-1 关联客服会话 →</button>` : ""}
            </div>
          `, () => {
            const adv = document.getElementById("advOrderBtn");
            if (adv) adv.onclick = () => {
              commitAction({
                title: `推进订单状态 · ${o.id}`,
                summary: `确认将订单状态从 ${o.status} 推进至 ${nextStatus} 并记录状态变更时间？`,
                confirmText: `确认改为 ${nextStatus}`,
                onConfirm: () => {
                  const old = o.status;
                  o.status = nextStatus;
                  closeDetailDrawer();
                  return { toastMsg: `订单 ${o.id} 已推进为 ${nextStatus}（原 ${old}）` };
                },
                audit: { target: `M0-2 订单 ${o.id}`, action: "订单状态机推进", detail: `${o.status} → ${nextStatus}`, ok: true }
              });
            };
            const tc = document.getElementById("ordToCsBtn");
            if (tc) tc.onclick = () => { closeDetailDrawer(); state.csActiveId = "s1"; goPage("m1a"); };
          });
        };

        document.querySelectorAll(".m0b-ord-row").forEach(r => r.onclick = () => openOrderDetail(r.dataset.oid));
        document.querySelectorAll(".m0b-ord-btn").forEach(b => b.onclick = (e) => { e.stopPropagation(); openOrderDetail(b.dataset.oid); });
      }
    };
  }

  // ==================== M0c: Store×Warehouse Independent Stock Center ====================
  if (pageId === "m0c") {
    const canEditStock = state.role === "warehouse" || state.role === "manager";
    const q = state.m0cSearch.toLowerCase();
    const filtered = state.inventoryItems.filter(i =>
      (state.m0cShopFilter === "ALL" || i.shopId === state.m0cShopFilter) &&
      (!q || i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.whName.toLowerCase().includes(q))
    );
    const realLowCount = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety).length;

    return {
      headerActions: [
        { label: "去 M6 智能补货测算 →", primary: false, onClick: () => goPage("m6b") },
        {
          label: "同步全部实盘仓库存", primary: true,
          disabled: !canEditStock,
          disabledTitle: "需「采购/仓库/物流人员」或「管理者」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canEditStock) { record403("M0-3 同步库存", "无仓储权限"); return; }
            runAsyncTask("m0_inv_sync", {
              label: "双仓实时库存快照同步",
              steps: ["连接美国美西/美东与泰国曼谷仓", "校验锁定库存与安全库存线", "更新 M5/M6 缺口基准"],
              durationMs: 950,
              onSuccess: () => {
                state.stockSyncedAt = nowDateTimeStr();
                state.stockSyncedTs = Date.now();
                state.inventoryItems.forEach(i => { if (i.shopMode === "REAL") i.updated = nowTimeStr(); });
                return { summary: "双仓 5 条实盘记录已校准", toastMsg: `实盘仓库存同步完成 (${state.stockSyncedAt})` };
              }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>实际存放仓库说明：</strong>同款商品在不同海外仓/本地仓（如「美国美西海外仓」与「泰国曼谷本地仓」）<strong>物理隔离、独立计数</strong>；M6 采购收货凭证绝不自动改写本表库存，必须由仓管在此盘点校准。</span>
          <span class="pill p-amber">最近同步：${state.stockSyncedTs ? `${state.stockSyncedAt} (${relTimeLabel(state.stockSyncedTs)})` : state.stockSyncedAt}</span>
        </div>
        ${renderAsyncBox("m0_inv_sync")}

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">分店×仓 SKU 总条目</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.inventoryItems.length} 条</div>
            <div class="kpi-sub">实盘 5 条 · MOCK 演示 1 条</div>
          </div>
          <div class="kpi-card highlight-amber">
            <div class="kpi-label">实盘低库存预警</div>
            <div class="kpi-val" style="color:var(--red-text)">${realLowCount} 项</div>
            <div class="kpi-sub">可售 &lt; 安全库存，建议去 M6 补货</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">一货多店示例 (BAG-108)</div>
            <div class="kpi-val" style="font-size:20px;">美仓 ${state.inventoryItems.find(x=>x.id==="inv1").avail} / 泰仓 ${state.inventoryItems.find(x=>x.id==="inv2").avail}</div>
            <div class="kpi-sub">M5 建议补货实时联动重算</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">当前角色库存权限</div>
            <div class="kpi-val" style="font-size:18px;color:${canEditStock?"var(--green-text)":"var(--text-soft)"}">${canEditStock?"可同步/盘点 ✓":"仅只读查看"}</div>
            <div class="kpi-sub">${canEditStock?"盘点改数将直接重算 M5/M6 缺口":"需仓库/管理者权限(左上角可切)"}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 按「店铺 × 实际存放仓库」管理库存（盘点改数后实时联动 M5/M6 补货缺口）</div>
          </div>

          <div class="utabs" style="margin-bottom:12px;">
            <div class="utab ${state.m0cShopFilter==="ALL"?"active":""} m0c-tab" data-sh="ALL">全部店铺 <span class="utab-cnt">${state.inventoryItems.length}</span></div>
            ${state.shops.map(s => {
              const cnt = state.inventoryItems.filter(i => i.shopId === s.id).length;
              return `<div class="utab ${state.m0cShopFilter===s.id?"active":""} m0c-tab" data-sh="${s.id}">${s.name} (${s.mode}) <span class="utab-cnt">${cnt}</span></div>`;
            }).join("")}
          </div>

          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item" style="max-width:380px;">
              <input id="m0cSearchInp" class="input" placeholder="搜索 SKU / 品名 / 仓库名称 (如 美国美西海外仓)…" value="${state.m0cSearch}"/>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>商品主 SKU & 品名</th><th>在售店铺 (模式)</th><th>实际存放仓库</th><th>当前可售</th><th>已锁定</th><th>安全库存</th><th>水位状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(item => {
                  const isLow = item.avail < item.safety;
                  return `
                    <tr>
                      <td><strong>${item.sku} · ${item.name}</strong><div style="font-size:12px;color:var(--text-soft)">店铺编号：<code>${item.shopSku}</code> · ${item.note}</div></td>
                      <td class="nowrap">${item.shopName} <span class="pill ${item.shopMode==="REAL"?"p-green":"p-amber"}">${item.shopMode}</span></td>
                      <td class="nowrap"><strong>${item.whName || WAREHOUSE_LABELS[item.wh] || item.wh}</strong></td>
                      <td class="nowrap"><strong style="font-size:15px;color:${isLow?"var(--red-text)":"var(--text-dark)"}">${item.avail} 件</strong></td>
                      <td class="nowrap">${item.locked} 件</td>
                      <td class="nowrap">${item.safety} 件</td>
                      <td class="nowrap">
                        ${item.shopMode === "MOCK"
                          ? '<span class="pill p-gray">仅演示·不计实仓</span>'
                          : isLow ? '<span class="pill p-red">低库存预警</span>' : '<span class="pill p-green">库存充足</span>'}
                      </td>
                      <td class="nowrap">
                        <button class="btn btn-sm m0c-edit" data-id="${item.id}" ${!canEditStock?"disabled":""} title="${!canEditStock?"需采购/仓库/物流或管理者权限":""}">盘点改数</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🧾 盘点校准单留痕（M0-3 独立盘点记录）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>盘点单号</th><th>SKU · 存放仓库</th><th>盘点前 → 盘点后</th><th>差异原因</th><th>经办人</th><th>时间</th></tr></thead>
              <tbody>
                ${state.stocktakes.map(st => `
                  <tr>
                    <td class="nowrap"><strong>${st.id}</strong> ${st.historical?'<span class="pill p-gray">历史示例</span>':'<span class="pill p-green">新单</span>'}</td>
                    <td>${st.sku} · ${st.whName}</td>
                    <td class="nowrap">${st.oldQty} 件 → <strong>${st.newQty} 件</strong></td>
                    <td>${st.reason}</td>
                    <td class="nowrap">${st.actor}</td>
                    <td class="nowrap">${st.time}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m0c-tab").forEach(t => t.onclick = () => { state.m0cShopFilter = t.dataset.sh; rerender(); });
        document.getElementById("m0cSearchInp").oninput = (e) => { state.m0cSearch = e.target.value; rerender(); };
        document.querySelectorAll(".m0c-edit").forEach(b => b.onclick = () => {
          const item = state.inventoryItems.find(x => x.id === b.dataset.id);
          const pdId = genDocId("PD");
          commitAction({
            title: `人工盘点校准 · ${item.sku} (${item.whName})`,
            summary: `生成盘点单号 <strong>${pdId}</strong>；保存后将实时重算 M5 建议补货参考量、M6 补货缺口与库存覆盖天数！`,
            confirmText: "确认写入盘点单并联动 M5/M6",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>当前系统可售 (件)</label><input class="input" readonly value="${item.avail}"/></div>
                <div class="field"><label>最新实盘可售 (件, ≥0) *</label><input id="invNewQty" type="number" class="input" value="${item.avail}"/></div>
              </div>
              <div class="field"><label>安全库存预警线 (件, ≥0) *</label><input id="invNewSafe" type="number" class="input" value="${item.safety}"/></div>
              <div class="field"><label>盘点差异原因 * (若变动幅度 ≥ 30% 将触发大额差异提示)</label><input id="invReason" class="input" value="日常循环盘点校准同步"/></div>
              <div id="invWarnBox"></div>
            `,
            onMount: (wrap) => {
              const qEl = wrap.querySelector("#invNewQty");
              const warn = wrap.querySelector("#invWarnBox");
              const checkDiff = () => {
                const v = Number(qEl.value);
                if (v < 0) warn.innerHTML = `<div class="banner banner-red">❌ 可售库存禁止设为负数！</div>`;
                else if (item.avail > 0 && Math.abs(v - item.avail) / item.avail >= 0.3) {
                  warn.innerHTML = `<div class="banner banner-amber">⚠️ 注意：本次盘点变动幅度超过 30%（${item.avail} → ${v}），请务必核实实物与原因后再确认！</div>`;
                } else warn.innerHTML = "";
              };
              qEl.oninput = checkDiff;
              checkDiff();
            },
            validate: (wrap) => {
              const errs = [];
              const qEl = wrap.querySelector("#invNewQty");
              const sEl = wrap.querySelector("#invNewSafe");
              const rEl = wrap.querySelector("#invReason");
              if (qEl.value === "" || Number(qEl.value) < 0) errs.push({ el: qEl, msg: "实盘可售库存必须为 ≥ 0 的整数" });
              if (sEl.value === "" || Number(sEl.value) < 0) errs.push({ el: sEl, msg: "安全库存不能小于 0" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "必须填写盘点差异原因" });
              return errs;
            },
            onConfirm: (wrap) => {
              const oldQty = item.avail;
              const newQty = Math.floor(Number(wrap.querySelector("#invNewQty").value));
              const newSafe = Math.floor(Number(wrap.querySelector("#invNewSafe").value));
              const reason = wrap.querySelector("#invReason").value.trim();
              item.avail = newQty;
              item.safety = newSafe;
              item.updated = nowTimeStr();
              state.stocktakes.unshift({
                id: pdId, sku: item.sku, whName: item.whName,
                oldQty, newQty, reason, actor: state.role, time: nowDateTimeStr(), historical: false
              });
              return { toastMsg: `盘点单 ${pdId} 已生效：${item.sku} 库存 ${oldQty} → ${newQty} 件（M5/M6 缺口已重算）` };
            },
            audit: (wrap) => ({
              target: `M0-3 盘点校准 · ${item.sku} (${pdId})`,
              action: "库存盘点改数",
              detail: `${item.whName}：${item.avail} 件（原因：${wrap.querySelector("#invReason").value.trim()}）`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M1a: CS 3-Column Workbench ====================
  if (pageId === "m1a") {
    const activeSess = state.csSessions.find(s => s.id === state.csActiveId) || state.csSessions[0];
    const canCs = state.role === "cs" || state.role === "approver";
    const matchedOrder = state.orders.find(o => o.id === activeSess.orderId) || state.orders[2];

    return {
      headerActions: [
        { label: "去客服导购商品库", primary: false, onClick: () => goPage("m1b") },
        {
          label: activeSess.mode === "HUMAN" ? "已人工接管 ✓" : "人工接管当前会话",
          primary: true,
          disabled: !canCs || activeSess.mode === "HUMAN",
          disabledTitle: !canCs ? "需「客服」或「主管/审批人」权限 — 请在左上角切换角色" : "已人工接管",
          onClick: () => {
            if (!canCs) { record403("M1-1 人工接管", "非客服/主管不可接管会话"); return; }
            commitAction({
              title: `确认人工接管会话 · ${activeSess.buyer}`,
              summary: "接管后将暂停 AI 自动建议发送，记录接管人身份与精确时间。",
              confirmText: "确认接管会话",
              onConfirm: () => {
                activeSess.mode = "HUMAN";
                activeSess.takenBy = state.role === "cs" ? "林客服 (cs)" : "陈主管 (approver)";
                activeSess.takenAt = nowDateTimeStr();
                return { toastMsg: `会话已由 ${activeSess.takenBy} 接管 (${activeSess.takenAt})` };
              },
              audit: { target: `M1-1 会话 ${activeSess.id}`, action: "客服人工接管", detail: `接管买家 ${activeSess.buyer}，订单 ${activeSess.orderId}`, ok: true }
            });
          }
        }
      ],
      html: `
        <div class="split-3col-cs">
          <div class="card" style="padding:14px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div class="card-title" style="font-size:14px;">会话队列 (${state.csSessions.length})</div>
            </div>
            ${state.csSessions.map(s => `
              <div class="session-item ${s.id === activeSess.id ? "active" : ""}" data-sid="${s.id}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="font-size:13px;">${s.buyer}</strong>
                  <span style="font-size:12px;color:var(--text-soft)">${s.time}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.preview}</div>
                <span class="pill ${s.mode === "PENDING_HUMAN" ? "p-purple" : s.mode === "HUMAN" ? "p-blue" : "p-green"}">${s.mode}</span>
              </div>
            `).join("")}
            <button class="btn btn-sm" id="gotoSimBuyerBtn" style="width:100%;justify-content:center;margin-top:6px;">+ 从模拟买家入口发消息</button>
          </div>

          <div class="card" style="padding:16px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div>
                <strong>${activeSess.buyer}</strong>
                <span style="color:var(--text-soft);font-size:12.5px;margin-left:6px;">${activeSess.platform} · ${activeSess.intent} (${activeSess.conf})</span>
                ${activeSess.takenBy ? `<div style="font-size:12px;color:var(--blue-hover);">接管人：${activeSess.takenBy} · ${activeSess.takenAt}</div>` : ""}
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
                  <div><strong>售后投诉拦截：</strong>禁止 AI 自动承诺赔付或退款</div>
                  <div style="font-size:12px;font-weight:400;margin-top:2px;">请人工核验订单并前往 M1-3 创建售后审批单</div>
                </div>
              </div>
            ` : `
              <div class="banner banner-blue" style="margin-bottom:10px;">
                <span><strong>本店导购召回 Top-3：</strong>${activeSess.recs || "已按本店 ACTIVE/READY 商品匹配"}</span>
              </div>
            `}

            <div class="field">
              <label>中文拟定回复（含金额时系统将校验双语数字与本店域名）</label>
              <textarea id="csZhInput" class="textarea" style="min-height:54px;">您好，已为您核实订单损坏情况（实付 $34.50），现为您提交退款工单审核。</textarea>
            </div>
            <div class="field">
              <label>外语买家回复（支持测试改错金额如 $99.00 或放错店铺域名如 shopee.co.th 触发拦截）</label>
              <textarea id="csEnInput" class="textarea" style="min-height:54px;">Hello, we verified your order ($34.50) and submitted a refund review.</textarea>
            </div>
            <div id="csSendGuardErr"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--text-soft)">发送守卫：本店域名 (${activeSess.shopDomain || "amazon.com"}) & 双语数字强一致</span>
              <button class="btn btn-primary" id="csSendBtn" ${!canCs?"disabled":""} title="${!canCs?"需客服或主管权限":""}">校验并模拟发送</button>
            </div>
          </div>

          <div class="card" style="padding:16px;">
            <div class="card-header" style="margin-bottom:10px;"><div class="card-title" style="font-size:14px;">客户与订单核验</div></div>
            <div style="font-size:13px;display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">客户名称</span><strong>${activeSess.buyer}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">店铺与域名</span><strong>${activeSess.shopDomain || activeSess.platform}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">意图识别</span><strong>${activeSess.intent} (${activeSess.conf})</strong></div>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;">
              <div style="font-size:12px;font-weight:700;color:var(--blue-hover);margin-bottom:4px;">候选订单核验详情</div>
              <div style="font-weight:700;">${matchedOrder.id}</div>
              <div style="font-size:12px;color:var(--text-muted);margin:4px 0;">
                买家：${matchedOrder.buyer} · ${matchedOrder.sku} × ${matchedOrder.qty}件<br/>
                金额：${matchedOrder.currency} ${matchedOrder.amount} ($${matchedOrder.amountUsd.toFixed(2)}) · ${matchedOrder.status}
              </div>
              <button class="btn btn-primary btn-sm" id="bindOrderBtn" style="width:100%;justify-content:center;margin-top:6px;" ${!canCs?"disabled":""}>
                ${activeSess.bound ? "已核验并绑定订单 ✓" : "核验并绑定订单"}
              </button>
            </div>
            <button class="btn btn-sm" id="gotoTicketsBtn" style="width:100%;justify-content:center;border-color:var(--blue);color:var(--blue);">
              ${activeSess.bound ? "已绑单 · 带单前往 M1-3 建售后工单 →" : "前往售后工单审批页 →"}
            </button>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".session-item").forEach(el => el.onclick = () => { state.csActiveId = el.dataset.sid; rerender(); });
        document.getElementById("gotoTicketsBtn").onclick = () => goPage("m1c");
        document.getElementById("gotoSimBuyerBtn").onclick = () => goPage("m1d");

        document.getElementById("bindOrderBtn").onclick = () => {
          commitAction({
            title: `订单核验与绑定确认 · ${matchedOrder.id}`,
            summary: "请人工逐项核对以下订单字段与当前会话买家诉求一致后，方可绑定至工单前序上下文：",
            confirmText: "确认核验无误并绑定",
            fieldsHtml: `
              <div class="formula-box" style="margin-bottom:10px;">
                • 订单号：<strong>${matchedOrder.id}</strong><br/>
                • 买家姓名：<strong>${matchedOrder.buyer}</strong><br/>
                • 商品明细：<strong>${matchedOrder.sku} × ${matchedOrder.qty} 件</strong><br/>
                • 订单总额：<strong>${matchedOrder.currency} ${matchedOrder.amount} ($${matchedOrder.amountUsd.toFixed(2)})</strong><br/>
                • 下单时间：<strong>${matchedOrder.time}</strong>
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-weight:600;">
                <input type="checkbox" id="bindChk"/> 我已人工核对以上买家、SKU、金额完全匹配
              </label>
            `,
            validate: (wrap) => {
              const ck = wrap.querySelector("#bindChk");
              return ck.checked ? [] : [{ el: ck, msg: "请先勾选确认核对以上订单信息无误" }];
            },
            onConfirm: () => {
              activeSess.bound = true;
              activeSess.boundSnapshot = `${matchedOrder.id} ($${matchedOrder.amountUsd.toFixed(2)}) · ${nowTimeStr()}`;
              return { toastMsg: `已完成核验并绑定订单 ${matchedOrder.id}，可前往 M1-3 创建售后工单` };
            },
            audit: { target: `M1-1 绑单 · ${matchedOrder.id}`, action: "人工核验绑定订单", detail: `会话 ${activeSess.id} 绑定金额 $${matchedOrder.amountUsd.toFixed(2)}`, ok: true }
          });
        };

        document.getElementById("csSendBtn").onclick = () => {
          const zhText = document.getElementById("csZhInput").value.trim();
          const enText = document.getElementById("csEnInput").value.trim();
          const guardBox = document.getElementById("csSendGuardErr");
          guardBox.innerHTML = "";

          if (!zhText || !enText) {
            guardBox.innerHTML = `<div class="banner banner-red" style="margin-bottom:8px;">拦截：中英文回复内容均不可为空！</div>`;
            return;
          }
          // Real bilingual number comparison
          const zhNums = (zhText.match(/\d+(?:\.\d+)?/g) || []).join(",");
          const enNums = (enText.match(/\d+(?:\.\d+)?/g) || []).join(",");
          if (zhNums !== enNums) {
            appendAuditLog(state, { target: `M1-1 发送校验 (${activeSess.id})`, action: "双语数字拦截", detail: `中文数字[${zhNums}] ≠ 英文数字[${enNums}]`, ok: false });
            guardBox.innerHTML = `<div class="banner banner-red" style="margin-bottom:8px;">❌ 后端规则拦截 (FR-CS-19)：中英文回复中的数字不一致（中文：[${zhNums || "无"}] vs 英文：[${enNums || "无"}]），已阻止发送！</div>`;
            toast("双语数字校验不通过，已拦截发送", "error");
            return;
          }
          // Real cross-shop domain link check
          const allDomains = ["shopee.co.th", "shop.tiktok.com", "amazon.com"];
          const currentDom = activeSess.shopDomain || "amazon.com";
          const wrongDom = allDomains.find(d => d !== currentDom && enText.toLowerCase().includes(d));
          if (wrongDom) {
            appendAuditLog(state, { target: `M1-1 发送校验 (${activeSess.id})`, action: "跨店链接拦截", detail: `当前店铺为 ${currentDom}，回复包含非本店域名 ${wrongDom}`, ok: false });
            guardBox.innerHTML = `<div class="banner banner-red" style="margin-bottom:8px;">❌ 跨店链接拦截 (FR-CS-19)：当前会话属于 <strong>${currentDom}</strong>，严禁发送其他店铺域名（检测到 <code>${wrongDom}</code>）！</div>`;
            toast("检测到非本店链接，已拦截发送", "error");
            return;
          }

          commitAction({
            title: "确认模拟发送外语回复",
            summary: `已通过双语数字一致校验 (${enNums || "无数字"}) 与本店域名校验；当前为模拟发送态 (DELIVERED_MOCK)，不调用真实平台 API。`,
            confirmText: "确认模拟发送",
            onConfirm: () => {
              activeSess.messages.push({ role: "agent", text: enText, zh: zhText });
              return { toastMsg: "已写入模拟回复记录 (DELIVERED_MOCK)" };
            },
            audit: { target: `M1-1 回复 ${activeSess.buyer}`, action: "模拟发送双语回复", detail: `通过数字/域名强校验`, ok: true }
          });
        };
      }
    };
  }

  // ==================== M1b: CS Guided Product Catalog ====================
  if (pageId === "m1b") {
    const canMaintainKb = state.role === "planner" || state.role === "cs" || state.role === "approver";
    const q = state.csSearch.toLowerCase();
    const filtered = state.csProducts.filter(p =>
      (state.csShopFilter === "ALL" || p.shop === state.csShopFilter) &&
      (!q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );
    return {
      headerActions: [
        {
          label: "重建向量索引 (模拟)", primary: false,
          disabled: !canMaintainKb,
          onClick: () => {
            runAsyncTask("m1_vec", {
              label: "重建客服商品向量索引 (每20件一批)",
              steps: ["校验店铺 ACTIVE 状态", "按20件分批请求 Embedding", "模拟写回索引状态 (未连真实 Milvus)"],
              durationMs: 1200,
              onSuccess: () => {
                state.csProducts.forEach(p => { p.vec = "READY (演示向量)"; });
                return { summary: `已处理 ${state.csProducts.length} 件商品 (演示模拟态)`, toastMsg: "向量索引批处理模拟完成（未连接真实 Milvus）" };
              }
            });
          }
        },
        {
          label: "+ 导入 XLSX / CSV 文件", primary: true,
          disabled: !canMaintainKb,
          onClick: () => {
            openModal("批量导入客服导购商品 (XLSX / CSV)", `
              <div class="banner banner-amber" style="margin-bottom:10px;">⚠️ 向量库写入属于 B 类服务（未配置真实 Milvus），导入校验真实执行，向量化进度为演示模拟。</div>
              <div class="field"><label>目标店铺 * (按组织/店铺隔离)</label><select id="kbShopSel" class="select"><option>Shopee TH</option><option>TikTok US</option></select></div>
              <div class="field"><label>选择本地 .xlsx / .csv 文件 * (或点下方快速样例)</label>
                <input id="kbFileInp" type="file" accept=".xlsx,.csv" class="input" style="padding:6px;"/>
                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                  <button class="btn btn-sm" id="kbPresetOk">载入正常样例文件 (kb_batch_ok.xlsx)</button>
                  <button class="btn btn-sm btn-danger" id="kbPresetMock">载入含 mock 文件名 (mock_test_items.xlsx)</button>
                </div>
              </div>
              <div id="kbPreviewBox" class="formula-box" style="margin-bottom:10px;display:none;"></div>
              <button class="btn btn-primary" id="confirmImportKb" style="width:100%;justify-content:center;">执行列校验并启动分批向量化</button>
            `, () => {
              let chosenFile = "";
              let isMockFile = false;
              const prevBox = document.getElementById("kbPreviewBox");
              const showPrev = (fname) => {
                chosenFile = fname;
                isMockFile = /mock/i.test(fname);
                prevBox.style.display = "block";
                if (isMockFile) {
                  prevBox.innerHTML = `<strong style="color:var(--red-text)">❌ 校验拦截：</strong>文件名 <code>${fname}</code> 含有 <code>mock</code> 标识，严禁当作真实导购商品导入！`;
                } else {
                  prevBox.innerHTML = `<strong>文件预览 (${fname})：</strong><br/>1. DESK-901 · 铝合金笔记本支架 · $26.00 · 列校验通过 ✓<br/>2. LAMP-305 · 护眼夹灯 · <span style="color:var(--red-text)">缺价格列 (将记为失败行)</span>`;
                }
              };
              document.getElementById("kbFileInp").onchange = (e) => {
                const f = e.target.files && e.target.files[0];
                if (f) showPrev(f.name);
              };
              document.getElementById("kbPresetOk").onclick = () => showPrev("kb_batch_ok.xlsx");
              document.getElementById("kbPresetMock").onclick = () => showPrev("mock_test_items.xlsx");
              document.getElementById("confirmImportKb").onclick = () => {
                if (!chosenFile) { toast("请先选择文件或点击样例文件", "error"); return; }
                const shop = document.getElementById("kbShopSel").value;
                if (isMockFile) {
                  state.csImportLogs.unshift({ file: chosenFile, shop, total: 0, okCount: 0, failCount: 0, status: "FAILED：含mock禁止导入", time: nowDateTimeStr(), note: "拦截" });
                  appendAuditLog(state, { target: `M1-2 文件导入 (${chosenFile})`, action: "Mock 文件拦截", detail: "文件名含 mock 标识被阻断", ok: false });
                  closeModal(); rerender(); toast("已阻断含 mock 标识的文件导入！", "error");
                  return;
                }
                closeModal();
                runAsyncTask("m1_vec", {
                  label: `导入并分批向量化 · ${chosenFile}`,
                  steps: ["整表列格式校验", "按 20 件每批生成向量 (模拟)", "回写 READY 与失败行原因"],
                  durationMs: 1200,
                  onSuccess: () => {
                    if (!state.csProducts.some(x => x.sku === "DESK-901")) {
                      state.csProducts.unshift({ sku: "DESK-901", name: "铝合金折叠笔记本支架", shop, domain: shop === "Shopee TH" ? "shopee.co.th" : "shop.tiktok.com", price: "$26.00", useCase: "桌面散热增高", vec: "READY (演示向量)", on: true });
                    }
                    state.csImportLogs.unshift({ file: chosenFile, shop, total: 2, okCount: 1, failCount: 1, status: "PARTIAL_OK (第2行缺价格)", time: nowDateTimeStr(), note: "演示模拟" });
                    return { summary: "成功 1 条 (DESK-901) · 失败 1 条 (LAMP-305 缺价格)", toastMsg: "导入完成：1 条入库，1 条因缺价格跳过" };
                  }
                });
              };
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span>💡 <strong>定位说明（SRS §3.1）：</strong>本页是供<strong>客服人员回答买家咨询</strong>时使用的「本店在售导购词典」（防编造报价、防串店发错链接）；寻找未采购的新品请前往 <strong>M4 选品分析</strong>。</span>
        </div>
        ${renderAsyncBox("m1_vec")}

        <div class="card">
          <div class="utabs" style="margin-bottom:12px;">
            ${["ALL", "Shopee TH", "TikTok US"].map(sh => `
              <div class="utab ${state.csShopFilter===sh?"active":""} shop-flt" data-shop="${sh}">${sh==="ALL"?"全部店铺":sh}</div>
            `).join("")}
          </div>
          <div class="filter-bar">
            <div class="filter-item" style="max-width:340px;">
              <input id="m1bSearch" class="input" placeholder="搜索导购 SKU / 商品名…" value="${state.csSearch}"/>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-blue">1</span> 本店售前导购商品目录（CustomerRecommendedProduct）</div>
            <span class="pill p-green">仅召回本店 ACTIVE / READY 商品</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品主图 & SKU</th><th>商品名称 / 导购卖点</th><th>归属店铺与域名</th><th>参考售价</th><th>向量状态 (B类模拟)</th><th>导购开关</th></tr></thead>
              <tbody>
                ${filtered.map(p => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${getProductImg(p.sku)}" class="prod-thumb-img" alt="${p.name}"/>
                        <strong>${p.sku}</strong>
                      </div>
                    </td>
                    <td><strong>${p.name}</strong><div style="font-size:12px;color:var(--text-soft);">${p.useCase || "—"}</div></td>
                    <td class="nowrap">${p.shop} <div style="font-size:12px;color:var(--text-soft);"><code>${p.domain || "—"}</code></div></td>
                    <td class="nowrap"><strong>${p.price}</strong></td>
                    <td class="nowrap"><span class="pill ${p.vec.includes("READY") ? "p-green" : "p-amber"}">${p.vec}</span></td>
                    <td class="nowrap"><button class="btn btn-sm toggle-kb" data-sku="${p.sku}">${p.on ? "已启用 ✓" : "已停用"}</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">📥 导入与向量化批次记录</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>文件名</th><th>店铺</th><th>解析统计</th><th>结果状态</th><th>时间</th></tr></thead>
              <tbody>
                ${state.csImportLogs.map(l => `
                  <tr>
                    <td><strong>${l.file}</strong> <span class="pill p-gray">${l.note}</span></td>
                    <td>${l.shop}</td>
                    <td>共 ${l.total} · 成功 ${l.okCount} · 失败 ${l.failCount}</td>
                    <td><span class="pill ${l.status.includes("FAILED")?"p-red":l.status.includes("PARTIAL")?"p-amber":"p-green"}">${l.status}</span></td>
                    <td>${l.time}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".shop-flt").forEach(b => b.onclick = () => { state.csShopFilter = b.dataset.shop; rerender(); });
        document.getElementById("m1bSearch").oninput = (e) => { state.csSearch = e.target.value; rerender(); };
        document.querySelectorAll(".toggle-kb").forEach(b => b.onclick = () => {
          const item = state.csProducts.find(x => x.sku === b.dataset.sku);
          item.on = !item.on;
          appendAuditLog(state, { target: `M1-2 导购开关 · ${item.sku}`, action: item.on ? "启用导购" : "停用导购", detail: item.shop, ok: true });
          rerender(); toast(`${item.sku} 导购开关已${item.on ? "开启" : "停用"}`);
        });
      }
    };
  }

  // ==================== M1d: Mock Buyer Simulator ====================
  if (pageId === "m1d") {
    return {
      headerActions: [{ label: "前往客服三栏工作台 →", primary: true, onClick: () => goPage("m1a") }],
      html: `
        <div class="card" style="max-width:780px;">
          <div class="card-header"><div class="card-title">模拟买家入站消息发送器（仅内部联调与教学演示）</div></div>
          <div class="banner banner-blue" style="margin-bottom:12px;">说明：真实买家从不登录 CrossPilot，此页面作为联调入口模拟消息入站，将在 M1-1 中真实触发规则意图识别、Top-3 推荐或敏感拦截。</div>
          <div class="field"><label>买家昵称与平台 *</label><input id="simBuyerName" class="input" value="Demo Buyer · AMAZON US" /></div>
          <div class="field">
            <label>快捷测试场景</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm sim-preset" data-msg="Do you have a waterproof desk mat under $25 for home office?">场景A：商品咨询 (触发导购 Top-3 召回)</button>
              <button class="btn btn-sm sim-preset" data-msg="My parcel SYN9D-005671 arrived broken, I demand a full refund!">场景B：损坏退款 (触发 PENDING_HUMAN 拦截)</button>
            </div>
          </div>
          <div class="field"><label>买家发送内容 (英文/多语) *</label><textarea id="simBuyerMsg" class="textarea">Do you have a waterproof desk mat under $25 for home office?</textarea></div>
          <button class="btn btn-primary" id="sendSimMsgBtn">发送买家消息并进入 M1-1 工作台 →</button>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".sim-preset").forEach(b => b.onclick = () => { document.getElementById("simBuyerMsg").value = b.dataset.msg; });
        document.getElementById("sendSimMsgBtn").onclick = () => {
          const msg = document.getElementById("simBuyerMsg").value.trim();
          const bName = document.getElementById("simBuyerName").value.split("·")[0].trim();
          if (!msg || !bName) { toast("买家名称与消息内容不可为空", "error"); return; }
          const isRefund = /refund|broken|damaged/i.test(msg);
          const id = "s" + Date.now();
          const activeItems = state.csProducts.filter(p => p.on && p.vec.includes("READY"));
          const recs = activeItems.slice(0, 3).map((p, i) => `①②③`[i] + ` ${p.sku} ${p.name} (${p.price})`).join(" ");
          const messages = [
            { role: "buyer", text: msg, zh: isRefund ? "我的包裹破损了，要求全额退款！" : "请问有 25 美元以内防水办公桌垫推荐吗？" }
          ];
          if (!isRefund && activeItems.length) {
            messages.push({ role: "agent", text: `[AI 规则预拟草稿] We recommend ${activeItems[0].sku} (${activeItems[0].price}) via ${activeItems[0].domain}.`, zh: `[AI 规则预拟] 推荐本店在售款 ${activeItems[0].name}（${activeItems[0].price}），待客服确认后发送。` });
          }
          state.csSessions.unshift({
            id, buyer: bName, platform: "AMAZON US", shopName: "Amazon 演示沙盒店", shopDomain: "amazon.com", lang: "EN",
            time: nowTimeStr(), preview: msg,
            mode: isRefund ? "PENDING_HUMAN" : "AI_AUTO",
            takenBy: "", takenAt: "",
            intent: isRefund ? "REFUND" : "PRODUCT_INQUIRY", conf: isRefund ? "91%" : "94%", risk: isRefund,
            recs, orderId: "SYN9D-005671", bound: false, boundSnapshot: null, messages
          });
          state.csActiveId = id;
          appendAuditLog(state, { target: `M1-4 模拟入站 (${id})`, action: "模拟买家入站", detail: `意图=${isRefund?"REFUND(拦截)":"PRODUCT_INQUIRY(推荐)"}`, ok: true });
          goPage("m1a"); toast(isRefund ? "命中退款风险词，已置为 PENDING_HUMAN 待客服接管" : "已触发导购 Top-3 召回并生成 AI 建议草稿", isRefund ? "warn" : "success");
        };
      }
    };
  }

  // ==================== M1c: After-sales Tickets & SoD Approval + Voucher Backfill ====================
  if (pageId === "m1c") {
    const canApprove = state.role === "approver";
    const canCreate = state.role === "cs" || state.role === "approver";
    const t = state.tickets[state.ticketIdx] || state.tickets[0];
    const sodSame = t.submitter === state.role;

    return {
      headerActions: [
        { label: "返回客服工作台", primary: false, onClick: () => goPage("m1a") },
        {
          label: "+ 新建售后工单", primary: true,
          disabled: !canCreate,
          disabledTitle: "需「客服」或「主管/审批人」权限 — 请在左上角切换角色",
          onClick: () => {
            if (!canCreate) { record403("M1-3 新建售后工单", "无建单权限"); return; }
            const newTkId = genDocId("TK");
            commitAction({
              title: `新建售后审批工单 · ${newTkId}`,
              summary: "退款金额不得超过所选订单的实付金额上限；提交后需由不同于提交人的主管角色审批。",
              confirmText: "提交待主管审批",
              fieldsHtml: `
                <div class="field"><label>关联订单 *</label>
                  <select id="tkOrdSel" class="select">
                    ${state.orders.map(o => `<option value="${o.id}" data-amt="${o.amountUsd}">${o.id} · ${o.buyer} · 上限 $${o.amountUsd.toFixed(2)}</option>`).join("")}
                  </select>
                </div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>售后类型 *</label><select id="tkType" class="select"><option>破损部分退款</option><option>破损全额退款</option><option>补发配件</option></select></div>
                  <div class="field"><label>申请退款金额 (USD) *</label><input id="tkAmt" type="number" step="0.01" class="input" value="15.00"/></div>
                </div>
                <div class="field"><label>售后核验原因与证据说明 *</label><textarea id="tkReason" class="textarea" placeholder="说明物流破损或缺失核验情况..."></textarea></div>
              `,
              validate: (wrap) => {
                const errs = [];
                const ordSel = wrap.querySelector("#tkOrdSel");
                const maxAmt = Number(ordSel.options[ordSel.selectedIndex].dataset.amt);
                const amtEl = wrap.querySelector("#tkAmt");
                const amt = Number(amtEl.value);
                const rEl = wrap.querySelector("#tkReason");
                if (amtEl.value === "" || amt < 0) errs.push({ el: amtEl, msg: "退款金额不能小于 0" });
                else if (amt > maxAmt) errs.push({ el: amtEl, msg: `退款金额 ($${amt}) 不得超过原订单金额上限 ($${maxAmt.toFixed(2)})` });
                if (!rEl.value.trim()) errs.push({ el: rEl, msg: "必须填写售后原因与核验说明" });
                return errs;
              },
              onConfirm: (wrap) => {
                const ordSel = wrap.querySelector("#tkOrdSel");
                const order = ordSel.value;
                const orderAmount = Number(ordSel.options[ordSel.selectedIndex].dataset.amt);
                const refundAmount = Number(wrap.querySelector("#tkAmt").value);
                const kind = wrap.querySelector("#tkType").value;
                const reason = wrap.querySelector("#tkReason").value.trim();
                state.tickets.unshift({
                  id: newTkId, order, orderAmount, refundAmount,
                  type: `${kind} $${refundAmount.toFixed(2)}`, reason,
                  submitter: state.role, approver: "", approveNote: "", status: "待主管审批", ext: "—", voucher: ""
                });
                state.ticketIdx = 0;
                return { toastMsg: `售后工单 ${newTkId} 已提交审批` };
              },
              audit: (wrap) => ({
                target: `M1-3 工单 ${newTkId}`,
                action: "创建售后工单",
                detail: `订单 ${wrap.querySelector("#tkOrdSel").value}，申请 $${wrap.querySelector("#tkAmt").value}`,
                ok: true
              })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>闭环与诚实边界：</strong>主管审批通过后仅写入本地审批台账（<code>external_status = UNKNOWN</code>），需客服/运营在后台手动退款后<strong>上传人工退款凭证</strong>完成闭环，绝不虚构平台已自动打款！</span>
        </div>
        <div class="split-right-panel">
          <div class="card">
            <div class="card-header"><div class="card-title">售后审批队列（客服建单 → 主管审批 → 上传人工凭证回填）</div></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>工单编号</th><th>关联订单</th><th>申请 / 上限</th><th>提交人</th><th>状态</th><th>平台回执</th></tr></thead>
                <tbody>
                  ${state.tickets.map((row, i) => `
                    <tr class="tk-row ${i===state.ticketIdx?"row-selected":""}" data-idx="${i}" style="cursor:pointer;">
                      <td class="nowrap"><strong>${row.id}</strong></td>
                      <td class="nowrap">${row.order}</td>
                      <td class="nowrap"><strong>${row.type}</strong><div style="font-size:12px;color:var(--text-soft);">上限 $${row.orderAmount.toFixed(2)}</div></td>
                      <td class="nowrap">${row.submitter}</td>
                      <td class="nowrap"><span class="pill ${row.status.includes("已批准")?"p-green":row.status==="已驳回"?"p-red":"p-amber"}">${row.status}</span></td>
                      <td class="nowrap"><span class="pill ${row.voucher?"p-green":"p-gray"}">${row.ext}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title">工单详情 · ${t.id}</div></div>
            <div style="font-size:13px;display:flex;flex-direction:column;gap:7px;margin-bottom:12px;">
              <div>关联订单：<strong>${t.order}</strong>（总额上限 $${t.orderAmount.toFixed(2)}）</div>
              <div>申请内容：<strong>${t.type}</strong></div>
              <div>售后原因：${t.reason || "—"}</div>
              <div>提交人：<strong>${t.submitter}</strong></div>
              <div>当前角色：<strong>${state.role}</strong> ${!canApprove ? '<span class="pill p-red">无审批权限(需主管)</span>' : sodSame ? '<span class="pill p-red">触发SoD：不可自审</span>' : '<span class="pill p-green">SoD 校验通过 ✓</span>'}</div>
              ${t.approver ? `<div>审批人：<strong>${t.approver}</strong> · 意见：${t.approveNote}</div>` : ""}
              ${t.voucher ? `<div>人工退款凭证：<code>${t.voucher}</code></div>` : ""}
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-success" id="approveTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""} title="${!canApprove?"需「主管/审批人」权限 — 请在左上角切换角色":sodSame?"SoD禁止自审":""}">批准退款</button>
              <button class="btn btn-danger" id="rejectTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""}>驳回工单</button>
              ${t.status === "已批准(待传凭证)" ? `<button class="btn btn-primary" id="uploadVoucherBtn">上传人工退款凭证并回填 →</button>` : ""}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".tk-row").forEach(r => r.onclick = () => { state.ticketIdx = Number(r.dataset.idx); rerender(); });
        const ab = document.getElementById("approveTkBtn");
        if (ab) ab.onclick = () => {
          commitAction({
            title: `主管批准售后工单 · ${t.id}`,
            summary: `退款金额 $${t.refundAmount.toFixed(2)} ≤ 原订单上限 $${t.orderAmount.toFixed(2)}；批准后平台回执先标记为 <code>UNKNOWN</code>，等待上传人工打款凭证。`,
            confirmText: "加行锁批准",
            fieldsHtml: `<div class="field"><label>审批意见 * (必填)</label><textarea id="tkApprNote" class="textarea" placeholder="填写审核结论与依据..."></textarea></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#tkApprNote");
              return el.value.trim() ? [] : [{ el, msg: "审批意见为必填项" }];
            },
            onConfirm: (wrap) => {
              t.status = "已批准(待传凭证)";
              t.ext = "UNKNOWN";
              t.approver = "陈主管 (approver)";
              t.approveNote = wrap.querySelector("#tkApprNote").value.trim();
              return { toastMsg: "工单已批准（external_status=UNKNOWN），请上传人工退款凭证完成闭环" };
            },
            audit: (wrap) => ({
              target: `M1-3 工单 ${t.id}`,
              action: "主管批准售后工单",
              detail: `意见：${wrap.querySelector("#tkApprNote").value.trim()}`,
              ok: true
            })
          });
        };

        const rb = document.getElementById("rejectTkBtn");
        if (rb) rb.onclick = () => {
          commitAction({
            title: `驳回售后工单 · ${t.id}`,
            danger: true,
            confirmText: "确认驳回",
            fieldsHtml: `<div class="field"><label>驳回理由 * (必填)</label><textarea id="tkRejNote" class="textarea" placeholder="说明驳回原因（如缺少破损照片）..."></textarea></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#tkRejNote");
              return el.value.trim() ? [] : [{ el, msg: "驳回必须填写明确理由" }];
            },
            onConfirm: (wrap) => {
              t.status = "已驳回";
              t.approver = "陈主管 (approver)";
              t.approveNote = wrap.querySelector("#tkRejNote").value.trim();
              return { toastMsg: `工单 ${t.id} 已驳回`, toastLevel: "warn" };
            },
            audit: (wrap) => ({ target: `M1-3 工单 ${t.id}`, action: "驳回售后工单", detail: wrap.querySelector("#tkRejNote").value.trim(), ok: true })
          });
        };

        const vb = document.getElementById("uploadVoucherBtn");
        if (vb) vb.onclick = () => {
          commitAction({
            title: `上传人工退款凭证并回填 · ${t.id}`,
            summary: "模拟上传客服在电商后台手工打款后的截图/流水号，回填 external_status 完成售后闭环。",
            confirmText: "保存凭证并回填状态",
            fieldsHtml: `
              <div class="field"><label>选择凭证截图 (可选)</label><input id="vchFile" type="file" class="input" style="padding:6px;"/></div>
              <div class="field"><label>打款流水/凭证编号 *</label><input id="vchCode" class="input" value="${genDocId("VCH")}"/></div>
            `,
            validate: (wrap) => {
              const el = wrap.querySelector("#vchCode");
              return el.value.trim() ? [] : [{ el, msg: "请填写打款流水或凭证编号" }];
            },
            onConfirm: (wrap) => {
              const f = wrap.querySelector("#vchFile").files[0];
              t.voucher = (f ? f.name + " · " : "") + wrap.querySelector("#vchCode").value.trim();
              t.ext = "人工凭证已登记";
              t.status = "已批准(凭证已回填)";
              return { toastMsg: `工单 ${t.id} 人工退款凭证已回填，售后闭环完成 ✓` };
            },
            audit: (wrap) => ({ target: `M1-3 工单 ${t.id}`, action: "回填退款凭证", detail: `凭证：${wrap.querySelector("#vchCode").value.trim()}`, ok: true })
          });
        };
      }
    };
  }

  // ==================== M2a: BI Designer (Draft vs Published Dual Versions) ====================
  if (pageId === "m2a") {
    const canDesign = state.role === "planner" || state.role === "bi_analyst" || state.role === "manager";
    const stats = computeLiveBusinessStats();
    const resolveVal = (metric, scope) => {
      if (metric === "gmv") return `$${stats.gmv.toLocaleString()}`;
      if (metric === "net_profit") return `$${stats.netProfit.toLocaleString()}`;
      if (metric === "orders_count") return `${stats.ordersCnt.toLocaleString()} 单`;
      return scope && scope.includes("7天") ? "$2,933.63" : `$${stats.adSpend.toLocaleString()}`;
    };
    const w = state.biWidgets[state.biSelectedIdx] || state.biWidgets[0];

    return {
      headerActions: [
        {
          label: "版本回滚到上一发布版", primary: false,
          disabled: !canDesign || state.biPublishHistory.length === 0,
          onClick: () => {
            const last = state.biPublishHistory[0];
            commitAction({
              title: `回滚发布版至 ${last.ver}`,
              summary: "将草稿区与已发布大屏恢复到最近一次已保存的历史快照。",
              confirmText: "确认回滚",
              onConfirm: () => {
                if (last.widgets) state.biWidgets = JSON.parse(JSON.stringify(last.widgets));
                state.biPublishedVersion = last.ver;
                return { toastMsg: `已回滚至版本 ${last.ver}`, toastLevel: "warn" };
              },
              audit: { target: "M2-1 驾驶舱", action: "版本回滚", detail: `回滚到 ${last.ver}`, ok: true }
            });
          }
        },
        {
          label: "发布草稿到大屏 →", primary: true,
          disabled: !canDesign,
          disabledTitle: "需「驾驶舱设计者/业务运营」或「BI/管理者」权限 — 请在左上角切换角色",
          onClick: () => {
            commitAction({
              title: `发布驾驶舱草稿 (${state.biDraftVersion})`,
              summary: `即将把当前草稿区 <strong>${state.biWidgets.length} 个组件</strong> 发布替换线上发布版 <strong>${state.biPublishedVersion}</strong>。`,
              confirmText: "确认发布到大屏",
              fieldsHtml: `
                <div class="formula-box" style="margin-bottom:10px;">
                  <strong>草稿 vs 当前发布版差异对比：</strong><br/>
                  • 发布版组件 (${state.biPublishedWidgets.length}个)：${state.biPublishedWidgets.map(x=>x.title).join("、")}<br/>
                  • 本次草稿组件 (${state.biWidgets.length}个)：${state.biWidgets.map(x=>x.title).join("、")}
                </div>
                <div class="field"><label>发布版本说明 *</label><input id="biPubNote" class="input" value="更新经营总览布局与实时M3指标绑定"/></div>
              `,
              validate: (wrap) => {
                const el = wrap.querySelector("#biPubNote");
                return el.value.trim() ? [] : [{ el, msg: "请填写发布版本说明" }];
              },
              onConfirm: (wrap) => {
                const nextVer = "v1." + (state.biPublishHistory.length + 3);
                state.biPublishHistory.unshift({
                  ver: state.biPublishedVersion, time: nowDateTimeStr(), by: state.role,
                  note: wrap.querySelector("#biPubNote").value.trim(),
                  widgets: JSON.parse(JSON.stringify(state.biWidgets))
                });
                state.biPublishedWidgets = state.biWidgets.map(item => ({
                  title: item.title, metric: item.metric, val: resolveVal(item.metric, item.scope), sub: item.scope
                }));
                state.biPublishedVersion = nextVer;
                state.biPublishedAt = nowDateTimeStr();
                goPage("m2b");
                return { toastMsg: `驾驶舱已发布为 ${nextVer} 并同步至 M2-2 只读大屏` };
              },
              audit: (wrap) => ({ target: "M2-1 驾驶舱发布", action: "发布驾驶舱版本", detail: wrap.querySelector("#biPubNote").value.trim(), ok: true })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>双版本隔离：</strong>草稿态 (<code>${state.biDraftVersion}</code>) 编辑不影响线上大屏 (<code>${state.biPublishedVersion}</code>)；组件数值直接绑定 M0/M3 实时事实（当前实盘 GMV <strong>$${stats.gmv.toLocaleString()}</strong>）。</span>
        </div>
        <div class="split-bi">
          <div class="card" style="padding:14px;">
            <div class="card-header"><div class="card-title" style="font-size:14px;">组件库 (点击添加)</div></div>
            ${[
              { t: "GMV 指标卡", m: "gmv" },
              { t: "净利润指标卡", m: "net_profit" },
              { t: "订单总量卡", m: "orders_count" },
              { t: "广告花费卡", m: "ad_spend" },
            ].map(c => `
              <button class="btn btn-sm bi-add-comp" data-comp="${c.t}" data-m="${c.m}" style="width:100%;justify-content:flex-start;margin-bottom:8px;" ${!canDesign?"disabled":""}>+ ${c.t}</button>
            `).join("")}
          </div>

          <div class="card" style="background:#f8fafc;border:1.5px dashed var(--blue-border);">
            <div class="card-header">
              <div class="card-title" style="color:var(--blue-hover);">草稿画布预览 (${state.biDraftVersion} · ${state.biWidgets.length}组件)</div>
              <span class="pill p-blue">当前线上：${state.biPublishedVersion}</span>
            </div>
            <div class="grid-2" style="margin-bottom:12px;">
              ${state.biWidgets.map((item, i) => `
                <div class="kpi-card" style="cursor:pointer;${i===state.biSelectedIdx?"border:1.5px solid var(--blue)":""}" data-wi="${i}">
                  <div class="kpi-label">
                    <span>${item.title}</span>
                    <span style="display:flex;gap:4px;">
                      <button class="btn btn-sm bi-mv" data-i="${i}" title="前移" ${!canDesign?"disabled":""}>↑</button>
                      <button class="btn btn-sm bi-del" data-i="${i}" title="删除" ${!canDesign?"disabled":""}>✕</button>
                    </span>
                  </div>
                  <div class="kpi-val" style="color:${item.color}">${resolveVal(item.metric, item.scope)}</div>
                  <div class="kpi-sub">绑定口径：${item.metric} · ${item.scope}</div>
                </div>
              `).join("")}
            </div>
            <div class="formula-box">
              <strong>跨组件实时同源公式：</strong>净利率 = $${stats.netProfit.toLocaleString()} ÷ $${stats.gmv.toLocaleString()} = <strong>${stats.marginPct}%</strong> · ACOS = <strong>${stats.acosPct}%</strong>
            </div>
          </div>

          <div class="card" style="padding:16px;">
            <div class="card-header"><div class="card-title" style="font-size:14px;">选中组件属性</div></div>
            <div class="field"><label>组件标题 *</label><input id="biPropTitle" class="input" value="${w.title}"/></div>
            <div class="field"><label>绑定统一指标</label>
              <select id="biPropMetric" class="select">
                <option value="gmv" ${w.metric==="gmv"?"selected":""}>gmv (销售额)</option>
                <option value="net_profit" ${w.metric==="net_profit"?"selected":""}>net_profit (净利润)</option>
                <option value="orders_count" ${w.metric==="orders_count"?"selected":""}>orders_count (订单数)</option>
                <option value="ad_spend" ${w.metric==="ad_spend"?"selected":""}>ad_spend (广告花费)</option>
              </select>
            </div>
            <div class="field"><label>时间范围</label><select id="biPropScope" class="select"><option>全部平台 · 近30天</option><option>Amazon · 近7天</option></select></div>
            <button class="btn btn-primary btn-sm" id="biApplyProp" style="width:100%;justify-content:center;" ${!canDesign?"disabled":""}>应用并刷新实盘数值</button>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll("[data-wi]").forEach(el => el.onclick = () => { state.biSelectedIdx = Number(el.dataset.wi); rerender(); });
        document.querySelectorAll(".bi-mv").forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          const i = Number(b.dataset.i);
          if (i > 0) { const t = state.biWidgets[i - 1]; state.biWidgets[i - 1] = state.biWidgets[i]; state.biWidgets[i] = t; state.biSelectedIdx = i - 1; rerender(); }
        });
        document.querySelectorAll(".bi-del").forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          if (state.biWidgets.length <= 1) { toast("画布至少保留 1 个组件", "warn"); return; }
          state.biWidgets.splice(Number(b.dataset.i), 1); state.biSelectedIdx = 0; rerender();
        });
        document.querySelectorAll(".bi-add-comp").forEach(b => b.onclick = () => {
          state.biWidgets.push({ title: b.dataset.comp, val: resolveVal(b.dataset.m), metric: b.dataset.m, scope: "全部平台 · 近30天", color: "var(--purple-text)" });
          state.biSelectedIdx = state.biWidgets.length - 1; rerender(); toast("已添加到草稿画布");
        });
        document.getElementById("biApplyProp").onclick = () => {
          const title = document.getElementById("biPropTitle").value.trim();
          if (!title) { toast("组件标题不能为空", "error"); return; }
          w.title = title;
          w.metric = document.getElementById("biPropMetric").value;
          w.scope = document.getElementById("biPropScope").value;
          w.val = resolveVal(w.metric, w.scope);
          rerender(); toast("已同步最新实时口径数值");
        };
      }
    };
  }

  // ==================== M2b: Published BI Dashboard ====================
  if (pageId === "m2b") {
    const stats = computeLiveBusinessStats();
    const jumpAsk = (q) => {
      state.qaChat.push({ role: "user", text: q });
      state.qaPendingQuery = q;
      goPage("m3b");
    };
    return {
      headerActions: [
        { label: "返回设计工作台", primary: false, onClick: () => goPage("m2a") },
        {
          label: "↻ 刷新大屏实时数据", primary: true,
          onClick: () => {
            runAsyncTask("m2_refresh", {
              label: "大屏并发拉取 M0/M3 事实快照",
              steps: ["并发请求 4 项实时指标", "按统一币种 USD 核对口径", "刷新大屏图表与异常提示"],
              durationMs: 850,
              onSuccess: () => {
                state.biPublishedAt = nowDateTimeStr();
                return { summary: `已刷新 ${stats.ordersCnt} 笔订单事实`, toastMsg: "大屏已基于最新实盘订单重算刷新" };
              }
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span>数据截止：<strong>${state.biPublishedAt}</strong> | 发布版本：<strong>${state.biPublishedVersion}</strong> | 实盘同步新增订单：<strong>${stats.syncedDeltaCnt} 笔</strong></span>
          <span class="pill p-green">与 M0/M3 共用实时事实</span>
        </div>
        ${renderAsyncBox("m2_refresh")}

        <div class="grid-4">
          <div class="kpi-card m2-drill" data-q="请拆解当前全部实盘 GMV 销售额与新同步订单情况" style="cursor:pointer;">
            <div class="kpi-label">GMV 销售额 <span class="pill p-blue">点击下钻</span></div>
            <div class="kpi-val" style="color:var(--blue-hover)">$${stats.gmv.toLocaleString()}</div>
            <div class="kpi-sub">含历史基线 + 新同步实盘订单</div>
            <div class="formula-inline"><code>Σ(实盘订单实付USD)</code></div>
          </div>
          <div class="kpi-card m2-drill" data-q="当前实盘总订单数和平均客单价是多少？" style="cursor:pointer;">
            <div class="kpi-label">订单总数 <span class="pill p-blue">点击下钻</span></div>
            <div class="kpi-val" style="color:var(--green-text)">${stats.ordersCnt.toLocaleString()} 单</div>
            <div class="kpi-sub">实盘已去重计数</div>
            <div class="formula-inline">客单价 = <code>$${stats.aov}</code></div>
          </div>
          <div class="kpi-card m2-drill" data-q="Amazon最近7天广告花费和ACOS是多少？" style="cursor:pointer;">
            <div class="kpi-label">广告花费 (ACOS ${stats.acosPct}%) <span class="pill p-blue">点击下钻</span></div>
            <div class="kpi-val" style="color:var(--amber-text)">$${stats.adSpend.toLocaleString()}</div>
            <div class="kpi-sub">Amazon近7天 $2,933.63</div>
            <div class="formula-inline">ACOS = <code>${stats.acosPct}%</code></div>
          </div>
          <div class="kpi-card highlight-green m2-drill" data-q="各平台近30天净利润与净利率怎么算的？" style="cursor:pointer;">
            <div class="kpi-label">净利润 (净利率 ${stats.marginPct}%) <span class="pill p-blue">点击下钻</span></div>
            <div class="kpi-val" style="color:var(--purple-text)">$${stats.netProfit.toLocaleString()}</div>
            <div class="kpi-sub">仅统计纯实盘订单</div>
            <div class="formula-inline">净利率 = <code>${stats.marginPct}%</code></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title">多平台每日 GMV 与利润趋势</div></div>
            <svg viewBox="0 0 560 190" style="width:100%;height:auto;max-height:200px;display:block;background:#ffffff;border-radius:6px;">
              <line x1="30" y1="45" x2="530" y2="45" stroke="#f1f5f9" stroke-width="1"/>
              <line x1="30" y1="100" x2="530" y2="100" stroke="#f1f5f9" stroke-width="1"/>
              <line x1="30" y1="155" x2="530" y2="155" stroke="#e2e8f0" stroke-width="1"/>
              <polyline fill="none" stroke="#2563eb" stroke-width="2.4" points="40,140 110,120 180,126 250,88 320,76 390,54 460,44 520,28" />
              <polyline fill="none" stroke="#10b981" stroke-width="2.2" points="40,152 110,142 180,145 250,125 320,118 390,104 460,94 520,82" />
              <text x="40" y="175" font-size="11.5" fill="#475569">11-12</text>
              <text x="250" y="175" font-size="11.5" fill="#475569" text-anchor="middle">11-15</text>
              <text x="520" y="175" font-size="11.5" fill="#475569" text-anchor="end">今日最新</text>
              <circle cx="400" cy="20" r="3.5" fill="#2563eb"/><text x="408" y="24" font-size="11.5" fill="#2563eb" font-weight="600">GMV</text>
              <circle cx="462" cy="20" r="3.5" fill="#10b981"/><text x="470" y="24" font-size="11.5" fill="#10b981" font-weight="600">净利润</text>
            </svg>
          </div>
          <div class="card card-blue">
            <div class="card-header"><div class="card-title">经营异常告警与联动下钻</div></div>
            <p style="margin-top:0;color:var(--text-muted)">
              1. <strong>同源实时</strong>：当前实盘共 <strong>${stats.ordersCnt}</strong> 单，净利润 <strong>$${stats.netProfit.toLocaleString()}</strong>（净利率 ${stats.marginPct}%）。<br/><br/>
              2. <strong>低库存告警</strong>：M0-3 检测到 <strong>${stats.realLowStocks.length} 项</strong>实盘低库存（${stats.realLowStocks.map(i=>i.sku).join(", ") || "无"}）。<br/><br/>
              3. 点击上方任意指标卡或下方按钮，可直接带着问题下钻到 M3 智能问答！
            </p>
            <button class="btn btn-primary" id="biGotoQaBtn">带着低库存与利润上下文去问数 →</button>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m2-drill").forEach(c => c.onclick = () => jumpAsk(c.dataset.q));
        document.getElementById("biGotoQaBtn").onclick = () => jumpAsk("各店铺当前低库存预警有哪些？");
      }
    };
  }

  // ==================== M3a: QA Metrics & Celery Sync ====================
  if (pageId === "m3a") {
    const canMaintain = state.role === "bi_analyst" || state.role === "planner" || state.role === "manager";
    return {
      headerActions: [{ label: "前往经营智能问答 →", primary: true, onClick: () => goPage("m3b") }],
      html: `
        <div class="banner banner-amber">
          <span>⚠️ <strong>B类边界提示：</strong>Celery Beat 调度与外部 REST 接口依赖后端配置（当前 <code>API_BASE</code> 为空，<code>METRIC_REST_BASE_URL</code> 未配置），REST 型指标触发将诚实显示“未连接后端”。</span>
        </div>
        ${renderAsyncBox("m3_sync")}

        <div class="card">
          <div class="card-header"><div class="card-title">新增指标与接口绑定配置</div></div>
          <div class="grid-4">
            <div class="field"><label>指标代码 * (小写字母/下划线, 不可重名)</label><input id="m3Code" class="input" value="conversion_rate"/></div>
            <div class="field"><label>指标名称 *</label><input id="m3Name" class="input" value="店铺转化率"/></div>
            <div class="field"><label>取值方式</label><select id="m3Kind" class="select"><option value="SIMULATION">内置汇总 (SIMULATION)</option><option value="REST API">REST API</option></select></div>
            <div class="field"><label>REST URL 模板 (REST API必填 {platform})</label><input id="m3Url" class="input" placeholder="https://api.example.com/{platform}/cvr"/></div>
          </div>
          <div id="m3FormErr"></div>
          <button class="btn btn-primary btn-sm" id="addMetricBtn" ${!canMaintain?"disabled":""} title="${!canMaintain?"需 BI/运营/管理者权限":""}">校验并创建指标绑定</button>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">数据绑定与调度台账（展示上次/下次执行时间与失败重试）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>绑定 / 指标</th><th>接口类型</th><th>平台</th><th>周期</th><th>上次 / 下次执行</th><th>最新数据 / 状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.qaBindings.map((b, i) => `
                  <tr>
                    <td><strong>${b.name}</strong>${b.url ? `<div style="font-size:12px;color:var(--text-soft);"><code>${b.url}</code></div>` : ""}</td>
                    <td class="nowrap"><span class="pill p-blue">${b.kind}</span></td>
                    <td class="nowrap">${b.platform}</td>
                    <td class="nowrap">${b.cron}</td>
                    <td class="nowrap" style="font-size:12px;">上次：${b.lastRun}<br/>下次：${b.nextRun}</td>
                    <td><strong>${b.val}</strong><div style="margin-top:2px;"><span class="pill ${b.status.includes("未连接")||b.status.includes("FAILED")?"p-red":"p-green"}">${b.status}</span></div></td>
                    <td class="nowrap"><button class="btn btn-sm run-sync-btn" data-i="${i}" ${!canMaintain?"disabled":""}>▶ 立即触发</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("addMetricBtn").onclick = () => {
          const errBox = document.getElementById("m3FormErr");
          errBox.innerHTML = "";
          const code = document.getElementById("m3Code").value.trim();
          const name = document.getElementById("m3Name").value.trim();
          const kind = document.getElementById("m3Kind").value;
          const url = document.getElementById("m3Url").value.trim();

          if (!/^[a-z][a-z0-9_]{1,30}$/.test(code)) {
            errBox.innerHTML = `<div class="field-err" style="margin-bottom:8px;">指标代码格式错误：须小写字母开头，仅含字母/数字/下划线</div>`;
            return;
          }
          if (state.qaBindings.some(b => b.code === code)) {
            errBox.innerHTML = `<div class="field-err" style="margin-bottom:8px;">指标代码 <code>${code}</code> 已存在，违反唯一性约束！</div>`;
            return;
          }
          if (!name) {
            errBox.innerHTML = `<div class="field-err" style="margin-bottom:8px;">请填写指标中文名称</div>`;
            return;
          }
          if (kind === "REST API" && (!/^https?:\/\/.+/.test(url) || !url.includes("{platform}"))) {
            errBox.innerHTML = `<div class="field-err" style="margin-bottom:8px;">REST API 模式下 URL 须以 http(s):// 开头且包含 <code>{platform}</code> 占位符！</div>`;
            return;
          }

          commitAction({
            title: `新增指标绑定 · ${name} (${code})`,
            summary: kind === "REST API" ? "将写入 REST 调度绑定；因当前未连接后端 METRIC_REST_BASE_URL，初始状态将标为未连接模拟态。" : "将写入内置汇总调度队列。",
            confirmText: "保存绑定",
            onConfirm: () => {
              state.qaBindings.unshift({
                code, name: `${name} (${code})`, kind, platform: "全部平台", cron: "每15分钟",
                val: kind === "REST API" ? "—" : "3.42%",
                status: kind === "REST API" ? "未连接后端 REST" : "SUCCESS (演示)",
                lastRun: nowTimeStr(), nextRun: "15分钟后", url
              });
              return { toastMsg: `已创建指标绑定：${name}` };
            },
            audit: { target: `M3-1 指标 ${code}`, action: "新增指标绑定", detail: `${kind} · ${name}`, ok: true }
          });
        };

        document.querySelectorAll(".run-sync-btn").forEach(b => b.onclick = () => {
          const item = state.qaBindings[Number(b.dataset.i)];
          const isRestFail = item.kind === "REST API" && !API_BASE;
          runAsyncTask("m3_sync", {
            label: `调度拉取 · ${item.name}`,
            steps: ["检查调度锁与鉴权配置", "拉取数据并校验 JSON 路径", "写入 metric_snapshots"],
            durationMs: 950,
            shouldFail: isRestFail,
            failReason: `未配置后端 METRIC_REST_BASE_URL，无法请求真实 REST 接口 (${item.url})`,
            onFail: () => { item.status = "FAILED：未连接服务"; item.lastRun = nowTimeStr(); },
            onSuccess: () => {
              item.lastRun = nowTimeStr();
              item.status = "SUCCESS (演示)";
              return { summary: `同步成功 (${item.val})`, toastMsg: `${item.name} 演示快照刷新成功` };
            }
          });
        });
      }
    };
  }

  // ==================== M3b: QA Chat (Real State-Computed Answers + Multi-turn Context) ====================
  if (pageId === "m3b") {
    const stats = computeLiveBusinessStats();
    const runQuery = (q) => {
      if (!q.trim()) return;
      state.qaChat.push({ role: "user", text: q });
      const latency = 18 + Math.floor(Math.random() * 42);

      runAsyncTask("m3_qa", {
        label: "只读问数解析与 SQL 校验",
        steps: ["parse_question() 识别意图与多轮上下文", "SQL AST 只读白名单守卫", "读取当前内存实时数据计算"],
        durationMs: 650,
        onSuccess: () => {
          if (/update|delete|drop|insert|alter|修改|删除/i.test(q)) {
            state.qaChat.push({
              role: "assistant", blocked: true,
              text: "拦截提示：智能问数仅支持只读 SELECT 查询，已拦截并拒绝写入/修改操作！",
              sql: "AUDIT: 写操作拦截事件已写入 rbac_audit_logs"
            });
            appendAuditLog(state, { target: "M3-2 SQL 守卫", action: "拦截写操作 SQL", detail: q, ok: false });
            return { summary: "已安全拦截写操作", toastMsg: "触发只读守卫，已拒绝写操作", toastLevel: "warn" };
          }

          // Multi-turn context inheritance
          const prevUser = [...state.qaChat].reverse().find((m, i) => i > 0 && m.role === "user")?.text || "";
          const ctxStock = /美国|美仓|泰国|泰仓|其中/.test(q) && /库存|缺货/.test(prevUser);

          if (/库存|缺货/.test(q) || ctxStock) {
            const scopeFilter = /美国|美仓/.test(q) ? "shop_us" : /泰国|泰仓/.test(q) ? "shop_th" : null;
            const list = state.inventoryItems.filter(i => i.shopMode === "REAL" && (!scopeFilter || i.shopId === scopeFilter));
            const lows = list.filter(i => i.avail < i.safety);
            const scopeTitle = scopeFilter === "shop_us" ? "美国仓" : scopeFilter === "shop_th" ? "泰国仓" : "全部实盘仓";
            state.qaChat.push({
              role: "assistant",
              text: `${scopeTitle}共追踪 ${list.length} 条实盘库存（已排除 MOCK 店），其中低库存预警 ${lows.length} 项：` +
                (lows.length ? lows.map(l => `${l.whName} ${l.sku}(可售 ${l.avail} < 安全线 ${l.safety})`).join("；") : "暂无低库存预警。"),
              note: "实时数据源：直接从 M0-3 当前内存库存表计算（改盘点数字后再次提问即变）",
              sql: `SELECT wh_name, sku, avail, safety FROM inventory_positions WHERE mode='REAL'${scopeFilter?` AND shop_id='${scopeFilter}'`:""} [${latency}ms]`,
              feedback: null
            });
          } else if (/广告|ad_spend|acos/i.test(q)) {
            state.qaChat.push({
              role: "assistant",
              text: `近 30 天实盘广告花费为 $${stats.adSpend.toLocaleString()}，结合当前实时 GMV $${stats.gmv.toLocaleString()}，实时 ACOS = ${stats.acosPct}%（Amazon 近 7 天花费 $2,933.63）。`,
              note: "口径：M0 实盘订单汇总 + 广告快照（多币种分列不混加）",
              sql: `SELECT SUM(ad_spend_usd), SUM(ad_spend_usd)/${stats.gmv} AS acos FROM metric_snapshots [${latency}ms]`,
              feedback: null
            });
          } else if (/订单|客单价|gmv|销售/i.test(q)) {
            const byShop = state.shops.filter(s => s.mode === "REAL").map(s => {
              const cnt = state.orders.filter(o => o.shopId === s.id).length;
              return `${s.name}(样本${cnt}笔)`;
            }).join("，");
            state.qaChat.push({
              role: "assistant",
              text: `当前实盘总 GMV 为 $${stats.gmv.toLocaleString()}（订单 ${stats.ordersCnt.toLocaleString()} 单，客单价 $${stats.aov}），含您在 M0-1 新同步的 ${stats.syncedDeltaCnt} 笔实盘订单。各实盘店：${byShop}。`,
              note: "实时数据源：M0-2 实盘订单动态汇总（已自动排除 Amazon MOCK 店订单）",
              sql: `SELECT COUNT(*), SUM(amount_usd) FROM orders WHERE mode='REAL' [${latency}ms]`,
              feedback: null
            });
          } else {
            state.qaChat.push({
              role: "assistant",
              text: `全部实盘近 30 天实时 GMV 为 $${stats.gmv.toLocaleString()}，净利润 $${stats.netProfit.toLocaleString()}，净利率 = ${stats.netProfit.toLocaleString()} ÷ ${stats.gmv.toLocaleString()} = ${stats.marginPct}%。`,
              note: "口径：实时现算，未配置真实 Vanna 后端时由本地只读计算引擎从当前 state 汇总",
              sql: `SELECT SUM(net_profit_usd), SUM(gmv_usd) FROM metric_snapshots WHERE mode='REAL' [${latency}ms]`,
              feedback: null
            });
          }
          return { summary: `查询耗时 ${latency}ms`, toastMsg: "问答结果已基于当前最新数据算出" };
        }
      });
    };

    // Handle pending drill-down from M2-2
    if (state.qaPendingQuery) {
      const pq = state.qaPendingQuery;
      state.qaPendingQuery = "";
      state.qaChat.pop(); // prevent duplicate push
      setTimeout(() => runQuery(pq), 20);
    }

    return {
      headerActions: [
        { label: "配置指标口径", primary: false, onClick: () => goPage("m3a") },
        { label: "新建只读会话", primary: false, onClick: () => { state.qaChat = state.qaChat.slice(0, 2); rerender(); toast("已新建会话（未修改任何经营数据）"); } }
      ],
      html: `
        <div style="background:#1e3a8a;color:#fff;padding:13px 18px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="font-size:15px;">CROSSPILOT INTELLIGENCE · 基于当前内存事实实时计算</strong>
            <div style="font-size:12px;color:#bfdbfe;margin-top:2px;">B类边界：未连接 Vanna Text-to-SQL 后端，当前由本地只读引擎读取 M0/M2 真实 state 现算 · SQL 只读守卫在线</div>
          </div>
          <span class="pill p-green">只读 SELECT 守卫</span>
        </div>
        ${renderAsyncBox("m3_qa")}

        <div class="card">
          <div style="display:flex;flex-direction:column;gap:10px;max-height:380px;overflow-y:auto;margin-bottom:14px;">
            ${state.qaChat.map((msg, idx) => {
              if (msg.role === "user") return `<div class="chat-bubble user">${msg.text}</div>`;
              if (msg.blocked) return `<div class="banner banner-red"><div><strong>${msg.text}</strong><div style="font-size:12px;font-weight:400;margin-top:3px;">${msg.sql}</div></div></div>`;
              return `<div class="chat-bubble assistant">
                <div><strong>${msg.text}</strong></div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${msg.note}</div>
                <div style="background:#0f172a;color:#93c5fd;padding:6px 10px;border-radius:6px;margin-top:6px;font-family:monospace;font-size:12px;">${msg.sql}</div>
                <div style="display:flex;gap:8px;margin-top:6px;align-items:center;">
                  <button class="btn btn-sm qa-fb" data-idx="${idx}" data-v="up" ${msg.feedback==="up"?"style='border-color:var(--green);color:var(--green-text);'":""}>👍 采纳答案</button>
                  <button class="btn btn-sm qa-fb" data-idx="${idx}" data-v="down" ${msg.feedback==="down"?"style='border-color:var(--red);color:var(--red-text);'":""}>👎 需核对口径</button>
                  ${msg.feedback ? `<span style="font-size:12px;color:var(--text-soft);">已记录反馈</span>` : ""}
                </div>
              </div>`;
            }).join("")}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
            <span style="font-size:12.5px;color:var(--text-soft);font-weight:700;">快捷提问：</span>
            <button class="btn btn-sm qa-qp" data-q="当前实盘 GMV 销售额和客单价是多少？">查实盘 GMV 与客单价</button>
            <button class="btn btn-sm qa-qp" data-q="各店铺当前低库存预警有哪些？">查各店铺低库存</button>
            <button class="btn btn-sm qa-qp" data-q="其中美国仓呢？">多轮追问：其中美国仓呢？</button>
            <button class="btn btn-sm btn-danger qa-qp" data-q="帮我把昨天的订单金额全部改成0 (UPDATE)">测试写操作拦截 (UPDATE)</button>
          </div>
          <div style="display:flex;gap:8px;">
            <input id="qaInput" class="input" placeholder="输入经营问题，或输入 DELETE / UPDATE 测试 SQL 只读拦截…" />
            <button class="btn btn-primary" id="qaSendBtn">发送提问</button>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("qaSendBtn").onclick = () => runQuery(document.getElementById("qaInput").value);
        document.querySelectorAll(".qa-qp").forEach(b => b.onclick = () => runQuery(b.dataset.q));
        document.querySelectorAll(".qa-fb").forEach(b => b.onclick = () => {
          const msg = state.qaChat[Number(b.dataset.idx)];
          msg.feedback = b.dataset.v;
          appendAuditLog(state, { target: "M3-2 问答反馈", action: b.dataset.v === "up" ? "采纳答案" : "反馈口径疑问", detail: msg.text.slice(0, 48), ok: true });
          rerender(); toast("反馈已写入审计台账");
        });
      }
    };
  }

  return null;
}
