<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const router = useRouter();
const skuList = ref<any[]>([]);
const sku = ref("SKU-00704");
const question = ref("这个迷你封口机一次充电能封多少个零食袋？");
const result = ref<{
  session_id: string;
  suggested_reply: string;
  matched_q?: string;
  confidence?: number;
  handoff_required?: boolean;
} | null>(null);
const errMsg = ref("");

async function loadSkus() {
  try {
    skuList.value = (await platformApi.listProducts()).items;
    if (skuList.value.length && !skuList.value.some((p) => p.sku === sku.value)) {
      sku.value = skuList.value[0].sku;
    }
  } catch {
    // fallback if m0 read fails
  }
}

async function sendSim() {
  errMsg.value = "";
  try {
    result.value = await platformApi.simulateInquiry(sku.value, question.value);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void loadSkus());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="card">
      <div class="card-title">
        <span>买家咨询模拟器（标记 MOCK 隔离 · 未命中自动转人工）</span>
        <button type="button" class="btn btn-sm" @click="router.push('/m1/sessions')">查看会话台 →</button>
      </div>
      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">咨询 SKU</label>
            <select v-model="sku" class="select">
              <option v-for="p in skuList" :key="p.sku" :value="p.sku">{{ p.sku }} {{ p.name }}</option>
              <option v-if="!skuList.length" value="SKU-00704">SKU-00704 无线真空迷你封口机</option>
            </select>
          </div>
          <div>
            <label class="field-label">模拟买家咨询问题</label>
            <textarea v-model="question" class="textarea"></textarea>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="sendSim">发起模拟进线测试</button>
        </div>

        <div>
          <div v-if="result" class="alert" :class="result.handoff_required ? 'alert-amber' : 'alert-green'">
            <strong>
              已生成会话 <code>{{ result.session_id }}</code>
              （{{ result.handoff_required ? "已触发安全兜底转人工" : `FAQ 命中 · 置信度 ${Math.round((result.confidence || 0) * 100)}%` }}）
            </strong>
            <div v-if="result.matched_q" style="font-size:12px;margin-top:4px;opacity:0.85;">命中问题：{{ result.matched_q }}</div>
            <div style="margin-top:8px;">{{ result.suggested_reply }}</div>
          </div>
          <div v-else class="alert alert-blue">
            点击左侧按钮即可安全模拟买家咨询，验证 M1-2 知识库命中率及未命中兜底转人工机制。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
