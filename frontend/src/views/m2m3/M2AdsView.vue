<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const ads = ref<any[]>([]);
const budgetMap = ref<Record<string, number>>({});
const errMsg = ref("");

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

async function saveAd(ad: any, status: "ACTIVE" | "PAUSED") {
  errMsg.value = "";
  try {
    await platformApi.adjustAd(ad.campaign_id, budgetMap.value[ad.campaign_id] || ad.daily_budget_usd, status);
    ws.showToast(`已调整广告计划 ${ad.campaign_name}`);
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

    <div class="card">
      <div class="card-title">
        <span>广告投放监控与日预算调节（M2-1 / M2-4）</span>
        <button type="button" class="btn btn-sm" @click="load">刷新广告</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>广告计划</th>
            <th>SKU / 渠道</th>
            <th>7日花费 / 销售额</th>
            <th>ACOS / ROAS</th>
            <th>日预算 (USD)</th>
            <th>状态与操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ad in ads" :key="ad.campaign_id">
            <td><strong>{{ ad.campaign_name }}</strong></td>
            <td><code>{{ ad.sku }}</code> · {{ ad.platform }}</td>
            <td class="tnum">${{ ad.spend_7d_usd }} / ${{ ad.sales_7d_usd }}</td>
            <td class="tnum">{{ (ad.acos * 100).toFixed(1) }}% / {{ ad.roas }}x</td>
            <td>
              <input v-model.number="budgetMap[ad.campaign_id]" type="number" step="5" class="input" style="width:90px;" />
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-primary" @click="saveAd(ad, 'ACTIVE')">保存启用</button>
              <button type="button" class="btn btn-sm" style="margin-left:4px;" @click="saveAd(ad, 'PAUSED')">暂停</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
