<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const products = ref<any[]>([]);
const form = reactive({
  sku: "SKU-00704",
  route_code: "sea",
  objective_mode: "profit",
  lead_prod_override: 12,
  review_period_override: 15,
  service_level_override: 0.95,
  demand_multiplier: 1.0,
});
const result = ref<any>(null);
const errMsg = ref("");

async function runSandbox() {
  errMsg.value = "";
  try {
    result.value = await platformApi.runSandbox(form);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(async () => {
  try {
    products.value = (await platformApi.listProducts()).items;
  } catch {
    /* handled on run */
  }
  await runSandbox();
});
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">常规补货测算与参数沙盒</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">SKU</label>
              <select v-model="form.sku" class="select">
                <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }} · {{ p.name }}</option>
              </select>
            </div>
            <div>
              <label class="field-label">物流路线</label>
              <select v-model="form.route_code" class="select">
                <option value="sea">海运 (45d)</option>
                <option value="air">空运 (7d)</option>
                <option value="rail">铁运 (22d)</option>
                <option value="truck">卡航 (14d)</option>
              </select>
            </div>
          </div>
          <div class="grid-3">
            <div>
              <label class="field-label">决策目标</label>
              <select v-model="form.objective_mode" class="select">
                <option value="sales">保销量 (99%)</option>
                <option value="profit">保利润 (97%)</option>
                <option value="cash">保现金 (90%)</option>
              </select>
            </div>
            <div>
              <label class="field-label">生产天数</label>
              <input v-model.number="form.lead_prod_override" type="number" class="input" />
            </div>
            <div>
              <label class="field-label">覆盖周期 (天)</label>
              <input v-model.number="form.review_period_override" type="number" class="input" />
            </div>
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">服务水平 (0.90–0.99)</label>
              <input v-model.number="form.service_level_override" type="number" step="0.01" min="0.90" max="0.99" class="input" />
            </div>
            <div>
              <label class="field-label">旺季倍率 (0.3–3.0)</label>
              <input v-model.number="form.demand_multiplier" type="number" step="0.1" min="0.3" max="3.0" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="runSandbox">实时运行沙盒推演</button>
        </div>
      </div>

      <div v-if="result" class="card">
        <div class="card-title">推演结果（MOQ → 整箱两步取整）</div>
        <div class="grid-2" style="margin-bottom:10px;">
          <div class="kpi-card">
            <div class="kpi-label">建议补货量</div>
            <div class="kpi-val" style="color:#1d4ed8;">{{ result.qty_suggest }} 件</div>
            <div class="kpi-sub">资金占用：¥{{ result.amount_rmb ?? "-" }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">总交期 / 水位</div>
            <div class="kpi-val">{{ result.lead_time_total }} 天</div>
            <div class="kpi-sub">SS {{ result.ss }} · ROP {{ result.rop }} · S {{ result.target_s }}</div>
          </div>
        </div>
        <div class="summary-bar">
          <span class="pill p-blue">前向 90 天</span>
          <span>覆盖 {{ result.stockout_forward?.coverage_days }} 天 · 断货 {{ result.stockout_forward?.zero_days }} 天（见底日：{{ result.stockout_forward?.first_zero_date || "无" }}）</span>
        </div>
      </div>
    </div>
  </div>
</template>
