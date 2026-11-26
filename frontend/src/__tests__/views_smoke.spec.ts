import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";

import HomeWorkbenchView from "@/views/HomeWorkbenchView.vue";
import M0ShopsView from "@/views/m0/M0ShopsView.vue";
import M0LedgerView from "@/views/m0/M0LedgerView.vue";
import M0InventoryView from "@/views/m0/M0InventoryView.vue";
import M1SessionsView from "@/views/m1/M1SessionsView.vue";
import M1FaqsView from "@/views/m1/M1FaqsView.vue";
import M1AftersalesView from "@/views/m1/M1AftersalesView.vue";
import M1SimulatorView from "@/views/m1/M1SimulatorView.vue";
import M2OverviewView from "@/views/m2m3/M2OverviewView.vue";
import M2AdsView from "@/views/m2m3/M2AdsView.vue";
import M3CompetitorsView from "@/views/m2m3/M3CompetitorsView.vue";
import M3AskView from "@/views/m2m3/M3AskView.vue";
import M4ImportView from "@/views/m4/M4ImportView.vue";
import M4WorkbenchView from "@/views/m4/M4WorkbenchView.vue";
import M4ApprovalView from "@/views/m4/M4ApprovalView.vue";
import M5ProfilesView from "@/views/m5m6/M5ProfilesView.vue";
import M5ForecastView from "@/views/m5m6/M5ForecastView.vue";
import M5ReviewView from "@/views/m5m6/M5ReviewView.vue";
import M6StandardView from "@/views/m5m6/M6StandardView.vue";
import M6SmartView from "@/views/m5m6/M6SmartView.vue";
import M6AppliesView from "@/views/m5m6/M6AppliesView.vue";
import M6ReceivingView from "@/views/m5m6/M6ReceivingView.vue";
import M7CopyWorkbench from "@/views/m7/M7CopyWorkbench.vue";
import M7ImageStudio from "@/views/m7/M7ImageStudio.vue";
import M7VideoAplusView from "@/views/m7/M7VideoAplusView.vue";
import M7CompliancePackView from "@/views/m7/M7CompliancePackView.vue";
import M8UsersView from "@/views/m8/M8UsersView.vue";
import M8RolesView from "@/views/m8/M8RolesView.vue";

vi.mock("@/api/platform", () => ({
  platformApi: {
    getHomeWorkbench: vi.fn().mockResolvedValue({
      kpis: { active_skus: 5, connected_shops: 3, gmv_usd: 1200, open_alerts: 1, pending_replenish: 1, pending_aftersales: 1 },
      todos: [{ id: "1", module: "M4", title: "待审", desc: "描述", route: "/m4/approval" }],
    }),
    listShops: vi.fn().mockResolvedValue({
      items: [{ shop_id: "s1", shop_code: "SH-DEMO", shop_name: "Demo", platform: "amazon_us", region: "US", status: "CONNECTED", is_mock: true, credential_mask: "****4821", last_synced_at: "2026-11-18" }],
    }),
    listProducts: vi.fn().mockResolvedValue({
      items: [{ sku: "SKU-00704", name: "封口机", category: "kitchen_appliance", unit_cost_usd: 5.5, sale_price_usd: 29.99, moq: 60, pack_size: 20, lead_time_days: 21, origin: "SEED" }],
    }),
    listCostRequests: vi.fn().mockResolvedValue({ items: [] }),
    listLedger: vi.fn().mockResolvedValue({ orders: [], quotes: [] }),
    listFxRates: vi.fn().mockResolvedValue({ items: [{ base_ccy: "USD", quote_ccy: "RMB", rate: 7.2, updated_at: "2026-11-18" }] }),
    listInventory: vi.fn().mockResolvedValue({ items: [{ inv_id: "i1", warehouse_code: "WH-US", sku: "SKU-00704", on_hand: 25, in_transit: 10, reserved: 2, available: 25, last_stocktake_by: "usr_wh" }] }),
    listFaqs: vi.fn().mockResolvedValue({ items: [{ faq_id: "f1", sku: "SKU-00704", pain_points: ["漏气"], faq_pairs: [{ q: "Q", a: "A" }] }] }),
    listSessions: vi.fn().mockResolvedValue({ items: [{ session_id: "cs1", sku: "SKU-00704", buyer_name: "Bob", channel: "Sim", question: "Hi", reply: "Hello", is_mock: true, status: "OPEN" }] }),
    listAftersales: vi.fn().mockResolvedValue({ items: [] }),
    getM2Overview: vi.fn().mockResolvedValue({
      summary: { total_gmv_usd: 1000, net_profit_usd: 320, margin_pct: 32, ad_spend_7d_usd: 50, approved_refund_usd: 10, po_commitment_rmb: 4000, include_mock: false, mock_excluded_count: 2, live_order_count: 10 },
      sku_profits: [{ sku: "SKU-00704", name: "封口机", units: 20, gmv_usd: 600, cogs_usd: 110, platform_fee_usd: 90, net_profit_usd: 400 }],
      trend_30d: [{ date: "2026-11-18", units: 10, revenue_usd: 300 }],
      settlements: [{ period: "2026-11", channel: "Amazon US", gross_usd: 650, net_payout_usd: 500, status: "SETTLED" }],
    }),
    listAds: vi.fn().mockResolvedValue({ items: [{ campaign_id: "ad1", sku: "SKU-00704", platform: "Amazon", campaign_name: "Camp1", spend_7d_usd: 50, sales_7d_usd: 200, acos: 0.25, roas: 4, daily_budget_usd: 40, status: "ACTIVE", high_acos_alert: false }] }),
    listCompetitors: vi.fn().mockResolvedValue({ items: [] }),
    askBiAssistant: vi.fn().mockResolvedValue({ answer: "【口径溯源】GMV $1000", lineage_sources: ["m0_orders"], metrics: {}, open_alerts_count: 0, pending_applies_count: 0 }),
    listCandidates: vi.fn().mockResolvedValue({ items: [{ candidate_id: "c1", sku: "NEW-1", name: "Cand1", source_nature: "internal_live", fulfillment_mode: "FBA", target_price_usd: 35, est_cost_rmb: 45, est_shipping_rmb: 15, est_margin_pct: 0.32, total_score: 86, scores: { demand: 85, competition: 80, margin: 90, supply: 85, compliance: 85 }, status: "DISCOVERED", ip_risk_note: "" }] }),
    getForecast: vi.fn().mockResolvedValue({
      sku: "SKU-00704",
      best_model: "moving_avg",
      per_model: { moving_avg: { wape: 0.12, bias: 0.01, mae: 1.5, n_obs: 30 } },
      series_tail: [{ date: "2026-11-18", qty_raw: 12, qty_calibrated: 12, on_hand_eod: 80, is_stockout: false }],
      suggestion: { qty: 120, ss: 20, rop: 50, target_s: 150, z: 1.65, service_level: 0.95, zero_days: 0, on_hand: 80, in_transit: 0, inputs_json: { mu_daily: 10, sigma_daily: 2, stockout_forward: { zero_days: 0, first_zero_date: null } } },
      route_plan: { routes: [{ code: "sea", name: "海运", transit_days: 30, total_freight: 800, risk_level: "低", risk_index: 0.1, recommendation: "推荐" }], objectives: [{ code: "profit", name: "保利润", service_level: 0.97, qty: 120, capital: 4800 }] },
    }),
    runSandbox: vi.fn().mockResolvedValue({ qty_suggest: 120, amount_rmb: 4800, lead_time_total: 25, ss: 20, rop: 50, target_s: 150, stockout_forward: { coverage_days: 90, zero_days: 0, first_zero_date: null } }),
    listApplies: vi.fn().mockResolvedValue({ items: [] }),
    listPos: vi.fn().mockResolvedValue({ items: [] }),
    listAlerts: vi.fn().mockResolvedValue({ items: [] }),
    listWeeklyReviews: vi.fn().mockResolvedValue({ items: [] }),
    listUsers: vi.fn().mockResolvedValue({ items: [{ user_id: "usr_cs", display_name: "李客服", role_code: "cs", email: "li@x.ai", is_active: true, allowed_shop_ids: [] }] }),
    listRoles: vi.fn().mockResolvedValue({ items: [] }),
    listPolicies: vi.fn().mockResolvedValue({ items: [] }),
    listAudits: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

vi.mock("@/api/m7", () => ({
  m7Api: {
    getAvailableProducts: vi.fn().mockResolvedValue({ items: [{ sku: "SKU-00704", name: "封口机", category: "kitchen_appliance", category_label_zh: "厨卫小电", platform: "amazon_us", sale_price_usd: 29.99, origin: "SEED", selling_points: [], specs: {}, faq: { pain_points: [], faq_pairs: [] }, progress_hint: { core_copy_done: 0, ext_copy_done: 0 } }] }),
    getAssets: vi.fn().mockResolvedValue({ copy: [], images: [], video: [], aplus: [], selected_slots: [], progress: {} }),
    getRules: vi.fn().mockResolvedValue({ items: [] }),
    getCerts: vi.fn().mockResolvedValue({ items: [] }),
    getPublishPackage: vi.fn().mockResolvedValue({ package: null, gates: [] }),
    getAudits: vi.fn().mockResolvedValue({ items: [] }),
    listComplianceChecks: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

const ALL_VIEWS: Array<[string, any]> = [
  ["HomeWorkbenchView", HomeWorkbenchView],
  ["M0ShopsView", M0ShopsView],
  ["M0LedgerView", M0LedgerView],
  ["M0InventoryView", M0InventoryView],
  ["M1SessionsView", M1SessionsView],
  ["M1FaqsView", M1FaqsView],
  ["M1AftersalesView", M1AftersalesView],
  ["M1SimulatorView", M1SimulatorView],
  ["M2OverviewView", M2OverviewView],
  ["M2AdsView", M2AdsView],
  ["M3CompetitorsView", M3CompetitorsView],
  ["M3AskView", M3AskView],
  ["M4ImportView", M4ImportView],
  ["M4WorkbenchView", M4WorkbenchView],
  ["M4ApprovalView", M4ApprovalView],
  ["M5ProfilesView", M5ProfilesView],
  ["M5ForecastView", M5ForecastView],
  ["M5ReviewView", M5ReviewView],
  ["M6StandardView", M6StandardView],
  ["M6SmartView", M6SmartView],
  ["M6AppliesView", M6AppliesView],
  ["M6ReceivingView", M6ReceivingView],
  ["M7CopyWorkbench", M7CopyWorkbench],
  ["M7ImageStudio", M7ImageStudio],
  ["M7VideoAplusView", M7VideoAplusView],
  ["M7CompliancePackView", M7CompliancePackView],
  ["M8UsersView", M8UsersView],
  ["M8RolesView", M8RolesView],
];

describe("All 28 Platform Vue Views Smoke & UI Checks", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it.each(ALL_VIEWS)("mounts %s cleanly without runtime errors", async (_name, Comp) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:pathMatch(.*)*", component: Comp }],
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(Comp, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();
    expect(wrapper.html().length).toBeGreaterThan(20);
  });

  it("renders mock shop warning badge in M0ShopsView & MOCK session pill in M1SessionsView", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: M0ShopsView }] });
    await router.push("/");
    const w0 = mount(M0ShopsView, { global: { plugins: [router] } });
    await flushPromises();
    expect(w0.text()).toContain("SH-DEMO");
    expect(w0.text()).toContain("仅演示");

    const w1 = mount(M1SessionsView, { global: { plugins: [router] } });
    await flushPromises();
    expect(w1.text()).toContain("MOCK");
    expect(w1.text()).toContain("转入售后建单");
  });
});
