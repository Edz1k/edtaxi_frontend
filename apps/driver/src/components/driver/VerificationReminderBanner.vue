<script setup lang="ts">
defineProps<{ pendingLabel: string }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <section class="tg-safe-x absolute inset-x-0 top-[calc(var(--app-safe-area-top)+0.75rem)] z-30">
    <div class="mx-auto max-w-sm rounded-3xl bg-secondary-950/90 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div class="flex items-start gap-3">
        <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-amber-500/16 text-amber-300">
          <span class="i-mdi-shield-alert text-6" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-950">
            Пройдите верификацию
          </p>
          <p class="mt-0.5 text-xs text-slate-400 leading-4">
            Осталось завершить: {{ pendingLabel }}.
          </p>
        </div>
        <button
          aria-label="Скрыть напоминание"
          class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-400"
          type="button"
          @click="$emit('dismiss')"
        >
          <span class="i-mdi-close text-5" />
        </button>
      </div>
      <RouterLink
        class="mt-3 h-11 flex items-center justify-center rounded-2xl bg-amber-400 text-sm text-#06142f font-950 transition active:scale-[0.98]"
        to="/menu/profile/onboarding"
      >
        Перейти к верификации
      </RouterLink>
    </div>
  </section>
</template>
