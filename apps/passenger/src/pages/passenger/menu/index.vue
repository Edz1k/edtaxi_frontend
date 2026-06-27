<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { usePassengerStore } from '~/stores/passenger'

const router = useRouter()
const auth = useAuthStore()
const passenger = usePassengerStore()

const menuItems = [
  { label: 'История', description: 'Поездки и оценки', icon: 'i-mdi-clock-outline', to: '/passenger/menu/history' },
  { label: 'Избранные адреса', description: 'Сохранённые места', icon: 'i-mdi-heart-outline', to: '/passenger/menu/places' },
  { label: 'Поддержка', description: 'Помощь и обращения', icon: 'i-mdi-headset', to: '/passenger/menu/support' },
  { label: 'Настройки', description: 'Профиль и приложение', icon: 'i-mdi-cog-outline', to: '/passenger/menu/settings' },
]

definePage({
  meta: {
    authRedirect: '/passenger/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

useHead({
  title: 'Меню | EdTaxi',
})

async function logout() {
  await auth.logout()
  await router.replace('/passenger/login')
}

onMounted(async () => {
  await passenger.loadProfile().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+7.25rem)] pt-[calc(var(--app-safe-area-top)+1.35rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header class="flex items-center gap-4">
        <Avatar
          :name="passenger.displayName"
          :src="passenger.profile?.avatar_url || ''"
        />

        <div class="min-w-0">
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
      </header>

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
