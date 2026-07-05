<script setup lang="ts">
import { isDark, isSystemTheme, preferredDark } from '@edtaxi/shared/composables/dark'
import { SwitchRoot, SwitchThumb } from 'reka-ui'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Настройки',
  },
})

useHead({
  title: 'Настройки | EdTaxi',
})

// Подпись текущего режима под секцией — что фактически применено.
const appearanceSummary = computed(() => {
  if (isSystemTheme.value)
    return `Системная · сейчас ${preferredDark.value ? 'тёмная' : 'светлая'}`
  return isDark.value ? 'Тёмная' : 'Светлая'
})
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full flex flex-col bg-bg pb-[calc(var(--app-safe-area-bottom)+1rem)] text-body">
    <section class="mx-auto max-w-sm w-full space-y-6">
      <!-- Оформление -->
      <div class="space-y-3">
        <div class="px-1">
          <h2 class="text-lg font-950">
            Оформление
          </h2>
          <p class="mt-0.5 text-xs text-muted font-700">
            {{ appearanceSummary }}
          </p>
        </div>

        <div class="overflow-hidden border border-border/10 rounded-3xl bg-surface/6">
          <!-- Тёмная тема -->
          <div class="flex items-center gap-3 px-4 py-4" :class="{ 'opacity-45': isSystemTheme }">
            <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-surface/10 text-main-300">
              <span class="i-mdi-weather-night text-5.5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-900">Тёмная тема</span>
              <span class="mt-0.5 block text-xs text-muted font-700">
                {{ isSystemTheme ? 'Управляется системой' : 'Тёмное оформление интерфейса' }}
              </span>
            </span>
            <SwitchRoot
              v-model="isDark"
              aria-label="Тёмная тема"
              :disabled="isSystemTheme"
              class="relative h-7 w-12 shrink-0 cursor-pointer border border-border/10 rounded-full bg-surface/14 transition disabled:cursor-not-allowed data-[state=checked]:bg-main-500"
            >
              <SwitchThumb
                class="block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[1.375rem]"
              />
            </SwitchRoot>
          </div>

          <div class="mx-4 h-px bg-border/8" />

          <!-- Системная тема -->
          <div class="flex items-center gap-3 px-4 py-4">
            <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-surface/10 text-main-300">
              <span class="i-mdi-cellphone-cog text-5.5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-900">Системная</span>
              <span class="mt-0.5 block text-xs text-muted font-700">
                Следовать настройкам устройства
              </span>
            </span>
            <SwitchRoot
              v-model="isSystemTheme"
              aria-label="Системная тема"
              class="relative h-7 w-12 shrink-0 cursor-pointer border border-border/10 rounded-full bg-surface/14 transition data-[state=checked]:bg-main-500"
            >
              <SwitchThumb
                class="block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[1.375rem]"
              />
            </SwitchRoot>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
