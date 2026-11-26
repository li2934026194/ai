<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import { getProductImageUrl } from "@/utils/productImage";

const router = useRouter();
const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const noteMap = ref<Record<string, string>>({});
const triggerM7Map = ref<Record<string, boolean>>({});
const errMsg = ref("");

const stats = computed(() => ({
  pending: candidates.value.filter((c) => c.status === "PENDING_APPROVAL").length,
  approved: candidates.value.filter((c) => c.status === "APPROVED").length,
  rejected: candidates.value.filter((c) => c.status === "REJECTED").length,
  total: candidates.value.length,
}));

async function load() {
  errMsg.value = "";
  try {
    candidates.value = (await platformApi.listCandidates()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function decide(cid: string, decision: "APPROVED" | "REJECTED") {
  errMsg.value = "";
  try {
    const triggerM7 = decision === "APPROVED" && Boolean(triggerM7Map.value[cid]);
    const res = await platformApi.decideCandidate(
      cid,
      decision,
      noteMap.value[cid] || "符合测款毛利门槛，同意立项",
      triggerM7
    );
    ws.showToast(
      decision === "APPROVED"
        ? `选品已终审批准并同步 M0 主档${res.m7_draft_triggered ? "，且已自动生成 M7 首版文案草稿！" : "！"}`
        : "已淘汰选品"
    );
    await ws.bootstrap();
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
      <div class="kpi-card"><div class="kpi-label">待拍板终审</div><div class="kpi-val" style="color:#b45309;">{{ stats.pending }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已批准转正</div><div class="kpi-val" style="color:#047857;">{{ stats.approved }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已淘汰</div><div class="kpi-val" style="color:#64748b;">{{ stats.rejected }}</div></div>
      <div class="kpi-card"><div class="kpi-label">候选池合计</div><div class="kpi-val">{{ stats.total }}</div></div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>测款终审拍板台（批准后自动入 M0 主档并解锁 M7）</span>
        <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m7/copy')">前往 M7-1 文案工作台 →</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>SKU / 商品</th>
            <th>评分 / 毛利</th>
            <th>审批意见 & M7 联动</th>
            <th>拍板操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in candidates" :key="c.candidate_id">
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <img
                  v-if="getProductImageUrl(c.sku)"
                  :src="getProductImageUrl(c.sku)!"
                  :alt="c.name"
                  style="width:38px;height:38px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;flex-shrink:0;"
                />
                <div>
                  <strong>{{ c.name }}</strong>
                  <div class="table-sub"><code>{{ c.sku }}</code> · 提交人 {{ c.submitter_id || "-" }}</div>
                  <div v-if="c.ip_risk_note" style="font-size:11px;color:#b45309;">风险：{{ c.ip_risk_note }}</div>
                </div>
              </div>
            </td>
            <td class="tnum">
              <strong>{{ c.total_score }} 分</strong>
              <div class="table-sub" style="color:#047857;">{{ (c.est_margin_pct * 100).toFixed(2) }}%</div>
            </td>
            <td>
              <template v-if="c.status === 'PENDING_APPROVAL'">
                <input v-model="noteMap[c.candidate_id]" class="input" placeholder="填写终审拍板意见" />
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-top:4px;color:#0369a1;">
                  <input v-model="triggerM7Map[c.candidate_id]" type="checkbox" />
                  批准同时生成 M7 首版文案草稿
                </label>
              </template>
              <span v-else style="color:#64748b;">{{ c.decision_note || "-" }}</span>
            </td>
            <td>
              <template v-if="c.status === 'PENDING_APPROVAL'">
                <div style="display:flex;gap:6px;">
                  <button type="button" class="btn btn-sm btn-success" @click="decide(c.candidate_id, 'APPROVED')">批准测款</button>
                  <button type="button" class="btn btn-sm btn-danger" @click="decide(c.candidate_id, 'REJECTED')">淘汰</button>
                </div>
              </template>
              <span v-else class="pill" :class="c.status === 'APPROVED' ? 'p-green' : 'p-gray'">{{ c.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
