<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const question = ref("当前整体毛利率与哪个 SKU 利润贡献最高？有没有断货告警？");
const includeMock = ref(false);
const respData = ref<any>(null);
const errMsg = ref("");

const presets = [
  "当前整体毛利率与哪个 SKU 利润贡献最高？",
  "现在有哪些库存断货预警和待审批补货？",
  "7日广告花费和售后退款对净利润有多大影响？",
];

async function ask(q: string) {
  question.value = q;
  errMsg.value = "";
  try {
    respData.value = await platformApi.askBiAssistant(q, includeMock.value);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void ask(question.value));
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="card">
      <div class="card-title">
        <span>经营智能问答助手（只读查数与溯源）</span>
        <label style="font-size:12px;font-weight:400;display:flex;align-items:center;gap:6px;">
          <input v-model="includeMock" type="checkbox" @change="ask(question)" />
          含演示订单
        </label>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <button v-for="p in presets" :key="p" type="button" class="btn btn-sm" @click="ask(p)">{{ p }}</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input v-model="question" class="input" placeholder="输入只读经营问题（写/删指令将触发 403 拦截）" />
        <button type="button" class="btn btn-primary btn-lg" @click="ask(question)">实时问数</button>
      </div>

      <pre
        style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 14px;white-space:pre-wrap;font-family:inherit;font-size:13.5px;line-height:1.65;margin:0 0 10px;"
      >{{ respData?.answer || "正在查询实时数据库..." }}</pre>

      <div v-if="respData?.lineage_sources" style="font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span>溯源表：</span>
        <span v-for="src in respData.lineage_sources" :key="src" class="pill p-gray">{{ src }}</span>
      </div>
    </div>
  </div>
</template>
