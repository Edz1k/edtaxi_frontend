import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { CreateTripPayload, EstimateTripPayload, EstimateTripResponse, PaymentMethod, Trip, TripFlowState, TripOptions, TripStop, VehicleCategory } from '~/types/trips'
import type { PassengerDriverLocation } from '~/types/websocket'
import { useLocationAccess } from '@edtaxi/shared/composables/location/useLocationAccess'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import { getUserErrorMessage, showErrorToast } from '~/api/errors'
import { cancelTrip, createTrip, estimateTrip, fileTripComplaint, getActiveTrip, getTrip, getTripHistory, rateTrip, retryTripPrepay } from '~/api/trips'
import { TARIFF_ORDER } from '~/constants/tariffs'
import { tripDropoffPlace, tripPickupPlace } from '~/utils/geoPlace'
import { isTerminalTripStatus } from '~/utils/trip'

// Максимум промежуточных остановок на поездку (совпадает с бэкендом).
export const MAX_TRIP_STOPS = 3

// Пожелания к заказу в форме стора (camelCase); в API уходят snake_case
// через wireTripOptions.
export interface TripOptionsDraft {
  accessible: boolean
  childSeat: boolean
  friendName: string
  friendPhone: string
  pets: boolean
}

function emptyTripOptions(): TripOptionsDraft {
  return { accessible: false, childSeat: false, friendName: '', friendPhone: '', pets: false }
}

export const useTripsStore = defineStore('trips', () => {
  const estimate = ref<EstimateTripResponse | null>(null)
  const tariffEstimates = ref<EstimateTripResponse[]>([])
  const selectedCategories = ref<VehicleCategory[]>(['economy'])
  // Способ оплаты — пользовательская настройка, живёт между заказами (не сбрасываем).
  const paymentMethod = ref<PaymentMethod>('cash')
  // Оплатить часть поездки бонусами (до 50%): фактическая скидка фиксируется
  // на завершении по балансу бонусов — тоже живёт между заказами.
  const useBonuses = ref(false)
  const history = ref<Trip[]>([])
  const historyHasMore = ref(true)
  const historyOffset = ref(0)
  const activeTrip = ref<Trip | null>(null)
  const driverLocation = ref<PassengerDriverLocation | null>(null)
  const routeCoordinates = ref<RouteCoordinate[]>([])
  const isEstimating = ref(false)
  const isCreating = ref(false)
  const isCancelling = ref(false)
  const isRating = ref(false)
  const isFilingComplaint = ref(false)
  const isLoadingHistory = ref(false)
  const isRestoringActiveTrip = ref(false)
  const isPollingActiveTrip = ref(false)
  const searchStartedAt = ref<number | null>(null)
  const searchElapsedSeconds = ref(0)
  const errorMessage = ref('')
  // Ссылка на оплату предоплаченной поездки (payment_method=prepaid): даунбар
  // открывает её во фрейме, пока поездка в awaiting_payment.
  const prepayUrl = ref('')
  // Какой кнопкой выбрана предоплата: Apple Pay открывается во внешнем
  // браузере (в Telegram-вебвью ApplePaySession недоступен), Google Pay — во
  // фрейме. Как и paymentMethod, выбор живёт между заказами.
  const prepaySource = ref<'apple' | 'google' | null>(null)

  const pickup = ref('')
  const destination = ref('')
  const pickupPlace = ref<GeoPlace | null>(null)
  const destinationPlace = ref<GeoPlace | null>(null)
  // Промежуточные остановки (до MAX_TRIP_STOPS): null — строка добавлена,
  // но адрес ещё не выбран из саджеста. Тексты строк живут в даунбаре.
  const stops = ref<(GeoPlace | null)[]>([])
  // Пожелания к заказу и комментарий водителю — сбрасываются после заказа.
  const tripOptions = ref<TripOptionsDraft>(emptyTripOptions())
  const tripComment = ref('')
  // Последний payload оценки (без опций/стопов — те всегда берутся из стора):
  // пере-оценка при переключении пожеланий, чтобы цены в карусели обновились.
  const lastEstimatePayload = ref<Omit<EstimateTripPayload, 'category'> | null>(null)
  const mapPickerMode = ref<MapPickerMode | null>(null)
  // Сигнал даунбару «после выбора точки с карты/избранного — раскрыть поиск
  // адреса (2-й экран)», чтобы выбранная точка была на виду, а не терялась.
  const expandOnReturn = ref(false)

  let searchTimer: number | undefined
  let activeTripPollingTimer: number | undefined

  const hasActiveTrip = computed(() => Boolean(activeTrip.value && !isTerminalTripStatus(activeTrip.value.status)))

  // Самый дешёвый из выбранных тарифов: определяет цену «от N ₸» до принятия
  // заказа и legacy-поле category для старых серверов.
  const cheapestSelectedEstimate = computed<EstimateTripResponse | null>(() => {
    return tariffEstimates.value
      .filter(item => selectedCategories.value.includes(item.category))
      .reduce<EstimateTripResponse | null>(
        (min, item) => !min || item.estimated_fare < min.estimated_fare ? item : min,
        null,
      )
  })

  const selectedCategory = computed<VehicleCategory>(() => {
    return cheapestSelectedEstimate.value?.category ?? selectedCategories.value[0] ?? 'economy'
  })
  const isMapPickerActive = computed(() => Boolean(mapPickerMode.value))
  const tripFlowState = computed<TripFlowState>(() => {
    if (activeTrip.value) {
      if (activeTrip.value.status === 'cancelled' || activeTrip.value.status === 'completed')
        return 'finished'

      return activeTrip.value.status
    }

    if (tariffEstimates.value.length)
      return 'tariffs'

    if (routeCoordinates.value.length >= 2 && pickup.value && destination.value)
      return 'route_ready'

    return 'idle'
  })

  function stopSearchTimer() {
    if (!searchTimer)
      return

    window.clearInterval(searchTimer)
    searchTimer = undefined
  }

  function stopActiveTripPolling() {
    if (!activeTripPollingTimer)
      return

    window.clearInterval(activeTripPollingTimer)
    activeTripPollingTimer = undefined
    isPollingActiveTrip.value = false
  }

  function syncRouteDraftFromTrip(trip: Trip) {
    pickupPlace.value = tripPickupPlace(trip)
    destinationPlace.value = tripDropoffPlace(trip)
    pickup.value = trip.pickup_address
    destination.value = trip.dropoff_address
    // Остановки тоже возвращаем в черновик — «Заказать ещё одну машину»
    // повторяет весь маршрут, а не только А и Б.
    stops.value = (trip.stops ?? []).slice(0, MAX_TRIP_STOPS).map(stop => ({
      address: stop.address,
      id: `stop:${stop.lat}:${stop.lng}`,
      lat: stop.lat,
      lng: stop.lng,
      name: stop.address.split(',')[0]?.trim() || stop.address,
    }))
  }

  // Подтверждённые остановки (адрес выбран) в формате API.
  const confirmedStops = computed<TripStop[]>(() =>
    stops.value
      .filter((stop): stop is GeoPlace => Boolean(stop))
      .map(stop => ({ address: stop.address, lat: stop.lat, lng: stop.lng })),
  )

  function wireTripOptions(): TripOptions | undefined {
    const draft = tripOptions.value
    const friendName = draft.friendName.trim()
    const friendPhone = draft.friendPhone.trim()
    if (!draft.childSeat && !draft.pets && !draft.accessible && !friendName && !friendPhone)
      return undefined

    return {
      accessible: draft.accessible || undefined,
      child_seat: draft.childSeat || undefined,
      friend_name: friendName || undefined,
      friend_phone: friendPhone || undefined,
      pets: draft.pets || undefined,
    }
  }

  // Кресло/животное на мото невозможны — бэкенд отвечает 400 на весь запрос,
  // поэтому для мото-котировки платные опции не отправляем вовсе.
  function wireTripOptionsFor(category: VehicleCategory): TripOptions | undefined {
    const options = wireTripOptions()
    if (!options || category !== 'moto')
      return options

    const { child_seat: _childSeat, pets: _pets, ...rest } = options
    return Object.keys(rest).length ? rest : undefined
  }

  // finishActiveTrip переводит поездку в терминальное состояние. По умолчанию
  // она ОСТАЁТСЯ на экране (пассажир видит итог, ставит оценку и заказывает
  // следующую машину сам) — раньше здесь был мгновенный resetActiveTrip, из-за
  // которого после завершения «ничего не высвечивалось». keepOnScreen=false —
  // для самостоятельной отмены пассажиром: сразу возвращаем форму заказа.
  function finishActiveTrip(trip: Trip, options: { keepOnScreen?: boolean } = {}) {
    history.value = [trip, ...history.value.filter(item => item.id !== trip.id)]
    syncRouteDraftFromTrip(trip)

    if (options.keepOnScreen === false) {
      clearEstimate()
      resetActiveTrip()
      return
    }

    activeTrip.value = trip
    driverLocation.value = null
    searchStartedAt.value = null
    searchElapsedSeconds.value = 0
    stopSearchTimer()
    stopActiveTripPolling()
  }

  function syncActiveTrip(trip: Trip) {
    if (isTerminalTripStatus(trip.status)) {
      prepayUrl.value = ''
      finishActiveTrip(trip)
      return
    }

    activeTrip.value = trip
    history.value = [trip, ...history.value.filter(item => item.id !== trip.id)]
    syncRouteDraftFromTrip(trip)

    if (trip.status !== 'searching') {
      stopSearchTimer()
    }
    else {
      // Предоплата подтвердилась (awaiting_payment → searching): ссылка на
      // оплату больше не нужна, а таймер поиска стартует только сейчас.
      prepayUrl.value = ''
      if (!searchStartedAt.value)
        startSearchTimer()
    }
  }

  function applyTripStatus(tripId: string, status: Trip['status']) {
    if (!activeTrip.value || activeTrip.value.id !== tripId)
      return

    const nextTrip = {
      ...activeTrip.value,
      status,
    }

    if (isTerminalTripStatus(status)) {
      finishActiveTrip(nextTrip)
      return
    }

    activeTrip.value = nextTrip

    if (status !== 'searching')
      stopSearchTimer()
  }

  function setDriverLocation(location: PassengerDriverLocation) {
    driverLocation.value = location
  }

  async function refreshActiveTrip() {
    if (!activeTrip.value)
      return null

    try {
      const trip = await getTrip(activeTrip.value.id)
      syncActiveTrip(trip)
      return trip
    }
    catch (error) {
      errorMessage.value = getUserErrorMessage(error, 'Не удалось обновить статус поездки.')
      throw error
    }
  }

  function startActiveTripPolling() {
    if (typeof window === 'undefined' || !activeTrip.value || activeTripPollingTimer)
      return

    isPollingActiveTrip.value = true
    activeTripPollingTimer = window.setInterval(() => {
      if (!activeTrip.value || isTerminalTripStatus(activeTrip.value.status)) {
        stopActiveTripPolling()
        return
      }

      refreshActiveTrip().catch(() => {})
    }, 3_000)
  }

  function startSearchTimer(startedAt = Date.now()) {
    if (typeof window === 'undefined')
      return

    stopSearchTimer()
    searchStartedAt.value = startedAt
    searchElapsedSeconds.value = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))

    searchTimer = window.setInterval(() => {
      if (!searchStartedAt.value)
        return

      searchElapsedSeconds.value = Math.floor((Date.now() - searchStartedAt.value) / 1000)
    }, 1000)
  }

  function resumeActiveTripEffects(trip: Trip) {
    if (isTerminalTripStatus(trip.status)) {
      stopSearchTimer()
      stopActiveTripPolling()
      return
    }

    if (trip.status === 'searching') {
      const startedAt = trip.created_at ? new Date(trip.created_at).getTime() : Date.now()
      startSearchTimer(Number.isFinite(startedAt) ? startedAt : Date.now())
    }
    else {
      stopSearchTimer()
    }

    startActiveTripPolling()
  }

  async function restoreActiveTrip() {
    isRestoringActiveTrip.value = true
    errorMessage.value = ''

    try {
      const trip = await getActiveTrip()

      if (!trip) {
        resetActiveTrip()
        return null
      }

      syncActiveTrip(trip)
      resumeActiveTripEffects(trip)
      return trip
    }
    catch (error) {
      errorMessage.value = getUserErrorMessage(error, 'Не удалось восстановить активную поездку.')
      throw error
    }
    finally {
      isRestoringActiveTrip.value = false
    }
  }

  async function estimatePrice(payload: EstimateTripPayload) {
    isEstimating.value = true
    errorMessage.value = ''

    try {
      estimate.value = await estimateTrip(payload)
      return estimate.value
    }
    catch (error) {
      estimate.value = null
      errorMessage.value = showErrorToast(error, 'Не удалось рассчитать стоимость.')
      throw error
    }
    finally {
      isEstimating.value = false
    }
  }

  async function estimateTariffs(payload: Omit<EstimateTripPayload, 'category' | 'options' | 'stops'>) {
    isEstimating.value = true
    errorMessage.value = ''

    try {
      // Стопы и опции всегда берём из стора: единый контракт с create —
      // доплата и chain-проверка метрик входят уже в оценку.
      const estimates = await Promise.all(
        TARIFF_ORDER.map(category => estimateTrip({
          ...payload,
          category,
          options: wireTripOptionsFor(category),
          stops: confirmedStops.value.length ? confirmedStops.value : undefined,
        })),
      )

      tariffEstimates.value = estimates
      estimate.value = cheapestSelectedEstimate.value ?? estimates[0] ?? null
      lastEstimatePayload.value = payload

      return estimates
    }
    catch (error) {
      estimate.value = null
      tariffEstimates.value = []
      errorMessage.value = showErrorToast(error, 'Не удалось рассчитать тарифы.')
      throw error
    }
    finally {
      isEstimating.value = false
    }
  }

  // Пере-оценка с текущими пожеланиями (переключение чекбоксов на тарифном
  // этапе): маршрут не менялся, поэтому payload берём последний.
  async function reestimateWithOptions() {
    if (!lastEstimatePayload.value || !tariffEstimates.value.length)
      return

    try {
      await estimateTariffs(lastEstimatePayload.value)
    }
    catch {} // тост уже показан в estimateTariffs
  }

  // Одиночный выбор тарифа (боковая карусель): заменяем весь набор одним.
  function selectCategory(category: VehicleCategory) {
    selectedCategories.value = [category]
    estimate.value = cheapestSelectedEstimate.value
    dropPaidOptionsForMoto()
  }

  // Выбрано мото — платные опции снимаем (кресло/животное на мото невозможны,
  // бэкенд ответил бы 400 на создание заказа).
  function dropPaidOptionsForMoto() {
    if (!selectedCategories.value.includes('moto'))
      return
    if (!tripOptions.value.childSeat && !tripOptions.value.pets)
      return

    tripOptions.value = { ...tripOptions.value, childSeat: false, pets: false }
    reestimateWithOptions()
  }

  // Пожелания к заказу: платные опции меняют цену — пере-оцениваем тарифы.
  function setTripOption<K extends keyof TripOptionsDraft>(key: K, value: TripOptionsDraft[K]) {
    if (tripOptions.value[key] === value)
      return

    tripOptions.value = { ...tripOptions.value, [key]: value }

    if (key === 'childSeat' || key === 'pets')
      reestimateWithOptions()
  }

  function setTripComment(value: string) {
    tripComment.value = value
  }

  // --- Промежуточные остановки (до MAX_TRIP_STOPS) ---

  const canAddStop = computed(() => stops.value.length < MAX_TRIP_STOPS)

  function addStopRow() {
    if (canAddStop.value)
      stops.value = [...stops.value, null]
  }

  function setStop(index: number, place: GeoPlace | null) {
    if (index < 0 || index >= stops.value.length)
      return

    const next = [...stops.value]
    next[index] = place
    setStops(next)
  }

  function removeStop(index: number) {
    setStops(stops.value.filter((_, i) => i !== index))
  }

  function setStops(next: (GeoPlace | null)[]) {
    const trimmed = next.slice(0, MAX_TRIP_STOPS)
    // Ничего не поменялось (например, ресинк из даунбара после remount) —
    // не сбрасываем оценку зря.
    const same = trimmed.length === stops.value.length
      && trimmed.every((place, i) => (place?.id ?? null) === (stops.value[i]?.id ?? null))
    if (same)
      return

    stops.value = trimmed
    clearEstimate()
  }

  function setPaymentMethod(method: PaymentMethod) {
    paymentMethod.value = method
  }

  function setPrepaySource(source: 'apple' | 'google' | null) {
    prepaySource.value = source
  }

  function toggleCategory(category: VehicleCategory) {
    const current = selectedCategories.value

    if (current.includes(category)) {
      // Нельзя снять последний выбранный тариф — заказ без тарифа невозможен.
      if (current.length === 1)
        return

      selectedCategories.value = current.filter(item => item !== category)
    }
    else {
      // Храним выбор в порядке списка тарифов, а не в порядке нажатий.
      selectedCategories.value = TARIFF_ORDER.filter(item => current.includes(item) || item === category)
    }

    estimate.value = cheapestSelectedEstimate.value
    dropPaidOptionsForMoto()
  }

  function setRouteCoordinates(coordinates: RouteCoordinate[]) {
    routeCoordinates.value = coordinates
  }

  function setPickupPlace(place: GeoPlace | null) {
    pickupPlace.value = place

    pickup.value = place?.address ?? ''

    clearEstimate()
  }

  function setDestinationPlace(place: GeoPlace | null) {
    destinationPlace.value = place

    destination.value = place?.address ?? ''

    clearEstimate()
  }

  function setPickup(value: string) {
    pickup.value = value

    if (!value)
      pickupPlace.value = null
  }

  function setDestination(value: string) {
    destination.value = value

    if (!value)
      destinationPlace.value = null
  }

  function startMapPicker(mode: MapPickerMode) {
    mapPickerMode.value = mode
  }

  function cancelMapPicker() {
    mapPickerMode.value = null
  }

  function setPlaceFromPicker(place: GeoPlace, mode: MapPickerMode) {
    if (mode === 'pickup') {
      setPickupPlace(place)
    }
    else {
      setDestinationPlace(place)
    }
  }

  function confirmMapPicker(place: GeoPlace, mode: MapPickerMode) {
    setPlaceFromPicker(place, mode)
    cancelMapPicker()
    expandOnReturn.value = true
  }

  // Выбор точки вне пикера (избранное на карте) — тоже просим раскрыть поиск.
  function requestExpandSearch() {
    expandOnReturn.value = true
  }

  async function orderTrip(payload: Omit<CreateTripPayload, 'categories' | 'category' | 'comment' | 'options' | 'stops'>) {
    // Заказ невозможен без геолокации — точка подачи привязана к местоположению.
    if (!useLocationAccess().isGranted.value)
      throw new Error('Включите геолокацию, чтобы заказать поездку.')

    isCreating.value = true
    errorMessage.value = ''

    try {
      const isPrepaid = paymentMethod.value === 'prepaid'
      const trip = await createTrip({
        ...payload,
        // Legacy-поле для старого сервера: самый дешёвый из выбранных тарифов.
        category: selectedCategory.value,
        // Предоплата фиксирует сумму до завершения: одна категория, без бонусов.
        categories: isPrepaid ? [selectedCategory.value] : [...selectedCategories.value],
        // card — списание с привязанной карты при завершении поездки.
        payment_method: paymentMethod.value,
        use_bonuses: isPrepaid ? false : useBonuses.value,
        // Остановки, пожелания и комментарий — из черновика стора.
        stops: confirmedStops.value.length ? confirmedStops.value : undefined,
        options: wireTripOptions(),
        comment: tripComment.value.trim() || undefined,
      })
      // Пожелания и комментарий — на один заказ; черновик стопов пере-синкнется
      // из созданной поездки (syncActiveTrip → syncRouteDraftFromTrip).
      tripOptions.value = emptyTripOptions()
      tripComment.value = ''
      syncActiveTrip(trip)

      if (isPrepaid && trip.payment_url) {
        // Поездка ждёт оплату (awaiting_payment): таймер поиска не стартует,
        // даунбар откроет платёжный фрейм по этой ссылке.
        prepayUrl.value = trip.payment_url
      }
      else {
        startSearchTimer()
      }
      startActiveTripPolling()
      return activeTrip.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать поездку.')

      // 409 — на бэке уже есть активная поездка (например, заказана с другого
      // устройства): подтягиваем её, чтобы экран показал актуальное состояние.
      if (error instanceof ApiError && error.status === 409)
        await restoreActiveTrip().catch(() => {})

      throw error
    }
    finally {
      isCreating.value = false
    }
  }

  // Повторная ссылка на оплату предоплаченной поездки (пассажир закрыл
  // платёжную страницу или оплата не прошла).
  async function retryPrepay() {
    const trip = activeTrip.value
    if (!trip || trip.status !== 'awaiting_payment')
      return null

    try {
      const response = await retryTripPrepay(trip.id)
      prepayUrl.value = response.payment_url
      return response.payment_url
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось получить ссылку на оплату.')
      throw error
    }
  }

  async function cancelActiveTrip() {
    if (!activeTrip.value)
      return

    isCancelling.value = true
    errorMessage.value = ''

    try {
      await cancelTrip(activeTrip.value.id)
      // Свою отмену пассажир не разглядывает — сразу назад к форме заказа
      // (маршрут остаётся заполненным, можно заказать заново в один тап).
      finishActiveTrip({
        ...activeTrip.value,
        status: 'cancelled',
      }, { keepOnScreen: false })
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отменить поездку.')
      throw error
    }
    finally {
      isCancelling.value = false
    }
  }

  async function loadHistory(limit = 20, offset = 0, options: { append?: boolean } = {}) {
    if (isLoadingHistory.value)
      return

    isLoadingHistory.value = true
    errorMessage.value = ''

    try {
      const response = await getTripHistory(limit, offset)
      const trips = options.append
        ? [
            ...history.value,
            ...response.trips.filter(trip => !history.value.some(existingTrip => existingTrip.id === trip.id)),
          ]
        : response.trips

      history.value = trips
      historyOffset.value = response.offset + response.trips.length
      historyHasMore.value = response.trips.length >= response.limit

      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить историю поездок.')
      throw error
    }
    finally {
      isLoadingHistory.value = false
    }
  }

  async function loadMoreHistory(limit = 20) {
    if (!historyHasMore.value || isLoadingHistory.value)
      return

    return loadHistory(limit, historyOffset.value, {
      append: true,
    })
  }

  async function submitRating(tripId: string, score: number, comment = '', tags: string[] = []) {
    isRating.value = true
    errorMessage.value = ''

    try {
      const response = await rateTrip(tripId, { comment, score, tags: tags.length ? tags : undefined })
      // Локально помечаем поездку оценённой: экран завершения и история сразу
      // показывают звёзды вместо формы, не дожидаясь перезагрузки с бэка.
      const rated = { comment: comment || null, score }
      if (activeTrip.value?.id === tripId)
        activeTrip.value = { ...activeTrip.value, my_rating: rated }
      history.value = history.value.map(item => item.id === tripId ? { ...item, my_rating: rated } : item)
      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить оценку.')
      throw error
    }
    finally {
      isRating.value = false
    }
  }

  async function submitComplaint(tripId: string, reason: string) {
    isFilingComplaint.value = true
    errorMessage.value = ''

    try {
      const response = await fileTripComplaint(tripId, { reason })
      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить жалобу.')
      throw error
    }
    finally {
      isFilingComplaint.value = false
    }
  }

  function resetHistory() {
    history.value = []
    historyHasMore.value = true
    historyOffset.value = 0
  }

  function clearEstimate() {
    estimate.value = null
    tariffEstimates.value = []
    selectedCategories.value = ['economy']
    routeCoordinates.value = []
  }

  function resetActiveTrip() {
    activeTrip.value = null
    driverLocation.value = null
    searchStartedAt.value = null
    searchElapsedSeconds.value = 0
    prepayUrl.value = ''
    stopSearchTimer()
    stopActiveTripPolling()
  }

  function resetTripState() {
    resetActiveTrip()
    resetHistory()
    clearEstimate()
    pickup.value = ''
    destination.value = ''
    pickupPlace.value = null
    destinationPlace.value = null
    stops.value = []
    tripOptions.value = emptyTripOptions()
    tripComment.value = ''
    lastEstimatePayload.value = null
    mapPickerMode.value = null
    errorMessage.value = ''
    isEstimating.value = false
    isCreating.value = false
    isCancelling.value = false
    isRating.value = false
    isFilingComplaint.value = false
    isLoadingHistory.value = false
    isRestoringActiveTrip.value = false
  }

  return {
    activeTrip,
    applyTripStatus,
    cancelActiveTrip,
    cancelMapPicker,
    cheapestSelectedEstimate,
    clearEstimate,
    expandOnReturn,
    requestExpandSearch,
    confirmMapPicker,
    errorMessage,
    estimate,
    estimatePrice,
    estimateTariffs,
    hasActiveTrip,
    history,
    historyHasMore,
    historyOffset,
    isCancelling,
    isCreating,
    isEstimating,
    isFilingComplaint,
    isLoadingHistory,
    isMapPickerActive,
    isPollingActiveTrip,
    isRating,
    isRestoringActiveTrip,
    loadHistory,
    loadMoreHistory,
    mapPickerMode,
    orderTrip,
    prepaySource,
    prepayUrl,
    refreshActiveTrip,
    restoreActiveTrip,
    retryPrepay,
    setPrepaySource,
    resetActiveTrip,
    resetHistory,
    resetTripState,
    routeCoordinates,
    searchElapsedSeconds,
    searchStartedAt,
    paymentMethod,
    useBonuses,
    selectCategory,
    selectedCategories,
    selectedCategory,
    setPaymentMethod,
    setRouteCoordinates,
    tariffEstimates,
    toggleCategory,
    tripFlowState,
    pickup,
    destination,
    driverLocation,
    pickupPlace,
    destinationPlace,
    stops,
    confirmedStops,
    canAddStop,
    addStopRow,
    setStop,
    setStops,
    removeStop,
    tripOptions,
    setTripOption,
    tripComment,
    setTripComment,
    reestimateWithOptions,
    setPickup,
    setDestination,
    setPickupPlace,
    setDestinationPlace,
    setDriverLocation,
    setPlaceFromPicker,
    startMapPicker,
    startActiveTripPolling,
    stopActiveTripPolling,
    submitComplaint,
    submitRating,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useTripsStore as any, import.meta.hot))
