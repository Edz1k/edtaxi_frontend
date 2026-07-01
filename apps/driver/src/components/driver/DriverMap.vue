<script setup lang="ts">
import type { UserCoordinates } from '~/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'

withDefaults(defineProps<{
  destinationPlace?: GeoPlace | null
  pickupPlace?: GeoPlace | null
  routeCoordinates?: RouteCoordinate[]
  userCoordinates?: UserCoordinates | null
}>(), {
  destinationPlace: null,
  pickupPlace: null,
  routeCoordinates: () => [],
  userCoordinates: null,
})
</script>

<template>
  <MapView
    :destination-place="destinationPlace"
    driver-view
    focus-user-on-first-fix
    :pickup-place="pickupPlace"
    :route-coordinates="routeCoordinates"
    :show-route="routeCoordinates.length >= 2"
    :user-coordinates="userCoordinates"
  />
</template>
