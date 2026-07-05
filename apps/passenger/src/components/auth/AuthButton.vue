<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  loading?: boolean
  loadingText?: string
  text: string
}>(), {
  icon: '',
  loading: false,
  loadingText: '',
})
</script>

<template>
  <button
    class="h-14 w-full flex items-center justify-center rounded-2xl bg-main-500 text-base text-white font-800 shadow-lg shadow-main-500/25 transition active:scale-[0.98] disabled:bg-slate-700 disabled:text-muted disabled:shadow-none"
    type="submit"
  >
    <span v-if="loading" class="i-mdi-loading mr-2 animate-spin text-xl" />
    <span v-else-if="icon" class="mr-2 text-xl" :class="icon" />
    {{ loading ? loadingText || text : text }}
  </button>
</template>
