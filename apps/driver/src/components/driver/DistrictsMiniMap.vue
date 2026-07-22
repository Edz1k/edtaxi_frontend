<script setup lang="ts">
import type { Map as MapboxMap } from 'mapbox-gl'
import type { DriverDistrict } from '~/types/driver'
import { useMapboxDistricts } from '@edtaxi/shared/composables/mapbox/useMapboxDistricts'
import { currentMapStyleUrl } from '@edtaxi/shared/composables/mapbox/useMapStyle'
import 'mapbox-gl/dist/mapbox-gl.css'

// Превью-карта в настройках: все доступные районы бледной обводкой, выбранные —
// яркой заливкой. Некликабельная, только для наглядности выбора. Свой лёгкий
// mapbox-инстанс (не useMapboxMap с его маркерами/пикерами — тут это лишнее).
const props = withDefaults(defineProps<{
  activeIds?: string[]
  districts?: DriverDistrict[]
}>(), {
  activeIds: () => [],
  districts: () => [],
})

const mapContainer = ref<HTMLElement | null>(null)
const map = shallowRef<MapboxMap>()
const mapboxglModule = shallowRef<typeof import('mapbox-gl')>()
const mapError = ref('')

const allShapes = computed(() =>
  props.districts.filter(d => d.polygon).map(d => ({ id: d.id, polygon: d.polygon })),
)
const activeShapes = computed(() =>
  props.districts
    .filter(d => d.polygon && props.activeIds.includes(d.id))
    .map(d => ({ id: d.id, polygon: d.polygon })),
)

// Два слоя: все районы (бледно) и выбранные (ярко) поверх.
const all = useMapboxDistricts({
  districts: allShapes,
  fillOpacity: 0.03,
  lineOpacity: 0.3,
  map,
  mapboxglModule,
  sourcePrefix: 'mini-all-districts',
})
const active = useMapboxDistricts({
  districts: activeShapes,
  fillOpacity: 0.16,
  lineOpacity: 0.8,
  lineWidth: 2,
  map,
  mapboxglModule,
  sourcePrefix: 'mini-active-districts',
})

function renderAll() {
  all.renderDistricts()
  active.renderDistricts()
  all.fitDistricts()
}

onMounted(async () => {
  if (!mapContainer.value)
    return

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  if (!token) {
    mapError.value = 'Нет VITE_MAPBOX_TOKEN'
    return
  }

  mapboxglModule.value = await import('mapbox-gl')
  mapboxglModule.value.default.accessToken = token

  map.value = new mapboxglModule.value.default.Map({
    attributionControl: false,
    center: [76.9286, 43.2389],
    container: mapContainer.value,
    interactive: false, // превью, не управляем
    style: currentMapStyleUrl(),
    zoom: 10,
  })

  map.value.once('load', renderAll)
  map.value.on('style.load', () => {
    all.restoreDistricts()
    active.restoreDistricts()
  })
  map.value.on('error', () => {
    mapError.value = 'Карта не загрузилась'
  })
})

// Переключение районов — перерисовываем яркий слой и подгоняем кадр.
watch(() => [props.activeIds, props.districts], () => {
  if (!map.value?.isStyleLoaded())
    return
  renderAll()
}, { deep: true })

onBeforeUnmount(() => {
  map.value?.remove()
  map.value = undefined
})
</script>

<template>
  <div class="relative h-40 overflow-hidden rounded-2xl app-card">
    <div ref="mapContainer" class="h-full w-full" />
    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center px-4 text-center text-xs app-muted font-700"
    >
      {{ mapError }}
    </div>
  </div>
</template>
