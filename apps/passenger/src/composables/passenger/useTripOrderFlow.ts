import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { RecentRider } from '~/composables/passenger/useRecentRiders'
import { showErrorToast } from '~/api/errors'
import { useRecentRiders } from '~/composables/passenger/useRecentRiders'
import { useRoutePlanner } from '~/composables/passenger/useRoutePlanner'
import { formatFare } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'
import { distanceMeters } from '~/utils/eta'

interface UseTripOrderFlowOptions {
  clearDestinationSuggestions: () => void
  clearPickupSuggestions: () => void
  destination: Ref<string>
  destinationPlace: Ref<GeoPlace | null>
  pickup: Ref<string>
  pickupPlace: Ref<GeoPlace | null>
  userCoordinates: Ref<null | UserCoordinates>
}

// Дальше этого расстояния между реальной геопозицией и точкой А считаем, что
// машину заказывают не себе, и спрашиваем «Кто поедет?». Ближе — обычный дрейф
// GPS, соседний подъезд и погрешность геокодера: дёргать пользователя незачем.
const PICKUP_MISMATCH_METERS = 500

export function useTripOrderFlow(options: UseTripOrderFlowOptions) {
  const trips = useTripsStore()
  const { locale, t } = useI18n()
  const { remember: rememberRider } = useRecentRiders()
  const isSubmittingRoute = ref(false)

  // «Кто поедет?»: спрашиваем один раз на выбранную точку А, ответ держим до
  // её смены — иначе вопрос всплывал бы на каждый тап «Заказать».
  const isRiderSheetOpen = ref(false)
  const isRiderConfirmed = ref(false)

  const pickupDistanceMeters = computed(() => {
    const coords = options.userCoordinates.value
    const place = options.pickupPlace.value
    if (!coords || !place)
      return null

    return distanceMeters(coords.lat, coords.lng, place.lat, place.lng)
  })

  const isPickupFarFromUser = computed(() => {
    const distance = pickupDistanceMeters.value
    return distance !== null && distance > PICKUP_MISMATCH_METERS
  })

  watch(options.pickupPlace, () => {
    isRiderConfirmed.value = false
  })

  const {
    isResolvingRoute,
    resolveRoute,
  } = useRoutePlanner({
    destination: options.destination,
    destinationPlace: options.destinationPlace,
    onRouteGeometry: trips.setRouteCoordinates,
    pickup: options.pickup,
    pickupPlace: options.pickupPlace,
    // Остановки живут в сторе: маршрут (и его distance/duration) строится
    // через них одним вызовом /route.
    stops: toRef(trips, 'stops'),
  })

  const canSubmit = computed(() => options.pickup.value.trim().length >= 3 && options.destination.value.trim().length >= 3)
  const isTariffsVisible = computed(() => trips.tripFlowState === 'tariffs')
  // Экран поездки показывается и для терминальных статусов (completed/cancelled):
  // там пассажир видит итог, ставит оценку и заказывает следующую машину.
  const isSearching = computed(() => Boolean(trips.activeTrip))
  const isBusy = computed(() => trips.isEstimating || trips.isCreating || trips.isCancelling || trips.isRestoringActiveTrip || isResolvingRoute.value)
  // Самый дешёвый из выбранных тарифов — от него считается цена «от N ₸».
  const selectedEstimate = computed(() => trips.cheapestSelectedEstimate)
  const primaryText = computed(() => {
    if (isResolvingRoute.value)
      return t('tripOrder.buildingRoute')

    if (trips.isEstimating)
      return t('tripOrder.estimating')

    if (trips.isCreating)
      return t('tripOrder.creating')

    if (selectedEstimate.value) {
      return trips.selectedCategories.length > 1
        ? t('tripOrder.orderFrom', { price: formatFare(selectedEstimate.value, locale.value) })
        : t('tripOrder.orderFor', { price: formatFare(selectedEstimate.value, locale.value) })
    }

    return t('tripOrder.showPrices')
  })

  watch([options.pickup, options.destination], () => {
    if (trips.activeTrip || isSubmittingRoute.value)
      return

    trips.clearEstimate()
  })

  async function getTripPayload() {
    const { destination: resolvedDestination, pickup: resolvedPickup, route } = await resolveRoute()

    options.clearPickupSuggestions()
    options.clearDestinationSuggestions()

    return {
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

    // Точка подачи далеко от реальной позиции — уточняем, кто поедет, ДО
    // создания заказа. Проверка на уже загруженных данных, маршрут не трогаем.
    if (isTariffsVisible.value && isPickupFarFromUser.value && !isRiderConfirmed.value) {
      isRiderSheetOpen.value = true
      return
    }

    isSubmittingRoute.value = true

    try {
      const payload = await getTripPayload()

      if (!isTariffsVisible.value) {
        // Координаты нужны бэкенду для коэффициента спроса и проверки метрик
        // маршрута против прямой между точками (анти-спуфинг цены).
        await trips.estimateTariffs({
          distance_km: payload.distance_km,
          dropoff_lat: payload.dropoff_lat,
          dropoff_lng: payload.dropoff_lng,
          duration_min: payload.duration_min,
          pickup_lat: payload.pickup_lat,
          pickup_lng: payload.pickup_lng,
        })
        return
      }

      // category/categories добавляет сам стор из выбранных тарифов.
      await trips.orderTrip(payload)
    }
    catch (error) {
      trips.errorMessage = showErrorToast(error, t('tripOrder.routeFailed'))
    }
    finally {
      await nextTick()
      isSubmittingRoute.value = false
    }
  }

  // Ответы на «Кто поедет?» пишутся в те же friend_*-опции, что и ручной «заказ
  // другу» в «Пожеланиях» — один источник правды, — после чего заказ уходит.
  function confirmRiderIsMe() {
    trips.setTripOption('friendName', '')
    trips.setTripOption('friendPhone', '')
    isRiderConfirmed.value = true
    isRiderSheetOpen.value = false
    return submitTrip()
  }

  function confirmRiderIsOther(rider: RecentRider) {
    trips.setTripOption('friendName', rider.name)
    trips.setTripOption('friendPhone', rider.phone)
    rememberRider(rider)
    isRiderConfirmed.value = true
    isRiderSheetOpen.value = false
    return submitTrip()
  }

  function closeRiderSheet() {
    isRiderSheetOpen.value = false
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
    closeRiderSheet,
    confirmRiderIsMe,
    confirmRiderIsOther,
    isBusy,
    isRiderSheetOpen,
    isSearching,
    isTariffsVisible,
    pickupDistanceMeters,
    primaryText,
    // Наружу для мгновенной перерисовки линии после пересортировки точек.
    resolveRoute,
    selectedEstimate,
    submitTrip,
    trips,
  }
}
