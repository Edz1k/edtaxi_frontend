<script setup lang="ts">
import type { SupportParticipantType, SupportRoom, SupportRoomStatus } from '~/types/support'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useSupportStore } from '~/stores/support'
import { formatDate, shortId } from '~/utils/format'
import { participantIcon, participantProfileLink, roomStatusLabel } from '~/utils/support'

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

const visibleCounts = computed(() => {
  return filteredRooms.value.reduce<Record<SupportRoomStatus, number>>((acc, room) => {
    acc[room.status] += 1
    return acc
  }, { closed: 0, open: 0, pending_close: 0 })
})

const activeParticipantLabel = computed(() => {
  return participantType.value ? participantLabel(participantType.value) : 'Все участники'
})

const statuses: Array<{ label: string, value: SupportRoomStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'На закрытии', value: 'pending_close' },
  { label: 'Закрытые', value: 'closed' },
]

const queueStatusCards: Array<{ label: string, value: SupportRoomStatus }> = [
  { label: 'Очередь', value: 'open' },
  { label: 'Ожидают клиента', value: 'pending_close' },
  { label: 'Закрыты', value: 'closed' },
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
  title: 'Поддержка | Telegram Taxi',
})

onMounted(() => {
  loadRooms()
  admin.loadSupportStats().catch(() => {})
})

watch([participantType, status], () => loadRooms())

function loadRooms() {
  support.loadRooms({ participant_type: participantType.value || undefined, status: status.value || undefined, limit: 100 }).catch(() => {})
}

function refreshQueue() {
  loadRooms()
  admin.loadSupportStats().catch(() => {})
}

function participantLabel(value: SupportParticipantType) {
  return participantTypes.find(item => item.value === value)?.label ?? value
}

function statusClass(value: SupportRoomStatus) {
  if (value === 'open')
    return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
  if (value === 'pending_close')
    return 'border-amber-400/25 bg-amber-400/10 text-amber-200'
  return 'border-white/10 bg-white/6 text-white/50'
}

function statusDotClass(value: SupportRoomStatus) {
  if (value === 'open')
    return 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.45)]'
  if (value === 'pending_close')
    return 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]'
  return 'bg-white/35'
}

function statusCardClass(value: SupportRoomStatus) {
  if (status.value !== value)
    return 'border-white/8 bg-white/5 text-white/55 hover:bg-white/8'
  if (value === 'open')
    return 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100'
  if (value === 'pending_close')
    return 'border-amber-400/30 bg-amber-400/12 text-amber-100'
  return 'border-white/18 bg-white/10 text-white'
}

function assignmentLabel(room: SupportRoom) {
  if (room.status === 'closed')
    return 'Архив'
  if (room.status === 'pending_close')
    return 'Ждём ответ'
  return room.agent_id ? 'В работе' : 'Свободно'
}

function assignmentClass(room: SupportRoom) {
  if (room.status === 'closed')
    return 'text-white/40'
  if (room.status === 'pending_close')
    return 'text-amber-200'
  return room.agent_id ? 'text-cyan-200' : 'text-emerald-200'
}
</script>

<template>
  <WebPageShell
    back-label="Кабинет"
    back-to="/dashboard"
    description="Операционный монитор обращений. Сначала разбираем свободные открытые чаты, затем контролируем обращения на подтверждении клиента."
    title="Поддержка"
  >
    <template #actions>
      <button
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-lg bg-white/7 px-3 text-sm font-900 transition hover:bg-white/12 disabled:opacity-50"
        :disabled="support.isLoading"
        type="button"
        @click="refreshQueue"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="support.isLoading ? 'animate-spin' : ''" aria-hidden="true" />
        Обновить
      </button>
      <RouterLink
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-lg bg-white/7 px-3 text-sm font-900 transition hover:bg-white/12"
        to="/support/verifications"
      >
        <span class="i-mdi-shield-car text-5 text-cyan-200" aria-hidden="true" />
        Верификация
      </RouterLink>
      <RouterLink
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-lg bg-white/7 px-3 text-sm font-900 transition hover:bg-white/12"
        to="/support/trip-chats"
      >
        <span class="i-mdi-message-text-outline text-5 text-cyan-200" aria-hidden="true" />
        Чаты поездок
      </RouterLink>
      <RouterLink
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-lg bg-white/7 px-3 text-sm font-900 transition hover:bg-white/12"
        to="/support/car-requests"
      >
        <span class="i-mdi-car-search text-5 text-cyan-200" aria-hidden="true" />
        Каталог машин
      </RouterLink>
      <AppSelectDropdown v-model="participantFilter" label="Тип" :options="participantTypes" />
      <AppSelectDropdown v-model="statusFilter" label="Статус" :options="statuses" />
    </template>

    <div class="grid mt-5 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div class="relative">
        <span class="i-mdi-magnify absolute left-3 top-1/2 text-5 text-white/38 -translate-y-1/2" aria-hidden="true" />
        <input
          v-model="query"
          aria-label="Поиск по имени или номеру"
          class="h-11 w-full border border-white/10 rounded-lg bg-white/7 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/10 placeholder:text-white/32"
          placeholder="Поиск по имени или номеру телефона"
          type="search"
        >
      </div>

      <div class="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
        <button
          v-for="item in queueStatusCards"
          :key="item.value"
          class="min-w-0 border rounded-lg px-3 py-2 text-left transition"
          :class="statusCardClass(item.value)"
          type="button"
          @click="statusFilter = item.value"
        >
          <span class="flex items-center gap-2 text-[11px] font-900 uppercase">
            <span class="h-2 w-2 rounded-full" :class="statusDotClass(item.value)" aria-hidden="true" />
            <span class="truncate">{{ item.label }}</span>
          </span>
          <span class="mt-1 block text-xl font-950">{{ visibleCounts[item.value] }}</span>
        </button>
      </div>
    </div>

    <div v-if="admin.supportStats" class="mt-3 flex flex-wrap gap-2 text-xs text-white/50 font-800">
      <span class="border border-white/10 rounded-lg bg-white/6 px-3 py-2">
        Всего: <b class="text-white">{{ admin.supportStats.total }}</b>
      </span>
      <span class="border border-white/10 rounded-lg bg-white/6 px-3 py-2">
        В работе: <b :class="admin.supportStats.open > 0 ? 'text-amber-300' : 'text-white'">{{ admin.supportStats.open }}</b>
      </span>
      <span class="border border-white/10 rounded-lg bg-white/6 px-3 py-2">
        Решено: <b class="text-emerald-300">{{ admin.supportStats.resolved }}</b>
      </span>
    </div>

    <div
      v-if="support.errorMessage"
      class="mt-3 border border-red-400/20 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-100 font-800"
    >
      {{ support.errorMessage }}
    </div>

    <div class="mt-4 overflow-hidden border border-white/10 rounded-lg bg-white/6 backdrop-blur">
      <div class="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm font-950">
            Рабочая очередь
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42 font-800">
            {{ activeParticipantLabel }} · {{ statusFilter ? roomStatusLabel(statusFilter) : 'Все статусы' }} · {{ filteredRooms.length }} строк
          </p>
        </div>
        <div class="hidden items-center gap-2 text-xs text-white/45 font-800 sm:flex">
          <span class="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.5)]" aria-hidden="true" />
          Live queue
        </div>
      </div>

      <div class="grid-cols-[minmax(260px,1fr)_110px_130px_120px_150px_104px] hidden gap-3 border-b border-white/8 px-4 py-2.5 text-[11px] text-white/42 font-900 uppercase lg:grid">
        <span>Обращение</span>
        <span>Тип</span>
        <span>Статус</span>
        <span>Агент</span>
        <span>Обновлено</span>
        <span class="text-right">Действия</span>
      </div>

      <div v-if="support.isLoading" class="divide-y divide-white/6">
        <div v-for="i in 6" :key="i" class="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(260px,1fr)_110px_130px_120px_150px_104px] lg:items-center">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 animate-pulse rounded-lg bg-white/8" />
            <div class="min-w-0 flex-1">
              <div class="h-3 max-w-full w-48 animate-pulse rounded bg-white/8" />
              <div class="mt-2 h-2.5 w-32 animate-pulse rounded bg-white/6" />
            </div>
          </div>
          <div class="hidden h-3 w-16 animate-pulse rounded bg-white/7 lg:block" />
          <div class="hidden h-7 w-24 animate-pulse rounded bg-white/7 lg:block" />
          <div class="hidden h-3 w-20 animate-pulse rounded bg-white/7 lg:block" />
          <div class="hidden h-3 w-24 animate-pulse rounded bg-white/7 lg:block" />
          <div class="hidden h-9 w-24 animate-pulse rounded bg-white/7 lg:block" />
        </div>
      </div>

      <div v-else-if="!filteredRooms.length" class="px-4 py-6 text-sm text-white/50">
        {{ query ? 'Ничего не найдено.' : 'Обращений нет.' }}
      </div>

      <div
        v-for="room in filteredRooms"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-3 transition lg:grid-cols-[minmax(260px,1fr)_110px_130px_120px_150px_104px] lg:items-center last:border-b-0 hover:bg-white/5"
      >
        <div class="min-w-0 flex items-center gap-3">
          <div class="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
            <span :class="participantIcon(room.participant_type)" class="text-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <RouterLink
              v-if="participantProfileLink(room)"
              :to="participantProfileLink(room)"
              class="flex items-center gap-1 truncate text-sm text-cyan-100 font-900 hover:underline"
            >
              {{ room.participant_name || `Обращение ${shortId(room.id)}` }}
              <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" aria-hidden="true" />
            </RouterLink>
            <p v-else class="truncate text-sm font-900">
              {{ room.participant_name || `Обращение ${shortId(room.id)}` }}
            </p>
            <p class="mt-0.5 truncate text-xs text-white/42">
              {{ room.participant_phone || room.passenger_id }}
            </p>
          </div>
        </div>

        <span class="text-sm text-white/58 font-800">{{ participantLabel(room.participant_type) }}</span>

        <span
          class="w-fit border rounded-lg px-2.5 py-1 text-xs font-900"
          :class="statusClass(room.status)"
        >
          {{ roomStatusLabel(room.status) }}
        </span>

        <span class="text-sm font-800" :class="assignmentClass(room)">
          {{ assignmentLabel(room) }}
        </span>

        <span class="text-sm text-white/50 font-800">{{ formatDate(room.updated_at) }}</span>

        <div class="flex justify-start md:justify-end">
          <RouterLink
            :to="`/support/${room.id}`"
            class="h-9 inline-flex items-center gap-1.5 rounded-lg bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98] hover:bg-cyan-200"
          >
            <span class="i-mdi-message-text-outline text-4.5" aria-hidden="true" />
            Открыть
          </RouterLink>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
