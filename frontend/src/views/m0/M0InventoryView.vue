<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const items = ref<any[]>([]);
const errMsg = ref("");
const form = reactive({
  warehouse_code: "FBA-ONT8",
  sku: "SKU-00704",
  counted_qty: 180,
  reason: "周度周期实盘核对",
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

    <div class="alert alert-blue" style="margin-bottom:12px;">
      口径红线：<strong>在手净可售 (on_hand)</strong> 已为可用净库存，下游预测与补货直接取用 <code>available = on_hand</code>，<strong>不会二次扣减预占参考数 (reserved)</strong>；在途 (in_transit) 未盘点入库前不可售。
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>分店分仓独立库存台账（M0-3）</span>
          <button type="button" class="btn btn-sm" @click="load">刷新库存</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>仓库</th>
              <th>SKU</th>
              <th>在手净可售</th>
              <th>在途 (不可售)</th>
              <th>预占 (参考展示)</th>
              <th>盘点人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.inv_id">
              <td><code>{{ it.warehouse_code }}</code></td>
              <td><code>{{ it.sku }}</code></td>
              <td class="tnum" :style="{ color: it.on_hand < 120 ? '#b91c1c' : '#047857', fontWeight: 700 }">
                {{ it.on_hand }}
                <router-link v-if="it.on_hand < 120" to="/m6/smart" style="font-size:11px;margin-left:6px;color:#b91c1c;">
                  低库存补货→
                </router-link>
              </td>
              <td class="tnum">{{ it.in_transit }}</td>
              <td class="tnum" style="color:#64748b;">{{ it.reserved }}</td>
              <td>{{ it.last_stocktake_by || "系统初始化" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">人工实盘校准（唯一改库存红线 · 需 m0:inventory:edit）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">目标仓库</label>
            <input v-model="form.warehouse_code" class="input" />
          </div>
          <div>
            <label class="field-label">SKU</label>
            <input v-model="form.sku" class="input" />
          </div>
          <div>
            <label class="field-label">实盘在手可售件数</label>
            <input v-model.number="form.counted_qty" type="number" class="input" />
          </div>
          <div>
            <label class="field-label">盘点原因</label>
            <input v-model="form.reason" class="input" />
          </div>
          <button type="button" class="btn btn-primary" @click="submitStocktake">保存正式盘点单并联动 M5/M6</button>
        </div>
      </div>
    </div>
  </div>
</template>
