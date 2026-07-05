<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'

defineProps<{
  quickDestinations: QuickDestination[]
}>()

const emit = defineEmits<{
  // «Куда едем?» — раскрыть полный поиск адреса.
  expand: []
  // Выбор точки на карте — полезный старт, пока истории поездок нет.
  pickFromMap: [mode: MapPickerMode]
  // Быстрый адрес — сразу выбрать назначение (дальше уходим к тарифам).
  selectDestination: [place: GeoPlace]
}>()
</script>

<template>
  <div class="space-y-3">
    <!-- Заголовок -->
    <div class="flex items-center gap-2.5 px-1">
      <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-[0.9rem] bg-main-500 text-#06142f">
        <span class="i-mdi-taxi text-5.5" aria-hidden="true" />
      </span>
      <h2 class="text-xl font-950">
        Такси
      </h2>
    </div>

    <!-- Куда едем? — вход в поиск -->
    <button
      class="h-13 w-full flex items-center justify-between gap-3 rounded-[1.35rem] bg-white/8 px-4 text-left transition active:scale-[0.99] hover:bg-white/12"
      type="button"
      @click="emit('expand')"
    >
      <span class="flex items-center gap-2.5">
        <span class="i-mdi-magnify shrink-0 text-5 text-main-300" aria-hidden="true" />
        <span class="text-base font-900">Куда едем?</span>
      </span>
      <span class="i-mdi-chevron-right shrink-0 text-5 text-white/40" aria-hidden="true" />
    </button>

    <!-- Частые адреса — быстрый выбор -->
    <div v-if="quickDestinations.length" class="space-y-0.5">
      <button
        v-for="item in quickDestinations.slice(0, 3)"
        :key="item.place.id"
        class="w-full flex items-center gap-3 rounded-[1.1rem] px-2 py-2 text-left transition active:scale-[0.99] hover:bg-white/5"
        type="button"
        @click="emit('selectDestination', item.place)"
      >
        <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-main-200">
          <span :class="item.times > 2 ? 'i-mdi-star' : 'i-mdi-history'" class="text-4.5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-800">{{ item.place.name }}</span>
          <span class="block truncate text-xs text-slate-500 font-700">{{ item.place.address }}</span>
        </span>
      </button>
    </div>

    <!-- Пустое состояние: истории поездок ещё нет — вместо дыры даём подсказку
         и полезное действие (выбор точки на карте). -->
    <div
      v-else
      class="relative overflow-hidden border border-white/8 rounded-[1.65rem] from-main-500/14 via-white/4 to-transparent bg-gradient-to-br p-4"
    >
      <span
        class="i-mdi-map-marker-star-outline pointer-events-none absolute text-24 text-main-300/12 -right-4 -top-5"
        aria-hidden="true"
      />
      <p class="text-sm font-950">
        Любимые адреса появятся здесь
      </p>
      <p class="mt-1 max-w-60 text-xs text-slate-400 font-700 leading-5">
        После первых поездок покажем недавние и частые места — закажете в один тап.
      </p>
      <button
        class="mt-3 h-10 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 text-sm font-900 transition active:scale-[0.97] hover:bg-white/12"
        type="button"
        @click="emit('pickFromMap', 'destination')"
      >
        <span class="i-mdi-map-marker-radius-outline text-4.5 text-main-300" aria-hidden="true" />
        Выбрать на карте
      </button>
    </div>
  </div>
</template>
