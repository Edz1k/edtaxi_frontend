<script setup lang="ts">
import type { DriverOverview, DriverRatingEvent } from '~/types/driver-overview'
import { getDriverOverview } from '~/api/driver'

const data = ref<DriverOverview | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    backTo: '/menu/profile',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в профиль',
    screenTitle: 'История рейтинга',
  },
})

useHead({ title: 'История рейтинга | EdTaxi Driver' })

onMounted(load)

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    data.value = await getDriverOverview()
  }
  catch {
    errorMessage.value = 'Не удалось загрузить данные.'
  }
  finally {
    isLoading.value = false
  }
}

const RATING_EVENT_LABELS: Record<string, string> = {
  complaint_confirmed: 'Подтверждённая жалоба',
  cancel_after_accept: 'Отмена после принятия',
  driver_no_show: 'Неявка к пассажиру',
}

function eventLabel(e: DriverRatingEvent) {
  return RATING_EVENT_LABELS[e.type] ?? e.type
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

const avgRecentScore = computed(() => {
  const ratings = data.value?.recent_ratings
  if (!ratings?.length)
    return null
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)]">
    <section class="mx-auto max-w-sm">
      <div v-if="isLoading" class="mt-10 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем историю...
      </div>

      <div v-else-if="errorMessage" class="mt-10 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300">
        {{ errorMessage }}
      </div>

      <template v-else-if="data">
        <!-- Сводка -->
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-white/5 px-4 py-4">
            <p class="text-[10px] text-slate-500 font-900 tracking-wider uppercase">
              Текущий рейтинг
            </p>
            <p
              class="mt-1 text-3xl font-950 leading-none"
              :class="data.driver.rating >= 4.5 ? 'text-emerald-300' : 'text-amber-300'"
            >
              {{ data.driver.rating.toFixed(2) }}
            </p>
            <div class="mt-2 flex gap-0.5">
              <span
                v-for="i in 5"
                :key="i"
                class="text-sm leading-none"
                :class="i <= Math.round(data.driver.rating)
                  ? (data.driver.rating >= 4.5 ? 'text-emerald-400' : 'text-amber-400')
                  : 'text-white/12'"
              >★</span>
            </div>
          </div>
          <div class="rounded-2xl bg-white/5 px-4 py-4">
            <p class="text-[10px] text-slate-500 font-900 tracking-wider uppercase">
              Средняя оценка
            </p>
            <p class="mt-1 text-3xl font-950 leading-none" :class="avgRecentScore !== null && avgRecentScore >= 4 ? 'text-emerald-300' : 'text-amber-300'">
              {{ avgRecentScore !== null ? avgRecentScore.toFixed(1) : '—' }}
            </p>
            <p class="mt-2 text-[11px] text-slate-500 font-700">
              {{ data.recent_ratings.length > 0 ? `из ${data.recent_ratings.length} оценок` : 'Оценок нет' }}
            </p>
          </div>
        </div>

        <!-- Штрафные события -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          Штрафные события
        </h2>
        <p v-if="!data.rating_events.length" class="mt-3 flex items-center gap-2 text-sm text-slate-500 font-700">
          <span class="i-mdi-check-circle text-5 text-emerald-400/60" />
          Штрафов к рейтингу не было. Так держать!
        </p>
        <div v-else class="mt-3 space-y-2">
          <div
            v-for="e in data.rating_events"
            :key="e.id"
            class="rounded-2xl bg-red-500/8 px-4 py-3"
          >
            <div class="flex items-start gap-3">
              <span class="i-mdi-trending-down mt-0.5 shrink-0 text-5 text-red-400" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-900">
                  {{ eventLabel(e) }}
                </p>
                <p v-if="e.reason" class="mt-0.5 text-xs text-slate-400">
                  {{ e.reason }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm text-red-300 font-950">
                  {{ e.delta.toFixed(2) }}
                </p>
                <p class="mt-0.5 text-xs text-slate-500">
                  → {{ e.rating_after.toFixed(2) }}
                </p>
              </div>
            </div>
            <p class="mt-2 text-[11px] text-slate-600 font-700">
              {{ formatDate(e.created_at) }}
            </p>
          </div>
        </div>

        <!-- Оценки пассажиров -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          Оценки пассажиров
        </h2>
        <p v-if="!data.recent_ratings.length" class="mt-3 flex items-center gap-2 text-sm text-slate-500 font-700">
          <span class="i-mdi-star-outline text-5 text-slate-600" />
          Оценок пока нет.
        </p>
        <div v-else class="mt-3 space-y-2">
          <div
            v-for="(r, i) in data.recent_ratings"
            :key="i"
            class="rounded-2xl bg-white/5 px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <div
                class="h-9 w-9 flex shrink-0 items-center justify-center rounded-xl text-sm font-950"
                :class="r.score <= 3 ? 'bg-amber-500/12 text-amber-300' : 'bg-emerald-500/12 text-emerald-300'"
              >
                {{ r.score }}★
              </div>
              <p class="min-w-0 flex-1 text-sm text-slate-300">
                {{ r.comment || '—' }}
              </p>
              <p class="shrink-0 text-xs text-slate-500">
                {{ formatDate(r.created_at) }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>
