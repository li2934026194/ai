<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const ads = ref<any[]>([]);
const budgetMap = ref<Record<string, number>>({});
const newAd = reactive({
  sku: "SKU-00704",
  platform: "Amazon Sponsored",
  campaign_name: "",
  daily_budget_usd: 45,
});
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

async function addAd() {
  errMsg.value = "";
  try {
    await platformApi.createAd(newAd);
    ws.showToast(`已创建广告计划 ${newAd.campaign_name}`);
    newAd.campaign_name = "";
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

    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">新建广告投放计划（需 m2:edit）</div>
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
          <input v-model="newAd.campaign_name" class="input" placeholder="如 US-自动精准词组" />
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

    <div class="card">
      <div class="card-title">
        <span>广告投放监控与日预算调节（M2-1 / M2-4 · 高 ACOS 自动预警）</span>
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
            <td>
              <strong>{{ ad.campaign_name }}</strong>
              <span v-if="ad.high_acos_alert" class="pill p-red" style="margin-left:4px;">ACOS&gt;30% 预警</span>
            </td>
            <td><code>{{ ad.sku }}</code> · {{ ad.platform }}</td>
            <td class="tnum">${{ ad.spend_7d_usd }} / ${{ ad.sales_7d_usd }}</td>
            <td class="tnum">{{ (ad.acos * 100).toFixed(1) }}% / {{ ad.roas }}x</td>
            <td>
              <input v-model.number="budgetMap[ad.campaign_id]" type="number" step="5" class="input" style="width:90px;" />
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-primary" @click="saveAd(ad, 'ACTIVE')">保存启用</button>
              <button v-if="ad.high_acos_alert" type="button" class="btn btn-sm" style="margin-left:4px;" @click="saveAd(ad, 'ACTIVE', 0.8)">降预算20%</button>
              <button type="button" class="btn btn-sm" style="margin-left:4px;" @click="saveAd(ad, 'PAUSED')">暂停</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
