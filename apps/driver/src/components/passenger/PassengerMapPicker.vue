<script setup lang="ts">
const props = withDefaults(defineProps<{
  error?: string
  isConfirming?: boolean
  screenPoint?: [number, number] | null
  title: string
}>(), {
  error: '',
  isConfirming: false,
  screenPoint: null,
})

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const panelElement = ref<HTMLElement | null>(null)

const pinStyle = computed(() => {
  const [x, y] = props.screenPoint ?? [0, 0]

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -100%)',
  }
})

defineExpose({
  panelElement,
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-10">
    <div
      v-if="screenPoint"
      class="absolute flex flex-col items-center"
      :style="pinStyle"
    >
      <div class="h-12 w-12 flex items-center justify-center rounded-full bg-main-500 text-white shadow-[0_14px_32px_rgba(230,173,46,0.38)]">
        <span class="i-mdi-map-marker text-8" />
      </div>
      <div class="h-4 w-px bg-main-500" />
    </div>
  </div>

  <section class="tg-safe-x pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-30">
    <div
      ref="panelElement"
      class="pointer-events-auto mx-auto max-h-[calc(var(--app-viewport-height)-var(--app-safe-area-top)-var(--app-safe-area-bottom)-14rem)] max-w-sm overflow-y-auto border border-white/10 rounded-[2rem] bg-secondary-950/86 p-4 text-white shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
    >
      <div class="flex items-center gap-3">
        <div class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-main-500/18 text-main-300">
          <span class="i-mdi-crosshairs-gps text-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-900">
            {{ title }}
          </h2>
          <p class="mt-0.5 truncate text-xs text-slate-400 font-700">
            Передвиньте карту, чтобы пин стоял на нужном месте
          </p>
        </div>
      </div>

      <p
        v-if="error"
        class="mt-3 text-center text-xs text-red-300 font-700"
      >
        {{ error }}
      </p>

      <div class="grid grid-cols-[1fr_2fr] mt-4 gap-2">
        <button
          class="h-13 rounded-[1.35rem] bg-white/8 text-sm text-slate-200 font-900 transition active:scale-[0.98]"
          type="button"
          @click="emit('cancel')"
        >
          Отмена
        </button>

        <button
          :disabled="isConfirming"
          class="h-13 rounded-[1.35rem] bg-main-500 text-sm text-white font-900 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:shadow-none"
          type="button"
          @click="emit('confirm')"
        >
          {{ isConfirming ? 'Определяем...' : 'Подтвердить' }}
        </button>
      </div>
    </div>
  </section>
</template>
