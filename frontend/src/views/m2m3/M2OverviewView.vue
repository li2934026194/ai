<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";

const router = useRouter();
const data = ref<any>(null);
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    data.value = await platformApi.getM2Overview();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <template v-if="data">
      <div class="grid-4" style="margin-bottom:14px;">
        <div class="kpi-card">
          <div class="kpi-label">实盘 GMV 汇总</div>
          <div class="kpi-val">${{ data.summary.total_gmv_usd.toFixed(2) }}</div>
          <div class="kpi-sub">聚合 M0 实盘订单台账</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">预估净利润</div>
          <div class="kpi-val" style="color:#047857;">${{ data.summary.net_profit_usd.toFixed(2) }}</div>
          <div class="kpi-sub">毛利率 {{ data.summary.margin_pct }}% (已扣广告/退款)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">7日广告花费 / 已批退款</div>
          <div class="kpi-val" style="color:#b45309;">${{ data.summary.ad_spend_7d_usd }} / ${{ data.summary.approved_refund_usd }}</div>
          <div class="kpi-sub">联动 M2-4 广告与 M1-3 售后</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">采购单承诺资金</div>
          <div class="kpi-val">¥{{ data.summary.po_commitment_rmb.toFixed(0) }}</div>
          <div class="kpi-sub">
            <button type="button" class="btn btn-sm" style="margin-top:2px;" @click="router.push('/m3/ask')">追问智能助手 →</button>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">单 SKU 盈利拆解（M2-2）</div>
          <table class="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>销量</th>
                <th>GMV</th>
                <th>COGS + 佣金</th>
                <th>净利</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in data.sku_profits" :key="s.sku">
                <td><code>{{ s.sku }}</code><div style="font-size:11px;color:#64748b;">{{ s.name }}</div></td>
                <td class="tnum">{{ s.units }}</td>
                <td class="tnum">${{ s.gmv_usd }}</td>
                <td class="tnum">${{ (s.cogs_usd + s.platform_fee_usd).toFixed(2) }}</td>
                <td class="tnum" style="font-weight:700;color:#047857;">${{ s.net_profit_usd }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-title">多渠道财务结算周期对账（M2-3）</div>
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
