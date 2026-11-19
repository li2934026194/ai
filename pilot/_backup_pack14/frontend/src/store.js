import { reactive } from 'vue'

// 全局共享状态：数据集列表、当前数据集、当前 SKU、后端在线标志。
// 所有业务数字都由页面从接口取回后写入，这里不预置任何业务数字。
export const store = reactive({
  datasets: [],
  currentDid: null,
  currentSku: 'SKU-017',
  online: true,
})

export function currentDatasetName() {
  const hit = store.datasets.find((d) => d.id === store.currentDid)
  return hit ? hit.name : '—'
}
