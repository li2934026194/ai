import {
  BACKEND_SERVICE_URL, ROLE_PERSON_NAMES, getProductImg, genDocId, nowDateTimeStr, nowTimeStr, relTimeLabel, appendAuditLog
} from "./state.js";

export function renderM0_M3(pageId, state, helpers) {
  const { toast, goPage, openModal, openDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox, computeLiveBusinessStats, record403 } = helpers;

  // ==================== M0-1: 店铺授权连接 ====================
  if (pageId === "m0a") {
    const canManageShop = state.role === "manager" || state.role === "approver";
    const realCount = state.shops.filter(s => s.mode === "REAL").length;
    const healthyCount = state.shops.filter(s => s.health === "连接正常").length;
    const issueCount = state.shops.filter(s => s.mode === "REAL" && s.health !== "连接正常").length;

    return {
      headerActions: [
        { label: "去商品与订单台账 →", primary: false, onClick: () => goPage("m0b") },
        {
          label: "+ 连接新店铺", primary: true,
          disabled: !canManageShop,
          disabledTitle: "需要「大屏浏览者 / 管理者」或「主管 / 审批人」权限",
          onClick: () => {
            if (!canManageShop) { record403("M0-1 连接新店铺", "需要管理者或主管权限"); return; }
            commitAction({
              title: "连接新的跨境店铺",
              summary: `说明：当前为纯前端演示模式（外部后台服务未接入），此处将为您演示「正在连接 → 成功或失败原因」完整过程，并严格区分实盘店铺与演示测试店。`,
              confirmText: "发起店铺连接",
              fieldsHtml: `
                <div class="field"><label>店铺名称 *</label><input id="newShopName" class="input" placeholder="如：Lazada 马来主店"/></div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>所属电商平台 *</label><select id="newShopPlat" class="select"><option value="SHOPEE">Shopee</option><option value="TIKTOK">TikTok Shop</option><option value="AMAZON">Amazon</option></select></div>
                  <div class="field"><label>销售国家/站点 *</label><select id="newShopReg" class="select"><option value="TH">泰国站 (TH)</option><option value="US">美国站 (US)</option><option value="MY">马来站 (MY)</option></select></div>
                </div>
                <div class="field"><label>店铺经营性质 *</label>
                  <select id="newShopMode" class="select">
                    <option value="REAL">实盘经营店铺（订单计入真实营收）</option>
                    <option value="MOCK">仅限演示测试店（不计入真实营收）</option>
                  </select>
                </div>
                <div class="field"><label>模拟连接结果（便于测试异常处理）</label>
                  <select id="newShopSimResult" class="select">
                    <option value="OK">模拟连接成功</option>
                    <option value="FAIL">模拟连接失败（展示失败原因与排查建议）</option>
                  </select>
                </div>
              `,
              validate: (wrap) => {
                const nameEl = wrap.querySelector("#newShopName");
                return nameEl.value.trim() ? [] : [{ el: nameEl, msg: "请填写店铺名称" }];
              },
              onConfirm: (wrap) => {
                const name = wrap.querySelector("#newShopName").value.trim();
                const platform = wrap.querySelector("#newShopPlat").value;
                const region = wrap.querySelector("#newShopReg").value;
                const mode = wrap.querySelector("#newShopMode").value;
                const simFail = wrap.querySelector("#newShopSimResult").value === "FAIL";
                const maskCode = String(Math.floor(1000 + Math.random() * 8999));

                runAsyncTask("m0_shop_conn", {
                  label: `正在连接店铺 · ${name}`,
                  steps: ["前往平台授权确认页面", "核验店铺授权凭证与权限范围", "完成数据隔离策略设置"],
                  durationMs: 1100,
                  shouldFail: simFail,
                  failReason: "授权连接未通过：店铺管理员取消授权或凭证已过期，请点击「重试」或重新发起连接。",
                  onSuccess: () => {
                    state.shops.push({
                      id: `shop_${Date.now().toString().slice(-4)}`,
                      name, platform, region, mode,
                      health: mode === "REAL" ? "连接正常" : "仅演示环境",
                      status: mode === "REAL" ? "授权有效（演示模式）" : "演示测试专用（不计营收）",
                      permLabels: ["读取订单", "同步库存", "回复消息"],
                      credMask: `尾号 ${maskCode}`,
                      lastSync: nowDateTimeStr(),
                      lastSyncTs: Date.now(),
                      errNote: "",
                    });
                    return { summary: `店铺「${name}」连接成功（授权尾号 ${maskCode}）`, toastMsg: `店铺「${name}」已连接成功` };
                  }
                });
                return { toastMsg: "正在连接店铺，请稍候…", toastLevel: "info" };
              },
              audit: (wrap) => ({
                sentence: `${ROLE_PERSON_NAMES[state.role]} 发起了新店铺「${wrap.querySelector("#newShopName").value.trim()}」的连接申请`,
                ok: true
              })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>集中管理所有跨境店铺的授权连接状态与同步健康度。<strong>数据来源：</strong>各店铺实时连接状态（最近核对：${state.lastDataRefreshAt}）。</span>
        </div>

        ${renderAsyncBox("m0_shop_conn")}

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">已接入店铺总数</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.shops.length} 家</div>
            <div class="kpi-sub">含实盘店 ${realCount} 家 · 演示测试店 ${state.shops.length - realCount} 家</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">连接正常店铺</div>
            <div class="kpi-val" style="color:var(--green-text)">${healthyCount} 家</div>
            <div class="kpi-sub">可正常同步订单与库存</div>
          </div>
          <div class="kpi-card ${issueCount > 0 ? "highlight-red" : ""}">
            <div class="kpi-label">凭证过期 / 同步异常</div>
            <div class="kpi-val" style="color:${issueCount > 0 ? "var(--red-text)" : "var(--text-dark)"}">${issueCount} 家</div>
            <div class="kpi-sub">${issueCount > 0 ? "请点击对应店铺「重新授权」" : "当前全部实盘店健康"}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">订单同步与隔离</div>
            <div class="kpi-val" style="color:var(--purple-text)">严格隔离</div>
            <div class="kpi-sub">演示测试店订单绝不计入实盘营收</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">已接入店铺状态与授权管理</div>
            <span class="pill ${canManageShop ? "p-green" : "p-amber"}">${canManageShop ? "已解锁管理权限" : "当前岗位仅可查看状态"}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>店铺名称</th><th>平台与站点</th><th>营收口径</th><th>连接状态</th><th>已开通权限</th><th>最近同步时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${state.shops.map((s, idx) => `
                  <tr>
                    <td class="nowrap"><strong>${s.name}</strong><div style="font-size:12px;color:var(--text-soft);">凭证${s.credMask}</div></td>
                    <td class="nowrap">${s.platform} · ${s.region}</td>
                    <td class="nowrap"><span class="pill ${s.mode==="REAL"?"p-green":"p-amber"}">${s.mode==="REAL"?"实盘店铺（计入真实营收）":"仅演示环境（不计营收）"}</span></td>
                    <td class="nowrap">
                      <span class="pill ${s.health==="连接正常"?"p-green":s.health==="仅演示环境"?"p-blue":"p-red"}">${s.health}</span>
                      ${s.errNote ? `<div style="font-size:12px;color:var(--red-text);margin-top:3px;">${s.errNote}</div>` : ""}
                    </td>
                    <td>${s.permLabels.map(p => `<span class="pill p-gray" style="margin-right:4px;">${p}</span>`).join("")}</td>
                    <td class="nowrap">
                      <div>${s.lastSync}</div>
                      <div style="font-size:12px;color:var(--text-soft);">${relTimeLabel(s.lastSyncTs)}</div>
                    </td>
                    <td class="nowrap" style="display:flex;gap:6px;flex-wrap:wrap;">
                      <button class="btn btn-sm btn-primary m0-sync-btn" data-i="${idx}" ${!canManageShop?"disabled":""} title="${!canManageShop?"需要管理者或主管权限":""}">↻ 同步订单</button>
                      <button class="btn btn-sm m0-reauth-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>重新授权</button>
                      <button class="btn btn-sm btn-danger m0-disc-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>断开连接</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m0-sync-btn").forEach(b => b.onclick = () => {
          const s = state.shops[Number(b.dataset.i)];
          runAsyncTask("m0_shop_conn", {
            label: `正在同步「${s.name}」最新订单`,
            steps: ["校验店铺连接状态", "拉取最近已完成订单并自动防重过滤", "刷新经营大屏汇总数字"],
            durationMs: 1000,
            onSuccess: () => {
              s.lastSync = nowDateTimeStr();
              s.lastSyncTs = Date.now();
              s.health = s.mode === "REAL" ? "连接正常" : "仅演示环境";
              s.errNote = "";
              state.lastDataRefreshAt = nowTimeStr();
              state.lastDataRefreshTs = Date.now();
              if (s.mode === "REAL") {
                const ordNo = genDocId("ORD");
                state.orders.unshift({
                  orderNo: ordNo, shop: s.name, mode: "REAL", buyer: "New Buyer", sku: "BAG-108", productName: "轻量通勤双肩包",
                  qty: 2, amountUsd: 59.80, amountDisplay: "$59.80", status: "已付款", refundSyncStatus: "无退款", orderedAt: nowDateTimeStr(), historical: false,
                  timeline: [
                    { step: "买家付款完成", time: nowDateTimeStr(), done: true },
                    { step: "待仓库拣货打包", time: "处理中", done: false },
                  ]
                });
                return { summary: `已同步新实盘订单 ${ordNo} ($59.80)，经营大屏营收已同步更新`, toastMsg: `同步完成：新增 1 笔实盘订单 ${ordNo}` };
              }
              return { summary: `已刷新演示测试店状态（演示订单不计入真实营收）`, toastMsg: `演示店已同步（不计真实营收）`, toastLevel: "warn" };
            }
          });
        });

        document.querySelectorAll(".m0-reauth-btn").forEach(b => b.onclick = () => {
          const s = state.shops[Number(b.dataset.i)];
          runAsyncTask("m0_shop_conn", {
            label: `正在重新授权「${s.name}」`,
            steps: ["发起平台重新授权", "核对授权凭证", "恢复正常同步状态"],
            durationMs: 900,
            onSuccess: () => {
              s.health = s.mode === "REAL" ? "连接正常" : "仅演示环境";
              s.errNote = "";
              s.lastSync = nowDateTimeStr();
              s.lastSyncTs = Date.now();
              return { summary: `「${s.name}」已重新授权并恢复正常连接`, toastMsg: `「${s.name}」重新授权成功` };
            }
          });
        });

        document.querySelectorAll(".m0-disc-btn").forEach(b => b.onclick = () => {
          const s = state.shops[Number(b.dataset.i)];
          commitAction({
            title: `确认断开店铺连接 · ${s.name}`,
            danger: true,
            summary: "断开后将暂停该店铺的订单与库存自动同步，历史订单数据仍保留，随时可点击「重新授权」恢复。",
            confirmText: "确认断开",
            fieldsHtml: `<div class="field"><label>断开原因说明 *</label><input id="discReason" class="input" placeholder="如：更换店铺主账号 / 暂停运营"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#discReason");
              return el.value.trim() ? [] : [{ el, msg: "请填写断开原因" }];
            },
            onConfirm: (wrap) => {
              s.health = "连接已断开";
              s.errNote = `已断开：${wrap.querySelector("#discReason").value.trim()}`;
              return { toastMsg: `已断开「${s.name}」的连接`, toastLevel: "warn" };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 断开了店铺「${s.name}」的连接，原因：${wrap.querySelector("#discReason").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M0-2: 主商品档案、成本变更申请与订单台账 ====================
  if (pageId === "m0b") {
    const canEditCost = state.role === "planner" || state.role === "approver";
    const canApproveCost = state.role === "approver";

    const filteredProds = state.masterProducts.filter(p => {
      const q = state.masterSearch.trim().toLowerCase();
      const matchQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      const matchShop = state.masterShopFilter === "ALL" || p.mappings.some(m => m.shop === state.masterShopFilter);
      return matchQ && matchShop;
    });

    const filteredOrders = state.orders.filter(o => {
      const mShop = state.orderShopFilter === "ALL" || o.shop === state.orderShopFilter;
      const mSt = state.orderStatusFilter === "ALL" || o.status === state.orderStatusFilter;
      const mDt = state.orderDateFilter === "ALL" || o.orderedAt.startsWith(state.orderDateFilter);
      return mShop && mSt && mDt;
    });

    return {
      headerActions: [
        { label: "查看分店库存与盘点 →", primary: true, onClick: () => goPage("m0c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>管理商品主档案、带审批的成本变更申请，以及每笔订单的全生命周期明细。<strong>数据来源：</strong>各店铺同步订单与商品档案（最近核对：${state.lastDataRefreshAt}）。</span>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">在档主商品数量</div><div class="kpi-val" style="color:var(--blue-hover)">${state.masterProducts.length} 款</div><div class="kpi-sub">跨店铺统一商品编码管理</div></div>
          <div class="kpi-card ${state.masterProducts.some(p=>p.cost===null)?"highlight-amber":""}"><div class="kpi-label">缺成本待补全商品</div><div class="kpi-val" style="color:var(--amber-text)">${state.masterProducts.filter(p=>p.cost===null).length} 款</div><div class="kpi-sub">缺成本不可计算真实利润与补货</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">实盘订单明细 (已防重)</div><div class="kpi-val" style="color:var(--green-text)">${state.orders.filter(o=>o.mode==="REAL").length} 笔</div><div class="kpi-sub">仅实盘订单计入真实营收</div></div>
          <div class="kpi-card"><div class="kpi-label">成本变更审批记录</div><div class="kpi-val">${state.costChangeLogs.length} 笔</div><div class="kpi-sub">待审批：${state.costChangeLogs.filter(c=>c.status==="待主管审批").length} 笔</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">主商品档案与成本变更申请（修改成本将影响毛利、补货测算与利润驾驶舱）</div>
          </div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item"><label>搜索商品编码或名称</label><input id="m0bSearch" class="input" placeholder="如：BAG-108 或 双肩包" value="${state.masterSearch}"/></div>
            <div class="filter-item"><label>按上架店铺筛选</label>
              <select id="m0bShopSel" class="select">
                <option value="ALL">全部店铺</option>
                <option value="TikTok Shop 美区" ${state.masterShopFilter==="TikTok Shop 美区"?"selected":""}>TikTok Shop 美区</option>
                <option value="Shopee 泰国主店" ${state.masterShopFilter==="Shopee 泰国主店"?"selected":""}>Shopee 泰国主店</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品实拍与编码</th><th>品类</th><th>各店铺上架编号与售价</th><th>单件采购 / 头程成本</th><th>档案状态</th><th>操作</th></tr></thead>
              <tbody>
                ${filteredProds.length ? filteredProds.map(p => `
                  <tr>
                    <td class="nowrap">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${getProductImg(p.sku)}" class="prod-thumb-img" alt="${p.name}"/>
                        <div><strong>${p.sku}</strong><div style="font-size:12.5px;color:var(--text-muted);">${p.name}</div></div>
                      </div>
                    </td>
                    <td class="nowrap">${p.cat}</td>
                    <td>${p.mappings.map(m => `<div style="font-size:12.5px;"><strong>${m.shop}</strong> · 编号 ${m.shopSku} · ${m.price}</div>`).join("")}</td>
                    <td class="nowrap">${p.cost === null ? '<span class="pill p-amber">未知 (禁止按0算)</span>' : `$${p.cost.toFixed(2)} + 头程 $${p.freight.toFixed(2)}`}</td>
                    <td class="nowrap"><span class="pill ${p.cost===null?"p-amber":"p-green"}">${p.status}</span></td>
                    <td class="nowrap">
                      <button class="btn btn-sm btn-primary m0b-cost-btn" data-sku="${p.sku}" ${!canEditCost?"disabled":""} title="${!canEditCost?"需要业务运营或主管权限":""}">发起成本变更申请</button>
                    </td>
                  </tr>
                `).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--text-soft);padding:20px;">暂无符合筛选条件的商品，请清空筛选词重试。</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">成本变更审批与历史版本台账（留痕可追溯）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>申请单号</th><th>商品</th><th>变更前 → 变更后</th><th>生效日期</th><th>业务原因</th><th>申请/审批人</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.costChangeLogs.map((c, idx) => `
                  <tr>
                    <td class="nowrap"><strong>${c.id}</strong></td>
                    <td class="nowrap">${c.sku}</td>
                    <td class="nowrap">${c.oldCost===null?"未知":"$"+c.oldCost.toFixed(2)} → <strong>$${c.newCost.toFixed(2)}</strong> (头程 $${c.newFreight.toFixed(2)})</td>
                    <td class="nowrap">${c.effectiveDate}</td>
                    <td style="font-size:12.5px;">${c.reason}</td>
                    <td class="nowrap">${c.applicant} / ${c.approver || "待主管批"}</td>
                    <td class="nowrap"><span class="pill ${c.status==="已生效"?"p-green":"p-amber"}">${c.status}</span></td>
                    <td class="nowrap">
                      ${c.status === "待主管审批"
                        ? `<button class="btn btn-sm btn-success m0b-approve-cost" data-i="${idx}" ${!canApproveCost?"disabled":""} title="${!canApproveCost?"需「主管/审批人」批准":""}">批准生效</button>`
                        : `<span style="font-size:12px;color:var(--text-soft);">已归档</span>`}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">多店铺订单台账（点击任意订单行可查看买家与生命周期时间轴）</div>
            <span class="pill p-green">重复订单已自动过滤</span>
          </div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item"><label>筛选店铺</label>
              <select id="ordShopFlt" class="select">
                <option value="ALL">全部店铺</option>
                <option value="TikTok Shop 美区" ${state.orderShopFilter==="TikTok Shop 美区"?"selected":""}>TikTok Shop 美区</option>
                <option value="Shopee 泰国主店" ${state.orderShopFilter==="Shopee 泰国主店"?"selected":""}>Shopee 泰国主店</option>
                <option value="Amazon 演示沙盒店" ${state.orderShopFilter==="Amazon 演示沙盒店"?"selected":""}>Amazon 演示沙盒店</option>
              </select>
            </div>
            <div class="filter-item"><label>订单状态</label>
              <select id="ordStFlt" class="select">
                <option value="ALL">全部状态</option>
                <option value="已付款" ${state.orderStatusFilter==="已付款"?"selected":""}>已付款</option>
                <option value="已发货" ${state.orderStatusFilter==="已发货"?"selected":""}>已发货</option>
                <option value="已签收" ${state.orderStatusFilter==="已签收"?"selected":""}>已签收</option>
              </select>
            </div>
            <div class="filter-item"><label>下单日期</label>
              <select id="ordDtFlt" class="select">
                <option value="ALL">全部日期</option>
                <option value="2026-11-19" ${state.orderDateFilter==="2026-11-19"?"selected":""}>2026-11-19</option>
                <option value="2026-11-18" ${state.orderDateFilter==="2026-11-18"?"selected":""}>2026-11-18</option>
                <option value="2026-11-17" ${state.orderDateFilter==="2026-11-17"?"selected":""}>2026-11-17</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>订单编号</th><th>所属店铺</th><th>买家姓名</th><th>商品明细</th><th>实付金额</th><th>下单时间</th><th>订单状态</th><th>退款登记状态</th><th>营收口径</th></tr></thead>
              <tbody>
                ${filteredOrders.length ? filteredOrders.map(o => `
                  <tr class="m0b-ord-row" data-ord="${o.orderNo}" style="cursor:pointer;" title="点击查看订单全生命周期">
                    <td class="nowrap"><strong style="color:var(--blue-hover);">${o.orderNo}</strong></td>
                    <td class="nowrap">${o.shop}</td>
                    <td class="nowrap">${o.buyer}</td>
                    <td class="nowrap">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <img src="${getProductImg(o.sku)}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);" alt="${o.productName}"/>
                        <span>${o.productName} × ${o.qty}</span>
                      </div>
                    </td>
                    <td class="nowrap"><strong>${o.amountDisplay}</strong></td>
                    <td class="nowrap">${o.orderedAt}</td>
                    <td class="nowrap"><span class="pill ${o.mode==="REAL"?"p-blue":"p-amber"}">${o.status}</span></td>
                    <td class="nowrap"><span class="pill ${o.refundSyncStatus==="无退款"?"p-gray":"p-purple"}">${o.refundSyncStatus}</span></td>
                    <td class="nowrap"><span class="pill ${o.mode==="REAL"?"p-green":"p-amber"}">${o.mode==="REAL"?"计入真实营收":"仅演示不计营收"}</span></td>
                  </tr>
                `).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--text-soft);padding:20px;">暂无符合当前筛选条件的订单。</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0bSearch").oninput = (e) => { state.masterSearch = e.target.value; rerender(); };
        document.getElementById("m0bShopSel").onchange = (e) => { state.masterShopFilter = e.target.value; rerender(); };
        document.getElementById("ordShopFlt").onchange = (e) => { state.orderShopFilter = e.target.value; rerender(); };
        document.getElementById("ordStFlt").onchange = (e) => { state.orderStatusFilter = e.target.value; rerender(); };
        document.getElementById("ordDtFlt").onchange = (e) => { state.orderDateFilter = e.target.value; rerender(); };

        document.querySelectorAll(".m0b-ord-row").forEach(tr => tr.onclick = () => {
          const o = state.orders.find(x => x.orderNo === tr.dataset.ord);
          if (!o) return;
          openDrawer(`订单全生命周期 · ${o.orderNo}`, `${o.shop} · ${o.mode==="REAL"?"实盘订单":"仅演示订单"}`, `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
              <img src="${getProductImg(o.sku)}" class="prod-thumb-lg" alt="${o.productName}"/>
              <div>
                <div style="font-size:15px;font-weight:700;">${o.productName} × ${o.qty}</div>
                <div style="font-size:12.5px;color:var(--text-soft);margin-top:2px;">买家：${o.buyer} ｜ 实付：<strong>${o.amountDisplay}</strong></div>
                <div style="font-size:12px;color:var(--text-soft);">下单时间：${o.orderedAt} ｜ 退款登记：${o.refundSyncStatus}</div>
              </div>
            </div>
            <div class="drawer-sec-label">订单流转时间轴</div>
            <div>
              ${(o.timeline || []).map(st => `
                <div class="timeline-step ${st.done ? "done" : ""}">
                  <div>
                    <div style="font-weight:700;color:${st.done?"var(--green-text)":"var(--text-soft)"};">${st.done?"✓":"○"} ${st.step}</div>
                    <div style="font-size:12px;color:var(--text-soft);">${st.time}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          `);
        });

        document.querySelectorAll(".m0b-cost-btn").forEach(b => b.onclick = () => {
          const p = state.masterProducts.find(x => x.sku === b.dataset.sku);
          commitAction({
            title: `发起成本变更申请 · ${p.sku} (${p.name})`,
            summary: "⚠️ 重要影响提示：成本生效后将同步影响「毛利核算」、「M6 补货采购测算」与「M2 利润驾驶舱」全部利润数字。",
            confirmText: "提交成本变更申请",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>单件采购成本 (USD) *</label><input id="cNewCost" type="number" step="0.01" class="input" value="${p.cost ?? ""}" placeholder="例如 4.80"/></div>
                <div class="field"><label>单件头程运费 (USD) *</label><input id="cNewFr" type="number" step="0.01" class="input" value="${p.freight ?? ""}" placeholder="例如 2.30"/></div>
              </div>
              <div class="field"><label>成本生效日期 *</label><input id="cEffDate" type="date" class="input" value="2026-11-20"/></div>
              <div class="field"><label>业务变更原因（必填）*</label><input id="cReason" class="input" placeholder="如：原材料涨价 / 供应商阶梯报价调整"/></div>
            `,
            validate: (wrap) => {
              const errs = [];
              const cEl = wrap.querySelector("#cNewCost");
              const fEl = wrap.querySelector("#cNewFr");
              const dEl = wrap.querySelector("#cEffDate");
              const rEl = wrap.querySelector("#cReason");
              if (!(Number(cEl.value) > 0)) errs.push({ el: cEl, msg: "采购成本必须大于 0" });
              if (!(Number(fEl.value) >= 0) || fEl.value.trim() === "") errs.push({ el: fEl, msg: "请填写合法头程运费" });
              if (!dEl.value.trim()) errs.push({ el: dEl, msg: "请选择生效日期" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写成本变更业务原因" });
              return errs;
            },
            onConfirm: (wrap) => {
              const nc = Number(wrap.querySelector("#cNewCost").value);
              const nf = Number(wrap.querySelector("#cNewFr").value);
              const dt = wrap.querySelector("#cEffDate").value;
              const rsn = wrap.querySelector("#cReason").value.trim();
              const cid = genDocId("CC");
              const autoApprove = state.role === "approver";
              state.costChangeLogs.unshift({
                id: cid, sku: p.sku, oldCost: p.cost, oldFreight: p.freight,
                newCost: nc, newFreight: nf, effectiveDate: dt, reason: rsn,
                applicant: ROLE_PERSON_NAMES[state.role],
                approver: autoApprove ? "陈主管" : "",
                status: autoApprove ? "已生效" : "待主管审批",
                time: nowDateTimeStr()
              });
              if (autoApprove) {
                p.cost = nc; p.freight = nf; p.status = "在售";
              }
              return { toastMsg: autoApprove ? `成本变更单 ${cid} 已生效（毛利与补货测算已同步更新）` : `已提交成本变更申请 ${cid}，请由「主管 / 审批人」批准生效` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 提交了 ${p.sku} 成本变更申请（采购 $${wrap.querySelector("#cNewCost").value} + 头程 $${wrap.querySelector("#cNewFr").value}，生效日 ${wrap.querySelector("#cEffDate").value}），原因：${wrap.querySelector("#cReason").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m0b-approve-cost").forEach(b => b.onclick = () => {
          const log = state.costChangeLogs[Number(b.dataset.i)];
          const prod = state.masterProducts.find(p => p.sku === log.sku);
          commitAction({
            title: `批准成本变更生效 · ${log.id}`,
            summary: `批准后 ${log.sku} 的单件成本将正式更新为采购 $${log.newCost.toFixed(2)} + 头程 $${log.newFreight.toFixed(2)}，影响毛利与补货测算。`,
            confirmText: "确认批准生效",
            onConfirm: () => {
              log.status = "已生效";
              log.approver = "陈主管";
              if (prod) { prod.cost = log.newCost; prod.freight = log.newFreight; prod.status = "在售"; }
              return { toastMsg: `成本变更 ${log.id} 已批准生效` };
            },
            audit: {
              sentence: `陈主管 批准了成本变更单 ${log.id}（${log.sku} 采购成本调至 $${log.newCost.toFixed(2)}）`,
              ok: true
            }
          });
        });
      }
    };
  }

  // ==================== M0-3: 分店分仓独立库存与正式盘点单 ====================
  if (pageId === "m0c") {
    const canStocktake = state.role === "warehouse" || state.role === "manager" || state.role === "approver";
    const filteredInv = state.inventoryItems.filter(i => state.inventoryShopFilter === "ALL" || i.shopName === state.inventoryShopFilter);

    // 实时算一个当前预测对比（BAG-108 与 FAN-203 直观显示变化）
    const totalPred7 = state.m5DailyPred.reduce((a, b) => a + b, 0);
    const bagUs = state.inventoryItems.find(i => i.id === "inv1");
    const fanTh = state.inventoryItems.find(i => i.id === "inv3");

    return {
      headerActions: [
        { label: "去 M5 查看销量预测联动 →", primary: false, onClick: () => goPage("m5b") },
        { label: "去 M6 查看补货缺口联动 →", primary: true, onClick: () => goPage("m6b") }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>库存安全红线：</strong>仓库收货登记<strong>不会自动加减可售库存</strong>；只有在此处完成盘点并生成<strong>正式盘点单</strong>后，库存才生效，并立刻联动重算 M5 预测补货建议与 M6 缺口天数。</span>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">分店独立库存台账</div><div class="kpi-val" style="color:var(--blue-hover)">${state.inventoryItems.length} 条</div><div class="kpi-sub">跨店跨仓不混算</div></div>
          <div class="kpi-card highlight-red"><div class="kpi-label">低于安全水位预警</div><div class="kpi-val" style="color:var(--red-text)">${state.inventoryItems.filter(i=>i.avail<i.safety).length} 项</div><div class="kpi-sub">需尽快盘点核实或安排补货</div></div>
          <div class="kpi-card"><div class="kpi-label">美西仓 BAG-108 联动补货</div><div class="kpi-val" style="color:var(--blue-hover)">${Math.max(0, totalPred7 + bagUs.safety - bagUs.avail)} 件</div><div class="kpi-sub">M5 7日参考 (当前可售 ${bagUs.avail} 件)</div></div>
          <div class="kpi-card"><div class="kpi-label">曼谷仓 FAN-203 理论缺口</div><div class="kpi-val" style="color:var(--amber-text)">${Math.max(0, 30*(state.m6NormalLeadDays+state.m6NormalSafetyDays) - fanTh.avail)} 件</div><div class="kpi-sub">M6 常规补货缺口 (当前可售 ${fanTh.avail} 件)</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">分店分仓独立可售库存</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="m0cShopFlt" class="select" style="width:190px;">
                <option value="ALL">全部实盘店铺</option>
                <option value="TikTok Shop 美区" ${state.inventoryShopFilter==="TikTok Shop 美区"?"selected":""}>TikTok Shop 美区</option>
                <option value="Shopee 泰国主店" ${state.inventoryShopFilter==="Shopee 泰国主店"?"selected":""}>Shopee 泰国主店</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品编码与名称</th><th>所属店铺</th><th>存放物理仓库</th><th>当前可售</th><th>安全库存</th><th>水位状态</th><th>人工盘点</th></tr></thead>
              <tbody>
                ${filteredInv.map(item => {
                  const low = item.avail < item.safety;
                  return `
                    <tr>
                      <td class="nowrap">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <img src="${getProductImg(item.sku)}" style="width:36px;height:36px;border-radius:6px;border:1px solid var(--border);" alt="${item.name}"/>
                          <div><strong>${item.sku} · ${item.name}</strong><div style="font-size:12px;color:var(--text-soft);">店铺上架编号：${item.shopSku}</div></div>
                        </div>
                      </td>
                      <td class="nowrap">${item.shopName}</td>
                      <td class="nowrap"><strong>${item.whName}</strong></td>
                      <td class="nowrap"><strong style="font-size:15px;color:${low?"var(--red-text)":"var(--text-dark)"};">${item.avail} 件</strong></td>
                      <td class="nowrap">${item.safety} 件</td>
                      <td class="nowrap"><span class="pill ${low?"p-red":"p-green"}">${low?"低于安全水位":"库存健康"}</span></td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-primary m0c-cal-btn" data-id="${item.id}" ${!canStocktake?"disabled":""} title="${!canStocktake?"需要仓库人员或管理者权限":""}">📝 盘点校准</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header"><div class="card-title">正式盘点单与下游补货影响明细（让每笔盘点变化一目了然）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>盘点单号</th><th>仓库 / 商品</th><th>调整前 → 调整后</th><th>M5 建议补货量变化</th><th>M6 补货缺口变化</th><th>盘点原因</th><th>盘点人 / 时间</th></tr></thead>
              <tbody>
                ${state.stocktakes.map(st => `
                  <tr>
                    <td class="nowrap"><strong>${st.sheetId}</strong></td>
                    <td class="nowrap">${st.whName} · ${st.sku}</td>
                    <td class="nowrap">${st.before} → <strong>${st.after} 件</strong> (${st.delta >= 0 ? "+" + st.delta : st.delta})</td>
                    <td class="nowrap">${st.m5Before} → <strong style="color:var(--blue-hover);">${st.m5After} 件</strong></td>
                    <td class="nowrap">${st.m6Before} → <strong style="color:var(--green-text);">${st.m6After} 件</strong></td>
                    <td style="font-size:12.5px;">${st.reason}</td>
                    <td class="nowrap">${st.who}<div style="font-size:12px;color:var(--text-soft);">${st.time}</div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0cShopFlt").onchange = (e) => { state.inventoryShopFilter = e.target.value; rerender(); };
        document.querySelectorAll(".m0c-cal-btn").forEach(b => b.onclick = () => {
          const item = state.inventoryItems.find(x => x.id === b.dataset.id);
          const oldAvail = item.avail;
          const m5PredBase = state.m5DailyPred.reduce((a, x) => a + x, 0);
          const m5Old = Math.max(0, m5PredBase + item.safety - oldAvail);
          const m6Old = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - oldAvail);

          commitAction({
            title: `生成正式盘点单 · ${item.whName} · ${item.sku}`,
            summary: `当前账面可售 <strong>${oldAvail} 件</strong>；若本次调整幅度超过 20 件或 20%，系统会要求填写详细原因并二次确认。`,
            confirmText: "确认生成盘点单并更新库存",
            fieldsHtml: `
              <div class="field"><label>实际清点可售数量 (件) *</label><input id="stNewQty" type="number" class="input" value="${oldAvail}"/></div>
              <div id="stImpactPreview" class="formula-box" style="margin-bottom:10px;">请输入盘点后数量以查看对 M5/M6 建议补货量的实时影响…</div>
              <div class="field"><label>盘点差异原因（必填）*</label><input id="stReason" class="input" placeholder="如：新到货上架入仓 / 清点出破损件"/></div>
              <div id="stBigWarn" style="display:none;" class="banner banner-red"><span>⚠️ 检测到大幅度库存调整（变动 ≥ 20 件），请确认已核对实物无误再提交！</span></div>
            `,
            onMount: (wrap) => {
              const qtyEl = wrap.querySelector("#stNewQty");
              const prevEl = wrap.querySelector("#stImpactPreview");
              const warnEl = wrap.querySelector("#stBigWarn");
              const upd = () => {
                const n = Number(qtyEl.value);
                if (Number.isNaN(n) || n < 0) return;
                const m5New = Math.max(0, m5PredBase + item.safety - n);
                const m6New = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - n);
                prevEl.innerHTML = `
                  • 库存变化：${oldAvail} 件 → <strong>${n} 件</strong> (${n - oldAvail >= 0 ? "+" : ""}${n - oldAvail} 件)<br/>
                  • 影响 M5 预测补货建议：${m5Old} 件 → <strong>${m5New} 件</strong><br/>
                  • 影响 M6 常规补货缺口：${m6Old} 件 → <strong>${m6New} 件</strong>
                `;
                warnEl.style.display = Math.abs(n - oldAvail) >= 20 ? "flex" : "none";
              };
              qtyEl.oninput = upd;
              upd();
            },
            validate: (wrap) => {
              const errs = [];
              const qEl = wrap.querySelector("#stNewQty");
              const rEl = wrap.querySelector("#stReason");
              if (qEl.value.trim() === "" || Number(qEl.value) < 0) errs.push({ el: qEl, msg: "库存数量必须为大于或等于 0 的数字" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写盘点调整原因" });
              return errs;
            },
            onConfirm: (wrap) => {
              const newVal = Number(wrap.querySelector("#stNewQty").value);
              const reason = wrap.querySelector("#stReason").value.trim();
              const m5New = Math.max(0, m5PredBase + item.safety - newVal);
              const m6New = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - newVal);
              const sid = genDocId("PD");
              item.avail = newVal;
              state.stocktakes.unshift({
                sheetId: sid, whName: item.whName, sku: item.sku,
                before: oldAvail, after: newVal, delta: newVal - oldAvail,
                m5Before: m5Old, m5After: m5New, m6Before: m6Old, m6After: m6New,
                reason, who: ROLE_PERSON_NAMES[state.role], time: nowDateTimeStr()
              });
              return { toastMsg: `盘点单 ${sid} 已生效！库存更新为 ${newVal} 件，M5/M6 建议补货量已联动重算` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 生成了盘点单（${item.whName} ${item.sku} 由 ${oldAvail} 件校准为 ${wrap.querySelector("#stNewQty").value} 件），原因：${wrap.querySelector("#stReason").value.trim()}`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M1-1: 客服会话、四要素核验绑单、三项回复检查 ====================
  if (pageId === "m1a") {
    const canCs = state.role === "cs" || state.role === "approver";
    const active = state.csSessions.find(s => s.id === state.csActiveId) || state.csSessions[0];
    const tkInfo = state.csTakeoverMap[active.id] || { who: "智能助手自动接待", at: "—" };
    const linkedOrdObj = state.orders.find(o => o.orderNo === active.linkedOrder);

    // 实时三项回复内容检查
    const zhVal = active.draftZh || "";
    const enVal = active.draftEn || "";
    const zhNums = (zhVal.match(/\d+(\.\d+)?/g) || []).join(",");
    const enNums = (enVal.match(/\d+(\.\d+)?/g) || []).join(",");
    const numMatchOk = zhNums === enNums;

    // 金额与订单一致检查
    const orderAmt = linkedOrdObj ? linkedOrdObj.amountUsd : null;
    const mentionNums = (zhVal + " " + enVal).match(/\$\s*(\d+(\.\d+)?)/g) || [];
    const amountWithinOk = !orderAmt || mentionNums.every(m => Number(m.replace("$", "").trim()) <= orderAmt);

    // 本店链接检查
    const otherDomains = state.csCatalog.filter(c => c.shop !== active.shop).map(c => c.domain);
    const wrongDom = otherDomains.find(d => (zhVal + " " + enVal).includes(d));
    const linkMatchOk = !wrongDom;

    const allReplyChecksOk = numMatchOk && amountWithinOk && linkMatchOk;

    return {
      headerActions: [
        { label: "查看本店在售导购库 →", primary: false, onClick: () => goPage("m1b") },
        { label: "前往售后审批台账 →", primary: true, onClick: () => goPage("m1c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>一线客服处理买家咨询、人工接管并核验订单四要素后转入售后审批。<strong>数据来源：</strong>实时接入买家会话与订单台账（当前会话接待人：<strong>${tkInfo.who}</strong> · 接管时间：<strong>${tkInfo.at}</strong>）。</span>
        </div>

        <div class="grid-3">
          <div class="kpi-card highlight-blue"><div class="kpi-label">待人工接管会话</div><div class="kpi-val" style="color:var(--blue-hover)">${state.csSessions.filter(s=>s.status==="待人工接管").length} 组</div><div class="kpi-sub">含售后投诉或敏感字眼</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">智能自动接待中</div><div class="kpi-val" style="color:var(--green-text)">${state.csSessions.filter(s=>s.status==="智能自动接待").length} 组</div><div class="kpi-sub">普通商品问答自动处理</div></div>
          <div class="kpi-card"><div class="kpi-label">已确认绑单会话</div><div class="kpi-val">${state.csSessions.filter(s=>s.linkVerified).length} 组</div><div class="kpi-sub">四要素核对一致后才可建单</div></div>
        </div>

        <div class="cs-3col">
          <div class="card">
            <div class="card-header"><div class="card-title">买家会话列表</div></div>
            ${state.csSessions.map(s => {
              const info = state.csTakeoverMap[s.id] || { who: "自动", at: "" };
              return `
                <div class="session-item ${s.id===active.id?"active":""} cs-sess-pick" data-id="${s.id}">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <strong>${s.buyer}</strong>
                    <span class="pill ${s.mode==="MOCK"?"p-amber":s.status==="待人工接管"?"p-red":"p-green"}">${s.status}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-soft);margin-top:3px;">${s.shop} · ${s.intent}</div>
                  <div style="font-size:12px;color:var(--blue-hover);margin-top:2px;">接待：${info.who} (${info.at})</div>
                </div>
              `;
            }).join("")}
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${active.buyer} · ${active.shop}</div>
                <div style="font-size:12px;color:var(--text-soft);">当前接待人：<strong>${tkInfo.who}</strong> ｜ 接管时间：<strong>${tkInfo.at}</strong></div>
              </div>
              <button class="btn btn-sm btn-primary" id="csTakeoverBtn" ${!canCs?"disabled":""}>✋ 人工接管会话</button>
            </div>

            <div style="max-height:240px;overflow-y:auto;padding-right:4px;margin-bottom:10px;">
              ${active.msgs.map(m => `
                <div class="chat-bubble ${m.who==="buyer"?"user":"assistant"}">
                  <div>${m.text}</div>
                  <div class="chat-trans">${m.trans}</div>
                </div>
              `).join("")}
            </div>

            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px;">
              <div style="font-weight:700;font-size:12.5px;margin-bottom:6px;">回复内容合规检查（发送前自动逐项核验）</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;">
                <span class="pill ${amountWithinOk?"p-green":"p-red"}">${amountWithinOk ? "✓ 金额与订单一致" : "✗ 报价超出实付金额"}</span>
                <span class="pill ${linkMatchOk?"p-green":"p-red"}">${linkMatchOk ? "✓ 使用本店商品链接" : "✗ 检测到其他店铺链接"}</span>
                <span class="pill ${numMatchOk?"p-green":"p-red"}">${numMatchOk ? "✓ 中英文数字一致" : `✗ 中英文数字不一致 (中文[${zhNums||"无"}] vs 英文[${enNums||"无"}])`}</span>
              </div>
            </div>

            <div class="field"><label>中文核对草稿（便于客服主管抽检）</label><textarea id="csDraftZh" class="textarea ${!allReplyChecksOk?"input-err":""}">${active.draftZh}</textarea></div>
            <div class="field"><label>发送给买家的外文回复</label><textarea id="csDraftEn" class="textarea ${!allReplyChecksOk?"input-err":""}">${active.draftEn}</textarea></div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:12px;color:${allReplyChecksOk?"var(--green-text)":"var(--red-text)"};">${allReplyChecksOk ? "三项检查全部通过，可以发送" : "存在不合规表述，请按红色标出项修正后再发送"}</span>
              <button class="btn btn-primary" id="csSendBtn" ${(!canCs || !allReplyChecksOk)?"disabled":""}>发送回复给买家</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">关联订单核验与售后建单</div></div>
            <div class="formula-box" style="margin-bottom:10px;">
              <div><strong>会话绑定单号：</strong>${active.linkedOrder || "尚未绑定"}</div>
              <div><strong>核验状态：</strong><span class="pill ${active.linkVerified?"p-green":"p-amber"}">${active.linkVerified?"四要素已人工核对一致 ✓":"待并排核对四要素"}</span></div>
            </div>
            <button class="btn btn-sm btn-primary" id="csBindOrderBtn" style="width:100%;justify-content:center;margin-bottom:10px;" ${!canCs?"disabled":""}>🔍 并排核对并绑定订单</button>

            <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;"/>
            <div class="field"><label>申请退款金额 (USD)</label><input id="csRefAmt" type="number" step="0.01" class="input" value="${linkedOrdObj ? linkedOrdObj.amountUsd : 34.50}"/></div>
            <div class="field"><label>售后原因 *</label><input id="csRefReason" class="input" value="买家反馈包裹外箱划痕申请退款"/></div>
            <button class="btn btn-danger" id="csCreateTicketBtn" style="width:100%;justify-content:center;" ${(!canCs || !active.linkVerified)?"disabled":""} title="${!active.linkVerified?"请先完成上方订单四要素核验":""}">
              提交售后工单 (转主管审批) →
            </button>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".cs-sess-pick").forEach(el => el.onclick = () => { state.csActiveId = el.dataset.id; rerender(); });
        document.getElementById("csDraftZh").oninput = (e) => { active.draftZh = e.target.value; rerender(); };
        document.getElementById("csDraftEn").oninput = (e) => { active.draftEn = e.target.value; rerender(); };

        document.getElementById("csTakeoverBtn").onclick = () => {
          state.csTakeoverMap[active.id] = { who: ROLE_PERSON_NAMES[state.role], at: nowTimeStr() };
          active.status = "人工接待中";
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 接管了买家「${active.buyer}」的客服会话`, ok: true });
          rerender();
          toast(`已人工接管会话，当前接待人：${ROLE_PERSON_NAMES[state.role]}`, "success");
        };

        document.getElementById("csSendBtn").onclick = () => {
          active.msgs.push({ who: "ai", text: active.draftEn, trans: "中文对照：" + active.draftZh });
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 通过三项内容检查后向买家「${active.buyer}」发送了回复`, ok: true });
          rerender();
          toast("内容检查通过，回复已发出", "success");
        };

        document.getElementById("csBindOrderBtn").onclick = () => {
          const candOrders = state.orders.filter(o => o.shop === active.shop);
          openModal("并排核对会话与候选订单（四要素人工确认）", `
            <div class="diff-grid" style="margin-bottom:12px;">
              <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;">
                <strong style="font-size:13px;">当前买家会话信息</strong>
                <div style="font-size:12.5px;margin-top:6px;line-height:1.7;">
                  • 买家姓名：<strong>${active.buyer}</strong><br/>
                  • 所属店铺：${active.shop}<br/>
                  • 买家诉求：${active.intent}<br/>
                  • 提及信息：${(active.msgs[0]?.text || "").slice(0, 80)}
                </div>
              </div>
              <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;">
                <strong style="font-size:13px;">选择候选订单</strong>
                <div class="field" style="margin-top:6px;">
                  <select id="bindOrdSel" class="select">
                    ${candOrders.map(o => `<option value="${o.orderNo}" ${active.linkedOrder===o.orderNo?"selected":""}>${o.orderNo} · ${o.buyer} · ${o.amountDisplay}</option>`).join("")}
                  </select>
                </div>
                <div id="bindOrdDetail" style="font-size:12px;color:var(--text-muted);"></div>
              </div>
            </div>
            <div style="background:var(--amber-bg);border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
              <strong style="font-size:12.5px;">人工勾选确认四要素一致（全部勾选后方可绑定）：</strong>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;font-size:12.5px;">
                <label><input type="checkbox" class="chk-4" ${active.linkChecks?.buyer?"checked":""}/> 1. 买家姓名匹配</label>
                <label><input type="checkbox" class="chk-4" ${active.linkChecks?.amount?"checked":""}/> 2. 订单实付金额匹配</label>
                <label><input type="checkbox" class="chk-4" ${active.linkChecks?.product?"checked":""}/> 3. 购买商品名称匹配</label>
                <label><input type="checkbox" class="chk-4" ${active.linkChecks?.time?"checked":""}/> 4. 下单时间一致</label>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button class="btn" id="cancelBind">取消</button>
              <button class="btn btn-primary" id="confirmBind">确认四要素一致并绑定</button>
            </div>
          `, (root) => {
            const sel = root.querySelector("#bindOrdSel");
            const det = root.querySelector("#bindOrdDetail");
            const upd = () => {
              const o = state.orders.find(x => x.orderNo === sel.value);
              if (o) det.innerHTML = `商品：${o.productName} × ${o.qty}<br/>下单：${o.orderedAt}<br/>状态：${o.status}`;
            };
            sel.onchange = upd; upd();
            root.querySelector("#cancelBind").onclick = () => document.getElementById("modalRoot").innerHTML = "";
            root.querySelector("#confirmBind").onclick = () => {
              const allChk = [...root.querySelectorAll(".chk-4")].every(c => c.checked);
              if (!allChk) { toast("请逐一勾选确认买家、金额、商品、时间四项均匹配！", "error"); return; }
              active.linkedOrder = sel.value;
              active.linkVerified = true;
              active.linkChecks = { buyer: true, amount: true, product: true, time: true };
              appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 核对四要素一致后，将买家「${active.buyer}」会话绑定至订单 ${sel.value}`, ok: true });
              document.getElementById("modalRoot").innerHTML = "";
              rerender();
              toast(`四要素核验通过，已绑定订单 ${sel.value}`, "success");
            };
          });
        };

        document.getElementById("csCreateTicketBtn").onclick = () => {
          const amt = Number(document.getElementById("csRefAmt").value);
          const reason = document.getElementById("csRefReason").value.trim();
          const maxOrd = linkedOrdObj ? linkedOrdObj.amountUsd : 34.50;
          if (!reason) { toast("请填写售后原因", "error"); return; }
          if (!(amt > 0) || amt > maxOrd) { toast(`退款金额必须在 $0.01 至实付上限 $${maxOrd.toFixed(2)} 之间`, "error"); return; }
          commitAction({
            title: `提交售后工单 · 关联订单 ${active.linkedOrder}`,
            summary: `退款申请金额 <strong>$${amt.toFixed(2)}</strong>（订单实付 $${maxOrd.toFixed(2)}）；提交后需由「主管 / 审批人」审批，客服本人不可自批。`,
            confirmText: "确认建单转交主管",
            onConfirm: () => {
              const tkId = genDocId("TK");
              state.tickets.unshift({
                id: tkId, orderNo: active.linkedOrder, shop: active.shop, buyer: active.buyer, reason,
                orderAmount: maxOrd, refundAmount: amt, submitter: ROLE_PERSON_NAMES[state.role],
                approver: "", approveNote: "", status: "待主管审批", refundSyncStatus: "未打款（待审批）", voucher: ""
              });
              return { toastMsg: `售后工单 ${tkId} 已创建，已流转至 M1-3 待主管审批` };
            },
            audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 为订单 ${active.linkedOrder} 创建了售后退款工单，申请退款 $${amt.toFixed(2)}`, ok: true }
          });
        };
      }
    };
  }

  // ==================== M1-2: 客服导购在售商品库 ====================
  if (pageId === "m1b") {
    const canMaintain = state.role === "planner" || state.role === "approver";
    return {
      headerActions: [
        { label: "← 返回客服会话", primary: false, onClick: () => goPage("m1a") },
        {
          label: "+ 从表格导入商品", primary: true,
          disabled: !canMaintain,
          disabledTitle: "需要业务运营或主管权限",
          onClick: () => {
            openModal("从表格导入客服在售导购商品", `
              <div class="banner banner-blue" style="margin-bottom:12px;">
                <span>请上传在售商品表格（支持预览前 10 行数据）；若文件名含测试演示字样或存在重复商品编码，系统将自动拦截并列出失败原因。</span>
              </div>
              <div class="field"><label>目标实盘店铺 *</label>
                <select id="csImpShop" class="select"><option>TikTok Shop 美区</option><option>Shopee 泰国主店</option></select>
              </div>
              <div class="field"><label>选择本地表格文件 (.xlsx / .csv) *</label>
                <input id="csImpFile" type="file" accept=".xlsx,.xls,.csv" class="input" style="padding-top:6px;"/>
              </div>
              <div id="csImpPreview" style="margin-bottom:12px;"></div>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button class="btn" id="csImpCancel">取消</button>
                <button class="btn btn-primary" id="csImpRun">开始导入并建立商品索引</button>
              </div>
            `, (root) => {
              const fInput = root.querySelector("#csImpFile");
              const prevBox = root.querySelector("#csImpPreview");
              fInput.onchange = () => {
                const f = fInput.files && fInput.files[0];
                if (!f) { prevBox.innerHTML = ""; return; }
                const isMock = /mock|演示|demo/i.test(f.name);
                if (isMock) {
                  prevBox.innerHTML = `<div class="banner banner-red"><span>❌ 拦截原因：文件「${f.name}」包含测试演示字样，严禁导入正式客服导购商品库！</span></div>`;
                  return;
                }
                prevBox.innerHTML = `
                  <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">表格前 10 行数据预览（示例抽取自 ${f.name}）：</div>
                  <div class="table-wrap" style="max-height:160px;">
                    <table>
                      <thead><tr><th>行号</th><th>商品编码</th><th>商品名称</th><th>售价</th><th>预检结果</th></tr></thead>
                      <tbody>
                        <tr><td>第 1 行</td><td>BAG-209</td><td>防水商务斜挎包</td><td>$26.90</td><td><span class="pill p-green">格式合法</span></td></tr>
                        <tr><td>第 2 行</td><td>BAG-108</td><td>轻量通勤双肩包</td><td>$29.90</td><td><span class="pill p-red">失败：商品编码与本店已有数据重复</span></td></tr>
                      </tbody>
                    </table>
                  </div>
                `;
              };
              root.querySelector("#csImpCancel").onclick = () => document.getElementById("modalRoot").innerHTML = "";
              root.querySelector("#csImpRun").onclick = () => {
                const f = fInput.files && fInput.files[0];
                if (!f) { toast("请先选择一个表格文件", "error"); return; }
                if (/mock|演示|demo/i.test(f.name)) {
                  appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 尝试导入演示测试文件「${f.name}」到客服库，已被系统拦截`, ok: false });
                  toast("禁止导入含演示标识的文件", "error");
                  return;
                }
                const shop = root.querySelector("#csImpShop").value;
                document.getElementById("modalRoot").innerHTML = "";
                runAsyncTask("m1_catalog_imp", {
                  label: `建立商品索引（20/200 分批校验）· ${f.name}`,
                  steps: ["读取表格数据并检查编码重复", "分批建立客服搜索索引 (100/200)", "完成索引并生成异常行明细"],
                  durationMs: 1200,
                  onSuccess: () => {
                    state.csCatalog.unshift({
                      sku: "BAG-209", name: "防水商务斜挎包", shop, domain: shop.includes("泰国") ? "shopee.co.th/cp-th" : "tiktok.com/shop/us-cp",
                      price: "$26.90", status: "索引已就绪", points: "防泼水帆布 / 轻便单肩 / 多隔层收纳"
                    });
                    state.csImportLogs.unshift({
                      file: f.name, shop, total: 200, okCount: 199, failCount: 1,
                      failReason: "第 2 行商品编码 BAG-108 重复，已自动跳过", status: "部分成功 (199/200)", time: nowDateTimeStr()
                    });
                    return { summary: "已建立商品索引 199/200（第 2 行因商品编码重复跳过）", toastMsg: "导入完成：成功 199 条，跳过 1 条重复编码" };
                  }
                });
              };
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>供客服人员在回答买家时查询本店真实在售商品与卖点（未采购的新品评估请去 M4 选品中心）。<strong>数据来源：</strong>在售导购清单（最近导入：${state.csImportLogs[0]?.time || "—"}）。</span>
        </div>

        ${renderAsyncBox("m1_catalog_imp")}

        <div class="card">
          <div class="card-header"><div class="card-title">本店在售导购商品清单（按店铺严格隔离）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品实拍与编码</th><th>所属店铺与本店网址</th><th>在售标价</th><th>核心卖点摘要</th><th>索引状态</th></tr></thead>
              <tbody>
                ${state.csCatalog.map(p => `
                  <tr>
                    <td class="nowrap">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${getProductImg(p.sku)}" class="prod-thumb-img" alt="${p.name}"/>
                        <div><strong>${p.sku} · ${p.name}</strong></div>
                      </div>
                    </td>
                    <td class="nowrap">${p.shop}<div style="font-size:12px;color:var(--text-soft);">${p.domain}</div></td>
                    <td class="nowrap"><strong>${p.price}</strong></td>
                    <td style="font-size:12.5px;">${p.points}</td>
                    <td class="nowrap"><span class="pill p-green">${p.status}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">导入批次与异常行原因记录</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>导入文件名</th><th>目标店铺</th><th>成功 / 总行数</th><th>异常行原因说明</th><th>导入时间</th></tr></thead>
              <tbody>
                ${state.csImportLogs.map(lg => `
                  <tr>
                    <td class="nowrap"><strong>${lg.file}</strong></td>
                    <td class="nowrap">${lg.shop}</td>
                    <td class="nowrap"><span class="pill ${lg.failCount?"p-amber":"p-green"}">${lg.status}</span></td>
                    <td style="font-size:12.5px;color:${lg.failCount?"var(--red-text)":"var(--text-soft)"};">${lg.failReason}</td>
                    <td class="nowrap">${lg.time}</td>
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

  // ==================== M1-3: 售后工单审批与退款凭证闭环 ====================
  if (pageId === "m1c") {
    const isApprover = state.role === "approver";
    const canUploadVoucher = state.role === "cs" || isApprover;

    return {
      headerActions: [
        { label: "← 返回客服建单", primary: false, onClick: () => goPage("m1a") },
        { label: "查看订单台账回填状态 →", primary: true, onClick: () => goPage("m0b") }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>闭环与风控说明：</strong>① 提交人与审批人必须为不同人员；② 主管审批时须填写意见且退款不得超过实付；③ 批准后进入<strong>「待上传退款凭证」</strong>，仅上传手工打款凭证后工单才正式关闭。</span>
        </div>

        <div class="grid-3">
          <div class="kpi-card highlight-red"><div class="kpi-label">待主管审批工单</div><div class="kpi-val" style="color:var(--red-text)">${state.tickets.filter(t=>t.status==="待主管审批").length} 单</div><div class="kpi-sub">需主管/审批人填写意见拍板</div></div>
          <div class="kpi-card highlight-amber"><div class="kpi-label">待上传退款凭证</div><div class="kpi-val" style="color:var(--amber-text)">${state.tickets.filter(t=>t.status==="待上传退款凭证").length} 单</div><div class="kpi-sub">需在平台后台手工打款并回传截图</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">已上传凭证关闭</div><div class="kpi-val" style="color:var(--green-text)">${state.tickets.filter(t=>t.status==="已关闭（退款完成）").length} 单</div><div class="kpi-sub">同步更新至 M0-2 订单台账</div></div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">售后工单与退款凭证台账</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>工单编号</th><th>关联订单 / 买家</th><th>申请退款 / 实付上限</th><th>提交人 / 审批人</th><th>退款状态与凭证</th><th>操作</th></tr></thead>
              <tbody>
                ${state.tickets.map((t, idx) => {
                  const isSelfSubmit = t.submitter === ROLE_PERSON_NAMES[state.role];
                  const canApproveThis = isApprover && !isSelfSubmit;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${t.id}</strong><div style="font-size:12px;color:var(--text-soft);">${t.shop}</div></td>
                      <td><strong>${t.orderNo}</strong> (${t.buyer})<div style="font-size:12px;color:var(--text-soft);">${t.reason}</div></td>
                      <td class="nowrap"><strong style="color:var(--red-text);">$${t.refundAmount.toFixed(2)}</strong><div style="font-size:12px;color:var(--text-soft);">实付上限 $${t.orderAmount.toFixed(2)}</div></td>
                      <td class="nowrap">提交：${t.submitter}<div style="font-size:12px;color:var(--text-soft);">审批：${t.approver || "待批"}${t.approveNote ? ` (${t.approveNote})` : ""}</div></td>
                      <td>
                        <span class="pill ${t.status==="已关闭（退款完成）"?"p-green":t.status==="待上传退款凭证"?"p-blue":t.status==="已驳回"?"p-red":"p-amber"}">${t.status}</span>
                        <div style="font-size:12px;color:var(--text-soft);margin-top:3px;">${t.refundSyncStatus}${t.voucher ? ` · 凭证：${t.voucher}` : ""}</div>
                      </td>
                      <td class="nowrap">
                        ${t.status === "待主管审批" ? `
                          <div style="display:flex;gap:6px;">
                            <button class="btn btn-sm btn-success m1c-act" data-i="${idx}" data-act="APPROVE" ${!canApproveThis?"disabled":""} title="${!isApprover?"需要「主管 / 审批人」权限":"提交人与审批人不可为同一人"}">批准</button>
                            <button class="btn btn-sm btn-danger m1c-act" data-i="${idx}" data-act="REJECT" ${!canApproveThis?"disabled":""}>驳回</button>
                          </div>
                        ` : t.status === "待上传退款凭证" ? `
                          <button class="btn btn-sm btn-primary m1c-voucher" data-i="${idx}" ${!canUploadVoucher?"disabled":""}>📎 上传退款凭证</button>
                        ` : `<span style="font-size:12px;color:var(--green-text);font-weight:700;">已闭环归档 ✓</span>`}
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
        document.querySelectorAll(".m1c-act").forEach(b => b.onclick = () => {
          const t = state.tickets[Number(b.dataset.i)];
          const isApprove = b.dataset.act === "APPROVE";
          commitAction({
            title: `${isApprove ? "批准" : "驳回"}售后退款工单 · ${t.id}`,
            danger: !isApprove,
            summary: isApprove ? `申请退款 $${t.refundAmount.toFixed(2)}（不超过原订单实付 $${t.orderAmount.toFixed(2)}）；批准后将进入「待上传退款凭证」状态。` : "驳回后工单直接终止，请填写明确退回原因以便客服向买家解释。",
            confirmText: isApprove ? "确认批准（待传凭证）" : "确认驳回",
            fieldsHtml: `<div class="field"><label>主管审批意见（必填）*</label><input id="m1cNote" class="input" placeholder="${isApprove ? "如：核对照片属实，同意全额退款" : "如：超出售后时效，请与买家协商"}"/></div>`,
            validate: (wrap) => {
              const el = wrap.querySelector("#m1cNote");
              return el.value.trim() ? [] : [{ el, msg: "必须填写主管审批意见" }];
            },
            onConfirm: (wrap) => {
              const note = wrap.querySelector("#m1cNote").value.trim();
              t.approver = ROLE_PERSON_NAMES[state.role];
              t.approveNote = note;
              if (isApprove) {
                t.status = "待上传退款凭证";
                t.refundSyncStatus = "主管已批，待后台手工打款";
                return { toastMsg: `工单 ${t.id} 已批准，请上传手工退款凭证后完成结案` };
              } else {
                t.status = "已驳回";
                t.refundSyncStatus = "已驳回不退款";
                return { toastMsg: `工单 ${t.id} 已驳回`, toastLevel: "warn" };
              }
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} ${isApprove ? "批准" : "驳回"}了售后工单 ${t.id}（金额 $${t.refundAmount.toFixed(2)}），审批意见：${wrap.querySelector("#m1cNote").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m1c-voucher").forEach(b => b.onclick = () => {
          const t = state.tickets[Number(b.dataset.i)];
          commitAction({
            title: `上传手工退款凭证并关闭工单 · ${t.id}`,
            summary: `请填写或上传电商后台手工打款后的流水单号/截图，提交后工单状态变为「已关闭」并同步登记到 M0-2 订单台账。`,
            confirmText: "确认回传并关闭工单",
            fieldsHtml: `
              <div class="field"><label>手工打款流水号或凭证文件名 *</label><input id="vchRef" class="input" placeholder="如：平台退款流水 RF-20261119-8812.jpg"/></div>
              <div class="field"><label>选择截图附件（可选）</label><input id="vchFile" type="file" accept="image/*,.pdf" class="input" style="padding-top:6px;"/></div>
            `,
            validate: (wrap) => {
              const el = wrap.querySelector("#vchRef");
              return el.value.trim() ? [] : [{ el, msg: "请填写手工退款流水号或凭证说明" }];
            },
            onConfirm: (wrap) => {
              const ref = wrap.querySelector("#vchRef").value.trim();
              const f = wrap.querySelector("#vchFile").files?.[0];
              t.voucher = f ? `${ref} (${f.name})` : ref;
              t.status = "已关闭（退款完成）";
              t.refundSyncStatus = "已人工打款并上传凭证";
              const ord = state.orders.find(o => o.orderNo === t.orderNo);
              if (ord) {
                ord.refundSyncStatus = `已退款 $${t.refundAmount.toFixed(2)}`;
                ord.timeline.push({ step: `已完成售后退款 $${t.refundAmount.toFixed(2)} (凭证：${ref})`, time: nowDateTimeStr(), done: true });
              }
              return { toastMsg: `工单 ${t.id} 已关闭！退款结果已同步至 M0-2 订单台账` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 上传了工单 ${t.id} 的手工退款凭证（${wrap.querySelector("#vchRef").value.trim()}），售后工单正式关闭`,
              ok: true
            })
          });
        });
      }
    };
  }

  // ==================== M1-4: 联调测试模拟买家入口 ====================
  if (pageId === "m1d") {
    const canSim = state.role === "mock_buyer" || state.role === "cs" || state.role === "approver";
    const mkSess = state.csSessions.find(s => s.id === "cs3") || state.csSessions[state.csSessions.length - 1];
    return {
      headerActions: [
        { label: "去客服工作台查看处理结果 →", primary: true, onClick: () => goPage("m1a") }
      ],
      html: `
        <div class="banner banner-amber">
          <span><strong>联调测试说明：</strong>本页面仅为<strong>内部规则联调测试入口（绝对不会向真实买家或外部平台发送任何消息）</strong>，用于测试智能客服推荐与敏感词转人工拦截效果。</span>
        </div>

        <div class="grid-3">
          <div class="kpi-card"><div class="kpi-label">联调目标环境</div><div class="kpi-val" style="font-size:18px;color:var(--amber-text)">演示测试专用</div><div class="kpi-sub">与实盘店铺营收完全隔离</div></div>
          <div class="kpi-card highlight-blue"><div class="kpi-label">当前联调消息数</div><div class="kpi-val" style="color:var(--blue-hover)">${mkSess.msgs.length} 条</div><div class="kpi-sub">已同步推送到 M1-1 客服台</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">最近识别结果</div><div class="kpi-val" style="font-size:17px;color:var(--green-text)">${mkSess.status}</div><div class="kpi-sub">可去 M1-1 查看完整应答</div></div>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">发送一条模拟买家咨询或售后投诉</div></div>
            <div class="field"><label>快速选择测试场景</label>
              <select id="mkPresetSel" class="select">
                <option value="Is this waterproof backpack available in stock?">售前商品咨询：询问防泼水与库存</option>
                <option value="My item arrived damaged, I want a refund of $29.90!">售后投诉测试：包含「refund」触发人工转接拦截</option>
              </select>
            </div>
            <div class="field"><label>模拟买家消息内容 *</label><textarea id="mkMsgText" class="textarea">Is this waterproof backpack available in stock?</textarea></div>
            <button class="btn btn-primary" id="mkSendBtn" style="width:100%;justify-content:center;" ${!canSim?"disabled":""}>发送模拟消息并触发规则检测</button>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">联调回执预览（已同步至客服工作台）</div>
              <button class="btn btn-sm btn-primary" id="mkJumpCsBtn">前往客服页核对结果 →</button>
            </div>
            <div style="max-height:260px;overflow-y:auto;">
              ${mkSess.msgs.map(m => `
                <div class="chat-bubble ${m.who==="buyer"?"user":"assistant"}">
                  <div>${m.text}</div>
                  <div class="chat-trans">${m.trans}</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("mkPresetSel").onchange = (e) => { document.getElementById("mkMsgText").value = e.target.value; };
        document.getElementById("mkJumpCsBtn").onclick = () => { state.csActiveId = mkSess.id; goPage("m1a"); };
        document.getElementById("mkSendBtn").onclick = () => {
          const txt = document.getElementById("mkMsgText").value.trim();
          if (!txt) { toast("请输入模拟买家消息内容", "error"); return; }
          const isRefund = /refund|damage|complaint|return/i.test(txt);
          mkSess.msgs.push({ who: "buyer", text: txt, trans: "（联调测试买家消息）" });
          if (isRefund) {
            mkSess.status = "待人工接管";
            mkSess.msgs.push({ who: "ai", text: "拦截回执：检测到退款/破损关键词，禁止智能助手直接承诺赔付，已标记为「待人工接管」。", trans: "请到 M1-1 客服工作台核实处理" });
          } else {
            mkSess.status = "智能自动接待";
            mkSess.msgs.push({ who: "ai", text: "推荐回执：已在导购商品库匹配到「轻量通勤双肩包 ($29.90)」，生成双语推荐草稿。", trans: "可到 M1-1 查看自动推荐结果" });
          }
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 发送了联调测试消息，系统判定为「${mkSess.status}」`, ok: true });
          rerender();
          toast("模拟消息已发送并同步到 M1-1 客服工作台", "success");
        };
      }
    };
  }

  // ==================== M2-1: 经营驾驶舱草稿版与正式版发布 ====================
  if (pageId === "m2a") {
    const canDesign = state.role === "planner" || state.role === "bi_analyst" || state.role === "approver";
    const stats = computeLiveBusinessStats();
    const resolveWidgetVal = (w) => {
      if (w.metricKey === "gmv") return `$${stats.gmv.toLocaleString()}`;
      if (w.metricKey === "net_profit") return `$${stats.netProfit.toLocaleString()}`;
      if (w.metricKey === "ad_spend") return `$${stats.adSpend.toLocaleString()}`;
      if (w.metricKey === "orders_count") return `${stats.ordersCnt.toLocaleString()} 单`;
      return w.val;
    };

    return {
      headerActions: [
        { label: "预览正式经营大屏 →", primary: false, onClick: () => goPage("m2b") },
        {
          label: "↺ 恢复上一正式版", primary: false,
          disabled: !canDesign || state.biPublishHistory.length < 2,
          disabledTitle: state.biPublishHistory.length < 2 ? "当前暂无更早的已发布历史版本" : "需要业务运营或主管权限",
          onClick: () => {
            const prevVer = state.biPublishHistory[1];
            commitAction({
              title: `恢复驾驶舱至上一正式版本 (${prevVer.ver})`,
              danger: true,
              summary: `将把线上「正式经营大屏」回退为 ${prevVer.ver}（发布于 ${prevVer.time}，操作人：${prevVer.by}），草稿版保留不变。`,
              confirmText: "确认恢复上一版",
              onConfirm: () => {
                state.biPublishedVersion = prevVer.ver;
                state.biPublishedAt = `${nowDateTimeStr()} (已恢复至 ${prevVer.ver})`;
                state.biPublishedWidgets = JSON.parse(JSON.stringify(prevVer.widgets));
                return { toastMsg: `正式大屏已恢复至 ${prevVer.ver}` };
              },
              audit: { sentence: `${ROLE_PERSON_NAMES[state.role]} 将正式经营大屏恢复为历史版本 ${prevVer.ver}`, ok: true }
            });
          }
        },
        {
          label: "🚀 对比差异并发布正式版", primary: true,
          disabled: !canDesign,
          onClick: () => {
            const draftList = state.biWidgets.map(w => `${w.title} (${resolveWidgetVal(w)})`);
            const pubList = state.biPublishedWidgets.map(w => `${w.title} (${resolveWidgetVal(w)})`);
            commitAction({
              title: `发布驾驶舱正式版（${state.biDraftVersion} → 新正式版）`,
              summary: "发布前请并排核对当前「正式版」与即将覆盖的「草稿版」卡片差异，确认无误后再发布给管理层浏览。",
              confirmText: "确认发布正式版",
              fieldsHtml: `
                <div class="diff-grid" style="margin-bottom:12px;">
                  <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;">
                    <strong style="font-size:12.5px;">当前线上正式版 (${state.biPublishedVersion})</strong>
                    <div style="font-size:12px;margin-top:6px;line-height:1.7;">${pubList.map(x => `• ${x}`).join("<br/>")}</div>
                  </div>
                  <div style="background:var(--blue-light);border:1px solid var(--blue-border);border-radius:8px;padding:10px;">
                    <strong style="font-size:12.5px;color:var(--blue-hover);">即将发布的草稿版 (${state.biDraftVersion})</strong>
                    <div style="font-size:12px;margin-top:6px;line-height:1.7;">${draftList.map(x => `• ${x}`).join("<br/>")}</div>
                  </div>
                </div>
                <div class="field"><label>本次发布说明 *</label><input id="biPubNote" class="input" value="补充最新核心经营卡片并发布管理层查看"/></div>
              `,
              validate: (wrap) => {
                const el = wrap.querySelector("#biPubNote");
                return el.value.trim() ? [] : [{ el, msg: "请填写本次发布说明" }];
              },
              onConfirm: (wrap) => {
                const nextVerNum = (Number((state.biPublishedVersion.match(/\d+\.\d+/) || ["1.2"])[0]) + 0.1).toFixed(1);
                const nextVer = `正式 v${nextVerNum}`;
                state.biPublishedWidgets = state.biWidgets.map(w => ({
                  title: w.title, metricKey: w.metricKey, val: resolveWidgetVal(w), sub: w.scope, scope: w.scope
                }));
                state.biPublishedVersion = nextVer;
                state.biPublishedAt = nowDateTimeStr();
                state.biPublishHistory.unshift({
                  ver: nextVer, time: state.biPublishedAt, by: ROLE_PERSON_NAMES[state.role],
                  note: wrap.querySelector("#biPubNote").value.trim(),
                  widgets: JSON.parse(JSON.stringify(state.biPublishedWidgets))
                });
                return { toastMsg: `驾驶舱已发布为 ${nextVer}，管理层可在 M2-2 查看最新大屏` };
              },
              audit: (wrap) => ({
                sentence: `${ROLE_PERSON_NAMES[state.role]} 对比版本差异后发布了经营驾驶舱新正式版，说明：${wrap.querySelector("#biPubNote").value.trim()}`,
                ok: true
              })
            });
          }
        }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>草稿与正式版双轨隔离：</strong>您在当前<strong>${state.biDraftVersion}</strong>里的增删改动不会立即影响管理层正在看的<strong>${state.biPublishedVersion}</strong>大屏。<strong>数据来源：</strong>实时关联 M0 实盘订单与 M3 指标口径。</span>
        </div>

        <div class="split-left-form">
          <div class="card">
            <div class="card-header"><div class="card-title">可添加指标组件库</div></div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${[
                { title: "实盘订单总数", metricKey: "orders_count", scope: "全部实盘店铺", updatedAt: "实时联动订单", color: "var(--purple-text)" },
                { title: "平均客单价", metricKey: "aov", val: "$" + stats.aov, scope: "近30天实盘均值", updatedAt: "实时计算", color: "var(--blue-hover)" },
              ].map((cand, ci) => `
                <div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <strong style="font-size:13px;">${cand.title}</strong>
                    <div style="font-size:12px;color:var(--text-soft);">${cand.scope}</div>
                  </div>
                  <button class="btn btn-sm btn-primary m2-add-w" data-ci="${ci}" ${!canDesign?"disabled":""}>+ 加入草稿</button>
                </div>
              `).join("")}
            </div>
            <hr style="border:none;border-top:1px solid var(--border);margin:14px 0;"/>
            <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">最近发布版本记录（支持回滚）</div>
            ${state.biPublishHistory.slice(0, 3).map(h => `
              <div style="font-size:12px;color:var(--text-muted);padding:4px 0;border-bottom:1px dashed #e2e8f0;">
                <strong>${h.ver}</strong> · ${h.by} · ${h.time}<div style="color:var(--text-soft);">${h.note}</div>
              </div>
            `).join("")}
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">当前草稿版画布（${state.biDraftVersion} · 共 ${state.biWidgets.length} 个指标卡）</div>
              <span class="pill p-amber">仅草稿态，未发布前不影响正式大屏</span>
            </div>
            <div class="grid-2">
              ${state.biWidgets.map((w, i) => `
                <div class="kpi-card ${state.biSelectedIdx===i?"highlight-blue":""}" style="cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="kpi-label">${w.title}</span>
                    <button class="btn btn-sm btn-danger m2-del-w" data-i="${i}" ${!canDesign?"disabled":""}>移除</button>
                  </div>
                  <div class="kpi-val" style="color:${w.color};margin:6px 0;">${resolveWidgetVal(w)}</div>
                  <div style="font-size:12px;color:var(--text-soft);">来源：${w.scope} · 更新：${w.updatedAt || "实时"}</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `,
      bind: () => {
        const cands = [
          { title: "实盘订单总数", metricKey: "orders_count", val: `${stats.ordersCnt} 单`, scope: "全部实盘店铺", updatedAt: "实时联动订单", color: "var(--purple-text)" },
          { title: "平均客单价", metricKey: "aov", val: "$" + stats.aov, scope: "近30天实盘均值", updatedAt: "实时计算", color: "var(--blue-hover)" },
        ];
        document.querySelectorAll(".m2-add-w").forEach(b => b.onclick = () => {
          const c = cands[Number(b.dataset.ci)];
          if (state.biWidgets.some(w => w.title === c.title)) { toast("草稿画布已包含该指标卡片", "warn"); return; }
          state.biWidgets.push({ ...c });
          rerender();
          toast(`已将「${c.title}」加入草稿版`);
        });
        document.querySelectorAll(".m2-del-w").forEach(b => b.onclick = () => {
          state.biWidgets.splice(Number(b.dataset.i), 1);
          rerender();
          toast("已从草稿画布移除该卡片（不影响线上正式版）");
        });
      }
    };
  }

  // ==================== M2-2: 正式经营大屏浏览与异常下钻 ====================
  if (pageId === "m2b") {
    const stats = computeLiveBusinessStats();
    const resolvePublishedVal = (w) => {
      if (w.metricKey === "gmv") return `$${stats.gmv.toLocaleString()}`;
      if (w.metricKey === "net_profit") return `$${stats.netProfit.toLocaleString()}`;
      if (w.metricKey === "ad_spend") return `$${stats.adSpend.toLocaleString()}`;
      if (w.metricKey === "orders_count") return `${stats.ordersCnt.toLocaleString()} 单`;
      return w.val;
    };

    return {
      headerActions: [
        { label: "↻ 刷新最新数据", primary: false, onClick: () => {
          state.lastDataRefreshAt = nowTimeStr();
          state.lastDataRefreshTs = Date.now();
          rerender();
          toast(`经营大屏已刷新至 ${state.lastDataRefreshAt}`, "success");
        }},
        { label: "去调整驾驶舱布局 →", primary: true, onClick: () => goPage("m2a") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>正式经营大屏（${state.biPublishedVersion}）：</strong>发布于 ${state.biPublishedAt} ｜ <strong>数据截至时间：${state.lastDataRefreshAt}</strong>（点击任意带有「追问明细」提示的异常/核心卡片，可直达智能问数分析原因）。</span>
        </div>

        <div class="grid-4">
          ${state.biPublishedWidgets.map(w => {
            const isAlert = w.metricKey === "ad_spend";
            return `
              <div class="kpi-card ${isAlert?"highlight-amber":"highlight-blue"} m2b-drill" data-title="${w.title}" style="cursor:pointer;" title="点击进入智能问数追查明细">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="kpi-label">${w.title}</span>
                  <span class="pill ${isAlert?"p-amber":"p-blue"}">${isAlert?"异常波动 · 点击追问":"点击追问明细 →"}</span>
                </div>
                <div class="kpi-val" style="margin:6px 0;color:${isAlert?"var(--amber-text)":"var(--blue-hover)"}">${resolvePublishedVal(w)}</div>
                <div class="kpi-sub">${w.sub} ｜ 来源：${w.scope || "全部实盘店铺"}</div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="grid-2">
          <div class="card m2b-drill" data-title="低库存预警商品有哪些？" style="cursor:pointer;">
            <div class="card-header">
              <div class="card-title">⚠️ 供应链库存预警（点击跳转智能问数排查缺口）</div>
              <span class="pill p-red">${stats.realLowStocks.length} 项低于安全线</span>
            </div>
            ${stats.realLowStocks.map(i => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <span><strong>${i.sku} · ${i.name}</strong> (${i.whName})</span>
                <span style="color:var(--red-text);font-weight:700;">可售 ${i.avail} / 安全 ${i.safety} 件</span>
              </div>
            `).join("")}
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">经营健康摘要（实时联动计算）</div>
              <span class="pill p-green">实盘数据口径一致</span>
            </div>
            <div class="formula-box" style="line-height:1.8;">
              • <strong>毛利与净利率：</strong>实盘总销售额 $${stats.gmv.toLocaleString()}，净利润 $${stats.netProfit.toLocaleString()}（净利率 <strong>${stats.marginPct}%</strong>）<br/>
              • <strong>广告花费占比：</strong>广告投入 $${stats.adSpend.toLocaleString()}，占总销售额 <strong>${stats.acosPct}%</strong><br/>
              • <strong>客单价表现：</strong>共 ${stats.ordersCnt.toLocaleString()} 单，平均每单 <strong>$${stats.aov}</strong>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m2b-drill").forEach(el => el.onclick = () => {
          const q = el.dataset.title.includes("广告")
            ? "各平台广告花费占比是多少？"
            : el.dataset.title.includes("库存")
            ? "当前哪些仓库商品低于安全库存预警？"
            : `请帮我分析${el.dataset.title}的实时汇总口径与最新金额`;
          state.qaPendingQuestion = q;
          goPage("m3b");
        });
      }
    };
  }

  // ==================== M3-1: 经营指标口径与定时更新 ====================
  if (pageId === "m3a") {
    const canEditBi = state.role === "bi_analyst" || state.role === "approver" || state.role === "manager";
    return {
      headerActions: [
        { label: "进入智能问答助手 →", primary: true, onClick: () => goPage("m3b") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>统一管理核心经营指标的计算口径与定时更新任务。外部数据源尚未接入时状态会诚实显示「数据源未响应」，可联系管理员或点击「立即更新」重试。</span>
        </div>

        ${renderAsyncBox("m3_sync")}

        <div class="grid-3">
          <div class="kpi-card highlight-blue"><div class="kpi-label">已登记经营指标</div><div class="kpi-val" style="color:var(--blue-hover)">${state.qaBindings.length} 项</div><div class="kpi-sub">驾驶舱与智能问数共用口径</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">更新正常指标</div><div class="kpi-val" style="color:var(--green-text)">${state.qaBindings.filter(b=>b.status==="更新正常").length} 项</div><div class="kpi-sub">按设定频率自动刷新</div></div>
          <div class="kpi-card ${state.qaBindings.some(b=>b.status!=="更新正常")?"highlight-amber":""}"><div class="kpi-label">数据源未响应指标</div><div class="kpi-val" style="color:var(--amber-text)">${state.qaBindings.filter(b=>b.status!=="更新正常").length} 项</div><div class="kpi-sub">待配置外部接口地址后重连</div></div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">经营指标口径与定时更新状态</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>指标名称与业务口径</th><th>取数方式</th><th>更新频率</th><th>最近成功时间</th><th>下次更新时间</th><th>当前最新值</th><th>更新状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.qaBindings.map((b, i) => `
                  <tr>
                    <td>
                      <strong>${b.name}</strong>
                      <div style="font-size:12px;color:var(--text-soft);">口径：${b.formula}</div>
                    </td>
                    <td class="nowrap">${b.kind} · ${b.platform}</td>
                    <td class="nowrap">${b.cron}</td>
                    <td class="nowrap">${b.lastRun}</td>
                    <td class="nowrap">${b.nextRun}</td>
                    <td class="nowrap"><strong>${b.val}</strong></td>
                    <td>
                      <span class="pill ${b.status==="更新正常"?"p-green":"p-red"}">${b.status}</span>
                      ${b.errMsg ? `<div style="font-size:12px;color:var(--red-text);margin-top:3px;">${b.errMsg}</div>` : ""}
                    </td>
                    <td class="nowrap"><button class="btn btn-sm btn-primary m3a-run" data-i="${i}" ${!canEditBi?"disabled":""}>立即更新</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.querySelectorAll(".m3a-run").forEach(b => b.onclick = () => {
          const item = state.qaBindings[Number(b.dataset.i)];
          const isFail = item.kind === "外部接口取数" && !BACKEND_SERVICE_URL;
          runAsyncTask("m3_sync", {
            label: `立即更新指标 · ${item.name}`,
            steps: ["检查数据源连通性", "按业务口径汇总最新订单事实", "刷新指标快照时间"],
            durationMs: 900,
            shouldFail: isFail,
            failReason: "外部广告数据源未响应（尚未接入外部接口），请检查网络或配置后点击重试。",
            onFail: () => { item.status = "数据源未响应"; },
            onSuccess: () => {
              item.status = "更新正常";
              item.lastRun = nowTimeStr();
              item.errMsg = "";
              return { summary: `指标「${item.name}」已更新至 ${item.lastRun}`, toastMsg: `「${item.name}」已立即更新` };
            }
          });
        });
      }
    };
  }

  // ==================== M3-2: 经营智能问答助手（纯只读实时计算，无SQL黑话） ====================
  if (pageId === "m3b") {
    const stats = computeLiveBusinessStats();

    function answerBusinessQuestion(q) {
      const lowQ = q.toLowerCase();
      if (/update|delete|drop|insert|alter|修改|删除|调价|改库存|改成本/i.test(lowQ)) {
        appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 在智能问数中发送了涉及修改数据的指令「${q}」，系统已触发只读守卫拦截`, ok: false });
        return {
          text: "拦截提示：智能问答助手仅支持「只读查数」，严禁直接修改订单、调整价格或改写库存！如需调整请前往对应业务审批页面操作。",
          note: "安全说明：本次操作拦截已记录至 M8-2 审计台账。",
          queryDesc: "安全拦截：拒绝修改类请求，未改动任何业务数据",
          blocked: true
        };
      }
      if (/库存|预警|缺货|仓/i.test(lowQ)) {
        const list = stats.realLowStocks.map(i => `${i.sku} ${i.name}（${i.whName}，当前仅 ${i.avail} 件 / 安全水位 ${i.safety} 件）`).join("；");
        return {
          text: `当前实盘店铺共有 ${stats.realLowStocks.length} 项库存低于安全水位：${list || "暂无低库存预警"}。`,
          note: "统计口径：实时读取 M0-3 分店分仓独立库存台账（已排除演示店铺）。",
          queryDesc: "查询条件：店铺=全部实盘店 ｜ 指标=当前可售与安全水位对比 ｜ 状态=仅只读查询"
        };
      }
      if (/广告|acos|占比/i.test(lowQ)) {
        return {
          text: `近 30 天实盘店铺广告花费总计 $${stats.adSpend.toLocaleString()}，占总销售额的 ${stats.acosPct}%，处于 15% 安全水位线以内。`,
          note: "统计口径：按广告花费 ÷ 实盘总销售额计算；其中亚马逊外部广告细项为参考基线值。",
          queryDesc: "查询条件：时间=近 30 天 ｜ 店铺=全部实盘店 ｜ 口径=广告花费与占比"
        };
      }
      if (/单|客单|订单/i.test(lowQ)) {
        return {
          text: `实盘订单共 ${stats.ordersCnt.toLocaleString()} 单，平均客单价 $${stats.aov}（演示沙盒订单已自动剔除）。`,
          note: "统计口径：只汇总实盘已付款订单（若刚在 M0-1 同步新订单，此处数字会立即增加）。",
          queryDesc: "查询条件：店铺=全部实盘店 ｜ 订单状态=已付款（含已发货/签收） ｜ 模式=只读查数"
        };
      }
      return {
        text: `全部实盘店铺近 30 天总销售额 $${stats.gmv.toLocaleString()}，净利润 $${stats.netProfit.toLocaleString()}（净利率 ${stats.marginPct}%）。`,
        note: "统计口径：直接基于当前实盘订单台账实时汇总计算，演示测试店铺订单不计入。",
        queryDesc: "查询条件：店铺=全部实盘店 ｜ 时间=近 30 天 ｜ 口径=实盘总销售额与净利润"
      };
    }

    const prefill = state.qaPendingQuestion || "";
    if (state.qaPendingQuestion) state.qaPendingQuestion = "";

    return {
      headerActions: [
        { label: "← 查看指标定时更新", primary: false, onClick: () => goPage("m3a") },
        { label: "返回正式经营大屏 →", primary: true, onClick: () => goPage("m2b") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>使用说明：</strong>您可以像问财务同事一样直接输入业务问题。本助手<strong>只查数、不改数据</strong>，多币种不会强行混加，每次回答均附带统计口径说明。</span>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
          <div style="background:#0f172a;color:#fff;padding:13px 18px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>经营智能问答助手（实时查数引擎）</strong>
              <div style="font-size:12px;color:#cbd5e1;margin-top:2px;">实时读取最新实盘订单与分店库存 · 只读安全守卫在线</div>
            </div>
            <span class="pill p-green">仅限只读查询</span>
          </div>

          <div style="padding:16px 18px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              ${["近30天总销售额和净利润是多少？", "当前哪些仓库商品低于安全库存预警？", "各平台广告花费占比是多少？", "一共有多少实盘订单和平均客单价？", "请帮我直接删除昨天所有订单"].map(q => `
                <button class="btn btn-sm qa-preset" data-q="${q}">${q.includes("删除") ? "🛡️ 测试只读拦截：" + q.slice(4) : q}</button>
              `).join("")}
            </div>

            <div style="max-height:360px;overflow-y:auto;margin-bottom:12px;">
              ${state.qaChat.map((m, idx) => `
                <div class="chat-bubble ${m.role==="user"?"user":"assistant"}" style="${m.blocked?"background:var(--red-bg);border-color:#fca5a5;color:var(--red-text);":""}">
                  <div style="font-weight:${m.role==="user"?600:500};">${m.text}</div>
                  ${m.note ? `<div style="font-size:12px;color:var(--text-soft);margin-top:5px;">${m.note}</div>` : ""}
                  ${m.queryDesc ? `<div style="font-size:12px;background:#ffffff;border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-top:6px;color:var(--text-muted);">${m.queryDesc}</div>` : ""}
                  ${m.role==="assistant" && !m.blocked ? `
                    <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
                      <button class="btn btn-sm qa-fb" data-idx="${idx}" data-val="UP" style="${m.feedback==="UP"?"border-color:var(--green);color:var(--green-text);font-weight:700;":""}">👍 有帮助</button>
                      <button class="btn btn-sm qa-fb" data-idx="${idx}" data-val="DOWN" style="${m.feedback==="DOWN"?"border-color:var(--red);color:var(--red-text);font-weight:700;":""}">👎 没帮助</button>
                    </div>
                  ` : ""}
                </div>
              `).join("")}
            </div>

            <div style="display:flex;gap:8px;">
              <input id="qaInput" class="input" value="${prefill}" placeholder="输入您的经营问题（例如：近30天净利润是多少、美西仓还有多少库存）…" />
              <button class="btn btn-primary" id="qaSendBtn">发送提问</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        const ask = (qStr) => {
          const q = (qStr ?? document.getElementById("qaInput").value).trim();
          if (!q) { toast("请输入经营问题", "error"); return; }
          state.qaChat.push({ role: "user", text: q });
          const ans = answerBusinessQuestion(q);
          state.qaChat.push({ role: "assistant", ...ans, feedback: null });
          rerender();
        };
        document.getElementById("qaSendBtn").onclick = () => ask();
        document.getElementById("qaInput").onkeydown = (e) => { if (e.key === "Enter") ask(); };
        document.querySelectorAll(".qa-preset").forEach(b => b.onclick = () => ask(b.dataset.q));
        document.querySelectorAll(".qa-fb").forEach(b => b.onclick = () => {
          const item = state.qaChat[Number(b.dataset.idx)];
          item.feedback = b.dataset.val;
          appendAuditLog(state, { sentence: `${ROLE_PERSON_NAMES[state.role]} 对智能问数回答评价为「${b.dataset.val === "UP" ? "有帮助" : "没帮助"}」`, ok: true });
          rerender();
          toast(b.dataset.val === "UP" ? "感谢您的正面反馈" : "已记录您的反馈，数据分析师将核查该指标口径");
        });
      }
    };
  }

  return null;
}
