<script setup lang="ts">
import type { ThemeMode } from '@edtaxi/shared/composables/appearance'
import { useAppTheme } from '@edtaxi/shared/composables/appearance'
import { APP_LOCALE_NATIVE_NAMES, APP_LOCALES, useAppLocale } from '@edtaxi/shared/composables/appLocale'
import DistrictsMiniMap from '~/components/driver/DistrictsMiniMap.vue'
import { useOrderSoundEnabled } from '~/composables/driver/useOrderSound'
import { useAuthStore } from '~/stores/auth'
import { useDriverStore } from '~/stores/driver'

const auth = useAuthStore()
const driver = useDriverStore()
const { t } = useI18n()

// Тумблер «Мелодия заказа»: включает звук при поступлении заказа (хранится
// локально на устройстве). Тот же ключ читает плеер на экране карты.
const orderSoundEnabled = useOrderSoundEnabled()

const phone = computed(() => auth.currentUser?.phone ?? '')

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

// Районы приёма заказов переехали сюда из шторки на карте. Редактируем в любом
// статусе (бэк не гейтит онлайном — фильтр читается на матчинге по факту).
onMounted(() => {
  driver.loadDistricts().catch(() => {})
})

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu',
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.settings',
  },
})

useHead({
  title: () => `${t('settings.title')} | Telegram Taxi Driver`,
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white light:bg-secondary-50 light:text-secondary-800">
    <section class="mx-auto max-w-sm">
      <!-- Мелодия заказа -->
      <div class="flex items-center gap-4 rounded-3xl app-card px-4 py-4 light:bg-black/6">
        <span
          class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
          :class="orderSoundEnabled ? 'bg-main-500/16 app-accent light:text-main-600' : 'app-chip app-faint light:bg-black/6'"
        >
          <span :class="orderSoundEnabled ? 'i-mdi-music-note' : 'i-mdi-music-note-off'" class="text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">{{ t('settings.sound.title') }}</span>
          <span class="mt-0.5 block truncate text-xs app-muted font-600 light:text-slate-500">
            {{ orderSoundEnabled ? t('settings.sound.on') : t('settings.sound.off') }}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          :aria-checked="orderSoundEnabled"
          :aria-label="t('settings.sound.title')"
          class="relative h-7 w-12 shrink-0 rounded-full transition"
          :class="orderSoundEnabled ? 'bg-main-500' : 'bg-white/14 light:bg-black/14'"
          @click="orderSoundEnabled = !orderSoundEnabled"
        >
          <span
            class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
            :class="orderSoundEnabled ? 'left-6' : 'left-1'"
          />
        </button>
      </div>

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

      <!-- Смена номера телефона -->
      <RouterLink
        to="/menu/profile/change-phone"
        class="mt-3 flex items-center gap-4 rounded-3xl app-card px-4 py-4 text-white transition active:scale-[0.98] light:bg-black/6 light:text-secondary-800"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip app-accent light:bg-black/6 light:text-main-600">
          <span class="i-mdi-phone-sync text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">{{ t('settings.phone.title') }}</span>
          <span class="mt-0.5 block truncate text-xs app-muted font-600 light:text-slate-500">
            {{ phone ? `${phone} · ${t('settings.phone.changeSuffix')}` : t('settings.phone.change') }}
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 app-faint" />
      </RouterLink>

      <!-- Районы приёма заказов: выбор + превью с подсветкой. Пусто = весь город. -->
      <div class="mt-3 rounded-3xl app-card p-4 light:bg-black/6">
        <div class="flex items-center gap-3">
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl app-chip app-accent light:bg-black/6 light:text-main-600">
            <span class="i-mdi-map-marker-radius-outline text-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">{{ t('settings.districts.title') }}</span>
            <span class="mt-0.5 block truncate text-xs app-muted font-600 light:text-slate-500">
              {{ t('settings.districts.subtitle') }}
            </span>
          </span>
        </div>

        <template v-if="driver.availableDistricts.length">
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              :disabled="driver.isSavingDistricts"
              class="rounded-full px-3 py-1.5 text-xs font-800 transition active:scale-[0.96] disabled:opacity-60"
              :class="!driver.activeDistrictIds.length ? 'bg-main-500 text-white' : 'app-chip app-muted light:bg-black/6 light:text-slate-500'"
              type="button"
              @click="driver.clearDistricts()"
            >
              {{ t('settings.districts.wholeCity') }}
            </button>
            <button
              v-for="district in driver.availableDistricts"
              :key="district.id"
              :disabled="driver.isSavingDistricts"
              class="rounded-full px-3 py-1.5 text-xs font-800 transition active:scale-[0.96] disabled:opacity-60"
              :class="driver.activeDistrictIds.includes(district.id) ? 'bg-main-500 text-white' : 'app-chip app-muted light:bg-black/6 light:text-slate-500'"
              type="button"
              @click="driver.toggleDistrict(district.id)"
            >
              {{ district.name }}
            </button>
          </div>

          <DistrictsMiniMap
            class="mt-3"
            :active-ids="driver.activeDistrictIds"
            :districts="driver.availableDistricts"
          />

          <p class="mt-2 text-xs app-faint font-700 leading-4">
            {{ t('settings.districts.hint') }}
          </p>
        </template>

        <p v-else class="mt-3 text-xs app-faint font-700 leading-4">
          {{ t('settings.districts.noCity') }}
        </p>
      </div>
    </section>
  </main>
</template>
