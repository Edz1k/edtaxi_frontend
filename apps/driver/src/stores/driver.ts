import type { DriverDistrict, DriverProfile, DriverRouteChange, DriverStatusResponse, DriverTripStep, HomeModeState } from '~/types/driver'
import type { Trip, VehicleCategory } from '~/types/trips'
import type { DriverTripOffer } from '~/types/websocket'
import { useToast } from '@edtaxi/shared/composables/useToast'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import {
  acceptDriverParkInvite,
  acceptDriverRouteChange,
  acceptDriverTrip,
  activateHomeMode,
  cancelDriverTrip,
  completeDriverTrip,
  createDriverProfile,
  deactivateHomeMode,
  getActiveDriverTrip,
  getDriverCategories,
  getDriverDistricts,
  getDriverRouteChange,
  getHomeMode,
  markDriverArrived,
  rejectDriverRouteChange,
  rejectDriverTrip,
  setDriverCategories,
  setDriverDistricts,
  startDriverTrip,
  updateDriverStatus,
} from '~/api/driver'
import { getUserErrorMessage, showErrorToast } from '~/api/errors'
import { isTerminalTripStatus, tripStatusToStep, tripToOffer } from '~/utils/trip'
import { sortCategories } from '~/utils/vehicleCategories'

export const useDriverStore = defineStore('driver', () => {
  const profile = ref<DriverProfile | null>(null)
  const pendingOffer = ref<DriverTripOffer | null>(null)
  const activeTrip = ref<Trip | null>(null)
  const activeOffer = ref<DriverTripOffer | null>(null)
  const activeTripStep = ref<DriverTripStep | null>(null)
  const currentTripId = ref('')
  // Пассажир просит заехать по пути и ждёт ответа. Держим отдельно от
  // pendingOffer: тот про новый заказ, а этот — про уже идущую поездку, и
  // спутать их значило бы проиграть мелодию нового заказа на остановку.
  const pendingRouteChange = ref<DriverRouteChange | null>(null)
  const isAnsweringRouteChange = ref(false)
  const isOnline = ref(false)
  const isAvailable = ref(false)
  const isLoadingProfile = ref(false)
  const isMutatingOffer = ref(false)
  const isLoadingParkInvite = ref(false)
  const isRestoringActiveTrip = ref(false)
  const isChangingStatus = ref(false)
  const errorMessage = ref('')

  // «Пассажир отменил заказ — ищем вам следующий»: янтарный баннер в панели
  // статуса. Сбрасывается новым оффером или сам через 30 секунд.
  const passengerCancelledBanner = ref(false)
  let cancelledBannerTimer: number | undefined

  // Районы приёма заказов (город — по текущей локации): available пуст, если
  // город не определён или районов в нём нет; пустой activeDistrictIds =
  // весь город (это валидный выбор, min-1 нет — в отличие от тарифов).
  const availableDistricts = ref<DriverDistrict[]>([])
  const activeDistrictIds = ref<string[]>([])
  const districtsCity = ref('')
  const isSavingDistricts = ref(false)

  // Режим «Домой»: только заказы с концом в 5 км от дома (2/сутки, 3 часа).
  const homeMode = ref<HomeModeState | null>(null)
  const isMutatingHomeMode = ref(false)
  // Тикер для клиентского самоистечения бейджа (режим гаснет сам по until,
  // без пере-запроса к серверу).
  const nowTick = ref(Date.now())
  if (typeof window !== 'undefined') {
    window.setInterval(() => {
      nowTick.value = Date.now()
    }, 15_000)
  }
  const isHomeModeActive = computed(() => {
    const until = homeMode.value?.until
    return Boolean(homeMode.value?.active && until && new Date(until).getTime() > nowTick.value)
  })

  // Тарифы, по которым водитель может/хочет получать заказы.
  // available пуст, пока нет одобренной машины.
  const availableCategories = ref<VehicleCategory[]>([])
  const activeCategories = ref<VehicleCategory[]>([])
  const isLoadingCategories = ref(false)
  const isSavingCategories = ref(false)
  const hasLoadedCategories = ref(false)

  const hasActiveTrip = computed(() => Boolean(currentTripId.value))

  // --- Прогресс по остановкам активной поездки (только на клиенте) ---
  // Бэкенд не отслеживает «остановка пройдена»: прогресс живёт здесь и переживает
  // перезапуск вебвью через localStorage (один ключ {tripId, passed}).
  //
  // ⚠️ Это ИНДЕКС в trip.stops, а не идентификатор остановки. Пока новые
  // остановки добавляются только в КОНЕЦ списка (так и делает пассажир в
  // proposeTripStop), уже пройденные точки не сдвигаются и счётчик остаётся
  // верным. Если когда-нибудь появится вставка в середину или перестановка,
  // счётчик молча зачеркнёт не ту остановку — тогда прогресс придётся переводить
  // на идентификаторы остановок, а не чинить эту функцию.
  const passedStopCount = ref(0)
  const NAV_PROGRESS_KEY = 'driver:trip-nav-progress'

  function readNavProgress(): { passed: number, tripId: string } | null {
    try {
      const raw = localStorage.getItem(NAV_PROGRESS_KEY)
      if (!raw)
        return null
      const parsed = JSON.parse(raw) as { passed?: unknown, tripId?: unknown }
      if (typeof parsed.tripId === 'string' && typeof parsed.passed === 'number')
        return { passed: parsed.passed, tripId: parsed.tripId }
    }
    catch {}
    return null
  }

  function persistNavProgress() {
    try {
      if (currentTripId.value)
        localStorage.setItem(NAV_PROGRESS_KEY, JSON.stringify({ passed: passedStopCount.value, tripId: currentTripId.value }))
    }
    catch {}
  }

  function clearNavProgress() {
    passedStopCount.value = 0
    try {
      localStorage.removeItem(NAV_PROGRESS_KEY)
    }
    catch {}
  }

  // Инициализация прогресса при смене поездки: тот же id — не трогаем; новый —
  // восстанавливаем сохранённый по нему прогресс или начинаем с нуля. Вызывать
  // ДО присваивания currentTripId (сравнение по старому значению).
  function initNavProgress(tripId: string) {
    if (currentTripId.value === tripId)
      return
    const saved = readNavProgress()
    passedStopCount.value = saved && saved.tripId === tripId ? saved.passed : 0
  }

  function clearActiveTripState() {
    activeTrip.value = null
    activeOffer.value = null
    activeTripStep.value = null
    currentTripId.value = ''
    // Заявка живёт ровно столько же, сколько поездка: неотвеченная модалка на
    // следующем заказе — чужой хвост.
    pendingRouteChange.value = null
    clearNavProgress()
  }

  function syncActiveTrip(trip: Trip) {
    // Онлайн-оплата не прошла — бэкенд перекинул поездку на наличные. Тост
    // одноразовый по построению: после этого рефетча payment_method в сторе
    // уже 'cash', и условие больше не выполняется.
    const previous = activeTrip.value
    if (previous?.id === trip.id && trip.payment_method === 'cash'
      && (previous.payment_method === 'card' || previous.payment_method === 'prepaid')) {
      useToast().warning('Оплата наличными', 'Онлайн-оплата не прошла — возьмите оплату наличными.')
    }

    initNavProgress(trip.id)
    activeTrip.value = trip
    activeOffer.value = tripToOffer(trip)
    activeTripStep.value = tripStatusToStep(trip.status)
    currentTripId.value = trip.id

    if (pendingOffer.value?.trip_id === trip.id)
      clearOffer()
  }

  // Точки маршрута для навигации: А → остановки 1..N → Б, с текущей целью.
  // До in_progress цель — точка А; в поездке — первая непройденная остановка,
  // после всех остановок — точка Б.
  interface TripNavPoint {
    address: string
    kind: 'dropoff' | 'pickup' | 'stop'
    label: string
    lat: number
    lng: number
    state: 'current' | 'next' | 'passed'
  }

  const tripNavPoints = computed<TripNavPoint[]>(() => {
    const trip = activeTrip.value
    if (!trip)
      return []

    const inProgress = activeTripStep.value === 'in_progress'
    const stops = trip.stops ?? []
    const passed = passedStopCount.value

    const pickup: TripNavPoint = {
      address: trip.pickup_address,
      kind: 'pickup',
      label: 'Точка А',
      lat: trip.pickup_lat,
      lng: trip.pickup_lng,
      state: inProgress ? 'passed' : 'current',
    }

    const stopPoints: TripNavPoint[] = stops.map((stop, index) => ({
      address: stop.address,
      kind: 'stop',
      label: `Остановка ${index + 1}`,
      lat: stop.lat,
      lng: stop.lng,
      state: !inProgress ? 'next' : index < passed ? 'passed' : index === passed ? 'current' : 'next',
    }))

    const dropoff: TripNavPoint = {
      address: trip.dropoff_address,
      kind: 'dropoff',
      label: 'Точка Б',
      lat: trip.dropoff_lat,
      lng: trip.dropoff_lng,
      state: inProgress && passed >= stops.length ? 'current' : 'next',
    }

    return [pickup, ...stopPoints, dropoff]
  })

  // Текущая цель навигатора — точка со state 'current'.
  const currentNavPoint = computed<TripNavPoint | null>(() =>
    tripNavPoints.value.find(point => point.state === 'current') ?? null,
  )

  // Ещё есть непройденные остановки — водитель может переключить навигатор дальше.
  const canAdvanceNavPoint = computed(() =>
    activeTripStep.value === 'in_progress'
    && passedStopCount.value < (activeTrip.value?.stops?.length ?? 0),
  )

  function advanceNavPoint() {
    if (!canAdvanceNavPoint.value)
      return
    passedStopCount.value++
    persistNavProgress()
  }

  function applyStatus(status: DriverStatusResponse) {
    isOnline.value = status.is_online
    isAvailable.value = status.is_available

    if (profile.value) {
      profile.value = {
        ...profile.value,
        is_available: status.is_available,
        is_online: status.is_online,
      }
    }
  }

  async function ensureProfile() {
    if (profile.value)
      return profile.value

    isLoadingProfile.value = true
    errorMessage.value = ''

    try {
      profile.value = await createDriverProfile()
      isOnline.value = profile.value.is_online
      isAvailable.value = profile.value.is_available
      loadCategories().catch(() => {})
      loadDistricts().catch(() => {})
      loadHomeMode().catch(() => {})
      return profile.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать профиль водителя.')
      throw error
    }
    finally {
      isLoadingProfile.value = false
    }
  }

  // refreshProfile перечитывает профиль (в т.ч. настройки гео-проверки).
  // Тихий: ошибка не должна мешать водителю выйти на линию.
  async function refreshProfile() {
    const fresh = await createDriverProfile()
    profile.value = fresh
    isOnline.value = fresh.is_online
    isAvailable.value = fresh.is_available
    return fresh
  }

  // Настройки гео-проверки с сервера; нет профиля или старый бэкенд — гейт
  // считаем выключенным (кнопки не блокируем).
  const geoGate = computed(() => profile.value?.geo_gate ?? null)

  // Трансляция геопозиции в боте: статус приходит с профилем и обновляется
  // вместе с ним (в т.ч. при каждом выходе на линию). Нет поля — старый
  // бэкенд, статус не показываем вовсе.
  const liveLocation = computed(() => profile.value?.live_location ?? null)

  // «до 18:40» — во сколько погаснет трансляция. Пустая строка, если её нет
  // или срок неизвестен: подпись просто не рисуется.
  const liveLocationUntilLabel = computed(() => {
    const until = liveLocation.value?.until
    if (!liveLocation.value?.active || !until)
      return ''

    const at = new Date(until)
    if (Number.isNaN(at.getTime()))
      return ''

    return at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  })

  // loadCategories подтягивает available/active тарифы водителя.
  // Ошибка не показывается тостом: без данных чипы тарифов просто скрыты.
  async function loadCategories() {
    isLoadingCategories.value = true

    try {
      const res = await getDriverCategories()
      availableCategories.value = sortCategories(res.available)
      activeCategories.value = sortCategories(res.active)
      hasLoadedCategories.value = true
      return res
    }
    finally {
      isLoadingCategories.value = false
    }
  }

  // toggleCategory — оптимистичное включение/выключение тарифа с откатом
  // при ошибке. Последний активный тариф выключить нельзя (бэкенд вернёт 400).
  async function toggleCategory(category: VehicleCategory) {
    const previous = [...activeCategories.value]
    const isActive = previous.includes(category)
    const next = isActive
      ? previous.filter(item => item !== category)
      : sortCategories([...previous, category])

    if (isActive && next.length === 0) {
      useToast().warning('Нужен хотя бы один тариф', 'Сначала включите другой тариф.')
      return
    }

    activeCategories.value = next
    isSavingCategories.value = true

    try {
      const res = await setDriverCategories(next)
      availableCategories.value = sortCategories(res.available)
      activeCategories.value = sortCategories(res.active)
    }
    catch (error) {
      activeCategories.value = previous
      showErrorToast(error, 'Не удалось обновить тарифы.')
    }
    finally {
      isSavingCategories.value = false
    }
  }

  // loadDistricts подтягивает районы города водителя и его выбор.
  // Ошибка тихая (как loadCategories): без данных блок районов просто скрыт.
  async function loadDistricts() {
    const res = await getDriverDistricts()
    districtsCity.value = res.city
    availableDistricts.value = res.available
    activeDistrictIds.value = res.active
    return res
  }

  // toggleDistrict — оптимистично с откатом; пустой набор валиден (весь город).
  async function toggleDistrict(districtId: string) {
    const previous = [...activeDistrictIds.value]
    const next = previous.includes(districtId)
      ? previous.filter(id => id !== districtId)
      : [...previous, districtId]

    activeDistrictIds.value = next
    isSavingDistricts.value = true

    try {
      const res = await setDriverDistricts(next)
      districtsCity.value = res.city
      availableDistricts.value = res.available
      activeDistrictIds.value = res.active
    }
    catch (error) {
      activeDistrictIds.value = previous
      showErrorToast(error, 'Не удалось обновить районы.')
    }
    finally {
      isSavingDistricts.value = false
    }
  }

  // clearDistricts — «Весь город»: сбрасывает выбор целиком.
  async function clearDistricts() {
    if (!activeDistrictIds.value.length)
      return

    const previous = [...activeDistrictIds.value]
    activeDistrictIds.value = []
    isSavingDistricts.value = true

    try {
      const res = await setDriverDistricts([])
      districtsCity.value = res.city
      availableDistricts.value = res.available
      activeDistrictIds.value = res.active
    }
    catch (error) {
      activeDistrictIds.value = previous
      showErrorToast(error, 'Не удалось обновить районы.')
    }
    finally {
      isSavingDistricts.value = false
    }
  }

  // Ошибка тихая: без состояния кнопка «Домой» просто не показывает остаток.
  async function loadHomeMode() {
    homeMode.value = await getHomeMode()
    return homeMode.value
  }

  async function activateHome(lat: number, lng: number, address: string) {
    isMutatingHomeMode.value = true
    try {
      homeMode.value = await activateHomeMode({ address, lat, lng })
      return homeMode.value
    }
    catch (error) {
      showErrorToast(error, 'Не удалось включить режим «Домой».')
      throw error
    }
    finally {
      isMutatingHomeMode.value = false
    }
  }

  async function deactivateHome() {
    isMutatingHomeMode.value = true
    try {
      homeMode.value = await deactivateHomeMode()
      return homeMode.value
    }
    catch (error) {
      showErrorToast(error, 'Не удалось выключить режим «Домой».')
      throw error
    }
    finally {
      isMutatingHomeMode.value = false
    }
  }

  async function setOnline(nextOnline: boolean) {
    isChangingStatus.value = true
    errorMessage.value = ''

    try {
      const status = await updateDriverStatus({ is_online: nextOnline })
      applyStatus(status)
      // Выход на линию — единственный регулярный момент, когда можно освежить
      // серверные настройки (режим и радиусы гео-проверки). Иначе смена режима
      // доехала бы до водителя только после перезапуска приложения.
      if (nextOnline)
        refreshProfile().catch(() => {})
      return status
    }
    catch (error) {
      // 403 при выходе на линию (не пройдена верификация / нет таксопарка) —
      // БЕЗ тоста: map.vue показывает жёлтый баннер с причиной и кнопкой
      // «Пройти верификацию», красный тост поверх него только дублировал шум.
      if (nextOnline && error instanceof ApiError && error.status === 403) {
        errorMessage.value = getUserErrorMessage(error, 'Выход на линию сейчас недоступен.')
        throw error
      }
      errorMessage.value = showErrorToast(error, 'Не удалось изменить статус.')
      throw error
    }
    finally {
      isChangingStatus.value = false
    }
  }

  function dismissCancelledBanner() {
    passengerCancelledBanner.value = false
    if (cancelledBannerTimer !== undefined) {
      window.clearTimeout(cancelledBannerTimer)
      cancelledBannerTimer = undefined
    }
  }

  function showCancelledBanner() {
    dismissCancelledBanner()
    passengerCancelledBanner.value = true
    cancelledBannerTimer = window.setTimeout(dismissCancelledBanner, 30_000)
  }

  function receiveOffer(offer: DriverTripOffer) {
    // Занятому водителю оффер не показываем. Основную защиту делает бэкенд
    // (диспетчер не берёт водителя с активной поездкой), но между отбором
    // кандидатов и отправкой есть окно, да и WS-сообщение могло догнать нас уже
    // после принятия другого заказа. Дешёвая страховка: иначе поверх активной
    // поездки всплывает модалка чужого заказа с мелодией.
    if (hasActiveTrip.value)
      return

    // Новый оффер (в т.ч. автоперекидка после отмены) заменяет баннер отмены.
    dismissCancelledBanner()
    pendingOffer.value = offer
    startOfferExpiryTimer(offer)
  }

  // Клиентское истечение оффера. Сервер присылает trip_offer_expired, но если
  // сообщение потерялось (разрыв WS, спящий вебвью), модалка висела бы вечно —
  // а вместе с ней и мелодия, у неё loop=true. timeout_sec приходит в самом
  // оффере и до этого не использовался.
  let offerExpiryTimer: number | undefined

  function stopOfferExpiryTimer() {
    if (offerExpiryTimer === undefined)
      return
    window.clearTimeout(offerExpiryTimer)
    offerExpiryTimer = undefined
  }

  function startOfferExpiryTimer(offer: DriverTripOffer) {
    stopOfferExpiryTimer()

    const seconds = offer.timeout_sec
    if (!Number.isFinite(seconds) || seconds <= 0)
      return

    // Небольшой запас: если сервер всё-таки пришлёт trip_offer_expired, пусть
    // отработает он — так статус оффера на бэке и на экране совпадут.
    offerExpiryTimer = window.setTimeout(() => {
      if (pendingOffer.value?.trip_id === offer.trip_id)
        clearOffer()
    }, (seconds + 1) * 1000)
  }

  function clearOffer() {
    stopOfferExpiryTimer()
    pendingOffer.value = null
  }

  // expireOffer закрывает оффер по сигналу trip_offer_expired с сервера.
  // Возвращает true, если закрыли именно показанный сейчас оффер.
  function expireOffer(tripId: string) {
    if (pendingOffer.value?.trip_id !== tripId)
      return false

    clearOffer()
    return true
  }

  async function acceptOffer() {
    if (!pendingOffer.value)
      return

    isMutatingOffer.value = true
    errorMessage.value = ''

    try {
      await acceptDriverTrip(pendingOffer.value.trip_id)
      activeOffer.value = pendingOffer.value
      activeTripStep.value = 'to_pickup'
      initNavProgress(pendingOffer.value.trip_id)
      currentTripId.value = pendingOffer.value.trip_id
      clearOffer()
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось принять заказ.')
      // Оффер после неудачного принятия почти наверняка мёртв (истёк или заказ
      // ушёл другому) — закрываем модалку, чтобы она и мелодия не висели вечно.
      clearOffer()
      throw error
    }
    finally {
      isMutatingOffer.value = false
    }
  }

  async function rejectOffer() {
    if (!pendingOffer.value)
      return

    isMutatingOffer.value = true
    errorMessage.value = ''

    try {
      await rejectDriverTrip(pendingOffer.value.trip_id)
      clearOffer()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отклонить заказ.')
      throw error
    }
    finally {
      isMutatingOffer.value = false
    }
  }

  async function markArrived() {
    if (!currentTripId.value)
      return

    try {
      await markDriverArrived(currentTripId.value)
      applyTripStatus(currentTripId.value, 'driver_arriving')
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отметить прибытие.')
      throw error
    }
  }

  async function startTrip() {
    if (!currentTripId.value)
      return

    try {
      await startDriverTrip(currentTripId.value)
      applyTripStatus(currentTripId.value, 'in_progress')
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось начать поездку.')
      throw error
    }
  }

  async function completeTrip() {
    if (!currentTripId.value)
      return

    try {
      await completeDriverTrip(currentTripId.value)
      clearActiveTripState()
      // Поездка могла закончиться у дома — бэкенд гасит режим «Домой» сам,
      // подтягиваем свежее состояние для бейджа.
      loadHomeMode().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось завершить поездку.')
      throw error
    }
  }

  async function cancelTrip() {
    if (!currentTripId.value)
      return

    try {
      await cancelDriverTrip(currentTripId.value)
      clearActiveTripState()
      // Отмена НЕ гасит режим «Домой» на бэке (он одноразовый, гаснет только при
      // завершении у дома) — обновляем состояние, чтобы бейдж отражал факт.
      loadHomeMode().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отменить поездку.')
      throw error
    }
  }

  function applyTripStatus(tripId: string, status: Trip['status'], cancelledBy?: string) {
    if (currentTripId.value && currentTripId.value !== tripId)
      return

    if (isTerminalTripStatus(status)) {
      // Пассажир отменил назначенный заказ: водитель не виноват — показываем
      // «ищем вам следующий» (бэкенд уже запустил автоперекидку на ближайший
      // searching-заказ, оффер придёт обычным путём).
      if (status === 'cancelled' && cancelledBy === 'passenger' && currentTripId.value === tripId) {
        showCancelledBanner()
        useToast().warning('Пассажир отменил заказ', 'Ищем вам следующий заказ рядом...')
      }
      clearActiveTripState()
      // Терминальный статус пришёл по websocket (не через локальный
      // complete/cancel): завершение у дома гасит режим «Домой» на бэке —
      // подтягиваем свежее состояние, иначе бейдж «горит» после гашения.
      loadHomeMode().catch(() => {})
      return
    }

    initNavProgress(tripId)
    currentTripId.value = tripId
    activeTripStep.value = tripStatusToStep(status)

    if (activeTrip.value && activeTrip.value.id === tripId) {
      activeTrip.value = { ...activeTrip.value, status }
      activeOffer.value = tripToOffer(activeTrip.value)
    }
  }

  // --- Остановка по пути: пассажир предложил, водитель отвечает ---

  async function refreshRouteChange() {
    if (!currentTripId.value) {
      pendingRouteChange.value = null
      return null
    }

    try {
      const response = await getDriverRouteChange(currentTripId.value)
      pendingRouteChange.value = response.route_change
      return response.route_change
    }
    catch {
      // Молча: отсутствие заявки — обычное состояние поездки, ронять из-за
      // этого экран водителя нельзя.
      return null
    }
  }

  async function acceptRouteChange() {
    if (!currentTripId.value || !pendingRouteChange.value)
      return

    isAnsweringRouteChange.value = true
    try {
      await acceptDriverRouteChange(currentTripId.value)
      pendingRouteChange.value = null
      // Маршрут поездки удлинился — перечитываем его целиком, чтобы новая
      // остановка появилась в списке и в навигаторе.
      await refreshActiveTrip()
    }
    catch (error) {
      // Бэкенд больше не отвечает 402 «не хватает средств»: остановка
      // принимается всегда, доплата копится в итоге поездки. Сюда попадают
      // только транспортные/статусные ошибки — заявку не гасим, бэкенд ничего
      // не изменил, и водитель может ответить ещё раз.
      errorMessage.value = showErrorToast(error, 'Не удалось принять остановку.')
      throw error
    }
    finally {
      isAnsweringRouteChange.value = false
    }
  }

  async function rejectRouteChange() {
    if (!currentTripId.value || !pendingRouteChange.value)
      return

    isAnsweringRouteChange.value = true
    try {
      await rejectDriverRouteChange(currentTripId.value)
      pendingRouteChange.value = null
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отклонить остановку.')
      throw error
    }
    finally {
      isAnsweringRouteChange.value = false
    }
  }

  async function refreshActiveTrip() {
    if (!currentTripId.value)
      return null

    try {
      const trip = await getActiveDriverTrip()

      if (!trip) {
        clearActiveTripState()
        return null
      }

      syncActiveTrip(trip)
      // Заявку на остановку тянем здесь же: отдельного WS-события у неё нет,
      // бэкенд шлёт обычный trip_status. Поездка не поллится, а обновляется по
      // событиям, так что лишним запросом это не станет.
      refreshRouteChange().catch(() => {})
      return trip
    }
    catch (error) {
      // Без тоста: рефреш дёргается из WS-обработчика на каждое событие, и
      // разовый сетевой сбой показывал водителю «Не удалось обновить активную
      // поездку» посреди заказа, хотя следующее событие всё чинило само.
      errorMessage.value = getUserErrorMessage(error, 'Не удалось обновить активную поездку.')
      throw error
    }
  }

  async function restoreActiveTrip() {
    isRestoringActiveTrip.value = true
    errorMessage.value = ''

    try {
      const trip = await getActiveDriverTrip()

      if (!trip) {
        clearActiveTripState()
        return null
      }

      syncActiveTrip(trip)
      return trip
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось восстановить активную поездку.')
      throw error
    }
    finally {
      isRestoringActiveTrip.value = false
    }
  }

  async function acceptParkInvite(token: string) {
    isLoadingParkInvite.value = true
    errorMessage.value = ''

    try {
      return await acceptDriverParkInvite(token)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось принять приглашение таксопарка.')
      throw error
    }
    finally {
      isLoadingParkInvite.value = false
    }
  }

  function clearDriverState() {
    profile.value = null
    // Через clearOffer, а не присваиванием: иначе таймер истечения переживёт
    // логаут и через минуту дёрнет уже чужое состояние.
    clearOffer()
    dismissCancelledBanner()
    clearActiveTripState()
    isOnline.value = false
    isAvailable.value = false
    isLoadingProfile.value = false
    isMutatingOffer.value = false
    isLoadingParkInvite.value = false
    availableCategories.value = []
    activeCategories.value = []
    availableDistricts.value = []
    activeDistrictIds.value = []
    districtsCity.value = ''
    isSavingDistricts.value = false
    homeMode.value = null
    isMutatingHomeMode.value = false
    isLoadingCategories.value = false
    isSavingCategories.value = false
    hasLoadedCategories.value = false
    errorMessage.value = ''
  }

  return {
    acceptOffer,
    acceptParkInvite,
    activeCategories,
    activeOffer,
    activeTrip,
    activeTripStep,
    advanceNavPoint,
    applyStatus,
    applyTripStatus,
    availableCategories,
    canAdvanceNavPoint,
    geoGate,
    liveLocation,
    liveLocationUntilLabel,
    cancelTrip,
    currentNavPoint,
    clearDriverState,
    clearOffer,
    completeTrip,
    currentTripId,
    ensureProfile,
    errorMessage,
    expireOffer,
    hasActiveTrip,
    hasLoadedCategories,
    isAvailable,
    isChangingStatus,
    isLoadingCategories,
    isLoadingParkInvite,
    isLoadingProfile,
    isMutatingOffer,
    isOnline,
    isRestoringActiveTrip,
    isSavingCategories,
    loadCategories,
    markArrived,
    availableDistricts,
    activeDistrictIds,
    districtsCity,
    isSavingDistricts,
    loadDistricts,
    toggleDistrict,
    clearDistricts,
    homeMode,
    isHomeModeActive,
    isMutatingHomeMode,
    loadHomeMode,
    activateHome,
    deactivateHome,
    passengerCancelledBanner,
    dismissCancelledBanner,
    pendingOffer,
    pendingRouteChange,
    isAnsweringRouteChange,
    acceptRouteChange,
    rejectRouteChange,
    refreshRouteChange,
    profile,
    receiveOffer,
    refreshActiveTrip,
    rejectOffer,
    restoreActiveTrip,
    setOnline,
    startTrip,
    toggleCategory,
    tripNavPoints,
    passedStopCount,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverStore as any, import.meta.hot))
