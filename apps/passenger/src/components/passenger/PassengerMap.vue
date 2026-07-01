<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { PassengerDriverLocation } from '~/types/websocket'
import { useTripsStore } from '~/stores/trips'

withDefaults(defineProps<{
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
  selectFavorite: [place: GeoPlace]
}>()

const trips = useTripsStore()

function handleConfirmPicker(place: GeoPlace, mode: MapPickerMode) {
  emit('confirmPicker', place, mode)
}
</script>

<template>
  <MapView
    :destination-place="destinationPlace"
    :driver-location="driverLocation"
    :favorite-places="favoritePlaces"
    :picker-mode="pickerMode"
    :pickup-place="pickupPlace"
    :route-coordinates="trips.routeCoordinates"
    :show-route="showRoute"
    :user-coordinates="userCoordinates"
    @cancel-picker="emit('cancelPicker')"
    @confirm-picker="handleConfirmPicker"
    @select-favorite="emit('selectFavorite', $event)"
  />
</template>
