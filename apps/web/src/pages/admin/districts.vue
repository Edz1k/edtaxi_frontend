<script setup lang="ts">
import type { AdminDistrict } from '~/types/admin'
import { getAdminCities } from '~/api/admin'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useAdminStore } from '~/stores/admin'
import { formatDate } from '~/utils/format'

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Районы городов | Админка',
})

const admin = useAdminStore()

// Фильтр по городу (справочник /admin/cities — строки-имена).
const cityFilter = ref('Астана')
const cityOptions = ref<{ label: string, value: string }[]>([{ label: 'Астана', value: 'Астана' }])

onMounted(async () => {
  admin.loadDistricts(cityFilter.value).catch(() => {})
  try {
    const response = await getAdminCities()
    cityOptions.value = response.cities.map(name => ({ label: name, value: name }))
  }
  catch {} // без справочника остаётся дефолтная Астана
})

watch(cityFilter, city => admin.loadDistricts(city).catch(() => {}))

// Модалка создания/редактирования (конвенция TariffsSection: одна форма на
// оба случая; при ошибке модалка не закрывается — введённый WKT не теряется).
const modalOpen = ref(false)
const editingDistrict = ref<AdminDistrict | null>(null)
const form = reactive({
  city: 'Астана',
  name: '',
  polygon_wkt: '',
  is_active: true,
})
const formError = ref('')

function openCreate() {
  editingDistrict.value = null
  form.city = cityFilter.value
  form.name = ''
  form.polygon_wkt = ''
  form.is_active = true
  formError.value = ''
  modalOpen.value = true
}

function openEdit(district: AdminDistrict) {
  editingDistrict.value = district
  form.city = district.city
  form.name = district.name
  form.polygon_wkt = district.polygon_wkt
  form.is_active = district.is_active
  formError.value = ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  formError.value = ''
}

async function submitDistrict() {
  formError.value = ''
  try {
    if (editingDistrict.value) {
      // Город неизменяем: перенос района в другой город = пересоздание.
      await admin.saveDistrict({
        name: form.name,
        polygon_wkt: form.polygon_wkt,
        is_active: form.is_active,
      }, editingDistrict.value.id)
    }
    else {
      await admin.saveDistrict({
        city: form.city,
        name: form.name,
        polygon_wkt: form.polygon_wkt,
        is_active: form.is_active,
      })
    }
    closeModal()
  }
  catch (error) {
    formError.value = error instanceof Error ? error.message : 'Не удалось сохранить район.'
  }
}

// Удаление — двухшаговое подтверждение: полигон дорого перерисовывать.
const confirmingDeleteId = ref('')

async function confirmDelete(district: AdminDistrict) {
  if (confirmingDeleteId.value !== district.id) {
    confirmingDeleteId.value = district.id
    window.setTimeout(() => {
      if (confirmingDeleteId.value === district.id)
        confirmingDeleteId.value = ''
    }, 4000)
    return
  }
  confirmingDeleteId.value = ''
  await admin.removeDistrict(district.id).catch(() => {})
}

// Краткая сводка полигона для карточки: тип + количество вершин.
function polygonSummary(wkt: string) {
  const points = (wkt.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g) ?? []).length
  const type = wkt.trim().toUpperCase().startsWith('MULTI') ? 'MULTIPOLYGON' : 'POLYGON'
  return `${type} · ${points} вершин`
}
</script>

<template>
  <WebPageShell
    embedded
    description="Полигональные зоны приёма заказов: водитель выбирает районы перед выходом на линию. Фильтр мягкий — если в районах никого нет, заказ уходит всем."
    title="Районы городов"
  >
    <template #actions>
      <AppSelectDropdown v-model="cityFilter" label="Город" :options="cityOptions" />
      <button
        class="h-11 rounded-2xl bg-cyan-300 px-5 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
        type="button"
        @click="openCreate()"
      >
        Добавить район
      </button>
    </template>

    <section v-if="admin.isLoadingDistricts && !admin.districts.length" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем районы...
    </section>

    <section v-else-if="!admin.districts.length" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/55 backdrop-blur">
      В этом городе районов пока нет — добавьте первый: имя + полигон строкой WKT.
    </section>

    <div v-else class="grid mt-5 gap-3 lg:grid-cols-3 md:grid-cols-2">
      <article
        v-for="district in admin.districts"
        :key="district.id"
        class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-base font-950">
              {{ district.name }}
            </h3>
            <p class="mt-0.5 text-xs text-white/45">
              {{ district.city }} · {{ polygonSummary(district.polygon_wkt) }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-900"
            :class="district.is_active ? 'bg-emerald-300/14 text-emerald-200' : 'bg-white/10 text-white/45'"
          >
            {{ district.is_active ? 'Активен' : 'Выключен' }}
          </span>
        </div>

        <p class="mt-3 text-xs text-white/40">
          Обновлён: {{ formatDate(district.updated_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}
        </p>

        <div class="mt-4 flex items-center gap-2">
          <button
            class="h-10 flex-1 rounded-xl bg-white/10 text-sm text-white font-800 transition hover:bg-white/14"
            type="button"
            @click="openEdit(district)"
          >
            Изменить
          </button>
          <button
            :disabled="admin.isMutating"
            class="h-10 flex-1 rounded-xl text-sm font-800 transition disabled:opacity-60"
            :class="confirmingDeleteId === district.id ? 'bg-red-400 text-#06142f' : 'bg-red-300/10 text-red-200 hover:bg-red-300/16'"
            type="button"
            @click="confirmDelete(district)"
          >
            {{ confirmingDeleteId === district.id ? 'Точно удалить?' : 'Удалить' }}
          </button>
        </div>
      </article>
    </div>

    <!-- Модалка создания/редактирования района -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="modalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeModal()"
        >
          <form
            class="max-h-[86vh] max-w-xl w-full overflow-y-auto rounded-3xl bg-#071a38 p-6 text-white shadow-2xl"
            @submit.prevent="submitDistrict()"
          >
            <h3 class="text-lg font-950">
              {{ editingDistrict ? `Район: ${editingDistrict.name}` : 'Новый район' }}
            </h3>

            <div class="grid mt-5 gap-4">
              <label v-if="!editingDistrict" class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Город</span>
                <AppSelectDropdown v-model="form.city" label="Город" :options="cityOptions" />
              </label>

              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Название района</span>
                <input
                  v-model="form.name"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  maxlength="100"
                  required
                  type="text"
                >
              </label>

              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Полигон (WKT)</span>
                <textarea
                  v-model="form.polygon_wkt"
                  class="min-h-36 w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-xs font-mono outline-none focus:border-cyan-300/40"
                  placeholder="POLYGON((71.34 51.05, 71.52 51.05, 71.52 51.13, 71.34 51.13, 71.34 51.05))"
                  required
                />
                <span class="text-xs text-white/50 leading-5">
                  Координаты в порядке «долгота широта», контур замкнут (первая точка = последняя). Допустимы POLYGON и MULTIPOLYGON, SRID 4326.
                </span>
              </label>

              <label class="flex items-center gap-2.5 text-sm text-white/70 font-800">
                <input v-model="form.is_active" type="checkbox">
                Район активен (виден водителям и участвует в фильтре)
              </label>
            </div>

            <p v-if="formError" class="mt-4 rounded-xl bg-red-300/10 px-4 py-2.5 text-sm text-red-200">
              {{ formError }}
            </p>

            <div class="mt-6 flex items-center justify-end gap-3">
              <button
                class="h-11 rounded-2xl bg-white/10 px-5 text-sm font-800 transition hover:bg-white/14"
                type="button"
                @click="closeModal()"
              >
                Отмена
              </button>
              <button
                :disabled="admin.isMutating"
                class="h-11 rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ admin.isMutating ? 'Сохраняем...' : 'Сохранить' }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </WebPageShell>
</template>
