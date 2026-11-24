import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import M7RelayBar from "@/components/M7RelayBar.vue";
import { ALL_9_ROLES, usePermission } from "@/composables/usePermission";
import { useM7ComplianceStore } from "@/stores/m7Compliance";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import M7CompliancePackView from "@/views/m7/M7CompliancePackView.vue";

vi.mock("@/api/m7", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/api/m7")>();
  return {
    ...mod,
    m7Api: {
      ...mod.m7Api,
      getHealth: vi.fn().mockResolvedValue({
        status: "ok",
        dashscope_key_configured: false,
        video_ready: false,
        strict_separation_of_duties: true,
      }),
      listAvailableProducts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getEnginesStatus: vi.fn().mockResolvedValue({ engines: [] }),
      getPackageSummary: vi.fn().mockResolvedValue(null),
      listAuditEvents: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getComplianceMatrix: vi.fn().mockResolvedValue({ rules: [], certs: [] }),
    },
  };
});

describe("M7 Frontend RBAC & Components", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("enforces all 9 roles permission matrix accurately", () => {
    const ws = useM7WorkspaceStore();
    const { canRead, canEdit, canApprove, canMaintainRules, canExport } = usePermission();

    expect(ALL_9_ROLES.length).toBe(9);

    ws.currentRole = "creator";
    expect(canRead.value).toBe(true);
    expect(canEdit.value).toBe(true);
    expect(canApprove.value).toBe(false);
    expect(canMaintainRules.value).toBe(false);
    expect(canExport.value).toBe(true);

    ws.currentRole = "approver";
    expect(canRead.value).toBe(true);
    expect(canApprove.value).toBe(true);
    expect(canMaintainRules.value).toBe(true);

    for (const readonlyRole of ["manager", "planner", "selector"]) {
      ws.currentRole = readonlyRole;
      expect(canRead.value).toBe(true);
      expect(canEdit.value).toBe(false);
      expect(canApprove.value).toBe(false);
    }

    for (const deniedRole of ["bi_analyst", "warehouse", "cs", "mock_buyer"]) {
      ws.currentRole = deniedRole;
      expect(canRead.value).toBe(false);
      expect(canEdit.value).toBe(false);
    }
  });

  it("renders relay progress and buyer preview without NaN", async () => {
    const ws = useM7WorkspaceStore();
    ws.products = [
      {
        sku: "SKU-00704",
        name: "空气炸锅 5.5L",
        origin: "M4_APPROVED",
        category: "kitchen_appliance",
        category_label_zh: "厨电家居",
        platform: "amazon_us",
        sale_price_usd: 79.99,
        strike_price_usd: null,
        approver: "王总监",
        decision_reason: "M4 approved",
        brand_name: "AeroChef",
        specs: { capacity: "5.5L" },
        selling_points: ["1700W rapid air"],
        faq: { pain_points: ["Non-stick cleaning"], faq_pairs: [] },
        progress_hint: { core_copy_done: 4, ext_copy_done: 2 },
      },
    ];
    ws.summary = {
      sku: "SKU-00704",
      platform: "amazon_us",
      product_name: "空气炸锅 5.5L",
      done_cnt: 7,
      ext_done_cnt: 2,
      core_items: [
        { slot: "copy_title", label: "Title", done: true, jump_route: "/m7/copy" },
        { slot: "copy_bullets", label: "Bullets", done: true, jump_route: "/m7/copy" },
        { slot: "copy_desc", label: "Desc", done: true, jump_route: "/m7/copy" },
        { slot: "copy_search_terms", label: "ST", done: true, jump_route: "/m7/copy" },
        { slot: "img_pack_1_4", label: "Images", done: true, jump_route: "/m7/images" },
        { slot: "vid_15s", label: "Video", done: false, jump_route: "/m7/video-aplus" },
        { slot: "aplus_page", label: "A+", done: true, jump_route: "/m7/video-aplus" },
        { slot: "compliance_5check", label: "5-Check", done: true, jump_route: "/m7/compliance" },
      ],
      ext_items: [],
      missing_items: [{ slot: "vid_15s", label: "Video", done: false, jump_route: "/m7/video-aplus" }],
      last_editor_id: "u-lin",
      selected_copy_assets: {},
      latest_check: null,
      active_approval: null,
      approval_status: "PENDING_CHECK",
      buyer_preview: {
        banner: "预览，尚未发布 · MOCK",
        is_mock: true,
        title: "5.5L Air Fryer",
        sale_price_usd: 79.99,
        strike_price_usd: null,
        discount_pct: null,
        bullets: ["Easy clean basket"],
        description: "Reliable 5.5L kitchen air fryer.",
        specs: { capacity: "5.5L" },
        images: [],
        video: null,
        aplus_html: "",
      },
    };

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/m7/copy", component: { template: "<div/>" } },
        { path: "/m7/images", component: { template: "<div/>" } },
        { path: "/m7/video-aplus", component: { template: "<div/>" } },
        { path: "/m7/compliance", component: M7CompliancePackView },
      ],
    });
    await router.push("/m7/compliance");
    await router.isReady();

    const relayWrapper = mount(M7RelayBar, {
      global: { plugins: [router] },
    });
    expect(relayWrapper.text()).toContain("核心交付进度 7/8");
    expect(relayWrapper.text()).toContain("扩展文案 2/6");

    // Creator cannot click approve button
    ws.currentRole = "creator";
    const comp = useM7ComplianceStore();
    comp.buyerDrawerOpen = true;

    const compWrapper = mount(M7CompliancePackView, {
      global: { plugins: [router] },
    });
    const approveBtn = compWrapper.find("#m7ApproveBtn");
    expect((approveBtn.element as HTMLButtonElement).disabled).toBe(true);
    expect(compWrapper.text()).not.toContain("NaN");
    expect(compWrapper.text()).toContain("预览，尚未发布");

    // Approver enables approve button
    ws.currentRole = "approver";
    await compWrapper.vm.$nextTick();
    expect((approveBtn.element as HTMLButtonElement).disabled).toBe(false);
  });
});
