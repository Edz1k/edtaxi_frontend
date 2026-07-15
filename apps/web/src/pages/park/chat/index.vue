<script setup lang="ts">
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useParkChatStore } from '~/stores/park-chat'
import { formatDate } from '~/utils/format'

const parkChat = useParkChatStore()
const { value: statusFilter, model: statusModel } = useListFilter<'closed' | 'open'>('open')

const statuses: Array<{ label: string, value: 'closed' | 'open' | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'Закрытые', value: 'closed' },
]

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    layout: 'park',
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Чат с водителями | Telegram Taxi',
})

onMounted(() => loadRooms())
watch(statusFilter, () => loadRooms())

function loadRooms() {
  parkChat.loadRooms({ status: statusFilter.value || undefined }).catch(() => {})
}
</script>

<template>
  <WebPageShell
    embedded
    description="Диалоги водителей с таксопарком. Открывайте чат, чтобы ответить или закрыть обращение."
    title="Чат с водителями"
  >
    <template #actions>
      <AppSelectDropdown v-model="statusModel" label="Статус" :options="statuses" />
      <button
        :disabled="parkChat.isLoading"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadRooms()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': parkChat.isLoading }" />
        {{ parkChat.isLoading ? 'Загружаем...' : 'Обновить' }}
      </button>
    </template>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_120px_150px_120px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Водитель</span>
        <span>Статус</span>
        <span>Обновлён</span>
        <span class="text-right">Действия</span>
      </div>

      <div v-if="parkChat.isLoading" class="px-4 py-6 text-sm text-white/50">
        Загружаем чаты...
      </div>

      <div v-else-if="!parkChat.rooms.length" class="px-4 py-6 text-sm text-white/50">
        Чатов нет.
      </div>

      <div
        v-for="room in parkChat.rooms"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_120px_150px_120px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            Водитель
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42 font-mono">
            {{ room.driver_id }}
          </p>
        </div>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="room.status === 'open' ? 'bg-emerald-500/12 text-emerald-300 md:bg-transparent' : 'bg-white/8 text-white/45 md:bg-transparent'"
        >
          {{ room.status === 'open' ? 'Открыт' : 'Закрыт' }}
        </span>

        <span class="text-sm text-white/50 font-800">{{ formatDate(room.updated_at) }}</span>

        <div class="flex justify-start md:justify-end">
          <RouterLink
            :to="`/park/chat/${room.id}`"
            class="h-10 flex items-center rounded-xl bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          >
            Открыть
          </RouterLink>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
