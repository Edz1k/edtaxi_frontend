<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import type { SheetSnap } from '~/composables/passenger/useBottomSheet'
import { getDestinationSuggestions } from '~/api/trips'
import AddressForm from '~/components/passenger/downbar/AddressForm.vue'
import DestinationFirstScreen from '~/components/passenger/downbar/DestinationFirstScreen.vue'
import SearchingTrip from '~/components/passenger/downbar/SearchingTrip.vue'
import TariffStage from '~/components/passenger/downbar/TariffStage.vue'
import { useAddressSearch } from '~/composables/passenger/useAddressSearch'
import { useBottomSheet } from '~/composables/passenger/useBottomSheet'
import { useTripOrderFlow } from '~/composables/passenger/useTripOrderFlow'

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
      // Адрес: первый экран (Такси + Куда едем + частые) ↔ полный поиск.
      return ['half', 'full']
  }
})

const { active, dragging, sheetStyle, snapTo } = useBottomSheet({
  boundsEl,
  contentEl,
  handleEl,
  // Стартуем на первом экране адреса (Такси + Куда едем + частые адреса).
  initialSnap: 'half',
  sheetEl,
  snaps: sheetSnaps,
})

// Полный поиск адреса открыт: шторка на full в состоянии адреса. Первый экран
// в этот момент прячем (visibility), а сам оверлей держим прозрачным — фон
// рисует только шторка, поэтому цветового шва между слоями нет.
const isAddressSearchOpen = computed(() => active.value === 'full' && sheetState.value === 'address')

// Свёрнутая шторка во время активной поездки: вместо торчащего верха контента
// показываем компактную пилюлю-статус (в стиле кнопки «Куда едем?»).
const isSearchPillVisible = computed(() => active.value === 'peek' && sheetState.value === 'searching')

function formatElapsed(total: number) {
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const searchPillTitle = computed(() => {
  switch (trips.activeTrip?.status) {
    case 'driver_assigned': return 'Водитель едет к вам'
    case 'driver_arriving': return 'Водитель на месте'
    case 'in_progress': return 'Вы в пути'
    case 'completed': return 'Поездка завершена'
    case 'cancelled': return 'Заказ отменён'
    default: return 'Ищем водителя'
  }
})

const searchPillSubtitle = computed(() => {
  if (!trips.activeTrip || trips.activeTrip.status === 'searching')
    return `Поиск идёт ${formatElapsed(trips.searchElapsedSeconds)}`
  return destination.value ? `До: ${destination.value}` : ''
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
      class="will-change-[height] pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden border border-border/10 rounded-[2rem] text-body shadow-[0_-18px_54px_rgba(0,0,0,0.34)]"
      :class="dragging ? 'bg-surface-strong/95' : 'bg-surface-strong/82 backdrop-blur-2xl'"
      :style="sheetStyle"
    >
      <div
        ref="handleEl"
        aria-label="Потяните, чтобы развернуть или свернуть панель"
        class="shrink-0 cursor-grab touch-none select-none px-3 pb-1.5 pt-2.5 active:cursor-grabbing"
        role="button"
        tabindex="0"
        @keydown="onHandleKeydown"
      >
        <div class="mx-auto h-1 w-10 rounded-full bg-surface/14" />
      </div>

      <div class="relative min-h-0 flex-1">
        <!-- Обычно контент влезает целиком (half подгоняется под него с запасом),
             поэтому скролла нет; auto — страховка для маленьких экранов, когда
             шторка упирается в максимум. Скроллбар скрыт всегда. -->
        <div class="[scrollbar-width:none] h-full overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:hidden">
          <div ref="contentEl" :class="{ invisible: isAddressSearchOpen || isSearchPillVisible }">
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
                Новая поездка
              </button>

              <button
                v-else
                :disabled="trips.isCancelling"
                class="mt-3 h-13 w-full rounded-[1.35rem] bg-red-500/12 text-sm text-red-300 font-950 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                @click="cancelSearch"
              >
                {{ trips.isCancelling ? 'Отменяем...' : 'Отменить поиск' }}
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
             экран остаётся в потоке ради замера half, но невидим. Скролл есть,
             скроллбар скрыт. -->
        <div
          v-show="isAddressSearchOpen"
          class="[scrollbar-width:none] absolute inset-0 overflow-y-auto px-3 pb-3 pt-2 [&::-webkit-scrollbar]:hidden"
        >
          <AddressForm
            :destination="destination"
            :destination-suggestions="destinationSuggestions"
            :is-locating-user="isLocatingUser"
            :is-searching-destination="isSearchingDestination"
            :is-searching-pickup="isSearchingPickup"
            :pickup="pickup"
            :pickup-suggestions="pickupSuggestions"
            :quick-destinations="quickDestinations"
            @locate-user="emit('locateUser')"
            @pick-from-map="emit('pickFromMap', $event)"
            @search-destination="searchDestination"
            @search-pickup="searchPickup"
            @select-destination="chooseDestination"
            @select-pickup="selectPickup"
            @update:destination="destination = $event"
            @update:pickup="pickup = $event"
          />

          <button
            v-if="canSubmit"
            :disabled="isBusy"
            class="mt-3 h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:shadow-none"
            type="button"
            @click="submitTrip"
          >
            {{ primaryText }}
          </button>
        </div>

        <!-- Свёрнутый статус поездки: компактная пилюля (пульс + статус + таймер),
             тап раскрывает шторку. Фон прозрачный — рисует шторка. -->
        <button
          v-show="isSearchPillVisible"
          class="absolute inset-0 flex items-center justify-between gap-3 px-5 text-left transition active:scale-[0.99]"
          type="button"
          @click="snapTo('half')"
        >
          <span class="min-w-0 flex items-center gap-3">
            <span class="relative h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span class="absolute inset-0 animate-ping rounded-full bg-main-400/60" />
              <span class="absolute inset-0 rounded-full bg-main-400" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-base font-950 leading-tight">{{ searchPillTitle }}</span>
              <span v-if="searchPillSubtitle" class="block truncate text-xs text-body/45 font-800 tabular-nums">
                {{ searchPillSubtitle }}
              </span>
            </span>
          </span>
          <span class="i-mdi-chevron-up shrink-0 text-6 text-body/40" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
</template>
