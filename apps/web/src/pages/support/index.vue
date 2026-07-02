<script setup lang="ts">
import type { SupportParticipantType, SupportRoom, SupportRoomStatus } from '~/types/support'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useSupportStore } from '~/stores/support'
import { formatDate } from '~/utils/format'

const support = useSupportStore()
// Статистика обращений живёт в admin-сторе; эндпоинт выбирается по роли,
// поэтому работает и у tech_support, и у админа.
const admin = useAdminStore()
const { value: participantType, model: participantFilter } = useListFilter<SupportParticipantType>('passenger')
const { value: status, model: statusFilter } = useListFilter<SupportRoomStatus>('open')
const query = ref('')

// Поиск по имени и номеру телефона участника (по уже загруженному списку).
const filteredRooms = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return support.rooms
  return support.rooms.filter((room) => {
    const name = (room.participant_name || '').toLowerCase()
    const phone = (room.participant_phone || '').toLowerCase()
    return name.includes(q) || phone.includes(q)
  })
})

// Ссылка в кабинет участника: водитель → /drivers/:id, пассажир → /passengers/:id
// (passenger_id здесь — user_id участника).
function profileLink(room: SupportRoom) {
  if (!room.passenger_id)
    return ''
  return room.participant_type === 'driver'
    ? `/drivers/${room.passenger_id}`
    : `/passengers/${room.passenger_id}`
}

const statuses: Array<{ label: string, value: SupportRoomStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'Закрытые', value: 'closed' },
]

const participantTypes: Array<{ label: string, value: SupportParticipantType }> = [
  { label: 'Пассажиры', value: 'passenger' },
  { label: 'Водители', value: 'driver' },
]

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Поддержка | EdTaxi',
})

onMounted(() => {
  loadRooms()
  admin.loadSupportStats().catch(() => {})
})

watch([participantType, status], () => loadRooms())

function loadRooms() {
  support.loadRooms({ participant_type: participantType.value || undefined, status: status.value || undefined, limit: 100 }).catch(() => {})
}

function participantLabel(value: SupportParticipantType) {
  return participantTypes.find(item => item.value === value)?.label ?? value
}

function statusLabel(value: SupportRoomStatus) {
  const labels: Record<SupportRoomStatus, string> = {
    closed: 'Закрыто',
    open: 'Открыто',
    pending_close: 'На закрытии',
  }
  return labels[value]
}

function statusClass(value: SupportRoomStatus) {
  if (value === 'open')
    return 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'
  if (value === 'pending_close')
    return 'bg-amber-500/12 text-amber-300 md:bg-transparent'
  return 'bg-white/8 text-white/45 md:bg-transparent'
}
</script>

<template>
  <WebPageShell
    back-label="Кабинет"
    back-to="/dashboard"
    description="Откройте обращение, чтобы автоматически взять его в работу, ответить пользователю и закрыть решенный вопрос."
    title="Поддержка"
  >
    <template #actions>
      <RouterLink
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
        to="/support/verifications"
      >
        <span class="i-mdi-shield-car text-5 text-cyan-200" />
        Верификация
      </RouterLink>
      <AppSelectDropdown v-model="participantFilter" label="Тип" :options="participantTypes" />
      <AppSelectDropdown v-model="statusFilter" label="Статус" :options="statuses" />
    </template>

    <!-- Счётчик обращений: решено / в работе / всего -->
    <div v-if="admin.supportStats" class="grid mt-5 gap-3 sm:grid-cols-3">
      <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
        <p class="text-xs text-white/45 font-800 uppercase">
          Решено
        </p>
        <p class="mt-1 text-2xl text-emerald-300 font-950">
          {{ admin.supportStats.resolved }}/{{ admin.supportStats.total }}
        </p>
      </div>
      <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
        <p class="text-xs text-white/45 font-800 uppercase">
          В работе
        </p>
        <p class="mt-1 text-2xl font-950" :class="admin.supportStats.open > 0 ? 'text-amber-300' : ''">
          {{ admin.supportStats.open }}
        </p>
      </div>
      <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
        <p class="text-xs text-white/45 font-800 uppercase">
          Всего обращений
        </p>
        <p class="mt-1 text-2xl font-950">
          {{ admin.supportStats.total }}
        </p>
      </div>
    </div>

    <div class="relative mt-5">
      <span class="i-mdi-magnify absolute left-3.5 top-1/2 text-5 text-white/40 -translate-y-1/2" />
      <input
        v-model="query"
        aria-label="Поиск по имени или номеру"
        class="h-11 w-full border border-white/10 rounded-2xl bg-white/8 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
        placeholder="Поиск по имени или номеру телефона"
        type="search"
      >
    </div>

    <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_120px_120px_150px_120px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Обращение</span>
        <span>Тип</span>
        <span>Статус</span>
        <span>Обновлено</span>
        <span class="text-right">Действия</span>
      </div>

      <div v-if="support.isLoading" class="px-4 py-6 text-sm text-white/50">
        Загружаем обращения...
      </div>

      <div v-else-if="!filteredRooms.length" class="px-4 py-6 text-sm text-white/50">
        {{ query ? 'Ничего не найдено.' : 'Обращений нет.' }}
      </div>

      <div
        v-for="room in filteredRooms"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_120px_120px_150px_120px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <RouterLink
            v-if="profileLink(room)"
            :to="profileLink(room)"
            class="flex items-center gap-1 truncate text-sm text-cyan-200 font-900 hover:underline"
          >
            {{ room.participant_name || room.id }}
            <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" />
          </RouterLink>
          <p v-else class="truncate text-sm font-900">
            {{ room.participant_name || room.id }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ room.participant_phone || room.passenger_id }}
          </p>
        </div>

        <span class="text-sm text-white/58 font-800">{{ participantLabel(room.participant_type) }}</span>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="statusClass(room.status)"
        >
          {{ statusLabel(room.status) }}
        </span>
        <span class="text-sm text-white/50 font-800">{{ formatDate(room.updated_at) }}</span>

        <div class="flex justify-start md:justify-end">
          <RouterLink
            :to="`/support/${room.id}`"
            class="h-10 flex items-center rounded-xl bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          >
            Открыть
          </RouterLink>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
