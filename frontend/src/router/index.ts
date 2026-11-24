import { createRouter, createWebHistory } from "vue-router";
import M7CompliancePackView from "@/views/m7/M7CompliancePackView.vue";
import M7CopyWorkbench from "@/views/m7/M7CopyWorkbench.vue";
import M7ImageStudio from "@/views/m7/M7ImageStudio.vue";
import M7VideoAplusView from "@/views/m7/M7VideoAplusView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/m7/copy" },
    { path: "/m7/copy", name: "m7-copy", component: M7CopyWorkbench },
    { path: "/m7/images", name: "m7-images", component: M7ImageStudio },
    { path: "/m7/video-aplus", name: "m7-video-aplus", component: M7VideoAplusView },
    { path: "/m7/compliance", name: "m7-compliance", component: M7CompliancePackView },
  ],
});

export default router;
