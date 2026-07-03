<script setup lang="ts">
import type { VerificationReminder } from '~/types/driver'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { ApiError } from '~/api/client'
import { getVerificationReminder } from '~/api/driver'
import { getUserErrorMessage } from '~/api/errors'
import DriverStatusPanel from '~/components/driver/DriverStatusPanel.vue'
import RatePassengerModal from '~/components/driver/RatePassengerModal.vue'
import VerificationReminderBanner from '~/components/driver/VerificationReminderBanner.vue'
import { useDriverTrackingSocket } from '~/composables/driver/useDriverTrackingSocket'
import { useOfferRoute } from '~/composables/driver/useOfferRoute'
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
const { isRouteLoading, mapOffer, routeCoordinates } = useOfferRoute(liveCoordinates)

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
// When approaching pickup: hide destination so fitBounds doesn't zoom too far out
const pickupPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'pickup'),
)
const destinationPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'dropoff'),
)
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
    <VerificationReminderBanner
      v-if="verificationReminder"
      :pending-label="reminderPendingLabel"
      @dismiss="verificationReminder = null"
    />

    <DriverStatusPanel
      :online-block-message="onlineBlockMessage"
      :show-route-loading="Boolean(mapOffer && isRouteLoading)"
      :tracking-label="trackingLabel"
      @primary-action="handlePrimaryTripAction"
      @toggle-online="toggleOnline"
    />

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
