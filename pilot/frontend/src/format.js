// 纯格式化函数与展示映射：不含任何业务数字，只处理接口返回值的显示方式。
export const fmt = (n) => Number(n).toLocaleString('zh-CN')
export const money = (n) => '¥' + fmt(Math.round(Number(n)))
export const fmtNum = (n) => fmt(Math.round(Number(n)))
export const fmtF = (n, d) => {
  const v = Number(n)
  return n == null || Number.isNaN(v) ? '—' : v.toFixed(d)
}
export const fmtPct = (n) => {
  if (n == null) return '—'
  const v = Number(n)
  return Number.isNaN(v) ? '—' : (v * 100).toFixed(1) + '%'
}

// 口径文案：holdout=单次留出，rolling=走步回测，不写死口径结果。
export function methodLabel(m) {
  if (m === 'holdout') return '单次留出'
  if (m === 'rolling') return '走步回测'
  return m || '—'
}

export function sourceLabel(src) {
  if (src === 'cost_reverse') return '成本反推'
  if (src === 'manual') return '手动指定'
  if (src === 'default_missing_cost') return '缺成本·默认值'
  return src || '—'
}

// 风险彩色标签：只映射文案/颜色，不产生数字。
export function riskPill(risk) {
  if (risk === 'STOCKOUT') return { text: '已断货', cls: 'pill-bad' }
  if (risk === 'RISK') return { text: '交期内将断货', cls: 'pill-bad' }
  if (risk === 'WATCH') return { text: '接近交期', cls: 'pill-warn' }
  return { text: '安全', cls: 'pill-good' }
}

// 可撑天数横条：阈值是展示配色规则（文案/颜色），不是业务数字。
export function daysCell(days) {
  if (days == null) return null
  const v = Number(days)
  if (Number.isNaN(v)) return null
  let color
  if (v <= 21) color = 'var(--red)'
  else if (v <= 45) color = 'var(--warn)'
  else color = 'var(--healthy)'
  const width = Math.min((v / 90) * 100, 100)
  const label = v >= 1000 ? fmtNum(v) + ' 天' : fmtF(v, v >= 100 ? 0 : 1) + ' 天'
  return { color, width: width + '%', label }
}

export function modelVerdict(name, best, m) {
  if (name === best) return { text: '最佳', cls: 'pill-good' }
  if (m.bias != null && Number(m.bias) < -0.15) return { text: '系统性低估', cls: 'pill-bad' }
  return { text: '—', cls: 'pill-gray' }
}

// WS 事件展示映射（类型标签/颜色写死的是文案和颜色，不是业务数字）。
export const WS_COLOR = {
  agent_start: '#5AD1A8', agent_token: '#D6E2F0', agent_progress: '#F5C76B',
  agent_done: '#7FB3FF', run_done: '#FF9E9E',
}
export const WS_LABEL = {
  agent_start: 'START', agent_token: 'TOKEN', agent_progress: 'TOOL',
  agent_done: 'DONE', run_done: 'SUMMARY',
}
