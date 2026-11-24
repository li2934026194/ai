import { MODULE_DEFS, PAGE_META } from "./annotations.js";
import { BIZ_ROLES, ROLE_PERSON_NAMES, createInitialState, getRoleTodos, appendAuditLog } from "./state.js";
import { renderM0_M3 } from "./pages_m0_m3.js";
import { renderM4_M6 } from "./pages_m4_m6.js";
import { renderM7_M8 } from "./pages_m7_m8.js";

const ROLE_HINTS = Object.fromEntries(BIZ_ROLES.map(r => [r.key, r.desc]));
let state = createInitialState();

function findModuleOfPage(pid) {
  return MODULE_DEFS.find(m => m.pages.some(p => p.id === pid)) || MODULE_DEFS[0];
}

function toast(msg, level = "info") {
  const box = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${level === "error" ? "toast-error" : level === "warn" ? "toast-warn" : level === "success" ? "toast-success" : ""}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 250); }, 3600);
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:16px;">${title}</strong>
          <button class="btn btn-sm" id="modalCloseBtn">✕</button>
        </div>
        <div>${bodyHtml}</div>
      </div>
    </div>
  `;
  root.querySelector("#modalCloseBtn").onclick = closeModal;
  root.querySelector(".modal-backdrop").onclick = (e) => { if (e.target === root.querySelector(".modal-backdrop")) closeModal(); };
  if (onMount) onMount(root);
}

/**
 * 统一业务写操作提交器（影响面提示 -> 字段校验 -> 二次确认 -> 留痕反馈）
 */
function commitAction({
  title,
  summary = "",
  fieldsHtml = "",
  confirmText = "确认执行",
  danger = false,
  validate = null,
  onMount = null,
  onConfirm,
  audit = null,
}) {
  openModal(title, `
    ${summary ? `<div class="banner ${danger ? "banner-red" : "banner-blue"}" style="margin-bottom:12px;"><span>${summary}</span></div>` : ""}
    <div id="commitFieldsWrap">${fieldsHtml}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
      <button class="btn" id="commitCancelBtn">取消</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="commitConfirmBtn">${confirmText}</button>
    </div>
  `, (root) => {
    const wrap = root.querySelector("#commitFieldsWrap");
    if (onMount) onMount(wrap, root);
    root.querySelector("#commitCancelBtn").onclick = closeModal;
    root.querySelector("#commitConfirmBtn").onclick = () => {
      wrap.querySelectorAll(".input-err").forEach(el => el.classList.remove("input-err"));
      wrap.querySelectorAll(".field-err").forEach(el => el.remove());

      if (validate) {
        const errs = validate(wrap) || [];
        if (errs.length > 0) {
          errs.forEach(err => {
            if (err.el) {
              err.el.classList.add("input-err");
              const msg = document.createElement("div");
              msg.className = "field-err";
              msg.textContent = err.msg;
              err.el.parentElement.appendChild(msg);
            }
          });
          toast(errs[0].msg || "请检查红色标注的必填信息", "error");
          return;
        }
      }

      const res = onConfirm(wrap) || {};
      if (res === false || res.cancel) return;
      if (audit) {
        const entry = typeof audit === "function" ? audit(wrap, res) : audit;
        if (entry) appendAuditLog(state, entry);
      }
      closeModal();
      rerender();
      if (res.toastMsg !== false) {
        toast(res.toastMsg || `${title} 已完成并记录审计`, res.toastLevel || "success");
      }
    };
  });
}

/**
 * 异步任务执行器：排队中 -> 处理中 (进度%) -> 已完成 / 失败（支持重试与排查指引）
 */
function runAsyncTask(key, { label, steps, durationMs = 1100, shouldFail = false, failReason = "外部服务暂未连接，请检查网络或配置后重试", onSuccess, onFail }) {
  state.asyncTasks[key] = { status: "排队中", progress: 15, label, stepText: "任务排队等待处理…", retryOpts: { label, steps, durationMs, shouldFail, failReason, onSuccess, onFail } };
  rerender();

  setTimeout(() => {
    if (!state.asyncTasks[key]) return;
    state.asyncTasks[key].status = "处理中";
    state.asyncTasks[key].progress = 58;
    state.asyncTasks[key].stepText = (steps && steps[1]) || "正在校验业务数据与状态…";
    rerender();
  }, Math.round(durationMs * 0.38));

  setTimeout(() => {
    if (!state.asyncTasks[key]) return;
    if (shouldFail) {
      state.asyncTasks[key].status = "失败";
      state.asyncTasks[key].progress = 100;
      state.asyncTasks[key].stepText = failReason;
      if (onFail) onFail();
      appendAuditLog(state, { target: label, action: "执行任务未通过", detail: failReason, ok: false });
      rerender();
      toast(`${label} 未完成：${failReason}`, "error");
    } else {
      const outcome = onSuccess ? (onSuccess() || {}) : {};
      state.asyncTasks[key].status = "已完成";
      state.asyncTasks[key].progress = 100;
      state.asyncTasks[key].stepText = outcome.summary || "任务已处理完成并更新结果";
      appendAuditLog(state, { target: label, action: "完成任务处理", detail: outcome.summary || "成功", ok: true });
      rerender();
      toast(outcome.toastMsg || `${label} 已完成`, outcome.toastLevel || "success");
    }
  }, durationMs);
}

function renderAsyncBox(key) {
  const t = state.asyncTasks[key];
  if (!t) return "";
  const isErr = t.status === "失败";
  const isOk = t.status === "已完成";
  return `
    <div class="async-card" style="margin-bottom:12px;border-color:${isErr ? "#fca5a5" : isOk ? "#a7f3d0" : "var(--blue-border)"};background:${isErr ? "var(--red-bg)" : isOk ? "var(--green-bg)" : "#f8fbff"};">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div>
          <strong>${t.label}</strong>
          <span class="pill ${isErr ? "p-red" : isOk ? "p-green" : "p-blue"}" style="margin-left:8px;">${t.status} · ${t.progress}%</span>
        </div>
        <div style="display:flex;gap:6px;">
          ${isErr ? `<button class="btn btn-sm btn-danger async-retry-btn" data-tkey="${key}">↻ 重试</button>` : ""}
          ${(isOk || isErr) ? `<button class="btn btn-sm async-dismiss-btn" data-tkey="${key}">关闭提示</button>` : ""}
        </div>
      </div>
      <div class="async-bar"><div class="async-fill" style="width:${t.progress}%;background:${isErr ? "var(--red)" : isOk ? "var(--green)" : "var(--blue)"};"></div></div>
      <div style="font-size:12.5px;color:${isErr ? "var(--red-text)" : "var(--text-muted)"};">${t.stepText}</div>
    </div>
  `;
}

function openDrawer(title, sub, bodyHtml, onMount) {
  document.getElementById("detailDrawerTitle").textContent = title;
  document.getElementById("detailDrawerSub").textContent = sub || "";
  const body = document.getElementById("detailDrawerBody");
  body.innerHTML = bodyHtml;
  document.getElementById("detailDrawer").classList.remove("hidden");
  document.getElementById("detailDrawerBackdrop").classList.remove("hidden");
  if (onMount) onMount(body);
}

function closeDetailDrawer() {
  document.getElementById("detailDrawer").classList.add("hidden");
  document.getElementById("detailDrawerBackdrop").classList.add("hidden");
}

function goPage(pid) {
  if (!PAGE_META[pid]) return;
  state.pageId = pid;
  state.openModuleId = findModuleOfPage(pid).id;
  window.location.hash = pid;
  rerender();
}

function record403(target, reason) {
  const actorName = ROLE_PERSON_NAMES[state.role] || "当前操作人";
  const curLabel = BIZ_ROLES.find(r => r.key === state.role)?.label || state.role;
  appendAuditLog(state, {
    sentence: `${actorName}（${curLabel}）尝试操作「${target}」，因权限不足被系统拦截：${reason}`,
    ok: false,
  });
  toast(`当前岗位「${curLabel}」无权执行：${reason}`, "error");
}

function computeLiveBusinessStats() {
  const realOrders = state.orders.filter(o => o.mode === "REAL");
  const syncedDeltaUsd = realOrders.filter(o => !o.historical).reduce((s, o) => s + o.amountUsd, 0);
  const syncedDeltaCnt = realOrders.filter(o => !o.historical).length;
  const gmv = +(125429.99 + syncedDeltaUsd).toFixed(2);
  const ordersCnt = 1536 + syncedDeltaCnt;
  const netProfit = +(65529.67 + syncedDeltaUsd * 0.52).toFixed(2);
  const adSpend = 18650.16;
  const marginPct = ((netProfit / gmv) * 100).toFixed(1);
  const acosPct = ((adSpend / gmv) * 100).toFixed(1);
  const aov = (gmv / ordersCnt).toFixed(2);
  const realLowStocks = state.inventoryItems.filter(i => i.shopMode === "REAL" && i.avail < i.safety);
  return { gmv, ordersCnt, netProfit, adSpend, marginPct, acosPct, aov, realLowStocks, syncedDeltaCnt };
}

function rerender() {
  const mod = findModuleOfPage(state.pageId);
  const meta = PAGE_META[state.pageId];
  const todos = getRoleTodos(state);

  document.getElementById("roleHint").textContent = ROLE_HINTS[state.role] || "";

  document.getElementById("sidebarNav").innerHTML = MODULE_DEFS.map(m => {
    const isOpen = state.openModuleId === m.id;
    const isModActive = mod.id === m.id;
    const modTodoCount = m.pages.filter(p => todos[p.id]).length;
    return `
      <div class="nav-group ${isOpen ? "open" : ""}">
        <div class="nav-parent ${isOpen ? "open" : ""} ${isModActive ? "active-mod" : ""}" data-mod="${m.id}">
          <div class="nav-parent-left">
            <span class="nav-caret">▸</span>
            <span>${m.label}</span>
          </div>
          <div class="nav-parent-right">
            ${modTodoCount ? `<span class="nav-todo">待办 ${modTodoCount}</span>` : `<span class="nav-count">${m.pages.length}</span>`}
          </div>
        </div>
        <div class="nav-children">
          ${m.pages.map(p => `
            <div class="nav-child ${state.pageId === p.id ? "active" : ""}" data-page="${p.id}">
              <span class="nav-child-label">${p.label}</span>
              ${todos[p.id] ? `<span class="nav-dot-todo" title="当前岗位有待办事项"></span>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".nav-parent").forEach(el => {
    el.onclick = () => {
      const mid = el.dataset.mod;
      state.openModuleId = state.openModuleId === mid ? "" : mid;
      rerender();
    };
  });
  document.querySelectorAll(".nav-child").forEach(el => {
    el.onclick = () => goPage(el.dataset.page);
  });

  const curPageObj = mod.pages.find(p => p.id === state.pageId) || mod.pages[0];
  document.getElementById("breadcrumb").textContent = `${mod.label}  /  ${curPageObj.label}`;
  document.getElementById("pageTitle").textContent = meta.title;
  document.getElementById("pageSubtitle").textContent = meta.subtitle;

  const helpers = {
    toast, goPage, openModal, closeModal, openDrawer, closeDetailDrawer,
    rerender, commitAction, runAsyncTask, renderAsyncBox, computeLiveBusinessStats, record403
  };
  const pageResult =
    renderM0_M3(state.pageId, state, helpers) ||
    renderM4_M6(state.pageId, state, helpers) ||
    renderM7_M8(state.pageId, state, helpers) ||
    { headerActions: [], html: `<div class="card">页面建设中</div>`, bind: () => {} };

  const hBox = document.getElementById("headerActions");
  hBox.innerHTML = "";
  (pageResult.headerActions || []).forEach(act => {
    const btn = document.createElement("button");
    btn.className = `btn ${act.primary ? "btn-primary" : act.danger ? "btn-danger" : ""}`;
    btn.textContent = act.label;
    if (act.disabled) {
      btn.disabled = true;
      btn.title = act.disabledTitle || "当前登录岗位无权操作（请在左侧切换对应岗位）";
    }
    btn.onclick = () => {
      if (btn.disabled) return;
      act.onClick();
    };
    hBox.appendChild(btn);
  });

  document.getElementById("pageBody").innerHTML = pageResult.html;

  document.querySelectorAll(".async-retry-btn").forEach(b => {
    b.onclick = () => {
      const t = state.asyncTasks[b.dataset.tkey];
      if (t && t.retryOpts) runAsyncTask(b.dataset.tkey, t.retryOpts);
    };
  });
  document.querySelectorAll(".async-dismiss-btn").forEach(b => {
    b.onclick = () => { delete state.asyncTasks[b.dataset.tkey]; rerender(); };
  });

  if (pageResult.bind) pageResult.bind();

  // 业务规则说明抽屉（纯业务管理语言，无代码编号与字段）
  const annoBtn = document.getElementById("toggleAnnoBtn");
  annoBtn.classList.toggle("active", state.showAnno);
  document.getElementById("annoDrawer").classList.toggle("hidden", !state.showAnno);
  document.getElementById("annoDrawerBackdrop").classList.toggle("hidden", !state.showAnno);

  document.getElementById("annoPageTitle").textContent = `业务规则说明 · ${curPageObj.label}`;
  document.getElementById("annoCards").innerHTML = (meta.blocks || []).map((b, idx) => `
    <div class="anno-card" style="border-left-color:${b.color}">
      <div class="anno-card-head">
        <span class="anno-tag" style="background:${b.color};width:20px;height:20px;font-size:12px;">${idx + 1}</span>
        <span>${b.title}</span>
      </div>
      <div class="anno-line anno-k-step">【管理目的】${b.why}</div>
      <div class="anno-line anno-k-rule">【制度约束】${b.rule}</div>
      <div class="anno-line anno-k-tech">【负责岗位】${b.owner}</div>
      <div class="anno-line anno-k-rule">【异常处理】${b.fix}</div>
    </div>
  `).join("");

  document.getElementById("ledgerGrid").innerHTML = (meta.ledger || []).map(([term, kind, src]) => `
    <div class="ledger-row">
      <div class="ledger-row-top">
        <span class="ledger-term">${term}</span>
        <span class="${kind.includes("规则") || kind.includes("实时") ? "ledger-kind-rule" : "ledger-kind-mock"}">${kind}</span>
      </div>
      <div class="ledger-src">${src}</div>
    </div>
  `).join("");
}

const roleSelectEl = document.getElementById("roleSelect");
roleSelectEl.onchange = (e) => {
  const prev = BIZ_ROLES.find(r => r.key === state.role)?.label || state.role;
  state.role = e.target.value;
  const next = BIZ_ROLES.find(r => r.key === state.role)?.label || state.role;
  appendAuditLog(state, {
    sentence: `演示岗位由「${prev}」切换为「${next}」`,
    ok: true,
  });
  rerender();
  toast(`已切换岗位：${next}（菜单红点待办与按钮权限已同步更新）`, "info");
};

document.getElementById("toggleAnnoBtn").onclick = () => {
  state.showAnno = !state.showAnno;
  rerender();
};
document.getElementById("closeAnnoDrawer").onclick = () => { state.showAnno = false; rerender(); };
document.getElementById("annoDrawerBackdrop").onclick = () => { state.showAnno = false; rerender(); };

document.getElementById("closeDetailDrawer").onclick = closeDetailDrawer;
document.getElementById("detailDrawerBackdrop").onclick = closeDetailDrawer;

const initHash = window.location.hash.replace("#", "");
if (PAGE_META[initHash]) {
  state.pageId = initHash;
  state.openModuleId = findModuleOfPage(initHash).id;
}
rerender();
