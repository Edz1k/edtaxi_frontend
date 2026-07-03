<script setup lang="ts">
import type { SupportRoom } from '~/types/support'
import { formatTime, shortId } from '~/utils/format'
import {
  isAssignedTo,
  participantIcon,
  participantLabel,
  participantProfileLink,
  paymentLabel,
  resolveSupportActionHint,
  roomStatusLabel,
  tripFare,
  tripStatusLabel,
} from '~/utils/support'

const props = defineProps<{
  room: SupportRoom | null
  messageCount: number
  currentUserId?: string
}>()

const isAssigned = computed(() => isAssignedTo(props.room, props.currentUserId))
const isClosed = computed(() => props.room?.status === 'closed')
const isPendingClose = computed(() => props.room?.status === 'pending_close')

const icon = computed(() => participantIcon(props.room?.participant_type))
const profileLink = computed(() => participantProfileLink(props.room))
const statusLabel = computed(() => roomStatusLabel(props.room?.status))
const typeLabel = computed(() => participantLabel(props.room?.participant_type))
const primary = computed(() => props.room?.participant_name || typeLabel.value)
const secondary = computed(() => props.room?.participant_phone || props.room?.passenger_id || props.room?.id || '')
// Прикреплённая к обращению поездка — чтобы агент видел, о какой поездке речь.
const attachedTrip = computed(() => props.room?.trip ?? null)

const statusToneClass = computed(() => {
  if (isClosed.value)
    return 'border-white/10 bg-white/6 text-white/55'
  if (isPendingClose.value)
    return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
})

const actionHint = computed(() => resolveSupportActionHint({
  isClosed: isClosed.value,
  isPendingClose: isPendingClose.value,
  isAssigned: isAssigned.value,
  hasAgent: !!props.room?.agent_id,
}))
</script>

<template>
  <aside class="min-h-0 overflow-y-auto border border-white/10 rounded-lg bg-white/6 p-3">
    <div
      v-if="room"
      class="flex gap-3 border rounded-lg px-3 py-3 text-sm font-800"
      :class="actionHint.tone"
    >
      <span :class="actionHint.icon" class="mt-0.5 shrink-0 text-5" aria-hidden="true" />
      <div class="min-w-0">
        <p class="font-950">
          {{ actionHint.title }}
        </p>
        <p class="mt-1 text-xs leading-5 opacity-75">
          {{ actionHint.text }}
        </p>
      </div>
    </div>

    <div class="mt-3 border border-white/8 rounded-lg bg-secondary-900/45 p-3">
      <p class="text-[11px] text-white/42 font-900 uppercase">
        Клиент
      </p>
      <div class="mt-3 flex items-center gap-3">
        <div class="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
          <span :class="icon" class="text-5" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-950">
            {{ primary }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/45 font-800">
            {{ secondary }}
          </p>
        </div>
      </div>
      <RouterLink
        v-if="profileLink"
        :to="profileLink"
        class="mt-3 h-9 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white/8 text-sm text-cyan-100 font-900 transition hover:bg-white/12"
      >
        <span class="i-mdi-account-details-outline text-4.5" aria-hidden="true" />
        Открыть профиль
      </RouterLink>
    </div>

    <div class="mt-3 border border-white/8 rounded-lg bg-secondary-900/45 p-3">
      <p class="text-[11px] text-white/42 font-900 uppercase">
        Контроль
      </p>
      <div class="mt-3 text-sm font-800 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-white/45">Статус</span>
          <span class="border rounded-lg px-2 py-0.5 text-xs font-900" :class="statusToneClass">
            {{ statusLabel }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-white/45">Назначение</span>
          <span :class="isAssigned ? 'text-emerald-200' : 'text-amber-200'">
            {{ isAssigned ? 'Вы' : room?.agent_id ? 'Другой агент' : 'Свободно' }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-white/45">Сообщения</span>
          <span>{{ messageCount }}</span>
        </div>
      </div>
    </div>

    <div v-if="attachedTrip" class="mt-3 border border-white/8 rounded-lg bg-secondary-900/45 p-3">
      <p class="flex items-center gap-2 text-[11px] text-cyan-200 font-900 uppercase">
        <span class="i-mdi-map-marker-path text-4" aria-hidden="true" />
        Поездка
      </p>
      <p class="mt-3 rounded-lg bg-white/6 px-2 py-1 text-xs text-white/65 font-900">
        {{ tripStatusLabel(attachedTrip.status) }}
      </p>
      <p class="mt-3 text-sm text-white/78 font-800 leading-5">
        {{ attachedTrip.pickup_address || 'Адрес подачи не указан' }}
      </p>
      <p class="mt-1 text-sm text-white/78 font-800 leading-5">
        {{ attachedTrip.dropoff_address || 'Адрес назначения не указан' }}
      </p>
      <div class="grid grid-cols-2 mt-3 gap-2 text-xs text-white/45 font-800">
        <span>{{ tripFare(attachedTrip) }}</span>
        <span>{{ paymentLabel(attachedTrip.payment_method) }}</span>
        <span>{{ formatTime(attachedTrip.created_at) }}</span>
        <span>ID {{ shortId(attachedTrip.id) }}</span>
      </div>
    </div>
  </aside>
</template>
