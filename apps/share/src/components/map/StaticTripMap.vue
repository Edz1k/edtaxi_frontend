<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'

// Статичная карта Mapbox (PNG через Static Images API). Не требует WebGL,
// поэтому работает там, где интерактивная mapbox-gl v3 не поднимается —
// мобильные браузеры без WebGL2 показывали чёрный экран. Точки A/B и, для
// активной поездки, машина; auto подгоняет охват под все маркеры.
const props = defineProps<{
  destination: GeoPlace | null
  driverLocation?: { lat: number, lng: number } | null
  pickup: GeoPlace | null
}>()

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Цвета маркеров — как у меток в HUD: A жёлтый, B красный, машина синяя.
const staticUrl = computed(() => {
  if (!token || !props.pickup || !props.destination)
    return ''

  const overlays = [
    `pin-l-a+f59e0b(${props.pickup.lng},${props.pickup.lat})`,
    `pin-l-b+ef4444(${props.destination.lng},${props.destination.lat})`,
  ]
  if (props.driverLocation)
    overlays.push(`pin-l-car+2f7cf5(${props.driverLocation.lng},${props.driverLocation.lat})`)

  // @2x — ретина; размеры логические (≤1280 по стороне). padding, чтобы пины
  // не липли к краям. auto сам центрирует и подбирает зум по маркерам.
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(',')}/auto/640x960@2x?padding=90&access_token=${token}`
})
</script>

<template>
  <div class="absolute inset-0 bg-secondary-900">
    <img
      v-if="staticUrl"
      :src="staticUrl"
      alt="Карта поездки"
      class="h-full w-full object-cover"
    >
  </div>
</template>
