<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import LocationGate from '@edtaxi/shared/components/location/LocationGate.vue'
import { useUserLocation } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import { usePassengerTripSocket } from '~/composables/passenger/usePassengerTripSocket'
import { usePassengerStore } from '~/stores/passenger'
import { usePlacesStore } from '~/stores/places'
import { useTripsStore } from '~/stores/trips'

const passenger = usePassengerStore()
const trips = useTripsStore()
const places = usePlacesStore()
const activeTripId = computed(() => trips.hasActiveTrip ? trips.activeTrip?.id ?? '' : '')
usePassengerTripSocket(activeTripId)

function selectFavoritePlace(place: GeoPlace) {
  trips.setDestinationPlace(place)
}

const {
  isLocating,
  liveCoordinates,
  locateUser,
  startWatchingUserLocation,
} = useUserLocation()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

onMounted(async () => {
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
