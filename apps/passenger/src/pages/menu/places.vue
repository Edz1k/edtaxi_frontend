<script setup lang="ts">
import type { GeoPlace } from '~/types/geocoding'
import type { FavoritePlace } from '~/types/places'
import AddressSuggestions from '~/components/passenger/downbar/AddressSuggestions.vue'
import { useAddressSearch } from '~/composables/passenger/useAddressSearch'
import { usePlacesStore } from '~/stores/places'

const places = usePlacesStore()
const isAdding = ref(false)
const isAddressSearchOpen = ref(false)
const editTarget = ref<FavoritePlace | null>(null)
const name = ref('')
const addressQuery = ref('')
const selectedPlace = ref<GeoPlace | null>(null)
const addressSearchInput = ref<HTMLInputElement | null>(null)

const {
  clearSuggestions,
  isSearching,
  selectPlace,
  suggestions,
} = useAddressSearch({
  query: addressQuery,
  selectedPlace,
})

const canSubmit = computed(() => Boolean(name.value.trim() && selectedPlace.value))

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Избранные адреса',
  },
})

useHead({
  title: 'Избранные адреса | EdTaxi',
})

onMounted(async () => {
  if (!places.places.length)
    await places.load().catch(() => {})
})

function resetForm() {
  name.value = ''
  addressQuery.value = ''
  selectedPlace.value = null
  places.errorMessage = ''
  clearSuggestions()
}

function openAdd() {
  resetForm()
  editTarget.value = null
  isAdding.value = true
}

function openEdit(place: FavoritePlace) {
  name.value = place.name
  addressQuery.value = place.address
  selectedPlace.value = {
    address: place.address,
    id: place.id,
    lat: place.lat,
    lng: place.lng,
    name: place.name,
  }
  clearSuggestions()
  editTarget.value = place
  isAdding.value = true
}

function closeForm() {
  isAdding.value = false
  isAddressSearchOpen.value = false
  editTarget.value = null
}

async function openAddressSearch() {
  isAddressSearchOpen.value = true
  await nextTick()
  addressSearchInput.value?.focus()
}

function closeAddressSearch() {
  isAddressSearchOpen.value = false
}

function selectFavoriteAddress(place: GeoPlace) {
  selectPlace(place)
  closeAddressSearch()
}

async function submit() {
  if (!canSubmit.value || places.isMutating)
    return

  const place = selectedPlace.value!

  try {
    if (editTarget.value) {
      await places.edit(editTarget.value.id, {
        name: name.value.trim(),
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      })
    }
    else {
      await places.add({
        name: name.value.trim(),
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      })
    }
    closeForm()
  }
  catch {}
}
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs text-main-300 font-900 uppercase">
            Пассажир
          </p>
          <h1 class="mt-1 text-3xl font-950">
            Избранные адреса
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Сохранённые места для быстрого заказа
          </p>
        </div>

        <button
          aria-label="Добавить адрес"
          class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-main-500/20 text-main-200 transition active:scale-[0.96]"
          type="button"
          @click="openAdd()"
        >
          <span class="i-mdi-plus text-6" />
        </button>
      </header>

      <div v-if="places.isLoading && !places.places.length" class="mt-8 space-y-3">
        <div v-for="item in 3" :key="item" class="h-20 animate-pulse rounded-3xl bg-white/6" />
      </div>

      <section
        v-else-if="!places.places.length"
        class="mt-10 rounded-3xl bg-white/5 px-5 py-8 text-center"
      >
        <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-main-500/16 text-main-200">
          <span class="i-mdi:heart-outline text-8" />
        </div>
        <h2 class="mt-4 text-xl font-950">
          Избранных мест нет
        </h2>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Сохраняйте часто используемые адреса, чтобы быстро их находить при заказе такси.
        </p>
        <button
          class="mt-5 h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-main-500/20 px-5 text-sm text-main-200 font-900 transition active:scale-[0.98]"
          type="button"
          @click="openAdd()"
        >
          <span class="i-mdi-plus text-5" />
          Добавить место
        </button>
      </section>

      <div v-else class="mt-6 space-y-3">
        <article
          v-for="place in places.places"
          :key="place.id"
          class="flex items-center gap-4 rounded-3xl bg-white/5 p-4"
        >
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/14 text-main-200">
            <span class="i-mdi-map-marker-outline text-6" />
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-900">
              {{ place.name }}
            </p>
            <p class="mt-0.5 truncate text-xs text-slate-400 font-700">
              {{ place.address }}
            </p>
          </div>

          <div class="flex shrink-0 gap-1">
            <button
              :disabled="places.isMutating"
              aria-label="Редактировать"
              class="h-9 w-9 flex items-center justify-center rounded-2xl bg-white/6 text-slate-400 transition active:scale-[0.95] hover:bg-white/10 disabled:opacity-50"
              type="button"
              @click="openEdit(place)"
            >
              <span class="i-mdi-pencil text-4.5" />
            </button>
            <button
              :disabled="places.isMutating"
              aria-label="Удалить"
              class="h-9 w-9 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-400 transition active:scale-[0.95] hover:bg-red-500/18 disabled:opacity-50"
              type="button"
              @click="places.remove(place.id)"
            >
              <span class="i-mdi-trash-can-outline text-4.5" />
            </button>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isAdding"
          class="fixed inset-0 z-60 flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]"
          @click.self="closeForm()"
        >
          <form
            class="mx-auto max-w-sm min-w-0 w-full overflow-hidden rounded-3xl bg-secondary-900 p-5 text-white shadow-2xl shadow-black/30"
            @submit.prevent="submit()"
          >
            <div class="min-w-0 flex items-center justify-between gap-4">
              <h2 class="min-w-0 truncate text-2xl font-950">
                {{ editTarget ? 'Редактировать' : 'Новое место' }}
              </h2>
              <button aria-label="Закрыть" class="h-11 w-11 flex items-center justify-center rounded-full bg-white/8" type="button" @click="closeForm()">
                <span class="i-mdi-close text-6" />
              </button>
            </div>

            <div class="grid mt-5 min-w-0 gap-3">
              <label class="grid min-w-0 gap-1.5">
                <span class="text-xs text-main-300 font-900 uppercase">Название</span>
                <input
                  v-model="name"
                  class="h-12 min-w-0 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none focus:border-main-400"
                  placeholder="Дом, Работа..."
                  required
                  type="text"
                >
              </label>
              <div class="grid min-w-0 gap-1.5">
                <span class="text-xs text-main-300 font-900 uppercase">Адрес</span>
                <button
                  class="min-h-12 min-w-0 w-full flex items-center gap-3 overflow-hidden border border-white/10 rounded-2xl bg-white/6 px-4 py-3 text-left text-sm outline-none transition active:scale-[0.99]"
                  type="button"
                  @click="openAddressSearch()"
                >
                  <span class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-main-500/14 text-main-200">
                    <span class="i-mdi-map-search-outline text-5" />
                  </span>
                  <span class="min-w-0 flex-1 overflow-hidden">
                    <span
                      class="block truncate font-800"
                      :class="selectedPlace ? 'text-white' : 'text-slate-400'"
                    >
                      {{ selectedPlace ? selectedPlace.address : 'Выбрать адрес' }}
                    </span>
                    <span v-if="selectedPlace" class="mt-0.5 block truncate text-xs text-slate-500 font-700">
                      {{ selectedPlace.name }}
                    </span>
                  </span>
                  <span class="i-mdi-chevron-right shrink-0 text-5 text-slate-500" />
                </button>
              </div>

              <p v-if="!selectedPlace && addressQuery.length >= 3" class="px-1 text-xs text-amber-300/80 font-700">
                Выберите адрес из списка подсказок.
              </p>
            </div>

            <p v-if="places.errorMessage" class="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-xs text-red-300 font-700">
              {{ places.errorMessage }}
            </p>

            <button
              :disabled="places.isMutating || !canSubmit"
              class="mt-5 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="submit"
            >
              {{ places.isMutating ? 'Сохраняем...' : (editTarget ? 'Сохранить' : 'Добавить') }}
            </button>
          </form>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isAddressSearchOpen"
          class="fixed inset-0 z-70 flex items-end bg-black/68 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]"
          @click.self="closeAddressSearch()"
        >
          <section
            class="relative mx-auto max-h-[min(82vh,calc(var(--app-viewport-height)-var(--app-safe-area-top)-var(--app-safe-area-bottom)-1.5rem))] max-w-sm min-h-0 min-w-0 w-full flex flex-col overflow-hidden rounded-3xl bg-secondary-950 text-white shadow-2xl shadow-black/35"
          >
            <header class="shrink-0 border-b border-white/8 px-5 pb-4 pt-3">
              <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-white/14" />
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs text-main-300 font-900 uppercase">
                    Адрес
                  </p>
                  <h2 class="mt-0.5 text-2xl font-950">
                    Выберите адрес
                  </h2>
                </div>
                <button
                  aria-label="Закрыть поиск адреса"
                  class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-200 transition active:scale-[0.96]"
                  type="button"
                  @click="closeAddressSearch()"
                >
                  <span class="i-mdi-close text-6" />
                </button>
              </div>

              <label class="mt-4 h-13 min-w-0 flex items-center gap-3 border border-white/10 rounded-2xl bg-white/6 px-4 transition focus-within:border-main-400">
                <span class="i-mdi-magnify shrink-0 text-5 text-main-300" />
                <input
                  ref="addressSearchInput"
                  v-model="addressQuery"
                  autocomplete="off"
                  class="min-w-0 flex-1 bg-transparent text-sm text-white font-800 outline-none placeholder:text-slate-500"
                  placeholder="Начните вводить адрес..."
                  type="text"
                >
              </label>
            </header>

            <div class="[scrollbar-width:thin] relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
              <AddressSuggestions
                color="emerald"
                :is-loading="isSearching"
                :places="suggestions"
                @select="selectFavoriteAddress($event)"
              />

              <p
                v-if="!isSearching && addressQuery.trim().length < 3"
                class="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-400 font-700 leading-5"
              >
                Введите минимум 3 символа, чтобы увидеть подсказки.
              </p>

              <p
                v-else-if="!isSearching && addressQuery.trim().length >= 3 && !suggestions.length && !selectedPlace"
                class="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-400 font-700 leading-5"
              >
                Адрес не найден. Попробуйте уточнить запрос.
              </p>
            </div>

            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-3xl from-secondary-950 to-transparent bg-gradient-to-t" />
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
