<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const question = ref("当前整体毛利率与哪个 SKU 利润贡献最高？有没有断货告警？");
const answer = ref("");
const errMsg = ref("");
const overview = ref<any>(null);
const alerts = ref<any[]>([]);

const presets = [
  "当前整体毛利率与哪个 SKU 利润贡献最高？",
  "现在有哪些库存断货预警和待审批补货？",
  "7日广告花费和售后退款对净利润有多大影响？",
];

async function loadData() {
  errMsg.value = "";
  try {
    const [ov, al] = await Promise.all([platformApi.getM2Overview(), platformApi.listAlerts()]);
    overview.value = ov;
    alerts.value = al.items;
    ask(question.value);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function ask(q: string) {
  question.value = q;
  if (/delete|drop|update|insert|修改|删除/i.test(q)) {
    answer.value = "【只读安全拦截】经营智能问数助手仅支持只读指标查询与口径溯源，严禁执行任何修改或删除操作。";
    return;
  }
  if (!overview.value) return;
  const s = overview.value.summary;
  const topSku = [...(overview.value.sku_profits || [])].sort((a, b) => b.net_profit_usd - a.net_profit_usd)[0];
  const openAlerts = alerts.value.filter((a) => a.status === "OPEN");
  answer.value = [
    `【口径溯源：M0 实盘订单 + M2 广告/成本 + M6 告警中心】`,
    `• 当前台账总 GMV：$${s.total_gmv_usd.toFixed(2)}，预估净利润：$${s.net_profit_usd.toFixed(2)}（毛利率 ${s.margin_pct}%）。`,
    topSku ? `• 利润贡献最高 SKU：${topSku.sku}（${topSku.name}），净利 $${topSku.net_profit_usd}。` : "",
    `• 7日广告花费：$${s.ad_spend_7d_usd}；已批售后退款：$${s.approved_refund_usd}。`,
    `• 当前未确认断货预警 ${openAlerts.length} 条：${openAlerts.map((x) => x.message).join("；") || "暂无严重告警"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

onMounted(() => void loadData());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="card">
      <div class="card-title">经营智能问答助手（M3-2 · 只读查数与口径溯源）</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <button v-for="p in presets" :key="p" type="button" class="btn btn-sm" @click="ask(p)">{{ p }}</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input v-model="question" class="input" placeholder="输入经营查数问题（只读查数，拒绝修改/删除指令）" />
        <button type="button" class="btn btn-primary" @click="ask(question)">问数查询</button>
      </div>
      <pre
        style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px;white-space:pre-wrap;font-family:inherit;font-size:13.5px;margin:0;"
      >{{ answer || "正在加载实盘经营指标..." }}</pre>
    </div>
  </div>
</template>
