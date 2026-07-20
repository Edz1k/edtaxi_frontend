<script setup lang="ts">
import type { ApproveCarRequestPayload, CarCatalogRequestItem, CarCatalogRequestStatus, CatalogMaxClass } from '~/types/carRequest'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import { approveCarRequest, listCarRequests, rejectCarRequest } from '~/api/carRequest'
import { showErrorToast } from '~/api/errors'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useToast } from '~/composables/useToast'
import { validateCatalogEntryForm } from '~/utils/carRequestForm'

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Заявки в каталог | Telegram Taxi',
})

const toast = useToast()

const PAGE_SIZE = 20

const FILTERS: Array<{ label: string, value: '' | CarCatalogRequestStatus }> = [
  { label: 'Все', value: '' },
  { label: 'Новые', value: 'pending' },
  { label: 'Одобренные', value: 'approved' },
  { label: 'Отклонённые', value: 'rejected' },
]

const STATUS_META: Record<CarCatalogRequestStatus, { class: string, label: string }> = {
  pending: { class: 'bg-amber-400/14 text-amber-200', label: 'На рассмотрении' },
  approved: { class: 'bg-emerald-400/14 text-emerald-200', label: 'Одобрено' },
  rejected: { class: 'bg-red-400/14 text-red-200', label: 'Отклонено' },
}

// Только допустимые CHECK-констрейнтом класса каталога значения (не весь CATEGORY_LABELS).
const MAX_CLASS_OPTIONS: Array<{ label: string, value: CatalogMaxClass }> = [
  { label: 'Эконом', value: 'economy' },
  { label: 'Комфорт', value: 'comfort' },
  { label: 'Бизнес', value: 'business' },
  { label: 'Комфорт+', value: 'comfort_plus' },
  { label: 'Бизнес+', value: 'business_plus' },
]

const items = ref<CarCatalogRequestItem[]>([])
const total = ref(0)
const filter = ref<'' | CarCatalogRequestStatus>('pending')
const isLoading = ref(false)
const isMutating = ref(false)

// Модалка одобрения: строка каталога, предзаполненная из заявки.
const approveTarget = ref<CarCatalogRequestItem | null>(null)
const form = reactive<ApproveCarRequestPayload>({
  make: '',
  model: '',
  year_from: 0,
  year_to: null,
  max_class: 'economy',
  is_minivan: false,
})

// Модалка отклонения.
const rejectTarget = ref<CarCatalogRequestItem | null>(null)
const rejectReason = ref('')

onMounted(load)
useAutoRefresh(load, { intervalMs: 15000 })

async function load() {
  isLoading.value = true
  try {
    const res = await listCarRequests({ limit: PAGE_SIZE, offset: 0, status: filter.value })
    items.value = res.requests
    total.value = res.total
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить заявки.')
  }
  finally {
    isLoading.value = false
  }
}

async function loadMore() {
  isLoading.value = true
  try {
    const res = await listCarRequests({ limit: PAGE_SIZE, offset: items.value.length, status: filter.value })
    items.value = [...items.value, ...res.requests]
    total.value = res.total
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить заявки.')
  }
  finally {
    isLoading.value = false
  }
}

function selectFilter(value: '' | CarCatalogRequestStatus) {
  if (filter.value === value)
    return
  filter.value = value
  load()
}

function dropIfFiltered(item: CarCatalogRequestItem) {
  if (filter.value && filter.value !== item.status) {
    items.value = items.value.filter(i => i.id !== item.id)
    total.value = Math.max(0, total.value - 1)
  }
}

function openApprove(item: CarCatalogRequestItem) {
  approveTarget.value = item
  form.make = item.make
  form.model = item.model
  form.year_from = item.year
  form.year_to = null
  form.max_class = 'economy'
  form.is_minivan = false
}

async function confirmApprove() {
  const target = approveTarget.value
  if (!target || isMutating.value)
    return
  const err = validateCatalogEntryForm(form)
  if (err) {
    toast.error('Проверьте форму', err)
    return
  }

  isMutating.value = true
  try {
    await approveCarRequest(target.id, { ...form })
    target.status = 'approved'
    toast.success('Одобрено', 'Модель добавлена в каталог, категории машин пересчитаны.')
    approveTarget.value = null
    dropIfFiltered(target)
  }
  catch (error) {
    showErrorToast(error, 'Не удалось одобрить заявку. Возможно, модель уже в каталоге — проверьте и отклоните.')
  }
  finally {
    isMutating.value = false
  }
}

async function confirmReject() {
  const target = rejectTarget.value
  if (!target || isMutating.value || !rejectReason.value.trim())
    return

  isMutating.value = true
  try {
    await rejectCarRequest(target.id, rejectReason.value.trim())
    target.status = 'rejected'
    target.rejection_reason = rejectReason.value.trim()
    rejectTarget.value = null
    rejectReason.value = ''
    dropIfFiltered(target)
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отклонить заявку.')
  }
  finally {
    isMutating.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    description="Заявки водителей на добавление их модели в каталог машин. Одобрение создаёт строку каталога и пересчитывает тарифы машин этой модели."
    title="Заявки в каталог"
  >
    <div class="mt-5 flex flex-wrap gap-2">
      <button
        v-for="f in FILTERS"
        :key="f.value"
        type="button"
        class="h-9 rounded-full px-4 text-sm font-900 transition"
        :class="filter === f.value
          ? 'bg-cyan-300 text-#06142f'
          : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white'"
        @click="selectFilter(f.value)"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="isLoading && !items.length" class="mt-6 px-1 py-6 text-sm text-white/50">
      Загружаем заявки…
    </div>
    <div v-else-if="!items.length" class="mt-6 border border-white/10 rounded-3xl bg-white/6 px-4 py-10 text-center text-sm text-white/50">
      Заявок пока нет.
    </div>

    <div v-else class="mt-5 space-y-3">
      <article
        v-for="item in items"
        :key="item.id"
        class="border border-white/10 rounded-3xl bg-white/6 p-4 backdrop-blur"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="h-6 rounded-full px-2.5 text-xs font-900 leading-6" :class="STATUS_META[item.status].class">
            {{ STATUS_META[item.status].label }}
          </span>
          <span class="ml-auto text-xs text-white/40 font-700">{{ formatDate(item.created_at) }}</span>
        </div>

        <p class="mt-3 text-base text-white font-900">
          {{ item.make }} {{ item.model }} <span class="text-white/50 font-700">· {{ item.year }}</span>
        </p>
        <p v-if="item.comment" class="mt-1 whitespace-pre-line text-sm text-white/70 leading-6">
          {{ item.comment }}
        </p>
        <p v-if="item.status === 'rejected' && item.rejection_reason" class="mt-2 text-xs text-red-300/90">
          Причина отказа: {{ item.rejection_reason }}
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45 font-700">
          <RouterLink v-if="item.driver_user_id" class="text-cyan-200 hover:underline" :to="`/drivers/${item.driver_user_id}`">
            {{ item.user_name || 'Водитель' }}
          </RouterLink>
          <span v-else-if="item.user_name">{{ item.user_name }}</span>
          <span v-if="item.phone">{{ item.phone }}</span>
        </div>

        <div v-if="item.status === 'pending'" class="mt-4 flex gap-2">
          <button
            :disabled="isMutating"
            type="button"
            class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            @click="openApprove(item)"
          >
            Одобрить
          </button>
          <button
            :disabled="isMutating"
            type="button"
            class="h-10 rounded-xl bg-white/8 px-4 text-sm text-white/70 font-900 transition active:scale-[0.98] hover:bg-white/12 disabled:opacity-50"
            @click="rejectTarget = item; rejectReason = ''"
          >
            Отклонить
          </button>
        </div>
      </article>

      <button
        v-if="items.length < total"
        :disabled="isLoading"
        type="button"
        class="h-11 w-full rounded-2xl bg-white/8 text-sm text-white/70 font-900 transition hover:bg-white/12 disabled:opacity-50"
        @click="loadMore"
      >
        {{ isLoading ? 'Загружаем…' : 'Показать ещё' }}
      </button>
    </div>

    <!-- Модалка одобрения = запись каталога -->
    <div
      v-if="approveTarget"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="approveTarget = null"
    >
      <div class="max-w-md w-full border border-white/12 rounded-3xl bg-#071a38 p-5 text-white shadow-2xl">
        <h3 class="text-lg font-950">
          Добавить в каталог
        </h3>
        <p class="mt-1 text-sm text-white/50">
          Проверьте написание и задайте класс. Марку/модель можно поправить — так они попадут в каталог.
        </p>

        <div class="grid grid-cols-2 mt-4 gap-3">
          <label class="block">
            <span class="mb-1.5 block text-xs text-white/45 font-900 uppercase">Марка</span>
            <input v-model="form.make" class="h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none focus:bg-white/8">
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-white/45 font-900 uppercase">Модель</span>
            <input v-model="form.model" class="h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none focus:bg-white/8">
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-white/45 font-900 uppercase">Год с</span>
            <input v-model.number="form.year_from" type="number" min="1990" class="h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none focus:bg-white/8">
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-white/45 font-900 uppercase">Год по (пусто = по н.в.)</span>
            <input v-model.number="form.year_to" type="number" min="1990" class="h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none focus:bg-white/8">
          </label>
        </div>

        <label class="mt-3 block">
          <span class="mb-1.5 block text-xs text-white/45 font-900 uppercase">Максимальный класс</span>
          <select v-model="form.max_class" class="h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none focus:bg-white/8">
            <option :value="null">
              — только минивэн —
            </option>
            <option v-for="opt in MAX_CLASS_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="mt-3 flex items-center gap-2 text-sm text-white/80">
          <input v-model="form.is_minivan" type="checkbox" class="h-4 w-4">
          Минивэн (доступен как минивэн независимо от класса)
        </label>

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="h-11 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition hover:bg-white/12"
            @click="approveTarget = null"
          >
            Отмена
          </button>
          <button
            :disabled="isMutating"
            type="button"
            class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            @click="confirmApprove"
          >
            {{ isMutating ? 'Добавляем…' : 'Добавить и одобрить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модалка отклонения -->
    <div
      v-if="rejectTarget"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="rejectTarget = null"
    >
      <div class="max-w-sm w-full border border-white/12 rounded-3xl bg-#071a38 p-5 text-white shadow-2xl">
        <h3 class="text-lg font-950">
          Отклонить заявку
        </h3>
        <p class="mt-1 text-sm text-white/50">
          Причину увидит водитель.
        </p>
        <textarea
          v-model="rejectReason"
          class="mt-4 min-h-24 w-full border border-white/10 rounded-2xl bg-white/6 px-4 py-3 text-sm text-white outline-none focus:bg-white/8"
          maxlength="500"
          placeholder="Например: такой модели не существует / неверное написание"
        />
        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="h-11 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition hover:bg-white/12"
            @click="rejectTarget = null"
          >
            Отмена
          </button>
          <button
            :disabled="isMutating || !rejectReason.trim()"
            type="button"
            class="h-11 flex-1 rounded-2xl bg-red-400/80 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-50"
            @click="confirmReject"
          >
            {{ isMutating ? 'Отклоняем…' : 'Отклонить' }}
          </button>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
