<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'

// «Умная подсказка» назначения из истории поездок: место + сколько раз ездил.
export interface QuickDestination {
  place: GeoPlace
  times: number
}

// Строка промежуточной остановки: текст, её саджест и индикатор поиска
// (состояние и инстансы поиска живут в Downbar, форма — презентационная).
export interface StopRow {
  isSearching: boolean
  query: string
  suggestions: GeoPlace[]
}

const props = defineProps<{
  canAddStop?: boolean
  destination: string
  destinationSuggestions: GeoPlace[]
  isLocatingUser: boolean
  isSearchingDestination: boolean
  isSearchingPickup: boolean
  pickup: string
  pickupSuggestions: GeoPlace[]
  quickDestinations?: QuickDestination[]
  stops?: StopRow[]
}>()

const emit = defineEmits<{
  'addStop': []
  'locateUser': []
  'pickFromMap': [mode: MapPickerMode]
  'removeStop': [index: number]
  'searchDestination': []
  'searchPickup': []
  'searchStop': [index: number]
  'selectDestination': [place: GeoPlace]
  'selectPickup': [place: GeoPlace]
  'selectStop': [index: number, place: GeoPlace]
  'update:destination': [value: string]
  'update:pickup': [value: string]
  'update:stop': [index: number, value: string]
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
  <!-- Шапка и поля ввода зафиксированы; скроллится только область списков
       (подсказки гео-саджеста / частые адреса) — блок с адресами внизу. -->
  <div class="flex flex-col gap-3">
    <header class="flex shrink-0 items-center justify-between gap-3 px-1">
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

    <div class="shrink-0 space-y-1.5">
      <div class="min-h-14 flex items-center gap-3 rounded-[1.35rem] bg-white/6 px-3.5 transition focus-within:bg-white/10">
        <span class="i-mdi-near-me shrink-0 text-5 text-main-300" aria-hidden="true" />

        <input
          :value="pickup"
          aria-label="Адрес отправления"
          class="min-w-0 flex-1 bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-400"
          name="pickup_address"
          placeholder="Откуда"
          type="text"
          @focus="emit('searchPickup')"
          @input="emit('update:pickup', ($event.target as HTMLInputElement).value)"
        >

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

      <!-- Промежуточные остановки (до 3): нумерованные строки между А и Б -->
      <div
        v-for="(stop, index) in stops"
        :key="`stop-${index}`"
        class="min-h-14 flex items-center gap-3 rounded-[1.35rem] bg-white/6 px-3.5 transition focus-within:bg-white/10"
      >
        <span
          class="h-5 w-5 flex shrink-0 items-center justify-center rounded-full bg-main-500/22 text-[11px] text-main-200 font-950"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>

        <input
          :value="stop.query"
          :aria-label="`Адрес остановки ${index + 1}`"
          class="min-w-0 flex-1 bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-400"
          :name="`stop_address_${index}`"
          placeholder="Остановка"
          type="text"
          @focus="emit('searchStop', index)"
          @input="emit('update:stop', index, ($event.target as HTMLInputElement).value)"
        >

        <button
          :aria-label="`Убрать остановку ${index + 1}`"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
          title="Убрать остановку"
          type="button"
          @click="emit('removeStop', index)"
        >
          <span class="i-mdi-close text-5" />
        </button>
      </div>

      <div class="min-h-14 flex items-center gap-3 rounded-[1.35rem] bg-white/6 px-3.5 transition focus-within:bg-white/10">
        <span class="i-mdi-flag-checkered shrink-0 text-5 text-main-300" aria-hidden="true" />

        <input
          :value="destination"
          aria-label="Адрес назначения"
          class="min-w-0 flex-1 bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-400"
          name="destination_address"
          placeholder="Куда"
          type="text"
          @focus="emit('searchDestination')"
          @input="emit('update:destination', ($event.target as HTMLInputElement).value)"
        >

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

      <!-- Добавить остановку (до 3) -->
      <button
        v-if="canAddStop"
        class="flex items-center gap-2 px-2 py-1 text-[12px] text-main-300 font-800 transition active:scale-[0.98]"
        type="button"
        @click="emit('addStop')"
      >
        <span class="i-mdi-plus-circle-outline text-4.5" aria-hidden="true" />
        Добавить остановку
      </button>
    </div>

    <div class="[scrollbar-width:none] min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden space-y-3">
      <AddressSuggestions
        color="emerald"
        :is-loading="isSearchingPickup"
        :places="pickupSuggestions"
        @select="emit('selectPickup', $event)"
      />

      <!-- Саджест остановок: свой блок на каждую активную строку -->
      <AddressSuggestions
        v-for="(stop, index) in stops"
        :key="`stop-suggestions-${index}`"
        color="amber"
        :is-loading="stop.isSearching"
        :places="stop.suggestions"
        @select="emit('selectStop', index, $event)"
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
  </div>
</template>
