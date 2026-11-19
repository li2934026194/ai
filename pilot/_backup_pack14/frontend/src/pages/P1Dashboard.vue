<script setup>
import { ref, onMounted } from 'vue'
import { store, currentDatasetName } from '../store'
import { getDashboard, getSkus } from '../api'
import { fmtNum, money, fmtF } from '../format'
import DataBadge from '../components/DataBadge.vue'
import RiskPill from '../components/RiskPill.vue'
import DaysCell from '../components/DaysCell.vue'

const dash = ref(null)
const rows = ref([])
const meta = ref({ source_type: '', as_of: '' })
const menuOpen = ref(false)

async function load() {
  if (!store.currentDid) { dash.value = null; rows.value = []; return }
  const [d, s] = await Promise.all([getDashboard(store.currentDid), getSkus(store.currentDid)])
  dash.value = d
  rows.value = s ? (s.skus || []) : []
  if (d) meta.value = d.meta
  else if (s) meta.value = s.meta
}

function pickDataset(id) {
  store.currentDid = id
  menuOpen.value = false
  load()
}

// LOW 但 qty>0（MOQ 触发）时单独注明，不用风险标签掩盖 MOQ 效果。
function qtyNote(r) {
  if (r.stock_risk === 'LOW' && Number(r.qty) > 0 && r.days_left != null) {
    return '（库存可撑 ' + fmtF(r.days_left, 1) + ' 天，按最小起订量 MOQ 备货）'
  }
  return ''
}

onMounted(load)
</script>

<template>
  <section id="page-P1" class="page active">
    <h1 class="page-title">今日驾驶舱</h1>

    <div v-if="!dash" class="alert alert-missing">
      数据源连不上，页面无法加载业务数据（E-3001）。请确认 FastAPI 已在 8000 端口启动；页面不显示任何兜底数字。
    </div>

    <div class="topbar card">
      <div class="topbar-left">
        <button id="datasetBtn" class="dataset-btn" @click="menuOpen = !menuOpen">数据集 ▾</button>
        <div id="datasetMenu" v-if="menuOpen" class="dataset-menu">
          <div v-for="d in store.datasets" :key="d.id" @click="pickDataset(d.id)">{{ d.name }}</div>
          <div v-if="!store.datasets.length" class="muted">— 无数据集（后端不可达）</div>
        </div>
        <span id="dsName" class="dataset-name">{{ currentDatasetName() }}</span>
      </div>
      <div class="topbar-right" style="display:flex;align-items:center;gap:10px;">
        <DataBadge
          :online="!!dash && store.online" :source-type="meta.source_type" :as-of="meta.as_of"
          badge-id="dsBadge" as-of-id="dsAsOf"
        />
      </div>
    </div>

    <div class="grid-4 section-gap">
      <div class="card kpi">
        <div class="label">待补货 SKU 数</div>
        <div id="kpiPending" class="value">{{ dash ? fmtNum(dash.kpi.pending_sku_count) : '—' }}</div>
        <div class="foot">建议量 &gt; 0 的 SKU</div>
      </div>
      <div class="card kpi">
        <div class="label">断货风险 SKU 数</div>
        <div id="kpiStockout" class="value">{{ dash ? fmtNum(dash.kpi.stockout_risk_count) : '—' }}</div>
        <div class="foot">当前在手 = 0 的 SKU</div>
      </div>
      <div class="card kpi">
        <div class="label">建议占用资金合计</div>
        <div id="kpiCapital" class="value">{{ dash ? money(dash.kpi.total_capital) : '—' }}</div>
        <div class="foot">缺成本 SKU 不计入</div>
      </div>
      <div class="card kpi">
        <div class="label">七 Agent 今日运行次数</div>
        <div id="kpiAgentRuns" class="value">{{ dash ? fmtNum(dash.kpi.agent_runs_today) : '—' }}</div>
        <div class="foot">来自 agent_runs 表</div>
      </div>
    </div>

    <div class="card section-gap">
      <h3 class="card-title">SKU 补货清单</h3>
      <div class="tbl-legend">
        <span class="lg lg-red"></span>红 = 已断货（STOCKOUT / 交期内将断货） ·
        <span class="lg lg-warn"></span>橙 = 接近交期（WATCH） ·
        <span class="lg lg-green"></span>绿 = 安全（LOW）
      </div>
      <table class="tbl">
        <thead><tr><th>SKU</th><th>标题</th><th>日均销量</th><th>在手</th><th>在途</th><th>可撑天数</th><th>风险</th><th>建议量</th></tr></thead>
        <tbody id="p1tbody">
          <tr v-for="r in rows" :key="r.sku">
            <td><b>{{ r.sku }}</b></td>
            <td>{{ r.title || '' }}</td>
            <td class="num">{{ fmtF(r.daily_avg, 2) }}</td>
            <td class="num">{{ fmtNum(r.on_hand) }}</td>
            <td class="num">{{ fmtNum(r.in_transit) }}</td>
            <td><DaysCell :days="r.days_left" /></td>
            <td><RiskPill :risk="r.stock_risk" /></td>
            <td><span class="num">{{ fmtNum(r.qty) }} 件</span> <span v-if="qtyNote(r)" class="muted small">{{ qtyNote(r) }}</span></td>
          </tr>
        </tbody>
      </table>
      <div id="p1Empty" v-if="dash && !rows.length" class="empty-line">— 暂无数据</div>
    </div>
    <div class="small muted" style="margin-top:12px;text-align:right;">本页数据为合成演示数据（SYNTHETIC），非真实经营数据。<!-- E-5001 --></div>
  </section>
</template>
