<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import type { SheetSnap } from '~/composables/passenger/useBottomSheet'
import { openExternalLink } from '@edtaxi/shared/composables/auth/telegram'
import { getDestinationSuggestions } from '~/api/trips'
import AddressForm from '~/components/passenger/downbar/AddressForm.vue'
import DestinationFirstScreen from '~/components/passenger/downbar/DestinationFirstScreen.vue'
import SearchingTrip from '~/components/passenger/downbar/SearchingTrip.vue'
import TariffStage from '~/components/passenger/downbar/TariffStage.vue'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useAddressSearch } from '~/composables/passenger/useAddressSearch'
import { useBottomSheet } from '~/composables/passenger/useBottomSheet'
import { useTripOrderFlow } from '~/composables/passenger/useTripOrderFlow'
import { TARIFF_META } from '~/constants/tariffs'

const emit = defineEmits<{
  locateUser: []
  pickFromMap: [mode: MapPickerMode]
}>()
const pickup = defineModel<string>('pickup', { default: '' })
const destination = defineModel<string>('destination', { default: '' })
const pickupPlace = defineModel<GeoPlace | null>('pickupPlace', { default: null })
const destinationPlace = defineModel<GeoPlace | null>('destinationPlace', { default: null })
const isLocatingUser = defineModel<boolean>('locatingUser', { default: false })

const {
  clearSuggestions: clearPickupSuggestions,
  isSearching: isSearchingPickup,
  search: searchPickup,
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
  isBusy,
  isSearching,
  isTariffsVisible,
  primaryText,
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
const stopCount = ref(0)

function syncStopsToStore() {
  trips.setStops(stopPlaces.slice(0, stopCount.value).map(place => place.value))
}

// Ввод текста сбрасывает выбранное место (useAddressSearch) — стор узнаёт об
// этом отсюда, чтобы недовыбранный стоп не уехал в заказ.
stopPlaces.forEach(place => watch(place, syncStopsToStore))

// Restore черновика из стора (remount даунбара на peek, «заказать ещё одну
// машину»): setStops в сторе игнорирует ресинк без изменений.
onMounted(() => {
  stopCount.value = Math.min(3, trips.stops.length)
  trips.stops.slice(0, 3).forEach((place, index) => {
    stopPlaces[index]!.value = place
    stopQueries[index]!.value = place?.address ?? ''
  })
})

const stopRows = computed(() => Array.from({ length: stopCount.value }, (_, index) => ({
  isSearching: stopSearches[index]!.isSearching.value,
  query: stopQueries[index]!.value,
  suggestions: stopSearches[index]!.suggestions.value,
})))

function addStopRow() {
  if (stopCount.value >= 3)
    return
  stopCount.value++
  trips.addStopRow()
}

function updateStopQuery(index: number, value: string) {
  stopQueries[index]!.value = value
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
  // Сдвигаем слоты выше удалённого вверх, хвост очищаем.
  for (let i = index; i < stopCount.value - 1; i++) {
    stopQueries[i]!.value = stopQueries[i + 1]!.value
    stopPlaces[i]!.value = stopPlaces[i + 1]!.value
  }
  const last = stopCount.value - 1
  stopQueries[last]!.value = ''
  stopPlaces[last]!.value = null
  stopCount.value--
  syncStopsToStore()
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
    // фрейм или внешний браузер в зависимости от prepaySource.
    await trips.retryPrepay()
  }
  catch {}
  finally {
    isRequestingPrepay.value = false
  }
}

// После завершения предлагаем заказать ещё одну машину (маршрут уже заполнен),
// после отмены — просто новую поездку.
const finishedButtonLabel = computed(() =>
  trips.activeTrip?.status === 'completed' ? 'Заказать ещё одну машину' : 'Новая поездка',
)

// Кнопка отмены: пока идёт поиск — «Отменить поиск» в один тап; когда водитель
// уже назначен/едет/в пути — «Отменить заказ» с подтверждением вторым тапом
// (4 секунды на передумать), чтобы заказ не отменялся случайным касанием.
const isCancelArmed = ref(false)
let cancelArmTimer: number | undefined

const cancelButtonLabel = computed(() => {
  if (trips.isCancelling)
    return 'Отменяем...'
  if (isCancelArmed.value)
    return 'Точно отменить? Нажмите ещё раз'
  return trips.activeTrip?.status === 'searching' ? 'Отменить поиск' : 'Отменить заказ'
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
    case 'awaiting_payment': return 'Ожидание оплаты'
    case 'driver_assigned': return 'Водитель едет к вам'
    case 'driver_arriving': return 'Водитель на месте'
    case 'in_progress': return 'Вы в пути'
    case 'completed': return 'Поездка завершена'
    case 'cancelled': return 'Заказ отменён'
    default: return 'Ищем водителя'
  }
})

const searchPillSubtitle = computed(() => {
  if (trips.activeTrip?.status === 'awaiting_payment')
    return 'Оплатите заказ, чтобы начать поиск'
  if (!trips.activeTrip || trips.activeTrip.status === 'searching')
    return `Поиск идёт ${formatElapsed(trips.searchElapsedSeconds)}`
  return destination.value ? `До: ${destination.value}` : ''
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
        subtitle: destination.value ? `До: ${destination.value}` : '',
        title: primaryText.value,
      }
    default:
      return { icon: 'i-mdi-magnify', pulse: false, subtitle: '', title: 'Куда едем?' }
  }
})

// Смена состояния возвращает шторку на рабочую высоту нового вида.
watch(sheetState, () => {
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
  <section
    ref="boundsEl"
    class="tg-safe-x pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] top-[calc(var(--app-safe-area-top)+3.25rem)] z-20 flex items-end"
  >
    <div
      ref="sheetEl"
      class="will-change-[height] pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden border border-white/10 rounded-[2rem] bg-secondary-950/82 text-white shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
      :style="sheetStyle"
    >
      <div
        ref="handleEl"
        aria-label="Потяните, чтобы развернуть или свернуть панель"
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
          <div ref="contentEl" :class="{ invisible: isAddressSearchOpen || isPeekPillVisible }">
            <!-- Тарифы: самодостаточный этап (карусель + оплата + заказ). -->
            <TariffStage
              v-if="isTariffsVisible"
              :is-ordering="isBusy"
              :primary-text="primaryText"
              @edit-route="trips.clearEstimate"
              @order="submitTrip"
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

              <!-- Предоплата не подтверждена: открыть оплату повторно -->
              <button
                v-if="isAwaitingPayment"
                :disabled="isRequestingPrepay"
                class="mt-3 h-13 w-full flex items-center justify-center gap-2 rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:opacity-60"
                type="button"
                @click="openPrepay"
              >
                <span class="i-mdi-credit-card-fast-outline text-5" aria-hidden="true" />
                {{ isRequestingPrepay ? 'Готовим оплату...' : 'Оплатить заказ' }}
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
              @pick-from-map="emit('pickFromMap', $event)"
              @select-destination="chooseDestination"
            />
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
            :can-add-stop="stopCount < 3"
            :destination="destination"
            :destination-suggestions="destinationSuggestions"
            :is-locating-user="isLocatingUser"
            :is-searching-destination="isSearchingDestination"
            :is-searching-pickup="isSearchingPickup"
            :pickup="pickup"
            :pickup-suggestions="pickupSuggestions"
            :quick-destinations="quickDestinations"
            :stops="stopRows"
            @add-stop="addStopRow"
            @locate-user="emit('locateUser')"
            @pick-from-map="emit('pickFromMap', $event)"
            @remove-stop="removeStopRow"
            @search-destination="searchDestination"
            @search-pickup="searchPickup"
            @search-stop="searchStop"
            @select-destination="chooseDestination"
            @select-pickup="selectPickup"
            @select-stop="selectStop"
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
            <span v-else :class="peekPill.icon" class="shrink-0 text-5.5 text-main-300" aria-hidden="true" />
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

  <!-- Оплата предоплаченной поездки (Apple Pay / Google Pay / карта на
       странице FreedomPay). Закрывается сам после подтверждения оплаты. -->
  <PaymentFrameModal
    v-if="isPrepayFrameOpen && trips.prepayUrl"
    :url="trips.prepayUrl"
    @close="closePrepayFrame"
  />
</template>
