<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const reviews = ref<any[]>([]);
const form = reactive({
  week_label: "2026-W47",
  summary_text: "本周完成主要爆款断货日校准与空海运组合补货优化，预测 WAPE 稳定在 12% 以内。",
});
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    reviews.value = (await platformApi.listWeeklyReviews()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function createReview() {
  errMsg.value = "";
  try {
    await platformApi.createWeeklyReview(form.week_label, form.summary_text);
    ws.showToast("已归档供应链周度复盘记录");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">周度复盘与误差归档</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">复盘周期标签</label>
            <input v-model="form.week_label" class="input" />
          </div>
          <div>
            <label class="field-label">复盘总结与调参结论</label>
            <textarea v-model="form.summary_text" class="textarea"></textarea>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="createReview">生成并归档周复盘</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">历史复盘记录（{{ reviews.length }} 期）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="r in reviews" :key="r.review_id" style="border:1px solid var(--border);border-radius:8px;padding:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <strong>{{ r.week_label }}</strong>
              <span class="pill" :class="r.is_mock ? 'p-amber' : 'p-green'">{{ r.is_mock ? "演示示例" : "实盘归档" }}</span>
            </div>
            <div style="font-size:13px;color:#334155;">{{ r.summary_text }}</div>
            <div style="font-size:11.5px;color:#64748b;margin-top:4px;">
              PO：{{ r.metrics.total_pos }} · 已收满：{{ r.metrics.fully_received }} · 未处理告警：{{ r.metrics.open_alerts }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
