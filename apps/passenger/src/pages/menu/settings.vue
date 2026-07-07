<script setup lang="ts">
import { usePassengerStore } from '~/stores/passenger'

const passenger = usePassengerStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Настройки',
  },
})

useHead({
  title: 'Настройки | EdTaxi',
})

onMounted(() => {
  if (!passenger.profile)
    passenger.loadProfile().catch(() => {})
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Смена номера телефона — как у водителя: код в WhatsApp, подтверждение -->
      <RouterLink
        to="/menu/change-phone"
        class="flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 text-white transition active:scale-[0.98]"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-300">
          <span class="i-mdi-phone-sync text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">Номер телефона</span>
          <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
            {{ passenger.profile?.phone ? `${passenger.profile.phone} · изменить` : 'Изменить номер' }}
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 text-slate-500" />
      </RouterLink>
    </section>
  </main>
</template>
