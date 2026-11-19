<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from '../store'
import { getSkus } from '../api'
import { fmtNum, money, fmtF } from '../format'
import DataBadge from '../components/DataBadge.vue'
import RiskPill from '../components/RiskPill.vue'
import DaysCell from '../components/DaysCell.vue'

const data = ref(null)
const rows = ref([])
const keyword = ref('')
const riskFilter = ref('')
const daysFilter = ref('')
const sortDesc = ref(true)

const filtered = computed(() => {
  const kw = (keyword.value || '').trim().toLowerCase()
  let out = rows.value.filter((r) => {
    if (kw && !(r.sku.toLowerCase().indexOf(kw) >= 0 || (r.title || '').toLowerCase().indexOf(kw) >= 0)) return false
    if (riskFilter.value && r.stock_risk !== riskFilter.value) return false
    if (daysFilter.value) {
      const v = Number(r.days_left)
      if (daysFilter.value === '0-21' && !(v <= 21)) return false
      if (daysFilter.value === '21-45' && !(v > 21 && v <= 45)) return false
      if (daysFilter.value === '45+' && !(v > 45)) return false
    }
    return true
  })
  out = out.slice().sort((a, b) => sortDesc.value ? (Number(b.qty) - Number(a.qty)) : (Number(a.qty) - Number(b.qty)))
  return out
})

function toggleSort() {
  sortDesc.value = !sortDesc.value
}

function qtyNote(r) {
  if (r.stock_risk === 'LOW' && Number(r.qty) > 0 && r.days_left != null) {
    return '（库存可撑 ' + fmtF(r.days_left, 1) + ' 天，按最小起订量 MOQ 备货）'
  }
  return ''
}

async function load() {
  if (!store.currentDid) { data.value = null; rows.value = []; return }
  const d = await getSkus(store.currentDid)
  data.value = d
  rows.value = d ? (d.skus || []) : []
}

onMounted(load)
</script>

<template>
  <section id="page-P2" class="page">
    <h1 class="page-title">补货建议（选品）</h1>

    <div v-if="!data" class="alert alert-missing">
      数据源连不上，页面无法加载业务数据（E-3001）。请确认 FastAPI 已在 8000 端口启动；页面不显示任何兜底数字。
    </div>

    <div class="topbar card" style="margin-bottom:20px;">
      <div class="topbar-left" style="flex-wrap:wrap;gap:10px;">
        <input id="p2Search" v-model="keyword" class="filter-input" type="text" placeholder="搜索 SKU / 标题…" />
        <select id="p2RiskFilter" v-model="riskFilter" class="filter-select">
          <option value="">全部风险</option>
          <option value="STOCKOUT">已断货</option>
          <option value="WATCH">有风险</option>
          <option value="LOW">健康</option>
        </select>
        <select id="p2DaysFilter" v-model="daysFilter" class="filter-select">
          <option value="">全部可撑天数</option>
          <option value="0-21">≤ 21 天</option>
          <option value="21-45">21~45 天</option>
          <option value="45+">&gt; 45 天</option>
        </select>
        <button id="p2Sort" class="btn-plain" @click="toggleSort">
          {{ sortDesc ? '按建议量降序 ↓' : '按建议量升序 ↑' }}
        </button>
      </div>
      <div class="topbar-right" style="display:flex;align-items:center;gap:10px;">
        <DataBadge
          :online="!!data && store.online" :source-type="data ? data.meta.source_type : ''"
          :as-of="data ? data.meta.as_of : ''" badge-id="p2Badge" as-of-id="p2AsOf"
        />
      </div>
    </div>

    <div class="card">
      <div class="tbl-legend">
        <span class="lg lg-red"></span>红 = 已断货（STOCKOUT） ·
        <span class="lg lg-warn"></span>橙 = 有风险（WATCH） ·
        <span class="lg lg-green"></span>绿 = 健康（LOW）
      </div>
      <table class="tbl">
        <thead><tr><th>SKU</th><th>标题</th><th>日均销量</th><th>在手</th><th>在途</th><th>可撑天数</th><th>风险</th><th>建议量</th><th>占用资金</th></tr></thead>
        <tbody id="p2tbody">
          <tr v-for="r in filtered" :key="r.sku">
            <td><b>{{ r.sku }}</b></td>
            <td>{{ r.title || '' }}</td>
            <td class="num">{{ fmtF(r.daily_avg, 2) }}</td>
            <td class="num">{{ fmtNum(r.on_hand) }}</td>
            <td class="num">{{ fmtNum(r.in_transit) }}</td>
            <td><DaysCell :days="r.days_left" /></td>
            <td><RiskPill :risk="r.stock_risk" /></td>
            <td><span class="num">{{ fmtNum(r.qty) }} 件</span> <span v-if="qtyNote(r)" class="muted small">{{ qtyNote(r) }}</span></td>
            <td class="num">{{ r.capital != null ? money(r.capital) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div id="p2Empty" v-if="data && !filtered.length" class="empty-line">— 无匹配 SKU</div>
    </div>
    <div class="small muted" style="margin-top:12px;text-align:right;">本页数据为合成演示数据（SYNTHETIC），非真实经营数据。<!-- E-5001 --></div>
  </section>
</template>
