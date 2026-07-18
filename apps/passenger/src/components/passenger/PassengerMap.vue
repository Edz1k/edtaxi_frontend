<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { PassengerDriverLocation } from '~/types/websocket'
import { useTripsStore } from '~/stores/trips'

const props = withDefaults(defineProps<{
  destinationPlace?: GeoPlace | null
  driverLocation?: PassengerDriverLocation | null
  favoritePlaces?: GeoPlace[]
  pickerMode?: MapPickerMode | null
  pickupPlace?: GeoPlace | null
  showRoute?: boolean
  userCoordinates?: UserCoordinates | null
}>(), {
  destinationPlace: null,
  driverLocation: null,
  favoritePlaces: () => [],
  pickerMode: null,
  pickupPlace: null,
  showRoute: false,
  userCoordinates: null,
})

const emit = defineEmits<{
  cancelPicker: []
  confirmPicker: [place: GeoPlace, mode: MapPickerMode]
  // Карта отрисована — пробрасываем наверх, стартовый экран ждёт этого сигнала.
  ready: []
  selectFavorite: [place: GeoPlace]
}>()

const trips = useTripsStore()

// Класс машины поездки — от него зависит иконка на карте (эконом/бизнес/мото...).
const driverCategory = computed(() =>
  trips.activeTrip?.driver?.vehicle?.category ?? trips.activeTrip?.category ?? null,
)

// Позиция машины: live-координаты из WebSocket, а до первого пинга — последняя
// известная позиция из пейлоада поездки, чтобы машина была видна сразу.
const liveDriverLocation = computed(() => {
  if (props.driverLocation)
    return props.driverLocation

  const status = trips.activeTrip?.status
  const isLive = status === 'driver_assigned' || status === 'driver_arriving' || status === 'in_progress'
  const location = trips.activeTrip?.driver?.location
  if (!isLive || !location)
    return null

  return { lat: location.lat, lng: location.lng }
})

// Остановки на карте: до заказа — подтверждённый черновик из стора, во время
// активной поездки — стопы самой поездки (серверная правда).
const stopPlaces = computed<GeoPlace[]>(() => {
  const tripStops = trips.activeTrip?.stops
  if (tripStops?.length) {
    return tripStops.map(stop => ({
      address: stop.address,
      id: `trip-stop:${stop.lat}:${stop.lng}`,
      lat: stop.lat,
      lng: stop.lng,
      name: stop.address,
    }))
  }

  return trips.stops.filter((place): place is GeoPlace => Boolean(place))
})

function handleConfirmPicker(place: GeoPlace, mode: MapPickerMode) {
  emit('confirmPicker', place, mode)
}
</script>

<template>
  <MapView
    :destination-place="destinationPlace"
    :driver-category="driverCategory"
    :driver-location="liveDriverLocation"
    :favorite-places="favoritePlaces"
    :picker-mode="pickerMode"
    :pickup-place="pickupPlace"
    :route-coordinates="trips.routeCoordinates"
    :show-route="showRoute"
    :stop-places="stopPlaces"
    :user-coordinates="userCoordinates"
    @cancel-picker="emit('cancelPicker')"
    @confirm-picker="handleConfirmPicker"
    @ready="emit('ready')"
    @select-favorite="emit('selectFavorite', $event)"
  />
</template>
