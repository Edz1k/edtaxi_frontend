<script setup lang="ts">
import type { FeedbackItem, FeedbackStatus } from '~/types/feedback'
import { showErrorToast } from '~/api/errors'
import { implementAdminFeedback, listAdminFeedback, rejectAdminFeedback } from '~/api/feedback'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useToast } from '~/composables/useToast'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
    requiresAuth: true,
  },
})

useHead({
  title: 'Предложения | Админка',
})

const toast = useToast()

const PAGE_SIZE = 50

const FILTERS: Array<{ label: string, value: '' | FeedbackStatus }> = [
  { label: 'Все', value: '' },
  { label: 'Новые', value: 'new' },
  { label: 'Внедрённые', value: 'implemented' },
  { label: 'Отклонённые', value: 'declined' },
]

const STATUS_META: Record<FeedbackStatus, { class: string, label: string }> = {
  declined: { class: 'bg-red-400/14 text-red-200', label: 'Отклонено' },
  implemented: { class: 'bg-emerald-400/14 text-emerald-200', label: 'Внедрено' },
  new: { class: 'bg-amber-400/14 text-amber-200', label: 'Новое' },
}

const items = ref<FeedbackItem[]>([])
const total = ref(0)
const filter = ref<'' | FeedbackStatus>('')
const isLoading = ref(false)
const isMutating = ref(false)

// Диалог «Внедрено → выдать награду».
const rewardTarget = ref<FeedbackItem | null>(null)
const rewardAmount = ref(0)

onMounted(load)

async function load() {
  isLoading.value = true
  try {
    const response = await listAdminFeedback({ limit: PAGE_SIZE, offset: 0, status: filter.value })
    items.value = response.feedback
    total.value = response.total
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить предложения.')
  }
  finally {
    isLoading.value = false
  }
}

async function loadMore() {
  isLoading.value = true
  try {
    const response = await listAdminFeedback({ limit: PAGE_SIZE, offset: items.value.length, status: filter.value })
    items.value = [...items.value, ...response.feedback]
    total.value = response.total
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить предложения.')
  }
  finally {
    isLoading.value = false
  }
}

function selectFilter(value: '' | FeedbackStatus) {
  if (filter.value === value)
    return
  filter.value = value
  load()
}

// Под активным фильтром (кроме «Все») ушедшее из статуса предложение убираем из
// списка, чтобы не висело с неподходящим статусом.
function dropIfFiltered(item: FeedbackItem) {
  if (filter.value && filter.value !== item.status) {
    items.value = items.value.filter(i => i.id !== item.id)
    total.value = Math.max(0, total.value - 1)
  }
}

function openReward(item: FeedbackItem) {
  rewardTarget.value = item
  rewardAmount.value = 0
}

async function confirmReward() {
  const target = rewardTarget.value
  if (!target || isMutating.value || rewardAmount.value < 0)
    return

  isMutating.value = true
  try {
    const response = await implementAdminFeedback(target.id, rewardAmount.value)
    target.status = 'implemented'
    target.reward_bonus = rewardAmount.value
    target.reward_sent = response.reward_sent
    toast.success(
      'Внедрено',
      rewardAmount.value > 0 ? `Автору начислено ${rewardAmount.value} бонусов.` : 'Предложение отмечено внедрённым.',
    )
    rewardTarget.value = null
    dropIfFiltered(target)
  }
  catch (error) {
    showErrorToast(error, 'Не удалось внедрить предложение.')
  }
  finally {
    isMutating.value = false
  }
}

async function reject(item: FeedbackItem) {
  isMutating.value = true
  try {
    await rejectAdminFeedback(item.id)
    item.status = 'declined'
    dropIfFiltered(item)
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отклонить предложение.')
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
    embedded
    description="Предложения по улучшению от пассажиров и водителей. Внедрите идею и поблагодарите автора бонусами — начисление идёт через бонусный счёт."
    title="Предложения"
  >
    <!-- Фильтр по статусу -->
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
      Загружаем предложения…
    </div>
    <div v-else-if="!items.length" class="mt-6 border border-white/10 rounded-3xl bg-white/6 px-4 py-10 text-center text-sm text-white/50">
      Предложений пока нет.
    </div>

    <div v-else class="mt-5 space-y-3">
      <article
        v-for="item in items"
        :key="item.id"
        class="border border-white/10 rounded-3xl bg-white/6 p-4 backdrop-blur"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="h-6 rounded-full px-2.5 text-xs font-900 leading-6"
            :class="item.role === 'driver' ? 'bg-amber-400/14 text-amber-200' : 'bg-cyan-300/14 text-cyan-200'"
          >
            {{ item.role === 'driver' ? 'Водитель' : 'Пассажир' }}
          </span>
          <span class="h-6 rounded-full px-2.5 text-xs font-900 leading-6" :class="STATUS_META[item.status].class">
            {{ STATUS_META[item.status].label }}
          </span>
          <span
            v-if="item.status === 'implemented' && item.reward_sent && item.reward_bonus > 0"
            class="h-6 rounded-full bg-emerald-400/10 px-2.5 text-xs text-emerald-200/90 font-800 leading-6"
          >
            +{{ item.reward_bonus }} бонусов
          </span>
          <span class="ml-auto text-xs text-white/40 font-700">{{ formatDate(item.created_at) }}</span>
        </div>

        <p class="mt-3 whitespace-pre-line text-sm text-white/85 leading-6">
          {{ item.message }}
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45 font-700">
          <span v-if="item.user_name">{{ item.user_name }}</span>
          <span v-if="item.phone">{{ item.phone }}</span>
        </div>

        <div v-if="item.status === 'new'" class="mt-4 flex gap-2">
          <button
            :disabled="isMutating"
            type="button"
            class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            @click="openReward(item)"
          >
            Внедрить
          </button>
          <button
            :disabled="isMutating"
            type="button"
            class="h-10 rounded-xl bg-white/8 px-4 text-sm text-white/70 font-900 transition active:scale-[0.98] hover:bg-white/12 disabled:opacity-50"
            @click="reject(item)"
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

    <!-- Диалог награды -->
    <div
      v-if="rewardTarget"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="rewardTarget = null"
    >
      <div class="max-w-sm w-full border border-white/12 rounded-3xl bg-#071a38 p-5 text-white shadow-2xl">
        <h3 class="text-lg font-950">
          Внедрить предложение
        </h3>
        <p class="mt-1 text-sm text-white/50">
          Награда автору за идею. Оставьте 0, чтобы отметить внедрённым без начисления.
        </p>

        <label class="mt-4 block text-xs text-white/45 font-900 uppercase">Бонусы автору</label>
        <input
          v-model.number="rewardAmount"
          type="number"
          min="0"
          max="1000000"
          class="mt-2 h-11 w-full border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none transition focus:bg-white/8"
        >

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="h-11 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition hover:bg-white/12"
            @click="rewardTarget = null"
          >
            Отмена
          </button>
          <button
            :disabled="isMutating || rewardAmount < 0"
            type="button"
            class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            @click="confirmReward"
          >
            {{ isMutating ? 'Внедряем…' : 'Внедрить' }}
          </button>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
