import { MODULE_DEFS, PAGE_META } from "./annotations.js";
import { SRS_ROLES, createInitialState, getRoleTodos, appendAuditLog } from "./state.js";
import { renderM0_M3 } from "./pages_m0_m3.js";
import { renderM4_M6 } from "./pages_m4_m6.js";
import { renderM7_M8 } from "./pages_m7_m8.js";

const ROLE_HINTS = Object.fromEntries(SRS_ROLES.map(r => [r.key, r.desc]));
const state = createInitialState();

function toast(msg, level = "info") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${level === "success" ? "toast-success" : level === "warn" ? "toast-warn" : level === "error" ? "toast-error" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBd">
      <div class="modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <strong style="font-size:16px;">${title}</strong>
          <button class="btn btn-sm" id="modalCloseBtn">✕</button>
        </div>
        <div>${bodyHtml}</div>
      </div>
    </div>
  `;
  document.getElementById("modalCloseBtn").onclick = closeModal;
  document.getElementById("modalBd").onclick = (e) => { if (e.target.id === "modalBd") closeModal(); };
  if (onMount) onMount();
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function clearModalErrors(container) {
  container.querySelectorAll(".input-err").forEach(el => el.classList.remove("input-err"));
  container.querySelectorAll(".field-err").forEach(el => el.remove());
}

function showFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add("input-err");
  const err = document.createElement("div");
  err.className = "field-err";
  err.textContent = message;
  inputEl.parentElement.appendChild(err);
  inputEl.focus();
}

/**
 * Unified confirmation + validation + execution + graded toast + audit closure
 */
function commitAction({ title, summary, fieldsHtml = "", confirmText = "确认执行", danger = false, validate, onConfirm, audit, onMount }) {
  openModal(title, `
    ${summary ? `<div class="banner ${danger ? "banner-red" : "banner-blue"}" style="margin-bottom:12px;">${summary}</div>` : ""}
    <div id="commitFormWrap">${fieldsHtml}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
      <button class="btn" id="commitCancelBtn">取消</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="commitOkBtn">${confirmText}</button>
    </div>
  `, () => {
    const wrap = document.getElementById("commitFormWrap");
    if (onMount) onMount(wrap);
    document.getElementById("commitCancelBtn").onclick = closeModal;
    document.getElementById("commitOkBtn").onclick = () => {
      clearModalErrors(wrap);
      if (validate) {
        const errors = validate(wrap) || [];
        if (errors.length > 0) {
          errors.forEach(({ el, msg }) => showFieldError(el, msg));
          toast(errors[0].msg, "error");
          return;
        }
      }
      try {
        const res = onConfirm ? onConfirm(wrap) : {};
        if (res === false) return;
        const auditInfo = typeof audit === "function" ? audit(wrap, res) : audit;
        if (auditInfo) {
          appendAuditLog(state, auditInfo);
        }
        closeModal();
        rerender();
        if (res && res.toastMsg) toast(res.toastMsg, res.toastLevel || "success");
      } catch (err) {
        toast(err.message || "操作失败", "error");
      }
    };
  });
}

/**
 * Async Task Runner: QUEUED -> RUNNING (progress%) -> SUCCESS / FAILED
 */
function runAsyncTask(key, { label, steps = ["校验输入参数", "执行队列处理", "写入结果与日志"], durationMs = 1100, shouldFail = false, failReason = "服务未连接或参数异常", onSuccess, onFail }) {
  state.asyncTasks[key] = { status: "QUEUED", progress: 12, label, stepText: "排队中 (QUEUED)...", retryOpts: { label, steps, durationMs, shouldFail, failReason, onSuccess, onFail } };
  rerender();

  setTimeout(() => {
    if (!state.asyncTasks[key]) return;
    state.asyncTasks[key].status = "RUNNING";
    state.asyncTasks[key].progress = 48;
    state.asyncTasks[key].stepText = `执行中：${steps[0] || "处理中"} (48%)`;
    rerender();
  }, Math.round(durationMs * 0.25));

  setTimeout(() => {
    if (!state.asyncTasks[key]) return;
    state.asyncTasks[key].progress = 82;
    state.asyncTasks[key].stepText = `执行中：${steps[1] || "校对回写"} (82%)`;
    rerender();
  }, Math.round(durationMs * 0.65));

  setTimeout(() => {
    const failed = typeof shouldFail === "function" ? shouldFail() : shouldFail;
    if (failed) {
      const reason = typeof failReason === "function" ? failReason() : failReason;
      state.asyncTasks[key] = {
        status: "FAILED", progress: 100, label, stepText: reason,
        retryOpts: { label, steps, durationMs, shouldFail, failReason, onSuccess, onFail }
      };
      appendAuditLog(state, { target: label, action: "异步任务失败", detail: reason, ok: false });
      if (onFail) onFail(reason);
      rerender();
      toast(`${label} 失败：${reason}`, "error");
      return;
    }
    const extra = onSuccess ? onSuccess() : {};
    state.asyncTasks[key] = {
      status: "SUCCESS", progress: 100, label,
      stepText: (extra && extra.summary) || `${steps[2] || "完成"} ✓`,
      retryOpts: { label, steps, durationMs, shouldFail, failReason, onSuccess, onFail }
    };
    appendAuditLog(state, { target: label, action: "异步任务完成", detail: state.asyncTasks[key].stepText, ok: true });
    rerender();
    toast((extra && extra.toastMsg) || `${label} 执行完成`, "success");
  }, durationMs);
}

function renderAsyncBox(key) {
  const t = state.asyncTasks[key];
  if (!t) return "";
  const color = t.status === "FAILED" ? "var(--red)" : t.status === "SUCCESS" ? "var(--green)" : "var(--blue)";
  return `
    <div class="async-card" style="border-color:${t.status==="FAILED"?"#fca5a5":t.status==="SUCCESS"?"#a7f3d0":"var(--blue-border)"};">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <strong>${t.label} · <span class="pill ${t.status==="FAILED"?"p-red":t.status==="SUCCESS"?"p-green":"p-blue"}">${t.status}</span></strong>
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-size:12px;color:var(--text-soft);">${t.stepText}</span>
          ${t.status === "FAILED" ? `<button class="btn btn-sm btn-primary async-retry-btn" data-task="${key}">↻ 重试</button>` : ""}
        </div>
      </div>
      <div class="async-bar"><div class="async-fill" style="width:${t.progress}%;background:${color};"></div></div>
    </div>
  `;
}

function openDrawer(title, sub, bodyHtml, onMount) {
  document.getElementById("detailDrawerTitle").textContent = title;
  document.getElementById("detailDrawerSub").textContent = sub;
  document.getElementById("detailDrawerBody").innerHTML = bodyHtml;
  document.getElementById("detailDrawer").classList.remove("hidden");
  document.getElementById("detailDrawerBackdrop").classList.remove("hidden");
  if (onMount) onMount();
}

function closeDetailDrawer() {
  document.getElementById("detailDrawer").classList.add("hidden");
  document.getElementById("detailDrawerBackdrop").classList.add("hidden");
}

function findModuleOfPage(pageId) {
  return MODULE_DEFS.find(m => m.pages.some(p => p.id === pageId)) || MODULE_DEFS[0];
}

function goPage(pageId) {
  state.pageId = pageId;
  state.openModuleId = findModuleOfPage(pageId).id;
  if (typeof window !== "undefined") window.location.hash = pageId;
  rerender();
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

  // Accordion Left Sidebar
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
            <div class="nav-child ${p.id === state.pageId ? "active" : ""}" data-pid="${p.id}">
              <span>${p.label}</span>
              ${todos[p.id] ? `<span class="nav-todo">${todos[p.id]}</span>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".nav-parent").forEach(el => {
    el.onclick = () => {
      const mId = el.dataset.mod;
      state.openModuleId = (state.openModuleId === mId) ? null : mId;
      rerender();
    };
  });
  document.querySelectorAll(".nav-child").forEach(el => {
    el.onclick = () => goPage(el.dataset.pid);
  });

  // Top Header
  document.getElementById("breadcrumb").textContent = meta.breadcrumb;
  document.getElementById("pageTitle").textContent = meta.title;
  document.getElementById("pageSubtitle").textContent = meta.subtitle;

  const helpers = {
    toast, goPage, openModal, closeModal, openDrawer, closeDetailDrawer,
    rerender, commitAction, runAsyncTask, renderAsyncBox, computeLiveBusinessStats,
    record403(target, detail) {
      appendAuditLog(state, { target, action: "权限拦截 (403)", detail, ok: false });
      toast(`权限不足（已写入审计台账）：${detail}`, "error");
      rerender();
    }
  };
  const view = renderM0_M3(state.pageId, state, helpers) || renderM4_M6(state.pageId, state, helpers) || renderM7_M8(state.pageId, state, helpers);

  const actBox = document.getElementById("headerActions");
  actBox.innerHTML = "";
  (view.headerActions || []).forEach(a => {
    const btn = document.createElement("button");
    btn.className = `btn ${a.primary ? "btn-primary" : ""}`;
    btn.textContent = a.label;
    if (a.disabled) {
      btn.disabled = true;
      btn.title = a.disabledTitle || "当前角色无权限执行此操作";
    }
    btn.onclick = a.onClick;
    actBox.appendChild(btn);
  });

  const bodyEl = document.getElementById("pageBody");
  bodyEl.innerHTML = view.html;
  bodyEl.querySelectorAll(".async-retry-btn").forEach(btn => {
    btn.onclick = () => {
      const t = state.asyncTasks[btn.dataset.task];
      if (t && t.retryOpts) runAsyncTask(btn.dataset.task, t.retryOpts);
    };
  });
  if (view.bind) view.bind();

  // Slide-over SRS Annotation Drawer
  const annoDrawer = document.getElementById("annoDrawer");
  const annoBd = document.getElementById("annoDrawerBackdrop");
  if (state.showAnno) {
    annoDrawer.classList.remove("hidden");
    annoBd.classList.remove("hidden");
  } else {
    annoDrawer.classList.add("hidden");
    annoBd.classList.add("hidden");
  }

  document.getElementById("annoPageTitle").textContent = `SRS注释与来源台账 · ${state.pageId.toUpperCase()}`;
  document.getElementById("annoCards").innerHTML = meta.blocks.map((b, idx) => `
    <div class="anno-card" style="border-left-color:${b.color};">
      <div class="anno-card-head">
        <span class="anno-tag" style="background:${b.color};">${idx + 1}</span>
        <span>${b.title}</span>
      </div>
      <div class="anno-line anno-k-step">【对应步骤】${b.step}</div>
      <div class="anno-line anno-k-srs">【SRS依据】${b.srs}</div>
      <div class="anno-line anno-k-tech">【技术支撑】${b.tech}</div>
    </div>
  `).join("");

  document.getElementById("ledgerGrid").innerHTML = meta.ledger.map(([term, kind, src]) => `
    <div class="ledger-row">
      <div class="ledger-row-top">
        <span class="ledger-term">${term}</span>
        <span class="${kind.includes("SRS") || kind.includes("参考") || kind.includes("实时") ? "ledger-kind-srs" : "ledger-kind-mock"}">${kind}</span>
      </div>
      <div class="ledger-src">${src}</div>
    </div>
  `).join("");
}

// Init Events (Unique role switcher: top-left roleSelect)
const roleSelEl = document.getElementById("roleSelect");
roleSelEl.value = state.role;
roleSelEl.onchange = (e) => {
  const prev = SRS_ROLES.find(r => r.key === state.role)?.label || state.role;
  state.role = e.target.value;
  const next = SRS_ROLES.find(r => r.key === state.role)?.label || state.role;
  appendAuditLog(state, { target: "全局身份切换 (roleSelect)", action: "切换体验角色", detail: `${prev} → ${next}`, ok: true });
  rerender();
  toast(`已切换登录角色：${next}`, "info");
};

document.getElementById("toggleAnnoBtn").onclick = () => { state.showAnno = !state.showAnno; rerender(); };
document.getElementById("closeAnnoDrawer").onclick = () => { state.showAnno = false; rerender(); };
document.getElementById("annoDrawerBackdrop").onclick = () => { state.showAnno = false; rerender(); };

document.getElementById("closeDetailDrawer").onclick = closeDetailDrawer;
document.getElementById("detailDrawerBackdrop").onclick = closeDetailDrawer;

const initHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
if (PAGE_META[initHash]) {
  state.pageId = initHash;
  state.openModuleId = findModuleOfPage(initHash).id;
}
rerender();
