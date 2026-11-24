import {
  BACKEND_SERVICE_URL, ROLE_PERSON_NAMES, getProductImg, genDocId, nowDateTimeStr, nowTimeStr, relTimeLabel, appendAuditLog,
  daysOffsetDate, calcProductMargin, calcInvCoverage, evalShopHealth
} from "./state.js";

function daysUntilDateStr(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 999;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export function renderM0_M3(pageId, state, helpers) {
  const { toast, goPage, openModal, openDrawer, closeDetailDrawer, rerender, commitAction, runAsyncTask, renderAsyncBox, computeLiveBusinessStats, record403 } = helpers;

  // ==================== M0-1: 店铺授权管理 ====================
  if (pageId === "m0a") {
    const canManageShop = state.role === "manager" || state.role === "approver";
    const stats = computeLiveBusinessStats();
    const realShops = state.shops.filter(s => s.mode === "REAL");
    const realCount = realShops.length;
    const healthyCount = state.shops.filter(s => !evalShopHealth(s).urgent && s.mode === "REAL").length;
    const pendingShops = state.shops.filter(s => evalShopHealth(s).urgent);
    const issueCount = pendingShops.length;

    const handleSyncShop = (s) => {
      runAsyncTask("m0_shop_conn", {
        label: `正在同步「${s.name}」最新订单`,
        steps: ["校验店铺连接状态与授权有效期", "批量拉取近期未入账订单并自动去重", "汇总新增 / 去重 / 异常统计并刷新经营口径"],
        durationMs: 1050,
        onSuccess: () => {
          s.lastSync = nowDateTimeStr();
          s.lastSyncTs = Date.now();
          s.syncFailCount = 0;
          s.zeroOrderDays = 0;
          const expDays = daysUntilDateStr(s.authExpireDate);
          if (s.mode === "REAL") {
            s.health = expDays <= 7 ? "授权即将过期" : "连接正常";
            s.errNote = expDays <= 7 ? `授权凭证将于 ${expDays} 天后过期，请及时续期` : "";
          } else {
            s.health = "仅演示环境";
            s.errNote = "";
          }
          state.lastDataRefreshAt = nowTimeStr();
          state.lastDataRefreshTs = Date.now();

          const batchSize = 5 + Math.floor(Math.random() * 4);
          const dupCount = 1 + Math.floor(Math.random() * 2);
          const failCount = s.platform === "LAZADA" ? 1 : 0;
          const addedCount = batchSize - failCount;

          const sampleBuyers = [
            ["Liam Johnson", "美国 · 旧金山"], ["Sophia Garcia", "美国 · 休斯顿"],
            ["Kittipong W.", "泰国 · 曼谷"], ["Nurul Huda", "马来 · 吉隆坡"],
            ["Charlotte Evans", "英国 · 利兹"], ["Darren Koh", "新加坡 · 碧山"],
            ["Ethan Brooks", "美国 · 丹佛"], ["Hana Lim", "新加坡 · 榜鹅"]
          ];
          const pricedSkus = state.masterProducts;
          const currSym = s.currency === "THB" ? "฿" : s.currency === "MYR" ? "RM" : s.currency === "GBP" ? "£" : s.currency === "SGD" ? "S$" : "$";
          const fx = s.currency === "THB" ? 34.5 : s.currency === "MYR" ? 4.45 : s.currency === "GBP" ? 0.78 : s.currency === "SGD" ? 1.34 : 1;

          for (let k = 0; k < addedCount; k++) {
            const p = pricedSkus[(k + Math.floor(Math.random() * pricedSkus.length)) % pricedSkus.length];
            const [bName, bCity] = sampleBuyers[(k + Math.floor(Math.random() * sampleBuyers.length)) % sampleBuyers.length];
            const qty = k % 3 === 0 ? 2 : 1;
            const usdAmt = +(p.salePriceUsd * qty).toFixed(2);
            const localAmt = `${currSym}${(usdAmt * fx).toFixed(s.currency === "THB" || s.currency === "MYR" ? 0 : 2)}`;
            const ordNo = genDocId(s.mode === "MOCK" ? "DEMO" : "ORD");
            const trkNo = s.mode === "MOCK" ? `DEMO-TRK-${Math.floor(1000+Math.random()*9000)}` : `TRK${Math.floor(10000000+Math.random()*89999999)}`;
            state.orders.unshift({
              orderNo: ordNo, shop: s.name, mode: s.mode,
              buyer: s.mode === "MOCK" ? `${bName} (演示)` : bName,
              countryCity: s.mode === "MOCK" ? "测试沙盒 · 虚拟地址" : bCity,
              sku: p.sku, productName: p.name, qty,
              amountLocal: localAmt, amountUsd: usdAmt,
              amountDisplay: s.mode === "MOCK" ? `${localAmt} (仅演示)` : (s.currency === "USD" ? `$${usdAmt.toFixed(2)}` : `${localAmt} ($${usdAmt.toFixed(2)})`),
              status: s.mode === "MOCK" ? "仅演示不计营收" : (k % 2 === 0 ? "已付款" : "已发货"),
              trackingNo: trkNo,
              payStatus: s.mode === "MOCK" ? "沙盒模拟" : "已支付",
              source: s.mode === "MOCK" ? "联调测试" : (k % 2 === 0 ? "广告流量" : "自然流量"),
              disputeStatus: "无纠纷",
              refundSyncStatus: s.mode === "MOCK" ? "仅演示" : "无退款",
              orderedAt: nowDateTimeStr(),
              historical: false,
              timeline: [
                { step: s.mode === "MOCK" ? "演示同步生成测试订单（不计真实营收）" : "买家付款完成并同步入账", time: nowDateTimeStr(), done: true },
                { step: s.mode === "MOCK" ? "沙盒环境自动标记隔离" : "待仓库拣货交运", time: "处理中", done: false },
              ]
            });
          }
          const statMsg = `本次同步完成：新增 ${addedCount} 笔 / 去重 ${dupCount} 笔 / 失败 ${failCount} 笔`;
          if (s.mode === "MOCK") {
            return {
              summary: `${statMsg}（演示测试店订单已打标隔离，绝不计入实盘营收）`,
              toastMsg: `演示店同步完成：新增 ${addedCount} 笔（不计营收）`,
              toastLevel: "warn"
            };
          }
          return {
            summary: `${statMsg}（实盘订单已写入 M0-2 订单台账，M2/M3 总销售额已同步刷新）`,
            toastMsg: `${s.name}：新增 ${addedCount} 笔 / 去重 ${dupCount} 笔 / 失败 ${failCount} 笔`
          };
        }
      });
    };

    const handleReauthShop = (s) => {
      runAsyncTask("m0_shop_conn", {
        label: `正在重新授权「${s.name}」`,
        steps: ["跳转平台官方授权确认页", "刷新店铺授权有效期（+90天）", "恢复正常订单与库存同步"],
        durationMs: 900,
        onSuccess: () => {
          s.health = s.mode === "REAL" ? "连接正常" : "仅演示环境";
          s.errNote = "";
          s.syncFailCount = 0;
          if (s.mode === "REAL") s.authExpireDate = daysOffsetDate(90);
          s.lastSync = nowDateTimeStr();
          s.lastSyncTs = Date.now();
          return { summary: `「${s.name}」已重新授权，授权有效期已续期至 ${s.authExpireDate}`, toastMsg: `「${s.name}」重新授权成功` };
        }
      });
    };

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
              summary: "说明：当前为纯前端演示模式（外部后台服务未接入），此处将为您演示「正在连接 → 成功或失败原因」完整过程，并严格区分实盘店铺与演示测试店。",
              confirmText: "发起店铺连接",
              fieldsHtml: `
                <div class="field"><label>店铺名称 *</label><input id="newShopName" class="input" placeholder="如：Amazon 英国站"/></div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>所属电商平台 *</label><select id="newShopPlat" class="select"><option value="AMAZON">Amazon</option><option value="TIKTOK">TikTok Shop</option><option value="SHOPEE">Shopee</option><option value="LAZADA">Lazada</option><option value="EBAY">eBay</option></select></div>
                  <div class="field"><label>销售国家/站点 *</label><select id="newShopReg" class="select"><option value="US">美国站 (US)</option><option value="UK">英国站 (UK)</option><option value="TH">泰国站 (TH)</option><option value="MY">马来站 (MY)</option><option value="SG">新加坡站 (SG)</option></select></div>
                </div>
                <div class="grid-2" style="gap:10px;">
                  <div class="field"><label>主力品类 *</label><input id="newShopCat" class="input" value="家居收纳 / 居家小电"/></div>
                  <div class="field"><label>店铺负责人 *</label><input id="newShopOwner" class="input" value="${ROLE_PERSON_NAMES[state.role]}"/></div>
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
                const errs = [];
                const nameEl = wrap.querySelector("#newShopName");
                const catEl = wrap.querySelector("#newShopCat");
                if (!nameEl.value.trim()) errs.push({ el: nameEl, msg: "请填写店铺名称" });
                if (!catEl.value.trim()) errs.push({ el: catEl, msg: "请填写主力品类" });
                return errs;
              },
              onConfirm: (wrap) => {
                const name = wrap.querySelector("#newShopName").value.trim();
                const platform = wrap.querySelector("#newShopPlat").value;
                const region = wrap.querySelector("#newShopReg").value;
                const mainCategory = wrap.querySelector("#newShopCat").value.trim();
                const owner = wrap.querySelector("#newShopOwner").value.trim() || ROLE_PERSON_NAMES[state.role];
                const mode = wrap.querySelector("#newShopMode").value;
                const simFail = wrap.querySelector("#newShopSimResult").value === "FAIL";
                const maskCode = String(Math.floor(1000 + Math.random() * 8999));
                const currMap = { US: "USD", UK: "GBP", TH: "THB", MY: "MYR", SG: "SGD" };
                const tzMap = { US: "UTC-8 (美西)", UK: "UTC+0 (伦敦)", TH: "UTC+7 (曼谷)", MY: "UTC+8 (吉隆坡)", SG: "UTC+8 (新加坡)" };

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
                      monthlyGmv: 0, orderCount: 0,
                      mainCategory, owner,
                      currency: currMap[region] || "USD",
                      timezone: tzMap[region] || "UTC+8",
                      authExpireDate: mode === "REAL" ? daysOffsetDate(90) : "长期有效(沙盒)",
                      nextSyncAt: mode === "REAL" ? "每15分钟" : "手动联调",
                      syncFailCount: 0,
                      openedAt: daysOffsetDate(0),
                      perfScore: 95, disputeRate7d: 0.2, returnRate: 1.0, lateShipRate: 0.3, policyViolations: 0, zeroOrderDays: 0
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
          <span><strong>页面定位：</strong>集中管理多平台跨境店铺授权健康度、经营绩效指标与订单同步流水；店铺销售额直接由 M0-2 实盘订单台账实时汇总（与 M2/M3 完全一致）。<strong>数据来源：</strong>各店铺实时连接状态（最近核对：${state.lastDataRefreshAt}）。</span>
        </div>

        ${renderAsyncBox("m0_shop_conn")}

        ${pendingShops.length > 0 ? `
          <div class="card" style="border-color:#fca5a5;background:#fef2f2;">
            <div class="card-header">
              <div class="card-title" style="color:var(--red-text);">🚨 店铺连接与经营待处理事项（${pendingShops.length} 家实盘店触发预警）</div>
              <span class="pill p-red">系统主动预警</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${pendingShops.map(ps => {
                const idx = state.shops.indexOf(ps);
                const h = evalShopHealth(ps);
                return `
                  <div style="background:#fff;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div>
                      <strong>${ps.name}</strong>（${ps.platform} · ${ps.region} · 负责人：${ps.owner}）
                      <span class="pill ${h.pill}" style="margin-left:6px;">${h.badge}</span>
                      <div style="font-size:12.5px;color:var(--red-text);margin-top:3px;">触发依据：${h.triggerText}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                      <button class="btn btn-sm btn-primary m0-reauth-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>🔑 一键重新授权</button>
                      <button class="btn btn-sm m0-sync-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>↻ 重试同步</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <div class="grid-4">
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">已接入店铺总数</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.shops.length} 家</div>
            <div class="kpi-sub">实盘店 ${realCount} 家 · 演示测试店 ${state.shops.length - realCount} 家</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">连接与经营健康店</div>
            <div class="kpi-val" style="color:var(--green-text)">${healthyCount} 家</div>
            <div class="kpi-sub">可稳定自动拉取订单与库存</div>
          </div>
          <div class="kpi-card ${issueCount > 0 ? "highlight-red" : ""}">
            <div class="kpi-label">预警 / 同步异常店</div>
            <div class="kpi-val" style="color:${issueCount > 0 ? "var(--red-text)" : "var(--text-dark)"}">${issueCount} 家</div>
            <div class="kpi-sub">${issueCount > 0 ? "含限期授权、同步失败或绩效预警" : "当前全部实盘店健康"}</div>
          </div>
          <div class="kpi-card highlight-purple">
            <div class="kpi-label">实盘台账累计 GMV</div>
            <div class="kpi-val" style="color:var(--purple-text)">$${stats.gmv.toLocaleString()}</div>
            <div class="kpi-sub">共 ${stats.ordersCnt} 笔实盘订单（与 M2/M3 同源）</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">多平台已接入店铺明细与经营健康评估（异常店已置顶标红预警）</div>
            <span class="pill ${canManageShop ? "p-green" : "p-amber"}">${canManageShop ? "已解锁管理权限" : "当前岗位仅可查看状态"}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>店铺名称 / 开店日</th>
                  <th>平台 / 站点 / 口径</th>
                  <th>实算 GMV / 订单数</th>
                  <th>主力品类 / 负责人</th>
                  <th>币种 / 时区</th>
                  <th>授权到期日</th>
                  <th>经营健康与权限</th>
                  <th>最近同步 / 下次计划</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${[...state.shops].sort((a, b) => (evalShopHealth(b).urgent ? 1 : 0) - (evalShopHealth(a).urgent ? 1 : 0)).map(s => {
                  const idx = state.shops.indexOf(s);
                  const h = evalShopHealth(s);
                  const shopStat = stats.byShop[s.name] || { gmv: 0, count: 0, aov: 0 };
                  const expDays = daysUntilDateStr(s.authExpireDate);
                  const expSoon = s.mode === "REAL" && expDays <= 7;
                  return `
                    <tr style="${h.urgent ? "background:#fef2f2;" : ""}">
                      <td class="nowrap">
                        <strong>${s.name}</strong>
                        <div style="font-size:12px;color:var(--text-soft);">凭证${s.credMask} · 开店 ${s.openedAt || "已建档"}</div>
                      </td>
                      <td class="nowrap">
                        <div><strong>${s.platform} · ${s.region}</strong></div>
                        <span class="pill ${s.mode==="REAL"?"p-green":"p-amber"}" style="margin-top:2px;">${s.mode==="REAL"?"实盘(计营收)":"仅演示(不计营收)"}</span>
                      </td>
                      <td class="nowrap">
                        <strong>${s.mode==="REAL" ? "$" + shopStat.gmv.toLocaleString() : "$0 (隔离)"}</strong>
                        <div style="font-size:12px;color:var(--text-soft);">${s.mode==="REAL" ? `${shopStat.count} 笔 · 客单 $${shopStat.aov}` : "不计入实盘统计"}</div>
                      </td>
                      <td class="nowrap">
                        <div>${s.mainCategory}</div>
                        <div style="font-size:12px;color:var(--text-soft);">负责人：${s.owner}</div>
                      </td>
                      <td class="nowrap">
                        <strong>${s.currency}</strong>
                        <div style="font-size:12px;color:var(--text-soft);">${s.timezone}</div>
                      </td>
                      <td class="nowrap">
                        <div style="color:${expSoon?"var(--red-text)":"var(--text-dark)"};font-weight:${expSoon?"700":"500"};">${s.authExpireDate}</div>
                        ${expSoon ? `<span class="pill p-red">限期授权(${expDays}天)</span>` : ""}
                      </td>
                      <td>
                        <span class="pill ${h.pill}">${h.badge}</span>
                        <div style="font-size:12px;color:${h.urgent?"var(--red-text)":"var(--text-soft)"};margin-top:3px;max-width:230px;">${h.triggerText}</div>
                        <details style="margin-top:4px;font-size:12px;">
                          <summary style="cursor:pointer;color:var(--blue-hover);">展开健康明细与权限 (${s.permLabels.length})</summary>
                          <div style="margin-top:4px;line-height:1.6;color:var(--text-muted);">
                            绩效 ${s.perfScore}分 · 7天纠纷 ${s.disputeRate7d}% · 退货 ${s.returnRate}% · 迟发 ${s.lateShipRate}% · 违规 ${s.policyViolations}次 · 连续零单 ${s.zeroOrderDays}天
                          </div>
                          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">${s.permLabels.map(p => `<span class="pill p-gray">${p}</span>`).join("")}</div>
                        </details>
                      </td>
                      <td class="nowrap">
                        <div>${s.lastSync}</div>
                        <div style="font-size:12px;color:var(--text-soft);">${relTimeLabel(s.lastSyncTs)} · ${s.nextSyncAt}</div>
                      </td>
                      <td class="nowrap">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <button class="btn btn-sm btn-primary m0-sync-btn" data-i="${idx}" ${!canManageShop?"disabled":""} title="${!canManageShop?"需要管理者或主管权限":""}">↻ 同步订单</button>
                          <button class="btn btn-sm m0-reauth-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>重新授权</button>
                          <button class="btn btn-sm btn-danger m0-disc-btn" data-i="${idx}" ${!canManageShop?"disabled":""}>断开</button>
                        </div>
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
        document.querySelectorAll(".m0-sync-btn").forEach(b => b.onclick = () => handleSyncShop(state.shops[Number(b.dataset.i)]));
        document.querySelectorAll(".m0-reauth-btn").forEach(b => b.onclick = () => handleReauthShop(state.shops[Number(b.dataset.i)]));
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

    const enrichedProds = state.masterProducts.map(p => ({ ...p, _m: calcProductMargin(p) }));
    const sortedProds = [...enrichedProds].sort((a, b) => {
      if (a.cost === null && b.cost !== null) return -1;
      if (a.cost !== null && b.cost === null) return 1;
      const aLow = a._m.known && a._m.marginPct < 12 ? 1 : 0;
      const bLow = b._m.known && b._m.marginPct < 12 ? 1 : 0;
      return bLow - aLow;
    });

    const filteredProds = sortedProds.filter(p => {
      const q = state.masterSearch.trim().toLowerCase();
      const matchQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q);
      const matchShop = state.masterShopFilter === "ALL" || p.mappings.some(m => m.shop === state.masterShopFilter);
      return matchQ && matchShop;
    });

    const prodPageSize = 6;
    const prodTotalPages = Math.max(1, Math.ceil(filteredProds.length / prodPageSize));
    if (state.m0bProdPage > prodTotalPages) state.m0bProdPage = prodTotalPages;
    const pagedProds = filteredProds.slice((state.m0bProdPage - 1) * prodPageSize, state.m0bProdPage * prodPageSize);

    const openCostBreakdownDrawer = (p) => {
      const m = calcProductMargin(p);
      const src = p.costSources || {};
      const estRev = +(p.sales30d * p.salePriceUsd).toFixed(2);
      openDrawer(`8项完整成本构成与毛利核算 · ${p.sku}`, `${p.name} · ${p.cat} · 负责人 ${p.owner}`, `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <img src="${getProductImg(p.sku)}" class="prod-thumb-lg" alt="${p.name}"/>
          <div>
            <div style="font-size:15.5px;font-weight:700;">${p.name}（${p.sku}）</div>
            <div style="font-size:12.5px;color:var(--text-soft);margin-top:3px;">上架日期：${p.listedAt} ｜ 近30天销量：<strong>${p.sales30d} 件</strong>（预估销售额 <strong>$${estRev.toLocaleString()}</strong>）</div>
            <div style="margin-top:4px;">
              ${m.known
                ? `<span class="pill ${m.marginPct < 10 ? "p-red" : m.marginPct < 12 ? "p-amber" : "p-green"}">单件毛利 $${m.profitUsd.toFixed(2)} ｜ 净利率 ${m.marginPct}%（门槛 ≥10%）</span>`
                : `<span class="pill p-amber">待复核最新核价信息</span>`}
            </div>
          </div>
        </div>
        ${(p.rmbNote || p.localBenchmarkNote) ? `<div class="banner banner-blue" style="margin-bottom:10px;"><span><strong>本币核算基准：</strong>${p.rmbNote || p.localBenchmarkNote}</span></div>` : ""}
        <div class="table-wrap" style="margin-bottom:12px;">
          <table>
            <thead><tr><th>成本构成项目</th><th>单件金额 (USD)</th><th>数据来源与核价依据</th></tr></thead>
            <tbody>
              <tr><td>① 参考售价</td><td><strong>$${p.salePriceUsd.toFixed(2)}</strong></td><td>${p.mappings[0]?.shop || "主力店铺"} 在售价（实时同步）</td></tr>
              <tr><td>② 采购成本</td><td>$${p.cost.toFixed(2)}</td><td>${src.cost || "供应商正式采购报价单"}</td></tr>
              <tr><td>③ 头程运费</td><td>$${p.freight.toFixed(2)}</td><td>${src.freight || "货代物流实盘账单"}</td></tr>
              <tr><td>④ 平台佣金 (${p.commissionRate}%)</td><td>$${m.commissionUsd.toFixed(2)}</td><td>${src.commission || "电商平台类目费率规则"}</td></tr>
              <tr><td>⑤ 尾程配送费</td><td>$${p.lastMile.toFixed(2)}</td><td>${src.lastMile || "海外仓 / 本地尾程派送费表"}</td></tr>
              <tr><td>⑥ 进口关税</td><td>$${p.tariff.toFixed(2)}</td><td>${src.tariff || "目的国海关税率及清关账单"}</td></tr>
              <tr><td>⑦ 均摊广告费</td><td>$${p.adCost.toFixed(2)}</td><td>${src.adCost || "近30天广告花费分摊"}</td></tr>
              <tr><td>⑧ 退货损耗 (${p.returnLossRate}%)</td><td>$${m.returnLossUsd.toFixed(2)}</td><td>${src.returnLoss || "近30天实际退货率折算损耗"}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="formula-box" style="margin-bottom:12px;">
          <strong>毛利核算明细与门槛对比：</strong><br/>
          单件净毛利 = 售价 $${p.salePriceUsd.toFixed(2)} − 7项成本合计 $${m.totalCost.toFixed(2)} = <strong style="color:${m.marginPct<12?"var(--red-text)":"var(--green-text)"};">$${m.profitUsd.toFixed(2)}（净利率 ${m.marginPct}%）</strong><br/>
          对比平台利润门槛（10%）：<strong>${m.marginPct >= 10 ? `高出门槛 +${(m.marginPct - 10).toFixed(1)}% ✓ 达标` : `低于门槛 ${(10 - m.marginPct).toFixed(1)}% ✗ 触发预警`}</strong>
        </div>
        ${m.marginPct < 12 ? `<div class="banner banner-red"><span>⚠️ 利润偏薄预警（低于 12% 健康线）：建议提高目标站点售价、或联系供应商复核采购与物流报价。</span></div>` : ""}
        <div class="drawer-sec-label">已上架店铺与当地售价</div>
        ${p.mappings.map(mp => `<div style="padding:7px 10px;background:#f8fafc;border:1px solid var(--border);border-radius:7px;margin-bottom:6px;font-size:13px;"><strong>${mp.shop}</strong> · 店铺编码 ${mp.shopSku} · 售价 <strong>${mp.price}</strong></div>`).join("")}
      `);
    };

    const dateCutoff7 = daysOffsetDate(-7);
    const dateCutoff30 = daysOffsetDate(-30);
    const filteredOrders = state.orders.filter(o => {
      const q = state.orderSearch.trim().toLowerCase();
      const mQ = !q || o.orderNo.toLowerCase().includes(q) || o.buyer.toLowerCase().includes(q) || (o.trackingNo || "").toLowerCase().includes(q) || o.sku.toLowerCase().includes(q);
      const mShop = state.orderShopFilter === "ALL" || o.shop === state.orderShopFilter;
      const mSt = state.orderStatusFilter === "ALL" || o.status === state.orderStatusFilter;
      const ordDate = (o.orderedAt || "").slice(0, 10);
      let mDt = true;
      if (state.orderDateFilter === "RECENT_7D") mDt = ordDate >= dateCutoff7;
      else if (state.orderDateFilter === "RECENT_30D") mDt = ordDate >= dateCutoff30;
      else if (state.orderDateFilter === "CUSTOM") {
        if (state.orderDateCustomStart && ordDate < state.orderDateCustomStart) mDt = false;
        if (state.orderDateCustomEnd && ordDate > state.orderDateCustomEnd) mDt = false;
      }
      return mQ && mShop && mSt && mDt;
    });

    const ordPageSize = 8;
    const ordTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ordPageSize));
    if (state.m0bOrdPage > ordTotalPages) state.m0bOrdPage = ordTotalPages;
    const pagedOrders = filteredOrders.slice((state.m0bOrdPage - 1) * ordPageSize, state.m0bOrdPage * ordPageSize);

    const lowMarginCount = enrichedProds.filter(p => p._m.known && p._m.marginPct < 12).length;
    const missingCostCount = enrichedProds.filter(p => p.cost === null).length;
    const realOrderCount = state.orders.filter(o => o.mode === "REAL").length;
    const disputeOrderCount = state.orders.filter(o => o.disputeStatus && o.disputeStatus !== "无纠纷").length;

    return {
      headerActions: [
        { label: "查看分店库存与盘点 →", primary: true, onClick: () => goPage("m0c") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>管理全店商品完整成本与毛利预警、带审批的成本变更申请，以及多店铺订单全生命周期台账。<strong>数据来源：</strong>各店铺同步订单与商品档案（最近核对：${state.lastDataRefreshAt}）。</span>
        </div>

        <div class="grid-4">
          <div class="kpi-card highlight-blue"><div class="kpi-label">在档主商品数量</div><div class="kpi-val" style="color:var(--blue-hover)">${state.masterProducts.length} 款</div><div class="kpi-sub">跨店铺统一商品编码与毛利核算</div></div>
          <div class="kpi-card ${missingCostCount + lowMarginCount > 0 ? "highlight-red" : ""}"><div class="kpi-label">低毛利 / 成本待核预警</div><div class="kpi-val" style="color:var(--red-text)">${missingCostCount} 待核 / ${lowMarginCount} 薄</div><div class="kpi-sub">毛利率＜12%或待核价商品已置顶</div></div>
          <div class="kpi-card highlight-green"><div class="kpi-label">实盘订单明细 (已防重)</div><div class="kpi-val" style="color:var(--green-text)">${realOrderCount} 笔</div><div class="kpi-sub">含纠纷/售后中 ${disputeOrderCount} 笔（演示店已隔离）</div></div>
          <div class="kpi-card"><div class="kpi-label">成本变更审批台账</div><div class="kpi-val">${state.costChangeLogs.length} 笔</div><div class="kpi-sub">待主管审批：${state.costChangeLogs.filter(c=>c.status==="待主管审批").length} 笔</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">主商品档案与毛利率预警（点击商品名可看 8 项完整成本拆分）</div>
            <span class="pill p-amber">低毛利置顶 · 8项成本透明拆解</span>
          </div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item"><label>搜索商品编码 / 名称 / 品类</label><input id="m0bSearch" class="input" placeholder="如：BAG-108 / 露营 / 家居收纳" value="${state.masterSearch}"/></div>
            <div class="filter-item"><label>按上架店铺筛选</label>
              <select id="m0bShopSel" class="select">
                <option value="ALL">全部店铺 (${state.shops.filter(s=>s.mode==="REAL").length} 家实盘)</option>
                ${state.shops.filter(s => s.mode === "REAL").map(s => `<option value="${s.name}" ${state.masterShopFilter===s.name?"selected":""}>${s.name}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品（点击看成本构成）</th><th>品类</th><th>各店铺售价</th><th>近30天销量</th><th>毛利率与系统建议</th><th>商品标签</th><th>负责人</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${pagedProds.length ? pagedProds.map(p => {
                  const m = p._m;
                  const lowM = m.known && m.marginPct < 12;
                  return `
                    <tr style="${p.cost===null ? "background:#fffbeb;" : lowM ? "background:#fef2f2;" : ""}">
                      <td class="nowrap">
                        <div class="m0b-cost-detail-trigger" data-sku="${p.sku}" style="display:flex;align-items:center;gap:10px;cursor:pointer;" title="点击查看完整成本构成与毛利率计算明细">
                          <img src="${getProductImg(p.sku)}" class="prod-thumb-img" alt="${p.name}"/>
                          <div>
                            <strong style="color:var(--blue-hover);text-decoration:underline;">${p.name}</strong>
                            <div style="font-size:12px;color:var(--text-soft);">${p.sku} · 上架 ${p.listedAt}</div>
                          </div>
                        </div>
                      </td>
                      <td class="nowrap">${p.cat}</td>
                      <td>${p.mappings.map(mp => `<div style="font-size:12px;"><strong>${mp.shop}</strong> · ${mp.price}</div>`).join("")}</td>
                      <td class="nowrap"><strong>${p.sales30d} 件</strong></td>
                      <td class="nowrap">
                        ${!m.known
                          ? `<span class="pill p-amber">待复核报价</span><div style="font-size:12px;color:var(--amber-text);margin-top:2px;">请核查采购价</div>`
                          : lowM
                            ? `<strong style="color:var(--red-text);font-size:14px;">${m.marginPct}%（偏薄）</strong><div style="font-size:12px;color:var(--red-text);margin-top:2px;">利润偏薄，建议调价或换供应商</div>`
                            : `<strong style="color:var(--green-text);font-size:14px;">${m.marginPct}%</strong><div style="font-size:12px;color:var(--text-soft);">单件毛利 $${m.profitUsd.toFixed(2)}</div>`}
                      </td>
                      <td class="nowrap"><span class="pill ${p.tag==="爆款"?"p-green":p.tag==="潜力"?"p-blue":p.tag==="滞销"?"p-red":"p-amber"}">${p.tag}</span></td>
                      <td class="nowrap">${p.owner}</td>
                      <td class="nowrap"><span class="pill ${p.cost===null?"p-amber":"p-green"}">${p.status}</span></td>
                      <td class="nowrap">
                        <div style="display:flex;gap:6px;">
                          <button class="btn btn-sm m0b-cost-detail-trigger" data-sku="${p.sku}">成本构成</button>
                          <button class="btn btn-sm btn-primary m0b-cost-btn" data-sku="${p.sku}" ${!canEditCost?"disabled":""} title="${!canEditCost?"需要业务运营或主管权限":""}">调整成本</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--text-soft);padding:20px;">暂无符合筛选条件的商品，请清空筛选词重试。</td></tr>`}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m0bProdPage} / ${prodTotalPages} 页 · 每页 6 款 · 共 ${filteredProds.length} 款</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m0bProdPrev" ${state.m0bProdPage<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m0bProdNext" ${state.m0bProdPage>=prodTotalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">成本变更审批与历史版本台账（严格执行提交人 ≠ 审批人）</div>
            <span class="pill p-blue">共 ${state.costChangeLogs.length} 个历史与待审版本</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>申请单号</th><th>商品</th><th>变更前 → 变更后（采购/头程）</th><th>生效日期</th><th>业务原因</th><th>申请 / 审批人</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${state.costChangeLogs.map((c, idx) => {
                  const isSelfSubmit = c.applicant === ROLE_PERSON_NAMES[state.role];
                  const canApproveThis = canApproveCost && !isSelfSubmit;
                  return `
                    <tr>
                      <td class="nowrap"><strong>${c.id}</strong></td>
                      <td class="nowrap">${c.sku}</td>
                      <td class="nowrap">${c.oldCost===null?"初始建档":"$"+c.oldCost.toFixed(2)} → <strong>$${c.newCost.toFixed(2)}</strong> (头程 $${c.newFreight.toFixed(2)})</td>
                      <td class="nowrap">${c.effectiveDate}</td>
                      <td style="font-size:12.5px;">${c.reason}</td>
                      <td class="nowrap">${c.applicant} / ${c.approver || "待主管批"}</td>
                      <td class="nowrap"><span class="pill ${c.status==="已生效"?"p-green":"p-amber"}">${c.status}</span></td>
                      <td class="nowrap">
                        ${c.status === "待主管审批"
                          ? `<button class="btn btn-sm btn-success m0b-approve-cost" data-i="${idx}" ${!canApproveThis?"disabled":""} title="${!canApproveCost?"需「主管/审批人」批准":isSelfSubmit?"职责分离拦截：不可批准本人提交的成本单":""}">批准生效</button>`
                          : `<span style="font-size:12px;color:var(--text-soft);">已归档</span>`}
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
            <div class="card-title">多店铺订单台账（点击任意订单行可看物流时间轴并直达 M1 客服）</div>
            <span class="pill p-green">重复订单已过滤 · 纠纷单已高亮</span>
          </div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item"><label>搜索订单号 / 买家 / 物流单号</label><input id="ordSearchInp" class="input" placeholder="如：SYN9D / Emily / 1Z999" value="${state.orderSearch}"/></div>
            <div class="filter-item"><label>筛选店铺</label>
              <select id="ordShopFlt" class="select">
                <option value="ALL">全部店铺</option>
                ${state.shops.map(s => `<option value="${s.name}" ${state.orderShopFilter===s.name?"selected":""}>${s.name}</option>`).join("")}
              </select>
            </div>
            <div class="filter-item"><label>订单状态</label>
              <select id="ordStFlt" class="select">
                <option value="ALL">全部状态</option>
                <option value="已付款" ${state.orderStatusFilter==="已付款"?"selected":""}>已付款</option>
                <option value="已发货" ${state.orderStatusFilter==="已发货"?"selected":""}>已发货</option>
                <option value="已签收" ${state.orderStatusFilter==="已签收"?"selected":""}>已签收</option>
                <option value="退款中" ${state.orderStatusFilter==="退款中"?"selected":""}>退款中</option>
                <option value="已完成" ${state.orderStatusFilter==="已完成"?"selected":""}>已完成</option>
                <option value="仅演示不计营收" ${state.orderStatusFilter==="仅演示不计营收"?"selected":""}>仅演示不计营收</option>
              </select>
            </div>
            <div class="filter-item"><label>下单日期（动态范围）</label>
              <select id="ordDtFlt" class="select">
                <option value="ALL" ${state.orderDateFilter==="ALL"?"selected":""}>全部历史订单</option>
                <option value="RECENT_7D" ${state.orderDateFilter==="RECENT_7D"?"selected":""}>最近 7 天</option>
                <option value="RECENT_30D" ${state.orderDateFilter==="RECENT_30D"?"selected":""}>最近 30 天</option>
                <option value="CUSTOM" ${state.orderDateFilter==="CUSTOM"?"selected":""}>自定义日期区间</option>
              </select>
            </div>
            ${state.orderDateFilter === "CUSTOM" ? `
              <div class="filter-item"><label>起始日</label><input id="ordDtStart" type="date" class="input" value="${state.orderDateCustomStart}"/></div>
              <div class="filter-item"><label>截止日</label><input id="ordDtEnd" type="date" class="input" value="${state.orderDateCustomEnd}"/></div>
            ` : ""}
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>订单编号</th><th>所属店铺</th><th>买家 (国家城市)</th><th>商品明细</th><th>金额 (本币+美元)</th><th>下单时间</th><th>状态</th><th>物流单号</th><th>纠纷状态</th><th>营收口径</th></tr></thead>
              <tbody>
                ${pagedOrders.length ? pagedOrders.map(o => {
                  const hasDispute = o.disputeStatus && o.disputeStatus !== "无纠纷";
                  return `
                    <tr class="m0b-ord-row" data-ord="${o.orderNo}" style="cursor:pointer;${hasDispute ? "background:#fef2f2;" : ""}" title="点击查看订单全生命周期或一键跳转M1客服">
                      <td class="nowrap">
                        <strong style="color:var(--blue-hover);">${o.orderNo}</strong>
                        ${o.isHistoryDemo ? `<span class="pill p-purple" style="margin-left:4px;">历史示例数据</span>` : ""}
                      </td>
                      <td class="nowrap">${o.shop}</td>
                      <td class="nowrap"><strong>${o.buyer}</strong><div style="font-size:12px;color:var(--text-soft);">${o.countryCity || "线上跨境订单"}</div></td>
                      <td class="nowrap">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <img src="${getProductImg(o.sku)}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);" alt="${o.productName}"/>
                          <span>${o.productName} × ${o.qty}</span>
                        </div>
                      </td>
                      <td class="nowrap"><strong>${o.amountDisplay}</strong></td>
                      <td class="nowrap">${o.orderedAt}<div style="font-size:12px;color:var(--text-soft);">${o.source || "自然流量"}</div></td>
                      <td class="nowrap"><span class="pill ${o.mode==="MOCK"?"p-amber":o.status==="退款中"?"p-red":o.status==="已完成"||o.status==="已签收"?"p-green":"p-blue"}">${o.status}</span></td>
                      <td class="nowrap" style="font-size:12px;">${o.trackingNo || "待生成运单"}</td>
                      <td class="nowrap">
                        <span class="pill ${hasDispute?"p-red":"p-gray"}">${o.disputeStatus || "无纠纷"}</span>
                        ${o.refundSyncStatus && o.refundSyncStatus !== "无退款" ? `<div style="font-size:11.5px;color:var(--purple-text);margin-top:2px;">${o.refundSyncStatus}</div>` : ""}
                      </td>
                      <td class="nowrap"><span class="pill ${o.mode==="REAL"?"p-green":"p-amber"}">${o.mode==="REAL"?"计入真实营收":"仅演示不计营收"}</span></td>
                    </tr>
                  `;
                }).join("") : `<tr><td colspan="10" style="text-align:center;color:var(--text-soft);padding:20px;">暂无符合当前筛选条件的订单。</td></tr>`}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m0bOrdPage} / ${ordTotalPages} 页 · 每页 8 笔 · 共 ${filteredOrders.length} 笔</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m0bOrdPrev" ${state.m0bOrdPage<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m0bOrdNext" ${state.m0bOrdPage>=ordTotalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0bSearch").oninput = (e) => { state.masterSearch = e.target.value; state.m0bProdPage = 1; rerender(); };
        document.getElementById("m0bShopSel").onchange = (e) => { state.masterShopFilter = e.target.value; state.m0bProdPage = 1; rerender(); };
        document.getElementById("m0bProdPrev").onclick = () => { state.m0bProdPage -= 1; rerender(); };
        document.getElementById("m0bProdNext").onclick = () => { state.m0bProdPage += 1; rerender(); };

        document.getElementById("ordSearchInp").oninput = (e) => { state.orderSearch = e.target.value; state.m0bOrdPage = 1; rerender(); };
        document.getElementById("ordShopFlt").onchange = (e) => { state.orderShopFilter = e.target.value; state.m0bOrdPage = 1; rerender(); };
        document.getElementById("ordStFlt").onchange = (e) => { state.orderStatusFilter = e.target.value; state.m0bOrdPage = 1; rerender(); };
        document.getElementById("ordDtFlt").onchange = (e) => { state.orderDateFilter = e.target.value; state.m0bOrdPage = 1; rerender(); };
        const dtStartEl = document.getElementById("ordDtStart");
        const dtEndEl = document.getElementById("ordDtEnd");
        if (dtStartEl) dtStartEl.onchange = (e) => { state.orderDateCustomStart = e.target.value; state.m0bOrdPage = 1; rerender(); };
        if (dtEndEl) dtEndEl.onchange = (e) => { state.orderDateCustomEnd = e.target.value; state.m0bOrdPage = 1; rerender(); };
        document.getElementById("m0bOrdPrev").onclick = () => { state.m0bOrdPage -= 1; rerender(); };
        document.getElementById("m0bOrdNext").onclick = () => { state.m0bOrdPage += 1; rerender(); };

        document.querySelectorAll(".m0b-cost-detail-trigger").forEach(el => el.onclick = () => {
          const p = state.masterProducts.find(x => x.sku === el.dataset.sku);
          if (p) openCostBreakdownDrawer(p);
        });

        document.querySelectorAll(".m0b-ord-row").forEach(tr => tr.onclick = () => {
          const o = state.orders.find(x => x.orderNo === tr.dataset.ord);
          if (!o) return;
          const matchedSess = state.csSessions.find(s => s.linkedOrder === o.orderNo || s.buyer === o.buyer);
          const hasDispute = o.disputeStatus && o.disputeStatus !== "无纠纷";
          openDrawer(`订单全生命周期 · ${o.orderNo}`, `${o.shop} · ${o.mode==="REAL"?"实盘订单":"仅演示订单"}${o.isHistoryDemo?" · 历史示例数据":""}`, `
            ${hasDispute ? `<div class="banner banner-red" style="margin-bottom:12px;"><span>⚠️ 该订单当前存在「${o.disputeStatus}」，建议立即前往 M1 客服或售后工单处理。</span></div>` : ""}
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
              <img src="${getProductImg(o.sku)}" class="prod-thumb-lg" alt="${o.productName}"/>
              <div>
                <div style="font-size:15px;font-weight:700;">${o.productName} × ${o.qty}</div>
                <div style="font-size:12.5px;color:var(--text-soft);margin-top:2px;">买家：<strong>${o.buyer}</strong> (${o.countryCity || "线上跨境订单"})</div>
                <div style="font-size:12.5px;color:var(--text-soft);">实付：<strong>${o.amountDisplay}</strong> ｜ 支付：${o.payStatus || "已支付"} ｜ 来源：${o.source || "自然流量"}</div>
                <div style="font-size:12px;color:var(--text-soft);">物流单号：<strong>${o.trackingNo || "待生成运单"}</strong> ｜ 退款登记：${o.refundSyncStatus}</div>
              </div>
            </div>
            <div class="drawer-sec-label">订单流转时间轴</div>
            <div style="margin-bottom:16px;">
              ${(o.timeline || []).map(st => `
                <div class="timeline-step ${st.done ? "done" : ""}">
                  <div>
                    <div style="font-weight:700;color:${st.done?"var(--green-text)":"var(--text-soft)"};">${st.done?"✓":"○"} ${st.step}</div>
                    <div style="font-size:12px;color:var(--text-soft);">${st.time}</div>
                  </div>
                </div>
              `).join("")}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border);">
              <button class="btn btn-primary" id="ordJumpCsBtn">
                ${matchedSess ? `🔗 一键跳转 M1 客服会话 (${matchedSess.buyer}) →` : "🔗 前往 M1 客服工作台处理 →"}
              </button>
            </div>
          `, (drawerBody) => {
            drawerBody.querySelector("#ordJumpCsBtn").onclick = () => {
              if (matchedSess) state.csActiveId = matchedSess.id;
              closeDetailDrawer();
              goPage("m1a");
              toast(matchedSess ? `已关联并定位买家「${matchedSess.buyer}」会话` : `已跳转客服工作台，可按订单号 ${o.orderNo} 检索核验`, "info");
            };
          });
        });

        document.querySelectorAll(".m0b-cost-btn").forEach(b => b.onclick = () => {
          const p = state.masterProducts.find(x => x.sku === b.dataset.sku);
          const beforeMargin = calcProductMargin(p);
          commitAction({
            title: `发起完整成本变更申请 · ${p.sku} (${p.name})`,
            summary: "⚠️ 影响面提示：成本生效后将同步重算「商品毛利率」、影响「M2 经营大屏净利润」及「M6 补货采购资金测算」。提交后需主管审批生效（提交人 ≠ 审批人）。",
            confirmText: "提交成本变更申请",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>单件采购成本 (USD) *</label><input id="cNewCost" type="number" step="0.01" class="input" value="${p.cost ?? ""}" placeholder="例如 4.80"/></div>
                <div class="field"><label>单件头程运费 (USD) *</label><input id="cNewFr" type="number" step="0.01" class="input" value="${p.freight ?? ""}" placeholder="例如 2.30"/></div>
                <div class="field"><label>平台佣金率 (%) *</label><input id="cNewComm" type="number" step="0.1" class="input" value="${p.commissionRate ?? 12}"/></div>
                <div class="field"><label>尾程配送费 (USD) *</label><input id="cNewLast" type="number" step="0.01" class="input" value="${p.lastMile ?? 3.5}"/></div>
                <div class="field"><label>进口关税 (USD) *</label><input id="cNewTar" type="number" step="0.01" class="input" value="${p.tariff ?? 1.0}"/></div>
                <div class="field"><label>均摊广告费 (USD) *</label><input id="cNewAd" type="number" step="0.01" class="input" value="${p.adCost ?? 2.5}"/></div>
              </div>
              <div id="cMarginPreview" class="formula-box" style="margin-bottom:10px;">请输入完整成本项以预览毛利率变化…</div>
              <div class="field"><label>成本生效日期 *</label><input id="cEffDate" type="date" class="input" value="${daysOffsetDate(1)}"/></div>
              <div class="field"><label>业务变更原因（必填）*</label><input id="cReason" class="input" placeholder="如：原材料涨价 / 供应商阶梯报价调整"/></div>
            `,
            onMount: (wrap) => {
              const ids = ["#cNewCost", "#cNewFr", "#cNewComm", "#cNewLast", "#cNewTar", "#cNewAd"];
              const prevBox = wrap.querySelector("#cMarginPreview");
              const updPreview = () => {
                const c = Number(wrap.querySelector("#cNewCost").value);
                const f = Number(wrap.querySelector("#cNewFr").value);
                const cm = Number(wrap.querySelector("#cNewComm").value);
                const lm = Number(wrap.querySelector("#cNewLast").value);
                const tr = Number(wrap.querySelector("#cNewTar").value);
                const ad = Number(wrap.querySelector("#cNewAd").value);
                if (!(c > 0)) {
                  prevBox.innerHTML = "填写有效的采购成本后，将在此实时对比变更前后毛利率与下游影响。";
                  return;
                }
                const after = calcProductMargin({
                  salePriceUsd: p.salePriceUsd, cost: c, freight: f, commissionRate: cm,
                  lastMile: lm, tariff: tr, adCost: ad, returnLossRate: p.returnLossRate || 2
                });
                const beforeText = beforeMargin.known ? `${beforeMargin.marginPct}% ($${beforeMargin.profitUsd.toFixed(2)})` : "待补全成本";
                prevBox.innerHTML = `
                  <strong>变更前后毛利率实时对比（参考售价 $${p.salePriceUsd.toFixed(2)}）：</strong><br/>
                  • 变更前：${beforeText} → 变更后：<strong style="color:${after.marginPct < 12 ? "var(--red-text)" : "var(--green-text)"};">${after.marginPct}% ($${after.profitUsd.toFixed(2)})</strong>${after.marginPct < 12 ? " <span class='pill p-red'>低于12%预警线</span>" : ""}<br/>
                  • 联动影响：批准生效后，M2 经营大屏毛利按新单件成本 $${after.totalCost.toFixed(2)} 核算，M6 采购计划按采购+头程 $${(c+f).toFixed(2)}/件测算资金。
                `;
              };
              ids.forEach(sel => { wrap.querySelector(sel).oninput = updPreview; });
              updPreview();
            },
            validate: (wrap) => {
              const errs = [];
              const cEl = wrap.querySelector("#cNewCost");
              const fEl = wrap.querySelector("#cNewFr");
              const cmEl = wrap.querySelector("#cNewComm");
              const lmEl = wrap.querySelector("#cNewLast");
              const trEl = wrap.querySelector("#cNewTar");
              const adEl = wrap.querySelector("#cNewAd");
              const dEl = wrap.querySelector("#cEffDate");
              const rEl = wrap.querySelector("#cReason");
              if (!(Number(cEl.value) > 0)) errs.push({ el: cEl, msg: "采购成本必须大于 0" });
              if (fEl.value.trim() === "" || Number(fEl.value) < 0) errs.push({ el: fEl, msg: "请填写合法头程运费" });
              if (cmEl.value.trim() === "" || Number(cmEl.value) < 0 || Number(cmEl.value) > 60) errs.push({ el: cmEl, msg: "平台佣金率须在 0~60% 之间" });
              if (lmEl.value.trim() === "" || Number(lmEl.value) < 0) errs.push({ el: lmEl, msg: "请填写合法尾程配送费" });
              if (trEl.value.trim() === "" || Number(trEl.value) < 0) errs.push({ el: trEl, msg: "请填写合法关税" });
              if (adEl.value.trim() === "" || Number(adEl.value) < 0) errs.push({ el: adEl, msg: "请填写合法广告费用" });
              if (!dEl.value.trim()) errs.push({ el: dEl, msg: "请选择生效日期" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写成本变更业务原因" });
              return errs;
            },
            onConfirm: (wrap) => {
              const nc = Number(wrap.querySelector("#cNewCost").value);
              const nf = Number(wrap.querySelector("#cNewFr").value);
              const ncm = Number(wrap.querySelector("#cNewComm").value);
              const nlm = Number(wrap.querySelector("#cNewLast").value);
              const ntr = Number(wrap.querySelector("#cNewTar").value);
              const nad = Number(wrap.querySelector("#cNewAd").value);
              const dt = wrap.querySelector("#cEffDate").value;
              const rsn = wrap.querySelector("#cReason").value.trim();
              const cid = genDocId("CC");
              state.costChangeLogs.unshift({
                id: cid, sku: p.sku, oldCost: p.cost, oldFreight: p.freight,
                newCost: nc, newFreight: nf, newCommission: ncm, newLastMile: nlm, newTariff: ntr, newAdCost: nad,
                effectiveDate: dt, reason: rsn,
                applicant: ROLE_PERSON_NAMES[state.role],
                approver: "",
                status: "待主管审批",
                time: nowDateTimeStr()
              });
              return { toastMsg: `已提交成本变更申请 ${cid}（待主管复核批准后生效，严格执行提交人 ≠ 审批人）` };
            },
            audit: (wrap) => ({
              sentence: `${ROLE_PERSON_NAMES[state.role]} 提交了 ${p.sku} 完整成本变更申请（采购 $${wrap.querySelector("#cNewCost").value} + 头程 $${wrap.querySelector("#cNewFr").value}，生效日 ${wrap.querySelector("#cEffDate").value}），原因：${wrap.querySelector("#cReason").value.trim()}`,
              ok: true
            })
          });
        });

        document.querySelectorAll(".m0b-approve-cost").forEach(b => b.onclick = () => {
          const log = state.costChangeLogs[Number(b.dataset.i)];
          if (log.applicant === ROLE_PERSON_NAMES[state.role]) {
            record403("M0-2 成本变更审批", "职责分离：不可批准本人提交的成本单");
            return;
          }
          const prod = state.masterProducts.find(p => p.sku === log.sku);
          commitAction({
            title: `批准成本变更生效 · ${log.id}`,
            summary: `批准后 ${log.sku} 的单件成本将正式更新为采购 $${log.newCost.toFixed(2)} + 头程 $${log.newFreight.toFixed(2)}，影响毛利与补货测算。`,
            confirmText: "确认批准生效",
            onConfirm: () => {
              log.status = "已生效";
              log.approver = ROLE_PERSON_NAMES[state.role];
              if (prod) {
                prod.cost = log.newCost;
                prod.freight = log.newFreight;
                if (log.newCommission !== undefined) prod.commissionRate = log.newCommission;
                if (log.newLastMile !== undefined) prod.lastMile = log.newLastMile;
                if (log.newTariff !== undefined) prod.tariff = log.newTariff;
                if (log.newAdCost !== undefined) prod.adCost = log.newAdCost;
                prod.status = "在售";
              }
              return { toastMsg: `成本变更 ${log.id} 已批准生效` };
            },
            audit: {
              sentence: `${ROLE_PERSON_NAMES[state.role]} 批准了成本变更单 ${log.id}（${log.sku} 采购成本调至 $${log.newCost.toFixed(2)}）`,
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

    const invWithCov = state.inventoryItems.map(item => {
      const cov = calcInvCoverage(item);
      return { item, cov: { ...cov, tier: cov.pill === "p-red" ? "RED" : cov.pill === "p-amber" ? "AMBER" : cov.pill === "p-gray" ? "GRAY" : "GREEN", label: cov.level } };
    });
    const filteredInv = invWithCov.filter(({ item, cov }) => {
      const mShop = state.inventoryShopFilter === "ALL" || item.shopName === state.inventoryShopFilter;
      const mWh = state.inventoryWhFilter === "ALL" || item.whId === state.inventoryWhFilter;
      const mSt = state.inventoryStatusFilter === "ALL" || cov.tier === state.inventoryStatusFilter;
      const q = state.inventorySearch.trim().toLowerCase();
      const mQ = !q || item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.shopSku.toLowerCase().includes(q);
      return mShop && mWh && mSt && mQ;
    });

    const invPageSize = 8;
    const invTotalPages = Math.max(1, Math.ceil(filteredInv.length / invPageSize));
    if (state.m0cInvPage > invTotalPages) state.m0cInvPage = invTotalPages;
    const pagedInv = filteredInv.slice((state.m0cInvPage - 1) * invPageSize, state.m0cInvPage * invPageSize);

    const redCount = invWithCov.filter(x => x.cov.tier === "RED").length;
    const amberCount = invWithCov.filter(x => x.cov.tier === "AMBER").length;
    const slowCount = invWithCov.filter(x => x.cov.tier === "GRAY").length;
    const totalInTransit = state.inventoryItems.reduce((s, i) => s + (i.inTransit || 0), 0);
    const totalLocked = state.inventoryItems.reduce((s, i) => s + (i.locked || 0), 0);
    const totalQc = state.inventoryItems.reduce((s, i) => s + (i.pendingQc || 0), 0);

    const totalPred7 = state.m5DailyPred.reduce((a, b) => a + b, 0);
    const bagUs = state.inventoryItems.find(i => i.id === "inv1");
    const fanTh = state.inventoryItems.find(i => i.id === "inv3");
    const m5GapBag = bagUs ? Math.max(0, totalPred7 + bagUs.safety - bagUs.avail) : 0;
    const m6GapFan = fanTh ? Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - fanTh.avail) : 0;

    const currentActor = ROLE_PERSON_NAMES[state.role];
    const reviewerPool = ["赵仓管", "陈主管", "周运营", "张总监", "王采购"].filter(n => n !== currentActor);

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
          <div class="kpi-card highlight-blue">
            <div class="kpi-label">分店独立库存台账</div>
            <div class="kpi-val" style="color:var(--blue-hover)">${state.inventoryItems.length} 条</div>
            <div class="kpi-sub">美西/美东/曼谷/吉隆坡 4 仓独立核算</div>
          </div>
          <div class="kpi-card ${redCount + amberCount > 0 ? "highlight-red" : ""}">
            <div class="kpi-label">断货 / 低水位预警</div>
            <div class="kpi-val" style="color:var(--red-text)">${redCount} 断货 / ${amberCount} 紧张</div>
            <div class="kpi-sub">覆盖＜7天标红 · 7~14天标橙</div>
          </div>
          <div class="kpi-card ${slowCount > 0 ? "highlight-amber" : ""}">
            <div class="kpi-label">滞销积压 SKU (&gt;90天)</div>
            <div class="kpi-val" style="color:var(--amber-text)">${slowCount} 款</div>
            <div class="kpi-sub">库龄超 90 天需促销或调拨清仓</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-label">全仓在途库存总计</div>
            <div class="kpi-val" style="color:var(--green-text)">${totalInTransit} 件</div>
            <div class="kpi-sub">锁定 ${totalLocked} / 待质检 ${totalQc} · M5:${m5GapBag} / M6:${m6GapFan}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">分店分仓独立库存水位明细（含在途 / 锁定 / 待质检与覆盖天数预警）</div>
            <span class="pill p-blue">共 ${filteredInv.length} 条（第 ${state.m0cInvPage}/${invTotalPages} 页）</span>
          </div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-item"><label>搜索商品编码 / 名称</label><input id="m0cSearch" class="input" placeholder="如：BAG-108 / 露营 / 风扇" value="${state.inventorySearch}"/></div>
            <div class="filter-item"><label>按物理仓库筛选</label>
              <select id="m0cWhFlt" class="select">
                <option value="ALL">全部 4 座物理仓</option>
                <option value="US-WH-2" ${state.inventoryWhFilter==="US-WH-2"?"selected":""}>美国美西海外仓 (US-WH-2)</option>
                <option value="US-WH-1" ${state.inventoryWhFilter==="US-WH-1"?"selected":""}>美国美东新泽西仓 (US-WH-1)</option>
                <option value="TH-WH-1" ${state.inventoryWhFilter==="TH-WH-1"?"selected":""}>泰国曼谷本地仓 (TH-WH-1)</option>
                <option value="MY-WH-1" ${state.inventoryWhFilter==="MY-WH-1"?"selected":""}>马来吉隆坡仓 (MY-WH-1)</option>
              </select>
            </div>
            <div class="filter-item"><label>按所属店铺筛选</label>
              <select id="m0cShopFlt" class="select">
                <option value="ALL">全部实盘店铺</option>
                ${state.shops.filter(s => s.mode === "REAL").map(s => `<option value="${s.name}" ${state.inventoryShopFilter===s.name?"selected":""}>${s.name}</option>`).join("")}
              </select>
            </div>
            <div class="filter-item"><label>按水位状态筛选</label>
              <select id="m0cStFlt" class="select">
                <option value="ALL">全部状态</option>
                <option value="RED" ${state.inventoryStatusFilter==="RED"?"selected":""}>🔴 断货预警 (&lt;7天)</option>
                <option value="AMBER" ${state.inventoryStatusFilter==="AMBER"?"selected":""}>🟠 补货提示 (7~14天)</option>
                <option value="GREEN" ${state.inventoryStatusFilter==="GREEN"?"selected":""}>🟢 库存健康</option>
                <option value="GRAY" ${state.inventoryStatusFilter==="GRAY"?"selected":""}>⚪ 积压滞销 (&gt;90天)</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>商品编码与名称</th><th>所属店铺 / 仓库</th><th>可用</th><th>在途</th><th>锁定</th><th>待质检</th><th>安全库存</th><th>覆盖天数 / 库龄</th><th>水位状态与建议</th><th>人工盘点</th></tr></thead>
              <tbody>
                ${pagedInv.length ? pagedInv.map(({ item, cov }) => {
                  const rowBg = cov.tier === "RED" ? "background:#fef2f2;" : cov.tier === "AMBER" ? "background:#fffbeb;" : cov.tier === "GRAY" ? "background:#f8fafc;" : "";
                  return `
                    <tr style="${rowBg}">
                      <td class="nowrap">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <img src="${getProductImg(item.sku)}" style="width:36px;height:36px;border-radius:6px;border:1px solid var(--border);" alt="${item.name}"/>
                          <div><strong>${item.sku} · ${item.name}</strong><div style="font-size:12px;color:var(--text-soft);">上架编码：${item.shopSku} · 日仓储 $${(item.storageFeeRate || 0.03).toFixed(2)}</div></div>
                        </div>
                      </td>
                      <td class="nowrap">
                        <div>${item.shopName}</div>
                        <div style="font-size:12px;color:var(--text-soft);"><strong>${item.whName}</strong></div>
                      </td>
                      <td class="nowrap"><strong style="font-size:15px;color:${cov.tier==="RED"?"var(--red-text)":"var(--text-dark)"};">${item.avail}</strong></td>
                      <td class="nowrap" style="color:var(--blue-hover);font-weight:600;">${item.inTransit || 0}</td>
                      <td class="nowrap">${item.locked || 0}</td>
                      <td class="nowrap">${item.pendingQc || 0}</td>
                      <td class="nowrap">${item.safety} 件</td>
                      <td class="nowrap">
                        <strong>${cov.coverDays} 天</strong>
                        <div style="font-size:12px;color:${item.ageDays > 90 ? "var(--red-text)" : "var(--text-soft)"};">库龄 ${item.ageDays} 天 · 周转 ${item.turnoverDays}天</div>
                      </td>
                      <td>
                        <span class="pill ${cov.pill}">${cov.label}</span>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:3px;max-width:170px;">${cov.advice}</div>
                      </td>
                      <td class="nowrap">
                        <button class="btn btn-sm btn-primary m0c-cal-btn" data-id="${item.id}" ${!canStocktake?"disabled":""} title="${!canStocktake?"需要仓库人员或管理者权限":""}">📝 盘点校准</button>
                      </td>
                    </tr>
                  `;
                }).join("") : `<tr><td colspan="10" style="text-align:center;color:var(--text-soft);padding:20px;">暂无符合当前筛选条件的库存记录。</td></tr>`}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
            <span style="font-size:12.5px;color:var(--text-soft);">第 ${state.m0cInvPage} / ${invTotalPages} 页 · 每页 8 条 · 共 ${filteredInv.length} 条</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" id="m0cInvPrev" ${state.m0cInvPage<=1?"disabled":""}>← 上一页</button>
              <button class="btn btn-sm" id="m0cInvNext" ${state.m0cInvPage>=invTotalPages?"disabled":""}>下一页 →</button>
            </div>
          </div>
        </div>

        <div class="card card-blue">
          <div class="card-header"><div class="card-title">正式盘点单与下游补货影响明细（含复核人双人签核与覆盖天数前后变化）</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>盘点单号</th><th>仓库 / 商品 / 关联单号</th><th>差异类型与数量变化</th><th>覆盖天数变化</th><th>M5 / M6 联动重算</th><th>盘点原因</th><th>盘点 / 复核人 / 时间</th></tr></thead>
              <tbody>
                ${state.stocktakes.map(st => `
                  <tr>
                    <td class="nowrap"><strong>${st.sheetId}</strong></td>
                    <td class="nowrap">
                      <div>${st.whName} · <strong>${st.sku}</strong></div>
                      <div style="font-size:12px;color:var(--text-soft);">关联单号：${st.poNo || "无关联采购单"}</div>
                    </td>
                    <td class="nowrap">
                      <span class="pill ${st.delta >= 0 ? "p-green" : "p-red"}">${st.diffType || "常规盘点"}</span>
                      <div style="margin-top:2px;">${st.before} → <strong>${st.after} 件</strong> (${st.delta >= 0 ? "+" + st.delta : st.delta})</div>
                    </td>
                    <td class="nowrap">${st.coverBefore ?? "基准"}天 → <strong style="color:var(--blue-hover);">${st.coverAfter ?? "基准"}天</strong></td>
                    <td class="nowrap">
                      <div>M5：${st.m5Before} → <strong style="color:var(--blue-hover);">${st.m5After}</strong></div>
                      <div style="font-size:12px;">M6：${st.m6Before} → <strong style="color:var(--green-text);">${st.m6After}</strong></div>
                    </td>
                    <td style="font-size:12.5px;">${st.reason}</td>
                    <td class="nowrap">
                      <div>盘点：${st.who} · 复核：<strong>${st.reviewer || "陈主管"}</strong></div>
                      <div style="font-size:12px;color:var(--text-soft);">${st.time}</div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById("m0cSearch").oninput = (e) => { state.inventorySearch = e.target.value; state.m0cInvPage = 1; rerender(); };
        document.getElementById("m0cWhFlt").onchange = (e) => { state.inventoryWhFilter = e.target.value; state.m0cInvPage = 1; rerender(); };
        document.getElementById("m0cShopFlt").onchange = (e) => { state.inventoryShopFilter = e.target.value; state.m0cInvPage = 1; rerender(); };
        document.getElementById("m0cStFlt").onchange = (e) => { state.inventoryStatusFilter = e.target.value; state.m0cInvPage = 1; rerender(); };
        document.getElementById("m0cInvPrev").onclick = () => { state.m0cInvPage -= 1; rerender(); };
        document.getElementById("m0cInvNext").onclick = () => { state.m0cInvPage += 1; rerender(); };

        document.querySelectorAll(".m0c-cal-btn").forEach(b => b.onclick = () => {
          const item = state.inventoryItems.find(x => x.id === b.dataset.id);
          const oldAvail = item.avail;
          const oldCov = calcInvCoverage(item);
          const m5PredBase = state.m5DailyPred.reduce((a, x) => a + x, 0);
          const m5Old = Math.max(0, m5PredBase + item.safety - oldAvail);
          const m6Old = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - oldAvail);

          commitAction({
            title: `生成正式盘点单 · ${item.whName} · ${item.sku}`,
            summary: `当前账面可售 <strong>${oldAvail} 件</strong>（覆盖 ${oldCov.coverDays} 天）；盘点生成正式单据后即刻联动 M5/M6，且严禁盘点人与复核人相同。`,
            confirmText: "确认生成盘点单并更新库存",
            fieldsHtml: `
              <div class="grid-2" style="gap:10px;">
                <div class="field"><label>实际清点可售数量 (件) *</label><input id="stNewQty" type="number" class="input" value="${oldAvail}"/></div>
                <div class="field"><label>差异类型 *</label>
                  <select id="stDiffType" class="select">
                    <option value="盘盈入库">盘盈入库</option>
                    <option value="盘亏损耗">盘亏损耗</option>
                    <option value="采购收货核验">采购收货核验</option>
                    <option value="退货重检入仓">退货重检入仓</option>
                    <option value="库位纠偏">库位纠偏</option>
                  </select>
                </div>
                <div class="field"><label>关联采购单/退货单号（选填）</label><input id="stPoNo" class="input" placeholder="如：PO-20261115-01"/></div>
                <div class="field"><label>双人复核人（不可同盘点人 ${currentActor}）*</label>
                  <select id="stReviewer" class="select">
                    ${reviewerPool.map(r => `<option value="${r}">${r}</option>`).join("")}
                  </select>
                </div>
              </div>
              <div id="stImpactPreview" class="formula-box" style="margin-bottom:10px;">请输入盘点后数量以查看覆盖天数及 M5/M6 实时联动变化…</div>
              <div class="field"><label>盘点差异原因（必填）*</label><input id="stReason" class="input" placeholder="如：新到货实物复点数入仓 / 清点剔除外箱破损件"/></div>
              <div id="stBigWarn" style="display:none;flex-direction:column;gap:6px;" class="banner banner-red">
                <span>⚠️ 检测到大幅度库存调整（变动 ≥ 20 件），请二次复核实物并勾选下方确认框后再提交！</span>
                <label style="font-size:12.5px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="checkbox" id="stBigConfirmCheck"/> 我已与复核人共同完成现场实物点检，确认本次大额调整无误
                </label>
              </div>
            `,
            onMount: (wrap) => {
              const qtyEl = wrap.querySelector("#stNewQty");
              const prevEl = wrap.querySelector("#stImpactPreview");
              const warnEl = wrap.querySelector("#stBigWarn");
              const upd = () => {
                const n = Number(qtyEl.value);
                if (Number.isNaN(n) || n < 0) return;
                const newCov = calcInvCoverage({ ...item, avail: n });
                const m5New = Math.max(0, m5PredBase + item.safety - n);
                const m6New = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - n);
                prevEl.innerHTML = `
                  • 库存变化：${oldAvail} 件 → <strong>${n} 件</strong> (${n - oldAvail >= 0 ? "+" : ""}${n - oldAvail} 件)<br/>
                  • 覆盖天数变化：${oldCov.coverDays} 天 → <strong style="color:${newCov.pill==="p-red"?"var(--red-text)":"var(--blue-hover)"};">${newCov.coverDays} 天</strong>（${newCov.level}）<br/>
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
              const rvEl = wrap.querySelector("#stReviewer");
              const rEl = wrap.querySelector("#stReason");
              const chkEl = wrap.querySelector("#stBigConfirmCheck");
              const n = Number(qEl.value);
              if (qEl.value.trim() === "" || Number.isNaN(n) || n < 0) errs.push({ el: qEl, msg: "库存数量必须为大于或等于 0 的数字" });
              if (!rvEl.value.trim() || rvEl.value.trim() === currentActor) errs.push({ el: rvEl, msg: "复核人必填且不可与当前盘点人相同" });
              if (!rEl.value.trim()) errs.push({ el: rEl, msg: "请填写盘点调整原因" });
              if (!Number.isNaN(n) && Math.abs(n - oldAvail) >= 20 && chkEl && !chkEl.checked) {
                errs.push({ el: chkEl, msg: "变动 ≥ 20 件时必须勾选现场实物点检二次确认" });
              }
              return errs;
            },
            onConfirm: (wrap) => {
              const newVal = Number(wrap.querySelector("#stNewQty").value);
              const diffType = wrap.querySelector("#stDiffType").value;
              const poNo = wrap.querySelector("#stPoNo").value.trim() || "无关联采购单";
              const reviewer = wrap.querySelector("#stReviewer").value.trim();
              const reason = wrap.querySelector("#stReason").value.trim();
              const newCov = calcInvCoverage({ ...item, avail: newVal });
              const m5New = Math.max(0, m5PredBase + item.safety - newVal);
              const m6New = Math.max(0, 30 * (state.m6NormalLeadDays + state.m6NormalSafetyDays) - newVal);
              const sid = genDocId("PD");
              item.avail = newVal;
              item.lastMoveAt = nowDateTimeStr();
              state.stocktakes.unshift({
                sheetId: sid, whName: item.whName, sku: item.sku,
                before: oldAvail, after: newVal, delta: newVal - oldAvail,
                m5Before: m5Old, m5After: m5New, m6Before: m6Old, m6After: m6New,
                coverBefore: oldCov.coverDays, coverAfter: newCov.coverDays,
                diffType, poNo, reviewer,
                reason, who: currentActor, time: nowDateTimeStr()
              });
              return { toastMsg: `盘点单 ${sid} 已生效！库存更新为 ${newVal} 件（覆盖 ${newCov.coverDays} 天），M5/M6 已联动重算` };
            },
            audit: (wrap) => ({
              sentence: `${currentActor}（复核人：${wrap.querySelector("#stReviewer").value}）生成了${wrap.querySelector("#stDiffType").value}盘点单（${item.whName} ${item.sku} 由 ${oldAvail} 件校准为 ${wrap.querySelector("#stNewQty").value} 件），原因：${wrap.querySelector("#stReason").value.trim()}`,
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
    const tkInfo = state.csTakeoverMap[active.id] || { who: "智能助手自动接待", at: "刚接入" };
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
          <span><strong>页面定位：</strong>供客服人员在回答买家时查询本店真实在售商品与卖点（未采购的新品评估请去 M4 选品中心）。<strong>数据来源：</strong>在售导购清单（最近导入：${state.csImportLogs[0]?.time || "暂无导入记录"}）。</span>
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
    const stats = computeLiveBusinessStats();
    const resolveBindingVal = (b) => {
      if (b.metricKey === "gmv") return `$${stats.gmv.toLocaleString()} USD`;
      if (b.metricKey === "shopee_sale") return `$${(stats.byShop["Shopee 泰国主店"]?.gmv || 0).toLocaleString()} USD`;
      if (b.metricKey === "net_profit") return `$${stats.netProfit.toLocaleString()} USD（净利率 ${stats.marginPct}%）`;
      if (b.metricKey === "ad_spend") return `$${stats.adSpend.toLocaleString()} USD（占比 ${stats.acosPct}%）`;
      return b.val;
    };
    return {
      headerActions: [
        { label: "进入智能问答助手 →", primary: true, onClick: () => goPage("m3b") }
      ],
      html: `
        <div class="banner banner-blue">
          <span><strong>页面定位：</strong>统一管理核心经营指标的计算口径与定时更新任务；内部指标数值与 M0 订单台账、M2 经营大屏完全同源一致。外部数据源尚未接入时状态会诚实显示「数据源未响应」，可点击「立即更新」重试。</span>
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
                    <td class="nowrap"><strong>${resolveBindingVal(b)}</strong></td>
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
              ${state.qaChat.map((m, idx) => {
                const bodyText = m.metricLiveSummary
                  ? `全部实盘店铺近 30 天总销售额 $${stats.gmv.toLocaleString()}，净利润 $${stats.netProfit.toLocaleString()}（净利率 ${stats.marginPct}%，共 ${stats.ordersCnt} 笔实盘订单，客单价 $${stats.aov}）。`
                  : m.text;
                return `
                <div class="chat-bubble ${m.role==="user"?"user":"assistant"}" style="${m.blocked?"background:var(--red-bg);border-color:#fca5a5;color:var(--red-text);":""}">
                  <div style="font-weight:${m.role==="user"?600:500};">${bodyText}</div>
                  ${m.note ? `<div style="font-size:12px;color:var(--text-soft);margin-top:5px;">${m.note}</div>` : ""}
                  ${m.queryDesc ? `<div style="font-size:12px;background:#ffffff;border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-top:6px;color:var(--text-muted);">${m.queryDesc}</div>` : ""}
                  ${m.role==="assistant" && !m.blocked ? `
                    <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
                      <button class="btn btn-sm qa-fb" data-idx="${idx}" data-val="UP" style="${m.feedback==="UP"?"border-color:var(--green);color:var(--green-text);font-weight:700;":""}">👍 有帮助</button>
                      <button class="btn btn-sm qa-fb" data-idx="${idx}" data-val="DOWN" style="${m.feedback==="DOWN"?"border-color:var(--red);color:var(--red-text);font-weight:700;":""}">👎 没帮助</button>
                    </div>
                  ` : ""}
                </div>
              `;
              }).join("")}
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
