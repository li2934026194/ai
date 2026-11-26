<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import FlowStrip from "@/components/FlowStrip.vue";
import M7RelayBar from "@/components/M7RelayBar.vue";
import M7Sidebar from "@/components/M7Sidebar.vue";
import RuleGuideDrawer from "@/components/RuleGuideDrawer.vue";
import { usePermission } from "@/composables/usePermission";
import { PAGE_FLOW_META } from "@/data/navigation";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const route = useRoute();
const ws = useM7WorkspaceStore();
const { canRead, roleMeta } = usePermission();
const drawerOpen = ref(false);

const isM7Route = computed(() => route.path.startsWith("/m7"));
const pageMeta = computed(() => PAGE_FLOW_META[route.path] || PAGE_FLOW_META["/home"]);

onMounted(() => {
  void ws.bootstrap();
});
</script>

<template>
  <div class="app-shell">
    <M7Sidebar />

    <div class="main-col">
      <header class="topbar">
        <div>
          <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.04em;">
            CROSSPILOT · {{ route.path.toUpperCase() }}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <strong style="font-size:16px;">{{ pageMeta.title }}</strong>
            <span class="pill p-gray">{{ roleMeta.label }} [{{ roleMeta.badge }}]</span>
          </div>
          <div style="font-size:12px;color:#475569;">{{ pageMeta.subtitle }}</div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;">
          <span>Org: <code>{{ ws.currentOrgId }}</code></span>
          <router-link to="/docs" class="btn btn-sm" style="text-decoration:none;">
            📁 交付文档中心
          </router-link>
          <button type="button" class="btn btn-sm" @click="ws.hydrateSummary()">刷新状态</button>
          <button type="button" class="btn btn-sm btn-primary" @click="drawerOpen = true">
            📖 规则与流程说明
          </button>
        </div>
      </header>

      <main class="page-body">
        <div v-if="ws.toastMessage" class="alert alert-blue">{{ ws.toastMessage }}</div>
        <div v-if="isM7Route && ws.accessError" class="alert alert-red">{{ ws.accessError }}</div>

        <FlowStrip />

        <template v-if="isM7Route && !canRead">
          <div class="card">
            <div class="alert alert-amber" style="margin-bottom:0;">
              <strong>无权访问 M7 内容创作工作台（403 RBAC 隔离演示）</strong>
              <div style="margin-top:6px;">
                当前角色「{{ roleMeta.label }}」未分配 <code>m7:content:read</code> 权限。请在左侧栏切换至「内容创作 / 审核人员 (林设计)」「主管 / 审批人 (陈主管)」或「大屏浏览者 / 管理者 (王总监)」查看。
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <M7RelayBar v-if="isM7Route" />
          <router-view />
        </template>
      </main>
    </div>

    <RuleGuideDrawer :open="drawerOpen" @close="drawerOpen = false" />
  </div>
</template>
