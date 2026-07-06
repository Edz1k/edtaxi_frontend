<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { getBonusOverview } from '@edtaxi/shared/api/bonus'
import LocationGate from '@edtaxi/shared/components/location/LocationGate.vue'
import MapStyleSwitcher from '@edtaxi/shared/components/map/MapStyleSwitcher.vue'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { useUserCity } from '@edtaxi/shared/composables/useUserCity'
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
const locationLine = computed(() => {
  const parts: string[] = []
  if (city.value)
    parts.push(`г. ${city.value}`)
  if (trips.pickup)
    parts.push(trips.pickup)
  return parts.join(' · ')
})

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

// Бейдж бонусов в углу карты: пока баланс не загрузился (или упал) — не
// показываем, чтобы не рисовать пустышку поверх карты.
const bonusBalance = ref<null | number>(null)

onMounted(async () => {
  getBonusOverview()
    .then((bonus) => {
      bonusBalance.value = Math.floor(bonus.balance)
    })
    .catch(() => {})

  try {
    await passenger.loadProfile()
  }
  catch {}

  if (!places.places.length)
    places.load().catch(() => {})

  const restoredTrip = await trips.restoreActiveTrip().catch(() => null)

  if (!restoredTrip)
    await setPickupFromCurrentLocation()

  startWatchingUserLocation()
})

async function setPickupFromCurrentLocation() {
  try {
    const place = await locateUser()
    trips.setPickupPlace(place)
  }
  catch {}
}
</script>

<template>
  <div class="tg-viewport-screen relative overflow-hidden bg-secondary-900">
    <LocationGate />

    <!-- Город и адрес текущей точки — аккуратной плашкой сверху карты,
         бонусный бейдж прижат к правому краю -->
    <div class="tg-safe-x pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-area-top)+0.75rem)] z-10">
      <div class="relative flex justify-center">
        <div
          v-if="locationLine"
          class="max-w-[68%] truncate rounded-full bg-secondary-950/82 px-4 py-2 text-xs text-white font-800 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <span class="i-mdi-map-marker mr-1 inline-block align-middle text-3.5 text-main-300" />
          {{ locationLine }}
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

    <PassengerMap
      :destination-place="trips.destinationPlace"
      :driver-location="trips.driverLocation"
      :favorite-places="places.places"
      :picker-mode="trips.mapPickerMode"
      :pickup-place="trips.pickupPlace"
      :show-route="trips.routeCoordinates.length >= 2"
      :user-coordinates="liveCoordinates"
      @cancel-picker="trips.cancelMapPicker"
      @confirm-picker="trips.confirmMapPicker"
      @select-favorite="selectFavoritePlace"
    />
    <Downbar
      v-if="!trips.isMapPickerActive"
      v-model:destination="trips.destination"
      v-model:destination-place="trips.destinationPlace"
      v-model:locating-user="isLocating"
      v-model:pickup="trips.pickup"
      v-model:pickup-place="trips.pickupPlace"
      @locate-user="setPickupFromCurrentLocation"
      @pick-from-map="trips.startMapPicker"
    />
  </div>
</template>
