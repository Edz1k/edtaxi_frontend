<script setup lang="ts">
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { VerificationReminder } from '~/types/driver'
import type { DriverTripOffer } from '~/types/websocket'
import { useThrottleFn } from '@vueuse/core'
import { getDrivingRoute } from '@edtaxi/shared/api/geocoding'
import { ApiError } from '~/api/client'
import { getVerificationReminder } from '~/api/driver'
import { getUserErrorMessage } from '~/api/errors'
import RatePassengerModal from '~/components/driver/RatePassengerModal.vue'
import { useDriverTrackingSocket } from '~/composables/driver/useDriverTrackingSocket'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { offerToPlace } from '~/utils/geoPlace'

const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()
const tracking = useDriverTrackingSocket()
const {
  liveCoordinates,
  startWatchingUserLocation,
} = useUserLocation()
const routeCoordinates = ref<RouteCoordinate[]>([])
const isRouteLoading = ref(false)
let routeVersion = 0

// Ненавязчивое напоминание пройти верификацию — бэкенд сам решает, показывать
// ли его (не чаще 1 раза в 24 часа).
const verificationReminder = ref<VerificationReminder | null>(null)
const REMINDER_LABELS: Record<string, string> = {
  face: 'фото лица',
  vehicle: 'документы машины',
}
const reminderPendingLabel = computed(() =>
  (verificationReminder.value?.pending ?? []).map(item => REMINDER_LABELS[item] ?? item).join(', '),
)

// Причина отказа в выходе на линию (403 от POST /driver/status) — показываем
// панель с текстом и переходом к верификации.
const onlineBlockMessage = ref('')

// После завершения поездки предлагаем оценить пассажира.
const ratePassengerTripId = ref('')

const trackingLabel = computed(() => {
  if (tracking.status.value === 'open')
    return 'Подключен'

  if (tracking.status.value === 'connecting')
    return 'Подключаемся'

  return 'Отключен'
})
const mapOffer = computed(() => driver.activeOffer || driver.pendingOffer)

// When approaching pickup: hide destination so fitBounds doesn't zoom too far out
const pickupPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'pickup'),
)
const destinationPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'dropoff'),
)
const tripStep = computed(() => {
  if (!driver.hasActiveTrip)
    return null

  if (driver.activeTripStep === 'to_pickup') {
    return {
      action: 'Я на месте',
      description: 'Подъезжайте к точке посадки и отметьте прибытие.',
      icon: 'i-mdi-map-marker-check',
      title: 'Едем к пассажиру',
    }
  }

  if (driver.activeTripStep === 'arrived') {
    return {
      action: 'Начать поездку',
      description: 'Пассажир сел в автомобиль. После нажатия начнется поездка.',
      icon: 'i-mdi-play-circle',
      title: 'Ожидаем посадку',
    }
  }

  return {
    action: 'Завершить поездку',
    description: 'Доставьте пассажира до точки назначения и завершите заказ.',
    icon: 'i-mdi-flag-checkered',
    title: 'Поездка идет',
  }
})

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Водитель | EdTaxi',
})

watch(
  () => [driver.isOnline, driver.hasActiveTrip] as const,
  ([isOnline, hasActiveTrip]) => {
    if (isOnline || hasActiveTrip)
      tracking.connect()
    else
      tracking.close()
  },
)

onMounted(async () => {
  await driver.restoreActiveTrip().catch(() => {})
  // Подтягиваем уже добавленную машину, чтобы водитель не добавлял её заново.
  onboarding.loadVehicles().catch(() => {})
  checkVerificationReminder()
  startWatchingUserLocation()

  if (driver.isOnline || driver.hasActiveTrip)
    tracking.connect()
})

async function checkVerificationReminder() {
  try {
    const reminder = await getVerificationReminder()
    if (reminder.should_remind && reminder.pending.length)
      verificationReminder.value = reminder
  }
  catch {
    // напоминание некритично — молча пропускаем
  }
}

function coordsToPlace(lat: number, lng: number): GeoPlace {
  return { address: '', id: 'self', lat, lng, name: '' }
}

async function resolveOfferRoute(offer: DriverTripOffer | null) {
  const version = ++routeVersion
  routeCoordinates.value = []

  if (!offer) {
    isRouteLoading.value = false
    return
  }

  // Approaching pickup: route from driver's current position to pickup
  if (driver.activeTripStep === 'to_pickup' && liveCoordinates.value) {
    const pickup = offerToPlace(offer, 'pickup')
    if (!pickup)
      return

    isRouteLoading.value = true
    try {
      const from = coordsToPlace(liveCoordinates.value.lat, liveCoordinates.value.lng)
      const route = await getDrivingRoute(from, pickup)
      if (version !== routeVersion)
        return
      routeCoordinates.value = route.geometry
    }
    catch {
      if (version !== routeVersion)
        return
      routeCoordinates.value = [
        [liveCoordinates.value.lng, liveCoordinates.value.lat],
        [pickup.lng, pickup.lat],
      ]
    }
    finally {
      if (version === routeVersion)
        isRouteLoading.value = false
    }
    return
  }

  // Active trip or pending offer: full pickup → dropoff route
  const pickup = offerToPlace(offer, 'pickup')
  const destination = offerToPlace(offer, 'dropoff')
  if (!pickup || !destination)
    return

  isRouteLoading.value = true
  try {
    const route = await getDrivingRoute(pickup, destination)
    if (version !== routeVersion)
      return
    routeCoordinates.value = route.geometry
  }
  catch {
    if (version !== routeVersion)
      return
    routeCoordinates.value = [
      [pickup.lng, pickup.lat],
      [destination.lng, destination.lat],
    ]
  }
  finally {
    if (version === routeVersion)
      isRouteLoading.value = false
  }
}

// Rebuild approach route as driver moves, throttled to avoid API spam
const throttledApproachRebuild = useThrottleFn(() => {
  if (driver.activeTripStep === 'to_pickup')
    resolveOfferRoute(mapOffer.value)
}, 15_000)

async function handlePrimaryTripAction() {
  if (driver.activeTripStep === 'to_pickup') {
    await driver.markArrived()
    return
  }

  if (driver.activeTripStep === 'arrived') {
    await driver.startTrip()
    return
  }

  const completedTripId = driver.currentTripId
  await driver.completeTrip()
  ratePassengerTripId.value = completedTripId
}

async function toggleOnline() {
  const nextOnline = !driver.isOnline

  try {
    await driver.setOnline(nextOnline)
    onlineBlockMessage.value = ''
  }
  catch (error) {
    // 403 — не пройдена верификация (лицо/машина): показываем причину с бэка
    // и предлагаем перейти к верификации.
    if (nextOnline && error instanceof ApiError && error.status === 403)
      onlineBlockMessage.value = getUserErrorMessage(error, 'Выход на линию сейчас недоступен.')
    return
  }

  if (nextOnline)
    tracking.connect()
  else if (!driver.hasActiveTrip)
    tracking.close()
}

// Rebuild when offer or trip step changes — single watch prevents double API call
// when both change synchronously in the same store action (e.g. acceptOffer)
watch(
  [mapOffer, () => driver.activeTripStep],
  ([offer]) => resolveOfferRoute(offer),
  { immediate: true },
)

// Update approach route as driver moves
watch(liveCoordinates, () => throttledApproachRebuild())
</script>

<template>
  <main class="tg-viewport-screen relative overflow-hidden bg-secondary-900 text-white">
    <DriverMap
      :destination-place="destinationPlace"
      :pickup-place="pickupPlace"
      :route-coordinates="routeCoordinates"
      :user-coordinates="liveCoordinates"
    />

    <!-- Напоминание о незавершённой верификации -->
    <section v-if="verificationReminder" class="tg-safe-x absolute inset-x-0 top-[calc(var(--app-safe-area-top)+0.75rem)] z-30">
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
              Осталось завершить: {{ reminderPendingLabel }}.
            </p>
          </div>
          <button
            aria-label="Скрыть напоминание"
            class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-400"
            type="button"
            @click="verificationReminder = null"
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

    <section class="tg-safe-x absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-20">
      <div class="mx-auto max-w-sm overflow-hidden rounded-[2rem] bg-secondary-950/82 px-4 pb-4 pt-3 shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
        <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-white/12" />

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-2xl bg-white/7 px-3 py-3">
            <p class="text-xs text-slate-400 font-800">
              Доступность
            </p>
            <p class="mt-1 truncate text-sm font-950">
              {{ driver.isAvailable ? 'Готов к заказу' : 'Недоступен' }}
            </p>
          </div>

          <div class="rounded-2xl bg-white/7 px-3 py-3">
            <p class="text-xs text-slate-400 font-800">
              WebSocket
            </p>
            <p class="mt-1 truncate text-sm font-950">
              {{ trackingLabel }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-3">
          <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/16 text-main-200">
            <span class="i-mdi-map-marker-path text-7" />
          </div>

          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-950">
              {{ tripStep?.title || 'Ожидание заказа' }}
            </h2>
            <p class="mt-1 truncate text-sm text-slate-400">
              {{ tripStep?.description || 'Активной поездки нет' }}
            </p>
          </div>
        </div>

        <div v-if="driver.hasActiveTrip && tripStep" class="mt-4 space-y-2">
          <button
            class="h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.99]"
            type="button"
            @click="handlePrimaryTripAction"
          >
            <span :class="tripStep.icon" class="text-6" />
            {{ tripStep.action }}
          </button>

          <button
            class="h-12 w-full rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.99]"
            type="button"
            @click="driver.cancelTrip()"
          >
            Отменить заказ
          </button>
        </div>

        <button
          v-else
          :disabled="driver.isChangingStatus || driver.isRestoringActiveTrip"
          class="mt-4 h-14 w-full rounded-2xl text-base font-900 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          :class="driver.isOnline ? 'bg-red-500/12 text-red-300' : 'bg-main-500 text-white shadow-[0_12px_30px_rgba(230,173,46,0.28)]'"
          type="button"
          @click="toggleOnline"
        >
          {{ driver.isRestoringActiveTrip ? 'Восстанавливаем...' : driver.isChangingStatus ? 'Обновляем...' : driver.isOnline ? 'Уйти офлайн' : 'Выйти онлайн' }}
        </button>

        <!-- Причина отказа в выходе на линию (403 с бэка) -->
        <div v-if="onlineBlockMessage && !driver.isOnline" class="mt-3 rounded-2xl bg-amber-500/12 px-4 py-3">
          <p class="text-sm text-amber-200 font-800">
            {{ onlineBlockMessage }}
          </p>
          <RouterLink
            class="mt-2.5 h-10 flex items-center justify-center rounded-xl bg-amber-400 text-sm text-#06142f font-900 transition active:scale-[0.98]"
            to="/menu/profile/onboarding"
          >
            Пройти верификацию
          </RouterLink>
        </div>

        <RouterLink
          v-if="!onboarding.hasVehicle"
          class="mt-3 h-12 flex items-center justify-center rounded-2xl bg-white/8 text-sm text-main-100 font-900"
          to="/menu/vehicle"
        >
          Добавить автомобиль
        </RouterLink>

        <p v-if="mapOffer && isRouteLoading" class="mt-3 text-center text-xs text-slate-400 font-800">
          Строим маршрут заказа...
        </p>
      </div>
    </section>

    <DriverTripOffer
      v-if="driver.pendingOffer"
      :is-busy="driver.isMutatingOffer"
      :offer="driver.pendingOffer"
      @accept="driver.acceptOffer()"
      @reject="driver.rejectOffer()"
    />

    <RatePassengerModal
      v-if="ratePassengerTripId"
      :trip-id="ratePassengerTripId"
      @close="ratePassengerTripId = ''"
    />
  </main>
</template>
