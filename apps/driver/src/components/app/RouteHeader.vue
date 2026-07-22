<script setup lang="ts">
withDefaults(defineProps<{
  backLabel?: string
  subtitle?: string
  title: string
}>(), {
  backLabel: 'Назад',
  subtitle: '',
})

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <header class="tg-safe-top tg-safe-x pointer-events-none absolute inset-x-0 top-0 z-40">
    <div class="pointer-events-auto mx-auto h-15 max-w-sm flex items-center gap-3 border app-surface rounded-2xl px-2 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl light:shadow-[0_10px_30px_rgba(16,20,26,0.10)]">
      <button
        :aria-label="backLabel"
        class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full app-chip app-strong transition active:scale-[0.96]"
        type="button"
        @click="emit('back')"
      >
        <span class="i-mdi-arrow-left text-6" />
      </button>

      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base app-strong font-950">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-0.5 truncate text-xs app-muted font-700">
          {{ subtitle }}
        </p>
      </div>
    </div>
  </header>
</template>
