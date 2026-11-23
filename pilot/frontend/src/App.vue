<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from './store'
import { getCopy, getDatasets } from './api'
import P1Dashboard from './pages/P1Dashboard.vue'
import P2Replenish from './pages/P2Replenish.vue'
import P3SkuDetail from './pages/P3SkuDetail.vue'
import P4Forecast from './pages/P4Forecast.vue'
import P5Assistant from './pages/P5Assistant.vue'
import P6Workshop from './pages/P6Workshop.vue'
import P7Rbac from './pages/P7Rbac.vue'

const tabs = [
  { key: 'P1', ico: '▦', text: '今日' },
  { key: 'P2', ico: '◔', text: '补货建议' },
  { key: 'P3', ico: '▤', text: 'SKU详情' },
  { key: 'P4', ico: '▥', text: '预测体检' },
  { key: 'P5', ico: '◑', text: 'AI助手' },
  { key: 'P6', ico: '⚒', text: '工坊' },
  { key: 'P7', ico: '⚿', text: '权限' },
]

function hashPage() {
  const h = (location.hash || '').replace('#', '').toUpperCase()
  return tabs.some((t) => t.key === h) ? h : 'P1'
}

const active = ref(hashPage())
const ready = ref(false)

const footText = computed(() => '数据源：' + (store.online ? '接口在线' : '连不上，降级提示'))

function switchTab(key) {
  active.value = key
  location.hash = key
  window.scrollTo(0, 0)
}
window.addEventListener('hashchange', () => { active.value = hashPage() })

onMounted(async () => {
  // PACK 14 / Z3：文案只在启动时从后端取一次，全站共用 store.copy（前端不写死字面量）
  const copy = await getCopy()
  if (copy) {
    store.copy.no_replenish = copy.no_replenish || ''
    store.copy.synthetic_notice = copy.synthetic_notice || ''
    store.copy.amount_unavailable = copy.amount_unavailable || ''
  }
  const list = await getDatasets()
  store.datasets = list
  // 默认选中「正在缺货」（按 name 匹配，不写死 id）；匹配不到才回落第一个。
  const stockout = list.find((d) => d.name.indexOf('正在缺货') >= 0)
  store.currentDid = stockout ? stockout.id : (list.length ? list[0].id : null)
  ready.value = true
})
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-name">跨境备货助手</div>
      <div class="brand-sub">七 Agent 协同备货</div>
    </div>
    <nav class="tabs">
      <button
        v-for="t in tabs" :key="t.key"
        class="tab" :class="{ active: active === t.key }"
        @click="switchTab(t.key)"
      ><span class="ico">{{ t.ico }}</span>{{ t.text }}</button>
    </nav>
    <div class="sidebar-foot" id="sidebarFoot">{{ footText }}</div>
  </aside>

  <div class="app">
    <P1Dashboard v-if="ready && active === 'P1'" />
    <P2Replenish v-else-if="ready && active === 'P2'" />
    <P3SkuDetail v-else-if="ready && active === 'P3'" />
    <P4Forecast v-else-if="ready && active === 'P4'" />
    <P5Assistant v-else-if="ready && active === 'P5'" />
    <P6Workshop v-else-if="ready && active === 'P6'" />
    <P7Rbac v-else-if="ready && active === 'P7'" />
    <div v-else class="placeholder">正在初始化…</div>
  </div>
</template>
