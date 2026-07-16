<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

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

const emit = defineEmits<{
  // Карта отрисована — пробрасываем наверх, стартовый экран ждёт этого сигнала.
  ready: []
}>()

// Иконка своей машины по классу активного ТС (эконом/бизнес/мото...).
const onboarding = useDriverOnboardingStore()
const selfCategory = computed(() => {
  const active = onboarding.vehicles.find(v => v.is_active) ?? onboarding.vehicles[0]
  return active?.category ?? null
})
</script>

<template>
  <MapView
    :destination-place="destinationPlace"
    driver-view
    focus-user-on-first-fix
    :pickup-place="pickupPlace"
    :route-coordinates="routeCoordinates"
    :self-category="selfCategory"
    :show-route="routeCoordinates.length >= 2"
    :user-coordinates="userCoordinates"
    @ready="emit('ready')"
  />
</template>
