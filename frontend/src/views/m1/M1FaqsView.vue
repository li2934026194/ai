<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const faqs = ref<any[]>([]);
const sku = ref("SKU-00704");
const painText = ref("");
const faqPairs = ref<Array<{ q: string; a: string }>>([{ q: "", a: "" }]);
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
  faqPairs.value =
    f.faq_pairs && f.faq_pairs.length
      ? JSON.parse(JSON.stringify(f.faq_pairs))
      : [{ q: "", a: "" }];
}

function addPair() {
  faqPairs.value.push({ q: "", a: "" });
}

function removePair(idx: number) {
  if (faqPairs.value.length > 1) faqPairs.value.splice(idx, 1);
}

async function saveFaq() {
  errMsg.value = "";
  try {
    const cleanPairs = faqPairs.value
      .map((p) => ({ q: p.q.trim(), a: p.a.trim() }))
      .filter((p) => p.q && p.a);
    await platformApi.upsertFaq({
      sku: sku.value,
      pain_points: painText.value.split("\n").map((s) => s.trim()).filter(Boolean),
      faq_pairs: cleanPairs,
    });
    ws.showToast(`已保存 ${sku.value} 导购 FAQ（${cleanPairs.length} 组问答），M7 与 M1-4 将实时引用！`);
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

    <div class="summary-bar">
      <span class="pill p-blue">知识联动</span>
      <span>维护各 SKU 高频痛点与标准 Q&amp;A，M1-4 咨询模拟器与 M7-1 文案工作台实时检索引用。</span>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>客服导购商品库</span>
          <span class="pill p-green">{{ faqs.length }} 个 SKU</span>
        </div>
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
        <div class="card-title">
          <span>编辑痛点与 Q&amp;A：{{ sku }}</span>
          <button type="button" class="btn btn-sm" @click="addPair">+ 新增问答</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">SKU</label>
            <input v-model="sku" class="input" />
          </div>
          <div>
            <label class="field-label">买家高频痛点（每行一条）</label>
            <textarea v-model="painText" class="textarea" style="min-height:60px;"></textarea>
          </div>
          <div
            v-for="(pair, idx) in faqPairs"
            :key="idx"
            style="border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12px;">问答 #{{ idx + 1 }}</strong>
              <button
                v-if="faqPairs.length > 1"
                type="button"
                class="btn btn-sm btn-danger"
                @click="removePair(idx)"
              >
                删除
              </button>
            </div>
            <input v-model="pair.q" class="input" placeholder="高频问题 Q..." />
            <textarea v-model="pair.a" class="textarea" style="min-height:46px;" placeholder="标准合规回复 A..."></textarea>
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="saveFaq">保存导购知识库</button>
        </div>
      </div>
    </div>
  </div>
</template>
