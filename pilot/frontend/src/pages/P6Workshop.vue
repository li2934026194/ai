<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { store } from '../store'
import { getDashboard, getOpsSummary } from '../api'
import { fmtNum, WS_COLOR, WS_LABEL } from '../format'
import { ERROR_CODES, resolveCode } from '../errorCodes'

// PACK 14 / Z3：错误码表渲染时解析后端文案（E-4001 / E-5001 不再写死在前端）
const codeRows = computed(() => ERROR_CODES.map(resolveCode))

const agents = [
  { id: 'A1', cat: '客服', name: '客服应答 Agent', status: '已接入', ok: true, level: 'L1', desc: '查订单/查物流/起草客服回复（无发送能力）。', figure: '客服流程图' },
  { id: 'A2', cat: '驾驶舱', name: '今日驾驶舱 Agent', status: '模板版', ok: false, level: 'L2', desc: '汇总今日 KPI 与补货清单。', figure: '驾驶舱设计图' },
  { id: 'A3', cat: '问数', name: '问数 Agent', status: '已接入', ok: true, level: 'L2', desc: '自然语言问数，handoff 到预测/补货并溯源。', figure: '问数交互图' },
  { id: 'A4', cat: '选品', name: '选品 Agent', status: '模板版', ok: false, level: 'L3', desc: '基于销量/风险/利润筛选值得补货的 SKU。', figure: '选品流程图' },
  { id: 'A5', cat: '速测预测', name: '预测 Agent', status: '已接入', ok: true, level: 'L3', desc: '走步回测选最佳模型，给出 WAPE/Bias/MAE。', figure: '预测回测图' },
  { id: 'A6', cat: '补货', name: '补货 Agent', status: '已接入', ok: true, level: 'L3', desc: '算安全库存/再订货点，给建议量+占用资金。', figure: '补货推导链图' },
  { id: 'A7', cat: '内容创作', name: '内容创作 Agent', status: '模板版', ok: false, level: 'L2', desc: '生成商品文案与运营素材。', figure: '内容创作图' },
]

const runsToday = ref(null)
const ops = ref(null)
const wsAgent = ref('A6_replenish')
const wsQuestion = ref('SKU-001 建议补多少件？占用多少资金？')
const wsStatus = ref('未连接')
const wsStatusColor = ref('#6B7280')
const running = ref(false)
const logs = ref([])

let sock = null
let tokenBuf = ''
let tokenIndex = -1

function wsUrl() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/runs'
  }
  return 'ws://127.0.0.1:8000/ws/runs'
}

function append(type, text, ts) {
  const t = ts ? ts.split('T')[1] : ''
  logs.value.push({ type, text: '[' + t + '] ' + (WS_LABEL[type] || type) + '  ' + text, color: WS_COLOR[type] || '#D6E2F0' })
}

function flushToken() {
  if (tokenIndex >= 0 && tokenBuf) {
    logs.value[tokenIndex].text = '[TOKEN] ' + (tokenBuf.length > 220 ? tokenBuf.slice(0, 220) + '…' : tokenBuf)
  }
  tokenIndex = -1
  tokenBuf = ''
}

function runWs() {
  if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) {
    append('agent_progress', '已有连接在运行，请等待本轮结束。', null)
    return
  }
  logs.value = []
  tokenBuf = ''
  tokenIndex = -1
  running.value = true
  wsStatus.value = '连接中…'
  wsStatusColor.value = '#8A5A00'

  let s
  try { s = new WebSocket(wsUrl()) } catch (e) {
    wsStatus.value = '连接失败：' + e.message
    wsStatusColor.value = '#C0392B'
    running.value = false
    return
  }
  sock = s

  s.onopen = () => {
    wsStatus.value = '已连接 · 运行中'
    wsStatusColor.value = '#1E7A55'
    s.send(JSON.stringify({ agent: wsAgent.value, question: wsQuestion.value || '' }))
  }
  s.onmessage = (evt) => {
    let e
    try { e = JSON.parse(evt.data) } catch (_) { return }
    if (e.type === 'agent_start') {
      flushToken()
      tokenBuf = ''
      logs.value.push({ type: 'agent_token', text: '[TOKEN] ', color: WS_COLOR.agent_token })
      tokenIndex = logs.value.length - 1
      append('agent_start', '启动 ' + e.agent + (e.phase ? ' (' + e.phase + ')' : '') + '：' + (e.question || ''), e.ts)
    } else if (e.type === 'agent_token') {
      tokenBuf += (e.text || '')
      if (tokenIndex >= 0) {
        logs.value[tokenIndex].text = '[TOKEN] ' + (tokenBuf.length > 220 ? tokenBuf.slice(0, 220) + '…' : tokenBuf)
      }
    } else if (e.type === 'agent_progress') {
      flushToken()
      append('agent_progress', '工具事件 ' + (e.name || '') + (e.tool ? '→ ' + e.tool : '(' + (e.item_type || '') + ')') + (e.item_type === 'tool_call_output_item' ? ' 返回' : ''), e.ts)
    } else if (e.type === 'agent_done') {
      flushToken()
      append('agent_done', '输出完成 (' + (e.ok ? '成功' : '失败') + ')：' + (e.text || '').replace(/\n/g, ' ').slice(0, 160), e.ts)
    } else if (e.type === 'run_done') {
      append('run_done', '运行汇总 status=' + e.status + '  耗时=' + e.elapsed_ms + 'ms  Token=' + e.tokens + '  输出字数=' + (e.chars || 0), e.ts)
    }
  }
  s.onerror = () => {
    append('run_done', '连接错误：请确认后端已通过 uvicorn 启动在 8000 端口。', null)
  }
  s.onclose = () => {
    wsStatus.value = '连接已关闭'
    wsStatusColor.value = '#6B7280'
    running.value = false
    sock = null
  }
}

function clearWs() {
  logs.value = [{ type: 'info', text: '已清空。', color: '#7A8AA0' }]
  tokenBuf = ''
  tokenIndex = -1
}

onMounted(async () => {
  ops.value = await getOpsSummary()
  if (store.currentDid) {
    const d = await getDashboard(store.currentDid)
    runsToday.value = d ? d.kpi.agent_runs_today : null
  }
})
onBeforeUnmount(() => {
  if (sock) { sock.close(); sock = null }
})
</script>

<template>
  <section id="page-P6" class="page">
    <h1 class="page-title">Agent 工坊</h1>
    <p class="muted" style="margin:-8px 0 20px;">七个业务 Agent 的职责、能力深度与接入状态一览。</p>

    <div class="card" style="margin-bottom:20px;">
      <h3 class="card-title">今日运行概况</h3>
      <div class="small muted">七 Agent 今日运行次数（来源：/api/p1/dashboard）</div>
      <div class="kpi" style="max-width:260px;margin-top:8px;">
        <div id="p6RunsToday" class="value">{{ runsToday == null ? '—' : fmtNum(runsToday) }}</div>
        <div class="foot">来自 agent_runs 表，非写死</div>
      </div>
      <div v-if="runsToday == null" class="small" style="color:var(--warn);margin-top:6px;">
        数据源连不上，运行次数无法加载（E-3001）。请确认 FastAPI 已在 8000 端口启动。
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;" id="opsPanel">
      <h3 class="card-title">验收面板（最近一次真实跑分）</h3>
      <div v-if="!ops" class="small" style="color:var(--warn);">观测接口不可达（E-3001）</div>
      <template v-else>
        <div class="grid-4" style="margin:8px 0 12px;">
          <div><div class="small muted">库内数据集</div><div class="kpi"><div class="value" style="font-size:26px;">{{ ops.db.datasets }}</div></div></div>
          <div><div class="small muted">补货申请 / 采购单</div><div class="kpi"><div class="value" style="font-size:26px;">{{ ops.db.applies }} / {{ ops.db.purchase_orders }}</div></div></div>
          <div><div class="small muted">最近评测（第 {{ ops.eval.run || '—' }} 轮）</div><div class="small" style="margin-top:8px;">问数 {{ ops.eval.ask || '—' }} · 解释 {{ ops.eval.explain || '—' }}<br><span class="muted">{{ ops.eval.seconds ? ops.eval.seconds + 's' : '' }}</span></div></div>
          <div><div class="small muted">最近五闸</div><div class="small" style="margin-top:8px;">{{ ops.gates.available ? ops.gates.passed + ' / ' + ops.gates.total + ' 通过' : '尚未跑' }}<br><span class="muted">{{ ops.gates.ran_at || '' }}</span></div></div>
        </div>
        <div v-if="ops.gates.available" class="small">
          <span v-for="g in ops.gates.items" :key="g.name" class="pill" :class="g.ok ? 'pill-good' : 'pill-bad'" style="margin-right:8px;">{{ g.name }} {{ g.ok ? 'PASS' : 'FAIL' }}</span>
        </div>
        <div class="small muted" style="margin-top:8px;">数据来自 /api/ops/summary，为命令行最近一次真实运行快照；页面不触发重跑。</div>
      </template>
    </div>

    <div class="grid-4">
      <div v-for="a in agents" :key="a.id" class="card">
        <div class="small muted">{{ a.id }} · {{ a.cat }}</div>
        <h3 class="card-title" style="margin:4px 0 8px;">{{ a.name }}</h3>
        <div class="small" style="margin-bottom:8px;">
          <span class="pill" :class="a.ok ? 'pill-good' : 'pill-gray'">{{ a.status }}</span>
          <span class="pill pill-gray">{{ a.level }}</span>
        </div>
        <p class="muted small" style="margin:0 0 6px;">{{ a.desc }}</p>
        <div class="small muted">对应老师图：{{ a.figure }}</div>
        <div class="small muted" :id="'p6' + a.id + 'Run'">最近运行：—</div>
      </div>
    </div>

    <div class="card section-gap" id="wsPanel">
      <h3 class="card-title">实时日志 · Agent 运行流</h3>
      <p class="muted small" style="margin:-4px 0 14px;">
        点「运行补货」通过与后端的 WebSocket（<code>/ws/runs</code>）实时接收 A6 补货 Agent 的真实运行事件：
        开始 → LLM 流式片段 → 工具调用 → 完成 → 汇总（耗时/Token）。
      </p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
        <div>
          <label class="muted small">运行 Agent</label>
          <select id="wsAgent" v-model="wsAgent" class="ws-input" style="display:block;margin-top:4px;">
            <option value="A6_replenish">A6 · 补货 Agent</option>
            <option value="A5_forecast">A5 · 预测 Agent</option>
          </select>
        </div>
        <div>
          <label class="muted small">问题 / SKU</label>
          <input id="wsQuestion" v-model="wsQuestion" class="ws-input" style="display:block;margin-top:4px;width:320px;" />
        </div>
        <button id="wsRunBtn" class="btn-primary" :disabled="running" @click="runWs">{{ running ? '运行中…' : '▶ 运行补货' }}</button>
        <button id="wsClearBtn" class="btn-plain" @click="clearWs">清空</button>
        <span id="wsStatus" class="small muted" style="margin-left:auto;" :style="{ color: wsStatusColor }">{{ wsStatus }}</span>
      </div>
      <div id="wsLog" class="ws-log">
        <div v-if="!logs.length" class="ws-line" style="color:#7A8AA0;">等待运行… 点「运行补货」开始接收真实事件。</div>
        <div v-for="(line, i) in logs" :key="i" class="ws-line" :data-type="line.type" :style="{ color: line.color }">{{ line.text }}</div>
      </div>
    </div>

    <div class="card section-gap">
      <h3 class="card-title">错误码说明</h3>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>代码</th><th>含义</th><th>页面表现</th></tr></thead>
        <tbody>
          <tr v-for="e in codeRows" :key="e.code">
            <td><b>{{ e.code }}</b></td>
            <td>{{ e.title }}</td>
            <td class="muted">{{ e.detail }}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div class="card section-gap">
      <h3 class="card-title">其它入口</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <span class="pill pill-gray">数据源管理</span>
        <span class="pill pill-gray">参数校准</span>
        <span class="pill pill-gray">回测报告</span>
      </div>
    </div>

    <div class="small muted" style="margin-top:12px;text-align:right;">{{ store.copy.synthetic_notice || '—' }}<!-- E-5001 文案由后端 /api/copy 提供 --></div>
  </section>
</template>
