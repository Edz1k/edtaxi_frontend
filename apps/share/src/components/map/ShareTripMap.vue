<script setup lang="ts">
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { PassengerDriverLocation } from '@edtaxi/shared/types/websocket'
import type { Marker } from 'mapbox-gl'
import { useMapboxMap } from '@edtaxi/shared/composables/mapbox/useMapboxMap'
import { createPointElement, useMapboxRoute } from '@edtaxi/shared/composables/mapbox/useMapboxRoute'
import 'mapbox-gl/dist/mapbox-gl.css'

// Живая карта share-страницы. В отличие от карт мини-аппов ей не нужны
// пикер точки, избранное и своя геолокация — только маршрут и машинка.
// Ключевые отличия от прежнего (скопированного у пассажира) MapView:
// - камера подгоняется под маршрут ОДИН раз; поллинг и обновления позиции
//   её больше не трогают — картой можно свободно крутить/двигать/зумить;
// - машинка не телепортируется раз в поллинг, а плавно доезжает до новой
//   точки (rAF-анимация) и поворачивается по курсу.
const props = withDefaults(defineProps<{
  destinationPlace?: GeoPlace | null
  // Класс машины поездки — выбирает иконку маркера (эконом/бизнес/мото...).
  driverCategory?: null | string
  driverLocation?: null | PassengerDriverLocation
  pickupPlace?: GeoPlace | null
  routeCoordinates?: RouteCoordinate[]
  showRoute?: boolean
}>(), {
  destinationPlace: null,
  driverCategory: null,
  driverLocation: null,
  pickupPlace: null,
  routeCoordinates: () => [],
  showRoute: false,
})

// Анимация чуть короче интервала поллинга (4 сек), чтобы машинка успевала
// доехать до точки раньше, чем придёт следующая.
const CAR_ANIMATION_MS = 3_000
// Ближе этого движение считаем GPS-дрожанием: позицию доводим, курс не трогаем.
const MIN_BEARING_DISTANCE_M = 3

const mapContainer = ref<HTMLElement | null>(null)
const routeCoordinates = computed(() => props.routeCoordinates)
const hasRoute = computed(() => props.showRoute && routeCoordinates.value.length >= 2)

const {
  destroyMap,
  driverMarker,
  hideDriverLocation,
  initializeMap,
  map,
  mapboxglModule,
  mapError,
  showDriverLocation,
} = useMapboxMap(mapContainer)

const { clearRoute, restoreRoute, showTripRoute } = useMapboxRoute({
  destinationPlace: computed(() => props.destinationPlace),
  hasRoute,
  map,
  mapboxglModule,
  pickupPlace: computed(() => props.pickupPlace),
  routeCoordinates,
})

// ===== Точки А/Б и камера ДО прихода маршрута =====
//
// Раньше до загрузки геометрии карта показывала захардкоженный центр (Алматы)
// без единой метки — для поездки в Астане страница выглядела пустой и «не той».
// Теперь: карта создаётся сразу с центром между А и Б (initialCenter ниже),
// пины ставятся немедленно из координат поездки, камера подгоняется по двум
// точкам. Когда придёт маршрут — его отрисовка (showTripRoute) нарисует свои
// маркеры и линию, а провизорные пины снимаются.

const provisionalMarkers: Marker[] = []

function clearProvisionalPoints() {
  provisionalMarkers.forEach(item => item.remove())
  provisionalMarkers.length = 0
}

function showProvisionalPoints() {
  const mapInstance = map.value
  const gl = mapboxglModule.value
  const from = props.pickupPlace
  const to = props.destinationPlace
  if (!mapInstance || !gl || hasRoute.value || !from || !to)
    return

  clearProvisionalPoints()
  provisionalMarkers.push(
    new gl.default.Marker({ anchor: 'bottom', element: createPointElement('A', '#e6ad2e') })
      .setLngLat([from.lng, from.lat])
      .addTo(mapInstance),
    new gl.default.Marker({ anchor: 'bottom', element: createPointElement('B', '#ef4444') })
      .setLngLat([to.lng, to.lat])
      .addTo(mapInstance),
  )

  const bounds = new gl.default.LngLatBounds([from.lng, from.lat], [from.lng, from.lat])
  bounds.extend([to.lng, to.lat])
  // Паддинги повторяют fitRoute из useMapboxRoute — камера не прыгает, когда
  // провизорный fit сменится маршрутным.
  mapInstance.fitBounds(bounds, {
    maxZoom: 13,
    padding: { bottom: 290, left: 48, right: 48, top: 110 },
  })
}

watch([map, () => props.pickupPlace, () => props.destinationPlace], showProvisionalPoints)

// ===== Камера: fitBounds только при первом появлении маршрута =====

let didFitRoute = false

// Единая точка синхронизации маршрута: срабатывает и когда карта готова
// раньше данных, и когда данные пришли раньше карты (map — тоже источник
// вотчера). showTripRoute сам дожидается style.load, поэтому звать его можно
// сразу после создания Map, не дожидаясь события load.
function syncRoute() {
  if (!map.value)
    return

  if (!hasRoute.value) {
    clearRoute()
    return
  }

  if (didFitRoute) {
    // Геометрия могла перезаписаться поллингом — перерисовываем линию, но
    // камеру пользователя не трогаем. Пока стиль не догрузился, рисовать
    // нельзя (addSource кидает исключение) — отложенный showTripRoute из
    // первого вызова дорисует актуальные координаты сам.
    if (map.value.isStyleLoaded())
      restoreRoute()
    return
  }

  didFitRoute = true
  clearProvisionalPoints()
  showTripRoute()
}

watch([map, hasRoute, routeCoordinates], syncRoute, { deep: true })

function recenter() {
  if (!map.value || !hasRoute.value)
    return

  showTripRoute()
}

// ===== Машинка: плавное движение и поворот по курсу =====

let carFrame = 0
let carSettleTimer: number | undefined

function stopCarAnimation() {
  if (carFrame) {
    window.cancelAnimationFrame(carFrame)
    carFrame = 0
  }
  if (carSettleTimer !== undefined) {
    window.clearTimeout(carSettleTimer)
    carSettleTimer = undefined
  }
}

function bearingDegrees(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const toRad = Math.PI / 180
  const phi1 = from.lat * toRad
  const phi2 = to.lat * toRad
  const deltaLambda = (to.lng - from.lng) * toRad
  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function distanceMeters(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const toRad = Math.PI / 180
  const dLat = (to.lat - from.lat) * toRad
  const dLng = (to.lng - from.lng) * toRad
  const meanLat = ((from.lat + to.lat) / 2) * toRad
  const earthRadiusM = 6_371_000
  const x = dLng * Math.cos(meanLat)
  return Math.hypot(dLat, x) * earthRadiusM
}

// Поворот по кратчайшей дуге: из 350° в 10° — через север, а не через 340°.
function lerpAngle(from: number, to: number, t: number) {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * t + 360) % 360
}

function animateCarTo(target: PassengerDriverLocation) {
  const marker = driverMarker.value
  if (!marker)
    return

  const from = { lat: marker.getLngLat().lat, lng: marker.getLngLat().lng }
  const fromRotation = marker.getRotation()

  // Курс: heading с бэка (WS-пинги), иначе — направление фактического
  // движения (live location из Telegram приходит без курса, heading=0).
  const movedFarEnough = distanceMeters(from, target) >= MIN_BEARING_DISTANCE_M
  let toRotation = fromRotation
  if (target.heading)
    toRotation = target.heading
  else if (movedFarEnough)
    toRotation = bearingDegrees(from, target)

  stopCarAnimation()
  const startedAt = performance.now()

  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / CAR_ANIMATION_MS)

    marker.setLngLat([
      from.lng + (target.lng - from.lng) * t,
      from.lat + (target.lat - from.lat) * t,
    ])
    marker.setRotation(lerpAngle(fromRotation, toRotation, t))

    carFrame = t < 1 ? window.requestAnimationFrame(step) : 0
    if (!carFrame)
      stopCarAnimation()
  }

  carFrame = window.requestAnimationFrame(step)

  // Страховка: в фоновых/троттленных вкладках rAF не тикает — без неё машинка
  // замирала бы навсегда. Таймер доводит маркер до целевой точки, если
  // анимация не успела; при штатном завершении он уже снят.
  carSettleTimer = window.setTimeout(() => {
    carSettleTimer = undefined
    stopCarAnimation()
    marker.setLngLat([target.lng, target.lat])
    marker.setRotation(toRotation)
  }, CAR_ANIMATION_MS + 200)
}

watch(
  [() => props.driverLocation, () => props.driverCategory],
  ([location, category], [previousLocation, previousCategory]) => {
    if (!map.value)
      return

    if (!location) {
      stopCarAnimation()
      hideDriverLocation()
      return
    }

    // Первое появление или смена класса машины — маркер создаётся/пересоздаётся
    // сразу в целевой точке, анимировать нечего.
    if (!driverMarker.value || !previousLocation || category !== previousCategory) {
      stopCarAnimation()
      showDriverLocation(location, { category: props.driverCategory })
      return
    }

    // Поллинг перезаписывает объект локации даже без движения — не дёргаем
    // анимацию ради той же точки.
    if (location.lat === previousLocation.lat && location.lng === previousLocation.lng)
      return

    animateCarTo(location)
  },
)

// Первая постановка машинки: DOM-маркеру не нужен загруженный стиль, ставим
// сразу как появилась карта (обновления дальше ведёт вотчер driverLocation).
watch(map, () => {
  if (map.value && props.driverLocation && !driverMarker.value)
    showDriverLocation(props.driverLocation, { category: props.driverCategory })
})

// Стартовый центр — середина между А и Б: первая же отрисовка показывает
// город поездки, а не захардкоженный фолбэк (ALMATY_CENTER остаётся только
// на случай, когда компонент смонтировали без координат — на share-странице
// это невозможно: карта рендерится по canShowMap).
onMounted(() => {
  const from = props.pickupPlace
  const to = props.destinationPlace
  const center: [number, number] | undefined = from && to
    ? [(from.lng + to.lng) / 2, (from.lat + to.lat) / 2]
    : undefined
  initializeMap(undefined, center)
})

onBeforeUnmount(() => {
  stopCarAnimation()
  clearProvisionalPoints()
  destroyMap(clearRoute)
})
</script>

<template>
  <div class="absolute inset-0">
    <div ref="mapContainer" class="h-full w-full" />

    <!-- Вернуть камеру к маршруту после ручного скролла/зума -->
    <button
      v-if="hasRoute && !mapError"
      aria-label="Показать весь маршрут"
      class="absolute right-4 top-[calc(var(--app-safe-area-top)+1rem)] z-10 h-11 w-11 flex items-center justify-center rounded-full bg-secondary-950/80 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-[0.94]"
      type="button"
      @click="recenter"
    >
      <span class="i-mdi-image-filter-center-focus text-5.5" aria-hidden="true" />
    </button>

    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center bg-secondary-950 px-8 text-center text-sm text-slate-300 font-800"
    >
      {{ mapError }}
    </div>
  </div>
</template>
