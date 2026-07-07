<script setup lang="ts">
import type { VerificationReminder } from '~/types/driver'
import { getBonusOverview, redeemReferralCode } from '@edtaxi/shared/api/bonus'
import ReferralWelcomeModal from '@edtaxi/shared/components/bonus/ReferralWelcomeModal.vue'
import LocationGate from '@edtaxi/shared/components/location/LocationGate.vue'
import MapStyleSwitcher from '@edtaxi/shared/components/map/MapStyleSwitcher.vue'
import { useLocationAccess } from '@edtaxi/shared/composables/location/useLocationAccess'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { captureReferralStartParam, takePendingReferralCode } from '@edtaxi/shared/composables/telegram/referral'
import { useUserCity } from '@edtaxi/shared/composables/useUserCity'
import { ApiError } from '~/api/client'
import { getVerificationReminder } from '~/api/driver'
import { getUserErrorMessage } from '~/api/errors'
import DriverStatusPanel from '~/components/driver/DriverStatusPanel.vue'
import RatePassengerModal from '~/components/driver/RatePassengerModal.vue'
import VerificationReminderBanner from '~/components/driver/VerificationReminderBanner.vue'
import { useDriverTrackingSocket } from '~/composables/driver/useDriverTrackingSocket'
import { useOfferRoute } from '~/composables/driver/useOfferRoute'
import { useOrderSound } from '~/composables/driver/useOrderSound'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { offerToPlace } from '~/utils/geoPlace'

const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()
const tracking = useDriverTrackingSocket()

// Мелодия входящего заказа: играет, пока показывается оффер (управляется
// тумблером «Мелодия заказа» в личном кабинете).
useOrderSound()

// Push-канал для сообщений чата поездки: бейдж «Чат с пассажиром» обновляется,
// пока водитель смотрит на карту.
const notifications = useNotificationsSocket()
watch(() => driver.hasActiveTrip, (active) => {
  if (active)
    notifications.connect()
}, { immediate: true })
const { isGranted: isLocationGranted } = useLocationAccess()
const {
  liveCoordinates,
  startWatchingUserLocation,
} = useUserLocation()

// Город водителя — плашкой сверху карты; резолвится по координатам на бэке
// (оффлайн-справочник, без 2ГИС) и сохраняется в профиле для статистики.
const { city } = useUserCity(liveCoordinates)
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

// Бейдж бонусов в углу карты: пока баланс не загрузился (или упал) — не
// показываем, чтобы не рисовать пустышку поверх карты.
const bonusBalance = ref<null | number>(null)

// После завершения поездки предлагаем оценить пассажира.
const ratePassengerTripId = ref('')

// Автопогашение реферального кода из диплинка (t.me/bot?startapp=ref_КОД):
// код перехватывается на старте и гасится сразу после входа; при успехе
// показываем приветствие с именем друга и суммой. Ошибки (код уже погашен,
// свой код, лимит) — молча: бэкенд всё равно не даст начислить дважды.
const referralWelcome = ref<null | { inviterName: null | string, ownerReward: number, reward: number }>(null)
const router = useRouter()

async function autoRedeemReferral() {
  captureReferralStartParam()
  const code = takePendingReferralCode()
  if (!code)
    return

  try {
    const result = await redeemReferralCode(code)
    referralWelcome.value = {
      inviterName: result.inviter_name ?? null,
      ownerReward: result.owner_reward ?? 1000,
      reward: result.invitee_reward ?? 500,
    }
    getBonusOverview()
      .then((bonus) => {
        bonusBalance.value = Math.floor(bonus.balance)
      })
      .catch(() => {})
  }
  catch {}
}

async function goShareReferral() {
  referralWelcome.value = null
  await router.push('/bonus')
}

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
  getBonusOverview()
    .then((bonus) => {
      bonusBalance.value = Math.floor(bonus.balance)
    })
    .catch(() => {})
  autoRedeemReferral().catch(() => {})
  await driver.restoreActiveTrip().catch(() => {})
  // ensureProfile сам подтягивает доступные/активные тарифы (available/active
  // categories) — нужны панели статуса, даже если водитель зашёл сразу на карту.
  driver.ensureProfile().catch(() => {})
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

  // На линию нельзя без геолокации — без неё диспетчер не видит водителя.
  if (nextOnline && !isLocationGranted.value) {
    onlineBlockMessage.value = 'Включите геолокацию, чтобы выйти на линию.'
    return
  }

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
    <LocationGate />

    <!-- Город — аккуратной плашкой сверху карты, бонусный бейдж прижат к
         правому краю -->
    <div class="tg-safe-x pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-area-top)+0.75rem)] z-10">
      <div class="relative flex justify-center">
        <div
          v-if="city"
          class="max-w-[68%] truncate rounded-full bg-secondary-950/82 px-4 py-2 text-xs text-white font-800 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <span class="i-mdi-map-marker mr-1 inline-block align-middle text-3.5 text-main-300" />
          г. {{ city }}
        </div>

        <RouterLink
          v-if="bonusBalance !== null"
          aria-label="Бонусы"
          class="pointer-events-auto absolute right-0 top-0 flex items-center gap-1 rounded-full bg-secondary-950/82 px-3 py-2 text-xs text-white font-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-95"
          to="/bonus"
        >
          <span class="i-mdi-star-four-points text-3.5 text-main-300" />
          {{ bonusBalance.toLocaleString('ru-RU') }}
        </RouterLink>

        <!-- Тема карты: схема / спутник / ночная -->
        <div class="absolute right-0 top-12">
          <MapStyleSwitcher />
        </div>
      </div>
    </div>

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
      :is-location-granted="isLocationGranted"
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

    <!-- Приветствие приглашённого: бонусы за вход по ссылке друга начислены -->
    <ReferralWelcomeModal
      :inviter-name="referralWelcome?.inviterName ?? null"
      :open="Boolean(referralWelcome)"
      :owner-reward="referralWelcome?.ownerReward ?? 1000"
      :reward="referralWelcome?.reward ?? 500"
      @close="referralWelcome = null"
      @share="goShareReferral"
    />
  </main>
</template>
