<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from '../store'
import { getSkus, getApplies, approveApply, rejectApply, submitApply, cancelPo, ApiError } from '../api'
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

// PACK 12：补货申请列表 + 审批操作（数据全部来自 /api/p3/applies，状态由后端下发）
const applies = ref([])
const appliesErr = ref(false)
const busyId = ref('')
const actionMsg = ref('')
const actionErr = ref('')
const rejectingId = ref('')
const rejectReason = ref('')
// PACK 21：采购单取消入口（P2 页也能操作，不必跳到 P3）
const cancelingPoId = ref('')
const cancelReason = ref('')
const CANCELLABLE_PO = ['created', 'shipping', 'partial_received']

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

// 状态 → 颜色：只做展示映射，不参与任何业务判断
function statusCls(s) {
  if (s === 'approved' || s === 'closed' || s === 'fully_received') return 'pill-good'
  if (s === 'pending_approve' || s === 'partial_received' || s === 'created' || s === 'shipping') return 'pill-warn'
  if (s === 'rejected' || s === 'cancelled') return 'pill-bad'
  return 'pill-gray'
}

function ts(iso) {
  return iso ? String(iso).replace('T', ' ').slice(0, 19) : '—'
}

function toggleSort() {
  sortDesc.value = !sortDesc.value
}

function qtyNote(r) {
  if (r.stock_risk === 'LOW' && Number(r.qty) > 0 && r.days_left != null) {
    return '（库存可撑 ' + fmtF(r.days_left, 1) + ' 天，按最小起订量 MOQ 备货）'
  }
  return ''
}

async function loadApplies() {
  actionErr.value = ''
  if (!store.currentDid) { applies.value = []; appliesErr.value = false; return }
  const body = await getApplies(store.currentDid)
  if (body) {
    applies.value = body.applies || []
    appliesErr.value = false
  } else {
    appliesErr.value = true
    applies.value = []
  }
}

async function load() {
  if (!store.currentDid) { data.value = null; rows.value = []; applies.value = []; return }
  const d = await getSkus(store.currentDid)
  data.value = d
  rows.value = d ? (d.skus || []) : []
  await loadApplies()
}

// 一键为某个 SKU 提交申请（数量留空 → 后端按实时建议量计算，页面不写死任何数字）
async function quickSubmit(r) {
  busyId.value = r.sku
  actionMsg.value = ''
  actionErr.value = ''
  try {
    const res = await submitApply({
      dataset_id: store.currentDid,
      sku: r.sku,
      qty_propose: null,
      route_code: 'sea',
      objective_mode: 'profit',
      submit_user: 'demo_submitter',
    })
    actionMsg.value = res.message
    await loadApplies()
  } catch (e) {
    actionErr.value = e instanceof ApiError ? e.code + '：' + e.message : '提交失败：' + e.message
  } finally {
    busyId.value = ''
  }
}

async function doApprove(a) {
  busyId.value = a.apply_id
  actionMsg.value = ''
  actionErr.value = ''
  try {
    const res = await approveApply(a.apply_id, 'demo_approver')
    actionMsg.value = res.message
    await loadApplies()
  } catch (e) {
    actionErr.value = e instanceof ApiError ? e.code + '：' + e.message : '审批失败：' + e.message
  } finally {
    busyId.value = ''
  }
}

function startReject(a) {
  rejectingId.value = a.apply_id
  rejectReason.value = ''
  actionMsg.value = ''
  actionErr.value = ''
}

async function confirmReject(a) {
  busyId.value = a.apply_id
  try {
    const res = await rejectApply(a.apply_id, 'demo_approver', rejectReason.value)
    actionMsg.value = res.message
    rejectingId.value = ''
    rejectReason.value = ''
    await loadApplies()
  } catch (e) {
    actionErr.value = e instanceof ApiError ? e.code + '：' + e.message : '驳回失败：' + e.message
  } finally {
    busyId.value = ''
  }
}

function startCancelPo(a) {
  cancelingPoId.value = a.purchase_order.po_id
  cancelReason.value = ''
  actionMsg.value = ''
  actionErr.value = ''
}

async function confirmCancelPo(a) {
  busyId.value = a.purchase_order.po_id
  try {
    const res = await cancelPo(a.purchase_order.po_id, 'demo_operator', cancelReason.value)
    actionMsg.value = res.message
    cancelingPoId.value = ''
    cancelReason.value = ''
    await loadApplies()
  } catch (e) {
    actionErr.value = e instanceof ApiError ? e.code + '：' + e.message : '取消失败：' + e.message
  } finally {
    busyId.value = ''
  }
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
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>SKU</th><th>标题</th><th>日均销量</th><th>在手</th><th>在途</th><th>可撑天数</th><th>风险</th><th>建议量</th><th>占用资金</th><th>操作</th></tr></thead>
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
            <td>
              <button
                class="btn-plain p2Submit" :data-sku="r.sku" :disabled="busyId === r.sku || Number(r.qty) <= 0"
                @click="quickSubmit(r)" style="padding:5px 10px;font-size:12px;"
              >提交申请</button>
            </td>
          </tr>
        </tbody>
      </table></div>
      <div id="p2Empty" v-if="data && !filtered.length" class="empty-line">— 无匹配 SKU</div>
    </div>

    <!-- PACK 12：补货申请列表 + 审批操作（全部数据来自 /api/p3/applies，状态由后端下发） -->
    <div v-if="data" class="card section-gap" id="p2ApplyCard">
      <h3 class="card-title">补货申请与审批</h3>
      <div class="small muted" style="margin-bottom:12px;">
        申请数量由后端按实时建议量计算（页面不写死任何数字）· 通过后自动生成采购单 · 驳回必须填写理由
      </div>
      <div v-if="actionErr" class="alert alert-missing" id="p2ApplyActionErr">{{ actionErr }}</div>
      <div v-if="actionMsg" class="alert" id="p2ApplyActionMsg" style="background:#EFF6FF;border:1px solid #BFD6F0;color:#1E5A8A;">{{ actionMsg }}</div>
      <div v-if="appliesErr" class="alert alert-missing" id="p2ApplyOffline">
        申请列表暂不可用（/api/p3/applies 未返回），本页其余数据正常；页面不显示任何兜底数字。
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>申请号</th><th>SKU</th><th>申请数量</th><th>占用资金</th><th>路线 / 目标</th><th>状态</th><th>提交人 / 时间</th><th>审批人 / 时间</th><th>采购单</th><th>操作</th></tr></thead>
        <tbody id="p2ApplyBody">
          <tr v-for="a in applies" :key="a.apply_id" :data-apply="a.apply_id">
            <td class="small">{{ a.apply_id }}</td>
            <td><b>{{ a.sku_id }}</b></td>
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
                实收 {{ fmtNum(a.purchase_order.receive_qty) }}/{{ fmtNum(a.purchase_order.order_qty) }} · 不良 {{ fmtNum(a.purchase_order.defect_qty) }}
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <div v-if="a.purchase_order && CANCELLABLE_PO.includes(a.purchase_order.status)" style="margin-top:6px;">
                <button class="btn-plain p2CancelPo" :data-cancel-po="a.purchase_order.po_id" :disabled="busyId === a.purchase_order.po_id" @click="startCancelPo(a)" style="padding:4px 8px;font-size:12px;">取消采购单</button>
                <div v-if="cancelingPoId === a.purchase_order.po_id" style="margin-top:6px;display:flex;gap:6px;">
                  <input class="filter-input p2CancelInput" v-model="cancelReason" placeholder="必填：取消原因" style="width:150px;" />
                  <button class="btn-primary p2CancelConfirm" :disabled="busyId === a.purchase_order.po_id" @click="confirmCancelPo(a)" style="padding:4px 8px;font-size:12px;">确认取消</button>
                </div>
              </div>
              <template v-if="a.status === 'pending_approve'">
                <button class="btn-primary p2Approve" :data-approve="a.apply_id" :disabled="busyId === a.apply_id" @click="doApprove(a)" style="padding:5px 10px;font-size:12px;">通过</button>
                <button class="btn-plain p2Reject" :data-reject="a.apply_id" :disabled="busyId === a.apply_id" @click="startReject(a)" style="padding:5px 10px;font-size:12px;margin-left:6px;">驳回</button>
                <div v-if="rejectingId === a.apply_id" style="margin-top:6px;display:flex;gap:6px;">
                  <input class="filter-input p2RejectInput" v-model="rejectReason" placeholder="必填：驳回理由" style="width:150px;" />
                  <button class="btn-primary p2RejectConfirm" :disabled="busyId === a.apply_id" @click="confirmReject(a)" style="padding:5px 8px;font-size:12px;">确认</button>
                </div>
              </template>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
        </tbody>
      </table></div>
      <div id="p2ApplyEmpty" v-if="!applies.length && !appliesErr" class="empty-line">— 暂无补货申请</div>
    </div>
    <div class="small muted" style="margin-top:12px;text-align:right;">{{ store.copy.synthetic_notice || '—' }}<!-- E-5001 文案由后端 /api/copy 提供 --></div>
  </section>
</template>
