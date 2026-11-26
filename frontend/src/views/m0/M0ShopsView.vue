<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const shops = ref<any[]>([]);
const errMsg = ref("");
const form = reactive({
  shop_code: "",
  name: "",
  platform: "amazon_us",
  currency: "USD",
  credential_mask: "****8820",
  is_mock: false,
});

const liveCount = computed(() => shops.value.filter((s) => !s.is_mock).length);
const mockCount = computed(() => shops.value.filter((s) => s.is_mock).length);
const warnCount = computed(() => shops.value.filter((s) => s.status !== "CONNECTED").length);

async function load() {
  errMsg.value = "";
  try {
    const res = await platformApi.listShops();
    shops.value = res.items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function createShop() {
  errMsg.value = "";
  try {
    await platformApi.createShop(form);
    ws.showToast("已连接新店铺并记录审计日志");
    form.shop_code = "";
    form.name = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function syncShop(shop: any) {
  errMsg.value = "";
  try {
    const res = await platformApi.syncShop(shop.shop_id);
    ws.showToast(`店铺 ${shop.shop_code} 同步完成（去重 ${res.dedup_count || 0}）`);
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

    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card"><div class="kpi-label">授权店铺总数</div><div class="kpi-val">{{ shops.length }}</div></div>
      <div class="kpi-card"><div class="kpi-label">实盘经营店铺</div><div class="kpi-val" style="color:#047857;">{{ liveCount }}</div></div>
      <div class="kpi-card"><div class="kpi-label">演示隔离 (MOCK)</div><div class="kpi-val" style="color:#b45309;">{{ mockCount }}</div></div>
      <div class="kpi-card"><div class="kpi-label">授权异常</div><div class="kpi-val" style="color:#b91c1c;">{{ warnCount }}</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>已授权店铺列表</span>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>店铺编号 / 名称</th>
              <th>平台</th>
              <th>环境</th>
              <th>同步</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in shops" :key="s.shop_id">
              <td>
                <strong>{{ s.name }}</strong>
                <div class="table-sub"><code>{{ s.shop_code }}</code> · 凭证 {{ s.credential_mask || "****4821" }}</div>
              </td>
              <td>{{ s.platform }} ({{ s.currency }})</td>
              <td>
                <span class="pill" :class="s.is_mock ? 'p-amber' : 'p-green'">
                  {{ s.is_mock ? "仅演示隔离" : "实盘" }}
                </span>
              </td>
              <td>
                <button type="button" class="btn btn-sm btn-primary" @click="syncShop(s)">同步订单</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">新增店铺授权</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">店铺代码</label>
              <input v-model="form.shop_code" class="input" placeholder="如 AMZ-EU-02" />
            </div>
            <div>
              <label class="field-label">API 凭证掩码</label>
              <input v-model="form.credential_mask" class="input" placeholder="如 ****8820" />
            </div>
          </div>
          <div>
            <label class="field-label">店铺名称</label>
            <input v-model="form.name" class="input" placeholder="如 Amazon DE Flagship" />
          </div>
          <div class="grid-2">
            <div>
              <label class="field-label">站点平台</label>
              <select v-model="form.platform" class="select">
                <option value="amazon_us">amazon_us</option>
                <option value="tiktok_us">tiktok_us</option>
                <option value="shopee_th">shopee_th</option>
                <option value="lazada">lazada</option>
                <option value="ebay">ebay</option>
              </select>
            </div>
            <div>
              <label class="field-label">结算币种</label>
              <select v-model="form.currency" class="select">
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="THB">THB</option>
                <option value="EUR">EUR</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
            <input v-model="form.is_mock" type="checkbox" />
            <span>标记为演示环境（不计入真实报表）</span>
          </label>
          <button type="button" class="btn btn-primary btn-lg" @click="createShop">授权并连接店铺</button>
        </div>
      </div>
    </div>
  </div>
</template>
