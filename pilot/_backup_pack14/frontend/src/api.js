import { store } from './store'

// 与旧 web/index.html 相同的取数基址策略：
// 由后端 8000 端口同源托管时用相对路径；其它端口或 file:// 打开时回退 8000。
export const API = (location.protocol === 'http:' || location.protocol === 'https:')
  ? (location.port === '8000' ? '' : 'http://127.0.0.1:8000')
  : 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(code, message, available) {
    super(message)
    this.code = code
    this.available = available
  }
}

export async function fetchJSON(path) {
  const resp = await fetch(API + path, { cache: 'no-store' })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const body = await resp.json()
  // 后端把业务错误也返回 HTTP 200，靠 body.code 识别。
  if (body && typeof body.code === 'string') {
    throw new ApiError(body.code, body.message, body.available)
  }
  return body
}

// 后端不可用时置 offline，页面据此显示降级提示；绝不返回写死的业务数字。
function markOffline() {
  store.online = false
}

export async function getDatasets() {
  try {
    const body = await fetchJSON('/api/datasets')
    store.online = true
    return body.datasets || []
  } catch (e) {
    markOffline()
    return []
  }
}

export async function getDashboard(did) {
  try {
    const body = await fetchJSON('/api/p1/dashboard?dataset_id=' + encodeURIComponent(did))
    store.online = true
    return body
  } catch (e) {
    markOffline()
    return null
  }
}

export async function getSkus(did) {
  try {
    const body = await fetchJSON('/api/p2/skus?dataset_id=' + encodeURIComponent(did) + '&rank=100')
    store.online = true
    return body
  } catch (e) {
    markOffline()
    return null
  }
}

// 结构化错误（E-1001 / E-1003）上抛给 P3 渲染错误态；
// 网络错误返回 null 并标记离线。
export async function getSkuDetail(did, sku) {
  try {
    const body = await fetchJSON('/api/p3/sku/' + encodeURIComponent(sku) + '?dataset_id=' + encodeURIComponent(did))
    store.online = true
    return body
  } catch (e) {
    if (e instanceof ApiError) throw e
    markOffline()
    return null
  }
}

// ---------------------------------------------------------------------------
// PACK 12：补货申请 → 审批 → 采购单 → 收货质检（只新增，上面函数未动）
// 写操作把结构化错误（E-1103 非法流转 / E-1104 缺理由 / E-1105 数量非法）上抛给页面，
// 页面据此显示拦截原因；网络错误抛普通 Error，页面降级但不白屏。
// ---------------------------------------------------------------------------
export async function postJSON(path, body) {
  const resp = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const data = await resp.json()
  if (data && typeof data.code === 'string') {
    throw new ApiError(data.code, data.message, data.available)
  }
  store.online = true
  return data
}

export async function getApplies(did, sku) {
  try {
    let path = '/api/p3/applies?dataset_id=' + encodeURIComponent(did)
    if (sku) path += '&sku=' + encodeURIComponent(sku)
    const body = await fetchJSON(path)
    store.online = true
    return body
  } catch (e) {
    markOffline()
    return null
  }
}

export function submitApply(payload) {
  return postJSON('/api/p3/apply', payload)
}

export function approveApply(applyId, user) {
  return postJSON('/api/p3/apply/approve', { apply_id: applyId, approve_user: user })
}

export function rejectApply(applyId, user, reason) {
  return postJSON('/api/p3/apply/reject', {
    apply_id: applyId,
    approve_user: user,
    reject_reason: reason,
  })
}

export function receivePo(poId, receiveQty, defectQty, operator) {
  return postJSON('/api/p3/po/receive', {
    po_id: poId,
    receive_qty: Number(receiveQty),
    defect_qty: Number(defectQty || 0),
    operator: operator,
  })
}
