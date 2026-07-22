<script setup lang="ts">
import { openExternalLink } from '@edtaxi/shared/composables/auth/telegram'
import { useTripsStore } from '~/stores/trips'

const trips = useTripsStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.safety',
  },
})

const { t } = useI18n()

useHead({
  title: () => `${t('titles.safety')} | Telegram Taxi`,
})

// Если меню открыли раньше карты, активная поездка могла ещё не подтянуться —
// без неё «Отправить маршрут» не соберёт текст.
onMounted(async () => {
  if (!trips.activeTrip)
    await trips.restoreActiveTrip().catch(() => {})
})

// Маршрут можно отправить и до заказа: пассажир делится планом поездки,
// пока едет в уже выбранную точку (например, заказал с другого устройства).
const plannedRoute = computed(() => {
  const from = trips.pickupPlace?.address || trips.pickup
  const to = trips.destinationPlace?.address || trips.destination
  return from && to ? { from, to } : null
})

const canShareRoute = computed(() => trips.hasActiveTrip || Boolean(plannedRoute.value))

// Экстренный вызов: Telegram-вебвью блокирует ЛЮБУЮ tel:-навигацию внутри
// мини-аппа (и <a href>, и location.href) — поэтому открываем во внешнем
// браузере крошечную страницу /call-112.html с нашего же домена: она сама
// набирает 112, а если браузер требует явный тап — там большая кнопка.
function call112() {
  openExternalLink(`${window.location.origin}/call-112.html`)
}

// Текст шарится близким на языке интерфейса пассажира.
function shareRoute() {
  const trip = trips.hasActiveTrip ? trips.activeTrip : null
  const lines: string[] = [t('safety.share.intro')]

  if (trip) {
    lines.push(t('safety.share.route', { from: trip.pickup_address, to: trip.dropoff_address }))

    const driver = trip.driver
    if (driver?.name)
      lines.push(t('safety.share.driver', { name: driver.name }))
    if (driver?.vehicle) {
      const v = driver.vehicle
      lines.push(t('safety.share.vehicle', {
        car: [v.color, v.make, v.model].filter(Boolean).join(' '),
        plate: v.plate_number,
      }))
    }

    lines.push(t('safety.share.point', { url: `https://maps.google.com/?q=${trip.dropoff_lat},${trip.dropoff_lng}` }))
  }
  else if (plannedRoute.value) {
    lines.push(t('safety.share.route', { from: plannedRoute.value.from, to: plannedRoute.value.to }))
  }

  openExternalLink(`https://t.me/share/url?url=&text=${encodeURIComponent(lines.join('\n'))}`)
}

const CHECK_KEYS = ['docs', 'vehicle', 'face', 'history'] as const
const CHECK_ICONS: Record<(typeof CHECK_KEYS)[number], string> = {
  docs: 'i-mdi-card-account-details-outline',
  face: 'i-mdi-face-recognition',
  history: 'i-mdi-history',
  vehicle: 'i-mdi-car-info',
}
const safetyChecks = computed(() => CHECK_KEYS.map(key => ({
  icon: CHECK_ICONS[key],
  text: t(`safety.checks.${key}`),
})))
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Экстренный вызов -->
      <section class="border border-red-500/25 rounded-3xl bg-red-500/8 p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <span class="i-mdi-phone-alert text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              {{ t('safety.sos.title') }}
            </h2>
            <p class="text-xs app-muted font-700">
              {{ t('safety.sos.subtitle') }}
            </p>
          </div>
        </div>

        <!-- В Telegram-вебвью клик по <a href="tel:"> нередко «проглатывается»
             без перехода — принудительно уводим на tel: через location. -->
        <button
          class="mt-4 h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-red-500 text-base font-950 transition active:scale-[0.98]"
          type="button"
          @click="call112"
        >
          <span class="i-mdi-phone text-5.5" />
          {{ t('safety.sos.call') }}
        </button>
      </section>

      <!-- Отправить маршрут -->
      <section class="mt-4 rounded-3xl app-card p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
            <span class="i-mdi-map-marker-path text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              {{ t('safety.route.title') }}
            </h2>
            <p class="text-xs app-muted font-700">
              {{ t('safety.route.subtitle') }}
            </p>
          </div>
        </div>

        <button
          :disabled="!canShareRoute"
          class="mt-4 h-13 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-50"
          type="button"
          @click="shareRoute"
        >
          <span class="i-mdi-share-variant text-5" />
          {{ t('safety.route.share') }}
        </button>

        <p v-if="!canShareRoute" class="mt-3 text-xs app-faint leading-4">
          {{ t('safety.route.inactive') }}
        </p>
        <p v-else-if="trips.hasActiveTrip" class="mt-3 text-xs app-faint leading-4">
          {{ t('safety.route.activeNote') }}
        </p>
      </section>

      <!-- Проверенные водители -->
      <section class="mt-4 rounded-3xl app-card p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
            <span class="i-mdi-shield-check text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              {{ t('safety.verified.title') }}
            </h2>
            <p class="text-xs app-muted font-700">
              {{ t('safety.verified.subtitle') }}
            </p>
          </div>
        </div>

        <ul class="mt-4 space-y-3">
          <li v-for="check in safetyChecks" :key="check.icon" class="flex items-start gap-3">
            <span :class="check.icon" class="mt-0.5 shrink-0 text-5 text-emerald-300/80" />
            <p class="text-sm text-slate-300 leading-5 light:text-slate-600">
              {{ check.text }}
            </p>
          </li>
        </ul>
      </section>

      <!-- Что-то пошло не так -->
      <RouterLink
        class="mt-4 flex items-center gap-4 rounded-3xl app-card px-4 py-4 transition active:scale-[0.98]"
        to="/menu/support"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
          <span class="i-mdi-headset text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-base font-900">
            {{ t('safety.help.title') }}
          </span>
          <span class="mt-0.5 block text-xs app-muted font-600">
            {{ t('safety.help.text') }}
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 app-faint" />
      </RouterLink>
    </section>
  </main>
</template>
