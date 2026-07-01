<script setup lang="ts">
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const driver = useDriverOnboardingStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu/profile',
    screenSubtitle: 'Назад в профиль',
    screenTitle: 'Верификация',
  },
})

useHead({
  title: 'Верификация | EdTaxi Driver',
})

onMounted(async () => {
  await driver.loadVerification().catch(() => {})
})

type ItemStatus = 'ok' | 'pending' | 'rejected' | 'missing'

interface OnboardingItem {
  label: string
  description: string
  icon: string
  to: string
  status: ItemStatus
}

const faceStatus = computed<ItemStatus>(() => {
  const v = driver.verification
  if (!v)
    return 'missing'
  if (v.face_status === 'approved')
    return 'ok'
  if (v.face_status === 'pending')
    return 'pending'
  if (v.face_status === 'rejected')
    return 'rejected'
  return 'missing'
})

const vehicleStatus = computed<ItemStatus>(() => {
  if (!driver.verification)
    return 'missing'
  const veh = driver.verification.vehicles
  if (!veh.length)
    return 'missing'
  if (veh.some(v => v.verification_status === 'rejected'))
    return 'rejected'
  if (veh.every(v => v.verification_status === 'approved'))
    return 'ok'
  return 'pending'
})

const dailyStatus = computed<ItemStatus>(() => {
  if (!driver.verification)
    return 'missing'
  return driver.verification.daily_check_valid ? 'ok' : 'missing'
})

const items = computed<OnboardingItem[]>(() => [
  {
    label: 'Фото лица',
    description: statusDescription(faceStatus.value, 'Загрузите селфи для идентификации'),
    icon: 'i-mdi-face-recognition',
    to: '/menu/profile/onboarding/face-photo',
    status: faceStatus.value,
  },
  {
    label: 'Документы машины',
    description: statusDescription(vehicleStatus.value, 'Фото авто и техпаспорт'),
    icon: 'i-mdi-car-key',
    to: '/menu/profile/onboarding/vehicle-docs',
    status: vehicleStatus.value,
  },
  {
    label: 'Ежедневная проверка',
    description: statusDescription(dailyStatus.value, 'Ежедневное селфи перед выходом'),
    icon: 'i-mdi-calendar-check',
    to: '/menu/profile/onboarding/daily-check',
    status: dailyStatus.value,
  },
])

function statusDescription(status: ItemStatus, fallback: string) {
  if (status === 'ok')
    return 'Готово'
  if (status === 'pending')
    return 'На проверке'
  if (status === 'rejected')
    return 'Отклонено — загрузите заново'
  return fallback
}

function statusIcon(status: ItemStatus) {
  if (status === 'ok')
    return 'i-mdi-check-circle'
  if (status === 'pending')
    return 'i-mdi-clock-outline'
  if (status === 'rejected')
    return 'i-mdi-close-circle'
  return 'i-mdi-chevron-right'
}

function statusColor(status: ItemStatus) {
  if (status === 'ok')
    return 'text-emerald-400'
  if (status === 'pending')
    return 'text-amber-400'
  if (status === 'rejected')
    return 'text-red-400'
  return 'text-slate-500'
}

function itemBg(status: ItemStatus) {
  if (status === 'ok')
    return 'bg-emerald-500/10'
  if (status === 'rejected')
    return 'bg-red-500/10'
  return 'bg-white/5'
}

function iconBg(status: ItemStatus) {
  if (status === 'ok')
    return 'bg-emerald-500/16 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/16 text-red-300'
  if (status === 'pending')
    return 'bg-amber-500/16 text-amber-300'
  return 'bg-white/8 text-main-200'
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)]">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Верификация
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Заполните все пункты, чтобы выйти на линию.
        </p>
      </header>

      <div v-if="driver.isLoadingVerification" class="mt-8 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем статус...
      </div>

      <nav v-else class="mt-8 space-y-3">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-4 rounded-3xl px-4 py-4 text-white transition active:scale-[0.98]"
          :class="itemBg(item.status)"
        >
          <span
            class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
            :class="iconBg(item.status)"
          >
            <span :class="item.icon" class="text-7" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">
              {{ item.label }}
            </span>
            <span class="mt-0.5 block truncate text-xs font-600" :class="statusColor(item.status)">
              {{ item.description }}
            </span>
          </span>

          <span class="text-7" :class="[statusIcon(item.status), statusColor(item.status)]" />
        </RouterLink>
      </nav>
    </section>
  </main>
</template>
