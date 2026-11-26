<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PAGE_FLOW_META } from "@/data/navigation";

const route = useRoute();
const router = useRouter();

const meta = computed(() => PAGE_FLOW_META[route.path] || PAGE_FLOW_META["/home"]);
</script>

<template>
  <div class="flow-strip">
    <div class="flow-node-inline">
      <button
        type="button"
        class="btn btn-sm"
        style="height:24px;font-size:11.5px;padding:0 8px;"
        @click="router.push(meta.upRoute)"
      >
        ← 上游
      </button>
      <span style="color:#64748b;">{{ meta.up }}</span>
    </div>

    <div class="flow-node-inline" style="color:#1e3a8a;font-weight:600;">
      <span class="pill p-blue" style="font-size:11px;">当前</span>
      <span>{{ meta.cur }}</span>
    </div>

    <div class="flow-node-inline">
      <span style="color:#64748b;">{{ meta.down }}</span>
      <button
        type="button"
        class="btn btn-sm"
        style="height:24px;font-size:11.5px;padding:0 8px;"
        @click="router.push(meta.downRoute)"
      >
        下游 →
      </button>
    </div>
  </div>
</template>
