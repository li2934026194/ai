<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const tickets = ref<any[]>([]);
const statusFilter = ref("");
const noteMap = ref<Record<string, string>>({});
const errMsg = ref("");

const stats = computed(() => {
  const pending = tickets.value.filter((t) => t.status === "PENDING_APPROVAL");
  const approved = tickets.value.filter((t) => t.status === "APPROVED");
  const pendingUsd = pending.reduce((s, t) => s + Number(t.refund_usd || 0), 0);
  return { total: tickets.value.length, pending: pending.length, approved: approved.length, pendingUsd };
});

async function load() {
  errMsg.value = "";
  try {
    tickets.value = (await platformApi.listAftersales(statusFilter.value || undefined)).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function decide(tid: string, decision: "APPROVED" | "REJECTED") {
  errMsg.value = "";
  try {
    await platformApi.decideAftersales(tid, decision, noteMap.value[tid] || "已核实开箱凭证，同意退款");
    ws.showToast(`售后工单 ${tid} 已${decision === "APPROVED" ? "批准" : "驳回"}`);
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
      <div class="kpi-card"><div class="kpi-label">售后工单总数</div><div class="kpi-val">{{ stats.total }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待主管终审</div><div class="kpi-val" style="color:#b45309;">{{ stats.pending }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已批准退款</div><div class="kpi-val" style="color:#047857;">{{ stats.approved }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待审退款额</div><div class="kpi-val" style="color:#b91c1c;">${{ stats.pendingUsd.toFixed(2) }}</div></div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>售后审批台账（SoD 禁建单人自批）</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <select v-model="statusFilter" class="select" style="width:130px;" @change="load">
            <option value="">全部状态</option>
            <option value="PENDING_APPROVAL">待审批</option>
            <option value="APPROVED">已批准</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>工单 / 订单</th>
            <th>问题与凭证</th>
            <th>退款</th>
            <th>审批意见</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tickets" :key="t.ticket_id">
            <td>
              <code>{{ t.ticket_id }}</code>
              <div class="table-sub"><code>{{ t.sku }}</code> · {{ t.order_ref }}</div>
              <div class="table-sub">建单人：<code>{{ t.submitter_id }}</code></div>
            </td>
            <td>
              <strong>{{ t.issue_type }}</strong>
              <div class="table-sub">{{ t.evidence_note }}</div>
            </td>
            <td class="tnum" style="font-weight:700;">${{ t.refund_usd }}</td>
            <td>
              <input
                v-if="t.status === 'PENDING_APPROVAL'"
                v-model="noteMap[t.ticket_id]"
                class="input"
                placeholder="填写审批意见"
              />
              <span v-else style="color:#64748b;">{{ t.decision_note || "-" }}</span>
            </td>
            <td>
              <template v-if="t.status === 'PENDING_APPROVAL'">
                <div style="display:flex;gap:6px;">
                  <button type="button" class="btn btn-sm btn-success" @click="decide(t.ticket_id, 'APPROVED')">批准</button>
                  <button type="button" class="btn btn-sm btn-danger" @click="decide(t.ticket_id, 'REJECTED')">驳回</button>
                </div>
              </template>
              <span v-else class="pill" :class="t.status === 'APPROVED' ? 'p-green' : 'p-red'">{{ t.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
