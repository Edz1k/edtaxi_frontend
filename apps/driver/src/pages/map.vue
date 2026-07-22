<script setup lang="ts">
import type { VerificationReminder } from '~/types/driver'
import { getBonusOverview, redeemReferralCode } from '@edtaxi/shared/api/bonus'
import ReferralWelcomeModal from '@edtaxi/shared/components/bonus/ReferralWelcomeModal.vue'
import LocationGate from '@edtaxi/shared/components/location/LocationGate.vue'
import MapStyleSwitcher from '@edtaxi/shared/components/map/MapStyleSwitcher.vue'
import WeatherBadge from '@edtaxi/shared/components/weather/WeatherBadge.vue'
import { useLocationAccess } from '@edtaxi/shared/composables/location/useLocationAccess'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { captureParkInviteStartParam, takePendingParkInviteToken } from '@edtaxi/shared/composables/telegram/parkInvite'
import { captureReferralStartParam, takePendingReferralCode } from '@edtaxi/shared/composables/telegram/referral'
import { hideAppSplash } from '@edtaxi/shared/composables/useAppSplash'
import { useUserCity } from '@edtaxi/shared/composables/useUserCity'
import { useWeather } from '@edtaxi/shared/composables/useWeather'
import { useNow } from '@vueuse/core'
import { ApiError } from '~/api/client'
import { getDriverOverview, getVerificationReminder } from '~/api/driver'
import { getUserErrorMessage } from '~/api/errors'
import { previewParkInvite, switchViaParkInvite } from '~/api/park'
import DriverStatusPanel from '~/components/driver/DriverStatusPanel.vue'
import HomeModeSheet from '~/components/driver/HomeModeSheet.vue'
import RatePassengerModal from '~/components/driver/RatePassengerModal.vue'
import VerificationReminderBanner from '~/components/driver/VerificationReminderBanner.vue'
import { useDriverTrackingSocket } from '~/composables/driver/useDriverTrackingSocket'
import { useOfferRoute } from '~/composables/driver/useOfferRoute'
import { useOrderSound } from '~/composables/driver/useOrderSound'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { isDailyCheckValid } from '~/utils/dailyCheck'
import { offerToPlace } from '~/utils/geoPlace'
import { onlineBlockTargetFor } from '~/utils/onlineBlock'

const driver = useDriverStore()
const toast = useToast()

// Куда просят заехать. В заявке лежит ПОЛНЫЙ новый маршрут, а добавленная
// точка всегда последняя: пассажир дописывает остановку в конец, чтобы не
// сдвинуть уже пройденные (их прогресс у нас — индекс, а не идентификатор).
const requestedStopAddress = computed(() => {
  const stops = driver.pendingRouteChange?.stops ?? []
  return stops.at(-1)?.address ?? 'Новая точка на карте'
})

// Режим «Домой» (TODO п.7): шит выбора адреса/выключения + пилюля-статус.
const isHomeSheetOpen = ref(false)
const homeUntilLabel = computed(() => {
  const until = driver.homeMode?.until
  if (!driver.isHomeModeActive || !until)
    return ''
  return new Date(until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

// Панель-шторка: касание карты приопускает её (collapseToMap).
const statusPanelRef = ref<null | { collapseToMap: () => void }>(null)
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
const { isGranted: isLocationGranted, isRequesting: isRequestingLocation, status: locationStatus } = useLocationAccess()
const {
  liveCoordinates,
  startWatchingUserLocation,
} = useUserLocation()

// Город водителя — плашкой сверху карты; резолвится по координатам на бэке
// (оффлайн-справочник, без 2ГИС) и сохраняется в профиле для статистики.
const { city } = useUserCity(liveCoordinates)

// Погода в шапке (TODO п.5): бэк кэширует на город, виджет тихо прячется
// при недоступном провайдере.
const { weather } = useWeather(liveCoordinates)
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
// панель с текстом и переходом на нужный экран.
const onlineBlockMessage = ref('')
const onlineBlockTarget = ref<'daily-check' | 'park' | 'verification'>('verification')

// Самоистечение фотоконтроля (п.45). Сервер снимает водителя с линии фоновым
// проходом, но приложение об этом не узнаёт: is_online обновляется только из
// ответа на собственное нажатие, статус водитель не переспрашивает, а
// WS-события смены статуса нет. Без локального тикера кнопка осталась бы в
// положении «Уйти с линии», сокет продолжил бы слать локацию, а тишину в
// офферах водитель прочитал бы как «нет заказов».
const now = useNow({ interval: 15_000 })
const isDailyCheckActive = computed(() =>
  isDailyCheckValid(onboarding.verification, now.value.getTime()),
)

watch(isDailyCheckActive, (active, wasActive) => {
  // Реагируем только на переход «действовала → истекла»: при первой загрузке
  // wasActive === undefined, и гасить там нечего.
  if (active || wasActive !== true)
    return

  onlineBlockMessage.value = 'Срок фотоконтроля истёк — вы сняты с линии. Пройдите проверку заново.'
  onlineBlockTarget.value = 'daily-check'

  if (!driver.isOnline)
    return

  driver.applyStatus({ is_available: false, is_online: false })
  if (!driver.hasActiveTrip)
    tracking.close()
})

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

// Приглашение в парк по QR-диплинку (t.me/bot?startapp=park_<токен>): токен
// перехватывается на старте; сразу подтягиваем превью (название парка,
// вступление это или смена) и показываем подтверждение перед вступлением.
const parkInvitePrompt = ref<null | {
  token: string
  parkName: string
  currentParkName: string
  isSwitch: boolean
}>(null)
const isAcceptingInvite = ref(false)

async function autoHandleParkInvite() {
  captureParkInviteStartParam()
  const token = takePendingParkInviteToken()
  if (!token)
    return

  try {
    const preview = await previewParkInvite(token)
    if (preview.already_member) {
      // Тот же парк — вступать некуда, просто молча выходим.
      return
    }
    parkInvitePrompt.value = {
      token,
      parkName: preview.park_name,
      currentParkName: preview.current_park_name,
      isSwitch: preview.is_switch,
    }
  }
  catch {
    // Токен просрочен/недействителен — молча пропускаем.
  }
}

async function confirmParkInvite() {
  const prompt = parkInvitePrompt.value
  if (!prompt)
    return
  isAcceptingInvite.value = true
  try {
    await switchViaParkInvite({ token: prompt.token })
    toast.success('Готово', prompt.isSwitch
      ? `Вы перешли в таксопарк «${prompt.parkName}».`
      : `Вы присоединились к таксопарку «${prompt.parkName}».`)
    parkInvitePrompt.value = null
    // Обновляем профиль/членство, чтобы статус линии подтянулся сразу.
    driver.ensureProfile().catch(() => {})
    getDriverOverview().catch(() => {})
  }
  catch (error) {
    toast.error('Не удалось', getUserErrorMessage(error, 'Попробуйте ещё раз позже.'))
  }
  finally {
    isAcceptingInvite.value = false
  }
}

// When approaching pickup: hide destination so fitBounds doesn't zoom too far out
const pickupPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'pickup'),
)
const destinationPlace = computed(() =>
  driver.activeTripStep === 'to_pickup' ? null : offerToPlace(mapOffer.value, 'dropoff'),
)

// Подсветка выбранных районов приёма заказов на карте: только активные и только
// с полигоном (у «Весь город» список пуст → заливки нет).
const activeDistrictShapes = computed(() =>
  driver.availableDistricts
    .filter(d => d.polygon && driver.activeDistrictIds.includes(d.id))
    .map(d => ({ id: d.id, polygon: d.polygon })),
)

// Остановки заказа: нумерованные маркеры на карте (кроме этапа подъезда к
// пассажиру — там маршрут строится от машины до точки А).
const stopPlaces = computed(() => {
  if (driver.activeTripStep === 'to_pickup')
    return []

  return (mapOffer.value?.stops ?? []).map((stop, index) => ({
    address: stop.address,
    id: `offer-stop-${index}`,
    lat: stop.lat,
    lng: stop.lng,
    name: stop.address,
  }))
})
definePage({
  meta: {
    authRedirect: '/login',
    // Стартовый экран снимаем не по mount, а когда карте есть что показать:
    // отрисовка + координаты (см. ниже).
    holdSplash: true,
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

const isMapReady = ref(false)
const isBootDone = ref(false)
// Гео считаем полученным по факту координат: onMounted их не ждёт — только
// запускает startWatchingUserLocation, координаты приходят позже.
const hasUserLocation = computed(() => Boolean(liveCoordinates.value))

// Сплэш ждёт, пока приложение ГРУЗИТСЯ, но не пока оно ждёт решения человека.
// Гейт геолокации (LocationGate) — блокирующий экран поверх карты; пока он
// висит, координат не будет никогда, и держать сплэш бессмысленно: он просто
// накрывает собой вопрос, на который надо ответить.
//   isGranted        — доступ есть, ждём координаты;
//   'unknown'        — проверка ещё не начиналась, ждём;
//   isRequesting     — промпт открыт (он поверх вебвью), ждём ответа;
//   иначе            — запрос завершился без доступа: гейт ждёт нажатия, уходим.
const isWaitingForLocation = computed(() =>
  locationStatus.value === 'unknown' || isRequestingLocation.value,
)
const isBlockedByLocationGate = computed(() =>
  !isLocationGranted.value && !isWaitingForLocation.value,
)

// Сплэш уходит, когда карта отрисована, отработал стартовый сценарий и пришли
// координаты — либо когда ждать больше нечего и нужен ответ пользователя.
watch([isMapReady, isBootDone, hasUserLocation, isBlockedByLocationGate], () => {
  if (isBlockedByLocationGate.value) {
    hideAppSplash()
    return
  }

  if (isMapReady.value && isBootDone.value && hasUserLocation.value)
    hideAppSplash()
}, { immediate: true })

useHead({
  title: 'Водитель | Telegram Taxi',
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
  autoHandleParkInvite().catch(() => {})

  try {
    await driver.restoreActiveTrip().catch(() => {})
    // ensureProfile сам подтягивает доступные/активные тарифы (available/active
    // categories) — нужны панели статуса, даже если водитель зашёл сразу на карту.
    driver.ensureProfile().catch(() => {})
    // Подтягиваем уже добавленную машину, чтобы водитель не добавлял её заново.
    onboarding.loadVehicles().catch(() => {})
    // Верификация нужна на карте ради срока фотоконтроля: по нему приложение
    // само снимает водителя с линии, когда проверка истекает посреди смены.
    onboarding.loadVerification().catch(() => {})
    checkVerificationReminder()
    startWatchingUserLocation()

    if (driver.isOnline || driver.hasActiveTrip)
      tracking.connect()
  }
  finally {
    // finally: что бы ни упало по пути, стартовый сценарий считаем отработавшим —
    // иначе сплэш висел бы до предохранителя.
    isBootDone.value = true
  }
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
    onlineBlockTarget.value = 'verification'
    return
  }

  try {
    await driver.setOnline(nextOnline)
    onlineBlockMessage.value = ''
  }
  catch (error) {
    // 403 — не пройден один из гейтов (парк, лицо/машина, фотоконтроль):
    // показываем причину с бэка и ведём на экран, где её можно закрыть.
    if (nextOnline && error instanceof ApiError && error.status === 403) {
      onlineBlockMessage.value = getUserErrorMessage(error, 'Выход на линию сейчас недоступен.')
      onlineBlockTarget.value = onlineBlockTargetFor(onlineBlockMessage.value)
    }
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
          class="max-w-[68%] flex items-center gap-1.5 truncate rounded-full bg-secondary-950/82 px-4 py-2 text-xs text-white font-800 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <span class="i-mdi-map-marker inline-block shrink-0 align-middle text-3.5 text-main-300" />
          <span class="truncate">г. {{ city }}</span>
          <WeatherBadge :weather="weather" />
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

        <!-- Режим «Домой»: только заказы в сторону дома. Активен — янтарная
             пилюля с дедлайном, тап открывает шит (включить/выключить). -->
        <button
          v-if="!driver.hasActiveTrip"
          aria-label="Режим «Домой»"
          class="pointer-events-auto absolute right-0 top-24 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-95"
          :class="driver.isHomeModeActive ? 'bg-amber-400 text-slate-900' : 'bg-secondary-950/82 text-white'"
          type="button"
          @click="isHomeSheetOpen = true"
        >
          <span class="i-mdi-home text-4" aria-hidden="true" />
          <span v-if="driver.isHomeModeActive">до {{ homeUntilLabel }}</span>
          <span v-else>Домой</span>
        </button>
      </div>
    </div>

    <!-- Касание карты приопускает панель — карту видно целиком -->
    <DriverMap
      :active-districts="activeDistrictShapes"
      :destination-place="destinationPlace"
      :pickup-place="pickupPlace"
      :route-coordinates="routeCoordinates"
      :stop-places="stopPlaces"
      :user-coordinates="liveCoordinates"
      @pointerdown="statusPanelRef?.collapseToMap()"
      @ready="isMapReady = true"
    />

    <!-- Напоминание о незавершённой верификации -->
    <VerificationReminderBanner
      v-if="verificationReminder"
      :pending-label="reminderPendingLabel"
      @dismiss="verificationReminder = null"
    />

    <DriverStatusPanel
      ref="statusPanelRef"
      :driver-coordinates="liveCoordinates"
      :is-location-granted="isLocationGranted"
      :online-block-message="onlineBlockMessage"
      :online-block-target="onlineBlockTarget"
      :show-route-loading="Boolean(mapOffer && isRouteLoading)"
      :tracking-status="tracking.status.value"
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

    <!-- Пассажир просит заехать по пути. Показываем только когда нет оффера
         нового заказа: две модалки друг на друге — и водитель нажмёт не ту. -->
    <DriverStopRequest
      v-if="driver.pendingRouteChange && !driver.pendingOffer"
      :is-busy="driver.isAnsweringRouteChange"
      :request="driver.pendingRouteChange"
      :stop-address="requestedStopAddress"
      @accept="driver.acceptRouteChange().catch(() => {})"
      @reject="driver.rejectRouteChange().catch(() => {})"
    />

    <HomeModeSheet
      v-if="isHomeSheetOpen"
      :user-coordinates="liveCoordinates"
      @close="isHomeSheetOpen = false"
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

    <!-- Подтверждение приглашения в парк по QR: вступить или сменить парк -->
    <Teleport to="body">
      <div
        v-if="parkInvitePrompt"
        class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="parkInvitePrompt = null"
      >
        <div class="max-w-sm w-full border border-white/10 rounded-3xl bg-secondary-900 p-5 shadow-2xl">
          <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-main-500/14 text-main-300">
            <span class="text-7" :class="parkInvitePrompt.isSwitch ? 'i-mdi-swap-horizontal' : 'i-mdi-account-plus'" />
          </span>
          <h3 class="mt-4 text-lg font-950">
            {{ parkInvitePrompt.isSwitch ? 'Сменить таксопарк?' : 'Присоединиться к таксопарку?' }}
          </h3>
          <p class="mt-2 text-sm text-slate-400 leading-5">
            <template v-if="parkInvitePrompt.isSwitch">
              Перейти из парка «{{ parkInvitePrompt.currentParkName || 'текущего' }}» в
              «{{ parkInvitePrompt.parkName }}»? Вы сразу станете водителем нового парка.
            </template>
            <template v-else>
              Вступить в таксопарк «{{ parkInvitePrompt.parkName }}»? После этого можно выходить на линию.
            </template>
          </p>

          <div class="mt-5 flex gap-2">
            <button
              class="h-12 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
              type="button"
              @click="parkInvitePrompt = null"
            >
              Нет
            </button>
            <button
              :disabled="isAcceptingInvite"
              class="h-12 flex-1 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="confirmParkInvite"
            >
              {{ isAcceptingInvite ? 'Секунду...' : (parkInvitePrompt.isSwitch ? 'Да, сменить' : 'Да, вступить') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
