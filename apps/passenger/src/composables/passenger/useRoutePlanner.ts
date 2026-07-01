import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { getDrivingRoute, searchPlaces } from '@edtaxi/shared/api/geocoding'

interface UseRoutePlannerOptions {
  destination: Ref<string>
  destinationPlace: Ref<GeoPlace | null>
  onRouteGeometry: (coordinates: [number, number][]) => void
  pickup: Ref<string>
  pickupPlace: Ref<GeoPlace | null>
}

async function resolvePlace(value: string, selectedPlace: GeoPlace | null) {
  if (selectedPlace)
    return selectedPlace

  const suggestions = await searchPlaces(value)
  const place = suggestions[0]

  if (!place)
    throw new Error('Адрес не найден')

  return place
}

export function useRoutePlanner(options: UseRoutePlannerOptions) {
  const isResolvingRoute = ref(false)

  async function resolveRoute() {
    isResolvingRoute.value = true

    try {
      const resolvedPickup = await resolvePlace(options.pickup.value, options.pickupPlace.value)
      const resolvedDestination = await resolvePlace(options.destination.value, options.destinationPlace.value)
      const route = await getDrivingRoute(resolvedPickup, resolvedDestination)

      options.pickupPlace.value = resolvedPickup
      options.destinationPlace.value = resolvedDestination
      options.pickup.value = resolvedPickup.address
      options.destination.value = resolvedDestination.address
      options.onRouteGeometry(route.geometry)

      return {
        destination: resolvedDestination,
        pickup: resolvedPickup,
        route,
      }
    }
    finally {
      isResolvingRoute.value = false
    }
  }

  return {
    isResolvingRoute,
    resolveRoute,
  }
}
