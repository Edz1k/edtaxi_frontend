<script setup lang="ts">
import type { DriverOverview } from '~/types/driver-overview'
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
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

const ratingIsGood = computed(() => (data.value?.driver.rating ?? 0) >= 4.5)

// r=27 → circumference ≈ 169.65
const ratingDash = computed(() => {
  const r = data.value?.driver.rating ?? 0
  const c = 2 * Math.PI * 27
  return `${(r / 5) * c} ${c}`
})

// r=16 → circumference ≈ 100.53
const activityDash = computed(() => {
  const a = data.value?.driver.activity_percent ?? 0
  const c = 2 * Math.PI * 16
  return `${(a / 100) * c} ${c}`
})

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(new Date(value))
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)]">
    <section class="mx-auto max-w-sm">
      <div v-if="isLoading" class="mt-10 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем кабинет...
      </div>

      <div v-else-if="errorMessage" class="mt-10 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300">
        {{ errorMessage }}
      </div>

      <template v-else-if="data">
        <!-- Карточка профиля -->
        <div class="overflow-hidden rounded-3xl bg-white/5">
          <!-- Аватар + имя -->
          <div class="flex items-center gap-4 px-5 pt-5">
            <div class="relative shrink-0">
              <AvatarRoot
                class="h-18 w-18 flex items-center justify-center overflow-hidden rounded-[20px] text-main-200"
                :class="ratingIsGood ? 'ring-2 ring-emerald-400/40 bg-emerald-500/10' : 'ring-2 ring-amber-400/30 bg-amber-500/10'"
              >
                <AvatarImage
                  :src="mediaUrl(data.driver.face_photo_url ?? '')"
                  alt=""
                  class="h-full w-full object-cover"
                />
                <AvatarFallback class="flex h-full w-full items-center justify-center">
                  <span class="i-mdi-steering text-10" />
                </AvatarFallback>
              </AvatarRoot>
              <span
                class="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-secondary-900"
                :class="data.driver.is_online ? 'bg-emerald-400' : 'bg-slate-600'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h1 class="truncate text-xl font-950">
                {{ fullName }}
              </h1>
              <p class="mt-0.5 truncate text-sm text-slate-500 font-600">
                {{ data.user.phone }}
              </p>
              <span
                class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-800"
                :class="data.driver.is_online ? 'bg-emerald-500/16 text-emerald-300' : 'bg-white/8 text-slate-400'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="data.driver.is_online ? 'bg-emerald-400' : 'bg-slate-500'" />
                {{ data.driver.is_online ? 'На линии' : 'Не в сети' }}
              </span>
            </div>
          </div>

          <!-- Разделитель -->
          <div class="mx-5 mt-5 h-px bg-white/8" />

          <!-- Блок рейтинга -->
          <div class="flex items-center gap-4 px-5 pt-5 pb-2">
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-900 uppercase tracking-wider text-slate-500">
                Рейтинг водителя
              </p>
              <div class="mt-1 flex items-baseline gap-1.5">
                <span
                  class="text-5xl font-950 leading-none"
                  :class="ratingIsGood ? 'text-emerald-300' : 'text-amber-300'"
                >{{ data.driver.rating.toFixed(2) }}</span>
                <span class="text-sm text-slate-500 font-700">/ 5.00</span>
              </div>
              <div class="mt-2 flex gap-0.5">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-lg leading-none"
                  :class="i <= Math.round(data.driver.rating)
                    ? (ratingIsGood ? 'text-emerald-400' : 'text-amber-400')
                    : 'text-white/12'"
                >★</span>
              </div>
            </div>
            <!-- SVG-кольцо рейтинга -->
            <div class="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 64 64" class="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="5" class="text-white/8" />
                <circle
                  cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="5"
                  :stroke-dasharray="ratingDash"
                  :class="ratingIsGood ? 'text-emerald-400' : 'text-amber-400'"
                  stroke-linecap="round"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[10px] font-900 text-slate-400">
                  {{ Math.round((data.driver.rating / 5) * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Прогресс-бар рейтинга -->
          <div class="mx-5 mb-5 mt-3 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              class="h-full rounded-full transition-all duration-700"
              :class="ratingIsGood ? 'bg-emerald-400' : 'bg-amber-400'"
              :style="`width: ${(data.driver.rating / 5) * 100}%`"
            />
          </div>
        </div>

        <!-- Статистика -->
        <div class="mt-3 grid grid-cols-2 gap-3">
          <!-- Поездки -->
          <div class="rounded-2xl bg-white/5 px-3 py-4">
            <span class="i-mdi-steering text-6 text-main-300" />
            <p class="mt-2 text-2xl font-950 leading-none">
              {{ data.driver.total_trips }}
            </p>
            <p class="mt-1 text-[11px] text-slate-500 font-700">
              Поездок
            </p>
          </div>

          <!-- Отмены сегодня -->
          <div
            class="rounded-2xl px-3 py-4 transition"
            :class="data.driver.cancel_count_today > 0 ? 'bg-red-500/10' : 'bg-white/5'"
          >
            <span
              class="text-6"
              :class="data.driver.cancel_count_today > 0 ? 'i-mdi-close-circle text-red-400' : 'i-mdi-close-circle-outline text-slate-500'"
            />
            <p
              class="mt-2 text-2xl font-950 leading-none"
              :class="data.driver.cancel_count_today > 0 ? 'text-red-300' : ''"
            >
              {{ data.driver.cancel_count_today }}
            </p>
            <p
              class="mt-1 text-[11px] font-700"
              :class="data.driver.cancel_count_today > 0 ? 'text-red-400/70' : 'text-slate-500'"
            >
              Отмен сег.
            </p>
          </div>
        </div>

        <!-- Блокировка -->
        <div v-if="data.driver.blocked_until" class="mt-3 flex items-center gap-3 rounded-2xl bg-red-500/10 px-4 py-3">
          <span class="i-mdi-lock shrink-0 text-5 text-red-400" />
          <div>
            <p class="text-sm font-900 text-red-300">
              Аккаунт заблокирован
            </p>
            <p class="mt-0.5 text-xs text-red-400/70">
              до {{ formatDate(data.driver.blocked_until) }}
            </p>
          </div>
        </div>

        <!-- Верификация -->
        <RouterLink
          to="/menu/profile/onboarding"
          class="mt-3 flex items-center gap-4 rounded-3xl px-4 py-4 text-white transition active:scale-[0.98]"
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

        <!-- Переход в историю рейтинга -->
        <RouterLink
          to="/menu/profile/rating-history"
          class="mt-3 flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 text-white transition active:scale-[0.98]"
        >
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-300">
            <span class="i-mdi-chart-timeline-variant text-7" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">История рейтинга</span>
            <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
              {{ data.rating_events.length > 0 ? `${data.rating_events.length} штрафных событий` : 'Штрафов не было' }}
              · {{ data.recent_ratings.length > 0 ? `${data.recent_ratings.length} оценок` : 'Оценок нет' }}
            </span>
          </span>
          <span class="i-mdi-chevron-right text-7 text-slate-500" />
        </RouterLink>
      </template>
    </section>
  </main>
</template>
