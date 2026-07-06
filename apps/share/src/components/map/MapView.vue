<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { PassengerDriverLocation } from '@edtaxi/shared/types/websocket'
import { useMapboxMap } from '@edtaxi/shared/composables/mapbox/useMapboxMap'
import { useMapboxPicker } from '@edtaxi/shared/composables/mapbox/useMapboxPicker'
import { useMapboxRoute } from '@edtaxi/shared/composables/mapbox/useMapboxRoute'
import PassengerMapPicker from '~/components/passenger/PassengerMapPicker.vue'
import 'mapbox-gl/dist/mapbox-gl.css'

interface PassengerMapPickerExpose {
  panelElement: HTMLElement | null
}

const props = withDefaults(defineProps<{
  destinationPlace?: GeoPlace | null
  // Класс машины поездки — выбирает иконку маркера (эконом/бизнес/мото...).
  driverCategory?: null | string
  driverLocation?: PassengerDriverLocation | null
  driverView?: boolean
  favoritePlaces?: GeoPlace[]
  focusUserOnFirstFix?: boolean
  pickerMode?: MapPickerMode | null
  pickupPlace?: GeoPlace | null
  routeCoordinates?: RouteCoordinate[]
  showRoute?: boolean
  userCoordinates?: UserCoordinates | null
}>(), {
  destinationPlace: null,
  driverCategory: null,
  driverLocation: null,
  driverView: false,
  favoritePlaces: () => [],
  focusUserOnFirstFix: false,
  pickerMode: null,
  pickupPlace: null,
  routeCoordinates: () => [],
  showRoute: false,
  userCoordinates: null,
})

const emit = defineEmits<{
  cancelPicker: []
  confirmPicker: [place: GeoPlace, mode: MapPickerMode]
  selectFavorite: [place: GeoPlace]
}>()

const mapContainer = ref<HTMLElement | null>(null)
const mapPicker = ref<PassengerMapPickerExpose | null>(null)
const pickerScreenPoint = ref<[number, number] | null>(null)
const routeCoordinates = computed(() => props.routeCoordinates)
const hasRoute = computed(() => props.showRoute && routeCoordinates.value.length >= 2)
const pickerMode = computed(() => props.pickerMode)
let pickerLayoutObserver: ResizeObserver | undefined
let hasFocusedUser = false

const {
  clearFavoriteLocations,
  destroyMap,
  hideCurrentMarker,
  hideDriverLocation,
  initializeMap,
  map,
  mapboxglModule,
  mapError,
  showDestinationLocation,
  showDriverLocation,
  showFavoriteLocations,
  showPickupLocation,
  showSelfCarLocation,
  showUserLocation,
} = useMapboxMap(mapContainer)

const {
  clearRoute,
  showTripRoute,
} = useMapboxRoute({
  destinationPlace: computed(() => props.destinationPlace),
  hasRoute,
  map,
  mapboxglModule,
  pickupPlace: computed(() => props.pickupPlace),
  routeCoordinates,
})

const {
  confirmPicker,
  isConfirmingPicker,
  isPickingLocation,
  pickerError,
  pickerTitle,
} = useMapboxPicker({
  clearRoute,
  getPickerScreenPoint: () => pickerScreenPoint.value,
  hasRoute,
  hideCurrentMarker,
  map,
  onConfirm: (place, mode) => emit('confirmPicker', place, mode),
  pickerMode,
  routeCoordinates,
  userCoordinates: computed(() => props.userCoordinates),
})

// Избранные места показываем синими пинами только в режиме простоя —
// когда пользователь ещё не выбрал точку назначения, не строится маршрут
// и не активен выбор точки на карте. Иначе они мешали бы меткам A/B.
const shouldShowFavorites = computed(() =>
  !props.driverView
  && props.favoritePlaces.length > 0
  && !props.destinationPlace
  && !hasRoute.value
  && !isPickingLocation.value,
)

function syncFavoriteMarkers() {
  if (!map.value)
    return

  if (shouldShowFavorites.value)
    showFavoriteLocations(props.favoritePlaces, { onSelect: place => emit('selectFavorite', place) })
  else
    clearFavoriteLocations()
}

watch([shouldShowFavorites, () => props.favoritePlaces], syncFavoriteMarkers, { deep: true })

function updatePickerScreenPoint() {
  if (!mapContainer.value)
    return

  const mapRect = mapContainer.value.getBoundingClientRect()
  const panelElement = mapPicker.value?.panelElement ?? null
  const panelTop = panelElement
    ? panelElement.getBoundingClientRect().top - mapRect.top - 16
    : mapRect.height

  const topBoundary = 0
  const bottomBoundary = Math.max(topBoundary + 160, panelTop)

  pickerScreenPoint.value = [
    mapRect.width / 2,
    topBoundary + (bottomBoundary - topBoundary) / 2,
  ]
}

function syncPickerLayout() {
  updatePickerScreenPoint()

  pickerLayoutObserver?.disconnect()
  pickerLayoutObserver = new ResizeObserver(updatePickerScreenPoint)

  if (mapContainer.value)
    pickerLayoutObserver.observe(mapContainer.value)

  if (mapPicker.value?.panelElement)
    pickerLayoutObserver.observe(mapPicker.value.panelElement)

  window.addEventListener('resize', updatePickerScreenPoint)
  window.addEventListener('orientationchange', updatePickerScreenPoint)
  window.visualViewport?.addEventListener('resize', updatePickerScreenPoint)
}

function stopPickerLayoutSync() {
  pickerLayoutObserver?.disconnect()
  pickerLayoutObserver = undefined
  window.removeEventListener('resize', updatePickerScreenPoint)
  window.removeEventListener('orientationchange', updatePickerScreenPoint)
  window.visualViewport?.removeEventListener('resize', updatePickerScreenPoint)
}

watch(
  [() => props.showRoute, routeCoordinates],
  ([showRoute]) => {
    if (!map.value)
      return

    if (isPickingLocation.value)
      return

    if (showRoute && hasRoute.value) {
      hideCurrentMarker()
      showTripRoute()
      return
    }

    clearRoute()
  },
  { deep: true },
)

watch(isPickingLocation, async (isPicking) => {
  if (!isPicking) {
    stopPickerLayoutSync()
    pickerScreenPoint.value = null
    return
  }

  await nextTick()
  syncPickerLayout()
})

watch(
  () => props.pickupPlace,
  (place) => {
    if (!place || hasRoute.value)
      return

    showPickupLocation(place, {
      focus: !isPickingLocation.value,
    })
  },
)

watch(
  () => props.destinationPlace,
  (place) => {
    if (!place || hasRoute.value)
      return

    showDestinationLocation(place, {
      focus: !isPickingLocation.value,
    })
  },
)

watch(
  () => props.userCoordinates,
  (coordinates) => {
    if (!coordinates)
      return

    const shouldFocus = props.focusUserOnFirstFix && !hasFocusedUser

    if (props.driverView)
      showSelfCarLocation(coordinates, { focus: shouldFocus })
    else
      showUserLocation(coordinates, { focus: shouldFocus })

    hasFocusedUser = hasFocusedUser || shouldFocus
  },
)

watch(
  [() => props.driverLocation, () => props.driverCategory],
  ([location]) => {
    if (!location) {
      hideDriverLocation()
      return
    }

    showDriverLocation(location, { category: props.driverCategory })
  },
)

onMounted(async () => {
  await initializeMap(() => {
    if (props.userCoordinates) {
      if (props.driverView)
        showSelfCarLocation(props.userCoordinates, { focus: props.focusUserOnFirstFix })
      else
        showUserLocation(props.userCoordinates, { focus: props.focusUserOnFirstFix })
    }

    if (props.userCoordinates && props.focusUserOnFirstFix) {
      hasFocusedUser = true
    }

    if (props.driverLocation)
      showDriverLocation(props.driverLocation, { category: props.driverCategory })

    if (props.pickupPlace && !hasRoute.value) {
      showPickupLocation(props.pickupPlace, {
        focus: !isPickingLocation.value,
      })
    }

    if (hasRoute.value) {
      hideCurrentMarker()
      showTripRoute()
    }

    syncFavoriteMarkers()
  })
})

onBeforeUnmount(() => {
  stopPickerLayoutSync()
  destroyMap(clearRoute)
})
</script>

<template>
  <div class="absolute inset-0">
    <div ref="mapContainer" class="h-full w-full" />

    <PassengerMapPicker
      v-if="isPickingLocation"
      ref="mapPicker"
      :error="pickerError"
      :is-confirming="isConfirmingPicker"
      :screen-point="pickerScreenPoint"
      :title="pickerTitle"
      @cancel="emit('cancelPicker')"
      @confirm="confirmPicker"
    />

    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center bg-secondary-950 px-8 text-center text-sm text-slate-300 font-800"
    >
      {{ mapError }}
    </div>
  </div>
</template>
