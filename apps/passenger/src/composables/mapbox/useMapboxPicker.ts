import type { Map } from 'mapbox-gl'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { UserCoordinates } from '~/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import { reverseGeocodePlace } from '~/api/geocoding'

interface UseMapboxPickerOptions {
  clearRoute: () => void
  getPickerScreenPoint?: () => [number, number] | null
  hasRoute: ComputedRef<boolean>
  hideCurrentMarker: () => void
  map: ShallowRef<Map | undefined>
  onConfirm: (place: GeoPlace, mode: MapPickerMode) => void
  pickerMode: Readonly<Ref<MapPickerMode | null>>
  routeCoordinates: ComputedRef<RouteCoordinate[]>
  userCoordinates: Readonly<Ref<UserCoordinates | null>>
}

export function useMapboxPicker(options: UseMapboxPickerOptions) {
  const isConfirmingPicker = ref(false)
  const pickerError = ref('')

  const isPickingLocation = computed(() => Boolean(options.pickerMode.value))
  const pickerTitle = computed(() => options.pickerMode.value === 'pickup' ? 'Выберите точку А' : 'Выберите точку Б')

  async function waitForPickerLayout() {
    await nextTick()

    if (options.getPickerScreenPoint?.())
      return

    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  }

  function getPickerOffset() {
    if (!options.map.value)
      return [0, 0] as [number, number]

    const point = options.getPickerScreenPoint?.()

    if (!point)
      return [0, 0] as [number, number]

    const canvas = options.map.value.getCanvas()

    return [
      point[0] - canvas.clientWidth / 2,
      point[1] - canvas.clientHeight / 2,
    ] as [number, number]
  }

  function flyToPickerPoint(center: [number, number], zoom: number) {
    options.map.value?.flyTo({
      center,
      essential: true,
      offset: getPickerOffset(),
      zoom,
    })
  }

  function movePickerToRoutePoint() {
    if (!options.map.value || !options.pickerMode.value || options.routeCoordinates.value.length < 2)
      return

    const coordinate = options.pickerMode.value === 'pickup'
      ? options.routeCoordinates.value[0]
      : options.routeCoordinates.value[options.routeCoordinates.value.length - 1]

    flyToPickerPoint(coordinate, 15)
  }

  function movePickerToUserLocation() {
    if (!options.map.value || !options.userCoordinates.value)
      return false

    flyToPickerPoint([options.userCoordinates.value.lng, options.userCoordinates.value.lat], 16)

    return true
  }

  watch(
    options.pickerMode,
    async (pickerMode) => {
      pickerError.value = ''

      if (!options.map.value)
        return

      if (!pickerMode)
        return

      await waitForPickerLayout()

      options.clearRoute()
      options.hideCurrentMarker()

      if (!movePickerToUserLocation())
        movePickerToRoutePoint()
    },
  )

  async function confirmPicker() {
    if (!options.map.value || !options.pickerMode.value || isConfirmingPicker.value)
      return

    const pickerPoint = options.getPickerScreenPoint?.()
    const center = pickerPoint
      ? options.map.value.unproject(pickerPoint)
      : options.map.value.getCenter()
    const mode = options.pickerMode.value

    isConfirmingPicker.value = true
    pickerError.value = ''

    try {
      const place = await reverseGeocodePlace(center.lng, center.lat)
      options.onConfirm(place, mode)
    }
    catch (error) {
      pickerError.value = error instanceof Error
        ? error.message
        : 'Не удалось определить адрес.'
    }
    finally {
      isConfirmingPicker.value = false
    }
  }

  return {
    confirmPicker,
    isConfirmingPicker,
    isPickingLocation,
    pickerError,
    pickerTitle,
  }
}
