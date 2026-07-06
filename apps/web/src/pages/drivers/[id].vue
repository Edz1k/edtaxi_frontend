<script setup lang="ts">
import type { DriverOverview, DriverRatingEvent } from '~/types/driver-overview'
import { useRoute as useVueRoute } from 'vue-router'
import { mediaUrl } from '~/api/client'
import { getDriverOverview } from '~/api/driver'
import { reviewVehicle } from '~/api/verification'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { formatDate } from '~/utils/format'

const route = useVueRoute()
const userId = computed(() => (route.params as Record<string, string>).id)

const data = ref<DriverOverview | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Кабинет водителя | EdTaxi',
})

onMounted(load)

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    data.value = await getDriverOverview(userId.value)
  }
  catch {
    errorMessage.value = 'Не удалось загрузить данные водителя.'
  }
  finally {
    isLoading.value = false
  }
}

const fullName = computed(() => {
  const u = data.value?.user
  if (!u)
    return ''
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (name)
    return name
  if (u.telegram_username)
    return `@${u.telegram_username}`
  return u.phone
})

const CATEGORY_LABELS: Record<string, string> = {
  moto: 'Мото',
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}

const VERIFICATION_LABELS: Record<string, string> = {
  approved: 'Подтверждена',
  pending: 'На проверке',
  rejected: 'Отклонена',
}

const RATING_EVENT_LABELS: Record<string, string> = {
  complaint_confirmed: 'Подтверждённая жалоба',
  cancel_after_accept: 'Отмена после принятия',
  driver_no_show: 'Неявка к пассажиру',
}

function verificationClass(status: string) {
  if (status === 'approved')
    return 'bg-emerald-500/12 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/12 text-red-300'
  return 'bg-amber-500/12 text-amber-300'
}

function eventLabel(e: DriverRatingEvent) {
  return RATING_EVENT_LABELS[e.type] ?? e.type
}

// Одобрение/отклонение машины прямо из кабинета — поддержке не нужно идти на
// отдельную страницу верификаций, чтобы подтвердить заявку.
const isReviewing = ref(false)
async function decideVehicle(vehicleId: string, approve: boolean) {
  if (isReviewing.value)
    return
  isReviewing.value = true
  try {
    await reviewVehicle(vehicleId, approve)
    await load()
  }
  catch {
    errorMessage.value = 'Не удалось сохранить решение по машине.'
  }
  finally {
    isReviewing.value = false
  }
}

const isBlocked = computed(() => {
  const until = data.value?.driver.blocked_until
  return Boolean(until) && new Date(until as string) > new Date()
})
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    :title="fullName || 'Кабинет водителя'"
    eyebrow="Водитель"
  >
    <div v-if="isLoading" class="mt-6 text-sm text-white/55">
      Загружаем данные водителя...
    </div>

    <div v-else-if="errorMessage" class="mt-6 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300">
      {{ errorMessage }}
    </div>

    <div v-else-if="data" class="mt-5 space-y-5">
      <!-- Профиль + статус -->
      <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cyan-500/15">
              <img v-if="data.driver.face_photo_url" :src="mediaUrl(data.driver.face_photo_url)" alt="" class="h-full w-full object-cover">
              <span v-else class="i-mdi-steering text-8 text-cyan-300" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-lg font-950">
                {{ fullName }}
              </p>
              <p class="truncate text-sm text-white/55">
                {{ data.user.phone }}
              </p>
              <p v-if="data.user.telegram_username" class="truncate text-xs text-cyan-200/70">
                @{{ data.user.telegram_username }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <span class="rounded-full px-3 py-1 text-xs font-900" :class="data.driver.is_online ? 'bg-emerald-500/12 text-emerald-300' : 'bg-white/8 text-white/45'">
              {{ data.driver.is_online ? 'На линии' : 'Не на линии' }}
            </span>
            <!-- С каким парком работает водитель (+ комиссия парка) -->
            <span v-if="data.driver.park_name" class="inline-flex items-center gap-1 rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200 font-900">
              <span class="i-mdi-office-building-marker text-3.5" />
              {{ data.driver.park_is_platform ? 'Гараж платформы' : data.driver.park_name }}
              <span v-if="data.driver.park_commission_rate != null" class="text-cyan-200/70">
                · {{ (data.driver.park_commission_rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) }}%
              </span>
            </span>
            <span v-else-if="!data.driver.park_id" class="rounded-full bg-amber-300/10 px-3 py-1 text-xs text-amber-200 font-900">
              Без таксопарка
            </span>
            <span v-if="isBlocked" class="rounded-full bg-red-500/12 px-3 py-1 text-xs text-red-300 font-900">
              Заблокирован до {{ formatDate(data.driver.blocked_until as string) }}
            </span>
            <span v-if="data.user.is_blocked" class="rounded-full bg-red-500/12 px-3 py-1 text-xs text-red-300 font-900">
              Аккаунт заблокирован
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              Рейтинг
            </p>
            <p class="mt-1 text-2xl font-950" :class="data.driver.rating < 4.5 ? 'text-amber-300' : 'text-emerald-300'">
              {{ data.driver.rating.toFixed(2) }}
            </p>
          </div>
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              Поездок
            </p>
            <p class="mt-1 text-2xl font-950">
              {{ data.driver.total_trips }}
            </p>
          </div>
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              Активность
            </p>
            <p class="mt-1 text-2xl font-950">
              {{ Math.round(data.driver.activity_percent) }}%
            </p>
          </div>
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              Отмен сегодня
            </p>
            <p class="mt-1 text-2xl font-950" :class="data.driver.cancel_count_today > 0 ? 'text-amber-300' : ''">
              {{ data.driver.cancel_count_today }}
            </p>
          </div>
        </div>
      </div>

      <!-- Машины -->
      <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-lg font-950">
          Автомобили
        </h2>
        <p v-if="!data.vehicles.length" class="mt-3 text-sm text-white/50">
          Машины не добавлены.
        </p>
        <div v-else class="grid mt-4 gap-3 md:grid-cols-2">
          <div v-for="v in data.vehicles" :key="v.id" class="border border-white/8 rounded-2xl bg-white/5 p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-900">
                  {{ v.make }} {{ v.model }}
                  <span class="text-white/50">· {{ v.year }}</span>
                </p>
                <p class="mt-0.5 text-sm text-white/55">
                  {{ v.plate_number }} · {{ v.color }} · {{ CATEGORY_LABELS[v.category] ?? v.category }}
                </p>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-900" :class="verificationClass(v.verification_status)">
                {{ VERIFICATION_LABELS[v.verification_status] ?? v.verification_status }}
              </span>
            </div>

            <div v-if="v.verification_status === 'pending'" class="mt-3 flex gap-2">
              <button
                :disabled="isReviewing"
                class="h-9 flex-1 rounded-xl bg-emerald-400 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
                type="button"
                @click="decideVehicle(v.id, true)"
              >
                Одобрить
              </button>
              <button
                :disabled="isReviewing"
                class="h-9 flex-1 rounded-xl bg-red-500/15 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
                type="button"
                @click="decideVehicle(v.id, false)"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- История снижения рейтинга -->
      <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-lg font-950">
          История рейтинга
        </h2>
        <p v-if="!data.rating_events.length" class="mt-3 text-sm text-white/50">
          Штрафов к рейтингу не было.
        </p>
        <div v-else class="mt-4 space-y-2">
          <div v-for="e in data.rating_events" :key="e.id" class="flex items-start gap-3 border border-white/8 rounded-2xl bg-white/5 px-4 py-3">
            <span class="i-mdi-trending-down mt-0.5 shrink-0 text-5 text-red-300" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-900">
                {{ eventLabel(e) }}
                <span class="text-red-300">{{ e.delta.toFixed(2) }}</span>
              </p>
              <p v-if="e.reason" class="mt-0.5 text-xs text-white/55">
                {{ e.reason }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-white/40">
                {{ formatDate(e.created_at) }}
              </p>
              <p class="text-xs text-white/55 font-800">
                → {{ e.rating_after.toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Последние оценки -->
      <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-lg font-950">
          Последние оценки
        </h2>
        <p v-if="!data.recent_ratings.length" class="mt-3 text-sm text-white/50">
          Оценок пока нет.
        </p>
        <div v-else class="mt-4 space-y-2">
          <div v-for="(r, i) in data.recent_ratings" :key="i" class="flex items-start gap-3 border border-white/8 rounded-2xl bg-white/5 px-4 py-3">
            <span class="shrink-0 text-sm font-950" :class="r.score <= 3 ? 'text-amber-300' : 'text-emerald-300'">
              {{ r.score }}★
            </span>
            <p class="min-w-0 flex-1 text-sm text-white/65">
              {{ r.comment || '—' }}
            </p>
            <p class="shrink-0 text-xs text-white/40">
              {{ formatDate(r.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
