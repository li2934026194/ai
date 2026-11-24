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
  <div class="card" style="padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div>
          <span class="field-label" style="display:inline;margin-right:6px;">当前商品:</span>
          <select
            class="select"
            style="width:auto;display:inline-block;min-width:240px;"
            :value="ws.currentSku"
            @change="ws.selectProduct(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="p in ws.products" :key="p.sku" :value="p.sku">
              {{ p.sku }} · {{ p.name }} ({{ p.origin === "M4_APPROVED" ? "M4已批准测款" : "在售翻新" }})
            </option>
          </select>
        </div>
        <div>
          <span class="field-label" style="display:inline;margin-right:6px;">目标站点:</span>
          <select
            class="select"
            style="width:auto;display:inline-block;"
            :value="ws.platform"
            @change="ws.selectProduct(ws.currentSku, ($event.target as HTMLSelectElement).value as PlatformCode)"
          >
            <option value="amazon_us">Amazon US (标题≤200字符)</option>
            <option value="tiktok_us">TikTok Shop 美区 (标题≤150字符)</option>
            <option value="shopee_th">Shopee 泰国 (标题≤120字符)</option>
          </select>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;">
        <span class="pill" :class="ws.doneCnt === 8 ? 'p-green' : 'p-amber'">
          核心交付进度 {{ ws.doneCnt }}/8
        </span>
        <span class="pill p-blue">扩展文案 {{ ws.extDoneCnt }}/6</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <template v-for="(s, idx) in steps" :key="s.path">
        <span v-if="idx > 0" style="color:#94a3b8;font-size:12px;">→</span>
        <button
          type="button"
          class="btn btn-sm"
          :class="route.path === s.path ? 'btn-primary' : ''"
          style="border-radius:999px;"
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
