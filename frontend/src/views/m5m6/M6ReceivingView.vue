<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const pos = ref<any[]>([]);
const alerts = ref<any[]>([]);
const recvQty = ref<Record<string, number>>({});
const defQty = ref<Record<string, number>>({});
const cancelReasonMap = ref<Record<string, string>>({});
const errMsg = ref("");

const stats = computed(() => ({
  totalPos: pos.value.length,
  inFlight: pos.value.filter((p) => !["fully_received", "cancelled"].includes(p.status)).length,
  received: pos.value.filter((p) => p.status === "fully_received").length,
  openAlerts: alerts.value.filter((a) => a.status === "OPEN").length,
}));

async function load() {
  errMsg.value = "";
  try {
    const [p, a] = await Promise.all([platformApi.listPos(), platformApi.listAlerts()]);
    pos.value = p.items;
    alerts.value = a.items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function ship(id: string) {
  errMsg.value = "";
  try {
    await platformApi.shipPo(id);
    ws.showToast("采购单已标记发货运输中");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function receive(po: any) {
  errMsg.value = "";
  const got = recvQty.value[po.po_id] ?? Math.max(1, po.order_qty - po.receive_qty);
  const bad = defQty.value[po.po_id] ?? 0;
  try {
    const res = await platformApi.receivePo(po.po_id, got, bad);
    ws.showToast(`收货质检完成（累计 ${res.receive_qty} 件，状态：${res.status}）`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function cancel(id: string) {
  errMsg.value = "";
  try {
    await platformApi.cancelPo(id, cancelReasonMap.value[id] || "供应商交期变更取消采购单");
    ws.showToast("已取消采购单并释放未到货在途");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function scanAlerts() {
  errMsg.value = "";
  try {
    const res = await platformApi.scanAlerts();
    ws.showToast(`断货与逾期 PO 巡检完成，新增 ${res.created} 条预警`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function ack(id: string) {
  errMsg.value = "";
  try {
    await platformApi.ackAlert(id);
    ws.showToast("已确认处理预警");
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
      <div class="kpi-card"><div class="kpi-label">采购单总数</div><div class="kpi-val">{{ stats.totalPos }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待发货 / 在途</div><div class="kpi-val" style="color:#1d4ed8;">{{ stats.inFlight }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已收满闭环</div><div class="kpi-val" style="color:#047857;">{{ stats.received }}</div></div>
      <div class="kpi-card">
        <div class="kpi-label">未处理告警</div>
        <div class="kpi-val" :style="{ color: stats.openAlerts ? '#b91c1c' : '#047857' }">{{ stats.openAlerts }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>采购单发货与分批质检收货</span>
        <button type="button" class="btn btn-sm" @click="load">刷新 PO</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>PO / SKU</th>
            <th>订量 / 已收 / 不良</th>
            <th>状态</th>
            <th>执行操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="po in pos" :key="po.po_id">
            <td>
              <code>{{ po.po_id }}</code>
              <div class="table-sub"><code>{{ po.sku }}</code> ({{ po.route_code }}) · 预到 {{ po.expect_arrive || "-" }}</div>
            </td>
            <td class="tnum">{{ po.order_qty }} / <strong>{{ po.receive_qty }}</strong> / {{ po.defect_qty }}</td>
            <td><span class="pill p-blue">{{ po.status_label }}</span></td>
            <td>
              <div v-if="!['fully_received', 'cancelled'].includes(po.status)" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <button v-if="po.status === 'created'" type="button" class="btn btn-sm btn-primary" @click="ship(po.po_id)">标记发货</button>
                <input v-model.number="recvQty[po.po_id]" type="number" class="input" style="width:66px;" placeholder="实收" />
                <input v-model.number="defQty[po.po_id]" type="number" class="input" style="width:58px;" placeholder="不良" />
                <button type="button" class="btn btn-sm btn-success" @click="receive(po)">质检收货</button>
                <input v-model="cancelReasonMap[po.po_id]" class="input" style="width:96px;" placeholder="取消原因" />
                <button type="button" class="btn btn-sm btn-danger" @click="cancel(po.po_id)">取消</button>
              </div>
              <span v-else style="font-size:12px;color:#64748b;">{{ po.cancel_reason || "已收满闭环" }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">
        <span>供应链断货与交期告警</span>
        <button type="button" class="btn btn-sm btn-primary" @click="scanAlerts">巡检断货 / 逾期预警</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>级别 / SKU</th>
            <th>告警描述</th>
            <th>状态</th>
            <th>处理</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts" :key="a.alert_id">
            <td>
              <span class="pill p-red">{{ a.severity }}</span>
              <div class="table-sub"><code>{{ a.sku }}</code></div>
            </td>
            <td>{{ a.message }}</td>
            <td><span class="pill" :class="a.status === 'ACKED' ? 'p-green' : 'p-amber'">{{ a.status }}</span></td>
            <td>
              <button v-if="a.status === 'OPEN'" type="button" class="btn btn-sm btn-primary" @click="ack(a.alert_id)">确认处理</button>
              <span v-else class="table-sub">已由 {{ a.ack_by }} 确认</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
