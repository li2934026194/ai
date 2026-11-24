<script setup lang="ts">
import { useRoute } from "vue-router";
import { ALL_9_ROLES } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const route = useRoute();
const ws = useM7WorkspaceStore();

const navItems = [
  { path: "/m7/copy", num: "M7-1", label: "多语言商品文案" },
  { path: "/m7/images", num: "M7-2", label: "主图与详情套图" },
  { path: "/m7/video-aplus", num: "M7-3", label: "短视频与 A+ 长页" },
  { path: "/m7/compliance", num: "M7-4", label: "合规检查与成品打包" },
];
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo">M7</div>
      <div>
        <div class="brand-name">CrossPilot</div>
        <div class="brand-sub">商品内容与合规交付</div>
      </div>
    </div>

    <div class="role-box">
      <label class="role-label" for="roleSwitcher">当前演示岗位（9 角色）</label>
      <select
        id="roleSwitcher"
        class="role-select"
        :value="ws.currentRole"
        @change="ws.switchRole(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">
          {{ r.label }} [{{ r.badge }}]
        </option>
      </select>
      <div style="margin-top:6px;font-size:11px;color:#94a3b8;">
        账号：<code style="color:#e2e8f0">{{ ws.currentActorId }}</code> · 租户 <code>{{ ws.currentOrgId }}</code>
      </div>
    </div>

    <nav style="margin-top:4px;flex:1;">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
      >
        <span>{{ item.num }} {{ item.label }}</span>
      </router-link>
    </nav>

    <div
      v-if="ws.healthInfo"
      style="margin-top:auto;padding:10px;background:#1e293b;border-radius:8px;font-size:11.5px;color:#cbd5e1;"
    >
      <div style="font-weight:700;margin-bottom:4px;">引擎状态（实时探测）</div>
      <div>云模型：{{ ws.healthInfo.dashscope_key_configured ? "百炼已配置" : "本地兜底模式" }}</div>
      <div>视频合成：{{ ws.healthInfo.video_ready ? "FFmpeg 就绪" : "未配置（503 门禁）" }}</div>
      <div>禁自批：{{ ws.healthInfo.strict_separation_of_duties ? "已开启" : "已关闭" }}</div>
    </div>
  </aside>
</template>
