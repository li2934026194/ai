<script setup>
defineProps({
  online: { type: Boolean, default: true },
  sourceType: { type: String, default: '' },
  asOf: { type: String, default: '' },
  badgeId: { type: String, default: '' },
  asOfId: { type: String, default: '' },
})
</script>

<template>
  <span v-if="asOfId" :id="asOfId" class="as-of">{{ asOf ? ('截止 ' + asOf) : '' }}</span>
  <span :id="badgeId" class="badge" :class="online ? 'badge-online' : 'badge-offline'">
    {{ online ? (sourceType + '·合成数据') : '数据源连不上，当前无数据可显示' }}
  </span>
</template>
