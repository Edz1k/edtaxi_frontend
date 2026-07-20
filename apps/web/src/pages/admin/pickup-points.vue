<script setup lang="ts">
import type { AdminPickupPoint } from '~/api/pickupPoints'
import { getAdminCities } from '~/api/admin'
import { showErrorToast } from '~/api/errors'
import {
  createPickupPoint,
  deletePickupPoint,
  getAdminPickupPoints,
  importPickupPointsFrom2GIS,
  updatePickupPoint,
} from '~/api/pickupPoints'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { formatDate } from '~/utils/format'

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({ title: 'Точки подачи | Админка' })

const cityFilter = ref('Астана')
const cityOptions = ref<{ label: string, value: string }[]>([{ label: 'Астана', value: 'Астана' }])

const points = ref<AdminPickupPoint[]>([])
const isLoading = ref(false)
const isMutating = ref(false)
const isImporting = ref(false)
const importResult = ref('')

// Откуда взялась точка. Правит админка только свои — импортированные и
// посчитанные по истории перезапишутся автоматикой, и ручные правки в них
// потерялись бы.
const SOURCE_LABELS: Record<string, string> = {
  '2gis': 'Импорт 2GIS',
  'cluster': 'По истории поездок',
  'manual': 'Добавлено вручную',
}

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source
}

function isEditable(point: AdminPickupPoint) {
  return point.source === 'manual'
}

async function load() {
  isLoading.value = true
  try {
    const response = await getAdminPickupPoints(cityFilter.value)
    points.value = response.pickup_points
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить точки подачи.')
  }
  finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  load()
  try {
    const response = await getAdminCities()
    cityOptions.value = response.cities.map(name => ({ label: name, value: name }))
  }
  catch {} // без справочника остаётся дефолтная Астана
})

watch(cityFilter, load)

// Модалка создания/редактирования: одна форма на оба случая, как у районов.
// При ошибке не закрывается — введённые координаты не теряются.
const modalOpen = ref(false)
const editingPoint = ref<AdminPickupPoint | null>(null)
const form = reactive({ city: 'Астана', name: '', hint: '', lat: '', lng: '', is_active: true })
const formError = ref('')

function openCreate() {
  editingPoint.value = null
  Object.assign(form, { city: cityFilter.value, name: '', hint: '', lat: '', lng: '', is_active: true })
  formError.value = ''
  modalOpen.value = true
}

function openEdit(point: AdminPickupPoint) {
  editingPoint.value = point
  Object.assign(form, {
    city: point.city,
    name: point.name,
    hint: point.hint ?? '',
    lat: String(point.lat),
    lng: String(point.lng),
    is_active: point.is_active,
  })
  formError.value = ''
  modalOpen.value = true
}

// Координаты вводятся строкой, поэтому проверяем их здесь: пустое поле в
// number-инпуте даёт 0, а точка с координатами (0,0) уехала бы в Гвинейский
// залив, и бэкенд отбил бы её невнятной 400.
function parseCoords(): null | { lat: number, lng: number } {
  const lat = Number(form.lat.replace(',', '.'))
  const lng = Number(form.lng.replace(',', '.'))

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))
    return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return null

  return { lat, lng }
}

async function submit() {
  const name = form.name.trim()
  if (!name) {
    formError.value = 'Укажите название — пассажир увидит именно его.'
    return
  }

  const coords = parseCoords()
  if (!coords) {
    formError.value = 'Проверьте координаты: широта −90…90, долгота −180…180.'
    return
  }

  isMutating.value = true
  formError.value = ''
  try {
    if (editingPoint.value) {
      await updatePickupPoint(editingPoint.value.id, {
        name,
        hint: form.hint.trim(),
        lat: coords.lat,
        lng: coords.lng,
        is_active: form.is_active,
      })
    }
    else {
      await createPickupPoint({ city: form.city, name, hint: form.hint.trim(), ...coords })
    }
    modalOpen.value = false
    await load()
  }
  catch (error) {
    formError.value = showErrorToast(error, 'Не удалось сохранить точку.')
  }
  finally {
    isMutating.value = false
  }
}

// Удаление в два тапа, как у районов: случайный клик не должен стирать
// размеченную точку.
const confirmingDeleteId = ref('')

async function confirmDelete(point: AdminPickupPoint) {
  if (confirmingDeleteId.value !== point.id) {
    confirmingDeleteId.value = point.id
    return
  }

  isMutating.value = true
  try {
    await deletePickupPoint(point.id)
    confirmingDeleteId.value = ''
    await load()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось удалить точку.')
  }
  finally {
    isMutating.value = false
  }
}

async function runImport() {
  isImporting.value = true
  importResult.value = ''
  try {
    const response = await importPickupPointsFrom2GIS(cityFilter.value)
    importResult.value = response.message
    await load()
  }
  catch (error) {
    importResult.value = showErrorToast(error, 'Импорт не удался.')
  }
  finally {
    isImporting.value = false
  }
}
</script>

<template>
  <WebPageShell
    embedded
    description="Места, куда реально подъезжает машина: вход в ТРЦ, зал прилёта, подъезд. Пассажир видит их кружками на карте, и пин к ним притягивается. Точки также появляются сами — по истории поездок; вручную размечают то, что статистика не угадает."
    title="Точки подачи"
  >
    <template #actions>
      <AppSelectDropdown v-model="cityFilter" label="Город" :options="cityOptions" />
      <button
        :disabled="isImporting"
        class="h-11 rounded-2xl bg-white/10 px-5 text-sm text-white font-800 transition hover:bg-white/14 disabled:opacity-60"
        type="button"
        @click="runImport"
      >
        {{ isImporting ? 'Импортируем...' : 'Импорт из 2GIS' }}
      </button>
      <button
        class="h-11 rounded-2xl bg-cyan-300 px-5 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
        type="button"
        @click="openCreate()"
      >
        Добавить точку
      </button>
    </template>

    <p v-if="importResult" class="mt-4 border border-white/10 rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/70">
      {{ importResult }}
    </p>

    <section v-if="isLoading && !points.length" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем точки...
    </section>

    <section v-else-if="!points.length" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/55 backdrop-blur">
      В этом городе точек пока нет. Размечать имеет смысл там, где статистика бессильна: аэропорт, вокзал, крупные ТРЦ — места, где посадка регламентирована. Обычные дворы подтянутся сами по истории поездок.
    </section>

    <div v-else class="grid mt-5 gap-3 lg:grid-cols-3 md:grid-cols-2">
      <article
        v-for="point in points"
        :key="point.id"
        class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-base font-950">
              {{ point.name }}
            </h3>
            <p class="mt-0.5 text-xs text-white/45">
              {{ point.city }} · {{ point.lat.toFixed(5) }}, {{ point.lng.toFixed(5) }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-900"
            :class="point.is_active ? 'bg-emerald-300/14 text-emerald-200' : 'bg-white/10 text-white/45'"
          >
            {{ point.is_active ? 'Активна' : 'Выключена' }}
          </span>
        </div>

        <p v-if="point.hint" class="mt-2 text-xs text-white/55">
          {{ point.hint }}
        </p>

        <p class="mt-3 text-xs text-white/40">
          {{ sourceLabel(point.source) }} · обновлена {{ formatDate(point.updated_at, { day: 'numeric', month: 'short' }) }}
        </p>

        <div class="mt-4 flex items-center gap-2">
          <button
            :disabled="!isEditable(point)"
            :title="isEditable(point) ? '' : 'Точка создана автоматически — правки перезапишутся при следующем импорте или пересчёте'"
            class="h-10 flex-1 rounded-xl bg-white/10 text-sm text-white font-800 transition disabled:cursor-not-allowed hover:bg-white/14 disabled:opacity-40"
            type="button"
            @click="openEdit(point)"
          >
            Изменить
          </button>
          <button
            :disabled="isMutating"
            class="h-10 flex-1 rounded-xl text-sm font-800 transition disabled:opacity-60"
            :class="confirmingDeleteId === point.id ? 'bg-red-400 text-#06142f' : 'bg-red-300/10 text-red-200 hover:bg-red-300/16'"
            type="button"
            @click="confirmDelete(point)"
          >
            {{ confirmingDeleteId === point.id ? 'Точно удалить?' : 'Удалить' }}
          </button>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="modalOpen = false"
      >
        <div class="max-h-[90vh] max-w-lg w-full overflow-y-auto border border-white/10 rounded-3xl bg-#06142f p-6">
          <h2 class="text-lg font-950">
            {{ editingPoint ? 'Изменить точку' : 'Новая точка подачи' }}
          </h2>

          <div class="mt-5 space-y-4">
            <label class="block">
              <span class="text-xs text-white/50 font-800">Город</span>
              <AppSelectDropdown v-model="form.city" class="mt-1" :disabled="Boolean(editingPoint)" :options="cityOptions" />
            </label>

            <label class="block">
              <span class="text-xs text-white/50 font-800">Название — его увидит пассажир</span>
              <input
                v-model="form.name"
                class="mt-1 h-11 w-full border border-white/10 rounded-xl bg-white/6 px-3 text-sm text-white"
                placeholder="Вход №3"
                type="text"
              >
            </label>

            <label class="block">
              <span class="text-xs text-white/50 font-800">Подсказка (необязательно)</span>
              <input
                v-model="form.hint"
                class="mt-1 h-11 w-full border border-white/10 rounded-xl bg-white/6 px-3 text-sm text-white"
                placeholder="со стороны парковки"
                type="text"
              >
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-xs text-white/50 font-800">Широта</span>
                <input
                  v-model="form.lat"
                  class="mt-1 h-11 w-full border border-white/10 rounded-xl bg-white/6 px-3 text-sm text-white"
                  inputmode="decimal"
                  placeholder="51.12820"
                  type="text"
                >
              </label>
              <label class="block">
                <span class="text-xs text-white/50 font-800">Долгота</span>
                <input
                  v-model="form.lng"
                  class="mt-1 h-11 w-full border border-white/10 rounded-xl bg-white/6 px-3 text-sm text-white"
                  inputmode="decimal"
                  placeholder="71.43040"
                  type="text"
                >
              </label>
            </div>

            <label v-if="editingPoint" class="flex items-center gap-2">
              <input v-model="form.is_active" type="checkbox">
              <span class="text-sm text-white/70">Активна — показывается пассажирам</span>
            </label>

            <p v-if="formError" class="rounded-xl bg-red-300/10 px-3 py-2 text-sm text-red-200">
              {{ formError }}
            </p>
          </div>

          <div class="mt-6 flex items-center gap-2">
            <button
              class="h-11 flex-1 rounded-xl bg-white/10 text-sm text-white font-800 transition hover:bg-white/14"
              type="button"
              @click="modalOpen = false"
            >
              Отмена
            </button>
            <button
              :disabled="isMutating"
              class="h-11 flex-1 rounded-xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
              type="button"
              @click="submit"
            >
              {{ isMutating ? 'Сохраняем...' : 'Сохранить' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </WebPageShell>
</template>
