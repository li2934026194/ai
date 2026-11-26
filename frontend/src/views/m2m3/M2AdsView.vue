<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const ads = ref<any[]>([]);
const budgetMap = ref<Record<string, number>>({});
const showCreate = ref(false);
const newAd = reactive({
  sku: "SKU-00704",
  platform: "Amazon Sponsored",
  campaign_name: "",
  daily_budget_usd: 45,
});
const errMsg = ref("");

const adKpis = computed(() => {
  const totalBudget = ads.value.reduce((s, a) => s + Number(a.daily_budget_usd || 0), 0);
  const spend7d = ads.value.reduce((s, a) => s + Number(a.spend_7d_usd || 0), 0);
  const sales7d = ads.value.reduce((s, a) => s + Number(a.sales_7d_usd || 0), 0);
  const roas = spend7d > 0 ? sales7d / spend7d : 0;
  const highAcos = ads.value.filter((a) => a.high_acos_alert).length;
  return { totalBudget, spend7d, sales7d, roas, highAcos };
});

async function load() {
  errMsg.value = "";
  try {
    ads.value = (await platformApi.listAds()).items;
    ads.value.forEach((a) => {
      budgetMap.value[a.campaign_id] = a.daily_budget_usd;
    });
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function addAd() {
  errMsg.value = "";
  try {
    await platformApi.createAd(newAd);
    ws.showToast(`已创建广告计划 ${newAd.campaign_name}`);
    newAd.campaign_name = "";
    showCreate.value = false;
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function saveAd(ad: any, status: "ACTIVE" | "PAUSED", factor = 1) {
  errMsg.value = "";
  const target = Math.max(5, Math.round((budgetMap.value[ad.campaign_id] || ad.daily_budget_usd) * factor));
  try {
    await platformApi.adjustAd(ad.campaign_id, target, status);
    ws.showToast(`已调整广告计划 ${ad.campaign_name}（预算 $${target}）`);
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

    <!-- 数据归纳 KPI -->
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">日预算总盘</div>
        <div class="kpi-val">${{ adKpis.totalBudget.toFixed(0) }}</div>
        <div class="kpi-sub">{{ ads.length }} 个广告计划</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">7日累计花费</div>
        <div class="kpi-val" style="color:#b45309;">${{ adKpis.spend7d.toFixed(0) }}</div>
        <div class="kpi-sub">产出比 ROAS {{ adKpis.roas.toFixed(2) }}x</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">7日广告销售额</div>
        <div class="kpi-val" style="color:#047857;">${{ adKpis.sales7d.toFixed(0) }}</div>
        <div class="kpi-sub">直接归因订单</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">高 ACOS 预警</div>
        <div class="kpi-val" :style="{ color: adKpis.highAcos ? '#b91c1c' : '#047857' }">{{ adKpis.highAcos }}</div>
        <div class="kpi-sub">ACOS &gt; 30% 需降预算</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>广告投放监控与预算调节</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-sm btn-primary" @click="showCreate = !showCreate">
            {{ showCreate ? "收起新建" : "+ 新建广告计划" }}
          </button>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
      </div>

      <div v-if="showCreate" style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div class="grid-5" style="align-items:end;">
          <div>
            <label class="field-label">SKU</label>
            <input v-model="newAd.sku" class="input" />
          </div>
          <div>
            <label class="field-label">渠道</label>
            <select v-model="newAd.platform" class="select">
              <option value="Amazon Sponsored">Amazon Sponsored</option>
              <option value="TikTok Spark Ads">TikTok Spark Ads</option>
              <option value="Shopee Keyword Ads">Shopee Keyword Ads</option>
            </select>
          </div>
          <div>
            <label class="field-label">计划名称</label>
            <input v-model="newAd.campaign_name" class="input" placeholder="如 US-精准词组" />
          </div>
          <div>
            <label class="field-label">日预算 (USD)</label>
            <input v-model.number="newAd.daily_budget_usd" type="number" step="5" class="input" />
          </div>
          <div>
            <button type="button" class="btn btn-primary" style="width:100%;" @click="addAd">创建并启用</button>
          </div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>广告计划 / 渠道</th>
            <th>7日花费 → 产出</th>
            <th>ACOS / ROAS</th>
            <th>日预算 (USD)</th>
            <th>状态与调控</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ad in ads" :key="ad.campaign_id">
            <td>
              <strong>{{ ad.campaign_name }}</strong>
              <span v-if="ad.high_acos_alert" class="pill p-red" style="margin-left:6px;">ACOS 偏高</span>
              <div class="table-sub"><code>{{ ad.sku }}</code> · {{ ad.platform }}</div>
            </td>
            <td class="tnum">${{ ad.spend_7d_usd }} → <strong style="color:#047857;">${{ ad.sales_7d_usd }}</strong></td>
            <td class="tnum">
              <span :style="{ color: ad.acos > 0.3 ? '#b91c1c' : '#047857', fontWeight: 700 }">
                {{ (ad.acos * 100).toFixed(1) }}%
              </span>
              / {{ ad.roas }}x
            </td>
            <td>
              <input v-model.number="budgetMap[ad.campaign_id]" type="number" step="5" class="input" style="width:84px;" />
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-primary" @click="saveAd(ad, 'ACTIVE')">保存启用</button>
                <button v-if="ad.high_acos_alert" type="button" class="btn btn-sm btn-warning" @click="saveAd(ad, 'ACTIVE', 0.8)">降20%</button>
                <button type="button" class="btn btn-sm" @click="saveAd(ad, 'PAUSED')">暂停</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
