<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { usePermission } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const { roleMeta } = usePermission();

const loading = ref(false);
const errMsg = ref("");
const data = ref<{
  kpis: {
    active_skus: number;
    connected_shops: number;
    gmv_usd: number;
    open_alerts: number;
    pending_replenish: number;
    pending_aftersales: number;
  };
  todos: Array<{ id: string; module: string; title: string; desc: string; route: string }>;
} | null>(null);

async function load() {
  loading.value = true;
  errMsg.value = "";
  try {
    data.value = await platformApi.getHomeWorkbench();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  } finally {
    loading.value = false;
  }
}

watch(() => ws.currentRole, () => void load());
onMounted(() => void load());
</script>

<template>
  <div>
    <div class="alert alert-blue" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        <strong>欢迎回到 CrossPilot 业务协作工作台</strong> · 当前岗位：<span class="pill p-blue">{{ roleMeta.label }}</span>
      </div>
      <button type="button" class="btn btn-sm" @click="load">刷新工作台</button>
    </div>

    <div v-if="errMsg" class="alert alert-amber">
      当前岗位（{{ roleMeta.label }}）受 RBAC 隔离限制访问部分全局聚合指标：{{ errMsg }}
      <div style="margin-top:6px;">
        <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m1/simulator')">前往买家咨询模拟器</button>
      </div>
    </div>

    <template v-if="data">
      <div class="grid-4" style="margin-bottom:14px;">
        <div class="kpi-card">
          <div class="kpi-label">在营与测款 SKU</div>
          <div class="kpi-val">{{ data.kpis.active_skus }}</div>
          <div class="kpi-sub">M0-2 商品主档已联动</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">已连接跨境店铺</div>
          <div class="kpi-val">{{ data.kpis.connected_shops }}</div>
          <div class="kpi-sub">Amazon / TikTok / Shopee</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">台账累计 GMV</div>
          <div class="kpi-val" style="color:#047857;">${{ data.kpis.gmv_usd.toFixed(2) }}</div>
          <div class="kpi-sub">实时订单台账聚合</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">待处理异常与待审</div>
          <div class="kpi-val" style="color:#b45309;">
            {{ data.kpis.open_alerts + data.kpis.pending_replenish + data.kpis.pending_aftersales }}
          </div>
          <div class="kpi-sub">
            告警 {{ data.kpis.open_alerts }} · 补货 {{ data.kpis.pending_replenish }} · 售后 {{ data.kpis.pending_aftersales }}
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span>今日必办事项流转（M0 – M8）</span>
            <span class="pill p-blue">{{ data.todos.length }} 项待协同</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div
              v-for="t in data.todos"
              :key="t.id"
              style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:8px;gap:10px;"
            >
              <div>
                <div style="font-weight:700;font-size:13.5px;">
                  <span class="pill p-purple" style="margin-right:6px;">{{ t.module }}</span>
                  {{ t.title }}
                </div>
                <div style="font-size:12px;color:#475569;margin-top:2px;">{{ t.desc }}</div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" @click="router.push(t.route)">立即处理 →</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">全平台 6 大业务环节快速入口</div>
          <div class="grid-2" style="gap:8px;">
            <button type="button" class="btn" @click="router.push('/m0/shops')">① 店铺授权与台账 (M0)</button>
            <button type="button" class="btn" @click="router.push('/m4/workbench')">② 选品决策与过会 (M4)</button>
            <button type="button" class="btn" @click="router.push('/m7/copy')">② M7 内容与合规上架</button>
            <button type="button" class="btn" @click="router.push('/m1/sessions')">③ 客服与售后退款 (M1)</button>
            <button type="button" class="btn" @click="router.push('/m5/forecast')">④ 销量预测与校准 (M5)</button>
            <button type="button" class="btn" @click="router.push('/m6/smart')">④ 智能补货与路线 (M6)</button>
            <button type="button" class="btn" @click="router.push('/m2/overview')">⑤ 经营大屏与结算 (M2)</button>
            <button type="button" class="btn" @click="router.push('/m8/roles')">⑥ 权限矩阵与审计 (M8)</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
