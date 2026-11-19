// 八条错误码/状态码文案（与旧 web/index.html 逐项对照）。
// 这里只放文案，不含任何业务数字；实际触发时的数值仍来自接口或 WS。
// PACK 14 / Z3：E-4001 / E-5001 两句不再写死在前端，改为引用后端 /api/copy 的字段
// （titleKey / detailKey），渲染时由 resolveCode 从 store.copy 取值；两端各留一处引用。
import { store } from './store'

export const ERROR_CODES = [
  { code: 'E-1001', title: '数据不足', detail: '有效历史天数不足，暂无法预测；补齐历史后再试。' },
  { code: 'E-1002', title: '缺成本', detail: '缺单件成本，金额不可算，服务水平按默认值。' },
  { code: 'E-1003', title: 'SKU 不存在', detail: '当前数据集里没有这个 SKU 的订单记录。' },
  { code: 'E-1004', title: '断货占比高', detail: '断货天数占比过高，预测与建议量仅供参考（warning，不是错误）。' },
  { code: 'E-2001', title: 'AI 不可用', detail: 'AI 服务暂时不可用，已切换到模板版草稿，不影响使用。' },
  { code: 'E-3001', title: '数据源连不上', detail: '后端接口不可达，页面显示降级提示，不显示任何兜底业务数字。' },
  { code: 'E-4001', titleKey: 'no_replenish', detail: '建议量为 0 时显示后端统一文案（不显示 0 件）。' },
  { code: 'E-5001', title: '合成场景声明', detailKey: 'synthetic_notice' },
  // PACK 12：补货审批履约闭环新增错误码（只加文案，不含任何业务数字）
  { code: 'E-1101', title: '申请不存在', detail: '这个补货申请号在库里查不到，可能已被清理。' },
  { code: 'E-1102', title: '采购单不存在', detail: '这个采购单号在库里查不到，可能已被清理。' },
  { code: 'E-1103', title: '非法状态流转', detail: '当前状态不允许执行该操作（例如草稿直接审批、驳回后再审批、终态再收货）。' },
  { code: 'E-1104', title: '驳回缺理由', detail: '驳回必须填写驳回理由，理由为空会被拦截。' },
  { code: 'E-1105', title: '数量或参数非法', detail: '数量必须为正整数、不良品不能多于实收、累计实收不能超过订单量。' },
  { code: 'E-1106', title: '无需补货', detail: '该 SKU 本轮建议量为 0，不能提交补货申请。' },
]

// PACK 14 / Z3：渲染前把 titleKey / detailKey 解析成后端文案（store.copy 由 App 启动时取回）。
// 未加载成功时显示占位，绝不复制一份字面量兜底。
export function resolveCode(entry) {
  const copy = store.copy || {}
  return {
    code: entry.code,
    title: entry.titleKey ? (copy[entry.titleKey] || '（文案未加载）') : entry.title,
    detail: entry.detailKey ? (copy[entry.detailKey] || '（文案未加载）') : entry.detail,
  }
}
