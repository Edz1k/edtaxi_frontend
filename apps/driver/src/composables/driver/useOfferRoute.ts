import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { Ref } from 'vue'
import type { DriverTripOffer } from '~/types/websocket'
import { getDrivingRoute } from '@edtaxi/shared/api/geocoding'
import { useThrottleFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useDriverStore } from '~/stores/driver'
import { offerToPlace } from '~/utils/geoPlace'

// Builds the map route line for the current offer / active trip. Approaching
// pickup it routes from the driver's live position; otherwise pickup → dropoff.
// Rebuilds are versioned (stale responses are dropped) and throttled so driver
// movement doesn't spam the routing API.
export function useOfferRoute(liveCoordinates: Ref<UserCoordinates | null>) {
  const driver = useDriverStore()
  const routeCoordinates = ref<RouteCoordinate[]>([])
  const isRouteLoading = ref(false)
  let routeVersion = 0

  const mapOffer = computed(() => driver.activeOffer || driver.pendingOffer)

  function coordsToPlace(lat: number, lng: number): GeoPlace {
    return { address: '', id: 'self', lat, lng, name: '' }
  }

  async function resolveOfferRoute(offer: DriverTripOffer | null) {
    const version = ++routeVersion
    routeCoordinates.value = []

    if (!offer) {
      isRouteLoading.value = false
      return
    }

    // Approaching pickup: route from driver's current position to pickup
    if (driver.activeTripStep === 'to_pickup' && liveCoordinates.value) {
      const pickup = offerToPlace(offer, 'pickup')
      if (!pickup)
        return

      isRouteLoading.value = true
      try {
        const from = coordsToPlace(liveCoordinates.value.lat, liveCoordinates.value.lng)
        const route = await getDrivingRoute(from, pickup)
        if (version !== routeVersion)
          return
        routeCoordinates.value = route.geometry
      }
      catch {
        if (version !== routeVersion)
          return
        routeCoordinates.value = [
          [liveCoordinates.value.lng, liveCoordinates.value.lat],
          [pickup.lng, pickup.lat],
        ]
      }
      finally {
        if (version === routeVersion)
          isRouteLoading.value = false
      }
      return
    }

    // Active trip or pending offer: full pickup → dropoff route
    const pickup = offerToPlace(offer, 'pickup')
    const destination = offerToPlace(offer, 'dropoff')
    if (!pickup || !destination)
      return

    isRouteLoading.value = true
    try {
      const route = await getDrivingRoute(pickup, destination)
      if (version !== routeVersion)
        return
      routeCoordinates.value = route.geometry
    }
    catch {
      if (version !== routeVersion)
        return
      routeCoordinates.value = [
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat],
      ]
    }
    finally {
      if (version === routeVersion)
        isRouteLoading.value = false
    }
  }

  // Rebuild approach route as driver moves, throttled to avoid API spam
  const throttledApproachRebuild = useThrottleFn(() => {
    if (driver.activeTripStep === 'to_pickup')
      resolveOfferRoute(mapOffer.value)
  }, 15_000)

  // Rebuild when offer or trip step changes — single watch prevents double API
  // call when both change synchronously in the same store action (acceptOffer).
  watch(
    [mapOffer, () => driver.activeTripStep],
    ([offer]) => resolveOfferRoute(offer),
    { immediate: true },
  )

  // Update approach route as driver moves
  watch(liveCoordinates, () => throttledApproachRebuild())

  return { isRouteLoading, mapOffer, routeCoordinates }
}
