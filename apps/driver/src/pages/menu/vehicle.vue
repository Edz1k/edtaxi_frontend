<script setup lang="ts">
import type { CatalogCarItem, CatalogResolveResponse } from '~/types/catalog'
import type { VehicleCategory } from '~/types/trips'
import { resolveCatalogCar, searchCatalogCars } from '~/api/catalog'
import AuthButton from '~/components/auth/AuthButton.vue'
import CatalogRequestBlock from '~/components/vehicle/CatalogRequestBlock.vue'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { categoryLabel, sortCategories } from '~/utils/vehicleCategories'

const router = useRouter()
const driver = useDriverOnboardingStore()

const currentYear = new Date().getFullYear()

const form = reactive({
  color: '',
  make: '',
  model: '',
  plate_number: '',
  year: currentYear,
})

// Поле "Марка и модель" — один инпут с автодополнением из каталога машин.
// query — то, что видит и печатает пользователь; make/model в form
// выставляются либо точно (выбор из списка), либо эвристикой (первое слово —
// марка, остальное — модель), если водитель вводит машину, которой нет в списке.
const query = ref('')
const lastPickedQuery = ref('')
const suggestions = ref<CatalogCarItem[]>([])
const isSearching = ref(false)
const isQueryFocused = ref(false)

const showSuggestions = computed(() =>
  isQueryFocused.value && query.value.trim().length >= 2 && suggestions.value.length > 0,
)

const existingId = ref('')
const isEditing = computed(() => Boolean(existingId.value))

// Режим мототакси: каталог машин не используется, категория 'moto'
// отправляется явно, марка и модель — свободным текстом.
const isMoto = ref(false)

const resolveResult = ref<CatalogResolveResponse | null>(null)
const isResolving = ref(false)
const resolvedCategories = computed<VehicleCategory[]>(() =>
  resolveResult.value ? sortCategories(resolveResult.value.categories) : [],
)

function setMotoMode(value: boolean) {
  if (isMoto.value === value)
    return

  isMoto.value = value
  form.make = ''
  form.model = ''
  query.value = ''
  lastPickedQuery.value = ''
  suggestions.value = []
  resolveResult.value = null
}

const savedCategories = ref<VehicleCategory[] | null>(null)

function isValidYear(year: number) {
  return Number.isInteger(year) && year >= 1990 && year <= currentYear + 1
}

const canSubmit = computed(() => {
  return form.plate_number.trim()
    && form.make.trim()
    && form.model.trim()
    && form.color.trim()
    && isValidYear(form.year)
})

function prefillFromExisting() {
  const existing = driver.vehicles[0]
  if (!existing)
    return

  existingId.value = existing.id
  isMoto.value = existing.category === 'moto'
  form.color = existing.color
  form.make = existing.make
  form.model = existing.model
  form.plate_number = existing.plate_number
  form.year = existing.year

  const composite = `${existing.make} ${existing.model}`
  query.value = composite
  lastPickedQuery.value = composite
}

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Автомобиль',
  },
})

useHead({
  title: 'Автомобиль | Telegram Taxi Driver',
})

onMounted(async () => {
  if (!driver.vehicles.length)
    await driver.loadVehicles().catch(() => {})
  prefillFromExisting()
})

function yearRangeLabel(item: CatalogCarItem) {
  return `${item.year_from}–${item.year_to ?? 'н.в.'}`
}

function classChipLabel(item: CatalogCarItem) {
  if (item.max_class && item.is_minivan)
    return `${categoryLabel(item.max_class)} + Минивэн`
  if (item.is_minivan)
    return 'Минивэн'
  if (item.max_class)
    return `до ${categoryLabel(item.max_class)}`
  return '—'
}

function pickSuggestion(item: CatalogCarItem) {
  const composite = `${item.make} ${item.model}`
  query.value = composite
  lastPickedQuery.value = composite
  form.make = item.make
  form.model = item.model
  suggestions.value = []
  isQueryFocused.value = false
}

// Разбор произвольного ввода на марку/модель, если водитель не выбрал
// вариант из подсказок (например, машины нет в каталоге).
watch(query, (val) => {
  if (val === lastPickedQuery.value)
    return

  const trimmed = val.trim()
  const spaceIndex = trimmed.indexOf(' ')

  if (spaceIndex === -1) {
    form.make = trimmed
    form.model = ''
  }
  else {
    form.make = trimmed.slice(0, spaceIndex)
    form.model = trimmed.slice(spaceIndex + 1)
  }
})

watchDebounced(query, async (val) => {
  if (isMoto.value || val === lastPickedQuery.value) {
    suggestions.value = []
    return
  }

  const trimmed = val.trim()
  if (trimmed.length < 2) {
    suggestions.value = []
    return
  }

  isSearching.value = true

  try {
    const res = await searchCatalogCars(trimmed)
    suggestions.value = res.items
  }
  catch {
    suggestions.value = []
  }
  finally {
    isSearching.value = false
  }
}, { debounce: 300 })

watchDebounced(
  [() => form.make, () => form.model, () => form.year],
  async ([make, model, year]) => {
    // Для мото каталог не используется — тариф задаётся явно.
    if (isMoto.value || !make.trim() || !model.trim() || !isValidYear(year)) {
      resolveResult.value = null
      return
    }

    isResolving.value = true

    try {
      resolveResult.value = await resolveCatalogCar(make.trim(), model.trim(), year)
    }
    catch {
      resolveResult.value = null
    }
    finally {
      isResolving.value = false
    }
  },
  { debounce: 300, immediate: true },
)

async function submitVehicle() {
  if (!canSubmit.value || driver.isLoading)
    return

  const payload = {
    ...(isMoto.value ? { category: 'moto' as const } : {}),
    color: form.color.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    plate_number: form.plate_number.trim().toUpperCase(),
    year: form.year,
  }

  try {
    const saved = isEditing.value
      ? await driver.updateVehicle(existingId.value, payload)
      : await driver.saveVehicle(payload)

    savedCategories.value = sortCategories(saved.categories ?? [saved.category])
  }
  catch {}
}
</script>

<template>
  <main class="tg-safe-bottom tg-safe-x h-full overflow-y-auto bg-secondary-900 text-white">
    <section class="mx-auto max-w-sm pb-6 pt-[calc(var(--app-safe-area-top)+6.5rem)]">
      <div class="flex items-center gap-3">
        <div class="h-13 w-13 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/18 text-main-200">
          <span :class="isMoto ? 'i-mdi-motorbike' : 'i-mdi-car-info'" class="text-7" />
        </div>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl font-950">
            {{ isMoto ? 'Мототакси' : 'Автомобиль' }}
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            <template v-if="isEditing">
              {{ isMoto ? 'Ваш мотоцикл уже добавлен. Можно отредактировать данные.' : 'Ваша машина уже добавлена. Можно отредактировать данные.' }}
            </template>
            <template v-else>
              {{ isMoto ? 'Добавьте мотоцикл, чтобы выйти на линию и получать заказы.' : 'Добавьте машину, чтобы выйти на линию и получать заказы.' }}
            </template>
          </p>
        </div>
      </div>

      <!-- Успех: показываем производные тарифы и уходим на карту -->
      <div v-if="savedCategories" class="mt-8 rounded-3xl bg-emerald-500/10 p-6 text-center">
        <span class="i-mdi-check-circle mx-auto block text-12 text-emerald-400" />
        <p class="mt-3 text-lg text-white font-900">
          {{ isMoto ? 'Мотоцикл сохранён' : 'Машина сохранена' }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          Доступные тарифы:
        </p>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <span
            v-for="cat in savedCategories"
            :key="cat"
            class="rounded-full bg-emerald-500/16 px-3 py-1.5 text-xs text-emerald-300 font-800"
          >
            {{ categoryLabel(cat) }}
          </span>
        </div>

        <AuthButton
          class="mt-6"
          icon="i-mdi-arrow-right"
          text="Готово"
          @click="router.replace('/map')"
        />
      </div>

      <form v-else class="mt-8 space-y-5" @submit.prevent="submitVehicle">
        <!-- Переключатель «Стать мототакси» / возврат к автомобилю -->
        <button
          v-if="!isMoto"
          class="w-full flex items-center gap-3 border border-main-500/25 rounded-2xl bg-main-500/10 p-4 text-left transition active:scale-[0.98]"
          type="button"
          @click="setMotoMode(true)"
        >
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-main-500/18 text-main-200">
            <span class="i-mdi-motorbike text-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-white font-900">Стать мототакси</span>
            <span class="mt-0.5 block text-xs text-slate-400 leading-4">Работайте на мотоцикле — быстрые заказы по городу</span>
          </span>
          <span class="i-mdi-chevron-right shrink-0 text-5 text-slate-500" />
        </button>

        <button
          v-else
          class="w-full flex items-center gap-3 border border-white/10 rounded-2xl bg-white/5 p-4 text-left transition active:scale-[0.98]"
          type="button"
          @click="setMotoMode(false)"
        >
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-white/8 text-slate-300">
            <span class="i-mdi-car text-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-white font-900">У меня автомобиль</span>
            <span class="mt-0.5 block text-xs text-slate-400 leading-4">Вернуться к добавлению машины</span>
          </span>
          <span class="i-mdi-chevron-right shrink-0 text-5 text-slate-500" />
        </button>

        <!-- Инфо для мототакси: страховка и второй шлем обязательны -->
        <div v-if="isMoto" class="rounded-2xl bg-amber-500/12 p-4">
          <p class="flex items-start gap-2 text-xs text-amber-300 leading-5">
            <span class="i-mdi-shield-alert mt-0.5 shrink-0 text-4" />
            Для мототакси обязательны страховка и второй шлем для пассажира. Перевозка только одного пассажира.
          </p>
        </div>

        <!-- Мото: марка и модель свободным текстом, без автокомплита каталога -->
        <div v-if="isMoto" class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Марка</span>
            <input v-model="form.make" autocomplete="off" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="Yamaha">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Модель</span>
            <input v-model="form.model" autocomplete="off" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="MT-07">
          </label>
        </div>

        <label v-if="!isMoto" class="relative block">
          <span class="mb-2 block text-sm text-slate-300 font-600">Марка и модель</span>
          <input
            v-model="query"
            autocomplete="off"
            class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400"
            placeholder="Toyota Camry"
            @blur="isQueryFocused = false"
            @focus="isQueryFocused = true"
          >

          <span v-if="isSearching" class="i-mdi-loading absolute right-4 top-[2.65rem] animate-spin text-5 text-slate-400" />

          <div
            v-if="showSuggestions"
            class="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 max-h-64 overflow-y-auto border border-white/10 rounded-2xl bg-secondary-800 shadow-2xl"
          >
            <button
              v-for="item in suggestions"
              :key="`${item.make}|${item.model}`"
              class="w-full flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 active:bg-white/10"
              type="button"
              @mousedown.prevent="pickSuggestion(item)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm text-white font-800">{{ item.make }} {{ item.model }}</span>
                <span class="block text-xs text-slate-400">{{ yearRangeLabel(item) }}</span>
              </span>
              <span class="shrink-0 rounded-full bg-main-500/16 px-2.5 py-1 text-[11px] text-main-200 font-800">
                {{ classChipLabel(item) }}
              </span>
            </button>
          </div>
        </label>

        <!-- Доступные тарифы по каталогу (для мото не показываем) -->
        <div v-if="resolveResult && !isMoto" class="rounded-2xl p-4" :class="resolveResult.matched ? 'bg-emerald-500/10' : 'bg-white/5'">
          <p class="mb-2 text-xs text-slate-300 font-800 uppercase">
            Доступные тарифы
          </p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="cat in resolvedCategories"
              :key="cat"
              class="rounded-full bg-emerald-500/16 px-3 py-1.5 text-xs text-emerald-300 font-800"
            >
              {{ categoryLabel(cat) }}
            </span>
          </div>
          <template v-if="!resolveResult.matched">
            <p class="mt-3 text-xs text-amber-300 leading-5">
              Модель не найдена в каталоге — будет доступен только Эконом.
            </p>
            <CatalogRequestBlock :make="form.make" :model="form.model" :year="form.year" />
          </template>
        </div>

        <label class="block">
          <span class="mb-2 block text-sm text-slate-300 font-600">Госномер</span>
          <input v-model="form.plate_number" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="777 AAA 01">
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Год</span>
            <input v-model.number="form.year" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" inputmode="numeric" type="number">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Цвет</span>
            <input v-model="form.color" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="Белый">
          </label>
        </div>

        <AuthButton
          :disabled="driver.isLoading || !canSubmit"
          icon="i-mdi-check"
          :loading="driver.isLoading"
          loading-text="Сохраняем..."
          :text="isEditing ? 'Сохранить' : 'Продолжить'"
        />
      </form>
    </section>
  </main>
</template>
