<script setup lang="ts">
// KPI-карточка обзора: крупное значение с подписью и поясняющей строкой.
defineProps<{
  label: string
  value: string
  sub?: string
  icon: string
}>()
</script>

<template>
  <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <div class="flex items-center gap-2">
      <span aria-hidden="true" class="text-4.5 text-cyan-200" :class="icon" />
      <p class="text-xs text-white/42 font-900 uppercase">
        {{ label }}
      </p>
    </div>
    <p class="mt-2 text-3xl font-950">
      {{ value }}
    </p>
    <p v-if="sub" class="mt-1 text-xs text-white/45">
      {{ sub }}
    </p>
  </div>
</template>
