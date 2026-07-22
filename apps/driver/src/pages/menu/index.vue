<script setup lang="ts">
import { readSavedAccounts } from '@edtaxi/shared/composables/auth/saved-accounts'
import { mediaUrl } from '~/api/client'
import { getDriverOverview } from '~/api/driver'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const router = useRouter()
const auth = useAuthStore()
const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()
const { t } = useI18n()

// park_id из обзора водителя — чтобы показать пункт «Чат с парком» только
// состоящим в таксопарке.
const parkId = ref<null | string>(null)

const driverMeta = computed(() => {
  // toFixed(2), как в личном кабинете: toFixed(1) округлял 4.96 до «5.0», и
  // меню спорило с кабинетом о рейтинге.
  if (driver.profile)
    return t('menu.meta', { rating: driver.profile.rating.toFixed(2), trips: driver.profile.total_trips })

  return driver.isOnline ? t('menu.online') : t('menu.offline')
})

const verificationOk = computed(() => {
  const v = onboarding.verification
  if (!v)
    return false
  return v.face_verified && v.has_approved_vehicle && v.daily_check_valid
})

// После подтверждения лица селфи показывается как аватар вместо иконки руля.
const faceAvatar = computed(() => {
  const v = onboarding.verification
  return v?.face_status === 'approved' ? mediaUrl(v.face_photo_url) : ''
})

// Верификация перенесена в личный кабинет (/menu/profile) — здесь её больше нет.
const menuItems = computed(() => [
  { key: 'bonus', icon: 'i-mdi-gift-outline', to: '/bonus', badge: false },
  { key: 'vehicle', icon: 'i-mdi-car-info', to: '/menu/vehicle', badge: false },
  { key: 'history', icon: 'i-mdi-history', to: '/menu/history', badge: false },
  { key: 'parks', icon: 'i-mdi-office-building', to: '/menu/parks', badge: false },
  ...(parkId.value
    ? [{ key: 'parkChat', icon: 'i-mdi-message-text', to: '/menu/park-chat', badge: false }]
    : []),
  { key: 'support', icon: 'i-mdi-headset', to: '/menu/support', badge: false },
  { key: 'feedback', icon: 'i-mdi-lightbulb-outline', to: '/menu/feedback', badge: false },
].map(item => ({
  ...item,
  description: t(`menu.items.${item.key}Desc`),
  label: t(`menu.items.${item.key}`),
})))

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: () => `${t('nav.menu')} | Telegram Taxi`,
})

async function logout() {
  await auth.logout()
  // После явного выхода — страница выбора аккаунтов (если уже входили раньше),
  // откуда можно вернуться в свой аккаунт или войти в другой по номеру.
  await router.replace(readSavedAccounts(SAVED_ACCOUNTS_KEY).length ? '/login/accounts' : '/login')
}

onMounted(async () => {
  getDriverOverview()
    .then((overview) => {
      parkId.value = overview.driver.park_id
    })
    .catch(() => {})
  await driver.ensureProfile().catch(() => {})
  await onboarding.loadVerification().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+7.25rem)] pt-[calc(var(--app-safe-area-top)+1.35rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Настройки: шестерёнка слева сверху. Ряд в потоке контента (ниже
           safe-area), поэтому не попадает под телеграмовскую кнопку «Закрыть». -->
      <div class="mb-4 flex">
        <RouterLink
          :aria-label="t('titles.settings')"
          class="h-11 w-11 flex items-center justify-center rounded-full app-chip text-main-200 transition active:scale-95 light:text-main-700"
          to="/menu/settings"
        >
          <span class="i-mdi-cog text-6" />
        </RouterLink>
      </div>

      <RouterLink to="/menu/profile" class="flex items-center gap-4 transition active:scale-[0.98]">
        <div class="relative h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-main-500/16 text-main-200 light:text-main-700">
          <img v-if="faceAvatar" :src="faceAvatar" alt="" class="h-full w-full object-cover">
          <span v-else class="i-mdi-steering text-9" />
          <span
            v-if="!verificationOk"
            class="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-secondary-900"
            :aria-label="t('menu.needsVerification')"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-xs app-accent font-900 uppercase">
            {{ t('nav.driver') }}
          </p>
          <h1 class="mt-1 truncate text-3xl font-950">
            {{ t('menu.cabinet') }}
          </h1>
          <p class="mt-1 truncate text-sm app-muted font-700">
            {{ driverMeta }}
          </p>
        </div>

        <span class="i-mdi-chevron-right shrink-0 text-7 app-faint" />
      </RouterLink>

      <nav class="mt-8 space-y-3">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-4 rounded-3xl app-card px-4 py-4 text-white transition active:scale-[0.98]"
        >
          <span
            class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl text-main-200 light:text-main-700"
            :class="item.badge ? 'bg-amber-500/18' : 'app-chip'"
          >
            <span :class="item.icon" class="text-7" :style="item.badge ? 'color: rgb(251 191 36)' : ''" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 text-lg font-900">
              {{ item.label }}
              <span v-if="item.badge" class="i-mdi-alert-circle text-5 text-amber-400" />
            </span>
            <span class="mt-0.5 block truncate text-xs font-600" :class="item.badge ? 'text-amber-400/70' : 'app-muted'">
              {{ item.description }}
            </span>
          </span>

          <span class="i-mdi-chevron-right text-7 app-faint" />
        </RouterLink>
      </nav>

      <button
        :disabled="auth.isLoading"
        class="mt-8 h-14 w-full flex items-center justify-center rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="logout"
      >
        <span class="i-mdi-logout mr-2 text-5" />
        {{ auth.isLoading ? t('menu.loggingOut') : t('menu.logout') }}
      </button>
    </section>
  </main>
</template>
