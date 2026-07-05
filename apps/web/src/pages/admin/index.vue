<script setup lang="ts">
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Админка | EdTaxi',
})

const adminCards = computed(() => [
  {
    description: auth.roles.includes('superadmin')
      ? 'Суперадмин может назначать роль admin, остальные роли доступны администраторам.'
      : 'Роли, блокировка и список аккаунтов.',
    icon: 'i-mdi-account-group',
    title: 'Пользователи',
    to: '/admin/users',
  },
  {
    description: 'История заказов, статусы и детали маршрута.',
    icon: 'i-mdi-map-marker-path',
    title: 'Поездки',
    to: '/admin/trips',
  },
  {
    description: 'Проверка заявок, подтверждение и отклонение парков.',
    icon: 'i-mdi-office-building',
    title: 'Таксопарки',
    to: '/admin/parks',
  },
  {
    description: 'Переписка таксопарков с водителями.',
    icon: 'i-mdi-chat-outline',
    title: 'Чаты парков',
    to: '/admin/park-chats',
  },
  {
    description: 'Номера операторов, которым разрешён отдельный вход в техподдержку.',
    icon: 'i-mdi-headset',
    title: 'Техподдержка',
    to: '/admin/tech-support',
  },
  {
    description: 'Все обращения в поддержку: назначение агента и закрытие.',
    icon: 'i-mdi-forum-outline',
    title: 'Обращения поддержки',
    to: '/admin/support-rooms',
  },
  {
    description: 'Переписка пассажиров и водителей внутри поездок — контроль качества.',
    icon: 'i-mdi-message-text-outline',
    title: 'Чаты поездок',
    to: '/support/trip-chats',
  },
  {
    description: 'Заявки водителей и парков на вывод средств.',
    icon: 'i-mdi-cash-multiple',
    title: 'Выплаты',
    to: '/admin/payouts',
  },
  {
    description: 'Акции для пассажиров и водителей с рассылкой в Telegram.',
    icon: 'i-mdi-gift-outline',
    title: 'Акции',
    to: '/admin/promotions',
  },
  {
    description: 'Комиссия платформы и коэффициент цены поездок.',
    icon: 'i-mdi-tune',
    title: 'Настройки',
    to: '/admin/settings',
  },
])
</script>

<template>
  <WebPageShell
    back-label="Кабинет"
    back-to="/dashboard"
    description="Управление web-ролями, заявками таксопарков и операционными данными."
    title="Админка"
  >
    <div class="grid mt-7 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <RouterLink
        v-for="card in adminCards"
        :key="card.to"
        class="group border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur transition hover:border-cyan-300/35 hover:bg-white/12"
        :to="card.to"
      >
        <span class="h-13 w-13 flex items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
          <span :class="card.icon" class="text-7" />
        </span>
        <h2 class="mt-5 text-xl font-950">
          {{ card.title }}
        </h2>
        <p class="mt-2 text-sm text-white/55 leading-6">
          {{ card.description }}
        </p>
        <span class="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200 font-900">
          Открыть
          <span class="i-mdi-arrow-right transition group-hover:translate-x-1" />
        </span>
      </RouterLink>
    </div>
  </WebPageShell>
</template>
