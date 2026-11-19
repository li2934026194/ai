<script setup>
import { computed } from 'vue'
import { riskPill } from '../format'

const props = defineProps({ risk: { type: String, default: '' } })
const view = computed(() => riskPill(props.risk))
</script>

<template>
  <span class="pill" :class="view.cls">{{ view.text }}</span>
</template>
