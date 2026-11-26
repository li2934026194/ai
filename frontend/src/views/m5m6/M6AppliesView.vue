<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const applies = ref<any[]>([]);
const reasonMap = ref<Record<string, string>>({});
const errMsg = ref("");

const stats = computed(() => ({
  total: applies.value.length,
  pending: applies.value.filter((a) => a.status === "pending_approve").length,
  approved: applies.value.filter((a) => a.status === "approved").length,
  amountRmb: applies.value
    .filter((a) => a.status === "pending_approve")
    .reduce((s, a) => s + Number(a.est_amount_rmb || 0), 0),
}));

async function load() {
  errMsg.value = "";
  try {
    applies.value = (await platformApi.listApplies()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function submit(id: string) {
  errMsg.value = "";
  try {
    await platformApi.submitApply(id);
    ws.showToast("已提交待主管审批");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function approve(id: string) {
  errMsg.value = "";
  try {
    const res = await platformApi.approveApply(id);
    ws.showToast(`审批通过，已自动生成采购单 ${res.po_id}`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function reject(id: string) {
  errMsg.value = "";
  try {
    await platformApi.rejectApply(id, reasonMap.value[id] || "资金预算控制暂缓补货");
    ws.showToast("已驳回补货申请");
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
      <div class="kpi-card"><div class="kpi-label">补货申请总数</div><div class="kpi-val">{{ stats.total }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待主管审批</div><div class="kpi-val" style="color:#b45309;">{{ stats.pending }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已批转 PO</div><div class="kpi-val" style="color:#047857;">{{ stats.approved }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待审占用资金</div><div class="kpi-val">¥{{ stats.amountRmb.toFixed(0) }}</div></div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>补货审批与下单台账（SoD 禁自批）</span>
        <button type="button" class="btn btn-sm" @click="load">刷新</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>申请单 / SKU</th>
            <th>路线 / 目标</th>
            <th>数量与预算</th>
            <th>状态</th>
            <th>审批操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in applies" :key="a.apply_id">
            <td>
              <code>{{ a.apply_id }}</code>
              <div class="table-sub"><code>{{ a.sku }}</code> · 提交 {{ a.submit_user || "-" }}</div>
            </td>
            <td>{{ a.route_code }} / {{ a.objective_mode }}</td>
            <td class="tnum">
              {{ a.qty_suggest }} → <strong>{{ a.qty_propose }} 件</strong>
              <div class="table-sub">¥{{ a.est_amount_rmb }}</div>
            </td>
            <td><span class="pill p-blue">{{ a.status_label }}</span></td>
            <td>
              <button v-if="a.status === 'draft'" type="button" class="btn btn-sm btn-primary" @click="submit(a.apply_id)">提交</button>
              <div v-else-if="a.status === 'pending_approve'" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <input v-model="reasonMap[a.apply_id]" class="input" style="width:110px;" placeholder="驳回理由" />
                <button type="button" class="btn btn-sm btn-success" @click="approve(a.apply_id)">批准下单</button>
                <button type="button" class="btn btn-sm btn-danger" @click="reject(a.apply_id)">驳回</button>
              </div>
              <span v-else style="font-size:12px;color:#64748b;">{{ a.reject_reason || "已完成流转" }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
