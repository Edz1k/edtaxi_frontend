<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const router = useRouter()
const auth = useAuthStore()
const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()

const driverMeta = computed(() => {
  if (driver.profile)
    return `Рейтинг ${driver.profile.rating.toFixed(1)} · ${driver.profile.total_trips} поездок`

  return driver.isOnline ? 'На линии' : 'Офлайн'
})

const verificationOk = computed(() => {
  const v = onboarding.verification
  if (!v)
    return false
  const vehiclesOk = v.vehicles.length > 0 && v.vehicles.every(veh => veh.verification_status === 'approved')
  return v.face_verified && vehiclesOk && v.daily_check_valid
})

const menuItems = computed(() => [
  { label: 'Автомобиль', description: 'Данные машины и тариф', icon: 'i-mdi-car-info', to: '/menu/vehicle', badge: false },
  { label: 'Таксопарк', description: 'Принять приглашение', icon: 'i-mdi-office-building-marker', to: '/menu/park-invite', badge: false },
  { label: 'Поддержка', description: 'Помощь и обращения', icon: 'i-mdi-headset', to: '/menu/support', badge: false },
  { label: 'Верификация', description: verificationOk.value ? 'Всё в порядке' : 'Требует внимания', icon: 'i-mdi-shield-check', to: '/menu/onboarding', badge: !verificationOk.value },
])

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Меню водителя | EdTaxi',
})

async function logout() {
  await auth.logout()
  await router.replace('/login')
}

onMounted(async () => {
  await driver.ensureProfile().catch(() => {})
  await onboarding.loadVerification().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+7.25rem)] pt-[calc(var(--app-safe-area-top)+1.35rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header class="flex items-center gap-4">
        <div class="h-16 w-16 flex shrink-0 items-center justify-center rounded-3xl bg-main-500/16 text-main-200">
          <span class="i-mdi-steering text-9" />
        </div>

        <div class="min-w-0">
          <p class="text-xs text-main-300 font-900 uppercase">
            Водитель
          </p>
          <h1 class="mt-1 truncate text-3xl font-950">
            Кабинет
          </h1>
          <p class="mt-1 truncate text-sm text-slate-400 font-700">
            {{ driverMeta }}
          </p>
        </div>
      </header>

      <nav class="mt-8 space-y-3">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 text-white transition active:scale-[0.98]"
        >
          <span
            class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl text-main-200"
            :class="item.badge ? 'bg-amber-500/18' : 'bg-white/8'"
          >
            <span :class="item.icon" class="text-7" :style="item.badge ? 'color: rgb(251 191 36)' : ''" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 text-lg font-900">
              {{ item.label }}
              <span v-if="item.badge" class="i-mdi-alert-circle text-5 text-amber-400" />
            </span>
            <span class="mt-0.5 block truncate text-xs font-600" :class="item.badge ? 'text-amber-400/70' : 'text-slate-400'">
              {{ item.description }}
            </span>
          </span>

          <span class="i-mdi-chevron-right text-7 text-slate-500" />
        </RouterLink>
      </nav>

      <button
        :disabled="auth.isLoading"
        class="mt-8 h-14 w-full flex items-center justify-center rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="logout"
      >
        <span class="i-mdi-logout mr-2 text-5" />
        {{ auth.isLoading ? 'Выходим...' : 'Выйти' }}
      </button>
    </section>
  </main>
</template>
