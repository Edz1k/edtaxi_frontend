<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import { useRowReorder } from '~/composables/passenger/useRowReorder'

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
  // searchFailed — геокодер недоступен: показываем подсказку вместо пустоты.
  searchFailed: boolean
  suggestions: GeoPlace[]
}

const props = defineProps<{
  canAddStop?: boolean
  destination: string
  destinationSuggestions: GeoPlace[]
  // Индекс остановки, чью строку надо сфокусировать (возврат «+» с тарифов).
  focusStopIndex?: number | null
  isLocatingUser: boolean
  isSearchingDestination: boolean
  isSearchingPickup: boolean
  pickup: string
  pickupSuggestions: GeoPlace[]
  quickDestinations?: QuickDestination[]
  // Флаги «геокодер лёг» для точек А/Б (по строкам остановок — в StopRow).
  searchFailedDestination?: boolean
  searchFailedPickup?: boolean
  stops?: StopRow[]
}>()

const emit = defineEmits<{
  'addStop': []
  'clearPoint': [role: 'destination' | 'pickup']
  'locateUser': []
  'pickFromMap': [mode: MapPickerMode, stopIndex?: number]
  'removeStop': [index: number]
  'reorderPoints': [from: number, to: number]
  'searchDestination': []
  'searchPickup': []
  'searchStop': [index: number]
  'selectDestination': [place: GeoPlace]
  'selectPickup': [place: GeoPlace]
  'selectStop': [index: number, place: GeoPlace]
  'stopFocusHandled': []
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

// Единый список точек маршрута: позиция определяет роль (первая — А, последняя
// — Б, между ними — остановки). Из него рендерятся строки и работает drag&drop.
type RouteRow
  = | { kind: 'pickup' }
    | { index: number, kind: 'stop', stop: StopRow }
    | { kind: 'destination' }

const routeRows = computed<RouteRow[]>(() => [
  { kind: 'pickup' },
  ...(props.stops ?? []).map((stop, index) => ({ index, kind: 'stop' as const, stop })),
  { kind: 'destination' },
])

// Есть что переставлять только при ≥3 строках (А + Б + хотя бы одна остановка);
// иначе не блокируем скролл формы touch-none'ом на строках.
const isReorderable = computed(() => routeRows.value.length >= 3)

function rowValue(row: RouteRow): string {
  if (row.kind === 'pickup')
    return props.pickup
  if (row.kind === 'destination')
    return props.destination
  return row.stop.query
}

function rowPlaceholder(row: RouteRow): string {
  if (row.kind === 'pickup')
    return 'Откуда'
  if (row.kind === 'destination')
    return 'Куда'
  return 'Остановка'
}

function rowAriaLabel(row: RouteRow): string {
  if (row.kind === 'pickup')
    return 'Адрес отправления'
  if (row.kind === 'destination')
    return 'Адрес назначения'
  return `Адрес остановки ${row.index + 1}`
}

function rowName(row: RouteRow): string {
  if (row.kind === 'pickup')
    return 'pickup_address'
  if (row.kind === 'destination')
    return 'destination_address'
  return `stop_address_${row.index}`
}

function onRowFocus(row: RouteRow) {
  if (row.kind === 'pickup')
    emit('searchPickup')
  else if (row.kind === 'destination')
    emit('searchDestination')
  else
    emit('searchStop', row.index)
}

function onRowInput(row: RouteRow, value: string) {
  if (row.kind === 'pickup')
    emit('update:pickup', value)
  else if (row.kind === 'destination')
    emit('update:destination', value)
  else
    emit('update:stop', row.index, value)
}

// Инпуты остановок для программного фокуса (возврат «+» с тарифов). Ref-колбэк
// всегда функция (а не undefined) — иначе VNodeRef-тип не сходится.
const stopInputEls: (HTMLInputElement | null)[] = []
function setInputEl(row: RouteRow, el: unknown) {
  if (row.kind === 'stop')
    stopInputEls[row.index] = (el as HTMLInputElement | null) ?? null
}

watch(() => props.focusStopIndex, async (index) => {
  if (index == null)
    return
  await nextTick()
  stopInputEls[index]?.focus()
  emit('stopFocusHandled')
}, { flush: 'post' })

// Drag&drop: индексы — позиции в routeRows; роли пересчитывает Downbar.
const { dragIndex, isPressing, onPointerDown, rowStyle, setRowEl } = useRowReorder({
  count: () => routeRows.value.length,
  onReorder: (from, to) => emit('reorderPoints', from, to),
})
</script>

<template>
  <!-- Форма скроллится целиком, одним контейнером. Раньше шапка и поля были
       shrink-0, а скроллился только список саджестов: на низких экранах (и на
       любых — с открытой клавиатурой, она съедает вьюпорт) шторка в `full`
       упиралась в maxHeight, места на всё не хватало, и нескрываемые поля
       вылезали за границы формы — кнопка заказа, идущая следом в DOM,
       рисовалась поверх них. Один скролл-контейнер исключает переполнение:
       контент влезает — скролла нет и вид прежний; не влезает — скроллится,
       а кнопка снаружи остаётся прижатой к низу и всегда доступна. -->
  <div class="[scrollbar-width:none] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden space-y-3">
    <header class="flex items-center justify-between gap-3 px-1">
      <div class="min-w-0">
        <p class="text-[11px] app-accent font-900 uppercase">
          Маршрут
        </p>
        <h2 class="mt-0.5 truncate text-xl font-950">
          Куда едем?
        </h2>
      </div>

      <button
        aria-label="Выбрать точку назначения на карте"
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full app-chip text-white transition active:scale-95"
        title="Выбрать точку назначения на карте"
        type="button"
        @click="emit('pickFromMap', 'destination')"
      >
        <span class="i-mdi-map-marker-radius-outline text-5" />
      </button>
    </header>

    <div class="space-y-1.5">
      <!-- Единый список точек маршрута (А / остановки / Б). Зажать строку и
           перетащить, чтобы сменить порядок: позиция задаёт роль (первая — А,
           последняя — Б). Долгое удержание стартует драг, обычный тап — фокус;
           кнопки строки свои тапы сохраняют (useRowReorder). -->
      <div
        v-for="(row, rowIndex) in routeRows"
        :key="row.kind === 'stop' ? `stop-${row.index}` : row.kind"
        :ref="el => setRowEl(rowIndex, el)"
        class="min-h-14 flex items-center gap-3 rounded-[1.35rem] px-3.5 transition"
        :class="[
          dragIndex === rowIndex ? 'bg-white/14 shadow-lg shadow-black/30' : 'app-card focus-within:bg-white/10',
          isReorderable ? 'touch-none' : '',
          isPressing ? 'select-none [-webkit-touch-callout:none]' : '',
        ]"
        :style="rowStyle(rowIndex)"
        @pointerdown="onPointerDown(rowIndex, $event)"
      >
        <span
          v-if="row.kind === 'pickup'"
          class="i-mdi-near-me shrink-0 text-5 app-accent"
          aria-hidden="true"
        />
        <span
          v-else-if="row.kind === 'destination'"
          class="i-mdi-flag-checkered shrink-0 text-5 app-accent"
          aria-hidden="true"
        />
        <span
          v-else
          class="h-5 w-5 flex shrink-0 items-center justify-center rounded-full bg-main-500/22 text-[11px] text-main-200 font-950 light:text-main-700"
          aria-hidden="true"
        >
          {{ row.index + 1 }}
        </span>

        <input
          :ref="el => setInputEl(row, el)"
          :value="rowValue(row)"
          :aria-label="rowAriaLabel(row)"
          class="min-w-0 flex-1 bg-transparent text-sm text-white font-800 outline-none placeholder:app-muted"
          :name="rowName(row)"
          :placeholder="rowPlaceholder(row)"
          type="text"
          @focus="onRowFocus(row)"
          @input="onRowInput(row, ($event.target as HTMLInputElement).value)"
        >

        <!-- Очистка поля. Показываем только у заполненного: у точки А и так две
             кнопки, третья постоянная сжала бы инпут на узких экранах. -->
        <button
          v-if="row.kind !== 'stop' && rowValue(row)"
          :aria-label="row.kind === 'pickup' ? 'Очистить адрес отправления' : 'Очистить адрес назначения'"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
          title="Очистить"
          type="button"
          @click="emit('clearPoint', row.kind)"
        >
          <span class="i-mdi-close text-5" />
        </button>

        <!-- Точка А: геолокация + выбор на карте -->
        <template v-if="row.kind === 'pickup'">
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
        </template>

        <!-- Остановка: выбрать на карте и убрать -->
        <template v-else-if="row.kind === 'stop'">
          <button
            :aria-label="`Выбрать остановку ${row.index + 1} на карте`"
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
            title="Выбрать на карте"
            type="button"
            @click="emit('pickFromMap', 'stop', row.index)"
          >
            <span class="i-mdi-map-marker-radius-outline text-5" />
          </button>

          <button
            :aria-label="`Убрать остановку ${row.index + 1}`"
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-white transition active:scale-95"
            title="Убрать остановку"
            type="button"
            @click="emit('removeStop', row.index)"
          >
            <span class="i-mdi-close text-5" />
          </button>
        </template>

        <!-- Точка Б: выбор на карте -->
        <button
          v-else
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
        class="flex items-center gap-2 px-2 py-1 text-[12px] app-accent font-800 transition active:scale-[0.98]"
        type="button"
        @click="emit('addStop')"
      >
        <span class="i-mdi-plus-circle-outline text-4.5" aria-hidden="true" />
        Добавить остановку
      </button>
    </div>

    <!-- Списки в общем потоке: скроллит родитель, своего скролла тут нет -->
    <div class="space-y-3">
      <AddressSuggestions
        color="emerald"
        :failed="searchFailedPickup"
        :is-loading="isSearchingPickup"
        :places="pickupSuggestions"
        @select="emit('selectPickup', $event)"
      />

      <!-- Саджест остановок: свой блок на каждую активную строку -->
      <AddressSuggestions
        v-for="(stop, index) in stops"
        :key="`stop-suggestions-${index}`"
        color="amber"
        :failed="stop.searchFailed"
        :is-loading="stop.isSearching"
        :places="stop.suggestions"
        @select="emit('selectStop', index, $event)"
      />

      <AddressSuggestions
        color="red"
        :failed="searchFailedDestination"
        :is-loading="isSearchingDestination"
        :places="destinationSuggestions"
        @select="emit('selectDestination', $event)"
      />

      <!-- Частые и недавние адреса из истории поездок — быстрый выбор «Куда» -->
      <div v-if="showQuickDestinations" class="rounded-[1.65rem] app-card p-2">
        <p class="px-2 pb-1 pt-1.5 text-[11px] app-faint font-800 uppercase">
          Недавние и частые
        </p>
        <button
          v-for="item in quickDestinations"
          :key="item.place.id"
          class="w-full flex items-center gap-3 rounded-[1.25rem] px-3 py-2.5 text-left transition active:scale-[0.99] hover:bg-white/6 light:hover:bg-black/4"
          type="button"
          @click="emit('selectDestination', item.place)"
        >
          <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-main-200 light:text-main-700">
            <span :class="item.times > 2 ? 'i-mdi-star' : 'i-mdi-history'" class="text-4.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-800">{{ item.place.name }}</span>
            <span class="block truncate text-xs app-faint font-700">{{ item.place.address }}</span>
          </span>
          <span v-if="item.times > 1" class="shrink-0 text-[11px] app-faint font-800">
            ×{{ item.times }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
