import { reactive } from 'vue'

// 全局共享状态：数据集列表、当前数据集、当前 SKU、后端在线标志。
// 所有业务数字都由页面从接口取回后写入，这里不预置任何业务数字。
// PACK 14 / Z3：copy 是后端 /api/copy 的文案（无补货提示 / 合成场景声明），
// 字面量唯一来源是 api.constants；前端不写死，未加载成功时为空串，页面只显示降级占位。
export const store = reactive({
  datasets: [],
  currentDid: null,
  currentSku: 'SKU-017',
  online: true,
  copy: {
    no_replenish: '',
    synthetic_notice: '',
    amount_unavailable: '',
  },
})

export function currentDatasetName() {
  const hit = store.datasets.find((d) => d.id === store.currentDid)
  return hit ? hit.name : '—'
}
