<script setup lang="ts">
import type { SupportRoom } from '~/types/support'
import { showErrorToast } from '~/api/errors'
import { blockUserBySupport } from '~/api/trip-chats'
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

// --- Блокировка клиента («наказание»: срок + причина) ---

const showBlockForm = ref(false)
const blockHours = ref(5)
const blockReason = ref('')
const isBlocking = ref(false)
const blockedNow = ref(false)

const BLOCK_DURATIONS = [
  { label: '1 ч', value: 1 },
  { label: '5 ч', value: 5 },
  { label: '24 ч', value: 24 },
  { label: 'Навсегда', value: 0 },
]

watch(() => props.room?.id, () => {
  showBlockForm.value = false
  blockReason.value = ''
  blockedNow.value = false
})

async function confirmBlock() {
  const userId = props.room?.passenger_id
  if (!userId || isBlocking.value || !blockReason.value.trim())
    return
  isBlocking.value = true
  try {
    await blockUserBySupport(userId, { blocked: true, hours: blockHours.value, reason: blockReason.value.trim() })
    blockedNow.value = true
    showBlockForm.value = false
  }
  catch (error) {
    showErrorToast(error, 'Не удалось заблокировать пользователя.')
  }
  finally {
    isBlocking.value = false
  }
}
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

      <!-- Блокировка клиента: «наказание» на срок с обязательной причиной -->
      <p v-if="blockedNow" class="mt-3 rounded-lg bg-red-500/12 px-3 py-2 text-xs text-red-300 font-900">
        Пользователь заблокирован
      </p>
      <button
        v-else-if="!showBlockForm"
        class="mt-3 h-9 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/12 text-sm text-red-300 font-900 transition hover:bg-red-500/20"
        type="button"
        @click="showBlockForm = true"
      >
        <span class="i-mdi-account-cancel-outline text-4.5" aria-hidden="true" />
        Заблокировать
      </button>
      <div v-else class="mt-3 border border-red-400/20 rounded-lg bg-red-500/6 p-2.5">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="duration in BLOCK_DURATIONS"
            :key="duration.value"
            class="h-8 rounded-lg px-2.5 text-xs font-900 transition active:scale-[0.97]"
            :class="blockHours === duration.value ? 'bg-red-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="blockHours = duration.value"
          >
            {{ duration.label }}
          </button>
        </div>
        <textarea
          v-model="blockReason"
          class="mt-2 h-16 w-full resize-none border border-white/10 rounded-lg bg-white/6 p-2 text-xs outline-none transition focus:border-red-300/50"
          maxlength="500"
          placeholder="Причина блокировки (обязательно)"
        />
        <div class="mt-2 flex gap-1.5">
          <button
            class="h-8 flex-1 rounded-lg bg-white/8 text-xs font-900 transition active:scale-[0.98]"
            type="button"
            @click="showBlockForm = false"
          >
            Отмена
          </button>
          <button
            :disabled="isBlocking || !blockReason.trim()"
            class="h-8 flex-1 rounded-lg bg-red-500/80 text-xs text-white font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="confirmBlock"
          >
            {{ isBlocking ? 'Блокируем...' : 'Заблокировать' }}
          </button>
        </div>
      </div>
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
