<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const noteMap = ref<Record<string, string>>({});
const errMsg = ref("");

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
    await platformApi.decideCandidate(cid, decision, noteMap.value[cid] || "符合测款毛利门槛，同意立项");
    ws.showToast(
      decision === "APPROVED"
        ? "选品已终审批准并自动同步 M0 主档与 M7 内容工作台！"
        : "已驳回选品"
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

    <div class="card">
      <div class="card-title">
        <span>测款终审拍板台（M4-3 · 批准后自动写入 M0 主档并解锁 M7 创作）</span>
        <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m7/copy')">前往 M7-1 文案工作台 →</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>商品名称</th>
            <th>综合分 / 毛利率</th>
            <th>提交人</th>
            <th>审批意见</th>
            <th>状态 / 拍板</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in candidates" :key="c.candidate_id">
            <td><code>{{ c.sku }}</code></td>
            <td>{{ c.name }}</td>
            <td class="tnum">{{ c.total_score }} 分 / {{ (c.est_margin_pct * 100).toFixed(1) }}%</td>
            <td><code>{{ c.submitter_id || "-" }}</code></td>
            <td>
              <input
                v-if="c.status === 'PENDING_APPROVAL'"
                v-model="noteMap[c.candidate_id]"
                class="input"
                placeholder="填写终审拍板意见"
              />
              <span v-else>{{ c.decision_note || "-" }}</span>
            </td>
            <td>
              <template v-if="c.status === 'PENDING_APPROVAL'">
                <button type="button" class="btn btn-sm btn-success" @click="decide(c.candidate_id, 'APPROVED')">批准测款</button>
                <button type="button" class="btn btn-sm btn-danger" style="margin-left:4px;" @click="decide(c.candidate_id, 'REJECTED')">淘汰</button>
              </template>
              <span v-else class="pill" :class="c.status === 'APPROVED' ? 'p-green' : 'p-gray'">{{ c.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
