<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const sessions = ref<any[]>([]);
const replyMap = ref<Record<string, string>>({});
const filterMode = ref<"all" | "live" | "mock">("all");
const errMsg = ref("");

const tktForm = reactive({
  sku: "SKU-00704",
  order_ref: "AMZ-114-9901821",
  platform: "Amazon US",
  issue_type: "配件缺件局部退款",
  refund_usd: 8.5,
  evidence_note: "买家提供开箱视频，核实订单已送达",
});

const stats = computed(() => ({
  total: sessions.value.length,
  pending: sessions.value.filter((s) => s.status !== "REPLIED").length,
  replied: sessions.value.filter((s) => s.status === "REPLIED").length,
  mock: sessions.value.filter((s) => s.is_mock).length,
}));

async function load() {
  errMsg.value = "";
  try {
    const params =
      filterMode.value === "live"
        ? { is_mock: false }
        : filterMode.value === "mock"
          ? { is_mock: true }
          : undefined;
    sessions.value = (await platformApi.listSessions(params)).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function sendReply(sid: string) {
  errMsg.value = "";
  try {
    await platformApi.replySession(
      sid,
      replyMap.value[sid] || "您好，该封口机支持常规零食袋封口，真空抽气建议搭配网格真空袋效果更佳。"
    );
    ws.showToast("已发送客服回复并记录会话审计");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function escalateSession(s: any) {
  tktForm.sku = s.sku;
  tktForm.evidence_note = `转自会话 ${s.session_id}（${s.buyer_name}）：${s.question}`;
  ws.showToast(`已将 ${s.sku} 会话证据载入右侧售后建单表单`);
}

async function createTicket() {
  errMsg.value = "";
  try {
    const res = await platformApi.createAftersales(tktForm);
    ws.showToast(
      `已创建售后退款工单${res.order_verified ? `（已校验原订单总额 $${res.order_amount_usd}）` : ""}，流转至 M1-3`
    );
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
      <div class="kpi-card"><div class="kpi-label">会话总数</div><div class="kpi-val">{{ stats.total }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待客服回复</div><div class="kpi-val" style="color:#b45309;">{{ stats.pending }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已回复闭环</div><div class="kpi-val" style="color:#047857;">{{ stats.replied }}</div></div>
      <div class="kpi-card"><div class="kpi-label">模拟进线 (MOCK)</div><div class="kpi-val" style="color:#64748b;">{{ stats.mock }}</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>买家咨询会话台</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <select v-model="filterMode" class="select" style="width:120px;" @change="load">
              <option value="all">全部会话</option>
              <option value="live">仅实盘</option>
              <option value="mock">仅 MOCK</option>
            </select>
            <button type="button" class="btn btn-sm" @click="load">刷新</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div
            v-for="s in sessions"
            :key="s.session_id"
            style="border:1px solid var(--border);border-radius:8px;padding:10px;"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px;flex-wrap:wrap;">
              <strong>
                {{ s.buyer_name }} · <code>{{ s.sku }}</code>
                <span v-if="s.is_mock" class="pill p-amber" style="margin-left:4px;">MOCK</span>
              </strong>
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="btn btn-sm" @click="escalateSession(s)">转入售后建单</button>
                <span class="pill" :class="s.status === 'REPLIED' ? 'p-green' : 'p-amber'">{{ s.status }}</span>
              </div>
            </div>
            <div style="font-size:12.5px;color:#334155;margin-bottom:6px;">问：{{ s.question }}</div>
            <div v-if="s.reply" style="font-size:12.5px;color:#047857;margin-bottom:6px;">答：{{ s.reply }}</div>
            <div style="display:flex;gap:6px;">
              <input v-model="replyMap[s.session_id]" class="input" placeholder="输入客服回复内容..." />
              <button type="button" class="btn btn-sm btn-primary" @click="sendReply(s.session_id)">发送</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">核单发起售后退款工单</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">SKU</label>
              <input v-model="tktForm.sku" class="input" />
            </div>
            <div>
              <label class="field-label">订单编号（自动核验上限）</label>
              <input v-model="tktForm.order_ref" class="input" />
            </div>
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">问题类型</label>
              <input v-model="tktForm.issue_type" class="input" />
            </div>
            <div>
              <label class="field-label">申请退款 (USD)</label>
              <input v-model.number="tktForm.refund_usd" type="number" step="0.5" class="input" />
            </div>
          </div>
          <div>
            <label class="field-label">凭证与核验说明</label>
            <textarea v-model="tktForm.evidence_note" class="textarea" style="min-height:66px;"></textarea>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="createTicket">提交售后退款工单</button>
        </div>
      </div>
    </div>
  </div>
</template>
