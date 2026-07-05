<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import type { SheetSnap } from '~/composables/passenger/useBottomSheet'
import { getDestinationSuggestions } from '~/api/trips'
import AddressForm from '~/components/passenger/downbar/AddressForm.vue'
import SearchingTrip from '~/components/passenger/downbar/SearchingTrip.vue'
import TariffList from '~/components/passenger/downbar/TariffList.vue'
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

const downbarViews = {
  address: markRaw(AddressForm),
  searching: markRaw(SearchingTrip),
  tariffs: markRaw(TariffList),
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

const activeDownbarView = computed(() => {
  if (isSearching.value)
    return downbarViews.searching

  if (isTariffsVisible.value)
    return downbarViews.tariffs

  return downbarViews.address
})

const activeDownbarProps = computed(() => {
  if (isSearching.value) {
    return {
      activeTrip: trips.activeTrip,
      destination: destination.value,
      elapsedSeconds: trips.searchElapsedSeconds,
      isPolling: trips.isPollingActiveTrip,
      pickup: pickup.value,
      selectedCategories: trips.selectedCategories,
      selectedEstimate: selectedEstimate.value,
    }
  }

  if (isTariffsVisible.value) {
    return {
      destination: destination.value,
      estimates: trips.tariffEstimates,
      pickup: pickup.value,
      selectedCategories: trips.selectedCategories,
    }
  }

  return {
    destination: destination.value,
    destinationSuggestions: destinationSuggestions.value,
    isLocatingUser: isLocatingUser.value,
    isSearchingDestination: isSearchingDestination.value,
    isSearchingPickup: isSearchingPickup.value,
    pickup: pickup.value,
    pickupSuggestions: pickupSuggestions.value,
    quickDestinations: quickDestinations.value,
  }
})

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
      // Список тарифов + кнопка на виду, `full` — чтобы увидеть все.
      return ['half', 'full']
    default:
      // Адрес: свернуть на карту, рабочая высота, полный экран под саджест.
      return ['peek', 'half', 'full']
  }
})

const { dragging, sheetStyle, snapTo } = useBottomSheet({
  boundsEl,
  contentEl,
  handleEl,
  initialSnap: 'half',
  sheetEl,
  snaps: sheetSnaps,
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
      class="will-change-[height] pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden border border-white/10 rounded-[2rem] text-white shadow-[0_-18px_54px_rgba(0,0,0,0.34)]"
      :class="dragging ? 'bg-secondary-950/95' : 'bg-secondary-950/82 backdrop-blur-2xl'"
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
        <div class="mx-auto h-1 w-10 rounded-full bg-white/14" />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div ref="contentEl">
          <component
            :is="activeDownbarView"
            v-bind="activeDownbarProps"
            @edit-route="trips.clearEstimate"
            @locate-user="emit('locateUser')"
            @pick-from-map="emit('pickFromMap', $event)"
            @search-destination="expandForInput(searchDestination)"
            @search-pickup="expandForInput(searchPickup)"
            @toggle-category="trips.toggleCategory"
            @select-destination="selectDestination"
            @select-pickup="selectPickup"
            @update:destination="destination = $event"
            @update:pickup="pickup = $event"
          />

          <button
            v-if="!isSearching"
            :disabled="!canSubmit || isBusy"
            class="mt-3 h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:shadow-none"
            type="button"
            @click="submitTrip"
          >
            {{ primaryText }}
          </button>

          <button
            v-else-if="isActiveTripFinished"
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
        </div>
      </div>
    </div>
  </section>
</template>
