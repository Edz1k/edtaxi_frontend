<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'

// «Умная подсказка» назначения из истории поездок: место + сколько раз ездил.
export interface QuickDestination {
  place: GeoPlace
  times: number
}

const props = defineProps<{
  destination: string
  destinationSuggestions: GeoPlace[]
  isLocatingUser: boolean
  isSearchingDestination: boolean
  isSearchingPickup: boolean
  pickup: string
  pickupSuggestions: GeoPlace[]
  quickDestinations?: QuickDestination[]
}>()

const emit = defineEmits<{
  'locateUser': []
  'pickFromMap': [mode: MapPickerMode]
  'searchDestination': []
  'searchPickup': []
  'selectDestination': [place: GeoPlace]
  'selectPickup': [place: GeoPlace]
  'update:destination': [value: string]
  'update:pickup': [value: string]
}>()

// Подсказки из истории показываем, пока пользователь не начал вводить адрес и
// гео-саджест ничего не предлагает — не конкурируем с реальным поиском.
const showQuickDestinations = computed(() =>
  Boolean(props.quickDestinations?.length)
  && props.destination.trim() === ''
  && props.destinationSuggestions.length === 0,
)
</script>

<template>
  <div class="space-y-3">
    <header class="flex items-center justify-between gap-3 px-1">
      <div class="min-w-0">
        <p class="text-[11px] text-main-300 font-900 uppercase">
          Маршрут
        </p>
        <h2 class="mt-0.5 truncate text-xl font-950">
          Куда едем?
        </h2>
      </div>

      <button
        aria-label="Выбрать точку назначения на карте"
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95"
        title="Выбрать точку назначения на карте"
        type="button"
        @click="emit('pickFromMap', 'destination')"
      >
        <span class="i-mdi-map-marker-radius-outline text-5" />
      </button>
    </header>

    <div class="relative rounded-[1.65rem] bg-white/5 p-2">
      <div class="absolute bottom-8 left-[1.36rem] top-8 w-px bg-white/12" />

      <div class="relative min-h-14 flex items-center gap-3 rounded-[1.25rem] bg-secondary-950/36 px-3">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.10)]" />

        <label class="min-w-0 flex-1">
          <span class="block text-[11px] text-slate-500 font-800 leading-none uppercase">Откуда</span>
          <input
            :value="pickup"
            aria-label="Адрес отправления"
            class="mt-1 w-full bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-300"
            name="pickup_address"
            placeholder="Мое местоположение"
            type="text"
            @focus="emit('searchPickup')"
            @input="emit('update:pickup', ($event.target as HTMLInputElement).value)"
          >
        </label>

        <button
          aria-label="Определить мое местоположение"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isLocatingUser"
          title="Моя геопозиция"
          type="button"
          @click="emit('locateUser')"
        >
          <span
            class="text-5"
            :class="isLocatingUser ? 'i-mdi-loading animate-spin' : 'i-mdi-crosshairs-gps'"
          />
        </button>

        <button
          aria-label="Выбрать адрес отправления на карте"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
          title="Выбрать на карте"
          type="button"
          @click="emit('pickFromMap', 'pickup')"
        >
          <span class="i-mdi-map-marker-radius-outline text-5" />
        </button>
      </div>

      <div class="relative mt-1 min-h-14 flex items-center gap-3 rounded-[1.25rem] px-3">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.10)]" />

        <label class="min-w-0 flex-1">
          <span class="block text-[11px] text-slate-500 font-800 leading-none uppercase">Куда</span>
          <input
            :value="destination"
            aria-label="Адрес назначения"
            class="mt-1 w-full bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-300"
            name="destination_address"
            placeholder="Адрес назначения"
            type="text"
            @focus="emit('searchDestination')"
            @input="emit('update:destination', ($event.target as HTMLInputElement).value)"
          >
        </label>

        <button
          aria-label="Выбрать адрес назначения на карте"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
          title="Выбрать на карте"
          type="button"
          @click="emit('pickFromMap', 'destination')"
        >
          <span class="i-mdi-map-marker-radius-outline text-5" />
        </button>
      </div>
    </div>

    <AddressSuggestions
      color="emerald"
      :is-loading="isSearchingPickup"
      :places="pickupSuggestions"
      @select="emit('selectPickup', $event)"
    />

    <AddressSuggestions
      color="red"
      :is-loading="isSearchingDestination"
      :places="destinationSuggestions"
      @select="emit('selectDestination', $event)"
    />

    <!-- Частые и недавние адреса из истории поездок — быстрый выбор «Куда» -->
    <div v-if="showQuickDestinations" class="rounded-[1.65rem] bg-white/5 p-2">
      <p class="px-2 pb-1 pt-1.5 text-[11px] text-slate-500 font-800 uppercase">
        Недавние и частые
      </p>
      <button
        v-for="item in quickDestinations"
        :key="item.place.id"
        class="w-full flex items-center gap-3 rounded-[1.25rem] px-3 py-2.5 text-left transition active:scale-[0.99] hover:bg-white/6"
        type="button"
        @click="emit('selectDestination', item.place)"
      >
        <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-main-200">
          <span :class="item.times > 2 ? 'i-mdi-star' : 'i-mdi-history'" class="text-4.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-800">{{ item.place.name }}</span>
          <span class="block truncate text-xs text-slate-500 font-700">{{ item.place.address }}</span>
        </span>
        <span v-if="item.times > 1" class="shrink-0 text-[11px] text-slate-500 font-800">
          ×{{ item.times }}
        </span>
      </button>
    </div>
  </div>
</template>
