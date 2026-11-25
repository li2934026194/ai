<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const sku = ref("SKU-00704");
const products = ref<any[]>([]);
const data = ref<any>(null);
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    if (products.value.length === 0) {
      products.value = (await platformApi.listProducts()).items;
    }
    data.value = await platformApi.getForecast(sku.value);
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
        <span>销量预测与断货校准曲线（M5-2 · 真实断货日置空口径）</span>
        <select v-model="sku" class="select" style="width:220px;" @change="load">
          <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }} · {{ p.name }}</option>
        </select>
      </div>

      <template v-if="data">
        <div class="grid-4" style="margin-bottom:14px;">
          <div class="kpi-card">
            <div class="kpi-label">安全库存 (SS)</div>
            <div class="kpi-val">{{ data.suggestion.ss }}</div>
            <div class="kpi-sub">Z = {{ data.suggestion.z }} (服务水平 {{ (data.suggestion.service_level * 100).toFixed(1) }}%)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">再订货点 (ROP)</div>
            <div class="kpi-val">{{ data.suggestion.rop }}</div>
            <div class="kpi-sub">目标水位 S = {{ data.suggestion.target_s }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">历史断货日 / 毛利损失</div>
            <div class="kpi-val" style="color:#b91c1c;">{{ data.suggestion.zero_days }} 天</div>
            <div class="kpi-sub">估算少赚毛利 ¥{{ data.suggestion.lost_amount ?? 0 }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">未来 90 天断货风险</div>
            <div class="kpi-val" style="color:#b45309;">{{ data.suggestion.inputs_json.stockout_forward?.zero_days ?? 0 }} 天</div>
            <div class="kpi-sub">首次见底：{{ data.suggestion.inputs_json.stockout_forward?.first_zero_date || "安全覆盖" }}</div>
          </div>
        </div>

        <div class="card-title">近 45 天需求校准序列（红色标识真实断货日，系统自动置空不拉低日均需求）</div>
        <div style="max-height:290px;overflow-y:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>原始销量</th>
                <th>校准需求</th>
                <th>期末在手</th>
                <th>口径判定</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.series_tail" :key="row.date">
                <td>{{ row.date }}</td>
                <td class="tnum">{{ row.qty_raw }}</td>
                <td class="tnum">{{ row.qty_calibrated ?? "None (已剔除)" }}</td>
                <td class="tnum">{{ row.on_hand_eod }}</td>
                <td>
                  <span class="pill" :class="row.is_stockout ? 'p-red' : 'p-green'">
                    {{ row.is_stockout ? "断货日 (置空)" : "有效销量" }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
