<script setup lang="ts">
import type { ThemeMode } from '@edtaxi/shared/composables/appearance'
import { useAppTheme } from '@edtaxi/shared/composables/appearance'
import { APP_LOCALE_NATIVE_NAMES, APP_LOCALES, useAppLocale } from '@edtaxi/shared/composables/appLocale'
import { usePassengerStore } from '~/stores/passenger'

const passenger = usePassengerStore()
const { t } = useI18n()

// Тема и язык — shared-логика (localStorage + тема Telegram); здесь только UI.
const { mode } = useAppTheme()
const { current, setLocale } = useAppLocale()
// current() читает savedLocale внутри — computed отслеживает смену выбора.
const activeLocale = computed(() => current())

const THEME_OPTIONS: Array<{ icon: string, value: ThemeMode }> = [
  { icon: 'i-mdi-theme-light-dark', value: 'auto' },
  { icon: 'i-mdi-weather-night', value: 'dark' },
  { icon: 'i-mdi-white-balance-sunny', value: 'light' },
]

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.settings',
  },
})

useHead({
  title: () => `${t('settings.title')} | Telegram Taxi`,
})

onMounted(() => {
  if (!passenger.profile)
    passenger.loadProfile().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white light:bg-secondary-50 light:text-secondary-800">
    <section class="mx-auto max-w-sm">
      <!-- Смена номера телефона — как у водителя: код в WhatsApp, подтверждение -->
      <RouterLink
        to="/menu/change-phone"
        class="flex items-center gap-4 rounded-3xl app-card px-4 py-4 text-white transition active:scale-[0.98] light:bg-black/6 light:text-secondary-800"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip app-accent light:bg-black/6 light:text-main-600">
          <span class="i-mdi-phone-sync text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">{{ t('settings.phone.title') }}</span>
          <span class="mt-0.5 block truncate text-xs app-muted font-600 light:text-slate-500">
            {{ passenger.profile?.phone ? `${passenger.profile.phone} · ${t('settings.phone.changeSuffix')}` : t('settings.phone.change') }}
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 app-faint" />
      </RouterLink>

      <!-- Тема: как в Telegram / тёмная / светлая (хранится локально) -->
      <div class="mt-3 rounded-3xl app-card p-4 light:bg-black/6">
        <p class="text-xs app-muted font-800 uppercase light:text-slate-500">
          {{ t('settings.appearance.title') }}
        </p>
        <div class="grid grid-cols-3 mt-3 gap-2">
          <button
            v-for="option in THEME_OPTIONS"
            :key="option.value"
            class="h-16 flex flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-800 transition active:scale-[0.97]"
            :class="mode === option.value
              ? 'bg-main-500 text-white'
              : 'app-chip app-muted light:bg-black/6 light:text-slate-500'"
            type="button"
            @click="mode = option.value"
          >
            <span :class="option.icon" class="text-5.5" />
            {{ t(`settings.appearance.theme.${option.value}`) }}
          </button>
        </div>
      </div>

      <!-- Язык: ru / kk / en; последний выбор сохраняется на устройстве -->
      <div class="mt-3 rounded-3xl app-card p-4 light:bg-black/6">
        <p class="text-xs app-muted font-800 uppercase light:text-slate-500">
          {{ t('settings.language.title') }}
        </p>
        <div class="grid grid-cols-3 mt-3 gap-2">
          <button
            v-for="locale in APP_LOCALES"
            :key="locale"
            class="h-12 flex items-center justify-center rounded-2xl text-sm font-800 transition active:scale-[0.97]"
            :class="activeLocale === locale
              ? 'bg-main-500 text-white'
              : 'app-chip app-muted light:bg-black/6 light:text-slate-500'"
            type="button"
            @click="setLocale(locale)"
          >
            {{ APP_LOCALE_NATIVE_NAMES[locale] }}
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
