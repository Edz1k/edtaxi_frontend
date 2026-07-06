<script setup lang="ts">
import type { PlatformGarageResponse } from '~/types/park'
import type { ParkJoinRequest } from '~/types/promotions'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import { approvePlatformGarageRequest, createPlatformGarage, getPlatformGarage, rejectPlatformGarageRequest, updateAdminPark } from '~/api/park'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useToast } from '~/composables/useToast'
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
  title: 'Гараж платформы | Админка',
})

const toast = useToast()

const garage = ref<PlatformGarageResponse | null>(null)
// true — бэкенд ответил 404 "no platform park": гараж ещё не создан.
const notCreated = ref(false)
const isLoading = ref(false)
const isMutating = ref(false)
// id заявки, по которой идёт запрос — блокируем только её кнопки.
const mutatingRequestId = ref('')

const createForm = reactive({
  name: 'Гараж платформы',
  description: '',
  phone: '',
  // Комиссия парка в процентах. У гаража обычно 0 (водитель платит только
  // процент платформы), но задаём настраиваемой прямо при создании.
  commissionPercent: 0,
})

const isEditOpen = ref(false)
const editForm = reactive({
  name: '',
  description: '',
  phone: '',
  // В форме — проценты, бэкенд ждёт долю (0.03 = 3%). Для гаража держим 0.
  commissionPercent: 0,
})

const pendingRequests = computed(() =>
  garage.value?.requests.filter(request => request.status === 'pending') ?? [],
)

const commissionLabel = computed(() => {
  const rate = garage.value?.park.commission_rate ?? 0
  return `${(rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`
})

// Сводная статистика по водителям гаража — считаем на клиенте из списка,
// без отдельного эндпоинта: всего / онлайн сейчас / суммарные поездки / рейтинг.
const stats = computed(() => {
  const drivers = garage.value?.drivers ?? []
  const online = drivers.filter(driver => driver.is_online).length
  const totalTrips = drivers.reduce((sum, driver) => sum + (driver.total_trips ?? 0), 0)
  const avgRating = drivers.length
    ? drivers.reduce((sum, driver) => sum + (driver.rating ?? 0), 0) / drivers.length
    : 0
  return { count: drivers.length, online, totalTrips, avgRating }
})

onMounted(load)

async function load() {
  isLoading.value = true
  try {
    garage.value = await getPlatformGarage()
    notCreated.value = false
  }
  catch (error) {
    // 404 — новый бэкенд («platform garage is not created yet»); 503 — старый
    // бэкенд до редеплоя («platform partner park is not configured»). В обоих
    // случаях гаража ещё нет — показываем форму создания, а не «ошибку сервиса».
    if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
      garage.value = null
      notCreated.value = true
    }
    else {
      showErrorToast(error, 'Не удалось загрузить гараж платформы.')
    }
  }
  finally {
    isLoading.value = false
  }
}

async function create() {
  if (!createForm.name.trim() || isMutating.value)
    return
  isMutating.value = true
  try {
    const park = await createPlatformGarage({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      phone: createForm.phone.trim() || undefined,
    })
    // Эндпоинт создания держит комиссию 0; если задали ненулевую — доставляем
    // её отдельным PUT.
    if (createForm.commissionPercent > 0)
      await updateAdminPark(park.id, { commission_rate: createForm.commissionPercent / 100 })
    toast.success('Гараж создан', 'Заявки водителей «Стать партнёром платформы» будут падать сюда.')
    await load()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось создать гараж платформы.')
  }
  finally {
    isMutating.value = false
  }
}

function openEdit() {
  const park = garage.value?.park
  if (!park)
    return
  editForm.name = park.name
  editForm.description = park.description ?? ''
  editForm.phone = park.phone ?? ''
  editForm.commissionPercent = Math.round(park.commission_rate * 10000) / 100
  isEditOpen.value = true
}

async function saveEdit() {
  const park = garage.value?.park
  if (!park || !editForm.name.trim() || isMutating.value)
    return
  isMutating.value = true
  try {
    const updated = await updateAdminPark(park.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      commission_rate: editForm.commissionPercent / 100,
    })
    if (garage.value)
      garage.value.park = updated
    isEditOpen.value = false
    toast.success('Сохранено', 'Данные гаража обновлены.')
  }
  catch (error) {
    showErrorToast(error, 'Не удалось сохранить изменения гаража.')
  }
  finally {
    isMutating.value = false
  }
}

async function resolveRequest(request: ParkJoinRequest, approved: boolean) {
  mutatingRequestId.value = request.id
  try {
    await (approved ? approvePlatformGarageRequest(request.id) : rejectPlatformGarageRequest(request.id))
    if (approved) {
      toast.success('Заявка принята', 'Водитель добавлен в гараж платформы.')
      // Принятый водитель появляется в списке гаража — перезагружаем целиком.
      await load()
    }
    else if (garage.value) {
      garage.value.requests = garage.value.requests.filter(item => item.id !== request.id)
    }
  }
  catch (error) {
    showErrorToast(error, approved ? 'Не удалось принять заявку.' : 'Не удалось отклонить заявку.')
  }
  finally {
    mutatingRequestId.value = ''
  }
}
</script>

<template>
  <WebPageShell
    embedded
    description="Платформенный парк с нулевой парковой комиссией: сюда падают заявки водителей «Стать партнёром платформы», водитель платит только процент платформы."
    title="Гараж платформы"
  >
    <template #actions>
      <button
        :disabled="isLoading"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="load()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': isLoading }" />
        {{ isLoading ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <!-- Edit modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="isEditOpen"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="isEditOpen = false"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="saveEdit()"
          >
            <h2 class="text-xl font-950">
              Редактировать гараж
            </h2>

            <label class="grid mt-5 gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Название</span>
              <input
                v-model="editForm.name"
                class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                maxlength="200"
                type="text"
              >
            </label>

            <label class="grid mt-4 gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Описание</span>
              <textarea
                v-model="editForm.description"
                class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
                maxlength="500"
                rows="2"
              />
            </label>

            <div class="grid mt-4 gap-4 sm:grid-cols-2">
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Телефон</span>
                <input
                  v-model="editForm.phone"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  placeholder="+7 700 000 00 00"
                  type="tel"
                >
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Комиссия парка, %</span>
                <input
                  v-model.number="editForm.commissionPercent"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  max="100"
                  min="0"
                  step="0.1"
                  type="number"
                >
              </label>
            </div>
            <p class="mt-2 text-xs text-white/45 leading-5">
              Смысл гаража — нулевая парковая комиссия: водитель платит только процент платформы. Меняйте значение, только если точно понимаете зачем.
            </p>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="isMutating || !editForm.name.trim()"
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ isMutating ? 'Сохраняем...' : 'Сохранить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="isEditOpen = false"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <div v-if="isLoading && !garage && !notCreated" class="mt-6 border border-white/10 rounded-3xl bg-white/8 px-5 py-8 text-sm text-white/50 backdrop-blur">
      Загружаем гараж платформы...
    </div>

    <!-- Гаража ещё нет: пустое состояние с формой создания. -->
    <section v-else-if="notCreated" class="mt-6 border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur">
      <div class="flex items-start gap-4">
        <span class="h-13 w-13 flex shrink-0 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
          <span class="i-mdi-garage text-7" />
        </span>
        <div>
          <h2 class="text-xl font-950">
            Гараж ещё не создан
          </h2>
          <p class="mt-2 max-w-xl text-sm text-white/55 leading-6">
            Создайте платформенный парк — водители без парка смогут нажать «Стать партнёром платформы» и попасть сюда. Комиссия парка будет 0, водитель платит только платформенный процент.
          </p>
        </div>
      </div>

      <form class="grid mt-6 max-w-xl gap-4" @submit.prevent="create()">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Название</span>
          <input
            v-model="createForm.name"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            maxlength="200"
            placeholder="Гараж платформы"
            type="text"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Описание (необязательно)</span>
          <textarea
            v-model="createForm.description"
            class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
            maxlength="500"
            placeholder="Официальный парк платформы для водителей-партнёров..."
            rows="2"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Телефон (необязательно)</span>
          <input
            v-model="createForm.phone"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            placeholder="+7 700 000 00 00"
            type="tel"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Комиссия парка, % (обычно 0)</span>
          <input
            v-model.number="createForm.commissionPercent"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            max="100"
            min="0"
            step="0.1"
            type="number"
          >
          <span class="text-xs text-white/40 leading-5">Смысл гаража — нулевая парковая комиссия: водитель платит только процент платформы. Оставьте 0, если не уверены — потом можно изменить.</span>
        </label>
        <button
          :disabled="isMutating || !createForm.name.trim()"
          class="h-11 w-fit rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ isMutating ? 'Создаём...' : 'Создать гараж' }}
        </button>
      </form>
    </section>

    <template v-else-if="garage">
      <!-- Карточка парка -->
      <section class="mt-6 border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex items-start gap-4">
            <span class="h-13 w-13 flex shrink-0 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
              <span class="i-mdi-garage text-7" />
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate text-xl font-950">
                  {{ garage.park.name }}
                </h2>
                <span
                  v-if="garage.park.is_platform"
                  class="shrink-0 border border-cyan-200/16 rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100 font-900"
                >
                  Партнёр платформы
                </span>
              </div>
              <p v-if="garage.park.description" class="mt-1 max-w-xl text-sm text-white/55 leading-6">
                {{ garage.park.description }}
              </p>
              <p class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/50 font-800">
                <span class="inline-flex items-center gap-1.5">
                  <span class="i-mdi-phone-outline text-4 text-cyan-200" />
                  {{ garage.park.phone || 'Телефон не указан' }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="i-mdi-percent-outline text-4 text-cyan-200" />
                  Комиссия парка: {{ commissionLabel }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="i-mdi-calendar-outline text-4 text-cyan-200" />
                  Создан {{ formatDate(garage.park.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </span>
              </p>
            </div>
          </div>

          <button
            class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-2xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
            type="button"
            @click="openEdit()"
          >
            <span class="i-mdi-pencil-outline text-4.5 text-cyan-200" />
            Редактировать
          </button>
        </div>
      </section>

      <!-- Статистика по водителям гаража -->
      <section class="grid grid-cols-2 mt-6 gap-3 lg:grid-cols-4">
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Водители
          </p>
          <p class="mt-1 text-3xl font-950">
            {{ stats.count }}
          </p>
        </div>
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Онлайн сейчас
          </p>
          <p class="mt-1 text-3xl text-emerald-300 font-950">
            {{ stats.online }}
          </p>
        </div>
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Поездок всего
          </p>
          <p class="mt-1 text-3xl font-950">
            {{ stats.totalTrips.toLocaleString('ru-RU') }}
          </p>
        </div>
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Средний рейтинг
          </p>
          <p class="mt-1 inline-flex items-center gap-1.5 text-3xl font-950">
            <span class="i-mdi-star text-6 text-amber-300" />
            {{ stats.avgRating ? stats.avgRating.toFixed(2) : '—' }}
          </p>
        </div>
      </section>

      <!-- Заявки на партнёрство -->
      <section class="mt-6">
        <h2 class="text-xl font-950">
          Заявки на партнёрство
          <span v-if="pendingRequests.length" class="ml-1 text-cyan-200">{{ pendingRequests.length }}</span>
        </h2>

        <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
          <div class="grid-cols-[minmax(180px,1fr)_110px_110px_150px_220px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
            <span>Водитель</span>
            <span>Рейтинг</span>
            <span>Поездки</span>
            <span>Подана</span>
            <span class="text-right">Действие</span>
          </div>

          <div v-if="!pendingRequests.length" class="px-4 py-8 text-center text-sm text-white/45">
            Новых заявок нет.
          </div>

          <div
            v-for="request in pendingRequests"
            v-else
            :key="request.id"
            class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_110px_110px_150px_220px] md:items-center last:border-b-0"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-900">
                {{ request.driver_name || 'Без имени' }}
              </p>
              <p class="mt-0.5 truncate text-xs text-white/42">
                {{ request.driver_phone || request.driver_id }}
              </p>
            </div>

            <span class="text-sm text-white/62 font-800">
              {{ request.driver_rating != null ? request.driver_rating.toFixed(1) : '—' }}
            </span>

            <span class="text-sm text-white/62 font-800">
              {{ request.driver_total_trips ?? 0 }}
            </span>

            <span class="text-sm text-white/50 font-800">
              {{ formatDate(request.created_at) }}
            </span>

            <div class="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              <button
                :disabled="mutatingRequestId === request.id"
                class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
                type="button"
                @click="resolveRequest(request, true)"
              >
                Принять
              </button>
              <button
                :disabled="mutatingRequestId === request.id"
                class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
                type="button"
                @click="resolveRequest(request, false)"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Водители гаража -->
      <section class="mt-6">
        <h2 class="text-xl font-950">
          Водители гаража
          <span v-if="garage.drivers.length" class="ml-1 text-cyan-200">{{ garage.drivers.length }}</span>
        </h2>

        <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
          <div class="grid-cols-[minmax(180px,1fr)_110px_110px_150px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
            <span>Водитель</span>
            <span>Рейтинг</span>
            <span>Поездки</span>
            <span>Статус</span>
          </div>

          <div v-if="!garage.drivers.length" class="px-4 py-8 text-center text-sm text-white/45">
            В гараже пока нет водителей — примите первую заявку.
          </div>

          <div
            v-for="driver in garage.drivers"
            v-else
            :key="driver.id"
            class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_110px_110px_150px] md:items-center last:border-b-0"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-900">
                {{ driver.name || 'Без имени' }}
              </p>
              <p class="mt-0.5 truncate text-xs text-white/42">
                {{ driver.phone || driver.user_id }}
              </p>
            </div>

            <span class="inline-flex items-center gap-1.5 text-sm text-white/62 font-800">
              <span class="i-mdi-star text-4 text-amber-300" />
              {{ driver.rating.toFixed(1) }}
            </span>

            <span class="text-sm text-white/62 font-800">
              {{ driver.total_trips }}
            </span>

            <span
              class="w-fit rounded-full px-3 py-1.5 text-xs font-900"
              :class="driver.is_online ? 'bg-emerald-500/12 text-emerald-300' : 'bg-white/8 text-white/45'"
            >
              {{ driver.is_online ? 'Онлайн' : 'Офлайн' }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </WebPageShell>
</template>
