<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { getBonusOverview, redeemReferralCode } from '@edtaxi/shared/api/bonus'
import ReferralWelcomeModal from '@edtaxi/shared/components/bonus/ReferralWelcomeModal.vue'
import LocationGate from '@edtaxi/shared/components/location/LocationGate.vue'
import MapStyleSwitcher from '@edtaxi/shared/components/map/MapStyleSwitcher.vue'
import WeatherBadge from '@edtaxi/shared/components/weather/WeatherBadge.vue'
import { useLocationAccess } from '@edtaxi/shared/composables/location/useLocationAccess'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { captureReferralStartParam, takePendingReferralCode } from '@edtaxi/shared/composables/telegram/referral'
import { hideAppSplash } from '@edtaxi/shared/composables/useAppSplash'
import { useUserCity } from '@edtaxi/shared/composables/useUserCity'
import { useWeather } from '@edtaxi/shared/composables/useWeather'
import { usePassengerTripSocket } from '~/composables/passenger/usePassengerTripSocket'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useAuthStore } from '~/stores/auth'
import { usePassengerStore } from '~/stores/passenger'
import { usePlacesStore } from '~/stores/places'
import { useTripsStore } from '~/stores/trips'

const auth = useAuthStore()
const passenger = usePassengerStore()
const trips = useTripsStore()
const places = usePlacesStore()
const { locale, t } = useI18n()

// Шторка заказа: касание карты приопускает её (collapseToMap), чтобы карту
// можно было рассмотреть и подвигать, не борясь со шторкой.
const downbarRef = ref<null | { collapseToMap: () => void }>(null)
const activeTripId = computed(() => trips.hasActiveTrip ? trips.activeTrip?.id ?? '' : '')
usePassengerTripSocket(activeTripId)

// Push-канал для сообщений чата поездки: бейдж «Чат с водителем» обновляется,
// пока пассажир смотрит на карту.
const notifications = useNotificationsSocket()
watch(activeTripId, (id) => {
  if (id)
    notifications.connect()
}, { immediate: true })

function selectFavoritePlace(place: GeoPlace) {
  trips.setDestinationPlace(place)
  // Раскрываем поиск адреса (2-й экран), чтобы выбранное было на виду.
  trips.requestExpandSearch()
}

const {
  isLocating,
  liveCoordinates,
  locateUser,
  startWatchingUserLocation,
} = useUserLocation()

// Плашка «г.Город · адрес» над картой: город резолвится по координатам на
// бэке (оффлайн-справочник, без 2ГИС), адрес — текущая точка подачи.
const { city } = useUserCity(liveCoordinates, auth.currentUser?.city ?? '')

// Погода в шапке (TODO п.5): бэк кэширует на город, виджет тихо прячется
// при недоступном провайдере.
const { weather } = useWeather(liveCoordinates)
const locationLine = computed(() => {
  const parts: string[] = []
  if (city.value)
    parts.push(t('map.city', { city: city.value }))
  if (trips.pickup)
    parts.push(trips.pickup)
  return parts.join(' · ')
})

definePage({
  meta: {
    authRedirect: '/login',
    // Стартовый экран снимаем не по mount, а когда карте есть что показать:
    // отрисовка + отработавший стартовый сценарий (см. ниже).
    holdSplash: true,
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

const isMapReady = ref(false)
const isBootDone = ref(false)
// Гео считаем полученным по факту координат, а не по завершению onMounted: при
// восстановленной поездке locateUser не вызывается вовсе, координаты приходят
// из startWatchingUserLocation.
const hasUserLocation = computed(() => Boolean(liveCoordinates.value))

const { isGranted: isLocationGranted, isRequesting: isRequestingLocation, status: locationStatus } = useLocationAccess()

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
// Раньше он снимался сразу после mount — отсюда и «мелькнул на миллисекунду»:
// mount происходит задолго до готовности карты.
watch([isMapReady, isBootDone, hasUserLocation, isBlockedByLocationGate], () => {
  if (isBlockedByLocationGate.value) {
    hideAppSplash()
    return
  }

  if (isMapReady.value && isBootDone.value && hasUserLocation.value)
    hideAppSplash()
}, { immediate: true })

// Бейдж бонусов в углу карты: пока баланс не загрузился (или упал) — не
// показываем, чтобы не рисовать пустышку поверх карты.
const bonusBalance = ref<null | number>(null)

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

onMounted(async () => {
  getBonusOverview()
    .then((bonus) => {
      bonusBalance.value = Math.floor(bonus.balance)
    })
    .catch(() => {})

  autoRedeemReferral().catch(() => {})

  try {
    try {
      await passenger.loadProfile()
    }
    catch {}

    if (!places.places.length)
      places.load().catch(() => {})

    const restoredTrip = await trips.restoreActiveTrip().catch(() => null)

    if (!restoredTrip) {
      // Черновик адресов с прошлого запуска — до геопозиции: иначе она успела
      // бы занять «Откуда», и восстанавливать стало бы нечего.
      trips.restoreRouteDraft()
      await setPickupFromCurrentLocation()
    }

    startWatchingUserLocation()
  }
  finally {
    // finally: что бы ни упало по пути, стартовый сценарий считаем отработавшим —
    // иначе сплэш висел бы до предохранителя.
    isBootDone.value = true
  }
})

// Геопозицию запрашиваем всегда — ею живут синяя точка на карте и центрирование.
// А вот подставлять её в «Откуда» можно, ТОЛЬКО если пользователь ещё ничего не
// выбрал сам.
//
// Иначе получался вот такой баг: <KeepAlive> в проекте нет, поэтому карта
// перемонтируется на каждом возврате с другой вкладки, и этот метод затирал
// выбранный адрес текущей геопозицией. Попутно setPickupPlace зовёт
// clearEstimate(), тот обнуляет routeCoordinates, tripFlowState падает в 'idle'
// — и даунбар показывал стартовый экран «Куда едем?». Со стороны выглядело так,
// будто слетели вообще все адреса, хотя «Куда» и остановки всё это время лежали
// в сторе целыми.
async function setPickupFromCurrentLocation() {
  try {
    const place = await locateUser()
    if (!trips.pickupPlace)
      trips.setPickupPlace(place)

    // Кружки-подсказки грузим вокруг места, где пассажир реально находится, —
    // именно там он будет ставить точку. Промах не критичен: без подсказок
    // карта работает ровно как раньше.
    trips.loadPickupHints(place.lat, place.lng)
  }
  catch {}
}
</script>

<template>
  <div class="tg-viewport-screen relative overflow-hidden app-screen">
    <LocationGate />

    <!-- Город и адрес текущей точки — аккуратной плашкой сверху карты,
         бонусный бейдж прижат к правому краю -->
    <div class="tg-safe-x pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-area-top)+0.75rem)] z-10">
      <div class="relative flex justify-center">
        <div
          v-if="locationLine"
          class="max-w-[68%] flex items-center gap-1.5 truncate rounded-full app-sheet px-4 py-2 text-xs text-white font-800 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <span class="i-mdi-map-marker inline-block shrink-0 align-middle text-3.5 app-accent" />
          <span class="truncate">{{ locationLine }}</span>
          <WeatherBadge :weather="weather" />
        </div>

        <RouterLink
          v-if="bonusBalance !== null"
          :aria-label="t('bonus.title')"
          class="pointer-events-auto absolute right-0 top-0 flex items-center gap-1 rounded-full app-sheet px-3 py-2 text-xs text-white font-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-95"
          to="/bonus"
        >
          <span class="i-mdi-star-four-points text-3.5 app-accent" />
          {{ bonusBalance.toLocaleString(locale) }}
        </RouterLink>

        <!-- Тема карты: схема / спутник / ночная -->
        <div class="absolute right-0 top-12">
          <MapStyleSwitcher />
        </div>
      </div>
    </div>

    <!-- Касание карты (палец/два) приопускает шторку — карту видно целиком -->
    <PassengerMap
      :destination-place="trips.destinationPlace"
      :driver-location="trips.driverLocation"
      :favorite-places="places.places"
      :picker-mode="trips.mapPickerMode"
      :pickup-place="trips.pickupPlace"
      :pickup-hints="trips.pickupHints"
      :show-route="trips.routeCoordinates.length >= 2"
      :user-coordinates="liveCoordinates"
      @cancel-picker="trips.cancelMapPicker"
      @confirm-picker="trips.confirmMapPicker"
      @pointerdown="downbarRef?.collapseToMap()"
      @ready="isMapReady = true"
      @select-favorite="selectFavoritePlace"
    />
    <Downbar
      v-if="!trips.isMapPickerActive"
      ref="downbarRef"
      v-model:destination="trips.destination"
      v-model:destination-place="trips.destinationPlace"
      v-model:locating-user="isLocating"
      v-model:pickup="trips.pickup"
      v-model:pickup-place="trips.pickupPlace"
      :user-coordinates="liveCoordinates"
      @locate-user="setPickupFromCurrentLocation"
      @pick-from-map="trips.startMapPicker"
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
  </div>
</template>
