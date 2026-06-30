<script setup lang="ts">
import type { DriverOverview, DriverRatingEvent } from '~/types/driver-overview'
import { mediaUrl } from '~/api/client'
import { getDriverOverview } from '~/api/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const onboarding = useDriverOnboardingStore()

const data = ref<DriverOverview | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Личный кабинет',
  },
})

useHead({
  title: 'Личный кабинет | EdTaxi Driver',
})

onMounted(async () => {
  await Promise.all([
    load(),
    onboarding.loadVerification().catch(() => {}),
  ])
})

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

const fullName = computed(() => {
  const u = data.value?.user
  if (!u)
    return 'Водитель'
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (name)
    return name
  if (u.telegram_username)
    return `@${u.telegram_username}`
  return u.phone
})

const verificationOk = computed(() => {
  const v = onboarding.verification
  if (!v)
    return false
  const vehiclesOk = v.vehicles.length > 0 && v.vehicles.every(veh => veh.verification_status === 'approved')
  return v.face_verified && vehiclesOk && v.daily_check_valid
})

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
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
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(new Date(value))
}
</script>

<template>
  <main class="p h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+2rem)] text-white">
    <section class="mx-auto max-w-sm">
      <div v-if="isLoading" class="mt-10 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем кабинет...
      </div>

      <div v-else-if="errorMessage" class="mt-10 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300">
        {{ errorMessage }}
      </div>

      <template v-else-if="data">
        <!-- Профиль -->
        <header class="flex items-center gap-4">
          <div class="h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-main-500/16 text-main-200">
            <img v-if="data.driver.face_photo_url" :src="mediaUrl(data.driver.face_photo_url)" alt="" class="h-full w-full object-cover">
            <span v-else class="i-mdi-steering text-9" />
          </div>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-950">
              {{ fullName }}
            </h1>
            <p class="mt-0.5 truncate text-sm text-slate-400 font-700">
              {{ data.user.phone }}
            </p>
          </div>
        </header>

        <!-- Метрики -->
        <div class="grid grid-cols-3 mt-6 gap-3">
          <div class="rounded-3xl bg-white/5 p-4 text-center">
            <p class="text-2xl font-950" :class="data.driver.rating < 4.5 ? 'text-amber-300' : 'text-emerald-300'">
              {{ data.driver.rating.toFixed(2) }}
            </p>
            <p class="mt-1 text-xs text-slate-400 font-700">
              Рейтинг
            </p>
          </div>
          <div class="rounded-3xl bg-white/5 p-4 text-center">
            <p class="text-2xl font-950">
              {{ data.driver.total_trips }}
            </p>
            <p class="mt-1 text-xs text-slate-400 font-700">
              Поездок
            </p>
          </div>
          <div class="rounded-3xl bg-white/5 p-4 text-center">
            <p class="text-2xl font-950">
              {{ Math.round(data.driver.activity_percent) }}%
            </p>
            <p class="mt-1 text-xs text-slate-400 font-700">
              Активность
            </p>
          </div>
        </div>

        <!-- Верификация (перенесена сюда из меню) -->
        <RouterLink
          to="/menu/onboarding"
          class="mt-4 flex items-center gap-4 rounded-3xl px-4 py-4 text-white transition active:scale-[0.98]"
          :class="verificationOk ? 'bg-emerald-500/10' : 'bg-amber-500/10'"
        >
          <span
            class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
            :class="verificationOk ? 'bg-emerald-500/16 text-emerald-300' : 'bg-amber-500/16 text-amber-300'"
          >
            <span class="i-mdi-shield-check text-7" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">Верификация</span>
            <span class="mt-0.5 block truncate text-xs font-600" :class="verificationOk ? 'text-emerald-400/80' : 'text-amber-400/80'">
              {{ verificationOk ? 'Всё в порядке' : 'Требует внимания' }}
            </span>
          </span>
          <span class="i-mdi-chevron-right text-7 text-slate-500" />
        </RouterLink>

        <!-- Машины -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          Автомобили
        </h2>
        <p v-if="!data.vehicles.length" class="mt-2 text-sm text-slate-500">
          Машины не добавлены.
        </p>
        <div v-else class="mt-3 space-y-2">
          <div v-for="v in data.vehicles" :key="v.id" class="rounded-2xl bg-white/5 px-4 py-3">
            <p class="font-900">
              {{ v.make }} {{ v.model }} <span class="text-slate-500">· {{ v.year }}</span>
            </p>
            <p class="mt-0.5 text-sm text-slate-400">
              {{ v.plate_number }} · {{ v.color }} · {{ CATEGORY_LABELS[v.category] ?? v.category }}
            </p>
          </div>
        </div>

        <!-- История снижения рейтинга -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          История рейтинга
        </h2>
        <p v-if="!data.rating_events.length" class="mt-2 text-sm text-slate-500">
          Штрафов к рейтингу не было. Так держать!
        </p>
        <div v-else class="mt-3 space-y-2">
          <div v-for="e in data.rating_events" :key="e.id" class="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <span class="i-mdi-trending-down mt-0.5 shrink-0 text-5 text-red-300" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-900">
                {{ eventLabel(e) }} <span class="text-red-300">{{ e.delta.toFixed(2) }}</span>
              </p>
              <p v-if="e.reason" class="mt-0.5 text-xs text-slate-400">
                {{ e.reason }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-slate-500">
                {{ formatDate(e.created_at) }}
              </p>
              <p class="text-xs text-slate-300 font-800">
                → {{ e.rating_after.toFixed(2) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Последние оценки -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          Последние оценки
        </h2>
        <p v-if="!data.recent_ratings.length" class="mt-2 text-sm text-slate-500">
          Оценок пока нет.
        </p>
        <div v-else class="mt-3 space-y-2">
          <div v-for="(r, i) in data.recent_ratings" :key="i" class="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <span class="shrink-0 text-sm font-950" :class="r.score <= 3 ? 'text-amber-300' : 'text-emerald-300'">
              {{ r.score }}★
            </span>
            <p class="min-w-0 flex-1 text-sm text-slate-300">
              {{ r.comment || '—' }}
            </p>
            <p class="shrink-0 text-xs text-slate-500">
              {{ formatDate(r.created_at) }}
            </p>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>
