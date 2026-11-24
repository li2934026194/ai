<script setup lang="ts">
import { onMounted } from "vue";
import M7RelayBar from "@/components/M7RelayBar.vue";
import M7Sidebar from "@/components/M7Sidebar.vue";
import { usePermission } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const { canRead, roleMeta } = usePermission();

onMounted(() => {
  void ws.bootstrap();
});
</script>

<template>
  <div class="app-shell">
    <M7Sidebar />

    <div class="main-col">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:10px;">
          <strong style="font-size:15px;">M7 商品内容创作与合规交付工作台</strong>
          <span class="pill p-gray">{{ roleMeta.label }} [{{ roleMeta.badge }}]</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;">
          <span>Org: <code>{{ ws.currentOrgId }}</code></span>
          <button type="button" class="btn btn-sm" @click="ws.hydrateSummary()">刷新状态</button>
        </div>
      </header>

      <main class="page-body">
        <div v-if="ws.toastMessage" class="alert alert-blue">{{ ws.toastMessage }}</div>
        <div v-if="ws.accessError" class="alert alert-red">{{ ws.accessError }}</div>

        <template v-if="!canRead">
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
          <M7RelayBar />
          <router-view />
        </template>
      </main>
    </div>
  </div>
</template>
