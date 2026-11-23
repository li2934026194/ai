export function renderM0_M3(pageId, state, helpers) {
  const { toast, goPage, openModal, closeModal, openDrawer, rerender } = helpers;

  // ==================== M0a: Shop OAuth Connections ====================
  if (pageId === "m0a") {
    const canManageShop = state.role === "manager" || state.role === "approver";
    return {
      headerActions: [
        { label: "去商品与订单主数据 →", primary: false, onClick: () => goPage("m0b") },
        {
          label: "+ 接入新店铺 (OAuth2)", primary: true, onClick: () => {
            if (!canManageShop) { toast("仅「大屏浏览者/管理者」或「主管/审批人」可接入店铺授权"); return; }
            openModal("接入新跨境店铺 (OAuth2)", `
              <div class="field"><label>目标平台</label><select id="newShopPlat" class="select"><option>SHOPEE</option><option>TIKTOK</option><option>AMAZON</option></select></div>
              <div class="field"><label>站点</label><select id="newShopReg" class="select"><option>MY</option><option>TH</option><option>US</option><option>SG</option></select></div>
              <div class="field"><label>店铺名称</label><input id="newShopName" class="input" value="Shopee 马来西亚分店"/></div>
              <div class="field"><label>接入模式</label><select id="newShopMode" class="select"><option value="REAL">REAL（实盘授权）</option><option value="MOCK">MOCK（仅限演示沙盒）</option></select></div>
              <button class="btn btn-primary" id="saveShopBtn" style="width:100%;justify-content:center;">保存并测试 OAuth</button>
            `, () => {
              document.getElementById("saveShopBtn").onclick = () => {
                const mode = document.getElementById("newShopMode").value;
                state.shops.push({
                  id: "shop_" + Date.now(),
                  name: document.getElementById("newShopName").value.trim() || "新店铺",
                  platform: document.getElementById("newShopPlat").value,
                  region: document.getElementById("newShopReg").value,
                  mode,
                  status: mode === "REAL" ? "Token有效" : "仅限演示",
                  lastSync: "刚刚接入",
                });
                closeModal(); rerender(); toast("新店铺 OAuth2 接入成功并写入授权列表");
              };
            });
          }
        }
      ],
      html: `
        <div class="grid-3">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">已接入店铺 <span class="anno-tag t-blue">1</span></div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.shops.length} 家</div>
            <div class="kpi-sub">实盘 ${state.shops.filter(s=>s.mode==="REAL").length} 家 · 演示沙盒 ${state.shops.filter(s=>s.mode==="MOCK").length} 家</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">OAuth2 凭证健康度</div>
            <div class="kpi-val" style="color:var(--green-text)">100%</div>
            <div class="kpi-sub">自动巡检刷新，密钥不进普通日志</div>
          </div>
          <div class="kpi-card highlight-amber">
            <div class="kpi-label">Mock 环境隔离状态</div>
            <div class="kpi-val" style="color:var(--amber-text)">严格隔离</div>
            <div class="kpi-sub">沙盒店铺仅用于教学/客服演示</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 店铺连接与 OAuth 凭证状态</div>
            <span class="pill p-amber">Mock 与 Real 严格隔离</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>店铺名称</th><th>平台 / 站点</th><th>数据模式</th><th>授权状态</th><th>最近同步</th><th>操作</th></tr></thead>
              <tbody>
                ${state.shops.map((s, idx) => `
                  <tr>
                    <td><strong>${s.name}</strong></td>
                    <td class="nowrap">${s.platform} · ${s.region}</td>
                    <td class="nowrap"><span class="pill ${s.mode==="REAL"?"p-green":"p-amber"}">${s.mode}</span></td>
                    <td class="nowrap"><span class="pill ${s.mode==="REAL"?"p-green":"p-amber"}">${s.status}</span></td>
                    <td class="nowrap">${s.lastSync}</td>
                    <td class="nowrap"><button class="btn btn-sm m0-sync" data-i="${idx}">立即同步订单</button></td>
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
          s.lastSync = "2026-11-19 " + new Date().toTimeString().slice(0, 8);
          rerender(); toast(`已触发 ${s.name} 增量同步，sha256 幂等校验 0 重复`);
        });
      }
    };
  }

  // ==================== M0b: Product Master & Orders ====================
  if (pageId === "m0b") {
    const q = state.m0bSearch.toLowerCase();
    const filtered = state.masterProducts.filter(p =>
      (state.m0bTypeFilter === "ALL" || p.mode === state.m0bTypeFilter) &&
      (!q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );
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
            <div class="card-title"><span class="anno-tag t-blue">1</span> 内部主商品档案（Product · 各店共用主SKU但按店独立上货/定价）</div>
            <span class="pill p-blue">共 ${filtered.length} 个主 SKU（点击行看成本卡详情）</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>内部主 SKU</th><th>商品名称 / 类目</th><th>在售店铺映射 (platform_sku)</th><th>采购+头程成本</th><th>参考售价</th><th>覆盖模式</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(p => `
                  <tr class="m0b-row" data-sku="${p.sku}" style="cursor:pointer;">
                    <td class="nowrap"><strong>${p.sku}</strong></td>
                    <td><strong>${p.name}</strong><div style="font-size:11px;color:var(--text-soft)">${p.cat}</div></td>
                    <td>${p.shops.map(sh => `<span class="pill p-gray" style="margin:2px 3px 2px 0;">${sh}</span>`).join("")}</td>
                    <td class="nowrap">$${p.cost.toFixed(2)} + $${p.ship.toFixed(2)} <span class="pill p-green">${p.costVer}</span></td>
                    <td class="nowrap"><strong>${p.price}</strong></td>
                    <td class="nowrap"><span class="pill p-blue">${p.mode}</span></td>
                    <td class="nowrap"><button class="btn btn-sm m0b-detail" data-sku="${p.sku}">查看明细</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-purple">2</span> 标准化订单主表最近同步样本（orders + order_items）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>订单编号</th><th>归属店铺</th><th>模式</th><th>订单状态</th><th>实付金额</th><th>幂等哈希校验</th><th>下游可用模块</th></tr></thead>
              <tbody>
                <tr><td class="nowrap"><strong>ORD-20261119-8821</strong></td><td>Shopee 泰国主店</td><td class="nowrap"><span class="pill p-green">REAL</span></td><td class="nowrap"><span class="pill p-green">PAID</span></td><td class="nowrap">THB 1,490 / 2件</td><td class="nowrap">sha256:9f2a..OK</td><td>M1 / M2 / M3 / M5</td></tr>
                <tr><td class="nowrap"><strong>ORD-20261119-9044</strong></td><td>TikTok Shop 美区</td><td class="nowrap"><span class="pill p-green">REAL</span></td><td class="nowrap"><span class="pill p-green">DELIVERED</span></td><td class="nowrap">USD 56.70 / 3件</td><td class="nowrap">sha256:7d8c..OK</td><td>M2 / M3 / M5 / M6</td></tr>
                <tr><td class="nowrap"><strong>SYN9D-005671</strong></td><td>Amazon 演示沙盒店</td><td class="nowrap"><span class="pill p-amber">MOCK</span></td><td class="nowrap"><span class="pill p-blue">SHIPPED</span></td><td class="nowrap">USD 34.50 / 1件</td><td class="nowrap">sha256:3c1d..OK</td><td>仅 M1 客服演示(不计实利)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0bSearchInp").oninput = (e) => { state.m0bSearch = e.target.value; rerender(); };
        document.getElementById("m0bTypeSel").onchange = (e) => { state.m0bTypeFilter = e.target.value; rerender(); };
        document.querySelectorAll(".m0b-detail").forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          const p = state.masterProducts.find(x => x.sku === b.dataset.sku);
          const stockRows = state.inventoryItems.filter(i => i.sku === p.sku);
          openDrawer(`${p.sku} · ${p.name}`, `成本卡 ${p.costVer} · 跨店分布明细`, `
            <div class="formula-box" style="margin-bottom:12px;">
              <strong>📐 单件落地成本公式：</strong><br/>
              落地成本 = 采购单价 ($${p.cost.toFixed(2)}) + 头程运费 ($${p.ship.toFixed(2)}) = <strong>$${(p.cost + p.ship).toFixed(2)}</strong>
            </div>
            <div class="drawer-sec-label">各店铺在售与独立库存现状：</div>
            ${stockRows.map(s => `
              <div class="anno-card" style="border-left-color:${s.shopMode==="REAL"?"#10b981":"#f59e0b"};margin-bottom:8px;">
                <div><strong>${s.shopName}</strong> <span class="pill ${s.shopMode==="REAL"?"p-green":"p-amber"}">${s.shopMode}</span></div>
                <div style="font-size:12px;margin-top:4px;">店铺映射SKU：<code>${s.shopSku}</code> · 仓库：<strong>${s.wh}</strong></div>
                <div style="font-size:12px;margin-top:3px;">当前可售：<strong>${s.avail} 件</strong> · 锁定：${s.locked} 件 · 安全线：${s.safety} 件</div>
              </div>
            `).join("")}
            <button class="btn btn-primary btn-sm" id="drGotoInv" style="margin-top:8px;">去 M0-3 分店独立库存中心盘点 →</button>
          `, () => {
            document.getElementById("drGotoInv").onclick = () => { helpers.closeDetailDrawer(); goPage("m0c"); };
          });
        });
      }
    };
  }

  // ==================== M0c: Store×Warehouse Independent Stock Center ====================
  if (pageId === "m0c") {
    const canEditStock = state.role === "warehouse" || state.role === "manager";
    const q = state.m0cSearch.toLowerCase();
    const filtered = state.inventoryItems.filter(i =>
      (state.m0cShopFilter === "ALL" || i.shopId === state.m0cShopFilter) &&
      (!q || i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.wh.toLowerCase().includes(q))
    );
    const realLowCount = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety).length;

    return {
      headerActions: [
        { label: "去 M6 智能补货测算 →", primary: false, onClick: () => goPage("m6b") },
        {
          label: "同步全部实盘仓库存", primary: true, onClick: () => {
            if (!canEditStock) { toast("仅「采购 / 仓库 / 物流人员」或管理者可执行库存同步"); return; }
            state.stockSyncedAt = new Date().toTimeString().slice(0, 8);
            state.inventoryItems.forEach(i => { if (i.shopMode === "REAL") i.updated = state.stockSyncedAt; });
            rerender(); toast("已完成 Shopee TH + TikTok US 双仓独立库存快照同步：" + state.stockSyncedAt);
          }
        }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 独立库存口径：3 家店铺各卖各的品、各走各的仓（同一 SKU 在美国仓与泰国仓库存完全独立；MOCK 店绝不混入实盘）。M6 采购收货凭证绝不自动加减本表库存！</span>
          <span class="pill p-amber">最近同步：${state.stockSyncedAt}</span>
        </div>

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
            <div class="kpi-val" style="font-size:17px;">美仓 ${state.inventoryItems.find(x=>x.id==="inv1").avail} / 泰仓 ${state.inventoryItems.find(x=>x.id==="inv2").avail}</div>
            <div class="kpi-sub">同款商品在不同店铺仓独立计数</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">当前角色库存权限</div>
            <div class="kpi-val" style="font-size:16px;color:${canEditStock?"var(--green-text)":"var(--text-soft)"}">${canEditStock?"可同步/盘点 ✓":"仅只读查看"}</div>
            <div class="kpi-sub">${canEditStock?"可点右侧「盘点改数」实时联动 M5/M6":"切为 warehouse 角色可盘点"}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span class="anno-tag t-green">2</span> 按「店铺 × 物理仓」筛选库存明细（点击盘点实时联动 M5/M6 缺口）</div>
          </div>

          <div class="utabs" style="margin-bottom:12px;">
            <div class="utab ${state.m0cShopFilter==="ALL"?"active":""} m0c-tab" data-sh="ALL">全部店铺 <span class="utab-cnt">${state.inventoryItems.length}</span></div>
            ${state.shops.map(s => {
              const cnt = state.inventoryItems.filter(i => i.shopId === s.id).length;
              return `<div class="utab ${state.m0cShopFilter===s.id?"active":""} m0c-tab" data-sh="${s.id}">${s.name} (${s.mode}) <span class="utab-cnt">${cnt}</span></div>`;
            }).join("")}
          </div>

          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item" style="max-width:340px;">
              <input id="m0cSearchInp" class="input" placeholder="搜索 SKU / 品名 / 仓库编号 (如 US-WH-2)…" value="${state.m0cSearch}"/>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>内部主 SKU & 品名</th><th>在售店铺 (模式)</th><th>店铺映射SKU</th><th>物理仓库</th><th>当前可售</th><th>已锁定</th><th>安全库存</th><th>水位状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.map(item => {
                  const isLow = item.avail < item.safety;
                  return `
                    <tr>
                      <td><strong>${item.sku}</strong><div style="font-size:11px;color:var(--text-soft)">${item.name} · ${item.note}</div></td>
                      <td class="nowrap">${item.shopName} <span class="pill ${item.shopMode==="REAL"?"p-green":"p-amber"}">${item.shopMode}</span></td>
                      <td class="nowrap"><code>${item.shopSku}</code></td>
                      <td class="nowrap"><strong>${item.wh}</strong></td>
                      <td class="nowrap"><strong style="font-size:14px;color:${isLow?"var(--red-text)":"var(--text-dark)"}">${item.avail} 件</strong></td>
                      <td class="nowrap">${item.locked} 件</td>
                      <td class="nowrap">${item.safety} 件</td>
                      <td class="nowrap">
                        ${item.shopMode === "MOCK"
                          ? '<span class="pill p-gray">仅演示·不计实仓</span>'
                          : isLow
                            ? '<span class="pill p-red">低库存预警</span>'
                            : '<span class="pill p-green">库存充足</span>'}
                      </td>
                      <td class="nowrap">
                        <button class="btn btn-sm m0c-edit" data-id="${item.id}" ${!canEditStock?"disabled":""}>盘点改数</button>
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
        document.querySelectorAll(".m0c-tab").forEach(t => t.onclick = () => { state.m0cShopFilter = t.dataset.sh; rerender(); });
        document.getElementById("m0cSearchInp").oninput = (e) => { state.m0cSearch = e.target.value; rerender(); };
        document.querySelectorAll(".m0c-edit").forEach(b => b.onclick = () => {
          const item = state.inventoryItems.find(x => x.id === b.dataset.id);
          openModal(`人工盘点校准 · ${item.sku} (${item.wh})`, `
            <div class="banner banner-blue" style="margin-bottom:10px;">店铺：${item.shopName} · 店铺SKU：${item.shopSku}</div>
            <div class="field"><label>最新实盘可售库存 (件)</label><input id="invNewQty" type="number" class="input" value="${item.avail}"/></div>
            <div class="field"><label>安全库存预警线 (件)</label><input id="invNewSafe" type="number" class="input" value="${item.safety}"/></div>
            <div class="field"><label>盘点差异说明</label><input class="input" value="日常循环盘点校准同步"/></div>
            <button class="btn btn-primary" id="saveInvBtn" style="width:100%;justify-content:center;">确认保存并同步 M5/M6 缺口</button>
          `, () => {
            document.getElementById("saveInvBtn").onclick = () => {
              item.avail = Math.max(0, Number(document.getElementById("invNewQty").value) || 0);
              item.safety = Math.max(0, Number(document.getElementById("invNewSafe").value) || 0);
              item.updated = new Date().toTimeString().slice(0, 8);
              closeModal(); rerender();
              toast(`已校准 ${item.shopName} ${item.sku} 库存为 ${item.avail} 件（M5/M6 补货缺口已联动更新）`);
            };
          });
        });
      }
    };
  }

  // ==================== M1a: CS 3-Column Workbench ====================
  if (pageId === "m1a") {
    const activeSess = state.csSessions.find(s => s.id === state.csActiveId) || state.csSessions[0];
    const canCs = state.role === "cs" || state.role === "approver";
    return {
      headerActions: [
        { label: "去客服导购商品库", primary: false, onClick: () => goPage("m1b") },
        { label: "人工接管当前会话", primary: true, onClick: () => {
          if (!canCs) { toast("仅「客服」或主管可接管会话"); return; }
          activeSess.mode = "HUMAN"; rerender(); toast(`会话 ${activeSess.id} 已由人工接管 (HUMAN)`);
        } }
      ],
      html: `
        <div class="split-3col-cs">
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
                <div style="font-size:11.5px;color:var(--text-muted);margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.preview}</div>
                <span class="pill ${s.mode === "PENDING_HUMAN" ? "p-purple" : s.mode === "HUMAN" ? "p-blue" : "p-green"}">${s.mode}</span>
              </div>
            `).join("")}
            <button class="btn btn-sm" id="gotoSimBuyerBtn" style="width:100%;justify-content:center;margin-top:6px;">+ 从模拟买家入口发消息</button>
          </div>

          <div class="card" style="padding:14px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div>
                <strong>${activeSess.buyer}</strong>
                <span style="color:var(--text-soft);font-size:12px;margin-left:6px;">${activeSess.platform} · ${activeSess.lang} · ${activeSess.intent}</span>
              </div>
              <span class="pill ${activeSess.mode === "PENDING_HUMAN" ? "p-purple" : activeSess.mode === "HUMAN" ? "p-blue" : "p-green"}">${activeSess.mode}</span>
            </div>

            <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
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
                  <div style="font-size:11.3px;font-weight:400;margin-top:2px;">规则：MONEY_REQUEST / AFTER_SALES_COMPLAINT 禁止 AI 自动承诺赔付</div>
                </div>
                <button class="btn btn-primary btn-sm" id="takeoverInlineBtn">${activeSess.mode === "HUMAN" ? "已人工接管 ✓" : "人工接管"}</button>
              </div>
            ` : `
              <div class="banner banner-blue" style="margin-bottom:10px;">
                <span><span class="anno-tag t-green">2</span> 本店推荐 Top-3：${activeSess.recs}</span>
              </div>
            `}

            <div class="field">
              <label>中文拟定回复（自动生成外语预览）</label>
              <textarea id="csZhInput" class="textarea" style="min-height:48px;">您好，已为您核实订单损坏情况，现为您提交退款工单审核。</textarea>
            </div>
            <div class="field">
              <label>外语买家回复（可人工微调后再发送）</label>
              <textarea id="csEnInput" class="textarea" style="min-height:48px;">Hello, we have verified your damaged item and submitted a refund review.</textarea>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11.3px;color:var(--text-soft)">发送前校验：本店链接 & 双语数字一致性</span>
              <button class="btn btn-primary" id="csSendBtn" ${!canCs?"disabled":""}>发送外语回复</button>
            </div>
          </div>

          <div class="card" style="padding:14px;">
            <div class="card-header" style="margin-bottom:10px;">
              <div class="card-title" style="font-size:13.5px;"><span class="anno-tag t-purple">3</span> 客户与关联订单</div>
            </div>
            <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">客户名称</span><strong>${activeSess.buyer}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">来源平台</span><strong>${activeSess.platform}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-soft)">当前意图</span><strong>${activeSess.intent} (${activeSess.conf})</strong></div>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">
              <div style="font-size:12px;font-weight:700;color:var(--blue-hover);margin-bottom:4px;">匹配本店候选订单</div>
              <div style="font-weight:700;">${activeSess.orderId}</div>
              <div style="font-size:11.5px;color:var(--text-muted);margin:3px 0;">SHIPPED · USD 34.50</div>
              <button class="btn btn-primary btn-sm" id="bindOrderBtn" style="width:100%;justify-content:center;margin-top:6px;">${activeSess.bound ? "已核验并绑定 ✓" : "人工核验并绑定订单"}</button>
            </div>
            <button class="btn btn-sm" id="gotoTicketsBtn" style="width:100%;justify-content:center;border-color:var(--blue);color:var(--blue);">前往售后工单审批页 →</button>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".session-item").forEach(el => el.onclick = () => { state.csActiveId = el.dataset.sid; rerender(); });
        const tkBtn = document.getElementById("takeoverInlineBtn");
        if (tkBtn) tkBtn.onclick = () => { activeSess.mode = "HUMAN"; rerender(); toast("已人工接管该售后会话"); };
        document.getElementById("bindOrderBtn").onclick = () => { activeSess.bound = true; rerender(); toast(`已核验并绑定订单 ${activeSess.orderId}`); };
        document.getElementById("gotoTicketsBtn").onclick = () => goPage("m1c");
        document.getElementById("gotoSimBuyerBtn").onclick = () => goPage("m1d");
        const zh = document.getElementById("csZhInput");
        const en = document.getElementById("csEnInput");
        zh.oninput = () => { en.value = `[EN Preview] Thank you for contacting CrossPilot. Handling: ${zh.value.slice(0, 48)}`; };
        document.getElementById("csSendBtn").onclick = () => {
          const text = en.value.trim();
          if (!text) return;
          activeSess.messages.push({ role: "agent", text, zh: zh.value.trim() });
          rerender(); toast("已通过双语数字一致性校验并发送回复");
        };
      }
    };
  }

  // ==================== M1b: Recommended Products KB ====================
  if (pageId === "m1b") {
    const q = state.csSearch.toLowerCase();
    const filtered = state.csProducts.filter(p =>
      (state.csShopFilter === "ALL" || p.shop === state.csShopFilter) &&
      (!q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );
    return {
      headerActions: [
        { label: "重建向量索引", primary: false, onClick: () => { state.csProducts.forEach(p => p.vec = "READY"); rerender(); toast("已每20件批重建 Milvus/pgvector 索引，全部 READY"); } },
        { label: "+ 批量导入 XLSX", primary: true, onClick: () => openModal("批量导入推荐商品 (XLSX)", `
          <div class="field"><label>目标店铺（按组织/店铺隔离）</label><select class="select"><option>Shopee TH</option><option>TikTok US</option></select></div>
          <div class="field"><label>选择 .xlsx 模板文件</label><div style="border:2px dashed var(--blue-border);border-radius:8px;padding:16px;text-align:center;background:#f8fafc;"><strong>recommendation_items.xlsx</strong><div style="font-size:11.5px;color:var(--text-soft);margin-top:4px;">必填列：SKU / 标题 / 卖点 / 价格 / 平台域名</div></div></div>
          <button class="btn btn-primary" id="confirmImportKb" style="width:100%;justify-content:center;">确认导入并异步向量化</button>
        `, () => {
          document.getElementById("confirmImportKb").onclick = () => {
            state.csProducts.unshift({ sku: "DESK-901", name: "铝合金折叠笔记本支架", shop: "Shopee TH", price: "$26.00", vec: "READY", on: true });
            closeModal(); rerender(); toast("XLSX 整表校验通过，已新增 DESK-901 并标记 READY");
          };
        }) }
      ],
      html: `
        <div class="banner banner-blue">
          <span>💡 <strong>模块边界说明（SRS §3.1）：</strong>本页是供<strong>客服人员回答买家咨询</strong>时使用的「本店在售导购词典」（防编造报价、防串店发错链接）；寻找尚未上架的新品请前往 <strong>M4 选品分析</strong>。</span>
        </div>
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
            <span class="pill p-green"><span class="anno-tag t-green">2</span> 仅召回本店 ACTIVE / READY 商品</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>商品名称</th><th>归属店铺</th><th>参考售价</th><th>向量状态</th><th>导购开关</th></tr></thead>
              <tbody>
                ${filtered.map((p, idx) => `
                  <tr>
                    <td class="nowrap"><strong>${p.sku}</strong></td>
                    <td>${p.name}</td>
                    <td class="nowrap">${p.shop}</td>
                    <td class="nowrap">${p.price}</td>
                    <td class="nowrap"><span class="pill ${p.vec === "READY" ? "p-green" : "p-amber"}">${p.vec}</span></td>
                    <td class="nowrap"><button class="btn btn-sm toggle-kb" data-sku="${p.sku}">${p.on ? "已启用 ✓" : "已停用"}</button></td>
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
          item.on = !item.on; rerender(); toast(`${item.sku} 推荐开关已${item.on ? "开启" : "停用"}`);
        });
      }
    };
  }

  // ==================== M1d: Mock Buyer Simulator ====================
  if (pageId === "m1d") {
    return {
      headerActions: [{ label: "前往客服三栏工作台 →", primary: true, onClick: () => goPage("m1a") }],
      html: `
        <div class="card" style="max-width:740px;">
          <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">1</span> 模拟买家入站消息发送器（教学 / 演示专用入口）</div></div>
          <div class="field"><label>买家昵称与平台（从 Amazon 模拟店铺提取）</label><input id="simBuyerName" class="input" value="Demo Buyer · AMAZON US" /></div>
          <div class="field">
            <label>快捷测试场景</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm sim-preset" data-msg="Do you have a waterproof desk mat for home office?">场景A：商品咨询 (触发Top-3推荐)</button>
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
            id, buyer: document.getElementById("simBuyerName").value.split("·")[0].trim(),
            platform: "AMAZON US", lang: "EN", time: "刚刚", preview: msg,
            mode: isRefund ? "PENDING_HUMAN" : "AI_AUTO",
            intent: isRefund ? "REFUND" : "PRODUCT_INQUIRY", conf: isRefund ? "91%" : "94%", risk: isRefund,
            recs: "① MAT-014 桌面收纳垫 (95%) ② BAG-108 (72%)", orderId: "SYN9D-005671", bound: false,
            messages: [{ role: "buyer", text: msg, zh: isRefund ? "我的包裹破损了，要求全额退款！" : "请问你们有适合居家办公的防水桌面垫吗？" }]
          });
          state.csActiveId = id;
          goPage("m1a"); toast(isRefund ? "命中退款风险词，已置为 PENDING_HUMAN" : "已触发咨询推荐 Top-3 检索");
        };
      }
    };
  }

  // ==================== M1c: After-sales Tickets & SoD Approval ====================
  if (pageId === "m1c") {
    const canApprove = state.role === "approver";
    const canCreate = state.role === "cs" || state.role === "approver";
    const t = state.tickets[state.ticketIdx] || state.tickets[0];
    const sodSame = t.submitter === state.role;
    return {
      headerActions: [
        { label: "返回客服工作台", primary: false, onClick: () => goPage("m1a") },
        { label: "+ 新建售后工单", primary: true, onClick: () => {
          if (!canCreate) { toast("仅「客服」或主管可创建售后工单"); return; }
          state.tickets.unshift({ id: "TK-20261119-02", order: "SYN9D-005671", type: "破损补发 $15.00", submitter: state.role, status: "待主管审批", ext: "—" });
          state.ticketIdx = 0; rerender(); toast("已新建售后工单 TK-20261119-02");
        } }
      ],
      html: `
        <div class="banner banner-amber">
          <span><span class="anno-tag t-amber">1</span> 外部退款同步边界：审批通过后写入审计台账，平台侧退款结果标记 <code>external_status = UNKNOWN</code>（不伪造平台已打款）。</span>
        </div>
        <div class="split-right-panel">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-blue">2</span> 售后审批队列（客服建单 → 主管/审批人拍板）</div></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>工单编号</th><th>关联订单</th><th>类型 / 金额</th><th>提交人</th><th>审批状态</th><th>平台回执</th></tr></thead>
                <tbody>
                  ${state.tickets.map((row, i) => `
                    <tr class="tk-row ${i===state.ticketIdx?"row-selected":""}" data-idx="${i}" style="cursor:pointer;">
                      <td class="nowrap"><strong>${row.id}</strong></td>
                      <td class="nowrap">${row.order}</td>
                      <td class="nowrap">${row.type}</td>
                      <td class="nowrap">${row.submitter}</td>
                      <td class="nowrap"><span class="pill ${row.status==="已批准"?"p-green":row.status==="已驳回"?"p-red":"p-amber"}">${row.status}</span></td>
                      <td class="nowrap"><span class="pill p-gray">${row.ext}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card card-blue">
            <div class="card-header"><div class="card-title">工单详情 · ${t.id}</div></div>
            <div style="font-size:12.5px;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
              <div>关联订单：<strong>${t.order}</strong></div>
              <div>提交客服：<strong>${t.submitter}</strong></div>
              <div>当前登录角色：<strong>${state.role}</strong> ${!canApprove ? '<span class="pill p-red">无审批权限</span>' : sodSame ? '<span class="pill p-red">触发SoD：不可自审</span>' : '<span class="pill p-green">SoD 校验通过 ✓</span>'}</div>
              <div>申请类型：<strong>${t.type}</strong></div>
            </div>
            <div class="banner banner-blue" style="margin-bottom:12px;">并发防重锁：SELECT ... FOR UPDATE 已就绪</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-success" id="approveTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""}>批准退款</button>
              <button class="btn btn-danger" id="rejectTkBtn" ${(!canApprove || sodSame || t.status !== "待主管审批") ? "disabled" : ""}>驳回工单</button>
              ${!canApprove ? '<button class="btn btn-sm" id="swApprM1">切为「主管/审批人」体验</button>' : ""}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".tk-row").forEach(r => r.onclick = () => { state.ticketIdx = Number(r.dataset.idx); rerender(); });
        const sw = document.getElementById("swApprM1");
        if (sw) sw.onclick = () => { state.role = "approver"; document.getElementById("roleSelect").value = "approver"; rerender(); };
        const ab = document.getElementById("approveTkBtn");
        if (ab) ab.onclick = () => { t.status = "已批准"; t.ext = "UNKNOWN"; rerender(); toast("工单已加行锁批准，external_status = UNKNOWN"); };
        const rb = document.getElementById("rejectTkBtn");
        if (rb) rb.onclick = () => { t.status = "已驳回"; rerender(); toast("工单已驳回并记录原因"); };
      }
    };
  }

  // ==================== M2a: BI Designer ====================
  if (pageId === "m2a") {
    const w = state.biWidgets[state.biSelectedIdx] || state.biWidgets[0];
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
              <button class="btn btn-sm bi-add-comp" data-comp="${c}" style="width:100%;justify-content:flex-start;margin-bottom:7px;">+ ${c}</button>
            `).join("")}
          </div>

          <div class="card" style="background:#f8fafc;border:1.5px dashed var(--blue-border);">
            <div class="card-header">
              <div class="card-title" style="color:var(--blue-hover);"><span class="anno-tag t-green">2</span> 驾驶舱画布预览（支持排序与删除）</div>
              <span class="pill p-blue">当前 ${state.biWidgets.length} 个组件</span>
            </div>
            <div class="grid-2" style="margin-bottom:12px;">
              ${state.biWidgets.map((item, i) => `
                <div class="kpi-card" style="cursor:pointer;${i===state.biSelectedIdx?"border:1.5px solid var(--blue)":""}" data-wi="${i}">
                  <div class="kpi-label">
                    <span>${item.title}</span>
                    <span style="display:flex;gap:4px;">
                      <button class="btn btn-sm bi-mv" data-i="${i}" data-d="-1" title="前移">↑</button>
                      <button class="btn btn-sm bi-del" data-i="${i}" title="删除">✕</button>
                    </span>
                  </div>
                  <div class="kpi-val" style="color:${item.color}">${item.val}</div>
                  <div class="kpi-sub">绑定口径：${item.metric} · ${item.scope}</div>
                </div>
              `).join("")}
            </div>
            <div class="formula-box" style="margin-bottom:10px;">
              <strong>📐 跨组件同源公式：</strong>净利率 = 净利润 ($65,529.67) ÷ GMV ($125,429.99) = <strong>52.2%</strong> · ACOS = 广告花费 ($18,650.16) ÷ GMV = <strong>14.9%</strong>
            </div>
            <div class="banner banner-blue" style="flex-direction:column;align-items:flex-start;">
              <strong>AI 经营解读卡</strong>
              <span style="font-weight:400;">${state.biInsight}</span>
            </div>
          </div>

          <div class="card" style="padding:14px;">
            <div class="card-header"><div class="card-title" style="font-size:13px;"><span class="anno-tag t-purple">3</span> 选中组件属性</div></div>
            <div class="field"><label>组件标题</label><input id="biPropTitle" class="input" value="${w.title}"/></div>
            <div class="field"><label>绑定统一指标</label><select id="biPropMetric" class="select"><option ${w.metric==="gmv"?"selected":""}>gmv</option><option ${w.metric==="net_profit"?"selected":""}>net_profit</option><option ${w.metric==="ad_spend"?"selected":""}>ad_spend</option></select></div>
            <div class="field"><label>时间范围</label><select id="biPropScope" class="select"><option>全部平台 · 近30天</option><option>Amazon · 近7天</option></select></div>
            <button class="btn btn-primary btn-sm" id="biApplyProp" style="width:100%;justify-content:center;margin-bottom:8px;">应用并刷新数值</button>
            <button class="btn btn-sm" id="biGenAiBtn" style="width:100%;justify-content:center;">重新生成 AI 解读</button>
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
          if (state.biWidgets.length <= 1) return;
          state.biWidgets.splice(Number(b.dataset.i), 1); state.biSelectedIdx = 0; rerender();
        });
        document.querySelectorAll(".bi-add-comp").forEach(b => b.onclick = () => {
          state.biWidgets.push({ title: b.dataset.comp + " (新增)", val: "1,536 单", metric: "orders_count", scope: "全部平台 · 近30天", color: "var(--purple-text)" });
          state.biSelectedIdx = state.biWidgets.length - 1; rerender(); toast("已添加到画布");
        });
        document.getElementById("biApplyProp").onclick = () => {
          w.title = document.getElementById("biPropTitle").value;
          w.metric = document.getElementById("biPropMetric").value;
          w.scope = document.getElementById("biPropScope").value;
          w.val = w.metric === "gmv" ? "$125,429.99" : w.metric === "net_profit" ? "$65,529.67" : w.scope.includes("7天") ? "$2,933.63" : "$18,650.16";
          rerender(); toast("已从 metric_snapshots 拉取新口径数值");
        };
        document.getElementById("biGenAiBtn").onclick = () => {
          state.biInsight = "AI 解读更新：近30天净利润 $65,529.67（净利率 52.2%），Amazon 近7天广告花费 $2,933.63，投产健康。";
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
          <div class="kpi-card">
            <div class="kpi-label">GMV 销售额</div>
            <div class="kpi-val" style="color:var(--blue-hover)">$125,429.99</div>
            <div class="kpi-sub">+14.2% 环比</div>
            <div class="formula-inline"><code>Σ(实盘订单实付USD)</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">订单总数</div>
            <div class="kpi-val" style="color:var(--green-text)">1,536 单</div>
            <div class="kpi-sub">+9.8% 环比</div>
            <div class="formula-inline">客单价 = <code>125,429.99 ÷ 1,536 = $81.66</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">广告花费 (ACOS 14.9%)</div>
            <div class="kpi-val" style="color:var(--amber-text)">$18,650.16</div>
            <div class="kpi-sub">Amazon近7天 $2,933.63</div>
            <div class="formula-inline">ACOS = <code>18,650.16 ÷ 125,429.99 = 14.9%</code></div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">净利润 (净利率 52.2%)</div>
            <div class="kpi-val" style="color:var(--purple-text)">$65,529.67</div>
            <div class="kpi-sub">仅统计纯实盘订单</div>
            <div class="formula-inline">净利率 = <code>65,529.67 ÷ 125,429.99 = 52.2%</code></div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 多平台每日 GMV 与利润趋势</div></div>
            <svg viewBox="0 0 560 190" style="width:100%;height:auto;max-height:195px;display:block;background:#ffffff;border-radius:6px;">
              <line x1="30" y1="45" x2="530" y2="45" stroke="#f1f5f9" stroke-width="1"/>
              <line x1="30" y1="100" x2="530" y2="100" stroke="#f1f5f9" stroke-width="1"/>
              <line x1="30" y1="155" x2="530" y2="155" stroke="#e2e8f0" stroke-width="1"/>
              <polyline fill="none" stroke="#2563eb" stroke-width="2.2" points="40,140 110,120 180,126 250,88 320,76 390,54 460,44 520,28" />
              <polyline fill="none" stroke="#10b981" stroke-width="2" points="40,152 110,142 180,145 250,125 320,118 390,104 460,94 520,82" />
              <text x="40" y="175" font-size="10" fill="#64748b">11-12</text>
              <text x="250" y="175" font-size="10" fill="#64748b" text-anchor="middle">11-15</text>
              <text x="520" y="175" font-size="10" fill="#64748b" text-anchor="end">11-19</text>
              <circle cx="400" cy="20" r="3" fill="#2563eb"/><text x="408" y="23" font-size="10" fill="#2563eb" font-weight="600">GMV</text>
              <circle cx="462" cy="20" r="3" fill="#10b981"/><text x="470" y="23" font-size="10" fill="#10b981" font-weight="600">净利润</text>
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
      headerActions: [{ label: "前往经营智能问答 →", primary: true, onClick: () => goPage("m3b") }],
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
          <div class="card-header"><div class="card-title"><span class="anno-tag t-green">2</span> 数据绑定与 Celery Beat 周期调度（每分钟巡检到期任务）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>绑定 / 指标</th><th>接口类型</th><th>平台</th><th>调度周期</th><th>最新指标数据</th><th>同步状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.qaBindings.map((b, i) => `
                  <tr>
                    <td><strong>${b.name}</strong></td>
                    <td class="nowrap"><span class="pill p-blue">${b.kind}</span></td>
                    <td class="nowrap">${b.platform}</td>
                    <td class="nowrap">${b.cron}</td>
                    <td class="nowrap"><strong>${b.val}</strong></td>
                    <td class="nowrap"><span class="pill p-green">${b.status}</span></td>
                    <td class="nowrap"><button class="btn btn-sm run-sync-btn" data-i="${i}">▶ 立即同步</button></td>
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
            <strong style="font-size:14.5px;"><span class="anno-tag t-amber">1</span> CROSSPILOT INTELLIGENCE · 用同一套事实回答经营问题</strong>
            <div style="font-size:11.5px;color:#bfdbfe;margin-top:2px;">口径：metric_snapshots + InventoryPosition | 多币种不强行合计 | ● SQL 只读守卫在线</div>
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
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">${msg.note}</div>
                <div style="font-size:11.3px;color:var(--blue-hover);margin-top:4px;">证据 SQL：<code>${msg.sql}</code></div>
              </div>`;
            }).join("")}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
            <span style="font-size:12px;color:var(--text-soft);font-weight:700;">快捷测试：</span>
            <button class="btn btn-sm qa-qp" data-q="各平台近30天净利润与净利率">净利润与净利率算式</button>
            <button class="btn btn-sm qa-qp" data-q="Amazon最近7天广告花费">Amazon最近7天广告花费</button>
            <button class="btn btn-sm qa-qp" data-q="各店铺当前低库存预警有哪些？">查各店铺低库存</button>
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
          } else if (/库存|缺货/.test(q)) {
            const lows = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety);
            state.qaChat.push({ role: "assistant", text: `实盘共有 ${lows.length} 项低库存预警：` + lows.map(l => `${l.shopName} ${l.sku}(${l.avail}/${l.safety})`).join("；"), note: "数据源：M0-3 实时分店独立库存（已自动排除 MOCK 店）", sql: "SELECT shop_name, sku, avail, safety FROM inventory_positions WHERE mode='REAL' AND avail < safety [18ms]" });
          } else if (/广告|ad_spend/i.test(q)) {
            state.qaChat.push({ role: "assistant", text: "AMAZON 近 7 天广告花费为 2,933.63 USD（30天累计 18,650.16 USD，ACOS = 18,650.16 ÷ 125,429.99 = 14.9%）。", note: "数据源：metric_snapshots · 实时汇总指标", sql: "SELECT SUM(ad_spend_usd) FROM metric_snapshots WHERE platform='AMAZON' AND days=7 [31ms]" });
          } else {
            state.qaChat.push({ role: "assistant", text: "全部实盘近 30 天净利润 65,529.67 USD，GMV 125,429.99 USD，净利率 = 65,529.67 ÷ 125,429.99 = 52.2%。", note: "口径：已折算统一币种 USD（未配汇率币种按原币分列，不强行相加）", sql: "SELECT SUM(net_profit_usd), SUM(gmv_usd) FROM metric_snapshots WHERE days=30 [38ms]" });
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
