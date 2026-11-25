<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const faqs = ref<any[]>([]);
const sku = ref("SKU-00704");
const painText = ref("");
const faqQ = ref("");
const faqA = ref("");
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    faqs.value = (await platformApi.listFaqs()).items;
    const hit = faqs.value.find((f) => f.sku === sku.value) || faqs.value[0];
    if (hit) selectFaq(hit);
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function selectFaq(f: any) {
  sku.value = f.sku;
  painText.value = (f.pain_points || []).join("\n");
  faqQ.value = f.faq_pairs?.[0]?.q || "";
  faqA.value = f.faq_pairs?.[0]?.a || "";
}

async function saveFaq() {
  errMsg.value = "";
  try {
    await platformApi.upsertFaq({
      sku: sku.value,
      pain_points: painText.value.split("\n").map((s) => s.trim()).filter(Boolean),
      faq_pairs: faqQ.value ? [{ q: faqQ.value, a: faqA.value }] : [],
    });
    ws.showToast(`已更新 ${sku.value} 导购 FAQ，M7 文案引擎将实时引用！`);
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

    <div class="grid-2">
      <div class="card">
        <div class="card-title">客服导购商品库（M1-2 · 供 M7-1 与 M1-4 实时检索）</div>
        <table class="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>痛点数</th>
              <th>标准 Q&amp;A</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in faqs" :key="f.faq_id">
              <td><code>{{ f.sku }}</code></td>
              <td class="tnum">{{ (f.pain_points || []).length }}</td>
              <td class="tnum">{{ (f.faq_pairs || []).length }}</td>
              <td><button type="button" class="btn btn-sm" @click="selectFaq(f)">编辑</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">维护 SKU 痛点与 FAQ（需 m1:faq:edit）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">SKU</label>
            <input v-model="sku" class="input" />
          </div>
          <div>
            <label class="field-label">买家高频痛点（每行一条）</label>
            <textarea v-model="painText" class="textarea" style="min-height:76px;"></textarea>
          </div>
          <div>
            <label class="field-label">高频问题 Q</label>
            <input v-model="faqQ" class="input" />
          </div>
          <div>
            <label class="field-label">标准回复 A</label>
            <textarea v-model="faqA" class="textarea" style="min-height:66px;"></textarea>
          </div>
          <button type="button" class="btn btn-primary" @click="saveFaq">保存导购知识库</button>
        </div>
      </div>
    </div>
  </div>
</template>
