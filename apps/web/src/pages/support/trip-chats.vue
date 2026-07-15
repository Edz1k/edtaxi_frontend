<script setup lang="ts">
import type { TripChatSummary } from '~/types/trip-chats'
import { showErrorToast } from '~/api/errors'
import { listTripChats } from '~/api/trip-chats'
import WebPageShell from '~/components/app/WebPageShell.vue'

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['tech_support', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Чаты поездок | Telegram Taxi',
})

const LIMIT = 30
const chats = ref<TripChatSummary[]>([])
const offset = ref(0)
const isLoading = ref(false)
const hasMore = ref(false)

const STATUS_LABELS: Record<string, string> = {
  cancelled: 'Отменена',
  completed: 'Завершена',
  driver_arriving: 'Водитель на месте',
  driver_assigned: 'Водитель едет',
  in_progress: 'В пути',
  searching: 'Поиск',
}

onMounted(load)

async function load(nextOffset = 0) {
  isLoading.value = true
  try {
    const response = await listTripChats(LIMIT, nextOffset)
    chats.value = nextOffset === 0 ? response.chats : [...chats.value, ...response.chats]
    offset.value = nextOffset
    hasMore.value = response.chats.length === LIMIT
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить чаты поездок.')
  }
  finally {
    isLoading.value = false
  }
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    description="Переписка пассажиров и водителей внутри поездок — для контроля качества и разбора спорных ситуаций. Только чтение."
    title="Чаты поездок"
  >
    <div class="mt-5 space-y-2">
      <div v-if="isLoading && !chats.length" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-16 animate-pulse border border-white/8 rounded-2xl bg-white/6" />
      </div>

      <div v-else-if="!chats.length" class="border border-white/10 rounded-2xl bg-white/6 px-4 py-10 text-center text-sm text-white/45">
        Пока ни в одной поездке не переписывались.
      </div>

      <RouterLink
        v-for="chat in chats"
        :key="chat.trip_id"
        class="grid grid-cols-1 gap-2 border border-white/10 rounded-2xl bg-white/6 px-4 py-3 transition md:grid-cols-[1fr_1fr_auto_auto] md:items-center hover:bg-white/10"
        :to="{ path: `/support/trip-chats/${chat.trip_id}`, query: { passenger: chat.passenger_id } }"
      >
        <div class="min-w-0">
          <p class="truncate text-sm text-white font-900">
            {{ chat.passenger_name || 'Пассажир' }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ chat.passenger_phone || chat.passenger_id }}
          </p>
        </div>

        <div class="min-w-0">
          <p class="truncate text-sm text-white/80 font-800">
            {{ chat.driver?.name || 'Водитель' }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ chat.driver?.phone || '—' }}
          </p>
        </div>

        <span class="w-fit border border-cyan-200/16 rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100 font-900">
          {{ statusLabel(chat.trip_status) }}
        </span>

        <div class="text-right">
          <p class="text-sm text-white/70 font-800">
            {{ chat.messages_count }} сообщ.
          </p>
          <p class="mt-0.5 text-xs text-white/42">
            {{ formatDay(chat.last_message_at) }}
          </p>
        </div>
      </RouterLink>

      <button
        v-if="hasMore"
        :disabled="isLoading"
        class="h-10 w-full border border-white/12 rounded-2xl bg-white/8 text-sm text-white font-900 transition hover:bg-white/12 disabled:opacity-50"
        type="button"
        @click="load(offset + LIMIT)"
      >
        {{ isLoading ? 'Загружаем...' : 'Загрузить ещё' }}
      </button>
    </div>
  </WebPageShell>
</template>
