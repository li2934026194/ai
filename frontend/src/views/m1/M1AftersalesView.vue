<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const tickets = ref<any[]>([]);
const statusFilter = ref("");
const noteMap = ref<Record<string, string>>({});
const errMsg = ref("");

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

    <div class="card">
      <div class="card-title">
        <span>售后审批与退款凭证台账（M1-3 · 严格 SoD 禁建单人自批 / 禁重复终审）</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <select v-model="statusFilter" class="select" style="width:140px;" @change="load">
            <option value="">全部状态</option>
            <option value="PENDING_APPROVAL">待审批</option>
            <option value="APPROVED">已批准</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <button type="button" class="btn btn-sm" @click="load">刷新工单</button>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>工单号</th>
            <th>SKU / 订单</th>
            <th>问题说明</th>
            <th>退款 (USD)</th>
            <th>建单人</th>
            <th>审批意见</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tickets" :key="t.ticket_id">
            <td><code>{{ t.ticket_id }}</code></td>
            <td><code>{{ t.sku }}</code><div style="font-size:11px;color:#64748b;">{{ t.order_ref }}</div></td>
            <td>{{ t.issue_type }}<div style="font-size:11px;color:#64748b;">{{ t.evidence_note }}</div></td>
            <td class="tnum" style="font-weight:700;">${{ t.refund_usd }}</td>
            <td><code>{{ t.submitter_id }}</code></td>
            <td>
              <input
                v-if="t.status === 'PENDING_APPROVAL'"
                v-model="noteMap[t.ticket_id]"
                class="input"
                placeholder="填写审批意见"
              />
              <span v-else>{{ t.decision_note || "-" }}</span>
            </td>
            <td>
              <template v-if="t.status === 'PENDING_APPROVAL'">
                <button type="button" class="btn btn-sm btn-success" @click="decide(t.ticket_id, 'APPROVED')">批准</button>
                <button type="button" class="btn btn-sm btn-danger" style="margin-left:4px;" @click="decide(t.ticket_id, 'REJECTED')">驳回</button>
              </template>
              <span v-else class="pill" :class="t.status === 'APPROVED' ? 'p-green' : 'p-red'">{{ t.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
