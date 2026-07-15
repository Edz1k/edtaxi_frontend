<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { useRoute as useVueRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

defineEmits<{
  // Клик по пункту — чтобы на мобиле закрыть slide-over.
  navigate: []
}>()

const route = useVueRoute()
const auth = useAuthStore()

interface NavItem {
  icon: string
  label: string
  to: string
}

const allGroups: Array<{ label: string, items: NavItem[] }> = [
  {
    label: '',
    items: [
      { icon: 'i-mdi-view-dashboard-outline', label: 'Кабинет', to: '/park' },
    ],
  },
  {
    label: 'Разделы',
    items: [
      { icon: 'i-mdi-wallet-outline', label: 'Кошелёк', to: '/park/wallet' },
      { icon: 'i-mdi-gift-outline', label: 'Акции', to: '/park/promotions' },
      { icon: 'i-mdi-account-plus-outline', label: 'Заявки водителей', to: '/park/requests' },
      { icon: 'i-mdi-chat-outline', label: 'Чат с водителями', to: '/park/chat' },
    ],
  },
]

// «Подглядывание» чужого парка суперадмином (?park_id=): разделы кошелька,
// акций и найма ударили бы по собственному парку вызывающего, поэтому в этом
// режиме доступен только «Кабинет» — как раньше были скрыты секции-ссылки.
const peekParkId = computed(() => {
  const raw = route.query.park_id
  return typeof raw === 'string' && raw ? raw : ''
})

const groups = computed(() =>
  peekParkId.value ? allGroups.slice(0, 1) : allGroups,
)

// Кабинет — точное совпадение (иначе он «активен» на всех страницах парка),
// остальные пункты подсвечиваются и на вложенных путях (чат-комната → «Чат»).
function isActive(to: string): boolean {
  if (to === '/park')
    return route.path === '/park'
  return route.path === to || route.path.startsWith(`${to}/`)
}

// В peek-режиме сохраняем ?park_id= при переходах, чтобы не выпасть из просмотра.
function linkTarget(to: string): RouteLocationRaw {
  return peekParkId.value ? { path: to, query: { park_id: peekParkId.value } } : to
}

const userName = computed(() => {
  const user = auth.currentUser
  if (!user)
    return 'Таксопарк'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Таксопарк'
})

const roleLabel = computed(() =>
  auth.roles.includes('park') ? 'Владелец парка' : 'Администратор',
)
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden border border-white/10 rounded-3xl bg-white/6 backdrop-blur-xl">
    <!-- Бренд -->
    <RouterLink
      :to="linkTarget('/park')"
      class="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4 transition"
      @click="$emit('navigate')"
    >
      <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-#06142f">
        <span class="i-mdi:taxi text-6" aria-hidden="true" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-base font-950 leading-tight">Telegram Taxi</span>
        <span class="block truncate text-xs text-white/45 font-800">Кабинет таксопарка</span>
      </span>
    </RouterLink>

    <!-- Навигация -->
    <nav aria-label="Разделы кабинета таксопарка" class="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-4">
      <div v-for="(group, gi) in groups" :key="gi">
        <p v-if="group.label" class="mb-1.5 px-3 text-[11px] text-white/35 font-900 tracking-wide uppercase">
          {{ group.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in group.items" :key="item.to">
            <RouterLink
              :to="linkTarget(item.to)"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              class="group h-11 w-full flex items-center gap-3 rounded-2xl px-3 text-sm font-800 transition"
              :class="isActive(item.to)
                ? 'bg-cyan-300/14 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.25)]'
                : 'text-white/60 hover:bg-white/6 hover:text-white'"
              @click="$emit('navigate')"
            >
              <span
                :class="[item.icon, isActive(item.to) ? 'text-cyan-300' : 'text-white/45 group-hover:text-white/80']"
                class="shrink-0 text-5 transition"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
              <span
                v-if="isActive(item.to)"
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                aria-hidden="true"
              />
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Футер: аккаунт + выход в общий кабинет -->
    <div class="shrink-0 border-t border-white/8 p-3">
      <div class="mb-2 flex items-center gap-3 px-2">
        <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70">
          <span class="i-mdi-office-building-marker text-5" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-900">{{ userName }}</span>
          <span class="block truncate text-xs text-white/40 font-700">{{ roleLabel }}</span>
        </span>
      </div>
      <RouterLink
        to="/dashboard"
        class="h-10 w-full flex items-center justify-center gap-2 rounded-xl bg-white/8 text-sm text-white/80 font-900 transition hover:bg-white/12 hover:text-white"
        @click="$emit('navigate')"
      >
        <span class="i-mdi-arrow-left text-4.5" aria-hidden="true" />
        В кабинет
      </RouterLink>
    </div>
  </div>
</template>
