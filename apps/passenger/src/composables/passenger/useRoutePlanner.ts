import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { getDrivingRoute, getDrivingRouteVia, searchPlaces } from '@edtaxi/shared/api/geocoding'

interface UseRoutePlannerOptions {
  destination: Ref<string>
  destinationPlace: Ref<GeoPlace | null>
  onRouteGeometry: (coordinates: [number, number][]) => void
  pickup: Ref<string>
  pickupPlace: Ref<GeoPlace | null>
  // Промежуточные остановки (уже выбранные из саджеста; null-слоты
  // пропускаются) — маршрут строится через них: A → стопы → B.
  stops?: Ref<(GeoPlace | null)[]>
}

async function resolvePlace(value: string, selectedPlace: GeoPlace | null, near?: GeoPlace | null) {
  if (selectedPlace)
    return selectedPlace

  const suggestions = await searchPlaces(value, near ? { lat: near.lat, lng: near.lng } : undefined)
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
      // Куда — резолвим относительно точки А: адрес без города трактуем как
      // адрес в городе посадки, а не в одноимённой улице за сотни километров.
      const resolvedDestination = await resolvePlace(options.destination.value, options.destinationPlace.value, resolvedPickup)

      // Остановки не резолвим по тексту — они всегда выбираются из саджеста;
      // пустые слоты (адрес не выбран) в маршрут не попадают.
      const resolvedStops = (options.stops?.value ?? []).filter((stop): stop is GeoPlace => Boolean(stop))
      const route = resolvedStops.length
        ? await getDrivingRouteVia([resolvedPickup, ...resolvedStops, resolvedDestination])
        : await getDrivingRoute(resolvedPickup, resolvedDestination)

      options.pickupPlace.value = resolvedPickup
      options.destinationPlace.value = resolvedDestination
      options.pickup.value = resolvedPickup.address
      options.destination.value = resolvedDestination.address
      options.onRouteGeometry(route.geometry)

      return {
        destination: resolvedDestination,
        pickup: resolvedPickup,
        route,
        stops: resolvedStops,
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
