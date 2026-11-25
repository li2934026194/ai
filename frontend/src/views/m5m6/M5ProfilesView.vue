<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const sku = ref("SKU-00704");
const products = ref<any[]>([]);
const data = ref<any>(null);
const params = reactive({ moq: 60, pack_size: 20, lead_time_days: 21 });
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    products.value = (await platformApi.listProducts()).items;
    const prod = products.value.find((p) => p.sku === sku.value);
    if (prod) {
      params.moq = prod.moq || 60;
      params.pack_size = prod.pack_size || 20;
      params.lead_time_days = prod.lead_time_days || 21;
    }
    data.value = await platformApi.getForecast(sku.value);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function saveParams() {
  errMsg.value = "";
  try {
    await platformApi.updateSkuSupplyParams(sku.value, params);
    ws.showToast(`已更新 ${sku.value} 供应参数（MOQ=${params.moq}，整箱=${params.pack_size}，交期=${params.lead_time_days}d）并重算模型`);
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

    <div class="card">
      <div class="card-title">
        <span>商品画像与多模型预测回测方案对比（M5-1 · 复用 domain.backtest 内核）</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <select v-model="sku" class="select" style="width:220px;" @change="load">
            <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }} · {{ p.name }}</option>
          </select>
          <button type="button" class="btn btn-sm" @click="load">重算回测</button>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom:12px;align-items:end;">
        <div>
          <label class="field-label">起订量 MOQ</label>
          <input v-model.number="params.moq" type="number" min="1" class="input" />
        </div>
        <div>
          <label class="field-label">整箱装箱数 (Pack Size)</label>
          <input v-model.number="params.pack_size" type="number" min="1" class="input" />
        </div>
        <div>
          <label class="field-label">供应链总交期 (天)</label>
          <input v-model.number="params.lead_time_days" type="number" min="3" class="input" />
        </div>
        <div>
          <button type="button" class="btn btn-primary" style="width:100%;" @click="saveParams">保存参数并重算建议</button>
        </div>
      </div>

      <template v-if="data">
        <div class="alert alert-blue">
          <strong>自动优选模型：<code>{{ data.best_model }}</code></strong>
          （筛选标准：WAPE 最低且 Bias &gt; -0.15） · 日均校准需求：
          <strong>{{ data.suggestion.inputs_json.mu_daily?.toFixed(2) }}</strong> 件/天 · 残差标准差 σ：
          <strong>{{ data.suggestion.inputs_json.sigma_daily?.toFixed(2) }}</strong>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>预测算法模型</th>
              <th>WAPE (加权绝对误差)</th>
              <th>Bias (偏差)</th>
              <th>MAE (平均绝对误差)</th>
              <th>回测样本点数</th>
              <th>入选状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, name) in data.per_model" :key="name">
              <td><code>{{ name }}</code></td>
              <td class="tnum">{{ m.wape !== null ? (m.wape * 100).toFixed(2) + "%" : "-" }}</td>
              <td class="tnum">{{ m.bias !== null ? (m.bias * 100).toFixed(2) + "%" : "-" }}</td>
              <td class="tnum">{{ m.mae !== null ? m.mae.toFixed(2) : "-" }}</td>
              <td class="tnum">{{ m.n_obs }}</td>
              <td>
                <span v-if="name === data.best_model" class="pill p-green">最优入选</span>
                <span v-else class="pill p-gray">备选对比</span>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
