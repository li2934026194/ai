<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const errMsg = ref("");

const form = reactive({
  sku: "",
  name: "",
  category: "kitchen_appliance",
  source_channel: "1688 趋势选品",
  target_price_usd: 32.9,
  est_cost_rmb: 45.0,
  est_shipping_rmb: 16.0,
});

async function load() {
  errMsg.value = "";
  try {
    candidates.value = (await platformApi.listCandidates()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function importCand() {
  errMsg.value = "";
  try {
    const res = await platformApi.importCandidate(form);
    ws.showToast(`已导入候选商品（预估毛利率 ${(res.est_margin_pct * 100).toFixed(1)}%）`);
    form.sku = "";
    form.name = "";
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
        <div class="card-title">候选商品导入（M4-1 · 需 m4:edit）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">候选 SKU</label>
              <input v-model="form.sku" class="input" placeholder="如 COF-301" />
            </div>
            <div>
              <label class="field-label">商品名称</label>
              <input v-model="form.name" class="input" placeholder="如 便携无线奶泡器" />
            </div>
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">所属类目</label>
              <select v-model="form.category" class="select">
                <option value="kitchen_appliance">kitchen_appliance (厨卫小电)</option>
                <option value="bags_travel">bags_travel (箱包出行)</option>
                <option value="3c_accessories">3c_accessories (3C数码)</option>
                <option value="beauty_skincare">beauty_skincare (美妆个护)</option>
              </select>
            </div>
            <div>
              <label class="field-label">选品来源渠道</label>
              <input v-model="form.source_channel" class="input" />
            </div>
          </div>
          <div class="grid-3">
            <div>
              <label class="field-label">目标售价 (USD)</label>
              <input v-model.number="form.target_price_usd" type="number" step="0.1" class="input" />
            </div>
            <div>
              <label class="field-label">预估采购价 (RMB)</label>
              <input v-model.number="form.est_cost_rmb" type="number" step="0.5" class="input" />
            </div>
            <div>
              <label class="field-label">预估头程 (RMB)</label>
              <input v-model.number="form.est_shipping_rmb" type="number" step="0.5" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-primary" @click="importCand">导入至选品工作台</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>当前选品候选池（{{ candidates.length }} 款）</span>
          <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m4/workbench')">进入 M4-2 评估 →</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>名称</th>
              <th>来源</th>
              <th>预估毛利率</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in candidates" :key="c.candidate_id">
              <td><code>{{ c.sku }}</code></td>
              <td>{{ c.name }}</td>
              <td>{{ c.source_channel }}</td>
              <td class="tnum">{{ (c.est_margin_pct * 100).toFixed(1) }}%</td>
              <td><span class="pill p-blue">{{ c.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
