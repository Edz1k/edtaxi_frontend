<script setup lang="ts">
import type { Tariff, TariffCategory } from '~/types/admin'
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from '~/constants/admin'
import { useAdminStore } from '~/stores/admin'

const admin = useAdminStore()

// Категории, в которых уже есть активный тариф — для них новый создать нельзя
// (бэкенд ответит 409), поэтому в форме создания предлагаем только свободные.
const activeCategories = computed(() => new Set(admin.tariffs.filter(t => t.is_active).map(t => t.category)))
const availableCategories = computed(() => CATEGORY_ORDER.filter(category => !activeCategories.value.has(category)))

// Карточки в фиксированном порядке категорий, внутри категории — по дате создания.
const sortedTariffs = computed(() => {
  const orderIndex = new Map(CATEGORY_ORDER.map((category, index) => [category, index]))
  return [...admin.tariffs].sort((a, b) =>
    (orderIndex.get(a.category) ?? CATEGORY_ORDER.length) - (orderIndex.get(b.category) ?? CATEGORY_ORDER.length)
    || a.created_at.localeCompare(b.created_at))
})

function tariffTitle(tariff: Tariff) {
  return tariff.name || CATEGORY_LABELS[tariff.category]
}

const modalOpen = ref(false)
const editingTariff = ref<Tariff | null>(null)
const form = reactive({
  category: null as TariffCategory | null,
  name: '',
  base_fare: 200,
  per_km: 80,
  per_min: 10,
  min_fare: 400,
  surge_max: 3,
  is_active: true,
})
const savedTariffId = ref('')

function openCreateTariff() {
  editingTariff.value = null
  form.category = availableCategories.value[0] ?? null
  form.name = ''
  form.base_fare = 200
  form.per_km = 80
  form.per_min = 10
  form.min_fare = 400
  form.surge_max = 3
  form.is_active = true
  modalOpen.value = true
}

function openEditTariff(tariff: Tariff) {
  editingTariff.value = tariff
  form.category = tariff.category
  form.name = tariff.name ?? ''
  form.base_fare = tariff.base_fare
  form.per_km = tariff.per_km
  form.per_min = tariff.per_min
  form.min_fare = tariff.min_fare
  form.surge_max = tariff.surge_max
  form.is_active = tariff.is_active
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editingTariff.value = null
}

// Валидация формы (TODO п.16): v-model.number при очистке инпута даёт
// NaN/пустую строку — без guard'а это улетало на бэк. surge_max = 0 валиден
// («без потолка»), поэтому к нему правило «> 0» не применяется.
const validationError = computed(() => {
  const prices = [form.base_fare, form.per_km, form.per_min, form.min_fare]
  if (prices.some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0))
    return 'Все цены должны быть числами больше нуля'
  if (form.min_fare < form.base_fare)
    return 'Минимальная цена не может быть меньше стартовой'
  if (typeof form.surge_max !== 'number' || !Number.isFinite(form.surge_max) || form.surge_max < 0)
    return 'Потолок спроса — число (0 = без потолка)'
  return ''
})

async function submitTariff() {
  if (!editingTariff.value && !form.category)
    return
  if (validationError.value)
    return
  const values = {
    name: form.name.trim() || undefined,
    base_fare: form.base_fare,
    per_km: form.per_km,
    per_min: form.per_min,
    min_fare: form.min_fare,
    surge_max: form.surge_max,
  }
  // При ошибке (409, валидация) модалку не закрываем — значения не теряются.
  const saved = editingTariff.value
    ? await admin.saveTariff({ ...values, is_active: form.is_active }, editingTariff.value.id).catch(() => null)
    : await admin.saveTariff({ ...values, category: form.category! }).catch(() => null)
  if (!saved)
    return
  savedTariffId.value = saved.id
  closeModal()
}

onMounted(() => {
  admin.loadTariffs().catch(() => {})
})
</script>

<template>
  <section class="mt-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-950">
          Тарифы платформы
        </h2>
        <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
          Конструктор тарифов по категориям: подача, цена за км и минуту, минимум и потолок коэффициента спроса. У каждой категории может быть один активный тариф.
        </p>
      </div>
      <button
        :disabled="!availableCategories.length"
        :title="availableCategories.length ? '' : 'Во всех категориях уже есть активный тариф'"
        class="h-10 inline-flex items-center gap-2 border border-cyan-300/30 rounded-full bg-cyan-300/12 px-4 text-sm text-cyan-100 font-900 transition disabled:cursor-not-allowed hover:bg-cyan-300/20 disabled:opacity-50"
        type="button"
        @click="openCreateTariff()"
      >
        <span class="i-mdi-plus text-4.5" />
        Создать тариф
      </button>
    </div>

    <div v-if="admin.isLoadingTariffs && !admin.tariffs.length" class="mt-4 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем тарифы...
    </div>

    <div v-else-if="!admin.tariffs.length" class="mt-4 border border-white/10 rounded-3xl bg-white/8 p-6 text-sm text-white/55 backdrop-blur">
      Тарифов пока нет. Создайте первый — без активного тарифа расчёт цены в категории отвечает ошибкой «тариф не найден».
    </div>

    <div v-else class="grid mt-4 gap-4 lg:grid-cols-3 sm:grid-cols-2">
      <div
        v-for="tariff in sortedTariffs"
        :key="tariff.id"
        class="border rounded-3xl bg-white/8 p-5 backdrop-blur transition"
        :class="tariff.id === savedTariffId ? 'border-emerald-300/40' : 'border-white/10'"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-base font-950" :title="tariffTitle(tariff)">
              {{ tariffTitle(tariff) }}
            </p>
            <p class="mt-1 inline-flex items-center gap-1.5 text-xs text-white/42 font-900 uppercase">
              <span class="text-4" :class="CATEGORY_ICONS[tariff.category]" />
              {{ CATEGORY_LABELS[tariff.category] }}
            </p>
          </div>
          <span
            class="shrink-0 border rounded-full px-2.5 py-1 text-[11px] font-900"
            :class="tariff.is_active ? 'border-emerald-300/30 bg-emerald-300/12 text-emerald-200' : 'border-white/12 bg-white/6 text-white/45'"
          >
            {{ tariff.is_active ? 'Активен' : 'Отключён' }}
          </span>
        </div>

        <dl class="grid grid-cols-2 mt-4 gap-y-1.5 text-xs text-white/55">
          <dt>Стартовая цена</dt>
          <dd class="text-right text-white/85">
            {{ tariff.base_fare }} ₸
          </dd>
          <dt>За км</dt>
          <dd class="text-right text-white/85">
            {{ tariff.per_km }} ₸
          </dd>
          <dt>За минуту</dt>
          <dd class="text-right text-white/85">
            {{ tariff.per_min }} ₸
          </dd>
          <dt>Минимальная цена</dt>
          <dd class="text-right text-white/85">
            {{ tariff.min_fare }} ₸
          </dd>
          <dt>Потолок спроса</dt>
          <dd class="text-right text-white/85">
            {{ tariff.surge_max > 0 ? `×${tariff.surge_max.toFixed(1)}` : 'без потолка' }}
          </dd>
        </dl>

        <button
          class="mt-4 h-9 w-full inline-flex items-center justify-center gap-1.5 border border-white/12 rounded-xl bg-white/8 text-xs font-900 transition hover:bg-white/14"
          type="button"
          @click="openEditTariff(tariff)"
        >
          <span class="i-mdi-pencil-outline text-4" />
          Изменить
        </button>
      </div>
    </div>

    <!-- Модалка создания/редактирования тарифа -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="modalOpen"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="closeModal()"
        >
          <form
            class="max-h-[92vh] max-w-lg w-full overflow-y-auto border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="submitTariff()"
          >
            <h2 class="text-xl font-950">
              {{ editingTariff ? `Изменить тариф «${tariffTitle(editingTariff)}»` : 'Новый тариф' }}
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Действует на все заказы этой категории, если у таксопарка нет собственного тарифа.
            </p>

            <div v-if="!editingTariff" class="grid mt-5 gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Категория</span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="category in availableCategories"
                  :key="category"
                  class="h-9 inline-flex items-center gap-1.5 border rounded-full px-3.5 text-xs font-900 transition"
                  :class="form.category === category
                    ? 'border-cyan-300/50 bg-cyan-300/16 text-cyan-100'
                    : 'border-white/10 bg-white/8 text-white/55 hover:bg-white/12'"
                  type="button"
                  @click="form.category = category"
                >
                  <span class="text-4" :class="CATEGORY_ICONS[category]" />
                  {{ CATEGORY_LABELS[category] }}
                </button>
              </div>
              <span class="text-xs text-white/50 leading-5">Показаны только категории без активного тарифа.</span>
            </div>

            <div class="grid grid-cols-2 mt-5 gap-4">
              <label class="grid col-span-2 gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Название тарифа</span>
                <input
                  v-model="form.name"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  maxlength="60"
                  :placeholder="form.category ? CATEGORY_LABELS[form.category] : 'Название'"
                  type="text"
                >
                <span class="text-xs text-white/50 leading-5">Необязательно, до 60 символов. Если пусто — используется стандартное название категории.</span>
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Стартовая цена, ₸</span>
                <input v-model.number="form.base_fare" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="10" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">За км, ₸</span>
                <input v-model.number="form.per_km" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="5" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">За минуту, ₸</span>
                <input v-model.number="form.per_min" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="1" type="number">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Минимальная цена, ₸</span>
                <input v-model.number="form.min_fare" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" min="0" step="10" type="number">
              </label>
              <label class="grid col-span-2 gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Потолок коэффициента спроса</span>
                <input v-model.number="form.surge_max" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" max="5" min="0" step="0.1" type="number">
                <span class="text-xs text-white/50 leading-5">0 — без индивидуального потолка (действует общий лимит ×3.0). Иначе от 1.0 до 5.0.</span>
              </label>
            </div>

            <div v-if="editingTariff" class="mt-5 flex items-center justify-between border border-white/8 rounded-2xl bg-black/14 px-4 py-3">
              <div>
                <p class="text-sm font-900">
                  Тариф активен
                </p>
                <p class="mt-0.5 text-xs text-white/50 leading-5">
                  Отключённый тариф не участвует в расчёте цены поездок.
                </p>
              </div>
              <button
                :aria-pressed="form.is_active"
                class="h-7 w-12 shrink-0 rounded-full transition-colors"
                :class="form.is_active ? 'bg-cyan-300' : 'bg-white/15'"
                type="button"
                @click="form.is_active = !form.is_active"
              >
                <span
                  class="block h-5 w-5 rounded-full bg-white shadow transition-transform"
                  :class="form.is_active ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>

            <p v-if="validationError" class="mt-3 text-xs text-red-300 font-800">
              {{ validationError }}
            </p>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="admin.isMutating || (!editingTariff && !form.category) || !!validationError"
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ admin.isMutating ? 'Сохраняем...' : 'Сохранить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="closeModal()"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
