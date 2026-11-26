<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { platformApi } from "@/api/platform";
import { usePermission } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const { roleMeta, hasPerm } = usePermission();

const loading = ref(false);
const restrictedSummary = ref(false);
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

const ROLE_ACTIONS: Record<string, Array<{ title: string; desc: string; route: string; cta: string; badge: string }>> = {
  approver: [
    { title: "M4 测款终审", desc: "核定选品毛利门槛并批准转正", route: "/m4/approval", cta: "去终审 →", badge: "审批" },
    { title: "M6 补货下单审批", desc: "批准补货申请并生成采购 PO", route: "/m6/applies", cta: "去审批 →", badge: "审批" },
    { title: "M1 售后退款审核", desc: "核验买家凭证与退款金额", route: "/m1/aftersales", cta: "审退款 →", badge: "审批" },
    { title: "M7 合规终审放行", desc: "检查 5 项全绿门禁后发布", route: "/m7/compliance", cta: "去放行 →", badge: "M7" },
  ],
  creator: [
    { title: "M7-1 多语言文案", desc: "生成三变体 Listing 并三层扫词", route: "/m7/copy", cta: "写文案 →", badge: "主责" },
    { title: "M7-2 1+4 商品套图", desc: "白底主图与场景附图制作", route: "/m7/images", cta: "做套图 →", badge: "主责" },
    { title: "M7-3 短视频与 A+", desc: "15s 分镜脚本文案与 4 模块 A+", route: "/m7/video-aplus", cta: "做 A+ →", badge: "主责" },
    { title: "M7-4 合规检查打包", desc: "跑全绿门禁并导出离线包", route: "/m7/compliance", cta: "去打包 →", badge: "送审" },
  ],
  manager: [
    { title: "M2 正式经营大屏", desc: "查看实盘 GMV、净利与渠道结算", route: "/m2/overview", cta: "看大屏 →", badge: "核心" },
    { title: "M0 店铺授权隔离", desc: "监管店铺连接状态与实盘隔离", route: "/m0/shops", cta: "管店铺 →", badge: "管理" },
    { title: "M8 员工与权限治理", desc: "管理 9 岗账号与审批流开关", route: "/m8/users", cta: "管权限 →", badge: "治理" },
    { title: "M3 智能问数", desc: "自然语言查经营异常与溯源", route: "/m3/ask", cta: "去问数 →", badge: "只读" },
  ],
  planner: [
    { title: "M2 智能驾驶舱设计", desc: "配置 4 卡指标草稿并正式发布", route: "/m2/overview", cta: "改驾驶舱 →", badge: "核心" },
    { title: "M6 智能补货申报", desc: "对比四路线/三目标并提交申请", route: "/m6/smart", cta: "算补货 →", badge: "主责" },
    { title: "M2 广告预算调节", desc: "处理高 ACOS 预警并调节日预算", route: "/m2/ads", cta: "调广告 →", badge: "运营" },
    { title: "M0 成本改价申请", desc: "提交新报价等待财务/主管复核", route: "/m0/ledger", cta: "提调价 →", badge: "协同" },
  ],
  selector: [
    { title: "M4-1 候选商品导入", desc: "单品录入或 CSV 批量入池测算", route: "/m4/import", cta: "导选品 →", badge: "主责" },
    { title: "M4-2 五维打分对比", desc: "多品并排对比后提交主管终审", route: "/m4/workbench", cta: "去评估 →", badge: "主责" },
    { title: "M5 商品预测方案", desc: "参考历史同类品预测模型表现", route: "/m5/profiles", cta: "看预测 →", badge: "参考" },
    { title: "M0 商品主档参考", desc: "查看已转正 SKU 售价与成本卡", route: "/m0/ledger", cta: "看主档 →", badge: "只读" },
  ],
  bi_analyst: [
    { title: "M2 驾驶舱配置与大屏", desc: "设计 4 卡驾驶舱并分析单品盈利", route: "/m2/overview", cta: "进驾驶舱 →", badge: "核心" },
    { title: "M3 竞品舆情监控", desc: "维护竞品报价与差评痛点清单", route: "/m3/competitors", cta: "看竞品 →", badge: "主责" },
    { title: "M3 经营智能问数", desc: "只读查数与多表口径溯源分析", route: "/m3/ask", cta: "去问数 →", badge: "主责" },
    { title: "M5 供应链周度复盘", desc: "归档 PO 履约率与预测误差总结", route: "/m5/review", cta: "写复盘 →", badge: "复盘" },
  ],
  warehouse: [
    { title: "M6 采购收货与预警", desc: "PO 标记发货、分批质检入库", route: "/m6/receiving", cta: "去收货 →", badge: "主责" },
    { title: "M0 分仓库存与盘点", desc: "人工实盘校准可售在手数量", route: "/m0/inventory", cta: "去盘点 →", badge: "主责" },
    { title: "M6 审批中采购追踪", desc: "查看即将下达的补货单与路线", route: "/m6/applies", cta: "看在途 →", badge: "只读" },
    { title: "M5 断货风险测算", desc: "查看各仓未来 90 天库存覆盖", route: "/m5/forecast", cta: "看缺口 →", badge: "参考" },
  ],
  cs: [
    { title: "M1 买家会话与建单", desc: "回复买家咨询并核单建售后工单", route: "/m1/sessions", cta: "接会话 →", badge: "主责" },
    { title: "M1 买家咨询模拟器", desc: "验证 FAQ 知识库回复命中率", route: "/m1/simulator", cta: "去测试 →", badge: "联调" },
    { title: "M1 售后进度查看", desc: "跟踪已提交退款工单审批状态", route: "/m1/aftersales", cta: "查进度 →", badge: "只读" },
    { title: "M0 商品与订单核验", desc: "核对买家订单金额与规格参数", route: "/m0/ledger", cta: "核订单 →", badge: "只读" },
  ],
  mock_buyer: [
    { title: "M1 买家咨询模拟器", desc: "输入买家问题检验自动回复与转人工", route: "/m1/simulator", cta: "开始模拟 →", badge: "专属" },
  ],
};

const roleActionCards = computed(() => ROLE_ACTIONS[ws.currentRole] || ROLE_ACTIONS.manager);

async function load() {
  loading.value = true;
  restrictedSummary.value = false;
  try {
    if (hasPerm("m2:read")) {
      data.value = await platformApi.getHomeWorkbench();
    } else {
      data.value = null;
      restrictedSummary.value = true;
    }
  } catch {
    data.value = null;
    restrictedSummary.value = true;
  } finally {
    loading.value = false;
  }
}

watch(() => ws.currentRole, () => void load());
onMounted(() => void load());
</script>

<template>
  <div>
    <!-- 岗位身份与专属核心操作入口（9 大角色全覆盖，不留空白报错墙） -->
    <div class="card" style="background:linear-gradient(135deg,#ffffff 0%,#f8fbff 100%);border-color:#bfdbfe;">
      <div class="card-title" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:16px;">{{ roleMeta.label }}</span>
          <span class="pill p-blue">{{ roleMeta.badge }}</span>
          <span style="font-size:12.5px;font-weight:400;color:#475569;">{{ roleMeta.focusDesc }}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-sm btn-primary" @click="router.push(roleMeta.homeRoute)">
            进入主工作区 →
          </button>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
      </div>

      <div class="grid-4">
        <div
          v-for="act in roleActionCards"
          :key="act.route"
          style="background:#fff;border:1px solid var(--border);border-radius:9px;padding:11px 12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;"
        >
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
              <strong style="font-size:13.5px;color:#0f172a;">{{ act.title }}</strong>
              <span class="pill p-purple">{{ act.badge }}</span>
            </div>
            <div style="font-size:12px;color:#64748b;line-height:1.4;">{{ act.desc }}</div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" style="width:100%;" @click="router.push(act.route)">
            {{ act.cta }}
          </button>
        </div>
      </div>
    </div>

    <!-- 全局经营指标与待办（拥有 m2:read 权限的管理/审批/运营/BI角色可见） -->
    <template v-if="data">
      <div class="grid-4" style="margin-bottom:14px;">
        <div class="kpi-card">
          <div class="kpi-label">在营与测款 SKU</div>
          <div class="kpi-val">{{ data.kpis.active_skus }}</div>
          <div class="kpi-sub">M0-2 商品主档</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">已连接店铺</div>
          <div class="kpi-val">{{ data.kpis.connected_shops }}</div>
          <div class="kpi-sub">多平台授权</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">台账累计 GMV</div>
          <div class="kpi-val" style="color:#047857;">${{ data.kpis.gmv_usd.toFixed(2) }}</div>
          <div class="kpi-sub">实时订单聚合</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">待处理事项</div>
          <div class="kpi-val" style="color:#b45309;">
            {{ data.kpis.open_alerts + data.kpis.pending_replenish + data.kpis.pending_aftersales }}
          </div>
          <div class="kpi-sub">
            告警 {{ data.kpis.open_alerts }} · 补货 {{ data.kpis.pending_replenish }} · 售后 {{ data.kpis.pending_aftersales }}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>今日必办事项流转</span>
          <span class="pill p-blue">{{ data.todos.length }} 项待协同</span>
        </div>
        <div class="grid-2">
          <div
            v-for="t in data.todos"
            :key="t.id"
            style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:8px;gap:10px;background:#fafcff;"
          >
            <div>
              <div style="font-weight:700;font-size:13.5px;">
                <span class="pill p-purple" style="margin-right:6px;">{{ t.module }}</span>
                {{ t.title }}
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">{{ t.desc }}</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" @click="router.push(t.route)">立即处理 →</button>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="restrictedSummary" class="summary-bar">
      <span class="pill p-amber">RBAC 权限隔离生效</span>
      <span>当前岗位（{{ roleMeta.label }}）专注所属业务域，全局经营 GMV 汇总已按权限自动隐藏。</span>
    </div>
  </div>
</template>
