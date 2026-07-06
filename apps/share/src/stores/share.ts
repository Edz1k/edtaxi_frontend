import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { Trip } from '~/types/trips'
import { getDrivingRoute } from '@edtaxi/shared/api/geocoding'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import { getSharedTrip } from '~/api/share'

export const useShareStore = defineStore('share', () => {
  const trip = ref<Trip | null>(null)
  const viewCount = ref(0)
  const expiresAt = ref('')
  const routeCoordinates = ref<RouteCoordinate[]>([])
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const isMissing = ref(false)
  const errorMessage = ref('')

  const pickupPlace = computed<GeoPlace | null>(() => {
    if (!trip.value || !hasTripCoordinates('pickup'))
      return null

    return {
      address: trip.value.pickup_address,
      id: `shared-pickup:${trip.value.id}`,
      lat: trip.value.pickup_lat,
      lng: trip.value.pickup_lng,
      name: trip.value.pickup_address,
    }
  })

  const destinationPlace = computed<GeoPlace | null>(() => {
    if (!trip.value || !hasTripCoordinates('dropoff'))
      return null

    return {
      address: trip.value.dropoff_address,
      id: `shared-dropoff:${trip.value.id}`,
      lat: trip.value.dropoff_lat,
      lng: trip.value.dropoff_lng,
      name: trip.value.dropoff_address,
    }
  })

  const canShowMap = computed(() => Boolean(pickupPlace.value && destinationPlace.value))
  const canShowRoute = computed(() => canShowMap.value && routeCoordinates.value.length >= 2)
  const isTerminal = computed(() => trip.value?.status === 'cancelled' || trip.value?.status === 'completed')

  // Живой маркер машины: бэкенд кладёт последнюю известную позицию водителя
  // в driver.location, страница обновляет её поллингом раз в 10 секунд.
  const driverLocation = computed(() => {
    const location = trip.value?.driver?.location
    if (!location || isTerminal.value)
      return null

    return { lat: location.lat, lng: location.lng }
  })

  const driverEtaSeconds = computed(() => {
    if (isTerminal.value)
      return null

    const eta = trip.value?.driver?.location?.eta_sec
    return typeof eta === 'number' && eta > 0 ? eta : null
  })

  function hasTripCoordinates(point: 'dropoff' | 'pickup') {
    if (!trip.value)
      return false

    const lat = point === 'pickup' ? trip.value.pickup_lat : trip.value.dropoff_lat
    const lng = point === 'pickup' ? trip.value.pickup_lng : trip.value.dropoff_lng

    return Number.isFinite(lat) && Number.isFinite(lng)
  }

  async function refreshRoute() {
    const from = pickupPlace.value
    const to = destinationPlace.value

    routeCoordinates.value = []

    if (!from || !to)
      return

    try {
      const route = await getDrivingRoute(from, to)
      routeCoordinates.value = route.geometry
    }
    catch {
      routeCoordinates.value = [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ]
    }
  }

  async function load(token: string, options: { silent?: boolean } = {}) {
    if (!token)
      return

    if (options.silent)
      isRefreshing.value = true
    else
      isLoading.value = true

    errorMessage.value = ''

    try {
      const response = await getSharedTrip(token)
      trip.value = response.trip
      viewCount.value = response.view_count
      expiresAt.value = response.expires_at
      isMissing.value = false
      await refreshRoute()
    }
    catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        isMissing.value = true
        trip.value = null
        routeCoordinates.value = []
        return
      }

      errorMessage.value = 'Не удалось загрузить поездку. Попробуйте обновить страницу.'
    }
    finally {
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  function reset() {
    trip.value = null
    viewCount.value = 0
    expiresAt.value = ''
    routeCoordinates.value = []
    isLoading.value = false
    isRefreshing.value = false
    isMissing.value = false
    errorMessage.value = ''
  }

  return {
    canShowMap,
    canShowRoute,
    destinationPlace,
    driverEtaSeconds,
    driverLocation,
    errorMessage,
    expiresAt,
    isLoading,
    isMissing,
    isRefreshing,
    isTerminal,
    load,
    pickupPlace,
    reset,
    routeCoordinates,
    trip,
    viewCount,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useShareStore, import.meta.hot))
