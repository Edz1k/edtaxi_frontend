<script setup lang="ts">
import type { Tariff, TariffCategory } from '~/types/admin'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~/constants/admin'
import { useAdminStore } from '~/stores/admin'

const admin = useAdminStore()

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

onMounted(() => {
  admin.loadTariffs().catch(() => {})
})
</script>

<template>
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
  </section>
</template>
