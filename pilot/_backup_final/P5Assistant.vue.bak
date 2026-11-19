<script setup>
import { ref } from 'vue'

const message = ref('你好，我的订单已经 5 天没发货了，什么时候能到？')
const draft = ref('点击「生成草稿」后，这里显示草稿内容。')

// 本地草稿模板：只生成草稿文案，不调用后端、不发送（E-2001 降级能力）。
function draftReply(msg) {
  const hasShip = /发货|货|到|物流|快递|单/.test(msg)
  if (hasShip) {
    return '您好，很抱歉让您久等了。\n\n我们已为您核查订单，当前正在加急处理中。您可以通过订单详情页查看最新物流状态；若超过预计时效仍未更新，请回复订单号，我们会第一时间为您跟进。\n\n感谢您的理解与耐心。'
  }
  return '您好，已收到您的咨询。\n\n我们会尽快为您核实处理，请稍候。如需加急，请提供订单号，我们会优先为您跟进。'
}

function generate() {
  draft.value = draftReply(message.value || '')
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
        <button id="p5DraftBtn" class="btn-primary" style="align-self:flex-start;" @click="generate">生成草稿</button>
        <div>
          <label class="muted small">回复草稿</label>
          <div id="p5Draft" style="border:1px solid var(--border);border-radius:6px;padding:14px;min-height:90px;background:#FAFBFC;font-size:13px;color:var(--text);white-space:pre-wrap;">{{ draft }}</div>
          <div class="small" id="p5AiNote" style="color:#8A5A00;margin-top:6px;">AI 服务暂时不可用，已切换到模板版（草稿基于本地模板生成，不影响使用）。<!-- E-2001 --></div>
        </div>
        <div class="muted small">提示：确认无误后，请到客服后台手动发送；本页不提供发送入口。</div>
      </div>
    </div>
  </section>
</template>
