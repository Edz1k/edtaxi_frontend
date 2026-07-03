<script setup lang="ts">
import type { CategoryDemand, DemandForecastPoint, Tariff, TariffCategory } from '~/types/admin'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useAdminStore } from '~/stores/admin'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()

const form = reactive({ commission_pct: 0, coefficient: 1 })
const savedAt = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Настройки | Админка',
})

// Порядок категорий фиксирован — совпадает с entity.AllVehicleCategories()
// на бэкенде, чтобы карточки и график не прыгали местами между загрузками.
const CATEGORY_ORDER: TariffCategory[] = ['economy', 'comfort', 'business', 'minivan']
const CATEGORY_LABELS: Record<TariffCategory, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}

onMounted(() => {
  loadSettings()
  loadDemand()
  admin.loadTariffs().catch(() => {})
})

const limits = computed(() => admin.platformSettings?.limits ?? null)

// Комиссия в форме — в процентах, бэкенд хранит долю (0.02 = 2%).
const commissionHint = computed(() => {
  if (!limits.value)
    return ''
  const { min, max } = limits.value.platform_commission_rate
  return `Допустимо от ${min * 100}% до ${max * 100}%. 0% — акция «без комиссии».`
})

const coefficientHint = computed(() => {
  if (!limits.value)
    return ''
  const { min, max } = limits.value.price_coefficient
  return `Допустимо от ${min} до ${max}. Умножает базовую цену каждой поездки.`
})

function fillForm() {
  if (!admin.platformSettings)
    return
  form.commission_pct = +(admin.platformSettings.platform_commission_rate * 100).toFixed(2)
  form.coefficient = admin.platformSettings.price_coefficient
}

async function loadSettings() {
  await admin.loadSettings().catch(() => {})
  fillForm()
}

async function save() {
  await admin.saveSettings({
    platform_commission_rate: +(form.commission_pct / 100).toFixed(4),
    price_coefficient: form.coefficient,
  })
  fillForm()
  savedAt.value = new Date().toISOString()
}

// --- Текущий коэффициент спроса ---------------------------------------

function loadDemand() {
  admin.loadDemandOverview().catch(() => {})
}

const demandCards = computed<CategoryDemand[]>(() => {
  const byCategory = new Map((admin.demandOverview?.current ?? []).map(d => [d.category, d]))
  return CATEGORY_ORDER.map(category => byCategory.get(category) ?? {
    category,
    active_searching: 0,
    available_drivers: 0,
    ratio: 0,
    coefficient: 1,
    surge_max: 0,
  })
})

// --- Прогноз по часам ----------------------------------------------------

const selectedForecastCategory = ref<TariffCategory>('economy')
const currentHour = new Date().getHours()

interface ForecastBar { hour: number, point: DemandForecastPoint | null }

const forecastBars = computed<ForecastBar[]>(() => {
  const points = (admin.demandOverview?.forecast ?? []).filter(p => p.category === selectedForecastCategory.value)
  const byHour = new Map(points.map(p => [p.hour, p]))
  return Array.from({ length: 24 }, (_, hour) => ({ hour, point: byHour.get(hour) ?? null }))
})

// Ось начинается от 0 (честная шкала для столбиков), верх — с запасом над
// максимумом истории, округлённый до 0.5, но не ниже 2.0x.
const forecastMax = computed(() => {
  const values = forecastBars.value.map(b => b.point?.avg_coefficient ?? 0)
  const max = Math.max(2.0, ...values)
  return Math.ceil((max + 0.2) * 2) / 2
})

function barHeightPct(bar: ForecastBar) {
  if (!bar.point)
    return 0
  return Math.max(4, (bar.point.avg_coefficient / forecastMax.value) * 100)
}

function barTooltip(bar: ForecastBar) {
  const hourLabel = `${String(bar.hour).padStart(2, '0')}:00`
  if (!bar.point)
    return `${hourLabel} — нет данных`
  return `${hourLabel} — ×${bar.point.avg_coefficient.toFixed(2)} (${bar.point.samples} поездок)`
}

// --- Тарифы ----------------------------------------------------------

const tariffByCategory = computed(() => new Map(admin.tariffs.filter(t => t.is_active).map(t => [t.category, t])))
const missingCategories = computed(() => CATEGORY_ORDER.filter(c => !tariffByCategory.value.has(c)))

const tariffModalOpen = ref(false)
const tariffModalCategory = ref<TariffCategory | null>(null)
const editingTariffId = ref<string | null>(null)
const tariffForm = reactive({ base_fare: 0, per_km: 0, per_min: 0, min_fare: 0, surge_max: 0 })
const tariffSavedId = ref('')

function openEditTariff(t: Tariff) {
  tariffModalCategory.value = t.category
  editingTariffId.value = t.id
  tariffForm.base_fare = t.base_fare
  tariffForm.per_km = t.per_km
  tariffForm.per_min = t.per_min
  tariffForm.min_fare = t.min_fare
  tariffForm.surge_max = t.surge_max
  tariffModalOpen.value = true
}

function openCreateTariff(category: TariffCategory) {
  tariffModalCategory.value = category
  editingTariffId.value = null
  tariffForm.base_fare = 200
  tariffForm.per_km = 80
  tariffForm.per_min = 10
  tariffForm.min_fare = 400
  tariffForm.surge_max = 3
  tariffModalOpen.value = true
}

function closeTariffModal() {
  tariffModalOpen.value = false
  tariffModalCategory.value = null
  editingTariffId.value = null
}

async function submitTariff() {
  if (!tariffModalCategory.value)
    return
  const saved = await admin.saveTariff({
    category: tariffModalCategory.value,
    base_fare: tariffForm.base_fare,
    per_km: tariffForm.per_km,
    per_min: tariffForm.per_min,
    min_fare: tariffForm.min_fare,
    surge_max: tariffForm.surge_max,
  }, editingTariffId.value ?? undefined).catch(() => null)
  if (saved)
    tariffSavedId.value = saved.id
  closeTariffModal()
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Глобальные настройки платформы: комиссия с поездок, коэффициент цены и тарифы по категориям. Изменения применяются к новым заказам сразу."
    title="Настройки"
  >
    <section v-if="admin.isLoadingSettings && !admin.platformSettings" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем настройки...
    </section>

    <form v-else-if="admin.platformSettings" class="mt-6 max-w-2xl border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur" @submit.prevent="save()">
      <div class="grid gap-5">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Комиссия платформы (%)</span>
          <input
            v-model.number="form.commission_pct"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            :max="(limits?.platform_commission_rate.max ?? 0.5) * 100"
            :min="(limits?.platform_commission_rate.min ?? 0) * 100"
            step="0.1"
            type="number"
          >
          <span class="text-xs text-white/50 leading-5">{{ commissionHint }}</span>
        </label>

        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Коэффициент цены</span>
          <input
            v-model.number="form.coefficient"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            :max="limits?.price_coefficient.max ?? 3"
            :min="limits?.price_coefficient.min ?? 0.5"
            step="0.05"
            type="number"
          >
          <span class="text-xs text-white/50 leading-5">{{ coefficientHint }}</span>
        </label>
      </div>

      <div class="mt-5 border border-white/8 rounded-2xl bg-black/14 px-4 py-3 text-sm text-white/55 leading-6">
        <p>
          Максимальная надбавка стороннего парка: {{ (admin.platformSettings.max_park_commission_rate * 100).toFixed(0) }}% — задаётся на бэкенде и не редактируется.
        </p>
        <p class="mt-1 text-xs text-white/40">
          Обновлено: {{ formatDate(admin.platformSettings.updated_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
        </p>
      </div>

      <div class="mt-5 flex items-center gap-3">
        <button
          :disabled="admin.isMutating"
          class="h-11 rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ admin.isMutating ? 'Сохраняем...' : 'Сохранить' }}
        </button>
        <span v-if="savedAt" class="text-sm text-emerald-300 font-800">
          Настройки сохранены.
        </span>
      </div>
    </form>

    <section v-else class="mt-5 border border-red-300/18 rounded-3xl bg-red-300/8 p-5 text-sm text-white/60 backdrop-blur">
      Не удалось загрузить настройки платформы.
      <button class="ml-2 text-cyan-200 font-900" type="button" @click="loadSettings()">
        Повторить
      </button>
    </section>

    <!-- Текущий коэффициент спроса -->
    <section class="mt-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-950">
            Текущий коэффициент спроса
          </h2>
          <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
            Отношение активных поисков к доступным водителям по платформе — та же формула, что использует расчёт цены поездки.
          </p>
        </div>
        <button
          :disabled="admin.isLoadingDemand"
          class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
          type="button"
          @click="loadDemand()"
        >
          <span class="i-mdi-refresh text-4.5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingDemand }" />
          {{ admin.isLoadingDemand ? 'Обновляем...' : 'Обновить' }}
        </button>
      </div>

      <div class="grid mt-4 gap-4 lg:grid-cols-4 sm:grid-cols-2">
        <div v-for="card in demandCards" :key="card.category" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            {{ CATEGORY_LABELS[card.category] }}
          </p>
          <p class="mt-2 text-3xl font-950">
            ×{{ card.coefficient.toFixed(2) }}
          </p>
          <p class="mt-2 text-xs text-white/50 leading-5">
            {{ card.active_searching }} в поиске · {{ card.available_drivers }} свободных водителей
          </p>
          <p class="mt-1 text-xs text-white/35">
            Потолок категории: {{ card.surge_max > 0 ? `×${card.surge_max.toFixed(1)}` : 'нет (общий лимит ×3.0)' }}
          </p>
        </div>
      </div>
    </section>

    <!-- Прогноз по часам -->
    <section class="mt-8 border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-950">
            Прогноз по часам
          </h2>
          <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
            Средний коэффициент спроса по часам суток за последние 30 дней. Текущий час отмечен отдельно.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="category in CATEGORY_ORDER"
            :key="category"
            class="h-9 border rounded-full px-3.5 text-xs font-900 transition"
            :class="selectedForecastCategory === category
              ? 'border-cyan-300/50 bg-cyan-300/16 text-cyan-100'
              : 'border-white/10 bg-white/8 text-white/55 hover:bg-white/12'"
            type="button"
            @click="selectedForecastCategory = category"
          >
            {{ CATEGORY_LABELS[category] }}
          </button>
        </div>
      </div>

      <div class="mt-6">
        <div class="relative h-32 flex items-end gap-[2px] pt-4">
          <div v-for="bar in forecastBars" :key="bar.hour" class="group relative h-full flex flex-1 flex-col items-center justify-end">
            <span
              v-if="bar.hour === currentHour"
              class="absolute top-0 text-[9px] text-cyan-200 font-800 uppercase"
            >сейчас</span>
            <div
              class="w-full rounded-t-4px transition-colors"
              :class="bar.hour === currentHour ? 'bg-cyan-300' : (bar.point ? 'bg-cyan-300/35 group-hover:bg-cyan-300/60' : 'bg-white/10')"
              :style="{ height: `${barHeightPct(bar)}%` }"
              :title="barTooltip(bar)"
            />
          </div>
        </div>
        <div class="mt-1.5 flex gap-[2px]">
          <div v-for="bar in forecastBars" :key="bar.hour" class="flex-1 text-center text-[10px] text-white/35">
            {{ bar.hour % 4 === 0 ? bar.hour : '' }}
          </div>
        </div>
      </div>
    </section>

    <!-- Тарифы -->
    <section class="mt-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-950">
            Тарифы
          </h2>
          <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
            Базовая цена и потолок коэффициента спроса по категориям. Раньше менялись только миграцией БД.
          </p>
        </div>
        <div v-if="missingCategories.length" class="flex flex-wrap gap-2">
          <button
            v-for="category in missingCategories"
            :key="category"
            class="h-10 inline-flex items-center gap-2 border border-cyan-300/30 rounded-full bg-cyan-300/12 px-4 text-sm text-cyan-100 font-900 transition hover:bg-cyan-300/20"
            type="button"
            @click="openCreateTariff(category)"
          >
            <span class="i-mdi-plus text-4.5" />
            Добавить тариф «{{ CATEGORY_LABELS[category] }}»
          </button>
        </div>
      </div>

      <div v-if="admin.isLoadingTariffs && !admin.tariffs.length" class="mt-4 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
        Загружаем тарифы...
      </div>

      <div v-else class="grid mt-4 gap-4 lg:grid-cols-4 sm:grid-cols-2">
        <div
          v-for="category in CATEGORY_ORDER"
          :key="category"
          class="border rounded-3xl bg-white/8 p-5 backdrop-blur transition"
          :class="tariffByCategory.get(category)?.id === tariffSavedId ? 'border-emerald-300/40' : 'border-white/10'"
        >
          <p class="text-xs text-white/42 font-900 uppercase">
            {{ CATEGORY_LABELS[category] }}
          </p>

          <template v-if="tariffByCategory.get(category)">
            <dl class="grid grid-cols-2 mt-3 gap-y-1.5 text-xs text-white/55">
              <dt>Подача</dt>
              <dd class="text-right text-white/85">
                {{ tariffByCategory.get(category)!.base_fare }} ₸
              </dd>
              <dt>За км</dt>
              <dd class="text-right text-white/85">
                {{ tariffByCategory.get(category)!.per_km }} ₸
              </dd>
              <dt>За мин</dt>
              <dd class="text-right text-white/85">
                {{ tariffByCategory.get(category)!.per_min }} ₸
              </dd>
              <dt>Минимум</dt>
              <dd class="text-right text-white/85">
                {{ tariffByCategory.get(category)!.min_fare }} ₸
              </dd>
              <dt>Потолок спроса</dt>
              <dd class="text-right text-white/85">
                ×{{ tariffByCategory.get(category)!.surge_max.toFixed(1) }}
              </dd>
            </dl>
            <button
              class="mt-4 h-9 w-full border border-white/12 rounded-xl bg-white/8 text-xs font-900 transition hover:bg-white/14"
              type="button"
              @click="openEditTariff(tariffByCategory.get(category)!)"
            >
              Изменить
            </button>
          </template>
          <p v-else class="mt-3 text-xs text-white/40 leading-5">
            Тариф не настроен — расчёт цены для этой категории использует ошибку «тариф не найден».
          </p>
        </div>
      </div>
    </section>

    <!-- Модалка тарифа -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="tariffModalOpen"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="closeTariffModal()"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="submitTariff()"
          >
            <h2 class="text-xl font-950">
              {{ editingTariffId ? 'Изменить тариф' : 'Новый тариф' }} «{{ tariffModalCategory ? CATEGORY_LABELS[tariffModalCategory] : '' }}»
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Действует на все заказы этой категории, если у таксопарка нет собственного тарифа.
            </p>

            <div class="grid grid-cols-2 mt-5 gap-4">
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Подача, ₸</span>
                <input v-model.number="tariffForm.base_fare" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="10" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">За км, ₸</span>
                <input v-model.number="tariffForm.per_km" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="5" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">За минуту, ₸</span>
                <input v-model.number="tariffForm.per_min" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="1" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Минимальная цена, ₸</span>
                <input v-model.number="tariffForm.min_fare" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="10" type="number">
              </label>
              <label class="grid col-span-2 gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Потолок коэффициента спроса</span>
                <input v-model.number="tariffForm.surge_max" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" max="5" min="0" step="0.1" type="number">
                <span class="text-xs text-white/50 leading-5">0 — без индивидуального потолка (действует общий лимит ×3.0). Иначе от 1.0 до 5.0.</span>
              </label>
            </div>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="admin.isMutating"
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ admin.isMutating ? 'Сохраняем...' : 'Сохранить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="closeTariffModal()"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </WebPageShell>
</template>
