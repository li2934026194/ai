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
    <div class="flow-node">
      <div class="flow-node-tag">
        <span>↑ 上游数据与触发</span>
        <button
          type="button"
          class="btn btn-sm"
          style="height:22px;font-size:11px;padding:0 6px;"
          @click="router.push(meta.upRoute)"
        >
          前往上游
        </button>
      </div>
      <div style="color:#334155;">{{ meta.up }}</div>
    </div>

    <div class="flow-node current">
      <div class="flow-node-tag">
        <span style="color:#1d4ed8;">● 本页职责</span>
        <span class="pill p-blue" style="font-size:10.5px;">实时联动</span>
      </div>
      <div style="color:#0f172a;font-weight:600;">{{ meta.cur }}</div>
    </div>

    <div class="flow-node">
      <div class="flow-node-tag">
        <span>↓ 下游流转去向</span>
        <button
          type="button"
          class="btn btn-sm"
          style="height:22px;font-size:11px;padding:0 6px;"
          @click="router.push(meta.downRoute)"
        >
          前往下游
        </button>
      </div>
      <div style="color:#334155;">{{ meta.down }}</div>
    </div>
  </div>
</template>
