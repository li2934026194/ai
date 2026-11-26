import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import M7RelayBar from "@/components/M7RelayBar.vue";
import { ALL_9_ROLES, usePermission } from "@/composables/usePermission";
import { useM7ComplianceStore } from "@/stores/m7Compliance";
import { highlightCopyHtml, useM7CopyStore } from "@/stores/m7Copy";
import { useM7MediaStore } from "@/stores/m7Media";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import M7CompliancePackView from "@/views/m7/M7CompliancePackView.vue";
import { MODULE_DEFS, PAGE_FLOW_META } from "@/data/navigation";
import appRouter from "@/router";

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

describe("M7 Frontend RBAC, Compliance & Components", () => {
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

  it("handles copy chips deduplication, regex metacharacters, XSS escape & empty edit guard", async () => {
    const copy = useM7CopyStore();
    copy.extraMust = "CrossPilot Lab";
    copy.appendMustChip("USB-C");
    copy.appendMustChip("USB-C");
    expect(copy.extraMust).toBe("CrossPilot Lab, USB-C");

    // TC-CMP-05 & TC-SEC-04: special regex characters + XSS escaping
    const html = highlightCopyHtml(
      'C++ 2.4G [Pro] #1 <script>alert(1)</script>',
      ["C++", "2.4G", "[Pro]"],
      ["#1"]
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<mark");

    // TC-FN-08: empty copy edit guard
    copy.editingAssetId = "ast_123";
    copy.editingText = "   ";
    await copy.saveManualEdit();
    expect(copy.errorMsg).toBe("修改后的文案不能为空");
  });

  it("guards M7-3 M7-1 copy reference and M7-4 empty approval note", async () => {
    const ws = useM7WorkspaceStore();
    const media = useM7MediaStore();
    ws.summary = null;
    expect(media.fillSegmentFromM7Copy(0)).toBe(false);
    expect(media.videoError).toContain("M7-1 尚未选定标题或五点描述");

    const comp = useM7ComplianceStore();
    comp.approveNote = "   ";
    await comp.approve("APPROVED");
    expect(comp.errorMsg).toBe("请填写主管审批意见");
  });

  it("renders relay progress, 6-tab overview, buyer preview without NaN, and RBAC gates", async () => {
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
        specs: { capacity: "5.5L", wattage: "" },
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
        { slot: "copy_kw", label: "KW", done: true, jump_route: "/m7/copy" },
        { slot: "img_0", label: "Main", done: true, jump_route: "/m7/images" },
        { slot: "img_1_4", label: "Images", done: true, jump_route: "/m7/images" },
        { slot: "aplus_page", label: "A+", done: true, jump_route: "/m7/video-aplus" },
        { slot: "vid_15s", label: "Video", done: false, jump_route: "/m7/video-aplus" },
      ],
      ext_items: [],
      missing_items: [{ slot: "vid_15s", label: "Video", done: false, jump_route: "/m7/video-aplus" }],
      last_editor_id: "u-lin",
      selected_copy_assets: {},
      latest_check: null,
      active_approval: null,
      approval_status: "PENDING_CHECK",
      buyer_preview: {
        banner: "预览，尚未发布",
        is_mock: true,
        title: "5.5L Air Fryer",
        sale_price_usd: 79.99,
        strike_price_usd: null,
        discount_pct: null,
        bullets: ["Easy clean basket"],
        description: "Reliable 5.5L kitchen air fryer.",
        specs: { capacity: "5.5L", wattage: "" },
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

    ws.currentRole = "creator";
    const compWrapper = mount(M7CompliancePackView, {
      global: { plugins: [router] },
    });
    const approveBtn = compWrapper.find("#m7ApproveBtn");
    expect((approveBtn.element as HTMLButtonElement).disabled).toBe(true);
    expect(compWrapper.text()).not.toContain("NaN");
    expect(compWrapper.text()).toContain("预览，尚未发布");
    expect(compWrapper.text()).toContain("待补（去 M0-2）");

    ws.currentRole = "approver";
    await compWrapper.vm.$nextTick();
    expect((approveBtn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it("exposes all 6 business groups, 27 sub-pages, and Home route", () => {
    expect(MODULE_DEFS.length).toBe(6);
    const totalPages = MODULE_DEFS.reduce((acc, g) => acc + g.pages.length, 0);
    expect(totalPages).toBe(27);

    const registeredPaths = new Set(appRouter.getRoutes().map((r) => r.path));
    expect(registeredPaths.has("/home")).toBe(true);
    expect(PAGE_FLOW_META["/home"]).toBeTruthy();

    for (const grp of MODULE_DEFS) {
      for (const page of grp.pages) {
        expect(registeredPaths.has(page.route)).toBe(true);
        expect(PAGE_FLOW_META[page.route]).toBeTruthy();
      }
    }
  });
});
