<script setup lang="ts">
import type { SupportParticipantType, SupportRoom, SupportRoomStatus } from '~/types/support'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useAuthStore } from '~/stores/auth'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()
const auth = useAuthStore()
const { value: statusFilter, model: statusModel } = useListFilter<SupportRoomStatus>('open')
const { value: participantFilter, model: participantModel } = useListFilter<SupportParticipantType>()

const statusOptions: Array<{ label: string, value: SupportRoomStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'На закрытии', value: 'pending_close' },
  { label: 'Закрытые', value: 'closed' },
]

const participantOptions: Array<{ label: string, value: SupportParticipantType | '' }> = [
  { label: 'Все участники', value: '' },
  { label: 'Пассажиры', value: 'passenger' },
  { label: 'Водители', value: 'driver' },
]

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Обращения поддержки | Админка',
})

onMounted(() => {
  loadRooms()
})

watch([statusFilter, participantFilter], () => loadRooms())

function loadRooms() {
  admin.loadSupportRooms({
    status: statusFilter.value || undefined,
    participant_type: participantFilter.value || undefined,
    limit: 100,
  }).catch(() => {})
}

function participantLabel(room: SupportRoom) {
  return room.participant_type === 'driver' ? 'Водитель' : 'Пассажир'
}

function agentLabel(room: SupportRoom) {
  if (!room.agent_id)
    return '—'
  return room.agent_id === auth.currentUser?.id ? 'Вы' : room.agent_id
}

function statusLabel(status: SupportRoomStatus) {
  const labels: Record<SupportRoomStatus, string> = {
    closed: 'Закрыто',
    open: 'Открыто',
    pending_close: 'На закрытии',
  }
  return labels[status]
}

function statusClass(status: SupportRoomStatus) {
  if (status === 'open')
    return 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'
  if (status === 'pending_close')
    return 'bg-amber-500/12 text-amber-300 md:bg-transparent'
  return 'bg-white/8 text-white/45 md:bg-transparent'
}
</script>

<template>
  <WebPageShell
    embedded
    description="Все обращения в поддержку: назначайте агента (обращение закрепится за вами) и закрывайте решённые вопросы."
    title="Обращения поддержки"
  >
    <template #actions>
      <AppSelectDropdown v-model="participantModel" label="Участник" :options="participantOptions" />
      <AppSelectDropdown v-model="statusModel" label="Статус" :options="statusOptions" />
      <button
        :disabled="admin.isLoadingSupportRooms"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadRooms()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingSupportRooms }" />
        {{ admin.isLoadingSupportRooms ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_110px_120px_minmax(120px,0.7fr)_140px_240px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Участник</span>
        <span>Тип</span>
        <span>Статус</span>
        <span>Агент</span>
        <span>Обновлено</span>
        <span class="text-right">Действия</span>
      </div>

      <div v-if="admin.isLoadingSupportRooms" class="px-4 py-6 text-sm text-white/50">
        Загружаем обращения...
      </div>

      <div v-else-if="!admin.supportRooms.length" class="px-4 py-6 text-sm text-white/50">
        Обращений нет.
      </div>

      <div
        v-for="room in admin.supportRooms"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_110px_120px_minmax(120px,0.7fr)_140px_240px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            {{ room.participant_name || room.id }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ room.participant_phone || room.passenger_id }}
          </p>
        </div>

        <span class="text-sm text-white/58 font-800">{{ participantLabel(room) }}</span>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="statusClass(room.status)"
        >
          {{ statusLabel(room.status) }}
        </span>

        <span class="truncate text-sm text-white/58 font-800">{{ agentLabel(room) }}</span>

        <span class="text-sm text-white/50 font-800">{{ formatDate(room.updated_at) }}</span>

        <div class="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <RouterLink
            :to="`/support/${room.id}`"
            class="h-10 flex items-center rounded-xl bg-white/8 px-3 text-sm font-900 transition active:scale-[0.98] hover:bg-white/14"
          >
            Открыть
          </RouterLink>
          <button
            v-if="room.status !== 'closed' && room.agent_id !== auth.currentUser?.id"
            :disabled="admin.isMutating"
            class="h-10 rounded-xl bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="admin.assignSupportRoom(room)"
          >
            Назначить себя
          </button>
          <button
            v-if="room.status !== 'closed'"
            :disabled="admin.isMutating"
            class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="admin.closeSupportRoom(room)"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
