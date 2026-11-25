<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const products = ref<any[]>([]);
const orders = ref<any[]>([]);
const quotes = ref<any[]>([]);
const costReqs = ref<any[]>([]);
const errMsg = ref("");

const costForm = reactive({ sku: "SKU-00704", new_cost_usd: 5.15, reason: "供应商阶梯报价调整" });
const csvText = ref("shop_id,sku,order_date,qty,revenue_usd\nshop_amz_us,SKU-00704,2026-11-18,12,322.8");

async function load() {
  errMsg.value = "";
  try {
    const [p, l] = await Promise.all([platformApi.listProducts(), platformApi.getLedger()]);
    products.value = p.items;
    orders.value = l.orders;
    quotes.value = l.quotes;
    costReqs.value = l.cost_requests;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function proposeCost() {
  errMsg.value = "";
  try {
    await platformApi.proposeCost(costForm);
    ws.showToast("已发起成本变更申请（待主管审批）");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function decideCost(reqId: string, decision: "APPROVED" | "REJECTED") {
  errMsg.value = "";
  try {
    await platformApi.decideCost(reqId, decision);
    ws.showToast(`成本审批单已${decision === "APPROVED" ? "批准并生效" : "驳回"}`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function importCsv() {
  errMsg.value = "";
  try {
    const res = await platformApi.importOrdersCsv(csvText.value);
    ws.showToast(`已成功导入 ${res.imported} 条订单记录`);
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
        <span>商品主档与成本卡（M0-2 · 已联动 M4/M5/M6/M7）</span>
        <button type="button" class="btn btn-sm" @click="load">刷新台账</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>商品名称</th>
            <th>来源</th>
            <th>售价 (USD)</th>
            <th>采购成本 (USD)</th>
            <th>MOQ / 整箱</th>
            <th>总交期</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.sku">
            <td><code>{{ p.sku }}</code></td>
            <td>{{ p.name }}</td>
            <td><span class="pill p-blue">{{ p.origin }}</span></td>
            <td class="tnum">${{ p.sale_price_usd }}</td>
            <td class="tnum">${{ p.unit_cost_usd }}</td>
            <td class="tnum">{{ p.moq }} / {{ p.pack_size }}</td>
            <td class="tnum">{{ p.lead_time_days }} 天</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">成本变更申请与审批（严格 SoD 禁自批）</div>
        <div class="grid-3" style="margin-bottom:10px;">
          <div>
            <label class="field-label">SKU</label>
            <select v-model="costForm.sku" class="select">
              <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">新采购成本 (USD)</label>
            <input v-model.number="costForm.new_cost_usd" type="number" step="0.1" class="input" />
          </div>
          <div>
            <label class="field-label">调价原因</label>
            <input v-model="costForm.reason" class="input" />
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" style="margin-bottom:12px;" @click="proposeCost">
          提交调价申请
        </button>

        <table class="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>原价 → 新价</th>
              <th>发起人</th>
              <th>状态 / 操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in costReqs" :key="r.req_id">
              <td><code>{{ r.sku }}</code></td>
              <td class="tnum">${{ r.old_cost_usd }} → ${{ r.new_cost_usd }}</td>
              <td><code>{{ r.proposer_id }}</code></td>
              <td>
                <template v-if="r.status === 'PENDING'">
                  <button type="button" class="btn btn-sm btn-success" @click="decideCost(r.req_id, 'APPROVED')">批准</button>
                  <button type="button" class="btn btn-sm btn-danger" style="margin-left:4px;" @click="decideCost(r.req_id, 'REJECTED')">驳回</button>
                </template>
                <span v-else class="pill" :class="r.status === 'APPROVED' ? 'p-green' : 'p-red'">{{ r.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">1688 模拟比价与 CSV 订单导入</div>
        <table class="table" style="margin-bottom:12px;">
          <thead>
            <tr>
              <th>SKU</th>
              <th>供应商</th>
              <th>报价 (RMB)</th>
              <th>MOQ / 交期</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="q in quotes" :key="q.quote_id">
              <td><code>{{ q.sku }}</code></td>
              <td>{{ q.supplier_name }}</td>
              <td class="tnum">¥{{ q.unit_price_rmb }}</td>
              <td class="tnum">{{ q.moq }} / {{ q.lead_time_days }}d</td>
            </tr>
          </tbody>
        </table>
        <label class="field-label">批量 CSV 订单导入</label>
        <textarea v-model="csvText" class="textarea" style="min-height:66px;font-family:monospace;font-size:12px;"></textarea>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" @click="importCsv">导入 CSV 订单</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">全平台订单台账（最近 {{ orders.length }} 笔）</div>
      <table class="table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>店铺</th>
            <th>SKU</th>
            <th>日期</th>
            <th>件数</th>
            <th>营收 (USD)</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.order_id">
            <td><code>{{ o.order_id }}</code></td>
            <td>{{ o.shop_id }}</td>
            <td><code>{{ o.sku }}</code></td>
            <td>{{ o.order_date }}</td>
            <td class="tnum">{{ o.qty }}</td>
            <td class="tnum">${{ o.revenue_usd }}</td>
            <td><span class="pill p-green">{{ o.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
