<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const selected = ref<any>(null);
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    candidates.value = (await platformApi.listCandidates()).items;
    if (!selected.value && candidates.value.length > 0) {
      selected.value = JSON.parse(JSON.stringify(candidates.value[0]));
    }
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function pick(c: any) {
  selected.value = JSON.parse(JSON.stringify(c));
}

async function saveEval(submit: boolean) {
  if (!selected.value) return;
  errMsg.value = "";
  try {
    const res = await platformApi.evaluateCandidate(selected.value.candidate_id, {
      target_price_usd: selected.value.target_price_usd,
      est_cost_rmb: selected.value.est_cost_rmb,
      est_shipping_rmb: selected.value.est_shipping_rmb,
      scores: selected.value.scores,
      operator_note: selected.value.operator_note,
      submit_for_approval: submit,
    });
    ws.showToast(
      submit
        ? `已提交 ${selected.value.sku} 送主管终审（综合分 ${res.total_score}）`
        : `已保存 ${selected.value.sku} 测算评估`
    );
    await load();
    const updated = candidates.value.find((x) => x.candidate_id === selected.value.candidate_id);
    if (updated) selected.value = JSON.parse(JSON.stringify(updated));
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
        <div class="card-title">选品候选清单（M4-2）</div>
        <table class="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>名称</th>
              <th>综合分</th>
              <th>毛利率</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in candidates" :key="c.candidate_id">
              <td><code>{{ c.sku }}</code></td>
              <td>{{ c.name }}</td>
              <td class="tnum" style="font-weight:700;">{{ c.total_score }}</td>
              <td class="tnum">{{ (c.est_margin_pct * 100).toFixed(1) }}%</td>
              <td><span class="pill p-blue">{{ c.status }}</span></td>
              <td><button type="button" class="btn btn-sm" @click="pick(c)">评估</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selected" class="card">
        <div class="card-title">
          <span>5 维打分与利润测算：{{ selected.sku }}</span>
          <span class="pill p-purple">{{ selected.status }}</span>
        </div>
        <div class="grid-3" style="margin-bottom:10px;">
          <div>
            <label class="field-label">目标售价 (USD)</label>
            <input v-model.number="selected.target_price_usd" type="number" step="0.1" class="input" />
          </div>
          <div>
            <label class="field-label">采购价 (RMB)</label>
            <input v-model.number="selected.est_cost_rmb" type="number" step="0.5" class="input" />
          </div>
          <div>
            <label class="field-label">头程运费 (RMB)</label>
            <input v-model.number="selected.est_shipping_rmb" type="number" step="0.5" class="input" />
          </div>
        </div>
        <div class="grid-5" style="margin-bottom:10px;">
          <div v-for="(val, key) in selected.scores" :key="key">
            <label class="field-label">{{ key }}</label>
            <input v-model.number="selected.scores[key]" type="number" min="0" max="100" class="input" />
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label class="field-label">选品推荐理由</label>
          <textarea v-model="selected.operator_note" class="textarea" style="min-height:68px;"></textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn" @click="saveEval(false)">保存评估草稿</button>
          <button type="button" class="btn btn-primary" @click="saveEval(true)">提交送主管终审 (M4-3)</button>
        </div>
      </div>
    </div>
  </div>
</template>
