<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const items = ref<any[]>([]);
const priceEdit = ref<Record<string, number>>({});
const form = reactive({
  sku: "SKU-00704",
  competitor_brand: "",
  asin_or_ref: "",
  price_usd: 28.9,
  rating: 4.4,
  bsr_rank: 350,
});
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    items.value = (await platformApi.listCompetitors()).items;
    items.value.forEach((c) => {
      priceEdit.value[c.watch_id] = c.price_usd;
    });
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function addComp() {
  errMsg.value = "";
  try {
    await platformApi.createCompetitor(form);
    ws.showToast("已新增竞品监控项");
    form.competitor_brand = "";
    form.asin_or_ref = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function updatePrice(c: any) {
  errMsg.value = "";
  try {
    const res = await platformApi.updateCompetitor(c.watch_id, {
      price_usd: priceEdit.value[c.watch_id] || c.price_usd,
      rating: c.rating,
      bsr_rank: c.bsr_rank,
      negative_topics: c.negative_topics || [],
    });
    ws.showToast(res.last_alert ? `已更新竞品价格：${res.last_alert}` : "已更新竞品最新抓拍报价");
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
        <div class="card-title">竞品动态与差评舆情监控（M3-1 · 对标价差跟踪）</div>
        <table class="table">
          <thead>
            <tr>
              <th>对标 SKU</th>
              <th>竞品品牌 / ASIN</th>
              <th>竞品价 vs 我方 / BSR</th>
              <th>评分 / 情感</th>
              <th>高频差评痛点</th>
              <th>更新报价</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in items" :key="c.watch_id">
              <td><code>{{ c.sku }}</code></td>
              <td>
                <strong>{{ c.competitor_brand }}</strong>
                <div style="font-size:11px;color:#64748b;">{{ c.asin_or_ref }}</div>
                <div v-if="c.last_alert" style="font-size:11px;color:#b45309;">{{ c.last_alert }}</div>
              </td>
              <td class="tnum">
                ${{ c.price_usd }}
                <span v-if="c.price_diff_usd !== null" :style="{ color: c.price_diff_usd < 0 ? '#b91c1c' : '#047857' }">
                  ({{ c.price_diff_usd >= 0 ? "+" : "" }}{{ c.price_diff_usd }})
                </span>
                / #{{ c.bsr_rank }}
              </td>
              <td class="tnum">{{ c.rating }}★ ({{ (c.sentiment_score * 100).toFixed(0) }}%)</td>
              <td>
                <span v-for="t in c.negative_topics" :key="t" class="pill p-amber" style="margin:2px;">{{ t }}</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;">
                  <input v-model.number="priceEdit[c.watch_id]" type="number" step="0.5" class="input" style="width:72px;" />
                  <button type="button" class="btn btn-sm" @click="updatePrice(c)">更新</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">新增竞品 ASIN 监控（需 m3:edit）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">我方对标 SKU</label>
            <input v-model="form.sku" class="input" />
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">竞品品牌名</label>
              <input v-model="form.competitor_brand" class="input" placeholder="如 Nesco Pro" />
            </div>
            <div>
              <label class="field-label">ASIN / 竞品链接编码</label>
              <input v-model="form.asin_or_ref" class="input" placeholder="如 B0C998877" />
            </div>
          </div>
          <div class="grid-3">
            <div>
              <label class="field-label">竞品售价 (USD)</label>
              <input v-model.number="form.price_usd" type="number" step="0.1" class="input" />
            </div>
            <div>
              <label class="field-label">评分</label>
              <input v-model.number="form.rating" type="number" step="0.1" min="1" max="5" class="input" />
            </div>
            <div>
              <label class="field-label">BSR 排名</label>
              <input v-model.number="form.bsr_rank" type="number" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-primary" @click="addComp">添加竞品监控</button>
        </div>
      </div>
    </div>
  </div>
</template>
