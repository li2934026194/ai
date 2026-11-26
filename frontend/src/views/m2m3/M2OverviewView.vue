<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { usePermission } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const { canDesignCockpit } = usePermission();

const data = ref<any>(null);
const shops = ref<any[]>([]);
const includeMock = ref(false);
const shopId = ref("");
const errMsg = ref("");

// 智能驾驶舱草稿设计器状态
const showDesigner = ref(false);
const layoutVersion = ref(1);
const draftCards = ref<Array<{ card_id: string; title: string; metric_key: string }>>([
  { card_id: "c1", title: "实盘 GMV", metric_key: "gmv_usd" },
  { card_id: "c2", title: "预估净利", metric_key: "net_profit_usd" },
  { card_id: "c3", title: "7日广告费", metric_key: "ad_spend_7d_usd" },
  { card_id: "c4", title: "待处理告警", metric_key: "open_alerts_count" },
]);
const publishedCards = ref<any[] | null>(null);
const liveCards = ref<Array<{ card_id: string; title: string; metric_key: string; value: number }>>([]);
const designerMsg = ref("");

const METRIC_OPTIONS = [
  { key: "gmv_usd", label: "实盘 GMV (USD)" },
  { key: "net_profit_usd", label: "预估净利润 (USD)" },
  { key: "ad_spend_7d_usd", label: "7日广告花费 (USD)" },
  { key: "open_alerts_count", label: "未处理告警数 (条)" },
];

const trendSvg = computed(() => {
  const rows = data.value?.trend_30d || [];
  if (!rows.length) return { pts: "", maxRev: 1 };
  const maxRev = Math.max(1, ...rows.map((r: any) => Number(r.revenue_usd || 0)));
  const w = 640;
  const h = 100;
  const step = rows.length > 1 ? w / (rows.length - 1) : w;
  const pts = rows
    .map((r: any, i: number) => `${(i * step).toFixed(1)},${(h - (Number(r.revenue_usd || 0) / maxRev) * 80 - 10).toFixed(1)}`)
    .join(" ");
  return { pts, maxRev };
});

const maxSkuProfit = computed(() => {
  const list = data.value?.sku_profits || [];
  return Math.max(1, ...list.map((s: any) => Math.abs(Number(s.net_profit_usd || 0))));
});

function formatCardVal(metricKey: string, val: number): string {
  if (metricKey === "open_alerts_count") return `${val} 条`;
  return `$${Number(val || 0).toFixed(2)}`;
}

async function loadDesigner() {
  try {
    const [lay, cardsResp] = await Promise.all([
      platformApi.getDesignerLayout(),
      platformApi.getDesignerCards(),
    ]);
    layoutVersion.value = lay.version || 1;
    if (lay.draft_layout?.length) draftCards.value = JSON.parse(JSON.stringify(lay.draft_layout));
    publishedCards.value = lay.published_layout;
    liveCards.value = cardsResp.cards || [];
  } catch {
    // fallback silently if mocked
  }
}

async function saveDraft() {
  designerMsg.value = "";
  errMsg.value = "";
  try {
    const res = await platformApi.saveDesignerLayout(draftCards.value, layoutVersion.value);
    layoutVersion.value = res.version;
    ws.showToast(`驾驶舱草稿已保存（v${res.version}，尚未发布到正式大屏）`);
    await loadDesigner();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function publishDraft() {
  designerMsg.value = "";
  errMsg.value = "";
  try {
    const res = await platformApi.publishDesignerLayout();
    layoutVersion.value = res.version;
    ws.showToast(`驾驶舱布局已正式发布（v${res.version}）！`);
    await loadDesigner();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function moveCard(idx: number, dir: -1 | 1) {
  const next = idx + dir;
  if (next < 0 || next >= draftCards.value.length) return;
  const arr = [...draftCards.value];
  const [item] = arr.splice(idx, 1);
  arr.splice(next, 0, item);
  draftCards.value = arr;
}

function addCard() {
  if (draftCards.value.length >= 4) return;
  draftCards.value.push({
    card_id: `c${Date.now().toString().slice(-4)}`,
    title: "新增指标卡",
    metric_key: "gmv_usd",
  });
}

function removeCard(idx: number) {
  if (draftCards.value.length <= 1) return;
  draftCards.value.splice(idx, 1);
}

async function load() {
  errMsg.value = "";
  try {
    if (!shops.value.length) {
      try {
        shops.value = (await platformApi.listShops()).items;
      } catch {
        // non-shop role fallback
      }
    }
    data.value = await platformApi.getM2Overview({
      include_mock: includeMock.value,
      shop_id: shopId.value || undefined,
    });
    await loadDesigner();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <!-- 顶部口径控制 + 驾驶舱草稿设置开关 -->
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title" style="margin-bottom:0;">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <span>经营总览</span>
          <select v-model="shopId" class="select" style="width:200px;" @change="load">
            <option value="">全部授权店铺</option>
            <option v-for="s in shops" :key="s.shop_id" :value="s.shop_id">
              {{ s.name || s.shop_name }} ({{ s.platform }})
            </option>
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:400;">
            <input v-model="includeMock" type="checkbox" @change="load" />
            含模拟订单 ({{ data?.summary?.mock_excluded_count ?? 0 }} 已过滤)
          </label>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button
            type="button"
            class="btn btn-sm"
            :class="showDesigner ? 'btn-primary' : ''"
            @click="showDesigner = !showDesigner"
          >
            🎨 驾驶舱草稿设置 (v{{ layoutVersion }})
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m3/ask')">
            💬 智能问数 →
          </button>
        </div>
      </div>
    </div>

    <!-- 智能驾驶舱 4 卡草稿配置器（恢复并升级） -->
    <div v-if="showDesigner" class="card" style="border-color:#93c5fd;background:#f8fbff;">
      <div class="card-title">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>智能驾驶舱 4 卡草稿设计器（4 路并发独立查询 · 乐观锁 v{{ layoutVersion }}）</span>
          <span class="pill" :class="publishedCards ? 'p-green' : 'p-amber'">
            {{ publishedCards ? `已发布 ${publishedCards.length} 卡` : "草稿未发布" }}
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button v-if="draftCards.length < 4" type="button" class="btn btn-sm" :disabled="!canDesignCockpit" @click="addCard">
            + 加卡片
          </button>
          <button type="button" class="btn btn-sm" @click="loadDesigner">并发刷新 4 卡</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="!canDesignCockpit" @click="saveDraft">
            💾 保存草稿
          </button>
          <button type="button" class="btn btn-sm btn-success" :disabled="!canDesignCockpit" @click="publishDraft">
            🚀 正式发布到大屏
          </button>
        </div>
      </div>

      <div v-if="!canDesignCockpit" class="summary-bar" style="background:#fffbeb;border-color:#fde68a;color:#92400e;">
        当前岗位仅支持只读预览驾驶舱；切换至「驾驶舱设计者 (planner)」或「BI 人员 (bi_analyst)」可编辑草稿并发布。
      </div>

      <div class="grid-4" style="margin-bottom:10px;">
        <div
          v-for="(card, idx) in draftCards"
          :key="card.card_id"
          style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:10px;"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="pill p-blue">卡 #{{ idx + 1 }}</span>
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn btn-sm" style="height:22px;padding:0 6px;" :disabled="!canDesignCockpit || idx === 0" @click="moveCard(idx, -1)">←</button>
              <button type="button" class="btn btn-sm" style="height:22px;padding:0 6px;" :disabled="!canDesignCockpit || idx === draftCards.length - 1" @click="moveCard(idx, 1)">→</button>
              <button v-if="draftCards.length > 1" type="button" class="btn btn-sm btn-danger" style="height:22px;padding:0 6px;" :disabled="!canDesignCockpit" @click="removeCard(idx)">×</button>
            </div>
          </div>
          <label class="field-label">卡片标题</label>
          <input v-model="card.title" class="input" style="margin-bottom:6px;" :disabled="!canDesignCockpit" />
          <label class="field-label">绑定指标</label>
          <select v-model="card.metric_key" class="select" :disabled="!canDesignCockpit">
            <option v-for="m in METRIC_OPTIONS" :key="m.key" :value="m.key">{{ m.label }}</option>
          </select>
        </div>
      </div>

      <div v-if="liveCards.length" class="grid-4">
        <div v-for="lc in liveCards" :key="lc.card_id" class="kpi-card" style="border-color:#bfdbfe;">
          <div class="kpi-label">{{ lc.title }}（实时并发预览）</div>
          <div class="kpi-val" style="color:#1d4ed8;">{{ formatCardVal(lc.metric_key, lc.value) }}</div>
        </div>
      </div>
    </div>

    <template v-if="data">
      <!-- 已发布自定义驾驶舱卡片（若已正式发布，优先展示定制顺序与标题） -->
      <div v-if="publishedCards?.length && liveCards.length" style="margin-bottom:14px;">
        <div style="font-size:12px;color:#475569;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <span><strong>已发布驾驶舱看板</strong>（v{{ layoutVersion }} · 按定制顺序 4 路并发加载）</span>
          <span class="pill p-green">已正式发布</span>
        </div>
        <div class="grid-4">
          <div v-for="lc in liveCards" :key="lc.card_id" class="kpi-card" style="border-color:#a7f3d0;background:#f0fdf4;">
            <div class="kpi-label">{{ lc.title }}</div>
            <div class="kpi-val" style="color:#047857;">{{ formatCardVal(lc.metric_key, lc.value) }}</div>
            <div class="kpi-sub">指标：{{ lc.metric_key }}</div>
          </div>
        </div>
      </div>

      <!-- 正式驾驶舱核心经营 KPI -->
      <div class="grid-4" style="margin-bottom:14px;">
        <div class="kpi-card">
          <div class="kpi-label">{{ includeMock ? "全口径 GMV" : "实盘 GMV" }}</div>
          <div class="kpi-val">${{ data.summary.total_gmv_usd.toFixed(2) }}</div>
          <div class="kpi-sub">{{ data.summary.live_order_count }} 笔 M0 订单</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">预估净利润</div>
          <div class="kpi-val" style="color:#047857;">${{ data.summary.net_profit_usd.toFixed(2) }}</div>
          <div class="kpi-sub">净利率 {{ data.summary.margin_pct }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">7日广告 / 已批退款</div>
          <div class="kpi-val" style="color:#b45309;">${{ data.summary.ad_spend_7d_usd }} / ${{ data.summary.approved_refund_usd }}</div>
          <div class="kpi-sub">已从毛利自动扣除</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">采购在途承诺资金</div>
          <div class="kpi-val">¥{{ data.summary.po_commitment_rmb.toFixed(0) }}</div>
          <div class="kpi-sub">未取消 PO 占用</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px;">
        <div class="card-title">
          <span>近 30 日销售额走势</span>
          <span style="font-size:12px;color:#64748b;">日峰值：${{ trendSvg.maxRev.toFixed(2) }}</span>
        </div>
        <svg viewBox="0 0 640 110" style="width:100%;height:105px;display:block;background:#fafcff;border-radius:6px;">
          <polyline fill="none" stroke="#047857" stroke-width="2.2" :points="trendSvg.pts" />
        </svg>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span>单 SKU 盈利贡献拆解</span>
            <span class="pill p-green">{{ data.sku_profits.length }} 款</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>SKU / 品名</th>
                <th>销量</th>
                <th>GMV</th>
                <th>净利贡献</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in data.sku_profits" :key="s.sku">
                <td>
                  <code>{{ s.sku }}</code>
                  <div class="table-sub">{{ s.name }}</div>
                </td>
                <td class="tnum">{{ s.units }}</td>
                <td class="tnum">${{ s.gmv_usd }}</td>
                <td class="tnum" style="min-width:110px;">
                  <div style="font-weight:700;color:#047857;">${{ s.net_profit_usd }}</div>
                  <div class="mini-track">
                    <div
                      class="mini-fill"
                      style="background:#10b981;"
                      :style="{ width: Math.min(100, Math.max(8, (Number(s.net_profit_usd) / maxSkuProfit) * 100)) + '%' }"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-title">
            <span>多渠道财务结算对账</span>
            <span class="pill p-blue">{{ data.settlements.length }} 个账期</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>账期</th>
                <th>渠道</th>
                <th>毛收入</th>
                <th>净结算</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="st in data.settlements" :key="st.channel">
                <td>{{ st.period }}</td>
                <td>{{ st.channel }}</td>
                <td class="tnum">${{ st.gross_usd }}</td>
                <td class="tnum" style="font-weight:700;">${{ st.net_payout_usd }}</td>
                <td><span class="pill" :class="st.status === 'SETTLED' ? 'p-green' : 'p-amber'">{{ st.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
