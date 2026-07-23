<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import type { SheetSnap } from '~/composables/passenger/useBottomSheet'
import { openExternalLink } from '@edtaxi/shared/composables/auth/telegram'
import { getDestinationSuggestions } from '~/api/trips'
import CardBrandMark from '~/components/CardBrandMark.vue'
import AddressForm from '~/components/passenger/downbar/AddressForm.vue'
import DestinationFirstScreen from '~/components/passenger/downbar/DestinationFirstScreen.vue'
import PaymentMethodSheet from '~/components/passenger/downbar/PaymentMethodSheet.vue'
import SearchingTrip from '~/components/passenger/downbar/SearchingTrip.vue'
import TariffStage from '~/components/passenger/downbar/TariffStage.vue'
import TripPreferencesSheet from '~/components/passenger/downbar/TripPreferencesSheet.vue'
import WhoRidesSheet from '~/components/passenger/downbar/WhoRidesSheet.vue'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useAddressSearch } from '~/composables/passenger/useAddressSearch'
import { useBottomSheet } from '~/composables/passenger/useBottomSheet'
import { useTripOrderFlow } from '~/composables/passenger/useTripOrderFlow'
import { isMotoCategory, TARIFF_META } from '~/constants/tariffs'
import { useWalletStore } from '~/stores/wallet'

const props = withDefaults(defineProps<{
  // Реальная геопозиция с карты: сравниваем её с точкой А, чтобы понять, что
  // машину заказывают не себе (useUserLocation живёт на инстанс, поэтому
  // координаты приходят пропом, а не вторым вызовом композабла).
  userCoordinates?: null | UserCoordinates
}>(), { userCoordinates: null })

const emit = defineEmits<{
  locateUser: []
  pickFromMap: [mode: MapPickerMode, stopIndex?: number]
}>()
const pickup = defineModel<string>('pickup', { default: '' })
const destination = defineModel<string>('destination', { default: '' })
const pickupPlace = defineModel<GeoPlace | null>('pickupPlace', { default: null })
const destinationPlace = defineModel<GeoPlace | null>('destinationPlace', { default: null })
const isLocatingUser = defineModel<boolean>('locatingUser', { default: false })
const { t } = useI18n()

const {
  clearSuggestions: clearPickupSuggestions,
  isSearching: isSearchingPickup,
  search: searchPickup,
  searchFailed: searchFailedPickup,
  selectPlace: selectPickup,
  suggestions: pickupSuggestions,
} = useAddressSearch({
  near: pickupPlace,
  query: pickup,
  selectedPlace: pickupPlace,
})

const {
  clearSuggestions: clearDestinationSuggestions,
  isSearching: isSearchingDestination,
  search: searchDestination,
  searchFailed: searchFailedDestination,
  selectPlace: selectDestination,
  suggestions: destinationSuggestions,
} = useAddressSearch({
  // Расстояния и приоритет города меряем от точки А.
  near: pickupPlace,
  query: destination,
  selectedPlace: destinationPlace,
})

const {
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
  resolveRoute,
  selectedEstimate,
  submitTrip,
  trips,
} = useTripOrderFlow({
  clearDestinationSuggestions,
  clearPickupSuggestions,
  destination,
  destinationPlace,
  pickup,
  pickupPlace,
  userCoordinates: toRef(props, 'userCoordinates'),
})

// Кнопка заказа закреплена снаружи прокрутки, поэтому согласие для мототакси
// живёт на уровне всей шторки и управляет её disabled-состоянием.
const motoConsent = ref(false)
const needsMotoConsent = computed(() => isMotoCategory(trips.selectedCategory) && !motoConsent.value)
const wallet = useWalletStore()
const isPaymentSheetOpen = ref(false)
const isPreferencesOpen = ref(false)
const isFriendOrder = ref(Boolean(trips.tripOptions.friendName || trips.tripOptions.friendPhone))
const isMotoSelected = computed(() => trips.selectedCategories.some(isMotoCategory))
const surchargeChildSeat = computed(() => trips.tariffEstimates[0]?.surcharge_child_seat ?? 0)
const surchargePets = computed(() => trips.tariffEstimates[0]?.surcharge_pets ?? 0)

function setFriendOrder(value: boolean) {
  isFriendOrder.value = value
  if (!value) {
    trips.setTripOption('friendName', '')
    trips.setTripOption('friendPhone', '')
  }
}

const preferenceCount = computed(() => [
  trips.tripOptions.childSeat,
  trips.tripOptions.pets,
  trips.tripOptions.accessible,
  isFriendOrder.value,
  Boolean(trips.tripComment.trim()),
].filter(Boolean).length)

const paymentButtonLabel = computed(() => {
  if (trips.paymentMethod === 'cash')
    return 'Наличные'
  if (trips.paymentMethod === 'prepaid')
    return trips.prepaySource === 'apple' ? 'Apple Pay' : 'Google Pay'
  const digits = (wallet.card?.card_pan ?? '').replace(/\D/g, '')
  const tail = digits.slice(-4)
  return tail ? `••${tail}` : 'Карта'
})

onMounted(() => {
  if (!wallet.isCardLoaded)
    wallet.loadCard()
})

// Промежуточные остановки (до 3): фиксированные слоты со своими инстансами
// поиска (композаблы нельзя создавать динамически), видимых строк — stopCount.
// Выбранные места синкаются в стор (стопы едут в маршрут/оценку/заказ),
// тексты строк живут здесь.
const stopQueries = [ref(''), ref(''), ref('')]
const stopPlaces = [ref<GeoPlace | null>(null), ref<GeoPlace | null>(null), ref<GeoPlace | null>(null)]
const stopSearches = stopPlaces.map((selectedPlace, index) => useAddressSearch({
  near: pickupPlace,
  query: stopQueries[index]!,
  selectedPlace,
}))
// Число видимых строк — производное от стора (единственный источник длины):
// стор держит по слоту (в т.ч. null для невыбранных) на каждую строку.
const stopCount = computed(() => trips.stops.length)

function syncStopsToStore() {
  trips.setStops(stopPlaces.slice(0, stopCount.value).map(place => place.value))
}

// Ввод текста сбрасывает выбранное место (useAddressSearch) — стор узнаёт об
// этом отсюда, чтобы недовыбранный стоп не уехал в заказ.
stopPlaces.forEach(place => watch(place, syncStopsToStore))

// Restore черновика из стора (remount даунбара на peek, «заказать ещё одну
// машину»): setStops в сторе игнорирует ресинк без изменений. Длина берётся
// из стора сама (stopCount — computed), заполняем только локальные слоты.
onMounted(() => {
  trips.stops.slice(0, 3).forEach((place, index) => {
    stopPlaces[index]!.value = place
    stopQueries[index]!.value = place?.address ?? ''
  })
})

// Остановку можно задать и снаружи даунбара — выбором точки на карте. Тогда
// место приезжает прямо в стор, а локальные слоты (в них живёт текст инпута)
// об этом не знают: без синка адрес проставился бы в маршрут, а поле осталось
// бы пустым. Сверяем по id, поэтому собственный ввод сюда не возвращается.
watch(() => trips.stops, (next) => {
  next.slice(0, 3).forEach((place, index) => {
    if ((place?.id ?? null) === (stopPlaces[index]?.value?.id ?? null))
      return

    stopPlaces[index]!.value = place
    stopQueries[index]!.value = place?.address ?? ''
  })

  // Стор очистили целиком (новый заказ, отмена): вотчер выше проходит только
  // по оставшимся слотам, поэтому тексты «лишних» строк надо снять отдельно —
  // иначе адрес прошлой поездки остался бы в поле при пустом сторе.
  for (let index = next.length; index < stopPlaces.length; index++) {
    if (!stopPlaces[index]!.value && !stopQueries[index]!.value)
      continue

    stopPlaces[index]!.value = null
    stopQueries[index]!.value = ''
  }
}, { deep: true })

const stopRows = computed(() => Array.from({ length: stopCount.value }, (_, index) => ({
  isSearching: stopSearches[index]!.isSearching.value,
  query: stopQueries[index]!.value,
  searchFailed: stopSearches[index]!.searchFailed.value,
  suggestions: stopSearches[index]!.suggestions.value,
})))

function addStopRow() {
  // Длина растёт в сторе (стор пушит null-слот); stopCount отследит сам.
  trips.addStopRow()
}

function updateStopQuery(index: number, value: string) {
  stopQueries[index]!.value = value
}

// «+ остановка» с тарифного этапа: помечаем ожидание фокуса, добавляем строку и
// чистим оценку — смена sheetState вернёт форму адреса, где watch ниже раскроет
// полный поиск и сфокусирует новую строку (саджест откроется при вводе).
const pendingStopFocus = ref(false)
// Возврат с тарифов по карандашу: форму адресов надо не просто показать, а
// раскрыть шторку на full — иначе она останется скрытой (см. isAddressSearchOpen).
const pendingAddressEdit = ref(false)
const focusStopIndex = ref<number | null>(null)

function addStopFromTariffs() {
  if (!trips.canAddStop)
    return
  pendingStopFocus.value = true
  addStopRow()
  trips.clearEstimate()
}

// Карандаш «изменить маршрут» на экране тарифов. Раньше он звал clearEstimate
// напрямую — и вместо формы адресов пользователь получал стартовый экран
// «Куда едем?»: clearEstimate обнуляет routeCoordinates, tripFlowState падает в
// 'idle', а watch ниже уводит шторку на 'half', где форма скрыта.
//
// Флаг нужен именно watch'у: снапнуть на 'full' прямо здесь не выйдет — watch
// на sheetState отработает следом через nextTick и вернёт 'half'.
function editRouteFromTariffs() {
  pendingAddressEdit.value = true
  trips.clearEstimate()
}

// Крестик очистки в строке А или Б. Модели биндятся прямо на рефы стора
// (map.vue), поэтому наверх ничего тянуть не нужно. Саджесты гасим явно:
// поиск дебаунсится на 300 мс, и без этого список подсказок ещё мгновение
// висел бы под уже пустым полем.
function clearRoutePoint(role: 'destination' | 'pickup') {
  if (role === 'pickup') {
    pickup.value = ''
    pickupPlace.value = null
    clearPickupSuggestions()
    return
  }

  destination.value = ''
  destinationPlace.value = null
  clearDestinationSuggestions()
}

function searchStop(index: number) {
  stopSearches[index]!.search()
}

function selectStop(index: number, place: GeoPlace) {
  stopSearches[index]!.selectPlace(place)
  stopSearches[index]!.clearSuggestions()
  syncStopsToStore()
}

function removeStopRow(index: number) {
  // Сначала сжимаем стор (длина — производная от него), затем подтягиваем
  // локальные слоты текста/поиска под новую расстановку.
  trips.removeStop(index)
  const count = trips.stops.length
  for (let i = index; i < count; i++) {
    stopQueries[i]!.value = stopQueries[i + 1]!.value
    stopPlaces[i]!.value = stopPlaces[i + 1]!.value
  }
  stopQueries[count]!.value = ''
  stopPlaces[count]!.value = null
}

// Пересортировка точек маршрута (drag&drop): роль определяется позицией —
// первая строка становится А, последняя Б, промежуточные — остановками.
// Индексы — позиции в общем списке [А, остановки…, Б].
function reorderRoutePoints(from: number, to: number) {
  if (from === to)
    return

  const points = [
    { place: pickupPlace.value, text: pickup.value },
    ...Array.from({ length: stopCount.value }, (_, i) => ({
      place: stopPlaces[i]!.value,
      text: stopQueries[i]!.value,
    })),
    { place: destinationPlace.value, text: destination.value },
  ]

  const [moved] = points.splice(from, 1)
  if (!moved)
    return
  points.splice(to, 0, moved)

  const last = points.length - 1
  pickup.value = points[0]!.text
  pickupPlace.value = points[0]!.place
  destination.value = points[last]!.text
  destinationPlace.value = points[last]!.place
  points.slice(1, last).forEach((point, i) => {
    stopQueries[i]!.value = point.text
    stopPlaces[i]!.value = point.place
  })

  trips.clearEstimate()
  syncStopsToStore()
  redrawRouteIfComplete()
}

// Мгновенно перерисовываем линию после пересортировки, если все точки
// подтверждены — иначе линия появится на следующем «Показать цены».
function redrawRouteIfComplete() {
  const allStopsConfirmed = stopPlaces.slice(0, stopCount.value).every(place => place.value)
  if (pickupPlace.value && destinationPlace.value && allStopsConfirmed)
    resolveRoute().catch(() => {})
}

// «Умные подсказки» для поля «Куда»: частые и недавние адреса из истории
// поездок пользователя (бэкенд ранжирует). Загружаем один раз; выбор
// подсказки идёт тем же путём, что и выбор из гео-саджеста.
const quickDestinations = ref<QuickDestination[]>([])

onMounted(() => {
  getDestinationSuggestions()
    .then((response) => {
      quickDestinations.value = response.suggestions.map(s => ({
        place: {
          id: `history:${s.lat.toFixed(5)}:${s.lng.toFixed(5)}`,
          name: s.address.split(',')[0]?.trim() || s.address,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
        },
        times: s.times,
      }))
    })
    .catch(() => {}) // истории может не быть — блок просто не показываем
})

const isActiveTripFinished = computed(() => {
  return trips.activeTrip?.status === 'cancelled' || trips.activeTrip?.status === 'completed'
})

// Предоплата (payment_method=prepaid): поездка ждёт оплату в awaiting_payment.
// Фрейм оплаты открывается сам, как только стор получил ссылку (после заказа
// или «Оплатить заказ»), и закрывается, когда оплата подтвердилась — стор
// очищает prepayUrl при переходе поездки в searching.
const isAwaitingPayment = computed(() => trips.activeTrip?.status === 'awaiting_payment')
// Постоплата: поездка завершена, а оплата AP/GP/картой делается СЕЙЧАС по
// итоговой сумме. Кнопка прячется, когда платить уже не за что: retryPrepay
// вернул null (поездка рассчитана / переведена на наличные — бэкенд 409) либо
// payment_method сменился на cash при рефетче.
const isPostpaySettled = ref(false)
const isPostpayDue = computed(() =>
  trips.activeTrip?.status === 'completed'
  && trips.activeTrip?.payment_method === 'prepaid'
  && !isPostpaySettled.value,
)
watch(() => trips.activeTrip?.id, () => {
  isPostpaySettled.value = false
})
const isPrepayFrameOpen = ref(false)
const isRequestingPrepay = ref(false)

// Apple Pay в Telegram-вебвью недоступен (нет ApplePaySession) — страницу
// оплаты открываем во внешнем браузере/Safari View Controller, где кнопка
// Apple Pay работает; Google Pay и карта остаются во фрейме.
function launchPrepay(url: string) {
  if (trips.prepaySource === 'apple') {
    openExternalLink(url)
    return
  }
  isPrepayFrameOpen.value = true
}

watch(() => trips.prepayUrl, (url) => {
  if (url)
    launchPrepay(url)
  else
    isPrepayFrameOpen.value = false
})

function closePrepayFrame() {
  isPrepayFrameOpen.value = false
  // Ссылка одноразовая по смыслу: следующий тап должен получить свежую (у
  // постоплаты сумма фиксируется на момент выписки платежа).
  trips.prepayUrl = ''
  trips.refreshActiveTrip().catch(() => {})
}

async function openPrepay() {
  if (isRequestingPrepay.value)
    return
  if (trips.prepayUrl) {
    launchPrepay(trips.prepayUrl)
    return
  }
  isRequestingPrepay.value = true
  try {
    // retryPrepay кладёт новую ссылку в prepayUrl — watch выше сам откроет
    // фрейм или внешний браузер в зависимости от prepaySource. null без
    // ошибки — платить уже не за что (оплачено/наличные), прячем кнопку.
    const url = await trips.retryPrepay()
    if (!url && isPostpayDue.value)
      isPostpaySettled.value = true
  }
  catch {}
  finally {
    isRequestingPrepay.value = false
  }
}

// После завершения предлагаем заказать ещё одну машину (маршрут уже заполнен),
// после отмены — просто новую поездку.
const finishedButtonLabel = computed(() =>
  trips.activeTrip?.status === 'completed' ? t('downbar.orderAnother') : t('downbar.newTrip'),
)

// Кнопка отмены: пока идёт поиск — «Отменить поиск» в один тап; когда водитель
// уже назначен/едет/в пути — «Отменить заказ» с подтверждением вторым тапом
// (4 секунды на передумать), чтобы заказ не отменялся случайным касанием.
const isCancelArmed = ref(false)
let cancelArmTimer: number | undefined

const cancelButtonLabel = computed(() => {
  if (trips.isCancelling)
    return t('downbar.cancelling')
  if (isCancelArmed.value)
    return t('downbar.cancelConfirm')
  return trips.activeTrip?.status === 'searching' ? t('downbar.cancelSearch') : t('downbar.cancelOrder')
})

function disarmCancel() {
  isCancelArmed.value = false
  if (cancelArmTimer !== undefined) {
    window.clearTimeout(cancelArmTimer)
    cancelArmTimer = undefined
  }
}

function requestCancel() {
  if (trips.isCancelling)
    return

  // Поиск и неоплаченная предоплата отменяются в один тап — водителя ещё нет.
  const status = trips.activeTrip?.status
  if (status && status !== 'searching' && status !== 'awaiting_payment' && !isCancelArmed.value) {
    isCancelArmed.value = true
    cancelArmTimer = window.setTimeout(disarmCancel, 4000)
    return
  }

  disarmCancel()
  cancelSearch()
}

onBeforeUnmount(disarmCancel)

// Выбор адреса назначения (быстрый на первом экране или из поиска) → сразу
// считаем тарифы и уходим на тарифный этап.
function chooseDestination(place: GeoPlace) {
  selectDestination(place)
  nextTick(() => submitTrip())
}

function startNewTrip() {
  trips.resetActiveTrip()
  trips.clearEstimate()
  // Новый заказ начинается с чистой формы (решение владельца): прежний
  // маршрут больше не подставляется. Локальные слоты остановок сбрасывает
  // вотчер ниже — стор для них единственный источник длины.
  trips.clearOrderForm()
}

// Свайп-шторка со снап-точками. Набор точек и высота `half` (content-fit)
// зависят от состояния: адрес / тарифы / поиск.
const boundsEl = ref<HTMLElement>()
const sheetEl = ref<HTMLElement>()
const handleEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()

const sheetState = computed(() => {
  if (isSearching.value)
    return 'searching'
  if (isTariffsVisible.value)
    return 'tariffs'
  return 'address'
})

const sheetSnaps = computed<SheetSnap[]>(() => {
  switch (sheetState.value) {
    case 'searching':
      // Нечего скроллить — только «свернуть на карту» ↔ рабочая высота.
      return ['peek', 'half']
    case 'tariffs':
      // Тарифы: свайпом вниз можно свернуть к карте (peek), рабочая высота
      // (карусель + оплата + заказ), полный экран.
      return ['peek', 'half', 'full']
    default:
      // Адрес: свернуть к карте (peek) ↔ первый экран ↔ полный поиск.
      return ['peek', 'half', 'full']
  }
})

const { active, sheetStyle, snapTo } = useBottomSheet({
  boundsEl,
  contentEl,
  handleEl,
  // Первый экран адреса; но если вернулись с карты/избранного — сразу поиск.
  initialSnap: trips.expandOnReturn ? 'full' : 'half',
  sheetEl,
  snaps: sheetSnaps,
})

// Касание карты приопускает шторку (peek), чтобы карту было видно целиком —
// родитель (map.vue) дергает это по pointerdown на карте. Вернуть шторку:
// свайп/тап по граберу.
defineExpose({
  collapseToMap: () => snapTo('peek'),
})

// Выбор точки с карты/избранного → раскрываем поиск адреса (2-й экран).
// Пик размонтирует даунбар (remount закрывает initialSnap выше); этот watch —
// для избранного, которое выбирается без размонтирования.
watch(() => trips.expandOnReturn, (want) => {
  if (!want)
    return
  trips.expandOnReturn = false
  nextTick(() => snapTo('full'))
})
onMounted(() => {
  if (trips.expandOnReturn)
    trips.expandOnReturn = false
})

// Полный поиск адреса открыт: шторка на full в состоянии адреса. Первый экран
// в этот момент прячем (visibility), а сам оверлей держим прозрачным — фон
// рисует только шторка, поэтому цветового шва между слоями нет.
const isAddressSearchOpen = computed(() => active.value === 'full' && sheetState.value === 'address')

// Пока печатают адрес, таб-бар снаружи прячется (см. layouts/passenger.vue), а
// шторка забирает его высоту: Telegram при клавиатуре сжимает всю мини-аппу, и
// на низких экранах каждый лишний ряд UI съедает форму.
watch(isAddressSearchOpen, (open) => {
  trips.isAddressSearchOpen = open
}, { immediate: true })

onBeforeUnmount(() => {
  trips.isAddressSearchOpen = false
})

// Свёрнутая шторка (peek) в любом состоянии: вместо торчащего обрезанного
// верха контента — компактная пилюля-сводка. Контент при этом скрыт, скроллить
// в свёрнутом виде нечего; тап по пилюле возвращает рабочую высоту.
const isPeekPillVisible = computed(() => active.value === 'peek')

function formatElapsed(total: number) {
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const searchPillTitle = computed(() => {
  switch (trips.activeTrip?.status) {
    case 'awaiting_payment': return t('tripStatus.awaitingPayment')
    case 'driver_assigned': return t('downbar.driverComing')
    case 'driver_arriving': return t('tripStatus.driverArriving')
    case 'in_progress': return t('tripStatus.inProgress')
    case 'completed': return t('downbar.tripCompleted')
    case 'cancelled': return t('downbar.orderCancelled')
    default: return t('downbar.searchingDriver')
  }
})

const searchPillSubtitle = computed(() => {
  if (trips.activeTrip?.status === 'awaiting_payment')
    return t('downbar.payToSearch')
  if (!trips.activeTrip || trips.activeTrip.status === 'searching')
    return t('downbar.searchElapsed', { time: formatElapsed(trips.searchElapsedSeconds) })
  return destination.value ? t('downbar.toDestination', { destination: destination.value }) : ''
})

// Содержимое пилюли по состоянию: активная поездка — статус с пульсом и
// таймером; тарифы — цена заказа и куда едем; адрес — приглашение к поиску.
const peekPill = computed(() => {
  switch (sheetState.value) {
    case 'searching':
      return { pulse: true, subtitle: searchPillSubtitle.value, title: searchPillTitle.value }
    case 'tariffs':
      return {
        icon: TARIFF_META[trips.selectedCategory].icon,
        pulse: false,
        subtitle: destination.value ? t('downbar.toDestination', { destination: destination.value }) : '',
        title: primaryText.value,
      }
    default:
      return { icon: 'i-mdi-magnify', pulse: false, subtitle: '', title: t('dest.whereTo') }
  }
})

// Смена состояния возвращает шторку на рабочую высоту нового вида.
watch(sheetState, () => {
  // Возврат «добавить остановку» с тарифов: форма адреса видна только на full;
  // раскрываем её и после рендера оверлея фокусируем новую строку остановки.
  if (pendingStopFocus.value) {
    pendingStopFocus.value = false
    snapTo('full')
    nextTick(() => {
      focusStopIndex.value = stopCount.value - 1
    })
    return
  }
  // Возврат с тарифов по карандашу: показываем форму адресов с уже
  // заполненными полями, а не стартовый экран.
  if (pendingAddressEdit.value) {
    pendingAddressEdit.value = false
    snapTo('full')
    return
  }
  nextTick(() => snapTo('half'))
})

// Фокус в поле адреса раскрывает шторку под клавиатуру и список подсказок.
function expandForInput(run: () => void) {
  snapTo('full')
  run()
}

function onHandleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    snapTo('full')
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    // peek там, где он есть (тарифы/поиск — свернуть к карте); для адреса
    // резолвится в half (ниже первого экрана сворачивать некуда).
    snapTo('peek')
  }
}
</script>

<template>
  <!-- Рабочая рамка шторки. Обычно снизу резервируем место под таб-бар; во время
       ввода адреса он скрыт — забираем его высоту себе (useBottomSheet сам
       пересчитает maxHeight, он следит за размером этой рамки). -->
  <section
    ref="boundsEl"
    class="tg-safe-x pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-area-top)+3.25rem)] z-20 flex items-end"
    :class="isAddressSearchOpen
      ? 'bottom-[calc(var(--app-safe-area-bottom)+0.75rem)]'
      : 'bottom-[calc(var(--app-safe-area-bottom)+5.75rem)]'"
  >
    <div
      ref="sheetEl"
      class="will-change-[height] pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden border app-border rounded-[2rem] app-sheet text-white shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
      :style="sheetStyle"
    >
      <div
        ref="handleEl"
        :aria-label="t('downbar.handleAria')"
        class="shrink-0 cursor-grab touch-none select-none px-3 pb-3 pt-4 active:cursor-grabbing"
        role="button"
        tabindex="0"
        @keydown="onHandleKeydown"
      >
        <div class="mx-auto h-1.5 w-12 rounded-full bg-white/25" />
      </div>

      <div class="relative min-h-0 flex-1">
        <!-- Обычно контент влезает целиком (half подгоняется под него с запасом),
             поэтому скролла нет; auto — страховка для маленьких экранов, когда
             шторка упирается в максимум. Скроллбар скрыт всегда. -->
        <div class="[scrollbar-width:none] h-full overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:hidden">
          <div
            ref="contentEl"
            :class="{
              'invisible': isAddressSearchOpen || isPeekPillVisible,
              'pb-20': isTariffsVisible,
            }"
          >
            <!-- Тарифы: самодостаточный этап (карусель + оплата + заказ). -->
            <TariffStage
              v-if="isTariffsVisible"
              :moto-consent="motoConsent"
              @add-stop="addStopFromTariffs"
              @edit-route="editRouteFromTariffs"
              @update:moto-consent="motoConsent = $event"
            />

            <!-- Поиск водителя (активная поездка). -->
            <template v-else-if="isSearching">
              <SearchingTrip
                :active-trip="trips.activeTrip"
                :destination="destination"
                :elapsed-seconds="trips.searchElapsedSeconds"
                :pickup="pickup"
                :selected-categories="trips.selectedCategories"
                :selected-estimate="selectedEstimate"
              />

              <button
                v-if="isActiveTripFinished"
                class="mt-3 h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99]"
                type="button"
                @click="startNewTrip"
              >
                {{ finishedButtonLabel }}
              </button>

              <!-- Оплата на платёжной странице: постоплата завершённой поездки
                   (итоговая сумма) или легаси-предоплата в awaiting_payment. -->
              <button
                v-if="isAwaitingPayment || isPostpayDue"
                :disabled="isRequestingPrepay"
                class="mt-3 h-13 w-full flex items-center justify-center gap-2 rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:opacity-60"
                type="button"
                @click="openPrepay"
              >
                <span class="i-mdi-credit-card-fast-outline text-5" aria-hidden="true" />
                {{ isRequestingPrepay ? t('wallet.preparing') : (isPostpayDue ? t('downbar.payTrip') : t('downbar.payOrder')) }}
              </button>

              <button
                v-if="!isActiveTripFinished"
                :disabled="trips.isCancelling"
                class="mt-3 h-13 w-full rounded-[1.35rem] text-sm font-950 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                :class="isCancelArmed ? 'bg-red-500 text-white shadow-[0_12px_30px_rgba(239,68,68,0.3)]' : 'bg-red-500/12 text-red-300'"
                type="button"
                @click="requestCancel"
              >
                {{ cancelButtonLabel }}
              </button>
            </template>

            <!-- Первый экран адреса: заголовок + «Куда едем?» + частые адреса. -->
            <DestinationFirstScreen
              v-else
              :quick-destinations="quickDestinations"
              @expand="expandForInput(searchDestination)"
              @pick-from-map="(mode, stopIndex) => emit('pickFromMap', mode, stopIndex)"
              @select-destination="chooseDestination"
            />
          </div>
        </div>

        <!-- Главный CTA всегда доступен поверх прокрутки тарифов и движется
             вместе со всей шторкой. Нижний padding contentEl не даёт ему
             перекрыть последние настройки. -->
        <div
          v-if="isTariffsVisible && !isPeekPillVisible"
          class="pointer-events-none absolute inset-x-0 bottom-0 z-10 from-secondary-950 via-secondary-950/96 to-transparent bg-gradient-to-t px-3 pb-3 pt-6"
        >
          <div class="pointer-events-auto flex items-stretch gap-2">
            <button
              :aria-label="`Способ оплаты: ${paymentButtonLabel}`"
              class="h-13 w-13 flex shrink-0 items-center justify-center border border-white/9 rounded-[1.2rem] bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.24)] transition active:scale-[0.96] active:bg-white/14"
              type="button"
              @click="isPaymentSheetOpen = true"
            >
              <span v-if="trips.paymentMethod === 'cash'" class="i-mdi-cash text-7 text-emerald-300 drop-shadow-[0_3px_8px_rgba(110,231,183,0.2)]" aria-hidden="true" />
              <span v-else-if="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'apple'" class="i-mdi-apple text-7 drop-shadow-[0_3px_8px_rgba(255,255,255,0.18)]" aria-hidden="true" />
              <span v-else-if="trips.paymentMethod === 'prepaid'" class="i-mdi-google text-6.5 text-blue-300 drop-shadow-[0_3px_8px_rgba(147,197,253,0.2)]" aria-hidden="true" />
              <span v-else class="h-7 w-10 flex scale-125 items-center justify-center" aria-hidden="true">
                <CardBrandMark :brand="wallet.card?.card_brand" />
              </span>
            </button>

            <button
              :disabled="isBusy || needsMotoConsent"
              class="h-13 min-w-0 flex-1 rounded-[1.35rem] bg-main-500 px-3 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.3)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              @click="submitTrip"
            >
              {{ needsMotoConsent ? 'Подтвердите согласие с рисками' : primaryText }}
            </button>

            <button
              :aria-label="preferenceCount ? `Пожелания: выбрано ${preferenceCount}` : 'Пожелания к поездке'"
              class="relative h-13 w-13 flex shrink-0 items-center justify-center border border-main-400/18 rounded-[1.2rem] bg-main-500/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.24)] transition active:scale-[0.96] active:bg-main-500/16"
              type="button"
              @click="isPreferencesOpen = true"
            >
              <span class="i-mdi-tune-variant text-7 text-main-300 drop-shadow-[0_3px_8px_rgba(250,191,38,0.28)]" aria-hidden="true" />
              <span
                v-if="preferenceCount"
                class="absolute right-0.5 top-0.5 h-4.5 min-w-4.5 flex items-center justify-center border border-secondary-950 rounded-full bg-main-500 px-1 text-[9px] text-white font-950 shadow-[0_3px_10px_rgba(230,173,46,0.45)]"
              >
                {{ preferenceCount }}
              </span>
            </button>
          </div>
        </div>

        <!-- Полный поиск адреса — прозрачный оверлей (фон даёт шторка); первый
             экран остаётся в потоке ради замера half, но невидим. Сам оверлей
             не скроллится: шапка и поля зафиксированы, скроллится только
             список адресов внутри AddressForm, кнопка прижата к низу. -->
        <div
          v-show="isAddressSearchOpen"
          class="absolute inset-0 flex flex-col px-3 pb-3 pt-2"
        >
          <AddressForm
            class="min-h-0 flex-1"
            :can-add-stop="stopCount < 3 && Boolean(destinationPlace)"
            :destination="destination"
            :destination-suggestions="destinationSuggestions"
            :focus-stop-index="focusStopIndex"
            :is-locating-user="isLocatingUser"
            :is-searching-destination="isSearchingDestination"
            :is-searching-pickup="isSearchingPickup"
            :pickup="pickup"
            :pickup-suggestions="pickupSuggestions"
            :quick-destinations="quickDestinations"
            :search-failed-destination="searchFailedDestination"
            :search-failed-pickup="searchFailedPickup"
            :stops="stopRows"
            @add-stop="addStopRow"
            @clear-point="clearRoutePoint"
            @locate-user="emit('locateUser')"
            @pick-from-map="(mode, stopIndex) => emit('pickFromMap', mode, stopIndex)"
            @remove-stop="removeStopRow"
            @reorder-points="reorderRoutePoints"
            @search-destination="searchDestination"
            @search-pickup="searchPickup"
            @search-stop="searchStop"
            @select-destination="chooseDestination"
            @select-pickup="selectPickup"
            @select-stop="selectStop"
            @stop-focus-handled="focusStopIndex = null"
            @update:destination="destination = $event"
            @update:pickup="pickup = $event"
            @update:stop="updateStopQuery"
          />

          <button
            v-if="canSubmit"
            :disabled="isBusy"
            class="mt-3 h-13 w-full shrink-0 rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:shadow-none"
            type="button"
            @click="submitTrip"
          >
            {{ primaryText }}
          </button>
        </div>

        <!-- Свёрнутая шторка: компактная пилюля-сводка текущего состояния
             (статус поездки / тариф с ценой / «Куда едем?»), тап раскрывает
             шторку. Фон прозрачный — рисует шторка. -->
        <button
          v-show="isPeekPillVisible"
          class="absolute inset-0 flex items-center justify-between gap-3 px-5 text-left transition active:scale-[0.99]"
          type="button"
          @click="snapTo('half')"
        >
          <span class="min-w-0 flex items-center gap-3">
            <span v-if="peekPill.pulse" class="relative h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span class="absolute inset-0 animate-ping rounded-full bg-main-400/60" />
              <span class="absolute inset-0 rounded-full bg-main-400" />
            </span>
            <span v-else :class="peekPill.icon" class="shrink-0 text-5.5 app-accent" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block truncate text-base font-950 leading-tight">{{ peekPill.title }}</span>
              <span v-if="peekPill.subtitle" class="block truncate text-xs text-white/45 font-800 tabular-nums">
                {{ peekPill.subtitle }}
              </span>
            </span>
          </span>
          <span class="i-mdi-chevron-up shrink-0 text-6 text-white/40" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>

  <PaymentMethodSheet v-if="isPaymentSheetOpen" @close="isPaymentSheetOpen = false" />
  <TripPreferencesSheet
    v-if="isPreferencesOpen"
    :friend-order="isFriendOrder"
    :is-moto-selected="isMotoSelected"
    :surcharge-child-seat="surchargeChildSeat"
    :surcharge-pets="surchargePets"
    @close="isPreferencesOpen = false"
    @update:friend-order="setFriendOrder"
  />

  <!-- «Кто поедет?»: точка подачи далеко от реальной позиции — уточняем
       пассажира до создания заказа. -->
  <WhoRidesSheet
    v-if="isRiderSheetOpen"
    :distance-meters="pickupDistanceMeters"
    :pending="isBusy"
    @close="closeRiderSheet"
    @me="confirmRiderIsMe"
    @other="confirmRiderIsOther"
  />

  <!-- Оплата предоплаченной поездки (Apple Pay / Google Pay / карта на
       странице FreedomPay). Закрывается сам после подтверждения оплаты. -->
  <PaymentFrameModal
    v-if="isPrepayFrameOpen && trips.prepayUrl"
    :url="trips.prepayUrl"
    @close="closePrepayFrame"
  />
</template>
