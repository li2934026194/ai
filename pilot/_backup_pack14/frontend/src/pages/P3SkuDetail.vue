<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { store } from '../store'
import { getSkus, getSkuDetail, ApiError, fetchJSON, getApplies, submitApply, receivePo } from '../api'
import { fmtNum, money, fmtF, fmtPct, methodLabel, sourceLabel, modelVerdict } from '../format'
import DataBadge from '../components/DataBadge.vue'

const detail = ref(null)
const err = ref(null)
const offline = ref(false)
const skuMenu = ref([])
const menuOpen = ref(false)
const salesEl = ref(null)
const inventoryEl = ref(null)
// PACK 11：方案对比面板数据，全部来自 /api/p3/route-plan
const plan = ref(null)
const planErr = ref(false)
let planSeq = 0
let salesChart = null
let inventoryChart = null

// PACK 12：本 SKU 的补货申请历史 + 提交申请 / 收货质检（数据全部来自后端接口）
const applies = ref([])
const appliesErr = ref(false)
const applyBusy = ref(false)
const applyMsg = ref('')
const applyErrMsg = ref('')
const routeCode = ref('sea')
const objectiveMode = ref('profit')
const receivingPoId = ref('')
const recvQty = ref('')
const recvDefect = ref('')

const d = computed(() => detail.value ? detail.value.derivation : null)
const mLabel = computed(() => detail.value ? methodLabel(detail.value.meta.method) : '—')

function riskCls(level) {
  if (level === '高') return 'pill-bad'
  if (level === '中') return 'pill-warn'
  return 'pill-good'
}

// 方案对比面板独立取数：失败只影响本面板，不拖垮 P3 主体（不白屏）。
async function loadPlan() {
  const seq = ++planSeq
  const sku = store.currentSku
  plan.value = null
  planErr.value = false
  if (!store.currentDid) return
  try {
    const p = await fetchJSON(
      '/api/p3/route-plan?dataset_id=' + encodeURIComponent(store.currentDid) +
      '&sku=' + encodeURIComponent(sku)
    )
    if (seq === planSeq && store.currentSku === sku) plan.value = p
  } catch (e) {
    if (seq === planSeq) planErr.value = true
  }
}

async function loadDetail() {
  err.value = null
  detail.value = null
  if (!store.currentDid) { offline.value = true; return }
  loadPlan()
  loadApplies()
  try {
    const body = await getSkuDetail(store.currentDid, store.currentSku)
    if (body) {
      detail.value = body
      offline.value = false
      await nextTick()
      renderCharts()
    } else {
      offline.value = true
    }
  } catch (e) {
    if (e instanceof ApiError) err.value = e
    else offline.value = true
  }
}

function pickSku(sku) {
  store.currentSku = sku
  menuOpen.value = false
  loadDetail()
}

// ---------------------------------------------------------------------------
// PACK 12：提交补货申请 / 查看本 SKU 历史申请 / 收货质检
// 数量一律取自接口返回值（detail.derivation.qty），页面不写死任何业务数字。
// ---------------------------------------------------------------------------
function statusCls(s) {
  if (s === 'approved' || s === 'closed' || s === 'fully_received') return 'pill-good'
  if (s === 'pending_approve' || s === 'created' || s === 'shipping' || s === 'partial_received') return 'pill-warn'
  if (s === 'rejected' || s === 'cancelled') return 'pill-bad'
  return 'pill-gray'
}

function ts(iso) {
  return iso ? String(iso).replace('T', ' ').slice(0, 19) : '—'
}

async function loadApplies() {
  const sku = store.currentSku
  applyErrMsg.value = ''
  if (!store.currentDid) { applies.value = []; return }
  const body = await getApplies(store.currentDid, sku)
  if (store.currentSku !== sku) return
  if (body) {
    applies.value = body.applies || []
    appliesErr.value = false
  } else {
    appliesErr.value = true
    applies.value = []
  }
}

async function submitCurrentApply() {
  if (!detail.value) return
  applyBusy.value = true
  applyMsg.value = ''
  applyErrMsg.value = ''
  try {
    const res = await submitApply({
      dataset_id: store.currentDid,
      sku: store.currentSku,
      qty_propose: Number(detail.value.derivation.qty),
      route_code: routeCode.value,
      objective_mode: objectiveMode.value,
      submit_user: 'demo_submitter',
    })
    applyMsg.value = res.message
    await loadApplies()
  } catch (e) {
    applyErrMsg.value = e instanceof ApiError ? e.code + '：' + e.message : '提交失败：' + e.message
  } finally {
    applyBusy.value = false
  }
}

function startReceive(a) {
  receivingPoId.value = a.purchase_order.po_id
  recvQty.value = ''
  recvDefect.value = ''
  applyMsg.value = ''
  applyErrMsg.value = ''
}

async function confirmReceive(a) {
  applyBusy.value = true
  applyErrMsg.value = ''
  try {
    const res = await receivePo(
      a.purchase_order.po_id, recvQty.value, recvDefect.value || 0, 'demo_receiver'
    )
    applyMsg.value = res.message
    receivingPoId.value = ''
    await loadApplies()
  } catch (e) {
    applyErrMsg.value = e instanceof ApiError ? e.code + '：' + e.message : '收货失败：' + e.message
  } finally {
    applyBusy.value = false
  }
}

// 六步推导链：所有数值取自接口 derivation，公式文案写死。
const steps = computed(() => {
  if (!d.value) return []
  const x = d.value
  return [
    {
      name: 'σ_LT', val: fmtF(x.sigma_lt, 2), formula: 'σ_日 × √L',
      body: '前置交期 L = ' + x.lead_time + ' 天，σ_日 = ' + fmtF(x.sigma_daily, 4) + ' 件。<br>' +
        '<span class="eq-line">σ_LT = σ_日 × √L = ' + fmtF(x.sigma_daily, 4) + ' × √' + x.lead_time + ' ≈ ' + fmtF(x.sigma_lt, 2) + '</span>',
    },
    {
      name: 'SS', val: fmtF(x.ss, 2), formula: 'z × σ_LT',
      body: '安全库存 = z 分数 × 交期内波动。z = ' + fmtF(x.z, 4) + '（由服务水平查表）。<br>' +
        '<span class="eq-line">SS = z × σ_LT = ' + fmtF(x.z, 4) + ' × ' + fmtF(x.sigma_lt, 2) + ' ≈ ' + fmtF(x.ss, 2) + '</span>',
    },
    {
      name: 'ROP', val: fmtF(x.rop, 2), formula: 'μ × L + SS',
      body: '再订货点 = 交期内平均需求 + 安全库存。日均 μ = ' + fmtF(x.mu_daily, 4) + ' 件。<br>' +
        '<span class="eq-line">ROP = μ × L + SS = ' + fmtF(x.mu_daily, 4) + ' × ' + x.lead_time + ' + ' + fmtF(x.ss, 2) + ' ≈ ' + fmtF(x.rop, 2) + '</span>',
    },
    {
      name: '目标', val: fmtF(x.target, 2), formula: 'ROP + μ × R',
      body: '目标库存 = 再订货点 + 补货周期内的需求。补货周期 R = ' + x.review_period + ' 天。<br>' +
        '<span class="eq-line">target = ROP + μ × R = ' + fmtF(x.rop, 2) + ' + ' + fmtF(x.mu_daily, 4) + ' × ' + x.review_period + ' ≈ ' + fmtF(x.target, 2) + '</span>',
    },
    {
      name: 'raw', val: fmtF(x.raw, 2), formula: 'max(0, target − 在手 − 在途)',
      body: '扣除当前在手 ' + fmtNum(x.on_hand) + ' 件、在途 ' + fmtNum(x.in_transit) + ' 件的净缺口。<br>' +
        '<span class="eq-line">raw = max(0, ' + fmtF(x.target, 2) + ' − ' + fmtNum(x.on_hand) + ' − ' + fmtNum(x.in_transit) + ') ≈ ' + fmtF(x.raw, 2) + '</span>',
    },
    {
      name: '建议量', val: fmtNum(x.qty) + ' 件', formula: 'max(raw, MOQ) → 整箱取整',
      body: '先不低于最小起订量，再向上取整到整箱倍数（两步取整）。<br>' +
        '<span class="eq-line">qty = ceil(max(raw, MOQ) / pack_size) × pack_size = ' + fmtNum(x.qty) + ' 件</span>',
    },
  ]
})

function dateLabels(iso) {
  const dt = new Date(iso + 'T00:00:00')
  return String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0')
}

function renderCharts() {
  if (salesChart) { salesChart.dispose(); salesChart = null }
  if (inventoryChart) { inventoryChart.dispose(); inventoryChart = null }
  const series = (detail.value && detail.value.series) || []
  if (!salesEl.value || !inventoryEl.value) return
  if (!series.length) {
    salesEl.value.innerHTML = '<div class="chart-fallback">接口未返回逐日曲线</div>'
    inventoryEl.value.innerHTML = '<div class="chart-fallback">接口未返回逐日曲线</div>'
    return
  }
  const xs = series.map((p) => dateLabels(p.date))
  const qty = series.map((p) => (p.qty == null ? null : p.qty))
  const onHand = series.map((p) => p.on_hand)

  salesChart = echarts.init(salesEl.value, null, { renderer: 'svg' })
  salesChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['销量', '在手库存'], top: 0, right: 0, itemWidth: 14, itemHeight: 8, textStyle: { color: '#6B7280', fontSize: 11 } },
    grid: { left: 46, right: 16, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: xs, boundaryGap: false, axisLabel: { color: '#6B7280', fontSize: 10, interval: Math.floor(xs.length / 10) }, axisLine: { lineStyle: { color: '#E5E7EB' } } },
    yAxis: { type: 'value', name: '件', nameTextStyle: { color: '#6B7280', fontSize: 10 }, axisLabel: { color: '#6B7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#F0F1F3' } } },
    series: [
      { name: '销量', type: 'line', data: qty, showSymbol: false, smooth: true, connectNulls: false, lineStyle: { color: '#1B2A4A', width: 2 }, itemStyle: { color: '#1B2A4A' } },
      { name: '在手库存', type: 'line', data: onHand, showSymbol: false, smooth: true, lineStyle: { color: '#12B886', width: 2 }, itemStyle: { color: '#12B886' } },
    ],
  }, true)

  inventoryChart = echarts.init(inventoryEl.value, null, { renderer: 'svg' })
  inventoryChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 16, top: 22, bottom: 28 },
    xAxis: { type: 'category', data: xs, boundaryGap: false, axisLabel: { color: '#6B7280', fontSize: 10, interval: Math.floor(xs.length / 10) }, axisLine: { lineStyle: { color: '#E5E7EB' } } },
    yAxis: { type: 'value', name: '库存(件)', nameTextStyle: { color: '#6B7280', fontSize: 10 }, axisLabel: { color: '#6B7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#F0F1F3' } } },
    series: [{
      name: '库存', type: 'line', data: onHand, showSymbol: false,
      lineStyle: { color: '#1B2A4A', width: 2 }, itemStyle: { color: '#1B2A4A' }, areaStyle: { color: 'rgba(27,42,74,0.06)' },
      markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#6B7280', type: 'dashed' }, label: { show: false } },
    }],
  }, true)
}

onMounted(async () => {
  if (store.currentDid) {
    const s = await getSkus(store.currentDid)
    skuMenu.value = s ? (s.skus || []) : []
  }
  await loadDetail()
})
watch(() => store.currentDid, async () => {
  if (store.currentDid) {
    const s = await getSkus(store.currentDid)
    skuMenu.value = s ? (s.skus || []) : []
  }
  await loadDetail()
})
onBeforeUnmount(() => {
  if (salesChart) salesChart.dispose()
  if (inventoryChart) inventoryChart.dispose()
})
</script>

<template>
  <section id="page-P3" class="page">
    <h1 class="page-title">SKU 详情</h1>

    <div v-if="offline && !err" class="alert alert-missing">
      数据源连不上，页面无法加载业务数据（E-3001）。请确认 FastAPI 已在 8000 端口启动；页面不显示任何兜底数字。
    </div>

    <div class="topbar card" style="margin-bottom:20px;">
      <div class="topbar-left">
        <button id="p3DatasetBtn" class="dataset-btn" @click="menuOpen = !menuOpen">SKU ▾</button>
        <div id="p3SkuMenu" v-if="menuOpen" class="dataset-menu">
          <div v-for="r in skuMenu" :key="r.sku" @click="pickSku(r.sku)">{{ r.sku }} · {{ r.title || '' }}</div>
          <div v-if="!skuMenu.length" class="muted">— 无 SKU（后端不可达）</div>
        </div>
        <span id="p3SkuName" class="dataset-name">{{ store.currentSku }}</span>
      </div>
      <div class="topbar-right" style="display:flex;align-items:center;gap:10px;">
        <DataBadge
          :online="!!detail && store.online" :source-type="detail ? detail.meta.source_type : ''"
          :as-of="detail ? detail.meta.as_of : ''" badge-id="p3Badge" as-of-id="p3AsOf"
        />
      </div>
    </div>

    <!-- E-1001 / E-1003 整页错误态 -->
    <div v-if="err" class="card" id="p3Error" style="text-align:center;">
      <div style="font-size:15px;font-weight:700;color:var(--primary);margin-bottom:6px;" id="p3ErrorTitle">
        {{ err.code === 'E-1001' ? '数据不足，暂无法预测' : err.code === 'E-1003' ? '没有这个 SKU' : '无法加载' }}
      </div>
      <div class="muted" id="p3ErrorMsg" style="margin-bottom:4px;">{{ err.message }}</div>
      <div v-if="err.code === 'E-1001'" class="small muted" id="p3ErrorHint">该 SKU 的有效历史不足，补齐历史后再试。</div>
    </div>

    <div v-else-if="detail" id="p3Body">
      <div class="alert" id="p3MethodBar" style="background:#EFF6FF;border:1px solid #BFD6F0;color:#1E5A8A;margin-top:0;">
        口径：<b>{{ mLabel }}</b> · 各模型外推结果与历史记录对比得到 WAPE / Bias / MAE。
      </div>

      <div v-if="detail.warning" class="alert alert-warn" id="p3Warning">{{ detail.warning.message }}</div>

      <div class="stack">
        <div class="card">
          <h3 class="card-title" id="p3ChartSalesTitle">销量历史与库存</h3>
          <div id="chart-sales" ref="salesEl" class="chart-lg"></div>
          <div class="small muted" style="text-align:center;">灰阴影 = 断货期（qty 为 None）</div>
        </div>
        <div class="card">
          <h3 class="card-title">库存曲线</h3>
          <div id="chart-inventory" ref="inventoryEl" class="chart"></div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <h3 class="card-title" id="p3ModelTitle">模型对比（{{ mLabel }}）</h3>
          <table class="tbl">
            <thead><tr><th>模型</th><th>WAPE</th><th>Bias</th><th>MAE</th><th>结论</th></tr></thead>
            <tbody id="p3ModelBody">
              <tr v-if="!Object.keys(detail.per_model || {}).length"><td colspan="5" class="muted">无回测数据</td></tr>
              <tr v-for="(m, name) in detail.per_model" :key="name">
                <td><b>{{ name }}</b></td>
                <td class="num">{{ fmtPct(m.wape) }}</td>
                <td class="num">{{ fmtPct(m.bias) }}</td>
                <td class="num">{{ fmtF(m.mae, 2) }}</td>
                <td>
                  <span class="pill" :class="modelVerdict(name, detail.best_model, m).cls">{{ modelVerdict(name, detail.best_model, m).text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3 class="card-title">补货结论</h3>
          <div class="conclusion">
            <div class="big" id="p3ConclusionBig">
              {{ Number(d.qty) === 0 ? '本轮无需补货' : fmtNum(d.qty) + ' 件' + (detail.capital != null ? ' · ' + money(detail.capital) : '') }}
            </div>
            <div class="row"><span class="muted">服务水平</span><b id="p3ServiceLevel">{{ fmtPct(detail.service_level) }}</b></div>
            <div class="row"><span class="muted">服务水平来源</span><b id="p3ServiceSource">{{ sourceLabel(detail.service_level_source) }}</b></div>
            <div class="row"><span class="muted">占用资金</span><b id="p3Capital">
              {{ detail.capital == null && Number(d.qty) > 0 ? '缺成本，无法计算' : detail.capital != null ? money(detail.capital) : '—' }}
            </b></div>
          </div>
          <div v-if="detail.capital == null && Number(d.qty) > 0" class="small muted" id="p3CostNote" style="margin-top:8px;">
            缺单件成本，金额不可算，服务水平按默认值。
          </div>

          <!-- PACK 12：提交补货申请（数量取自接口推导链，路线/目标取自 /api/p3/route-plan 的合成参数） -->
          <div style="margin-top:14px;border-top:1px dashed #E5E7EB;padding-top:12px;" id="p3ApplyActions">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <select v-if="plan" id="p3RouteCode" v-model="routeCode" class="filter-select">
                <option v-for="r in plan.routes" :key="r.code" :value="r.code">{{ r.name }}</option>
              </select>
              <select v-if="plan" id="p3ObjectiveMode" v-model="objectiveMode" class="filter-select">
                <option v-for="o in plan.objectives" :key="o.code" :value="o.code">{{ o.name }}</option>
              </select>
              <button
                id="p3SubmitApply" class="btn-primary" :disabled="applyBusy || Number(d.qty) <= 0"
                @click="submitCurrentApply"
              >提交补货申请（{{ fmtNum(d.qty) }} 件）</button>
            </div>
            <div class="small muted" style="margin-top:6px;">
              提交后进入待审批；通过后自动生成采购单。路线与目标为合成假设参数，非真实物流报价。
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="detail" class="card section-gap">
      <details open>
        <summary>▾ 推导链（每一项可展开看公式）</summary>
        <div id="deriveBox" class="derive">
          <template v-for="(s, i) in steps" :key="s.name">
            <details class="derive-step" :open="i === steps.length - 1">
              <summary>
                <span class="step-name">{{ s.name }}</span>
                <span class="step-val">{{ s.val }}</span>
                <span class="step-formula">{{ s.formula }}</span>
              </summary>
              <div class="step-body" v-html="s.body"></div>
            </details>
            <div v-if="i < steps.length - 1" class="derive-arrow">↓</div>
          </template>
        </div>
      </details>
    </div>

    <!-- PACK 11：多路线方案对比（海运/空运/铁运/卡航），数字全部来自 /api/p3/route-plan -->
    <div v-if="plan && detail" class="card section-gap" id="routePlanPanel">
      <h3 class="card-title">多路线方案对比（合成假设参数）</h3>
      <div class="alert alert-warn" id="routeAssumption" style="margin-top:0;">{{ plan.assumption_note }}</div>
      <div class="small muted" id="routeBaseLine" style="margin-bottom:12px;">
        基础：可撑 {{ fmtF(plan.base.cover_days, 2) }} 天（在手 {{ fmtNum(plan.base.on_hand) }} + 在途 {{ fmtNum(plan.base.in_transit) }} ÷ 日均 {{ fmtF(plan.base.mu_daily, 2) }}） · 基础建议量 {{ fmtNum(plan.base.base_qty) }} 件
      </div>
      <table class="tbl">
        <thead><tr><th>路线</th><th>时效(天，含起运清关)</th><th>单件运费</th><th>最小起运量</th><th>可靠性</th><th>总运费</th><th>到货时剩余可撑</th><th>缺货风险</th><th>建议</th></tr></thead>
        <tbody id="routeTbody">
          <tr v-for="r in plan.routes" :key="r.code" :data-code="r.code">
            <td><b>{{ r.name }}</b></td>
            <td class="num">{{ r.transit_days }}</td>
            <td class="num">¥{{ r.unit_freight }}</td>
            <td class="num">{{ fmtNum(r.min_qty) }}</td>
            <td class="num">{{ fmtPct(r.reliability) }}</td>
            <td class="num">{{ money(r.total_freight) }}</td>
            <td class="num">{{ fmtF(r.arrival_remaining_days, 1) }} 天</td>
            <td><span class="pill" :class="riskCls(r.risk_level)">{{ r.risk_level }} · {{ fmtF(r.risk_index, 2) }}</span></td>
            <td class="muted small">{{ r.recommendation }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="planErr && detail" class="alert alert-missing" id="routePlanError">
      方案对比数据暂不可用（/api/p3/route-plan 未返回），本页其余数据正常；页面不显示任何兜底数字。
    </div>

    <!-- PACK 11：三目标决策（保销量 / 保利润 / 保现金），数字全部来自 /api/p3/route-plan -->
    <div v-if="plan && detail" class="card section-gap" id="objectivePanel">
      <h3 class="card-title">三目标决策 · 一键对比</h3>
      <div class="small muted" style="margin-bottom:12px;">三种方案用不同的服务水平与覆盖周期参数实时重算推导链，差异来自参数而非写死结果。</div>
      <table class="tbl">
        <thead><tr><th>方案</th><th>服务水平</th><th>覆盖周期系数</th><th>建议量</th><th>资金占用</th><th>差异来自哪个参数</th></tr></thead>
        <tbody id="objectiveTbody">
          <tr v-for="o in plan.objectives" :key="o.code" :data-code="o.code">
            <td><b>{{ o.name }}</b></td>
            <td class="num">{{ fmtPct(o.service_level) }}</td>
            <td class="num">×{{ o.review_factor }}</td>
            <td class="num"><b>{{ fmtNum(o.qty) }} 件</b></td>
            <td class="num">{{ o.capital != null ? money(o.capital) : '—' }}</td>
            <td class="muted small">{{ o.difference_from }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PACK 12：本 SKU 历史补货申请（数据来自 /api/p3/applies?sku=，状态由后端下发） -->
    <div v-if="detail" class="card section-gap" id="p3ApplyCard">
      <h3 class="card-title">本 SKU 补货申请记录</h3>
      <div class="small muted" style="margin-bottom:12px;">
        提交 → 待审批 → 通过/驳回 → 生成采购单 → 部分收货 / 完全收货，全链路留痕
      </div>
      <div v-if="applyErrMsg" class="alert alert-missing" id="p3ApplyActionErr">{{ applyErrMsg }}</div>
      <div v-if="applyMsg" class="alert" id="p3ApplyActionMsg" style="background:#EFF6FF;border:1px solid #BFD6F0;color:#1E5A8A;">{{ applyMsg }}</div>
      <div v-if="appliesErr" class="alert alert-missing" id="p3ApplyOffline">
        申请记录暂不可用（/api/p3/applies 未返回），本页其余数据正常；页面不显示任何兜底数字。
      </div>
      <table class="tbl">
        <thead><tr><th>申请号</th><th>申请数量</th><th>占用资金</th><th>路线 / 目标</th><th>状态</th><th>提交人 / 时间</th><th>审批人 / 时间</th><th>采购单履约</th><th>操作</th></tr></thead>
        <tbody id="p3ApplyBody">
          <tr v-for="a in applies" :key="a.apply_id" :data-apply="a.apply_id">
            <td class="small">{{ a.apply_id }}</td>
            <td class="num">{{ fmtNum(a.qty_propose) }} 件</td>
            <td class="num">{{ a.capital != null ? money(a.capital) : '—' }}</td>
            <td class="small muted">{{ a.route_code }} / {{ a.objective_mode }}</td>
            <td><span class="pill" :class="statusCls(a.status)" :data-status="a.status">{{ a.status_label }}</span></td>
            <td class="small">{{ a.submit_user }}<br><span class="muted">{{ ts(a.submit_at) }}</span></td>
            <td class="small">
              {{ a.approve_user || '—' }}<br><span class="muted">{{ ts(a.approve_at) }}</span>
              <div v-if="a.reject_reason" class="muted" style="margin-top:2px;">理由：{{ a.reject_reason }}</div>
            </td>
            <td class="small">
              <template v-if="a.purchase_order">
                {{ a.purchase_order.po_id }}<br>
                <span class="pill" :class="statusCls(a.purchase_order.status)">{{ a.purchase_order.status_label }}</span><br>
                实收 {{ fmtNum(a.purchase_order.receive_qty) }}/{{ fmtNum(a.purchase_order.order_qty) }} · 不良 {{ fmtNum(a.purchase_order.defect_qty) }}<br>
                <span class="muted">预计 {{ a.purchase_order.expect_arrive || '—' }}</span>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <template v-if="a.purchase_order && ['created', 'shipping', 'partial_received'].indexOf(a.purchase_order.status) >= 0">
                <button class="btn-plain p3Receive" :data-po="a.purchase_order.po_id" :disabled="applyBusy" @click="startReceive(a)" style="padding:5px 10px;font-size:12px;">收货质检</button>
                <div v-if="receivingPoId === a.purchase_order.po_id" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                  <input class="filter-input p3RecvQty" v-model="recvQty" type="number" min="1" placeholder="实收数量" style="width:100px;" />
                  <input class="filter-input p3RecvDefect" v-model="recvDefect" type="number" min="0" placeholder="不良品" style="width:90px;" />
                  <button class="btn-primary p3RecvConfirm" :disabled="applyBusy" @click="confirmReceive(a)" style="padding:5px 8px;font-size:12px;">确认入库</button>
                </div>
              </template>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div id="p3ApplyEmpty" v-if="!applies.length && !appliesErr" class="empty-line">— 该 SKU 还没有补货申请</div>
    </div>

    <div class="small muted" style="margin-top:12px;text-align:right;">本页数据为合成演示数据（SYNTHETIC），非真实经营数据。<!-- E-5001 --></div>
  </section>
</template>
