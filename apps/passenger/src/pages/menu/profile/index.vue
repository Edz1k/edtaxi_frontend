<script setup lang="ts">
import type { PassengerOverview } from '@edtaxi/shared/types/passenger'
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
import { mediaUrl } from '~/api/client'
import { getPassengerOverview, uploadPassengerAvatar } from '~/api/passenger'
import { useToast } from '~/composables/useToast'
import { usePassengerStore } from '~/stores/passenger'

const data = ref<PassengerOverview | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

// Смена аватарки: тап по аватару открывает выбор файла, после загрузки
// профиль обновляется и в кабинете, и в шапке меню (passenger store).
const toast = useToast()
const passenger = usePassengerStore()
const avatarInput = ref<HTMLInputElement | null>(null)
const isUploadingAvatar = ref(false)

function pickAvatar() {
  if (!isUploadingAvatar.value)
    avatarInput.value?.click()
}

async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // повторный выбор того же файла тоже должен сработать
  if (!file)
    return

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    toast.warning('Не тот формат', 'Аватарка — это JPEG или PNG.')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.warning('Слишком большой файл', 'Максимум 5 МБ.')
    return
  }

  isUploadingAvatar.value = true
  try {
    const profile = await uploadPassengerAvatar(file)
    if (data.value)
      data.value = { ...data.value, user: { ...data.value.user, avatar_url: profile.avatar_url } }
    passenger.loadProfile().catch(() => {})
    toast.success('Готово', 'Аватарка обновлена.')
  }
  catch {
    toast.error('Не получилось', 'Не удалось загрузить аватарку. Попробуйте ещё раз.')
  }
  finally {
    isUploadingAvatar.value = false
  }
}

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Личный кабинет',
  },
})

useHead({
  title: 'Личный кабинет | EdTaxi',
})

onMounted(async () => {
  await load()
})

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    data.value = await getPassengerOverview()
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
    return 'Пассажир'
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (name)
    return name
  if (u.telegram_username)
    return `@${u.telegram_username}`
  return u.phone
})

// Рейтинг пассажира считается хорошим от 4.5 — тот же порог, что у водителя.
const rating = computed(() => data.value?.user.passenger_rating ?? 0)
const ratingIsGood = computed(() => rating.value >= 4.5)

// r=27 → длина окружности ≈ 169.65; закрашиваем долю (rating / 5).
const ratingDash = computed(() => {
  const c = 2 * Math.PI * 27
  return `${(rating.value / 5) * c} ${c}`
})

const memberSince = computed(() => {
  const iso = data.value?.user.created_at
  if (!iso)
    return ''
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(iso))
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
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
          <!-- Аватар + имя (тап по аватару — сменить фото) -->
          <div class="flex items-center gap-4 px-5 pt-5">
            <button
              aria-label="Сменить аватарку"
              class="relative shrink-0 transition active:scale-[0.96]"
              type="button"
              @click="pickAvatar"
            >
              <AvatarRoot
                class="h-18 w-18 flex items-center justify-center overflow-hidden rounded-[20px] text-main-200"
                :class="ratingIsGood ? 'ring-2 ring-emerald-400/40 bg-emerald-500/10' : 'ring-2 ring-amber-400/30 bg-amber-500/10'"
              >
                <AvatarImage
                  :src="mediaUrl(data.user.avatar_url ?? '')"
                  alt=""
                  class="h-full w-full object-cover"
                />
                <AvatarFallback class="h-full w-full flex items-center justify-center">
                  <span class="i-mdi-account text-10" />
                </AvatarFallback>
              </AvatarRoot>
              <span
                class="absolute h-7 w-7 flex items-center justify-center border-2 border-secondary-900 rounded-full bg-main-500 text-white -bottom-1.5 -right-1.5"
                aria-hidden="true"
              >
                <span :class="isUploadingAvatar ? 'i-mdi-loading animate-spin' : 'i-mdi-camera'" class="text-3.5" />
              </span>
            </button>
            <input
              ref="avatarInput"
              accept="image/jpeg,image/png"
              class="hidden"
              type="file"
              @change="onAvatarSelected"
            >
            <div class="min-w-0 flex-1">
              <h1 class="truncate text-xl font-950">
                {{ fullName }}
              </h1>
              <p class="mt-0.5 truncate text-sm text-slate-500 font-600">
                {{ data.user.phone }}
              </p>
              <span
                v-if="memberSince"
                class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-slate-400 font-800"
              >
                <span class="i-mdi-calendar-heart text-3.5" />
                С нами с {{ memberSince }}
              </span>
            </div>
          </div>

          <!-- Разделитель -->
          <div class="mx-5 mt-5 h-px bg-white/8" />

          <!-- Блок рейтинга -->
          <div class="flex items-center gap-4 px-5 pb-2 pt-5">
            <div class="min-w-0 flex-1">
              <p class="text-[10px] text-slate-500 font-900 tracking-wider uppercase">
                Рейтинг пассажира
              </p>
              <div class="mt-1 flex items-baseline gap-1.5">
                <span
                  class="text-5xl font-950 leading-none"
                  :class="ratingIsGood ? 'text-emerald-300' : 'text-amber-300'"
                >{{ rating.toFixed(2) }}</span>
                <span class="text-sm text-slate-500 font-700">/ 5.00</span>
              </div>
              <div class="mt-2 flex gap-0.5">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-lg leading-none"
                  :class="i <= Math.round(rating)
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
                <span class="text-[10px] text-slate-400 font-900">
                  {{ Math.round((rating / 5) * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Прогресс-бар рейтинга -->
          <div class="mx-5 mb-5 mt-3 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              class="h-full rounded-full transition-all duration-700"
              :class="ratingIsGood ? 'bg-emerald-400' : 'bg-amber-400'"
              :style="`width: ${(rating / 5) * 100}%`"
            />
          </div>
        </div>

        <!-- Статистика -->
        <div class="grid grid-cols-2 mt-3 gap-3">
          <!-- Поездки -->
          <div class="rounded-2xl bg-white/5 px-3 py-4">
            <span class="i-mdi-map-marker-path text-6 text-main-300" />
            <p class="mt-2 text-2xl font-950 leading-none">
              {{ data.stats.total_trips }}
            </p>
            <p class="mt-1 text-[11px] text-slate-500 font-700">
              Поездок
            </p>
          </div>

          <!-- С нами с -->
          <div class="rounded-2xl bg-white/5 px-3 py-4">
            <span class="i-mdi-calendar-heart text-6 text-main-300" />
            <p class="mt-2 truncate text-lg font-950 leading-none">
              {{ memberSince || '—' }}
            </p>
            <p class="mt-1 text-[11px] text-slate-500 font-700">
              С нами с
            </p>
          </div>
        </div>

        <!-- Последние оценки -->
        <h2 class="mt-8 text-sm text-main-300 font-900 uppercase">
          Оценки водителей
        </h2>
        <p v-if="!data.recent_ratings.length" class="mt-2 text-sm text-slate-500">
          Оценок пока нет. Они появятся здесь после поездок.
        </p>
        <div v-else class="mt-3 space-y-2">
          <div
            v-for="(item, index) in data.recent_ratings"
            :key="index"
            class="rounded-2xl bg-white/5 px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex gap-0.5">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-sm leading-none"
                  :class="i <= item.score ? 'text-amber-400' : 'text-white/12'"
                >★</span>
              </div>
              <span class="shrink-0 text-xs text-slate-500 font-600">
                {{ formatDate(item.created_at) }}
              </span>
            </div>
            <p v-if="item.comment" class="mt-2 text-sm text-slate-300 leading-5">
              {{ item.comment }}
            </p>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>
