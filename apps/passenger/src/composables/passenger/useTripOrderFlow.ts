import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { showErrorToast } from '~/api/errors'
import { useRoutePlanner } from '~/composables/passenger/useRoutePlanner'
import { formatFare } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'

interface UseTripOrderFlowOptions {
  clearDestinationSuggestions: () => void
  clearPickupSuggestions: () => void
  destination: Ref<string>
  destinationPlace: Ref<GeoPlace | null>
  pickup: Ref<string>
  pickupPlace: Ref<GeoPlace | null>
}

const DEFAULT_TRIP = {
  category: 'economy' as const,
}

export function useTripOrderFlow(options: UseTripOrderFlowOptions) {
  const trips = useTripsStore()
  const isSubmittingRoute = ref(false)

  const {
    isResolvingRoute,
    resolveRoute,
  } = useRoutePlanner({
    destination: options.destination,
    destinationPlace: options.destinationPlace,
    onRouteGeometry: trips.setRouteCoordinates,
    pickup: options.pickup,
    pickupPlace: options.pickupPlace,
  })

  const canSubmit = computed(() => options.pickup.value.trim().length >= 3 && options.destination.value.trim().length >= 3)
  const isTariffsVisible = computed(() => trips.tripFlowState === 'tariffs')
  const isSearching = computed(() => trips.hasActiveTrip)
  const isBusy = computed(() => trips.isEstimating || trips.isCreating || trips.isCancelling || trips.isRestoringActiveTrip || isResolvingRoute.value)
  const selectedEstimate = computed(() => trips.tariffEstimates.find(item => item.category === trips.selectedCategory) ?? null)
  const primaryText = computed(() => {
    if (isResolvingRoute.value)
      return 'Строим маршрут...'

    if (trips.isEstimating)
      return 'Считаем тарифы...'

    if (trips.isCreating)
      return 'Создаем заказ...'

    if (selectedEstimate.value)
      return `Заказать за ${formatFare(selectedEstimate.value)}`

    return 'Показать цены'
  })

  watch([options.pickup, options.destination], () => {
    if (trips.hasActiveTrip || isSubmittingRoute.value)
      return

    trips.clearEstimate()
  })

  async function getTripPayload() {
    const { destination: resolvedDestination, pickup: resolvedPickup, route } = await resolveRoute()

    options.clearPickupSuggestions()
    options.clearDestinationSuggestions()

    return {
      ...DEFAULT_TRIP,
      distance_km: route.distance_km,
      dropoff_address: resolvedDestination.address,
      dropoff_lat: resolvedDestination.lat,
      dropoff_lng: resolvedDestination.lng,
      duration_min: route.duration_min,
      pickup_address: resolvedPickup.address,
      pickup_lat: resolvedPickup.lat,
      pickup_lng: resolvedPickup.lng,
    }
  }

  async function submitTrip() {
    if (!canSubmit.value || isBusy.value)
      return

    isSubmittingRoute.value = true

    try {
      const payload = await getTripPayload()

      if (!isTariffsVisible.value) {
        await trips.estimateTariffs({
          distance_km: payload.distance_km,
          duration_min: payload.duration_min,
        })
        return
      }

      await trips.orderTrip({
        ...payload,
        category: trips.selectedCategory,
      })
    }
    catch (error) {
      trips.errorMessage = showErrorToast(error, 'Не удалось построить маршрут.')
    }
    finally {
      await nextTick()
      isSubmittingRoute.value = false
    }
  }

  async function cancelSearch() {
    try {
      await trips.cancelActiveTrip()
      trips.clearEstimate()
      trips.resetActiveTrip()
    }
    catch {}
  }

  return {
    canSubmit,
    cancelSearch,
    isBusy,
    isSearching,
    isTariffsVisible,
    primaryText,
    selectedEstimate,
    submitTrip,
    trips,
  }
}
