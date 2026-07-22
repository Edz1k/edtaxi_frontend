<script setup lang="ts">
import type { UserStatsResponse } from '~/api/users'
import { readSavedAccounts } from '@edtaxi/shared/composables/auth/saved-accounts'
import { getUserStats } from '~/api/users'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'
import { usePassengerStore } from '~/stores/passenger'

const router = useRouter()
const auth = useAuthStore()
const passenger = usePassengerStore()
const { t, locale } = useI18n()

// «Кабинет» намеренно не дублируем пунктом меню — в профиль ведёт тап по имени
// в шапке выше.
const MENU_ITEMS = [
  { key: 'bonus', icon: 'i-mdi-gift-outline', to: '/bonus' },
  { key: 'history', icon: 'i-mdi-clock-outline', to: '/menu/history' },
  { key: 'places', icon: 'i-mdi-heart-outline', to: '/menu/places' },
  { key: 'safety', icon: 'i-mdi-shield-check-outline', to: '/menu/safety' },
  { key: 'support', icon: 'i-mdi-headset', to: '/menu/support' },
  { key: 'feedback', icon: 'i-mdi-lightbulb-outline', to: '/menu/feedback' },
  { key: 'settings', icon: 'i-mdi-cog-outline', to: '/menu/settings' },
  { key: 'about', icon: 'i-mdi-information-outline', to: '/menu/about' },
] as const
const menuItems = computed(() => MENU_ITEMS.map(item => ({
  ...item,
  description: t(`menu.items.${item.key}Desc`),
  label: t(`menu.items.${item.key}`),
})))

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
  title: () => `${t('nav.menu')} | Telegram Taxi`,
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
  <main class="tg-safe-x tg-menu-home-safe h-full overflow-y-auto app-screen text-white">
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
          <p class="text-xs app-accent font-900 uppercase">
            {{ t('nav.passenger') }}
          </p>
          <h1 class="mt-1 truncate text-3xl font-950">
            {{ passenger.displayName }}
          </h1>
          <p class="mt-1 truncate text-sm app-muted font-700">
            {{ passenger.profile?.phone || t('menu.profileLoading') }}
          </p>
        </div>

        <span class="i-mdi-chevron-right shrink-0 text-7 app-faint" />
      </RouterLink>

      <!-- Статистик-бар: рост платформы и номер пользователя -->
      <div
        v-if="userStats"
        class="relative mt-6 overflow-hidden border border-main-500/25 rounded-3xl from-main-500/18 via-white/4 to-transparent bg-gradient-to-br px-4 py-4"
      >
        <span class="app-accent/12 i-mdi-account-group pointer-events-none absolute text-24 -right-3 -top-4" aria-hidden="true" />
        <p class="text-sm font-950">
          {{ t('menu.statsTitle', { n: userStats.total_users.toLocaleString(locale) }) }}
        </p>
        <p class="mt-1 text-xs text-slate-300 font-700 leading-5 light:text-slate-600">
          {{ t('menu.statsText', { n: userStats.user_number.toLocaleString(locale) }) }}
        </p>
      </div>

      <nav class="mt-8 space-y-3">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-4 rounded-3xl app-card px-4 py-4 text-white transition active:scale-[0.98]"
        >
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
            <span :class="item.icon" class="text-7" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">
              {{ item.label }}
            </span>
            <span class="mt-0.5 block truncate text-xs app-muted font-600">
              {{ item.description }}
            </span>
          </span>

          <span class="i-mdi-chevron-right text-7 app-faint" />
        </RouterLink>
      </nav>

      <button
        :disabled="auth.isLoading"
        class="mt-8 h-14 w-full flex items-center justify-center rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="logout"
      >
        <span class="i-mdi-logout mr-2 text-5" />
        {{ auth.isLoading ? t('menu.loggingOut') : t('menu.logout') }}
      </button>
    </section>
  </main>
</template>
