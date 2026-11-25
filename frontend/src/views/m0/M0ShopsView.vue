<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
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
  is_mock: true,
});

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

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>已连接跨境店铺列表（M0-1）</span>
          <button type="button" class="btn btn-sm" @click="load">刷新状态</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>店铺编号</th>
              <th>店铺名称</th>
              <th>平台</th>
              <th>环境隔离</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in shops" :key="s.shop_id">
              <td><code>{{ s.shop_code }}</code></td>
              <td>{{ s.name }}</td>
              <td>{{ s.platform }} ({{ s.currency }})</td>
              <td>
                <span class="pill" :class="s.is_mock ? 'p-amber' : 'p-green'">
                  {{ s.is_mock ? "演示隔离" : "实盘店铺" }}
                </span>
              </td>
              <td><span class="pill p-blue">{{ s.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">新增店铺授权连接（需 m0:shop:manage 权限）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">店铺代码</label>
            <input v-model="form.shop_code" class="input" placeholder="如 AMZ-EU-02" />
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
              </select>
            </div>
            <div>
              <label class="field-label">结算币种</label>
              <input v-model="form.currency" class="input" />
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
            <input v-model="form.is_mock" type="checkbox" />
            <span>标记为演示测试环境（隔离真实经营报表）</span>
          </label>
          <button type="button" class="btn btn-primary" @click="createShop">授权并连接店铺</button>
        </div>
      </div>
    </div>
  </div>
</template>
