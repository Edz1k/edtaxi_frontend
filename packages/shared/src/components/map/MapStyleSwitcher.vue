<script setup lang="ts">
import type { MapStyleKey } from '../../composables/mapbox/useMapStyle'
import { ref } from 'vue'
import { useMapStyle } from '../../composables/mapbox/useMapStyle'

// Кнопка «слои» прямо на карте: раскрывает список тем (Схема/Спутник/Ночная),
// выбор применяется к карте мгновенно и запоминается на устройстве.
const { currentKey, options, setStyle } = useMapStyle()
const isOpen = ref(false)

function choose(key: MapStyleKey) {
  setStyle(key)
  isOpen.value = false
}
</script>

<template>
  <div class="pointer-events-auto relative">
    <button
      aria-label="Тема карты"
      class="h-10 w-10 flex items-center justify-center rounded-full bg-secondary-950/82 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-95"
      type="button"
      @click="isOpen = !isOpen"
    >
      <span class="i-mdi-layers-outline text-5 text-main-300" aria-hidden="true" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 top-12 w-44 origin-top-right overflow-hidden rounded-2xl bg-secondary-950/92 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <button
          v-for="option in options"
          :key="option.key"
          class="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm font-800 transition active:bg-white/10"
          :class="option.key === currentKey ? 'text-main-300' : 'text-white'"
          type="button"
          @click="choose(option.key)"
        >
          <span :class="option.icon" class="shrink-0 text-4.5" aria-hidden="true" />
          {{ option.label }}
          <span v-if="option.key === currentKey" class="i-mdi-check ml-auto shrink-0 text-4" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>
