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
    <div class="pointer-events-auto mx-auto h-15 max-w-sm flex items-center gap-3 border border-white/10 rounded-2xl bg-secondary-950/76 px-2 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <button
        :aria-label="backLabel"
        class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-[0.96]"
        type="button"
        @click="emit('back')"
      >
        <span class="i-mdi-arrow-left text-6" />
      </button>

      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base font-950">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-0.5 truncate text-xs text-slate-400 font-700">
          {{ subtitle }}
        </p>
      </div>
    </div>
  </header>
</template>
