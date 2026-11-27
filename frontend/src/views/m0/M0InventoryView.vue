<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import { getProductImageUrl } from "@/utils/productImage";

const ws = useM7WorkspaceStore();
const items = ref<any[]>([]);
const errMsg = ref("");
const form = reactive({
  warehouse_code: "FBA-ONT8",
  sku: "SKU-00704",
  counted_qty: 180,
  reason: "周度周期实盘核对",
});

const invKpis = computed(() => {
  const onHand = items.value.reduce((s, it) => s + Number(it.on_hand || 0), 0);
  const inTransit = items.value.reduce((s, it) => s + Number(it.in_transit || 0), 0);
  const lowCount = items.value.filter((it) => Number(it.on_hand || 0) < 120).length;
  return { count: items.value.length, onHand, inTransit, lowCount };
});

async function load() {
  errMsg.value = "";
  try {
    const res = await platformApi.listInventory();
    items.value = res.items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function submitStocktake() {
  errMsg.value = "";
  try {
    await platformApi.submitStocktake(form);
    ws.showToast(`已完成 ${form.sku} 人工盘点，在手净可售更新为 ${form.counted_qty} 件`);
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

    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card"><div class="kpi-label">分仓库位</div><div class="kpi-val">{{ invKpis.count }}</div></div>
      <div class="kpi-card"><div class="kpi-label">在手可售总计</div><div class="kpi-val" style="color:#047857;">{{ invKpis.onHand }}</div></div>
      <div class="kpi-card"><div class="kpi-label">在途在运件数</div><div class="kpi-val" style="color:#1d4ed8;">{{ invKpis.inTransit }}</div></div>
      <div class="kpi-card">
        <div class="kpi-label">低库存预警 (&lt;120)</div>
        <div class="kpi-val" :style="{ color: invKpis.lowCount ? '#b91c1c' : '#047857' }">{{ invKpis.lowCount }}</div>
      </div>
    </div>

    <div class="summary-bar">
      <span class="pill p-blue">口径规则</span>
      <span>在手 <code>on_hand</code> 为可用净库存（不二次扣减预占）；在途 <code>in_transit</code> 未入库前不可售。</span>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>分仓库存台账</span>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>仓库</th>
              <th>SKU</th>
              <th>在手可售</th>
              <th>在途 / 预占</th>
              <th>盘点人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.inv_id">
              <td><code>{{ it.warehouse_code }}</code></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <img
                    v-if="getProductImageUrl(it.image_url)"
                    :src="getProductImageUrl(it.image_url)!"
                    :alt="it.sku"
                    style="width:30px;height:30px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;flex-shrink:0;"
                  />
                  <code>{{ it.sku }}</code>
                </div>
              </td>
              <td class="tnum" :style="{ color: it.on_hand < 120 ? '#b91c1c' : '#047857', fontWeight: 700 }">
                {{ it.on_hand }}
                <router-link v-if="it.on_hand < 120" to="/m6/smart" style="font-size:11px;margin-left:4px;color:#b91c1c;">
                  去补货→
                </router-link>
              </td>
              <td class="tnum">{{ it.in_transit }} <span class="table-sub">/ {{ it.reserved }}</span></td>
              <td>{{ it.last_stocktake_by || "系统" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">人工实盘校准</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">目标仓库</label>
              <input v-model="form.warehouse_code" class="input" />
            </div>
            <div>
              <label class="field-label">SKU</label>
              <input v-model="form.sku" class="input" />
            </div>
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">实盘在手件数</label>
              <input v-model.number="form.counted_qty" type="number" class="input" />
            </div>
            <div>
              <label class="field-label">盘点原因</label>
              <input v-model="form.reason" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="submitStocktake">保存盘点单并联动预测</button>
        </div>
      </div>
    </div>
  </div>
</template>
