<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import type { PlatformCode } from "@/api/m7";
import { useRelayProgress } from "@/composables/useRelayProgress";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const route = useRoute();
const router = useRouter();
const ws = useM7WorkspaceStore();
const { steps } = useRelayProgress();
</script>

<template>
  <div class="card" style="padding:10px 14px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;color:#475569;">创作标的</span>
        <select
          class="select"
          style="width:auto;min-width:210px;"
          :value="ws.currentSku"
          @change="ws.selectProduct(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in ws.products" :key="p.sku" :value="p.sku">
            {{ p.sku }} · {{ p.name }} ({{ p.origin === "M4_APPROVED" ? "M4转正" : "在售" }})
          </option>
        </select>
        <select
          class="select"
          style="width:auto;"
          :value="ws.platform"
          @change="ws.selectProduct(ws.currentSku, ($event.target as HTMLSelectElement).value as PlatformCode)"
        >
          <option value="amazon_us">Amazon US (≤200字)</option>
          <option value="tiktok_us">TikTok 美区 (≤150字)</option>
          <option value="shopee_th">Shopee 泰国 (≤120字)</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px;">
        <span class="pill" :class="ws.doneCnt === 8 ? 'p-green' : 'p-amber'">
          核心交付进度 {{ ws.doneCnt }}/8
        </span>
        <span class="pill p-blue">扩展文案 {{ ws.extDoneCnt }}/6</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <template v-for="(s, idx) in steps" :key="s.path">
        <span v-if="idx > 0" style="color:#cbd5e1;font-size:12px;">›</span>
        <button
          type="button"
          class="btn btn-sm"
          :class="route.path === s.path ? 'btn-primary' : ''"
          @click="router.push(s.path)"
        >
          <span>{{ s.done ? "✓" : `${s.num}.` }} {{ s.label }}</span>
          <span
            class="pill"
            :class="s.done ? 'p-green' : route.path === s.path ? 'p-blue' : 'p-gray'"
            style="margin-left:4px;"
          >
            {{ s.status }}
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
