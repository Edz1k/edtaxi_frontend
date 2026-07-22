<script setup lang="ts">
import type { UserStatsResponse } from '~/api/users'
import { readSavedAccounts } from '@edtaxi/shared/composables/auth/saved-accounts'
import { getUserStats } from '~/api/users'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'
import { usePassengerStore } from '~/stores/passenger'

const router = useRouter()
const auth = useAuthStore()
const passenger = usePassengerStore()

// «Кабинет» намеренно не дублируем пунктом меню — в профиль ведёт тап по имени
// в шапке выше.
const menuItems = [
  { label: 'Акции и бонусы', description: 'Все акции и реферальная программа', icon: 'i-mdi-gift-outline', to: '/bonus' },
  { label: 'Избранные адреса', description: 'Сохранённые места', icon: 'i-mdi-heart-outline', to: '/menu/places' },
  { label: 'История', description: 'Поездки и оценки', icon: 'i-mdi-clock-outline', to: '/menu/history' },
  { label: 'Безопасность', description: 'Вызов 112 и отправка маршрута', icon: 'i-mdi-shield-check-outline', to: '/menu/safety' },
  { label: 'Предложить улучшение', description: 'Идея по развитию сервиса', icon: 'i-mdi-lightbulb-outline', to: '/menu/feedback' },
  { label: 'Поддержка', description: 'Помощь и обращения', icon: 'i-mdi-headset', to: '/menu/support' },
  { label: 'Настройки', description: 'Профиль и приложение', icon: 'i-mdi-cog-outline', to: '/menu/settings' },
  { label: 'О приложении', description: 'Тарифы и о сервисе Telegram Taxi', icon: 'i-mdi-information-outline', to: '/menu/about' },
]

// Статистик-бар «Нас уже N, вы — №K»: пока не загрузился (или упал) — не рисуем.
const userStats = ref<null | UserStatsResponse>(null)

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

useHead({
  title: 'Меню | Telegram Taxi',
})

async function logout() {
  await auth.logout()
  // После явного выхода — страница выбора аккаунтов (если уже входили раньше),
  // откуда можно вернуться в свой аккаунт или войти в другой по номеру.
  await router.replace(readSavedAccounts(SAVED_ACCOUNTS_KEY).length ? '/login/accounts' : '/login')
}

onMounted(async () => {
  getUserStats()
    .then((stats) => {
      userStats.value = stats
    })
    .catch(() => {})
  await passenger.loadProfile().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x tg-menu-home-safe h-full overflow-y-auto bg-secondary-900 text-white">
    <section class="mx-auto max-w-sm">
      <RouterLink
        class="flex items-center gap-4 rounded-3xl transition active:scale-[0.98]"
        to="/menu/profile"
      >
        <Avatar
          :name="passenger.displayName"
          :src="passenger.profile?.avatar_url || ''"
        />

        <div class="min-w-0 flex-1">
          <p class="text-xs text-main-300 font-900 uppercase">
            Пассажир
          </p>
          <h1 class="mt-1 truncate text-3xl font-950">
            {{ passenger.displayName }}
          </h1>
          <p class="mt-1 truncate text-sm text-slate-400 font-700">
            {{ passenger.profile?.phone || 'Профиль загружается' }}
          </p>
        </div>

        <span class="i-mdi-chevron-right shrink-0 text-7 text-slate-500" />
      </RouterLink>

      <!-- Статистик-бар: рост платформы и номер пользователя -->
      <div
        v-if="userStats"
        class="relative mt-6 overflow-hidden border border-main-500/25 rounded-3xl from-main-500/18 via-white/4 to-transparent bg-gradient-to-br px-4 py-4"
      >
        <span class="i-mdi-account-group pointer-events-none absolute text-24 text-main-300/12 -right-3 -top-4" aria-hidden="true" />
        <p class="text-sm font-950">
          Нас уже {{ userStats.total_users.toLocaleString('ru-RU') }}!
        </p>
        <p class="mt-1 text-xs text-slate-300 font-700 leading-5">
          Вы — пользователь №{{ userStats.user_number.toLocaleString('ru-RU') }} сервиса Telegram Taxi. Спасибо, что с нами 🚕
        </p>
      </div>

      <nav class="mt-8 space-y-3">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 text-white transition active:scale-[0.98]"
        >
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
            <span :class="item.icon" class="text-7" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">
              {{ item.label }}
            </span>
            <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
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
