<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import { getDestinationSuggestions } from '~/api/trips'
import AddressForm from '~/components/passenger/downbar/AddressForm.vue'
import SearchingTrip from '~/components/passenger/downbar/SearchingTrip.vue'
import TariffList from '~/components/passenger/downbar/TariffList.vue'
import { useAddressSearch } from '~/composables/passenger/useAddressSearch'
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
</script>

<template>
  <section class="tg-safe-x absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-20">
    <div class="mx-auto max-h-[calc(var(--app-viewport-height)-var(--app-safe-area-top)-var(--app-safe-area-bottom)-13rem)] max-w-sm overflow-y-auto border border-white/10 rounded-[2rem] bg-secondary-950/82 px-3 pb-3 pt-2.5 text-white shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
      <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/14" />

      <component
        :is="activeDownbarView"
        v-bind="activeDownbarProps"
        @edit-route="trips.clearEstimate"
        @locate-user="emit('locateUser')"
        @pick-from-map="emit('pickFromMap', $event)"
        @search-destination="searchDestination"
        @search-pickup="searchPickup"
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
  </section>
</template>
