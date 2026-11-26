<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const products = ref<any[]>([]);
const sku = ref("SKU-00704");
const routeCode = ref("sea");
const objectiveMode = ref("profit");
const qtyPropose = ref(180);
const data = ref<any>(null);
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    if (products.value.length === 0) {
      products.value = (await platformApi.listProducts()).items;
    }
    data.value = await platformApi.getForecast(sku.value, routeCode.value, objectiveMode.value);
    qtyPropose.value = Math.max(data.value.suggestion.qty || 120, 60);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function createAndSubmit() {
  errMsg.value = "";
  try {
    const cr = await platformApi.createApply({
      sku: sku.value,
      route_code: routeCode.value,
      objective_mode: objectiveMode.value,
      qty_propose: qtyPropose.value,
    });
    await platformApi.submitApply(cr.apply_id);
    ws.showToast(`补货申请 ${cr.apply_id} 已提交待主管审批！`);
    void router.push("/m6/applies");
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
        <span>智能补货测算与方案决策</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <select v-model="sku" class="select" style="width:190px;" @change="load">
            <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }} · {{ p.name }}</option>
          </select>
          <select v-model="routeCode" class="select" style="width:110px;" @change="load">
            <option value="sea">海运</option>
            <option value="air">空运</option>
            <option value="rail">铁运</option>
            <option value="truck">卡航</option>
          </select>
          <select v-model="objectiveMode" class="select" style="width:110px;" @change="load">
            <option value="sales">保销量</option>
            <option value="profit">保利润</option>
            <option value="cash">保现金</option>
          </select>
        </div>
      </div>

      <template v-if="data">
        <div class="alert alert-blue" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <strong>建议补货：{{ data.suggestion.qty }} 件</strong>（在手 {{ data.suggestion.on_hand }} · 在途 {{ data.suggestion.in_transit }} ·
            目标水位 {{ data.suggestion.target_s }}）
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span>申报量：</span>
            <input v-model.number="qtyPropose" type="number" class="input" style="width:95px;" />
            <button type="button" class="btn btn-primary btn-lg" @click="createAndSubmit">创建并提交审批 →</button>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <div style="font-weight:700;margin-bottom:6px;">四路线时效与风险对比</div>
            <table class="table">
              <thead>
                <tr>
                  <th>路线</th>
                  <th>时效</th>
                  <th>总运费</th>
                  <th>风险</th>
                  <th>建议</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.route_plan.routes" :key="r.code">
                  <td><strong>{{ r.name }}</strong></td>
                  <td class="tnum">{{ r.transit_days }}d</td>
                  <td class="tnum">¥{{ r.total_freight }}</td>
                  <td>
                    <span class="pill" :class="r.risk_level === '高' ? 'p-red' : r.risk_level === '中' ? 'p-amber' : 'p-green'">
                      {{ r.risk_level }}
                    </span>
                  </td>
                  <td style="font-size:11.5px;">{{ r.recommendation }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style="font-weight:700;margin-bottom:6px;">三目标决策方案</div>
            <table class="table">
              <thead>
                <tr>
                  <th>目标</th>
                  <th>服务水平</th>
                  <th>建议订量</th>
                  <th>资金占用</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in data.route_plan.objectives" :key="o.code">
                  <td><strong>{{ o.name }}</strong></td>
                  <td class="tnum">{{ (o.service_level * 100).toFixed(0) }}%</td>
                  <td class="tnum" style="font-weight:700;">{{ o.qty }} 件</td>
                  <td class="tnum">¥{{ o.capital ?? "-" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
