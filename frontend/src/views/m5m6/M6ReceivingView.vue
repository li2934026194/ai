<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const pos = ref<any[]>([]);
const alerts = ref<any[]>([]);
const recvQty = ref<Record<string, number>>({});
const defQty = ref<Record<string, number>>({});
const errMsg = ref("");

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
    await platformApi.cancelPo(id, "供应商交期变更取消采购单");
    ws.showToast("已取消采购单并释放未到货在途");
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

    <div class="card">
      <div class="card-title">
        <span>采购单发货与分批质检收货台账（M6-4 / M6-5）</span>
        <button type="button" class="btn btn-sm" @click="load">刷新 PO</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>PO 单号</th>
            <th>SKU / 路线</th>
            <th>订量 / 已收 / 不良</th>
            <th>预计到货</th>
            <th>状态</th>
            <th>执行操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="po in pos" :key="po.po_id">
            <td><code>{{ po.po_id }}</code></td>
            <td><code>{{ po.sku }}</code> ({{ po.route_code }})</td>
            <td class="tnum">{{ po.order_qty }} / <strong>{{ po.receive_qty }}</strong> / {{ po.defect_qty }}</td>
            <td>{{ po.expect_arrive || "-" }}</td>
            <td><span class="pill p-blue">{{ po.status_label }}</span></td>
            <td>
              <template v-if="!['fully_received', 'cancelled'].includes(po.status)">
                <button v-if="po.status === 'created'" type="button" class="btn btn-sm" @click="ship(po.po_id)">标记发货</button>
                <input v-model.number="recvQty[po.po_id]" type="number" class="input" style="width:72px;display:inline-block;margin:0 4px;" placeholder="实收" />
                <input v-model.number="defQty[po.po_id]" type="number" class="input" style="width:64px;display:inline-block;margin-right:4px;" placeholder="不良" />
                <button type="button" class="btn btn-sm btn-success" @click="receive(po)">质检收货</button>
                <button type="button" class="btn btn-sm btn-danger" style="margin-left:4px;" @click="cancel(po.po_id)">取消</button>
              </template>
              <span v-else style="font-size:12px;color:#64748b;">{{ po.cancel_reason || "已收满闭环" }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">供应链断货与交期告警中心（M6-8）</div>
      <table class="table">
        <thead>
          <tr>
            <th>级别</th>
            <th>SKU</th>
            <th>告警描述</th>
            <th>状态</th>
            <th>处理</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts" :key="a.alert_id">
            <td><span class="pill p-red">{{ a.severity }}</span></td>
            <td><code>{{ a.sku }}</code></td>
            <td>{{ a.message }}</td>
            <td><span class="pill" :class="a.status === 'ACKED' ? 'p-green' : 'p-amber'">{{ a.status }}</span></td>
            <td>
              <button v-if="a.status === 'OPEN'" type="button" class="btn btn-sm btn-primary" @click="ack(a.alert_id)">确认处理</button>
              <span v-else>已由 {{ a.ack_by }} 确认</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
