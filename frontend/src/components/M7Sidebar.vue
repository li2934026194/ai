<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ALL_9_ROLES, usePermission } from "@/composables/usePermission";
import { MODULE_DEFS } from "@/data/navigation";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const route = useRoute();
const router = useRouter();
const ws = useM7WorkspaceStore();
const { roleMeta } = usePermission();

const openGroupId = ref<string>("G2");

function findGroupByPath(path: string): string | null {
  const g = MODULE_DEFS.find((m) => m.pages.some((p) => p.route === path));
  return g ? g.id : null;
}

watch(
  () => route.path,
  (p) => {
    const g = findGroupByPath(p);
    if (g) openGroupId.value = g;
  },
  { immediate: true }
);

function toggleGroup(id: string) {
  openGroupId.value = openGroupId.value === id ? "" : id;
}

function isGroupActive(id: string): boolean {
  return findGroupByPath(route.path) === id;
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand" style="cursor:pointer;" title="回到岗位工作台首页" @click="router.push('/home')">
      <div class="brand-logo">CP</div>
      <div>
        <div class="brand-name">CrossPilot</div>
        <div class="brand-sub">跨境电商业务协作工作台</div>
      </div>
    </div>

    <div class="role-box">
      <label class="role-label" for="roleSwitcher">当前登录岗位（9 大业务岗位）</label>
      <select
        id="roleSwitcher"
        class="role-select"
        :value="ws.currentRole"
        @change="ws.switchRole(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">
          {{ r.label }}
        </option>
      </select>
      <div class="role-hint">
        {{ roleMeta.focusDesc }}
      </div>
    </div>

    <router-link
      to="/home"
      class="nav-home-btn"
      :class="{ active: route.path === '/home' }"
    >
      <span>🏠 岗位工作台</span>
      <span class="nav-todo">主页</span>
    </router-link>

    <router-link
      to="/docs"
      class="nav-home-btn"
      :class="{ active: route.path === '/docs' }"
      style="margin-top:4px;"
    >
      <span>📁 交付文档中心</span>
      <span class="nav-todo">Docs</span>
    </router-link>

    <nav class="nav-list">
      <div v-for="grp in MODULE_DEFS" :key="grp.id" class="nav-group">
        <div
          class="nav-parent"
          :class="{ open: openGroupId === grp.id, 'active-mod': isGroupActive(grp.id) }"
          @click="toggleGroup(grp.id)"
        >
          <span>{{ grp.label }}</span>
          <span style="font-size:10px;opacity:0.7;">{{ openGroupId === grp.id ? "▾" : "▸" }}</span>
        </div>

        <div v-if="openGroupId === grp.id" class="nav-children">
          <router-link
            v-for="p in grp.pages"
            :key="p.id"
            :to="p.route"
            class="nav-child"
            :class="{ active: route.path === p.route }"
          >
            <span>{{ p.label }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div style="font-weight:700;color:#cbd5e1;margin-bottom:2px;">
        6 大业务环节 · 27 页协同工作台
      </div>
      <div v-if="ws.healthInfo">
        LLM：{{ ws.healthInfo.dashscope_key_configured ? "百炼已配置" : "本地兜底" }} · 视频：{{
          ws.healthInfo.video_ready ? "FFmpeg 就绪" : "503 门禁"
        }} · SoD：{{ ws.healthInfo.strict_separation_of_duties ? "开启" : "关闭" }}
      </div>
    </div>
  </aside>
</template>
