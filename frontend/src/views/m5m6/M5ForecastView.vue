<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const sku = ref("SKU-00704");
const products = ref<any[]>([]);
const data = ref<any>(null);
const showCsvBox = ref(false);
const csvFilename = ref("");
const csvText = ref(
  "sku,sales_date,qty_raw,on_hand_eod,revenue_usd\nSKU-00704,2026-11-18,16,84,319.84"
);
const errMsg = ref("");

const chartPoints = computed(() => {
  const tail = data.value?.series_tail || [];
  if (!tail.length) return { rawPts: "", calPts: "", maxVal: 1 };
  const maxVal = Math.max(
    1,
    ...tail.map((r: any) => Math.max(Number(r.qty_raw || 0), Number(r.qty_calibrated || 0)))
  );
  const w = 640;
  const h = 110;
  const step = tail.length > 1 ? w / (tail.length - 1) : w;
  const rawPts = tail
    .map((r: any, i: number) => `${(i * step).toFixed(1)},${(h - (Number(r.qty_raw || 0) / maxVal) * 90 - 10).toFixed(1)}`)
    .join(" ");
  const calPts = tail
    .map((r: any, i: number) => {
      const v = r.qty_calibrated !== null ? Number(r.qty_calibrated) : Number(r.qty_raw || 0);
      return `${(i * step).toFixed(1)},${(h - (v / maxVal) * 90 - 10).toFixed(1)}`;
    })
    .join(" ");
  return { rawPts, calPts, maxVal, tail, step, h };
});

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

function handleCsvPick(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  csvFilename.value = f.name;
  const reader = new FileReader();
  reader.onload = () => {
    csvText.value = String(reader.result || "");
  };
  reader.readAsText(f, "utf-8");
}

async function importSales() {
  errMsg.value = "";
  try {
    const res = await platformApi.importSalesCsv(csvText.value, csvFilename.value);
    ws.showToast(`成功导入 ${res.imported} 条日度销量流水（错误 ${res.errors.length} 条）`);
    showCsvBox.value = false;
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
        <span>销量预测与断货校准曲线</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn btn-sm" @click="showCsvBox = !showCsvBox">
            {{ showCsvBox ? "收起导入" : "导入销量 CSV" }}
          </button>
          <select v-model="sku" class="select" style="width:210px;" @change="load">
            <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }} · {{ p.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="showCsvBox" class="alert alert-blue" style="margin-bottom:12px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <strong>导入日度销量 CSV（禁止含 mock/demo 文件名）</strong>
          <input type="file" accept=".csv" style="font-size:12px;" @change="handleCsvPick" />
        </div>
        <textarea v-model="csvText" class="textarea" style="min-height:60px;font-family:monospace;font-size:12px;"></textarea>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:6px;" @click="importSales">确认导入并重算</button>
      </div>

      <template v-if="data">
        <div class="grid-4" style="margin-bottom:14px;">
          <div class="kpi-card">
            <div class="kpi-label">安全库存 (SS)</div>
            <div class="kpi-val">{{ data.suggestion.ss }}</div>
            <div class="kpi-sub">Z={{ data.suggestion.z }} · {{ (data.suggestion.service_level * 100).toFixed(1) }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">再订货点 (ROP)</div>
            <div class="kpi-val">{{ data.suggestion.rop }}</div>
            <div class="kpi-sub">目标水位 S={{ data.suggestion.target_s }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">历史断货日</div>
            <div class="kpi-val" style="color:#b91c1c;">{{ data.suggestion.zero_days }} 天</div>
            <div class="kpi-sub">估算损失 ¥{{ data.suggestion.lost_amount ?? 0 }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">未来 90 天风险</div>
            <div class="kpi-val" style="color:#b45309;">{{ data.suggestion.inputs_json.stockout_forward?.zero_days ?? 0 }} 天</div>
            <div class="kpi-sub">{{ data.suggestion.inputs_json.stockout_forward?.first_zero_date || "安全覆盖" }}</div>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;background:#fafcff;">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px;display:flex;justify-content:space-between;">
            <span>近 45 天原始销量 (蓝线) vs 断货日 (红点)</span>
            <span style="color:#64748b;">峰值：{{ chartPoints.maxVal }} 件/日</span>
          </div>
          <svg viewBox="0 0 640 120" style="width:100%;height:110px;display:block;">
            <polyline fill="none" stroke="#2563eb" stroke-width="2" :points="chartPoints.rawPts" />
            <circle
              v-for="(row, idx) in chartPoints.tail"
              v-show="row.is_stockout"
              :key="row.date"
              :cx="(idx * (chartPoints.step || 1)).toFixed(1)"
              :cy="(110 - (Number(row.qty_raw || 0) / (chartPoints.maxVal || 1)) * 90 - 10).toFixed(1)"
              r="4"
              fill="#dc2626"
            />
          </svg>
        </div>

        <div class="card-title">近 45 天需求校准明细表</div>
        <div style="max-height:240px;overflow-y:auto;">
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
                <td class="tnum">{{ row.qty_calibrated ?? "已剔除" }}</td>
                <td class="tnum">{{ row.on_hand_eod }}</td>
                <td>
                  <span class="pill" :class="row.is_stockout ? 'p-red' : 'p-green'">
                    {{ row.is_stockout ? "断货置空" : "有效销量" }}
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
