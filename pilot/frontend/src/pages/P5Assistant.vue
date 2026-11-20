<script setup>
import { ref } from 'vue'
import { generateSupportDraft } from '../api'

const message = ref('你好，我的订单已经 5 天没发货了，什么时候能到？')
const draft = ref('点击「生成草稿」后，这里显示草稿内容。')
const busy = ref(false)
const degraded = ref(false)
const note = ref('')

// 本地草稿模板：仅在 A1 不可用（E-2001 / 超时 / 网络失败 / 无 Key）时降级使用，
// 不冒充模型成功。草稿只生成文案，不发送。
function draftReply(msg) {
  const hasShip = /发货|货|到|物流|快递|单/.test(msg)
  if (hasShip) {
    return '您好，很抱歉让您久等了。\n\n我们已为您核查订单，当前正在加急处理中。您可以通过订单详情页查看最新物流状态；若超过预计时效仍未更新，请回复订单号，我们会第一时间为您跟进。\n\n感谢您的理解与耐心。'
  }
  return '您好，已收到您的咨询。\n\n我们会尽快为您核实处理，请稍候。如需加急，请提供订单号，我们会优先为您跟进。'
}

async function generate() {
  if (busy.value) return
  busy.value = true
  degraded.value = false
  note.value = '正在调用 AI 助手 A1…'
  draft.value = '正在生成草稿…'
  try {
    const res = await generateSupportDraft(message.value || '')
    // degraded=true（后端 E-2001）也必须走降级分支，不能当成功显示。
    if (res && res.degraded === false && res.status === 'success' && res.text) {
      draft.value = res.text
      note.value = '草稿由 AI 助手 A1 生成（需你确认后发送）。'
    } else {
      throw new Error('A1 返回降级')
    }
  } catch (e) {
    const code = e && e.code ? e.code : ''
    draft.value = draftReply(message.value || '')
    degraded.value = true
    note.value = 'AI 服务不可用，已切换模板版（' + (code || 'E-2001 降级') + '，草稿基于本地模板生成，非模型输出）。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section id="page-P5" class="page">
    <h1 class="page-title">AI 助手</h1>
    <div class="card" style="max-width:820px;">
      <div class="alert alert-warn" style="margin-top:0;">
        客服草稿：本页仅生成回复草稿，<b>草稿·需你确认后发送</b>，不直接发出。
      </div>
      <div class="stack" style="margin-top:16px;">
        <div>
          <label class="muted small">客户来询（示例）</label>
          <textarea id="p5CustomerMsg" v-model="message" rows="3" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:13px;font-family:inherit;"></textarea>
        </div>
        <button id="p5DraftBtn" class="btn-primary" style="align-self:flex-start;" :disabled="busy" @click="generate">{{ busy ? '生成中…' : '生成草稿' }}</button>
        <div>
          <label class="muted small">回复草稿</label>
          <div id="p5Draft" style="border:1px solid var(--border);border-radius:6px;padding:14px;min-height:90px;background:#FAFBFC;font-size:13px;color:var(--text);white-space:pre-wrap;">{{ draft }}</div>
          <div v-if="note" class="small" id="p5AiNote" :style="{ color: degraded ? '#8A5A00' : '#0E9F6E', marginTop: '6px' }">{{ note }}</div>
        </div>
        <div class="muted small">提示：确认无误后，请到客服后台手动发送；本页不提供发送入口。</div>
      </div>
    </div>
  </section>
</template>
