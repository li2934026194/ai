<script setup>
import { computed } from 'vue'
import { daysCell } from '../format'

const props = defineProps({ days: { default: null } })
const view = computed(() => daysCell(props.days))
</script>

<template>
  <span v-if="!view" class="muted">—</span>
  <div v-else class="barcell">
    <div class="bartrack"><div class="barfill" :style="{ width: view.width, background: view.color }"></div></div>
    <span class="barnum">{{ view.label }}</span>
  </div>
</template>
