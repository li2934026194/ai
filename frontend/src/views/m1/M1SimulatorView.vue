<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const router = useRouter();
const sku = ref("SKU-00704");
const question = ref("这个迷你封口机一次充电能封多少个零食袋？");
const result = ref<{ session_id: string; suggested_reply: string } | null>(null);
const errMsg = ref("");

async function sendSim() {
  errMsg.value = "";
  try {
    result.value = await platformApi.simulateInquiry(sku.value, question.value);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="card">
      <div class="card-title">
        <span>买家咨询安全模拟测试器（M1-4 · 标记 MOCK 绝不发真实平台）</span>
        <button type="button" class="btn btn-sm" @click="router.push('/m1/sessions')">查看 M1-1 会话台 →</button>
      </div>
      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">咨询 SKU</label>
            <select v-model="sku" class="select">
              <option value="SKU-00704">SKU-00704 无线真空迷你封口机</option>
              <option value="BAG-108">BAG-108 轻量通勤双肩包</option>
              <option value="FAN-203">FAN-203 便携静音循环扇</option>
            </select>
          </div>
          <div>
            <label class="field-label">模拟买家咨询问题</label>
            <textarea v-model="question" class="textarea"></textarea>
          </div>
          <button type="button" class="btn btn-primary" @click="sendSim">发起模拟进线测试</button>
        </div>

        <div>
          <div v-if="result" class="alert alert-green">
            <strong>模拟进线已生成会话 <code>{{ result.session_id }}</code></strong>
            <div style="margin-top:8px;">{{ result.suggested_reply }}</div>
          </div>
          <div v-else class="alert alert-blue">
            点击左侧按钮即可安全模拟买家咨询并检验 M1-2 知识库命中回复效果。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
