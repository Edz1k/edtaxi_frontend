<script setup lang="ts">
import type { GeoPlace } from '~/types/geocoding'

defineProps<{
  color: 'emerald' | 'red'
  isLoading: boolean
  places: GeoPlace[]
}>()

const emit = defineEmits<{
  select: [place: GeoPlace]
}>()

function getSuggestionIcon(place: GeoPlace) {
  return place.name.toLowerCase().includes('аэропорт') ? 'i-mdi-airplane' : 'i-mdi-map-marker-outline'
}
</script>

<template>
  <div
    v-if="places.length || isLoading"
    class="mt-3 rounded-2xl bg-white/5 p-2 space-y-1"
  >
    <button
      v-for="place in places"
      :key="place.id"
      class="min-h-11 w-full flex items-center gap-3 rounded-xl px-2 text-left transition active:scale-[0.98]"
      type="button"
      @click="emit('select', place)"
    >
      <span
        class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full"
        :class="color === 'emerald' ? 'bg-emerald-400/14 text-emerald-300' : 'bg-red-500/14 text-red-300'"
      >
        <span :class="getSuggestionIcon(place)" class="text-5" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-sm font-800">{{ place.name }}</span>
        <span class="block truncate text-xs text-slate-400">{{ place.address }}</span>
      </span>
    </button>

    <p
      v-if="isLoading && !places.length"
      class="px-2 py-2 text-xs text-slate-400 font-700"
    >
      Ищем адрес...
    </p>
  </div>
</template>
