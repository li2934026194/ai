import { MODULE_DEFS, PAGE_META } from "./annotations.js";
import { SRS_ROLES, createInitialState, getRoleTodos } from "./state.js";
import { renderM0_M3 } from "./pages_m0_m3.js";
import { renderM4_M6 } from "./pages_m4_m6.js";
import { renderM7_M8 } from "./pages_m7_m8.js";

const ROLE_HINTS = Object.fromEntries(SRS_ROLES.map(r => [r.key, r.desc]));
const state = createInitialState();

function toast(msg) {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBd">
      <div class="modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:15.5px;">${title}</strong>
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
  window.location.hash = pageId;
  rerender();
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
      // Accordion behavior: clicking closed module opens it & collapses others; clicking open module collapses it
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

  // Render Page Content
  const helpers = { toast, goPage, openModal, closeModal, openDrawer, closeDetailDrawer, rerender };
  const view = renderM0_M3(state.pageId, state, helpers) || renderM4_M6(state.pageId, state, helpers) || renderM7_M8(state.pageId, state, helpers);

  const actBox = document.getElementById("headerActions");
  actBox.innerHTML = "";
  (view.headerActions || []).forEach(a => {
    const btn = document.createElement("button");
    btn.className = `btn ${a.primary ? "btn-primary" : ""}`;
    btn.textContent = a.label;
    btn.onclick = a.onClick;
    actBox.appendChild(btn);
  });

  document.getElementById("pageBody").innerHTML = view.html;
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

// Init Events
const roleSelEl = document.getElementById("roleSelect");
roleSelEl.value = state.role;
roleSelEl.onchange = (e) => {
  state.role = e.target.value;
  rerender();
  toast(`已切换登录角色：${SRS_ROLES.find(r=>r.key===state.role)?.label || state.role}`);
};

document.getElementById("toggleAnnoBtn").onclick = () => { state.showAnno = !state.showAnno; rerender(); };
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
