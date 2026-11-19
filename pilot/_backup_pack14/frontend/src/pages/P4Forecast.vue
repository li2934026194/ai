<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from '../store'
import { getSkus, getSkuDetail, ApiError } from '../api'
import { fmtPct, fmtF, methodLabel, modelVerdict } from '../format'
import DataBadge from '../components/DataBadge.vue'

const detail = ref(null)
const err = ref(null)
const offline = ref(false)
const skuMenu = ref([])
const menuOpen = ref(false)

const mLabel = computed(() => detail.value ? methodLabel(detail.value.meta.method) : '—')

async function load() {
  err.value = null
  detail.value = null
  if (!store.currentDid) { offline.value = true; return }
  try {
    const body = await getSkuDetail(store.currentDid, store.currentSku)
    if (body) { detail.value = body; offline.value = false }
    else offline.value = true
  } catch (e) {
    if (e instanceof ApiError) err.value = e
    else offline.value = true
  }
}

function pickSku(sku) {
  store.currentSku = sku
  menuOpen.value = false
  load()
}

onMounted(async () => {
  if (store.currentDid) {
    const s = await getSkus(store.currentDid)
    skuMenu.value = s ? (s.skus || []) : []
  }
  await load()
})
</script>

<template>
  <section id="page-P4" class="page">
    <h1 class="page-title">预测体检</h1>

    <div v-if="offline && !err" class="alert alert-missing">
      数据源连不上，页面无法加载业务数据（E-3001）。请确认 FastAPI 已在 8000 端口启动；页面不显示任何兜底数字。
    </div>

    <div class="topbar card" style="margin-bottom:20px;">
      <div class="topbar-left">
        <button id="p4SkuBtn" class="dataset-btn" @click="menuOpen = !menuOpen">SKU ▾</button>
        <div id="p4SkuMenu" v-if="menuOpen" class="dataset-menu">
          <div v-for="r in skuMenu" :key="r.sku" @click="pickSku(r.sku)">{{ r.sku }} · {{ r.title || '' }}</div>
          <div v-if="!skuMenu.length" class="muted">— 无 SKU（后端不可达）</div>
        </div>
        <span id="p4SkuName" class="dataset-name">{{ detail ? detail.sku : store.currentSku }}</span>
      </div>
      <div class="topbar-right" style="display:flex;align-items:center;gap:10px;">
        <DataBadge
          :online="!!detail && store.online" :source-type="detail ? detail.meta.source_type : ''"
          :as-of="detail ? detail.meta.as_of : ''" badge-id="p4Badge" as-of-id="p4AsOf"
        />
      </div>
    </div>

    <div v-if="err" class="alert alert-missing">
      {{ err.code }}：{{ err.message }}
    </div>

    <template v-else-if="detail">
      <div class="alert" id="p4MethodBar" style="background:#EFF6FF;border:1px solid #BFD6F0;color:#1E5A8A;margin-top:0;">
        口径：<b>{{ mLabel }}</b> · 各模型外推结果与历史记录对比得到 WAPE / Bias / MAE。
      </div>
      <div class="card section-gap">
        <h3 class="card-title" id="p4ModelTitle">模型对比（{{ mLabel }}）</h3>
        <table class="tbl">
          <thead><tr><th>模型</th><th>WAPE</th><th>Bias</th><th>MAE</th><th>样本数</th><th>结论</th></tr></thead>
          <tbody id="p4ModelBody">
            <tr v-if="!Object.keys(detail.per_model || {}).length"><td colspan="6" class="muted">无回测数据</td></tr>
            <tr v-for="(m, name) in detail.per_model" :key="name">
              <td><b>{{ name }}</b></td>
              <td class="num">{{ fmtPct(m.wape) }}</td>
              <td class="num">{{ fmtPct(m.bias) }}</td>
              <td class="num">{{ fmtF(m.mae, 2) }}</td>
              <td class="num">{{ m.n_obs == null ? '—' : m.n_obs }}</td>
              <td><span class="pill" :class="modelVerdict(name, detail.best_model, m).cls">{{ modelVerdict(name, detail.best_model, m).text }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="small muted" style="margin-top:12px;text-align:right;">本页数据为合成演示数据（SYNTHETIC），非真实经营数据。<!-- E-5001 --></div>
  </section>
</template>
