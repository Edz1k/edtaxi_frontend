<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import AddressSuggestions from '~/components/driver/AddressSuggestions.vue'
import { useAddressSearch } from '~/composables/useAddressSearch'
import { useDriverStore } from '~/stores/driver'

const props = defineProps<{
  userCoordinates: null | UserCoordinates
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const driver = useDriverStore()

// Поиск адреса дома: гео-приоритет от текущей позиции водителя.
const query = ref('')
const selectedPlace = ref<GeoPlace | null>(null)
const near = computed<GeoPlace | null>(() => {
  if (!props.userCoordinates)
    return null
  return {
    address: '',
    id: 'self',
    lat: props.userCoordinates.lat,
    lng: props.userCoordinates.lng,
    name: '',
  }
})

const {
  isSearching,
  search,
  searchFailed,
  selectPlace,
  suggestions,
} = useAddressSearch({
  near,
  query,
  selectedPlace,
})

const remaining = computed(() => {
  const state = driver.homeMode
  if (!state)
    return null
  return Math.max(0, state.limit - state.used_today)
})

const untilLabel = computed(() => {
  const until = driver.homeMode?.until
  if (!until)
    return ''
  return new Date(until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

// Сохранённый дом (переживает выключение) — активация в один тап.
const savedHome = computed(() => {
  const state = driver.homeMode
  if (!state?.address || state.lat == null || state.lng == null)
    return null
  return { address: state.address, lat: state.lat, lng: state.lng }
})

const canActivate = computed(() => Boolean(selectedPlace.value) && (remaining.value ?? 0) > 0)

async function activateAt(lat: number, lng: number, address: string) {
  try {
    await driver.activateHome(lat, lng, address)
    emit('close')
  }
  catch {} // тост уже показан в сторе
}

function activateSelected() {
  if (selectedPlace.value)
    activateAt(selectedPlace.value.lat, selectedPlace.value.lng, selectedPlace.value.address)
}

async function turnOff() {
  try {
    await driver.deactivateHome()
    emit('close')
  }
  catch {}
}

function chooseSuggestion(place: GeoPlace) {
  selectPlace(place)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex items-end bg-black/60 p-4 text-white backdrop-blur-sm" @click.self="emit('close')">
      <section class="max-h-[80vh] w-full flex flex-col overflow-hidden rounded-3xl app-screen p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs app-accent font-900 uppercase">
              {{ t('home.eyebrow') }}
            </p>
            <h2 class="mt-1 text-xl font-950">
              {{ driver.isHomeModeActive ? t('home.goingHome') : t('home.whereHome') }}
            </h2>
          </div>
          <button
            :aria-label="t('home.closeAria')"
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full app-chip text-white transition active:scale-95"
            type="button"
            @click="emit('close')"
          >
            <span class="i-mdi-close text-5" aria-hidden="true" />
          </button>
        </div>

        <!-- Режим активен: адрес, дедлайн, выключение -->
        <template v-if="driver.isHomeModeActive">
          <div class="mt-4 rounded-2xl bg-amber-500/12 px-4 py-3">
            <p class="flex items-center gap-2 text-sm text-amber-100 font-800">
              <span class="i-mdi-home shrink-0 text-4.5 text-amber-300" aria-hidden="true" />
              <span class="truncate">{{ driver.homeMode?.address || t('home.home') }}</span>
            </p>
            <p class="mt-1.5 text-xs text-amber-200/80 leading-4">
              {{ t('home.activeHint', { until: untilLabel }) }}
            </p>
          </div>

          <button
            :disabled="driver.isMutatingHomeMode"
            class="mt-4 h-13 w-full rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.99] disabled:opacity-60"
            type="button"
            @click="turnOff"
          >
            {{ t('home.turnOff') }}
          </button>
          <p class="mt-2 text-center text-[11px] app-faint font-700">
            {{ t('home.usedNote', { used: driver.homeMode?.used_today ?? 0, limit: driver.homeMode?.limit ?? 2 }) }}
          </p>
        </template>

        <!-- Режим выключен: выбор адреса и активация -->
        <template v-else>
          <!-- Сохранённый дом: включение в один тап -->
          <button
            v-if="savedHome"
            class="mt-4 w-full flex items-center gap-3 rounded-2xl app-card px-3.5 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
            :disabled="driver.isMutatingHomeMode || (remaining ?? 0) === 0"
            type="button"
            @click="activateAt(savedHome.lat, savedHome.lng, savedHome.address)"
          >
            <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/18 text-main-200 light:text-main-700">
              <span class="i-mdi-home text-5.5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-900">{{ savedHome.address }}</span>
              <span class="block text-[11px] app-muted">{{ t('home.enableWithAddress') }}</span>
            </span>
            <span class="i-mdi-chevron-right shrink-0 text-5 app-muted" aria-hidden="true" />
          </button>

          <!-- Поиск адреса дома -->
          <div class="mt-3 min-h-13 flex items-center gap-3 rounded-2xl app-card px-3.5 transition focus-within:bg-white/10">
            <span class="i-mdi-magnify shrink-0 text-5 app-accent" aria-hidden="true" />
            <input
              v-model="query"
              :aria-label="t('home.addressAria')"
              class="min-w-0 flex-1 bg-transparent py-3 text-sm text-white font-800 outline-none placeholder:app-muted"
              :placeholder="t('home.addressPlaceholder')"
              type="text"
              @focus="search()"
            >
          </div>

          <div class="[scrollbar-width:none] mt-2 min-h-0 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden">
            <AddressSuggestions
              color="amber"
              :failed="searchFailed"
              :is-loading="isSearching"
              :places="suggestions"
              @select="chooseSuggestion"
            />
          </div>

          <p class="mt-3 flex items-start gap-2 rounded-2xl app-card px-3 py-2.5 text-[12px] text-slate-300 leading-4 light:text-slate-600">
            <span class="i-mdi-information-outline mt-0.5 shrink-0 text-4.5 app-accent" aria-hidden="true" />
            {{ t('home.offHint') }}
          </p>

          <button
            :disabled="!canActivate || driver.isMutatingHomeMode"
            class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            @click="activateSelected"
          >
            {{ (remaining ?? 0) === 0 ? t('home.limitReached') : t('home.enable', { left: remaining ?? '—', limit: driver.homeMode?.limit ?? 2 }) }}
          </button>
        </template>
      </section>
    </div>
  </Teleport>
</template>
