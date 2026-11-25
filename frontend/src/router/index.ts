import { createRouter, createWebHistory } from "vue-router";
import DocsHubView from "@/views/DocsHubView.vue";
import HomeWorkbenchView from "@/views/HomeWorkbenchView.vue";
import M0InventoryView from "@/views/m0/M0InventoryView.vue";
import M0LedgerView from "@/views/m0/M0LedgerView.vue";
import M0ShopsView from "@/views/m0/M0ShopsView.vue";
import M1AftersalesView from "@/views/m1/M1AftersalesView.vue";
import M1FaqsView from "@/views/m1/M1FaqsView.vue";
import M1SessionsView from "@/views/m1/M1SessionsView.vue";
import M1SimulatorView from "@/views/m1/M1SimulatorView.vue";
import M2AdsView from "@/views/m2m3/M2AdsView.vue";
import M2OverviewView from "@/views/m2m3/M2OverviewView.vue";
import M3AskView from "@/views/m2m3/M3AskView.vue";
import M3CompetitorsView from "@/views/m2m3/M3CompetitorsView.vue";
import M4ApprovalView from "@/views/m4/M4ApprovalView.vue";
import M4ImportView from "@/views/m4/M4ImportView.vue";
import M4WorkbenchView from "@/views/m4/M4WorkbenchView.vue";
import M5ForecastView from "@/views/m5m6/M5ForecastView.vue";
import M5ProfilesView from "@/views/m5m6/M5ProfilesView.vue";
import M5ReviewView from "@/views/m5m6/M5ReviewView.vue";
import M6AppliesView from "@/views/m5m6/M6AppliesView.vue";
import M6ReceivingView from "@/views/m5m6/M6ReceivingView.vue";
import M6SmartView from "@/views/m5m6/M6SmartView.vue";
import M6StandardView from "@/views/m5m6/M6StandardView.vue";
import M7CompliancePackView from "@/views/m7/M7CompliancePackView.vue";
import M7CopyWorkbench from "@/views/m7/M7CopyWorkbench.vue";
import M7ImageStudio from "@/views/m7/M7ImageStudio.vue";
import M7VideoAplusView from "@/views/m7/M7VideoAplusView.vue";
import M8RolesView from "@/views/m8/M8RolesView.vue";
import M8UsersView from "@/views/m8/M8UsersView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", name: "home", component: HomeWorkbenchView },
    { path: "/docs", name: "docs-hub", component: DocsHubView },

    // G1: M0
    { path: "/m0/shops", name: "m0-shops", component: M0ShopsView },
    { path: "/m0/ledger", name: "m0-ledger", component: M0LedgerView },
    { path: "/m0/inventory", name: "m0-inventory", component: M0InventoryView },

    // G2: M4 + M7
    { path: "/m4/import", name: "m4-import", component: M4ImportView },
    { path: "/m4/workbench", name: "m4-workbench", component: M4WorkbenchView },
    { path: "/m4/approval", name: "m4-approval", component: M4ApprovalView },
    { path: "/m7/copy", name: "m7-copy", component: M7CopyWorkbench },
    { path: "/m7/images", name: "m7-images", component: M7ImageStudio },
    { path: "/m7/video-aplus", name: "m7-video-aplus", component: M7VideoAplusView },
    { path: "/m7/compliance", name: "m7-compliance", component: M7CompliancePackView },

    // G3: M1
    { path: "/m1/sessions", name: "m1-sessions", component: M1SessionsView },
    { path: "/m1/faqs", name: "m1-faqs", component: M1FaqsView },
    { path: "/m1/simulator", name: "m1-simulator", component: M1SimulatorView },
    { path: "/m1/aftersales", name: "m1-aftersales", component: M1AftersalesView },

    // G4: M5 + M6
    { path: "/m5/profiles", name: "m5-profiles", component: M5ProfilesView },
    { path: "/m5/forecast", name: "m5-forecast", component: M5ForecastView },
    { path: "/m5/review", name: "m5-review", component: M5ReviewView },
    { path: "/m6/standard", name: "m6-standard", component: M6StandardView },
    { path: "/m6/smart", name: "m6-smart", component: M6SmartView },
    { path: "/m6/applies", name: "m6-applies", component: M6AppliesView },
    { path: "/m6/receiving", name: "m6-receiving", component: M6ReceivingView },

    // G5: M2 + M3
    { path: "/m2/ads", name: "m2-ads", component: M2AdsView },
    { path: "/m2/overview", name: "m2-overview", component: M2OverviewView },
    { path: "/m3/competitors", name: "m3-competitors", component: M3CompetitorsView },
    { path: "/m3/ask", name: "m3-ask", component: M3AskView },

    // G6: M8
    { path: "/m8/users", name: "m8-users", component: M8UsersView },
    { path: "/m8/roles", name: "m8-roles", component: M8RolesView },
  ],
});

export default router;
