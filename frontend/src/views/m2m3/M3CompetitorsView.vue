<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const items = ref<any[]>([]);
const priceEdit = ref<Record<string, number>>({});
const showAdd = ref(false);
const form = reactive({
  sku: "SKU-00704",
  competitor_brand: "",
  asin_or_ref: "",
  price_usd: 28.9,
  rating: 4.4,
  bsr_rank: 350,
});
const errMsg = ref("");

const compStats = computed(() => {
  const count = items.value.length;
  const priceLower = items.value.filter((c) => (c.price_diff_usd ?? 0) < 0).length;
  const avgRating = count ? (items.value.reduce((s, c) => s + Number(c.rating || 0), 0) / count).toFixed(2) : "-";
  const topicSet = new Set(items.value.flatMap((c) => c.negative_topics || []));
  return { count, priceLower, avgRating, topicCount: topicSet.size };
});

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
    showAdd.value = false;
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
    ws.showToast(res.last_alert ? `已更新竞品价格：${res.last_alert}` : "已更新竞品报价");
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

    <!-- 归纳指标卡 -->
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">监控竞品数</div>
        <div class="kpi-val">{{ compStats.count }}</div>
        <div class="kpi-sub">跨类目实时跟踪</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">我方价格占优</div>
        <div class="kpi-val" style="color:#047857;">{{ compStats.count - compStats.priceLower }} 家</div>
        <div class="kpi-sub">低于我方定价：{{ compStats.priceLower }} 家</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">竞品平均评分</div>
        <div class="kpi-val">{{ compStats.avgRating }} ★</div>
        <div class="kpi-sub">对标口碑基准</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">提炼差评痛点</div>
        <div class="kpi-val" style="color:#b45309;">{{ compStats.topicCount }} 条</div>
        <div class="kpi-sub">可直接反哺 M7 文案</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>竞品动态与差评舆情台账</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-sm btn-primary" @click="showAdd = !showAdd">
            {{ showAdd ? "收起新增" : "+ 新增竞品 ASIN" }}
          </button>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
      </div>

      <div v-if="showAdd" style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div class="grid-3" style="margin-bottom:8px;">
          <div>
            <label class="field-label">我方对标 SKU</label>
            <input v-model="form.sku" class="input" />
          </div>
          <div>
            <label class="field-label">竞品品牌名</label>
            <input v-model="form.competitor_brand" class="input" placeholder="如 Nesco Pro" />
          </div>
          <div>
            <label class="field-label">ASIN / 编码</label>
            <input v-model="form.asin_or_ref" class="input" placeholder="如 B0C998877" />
          </div>
        </div>
        <div class="grid-4" style="align-items:end;">
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
          <div>
            <button type="button" class="btn btn-primary" style="width:100%;" @click="addComp">添加监控</button>
          </div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>对标 SKU</th>
            <th>竞品品牌 / ASIN</th>
            <th>竞品价 (价差) / BSR</th>
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
              <div class="table-sub">{{ c.asin_or_ref }}</div>
              <div v-if="c.last_alert" style="font-size:11px;color:#b45309;margin-top:2px;">{{ c.last_alert }}</div>
            </td>
            <td class="tnum">
              <strong>${{ c.price_usd }}</strong>
              <span v-if="c.price_diff_usd !== null" :style="{ color: c.price_diff_usd < 0 ? '#b91c1c' : '#047857' }">
                ({{ c.price_diff_usd >= 0 ? "+" : "" }}{{ c.price_diff_usd }})
              </span>
              <div class="table-sub">BSR #{{ c.bsr_rank }}</div>
            </td>
            <td class="tnum">{{ c.rating }}★ <span class="table-sub">({{ (c.sentiment_score * 100).toFixed(0) }}%)</span></td>
            <td>
              <span v-for="t in c.negative_topics" :key="t" class="pill p-amber" style="margin:2px;">{{ t }}</span>
            </td>
            <td>
              <div style="display:flex;gap:6px;">
                <input v-model.number="priceEdit[c.watch_id]" type="number" step="0.5" class="input" style="width:78px;" />
                <button type="button" class="btn btn-sm btn-primary" @click="updatePrice(c)">更新</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
