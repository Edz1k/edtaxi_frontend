<script setup lang="ts">
import type { SupportRoom } from '~/types/support'
import { shortId } from '~/utils/format'
import {
  canClaimRoom,
  isAssignedTo,
  participantIcon,
  participantLabel,
  participantProfileLink,
  roomStatusLabel,
} from '~/utils/support'

const props = defineProps<{
  room: SupportRoom | null
  messageCount: number
  isMutating: boolean
  errorMessage: string
  currentUserId?: string
}>()

defineEmits<{
  claim: []
  close: []
}>()

const isAssigned = computed(() => isAssignedTo(props.room, props.currentUserId))
const canClaim = computed(() => canClaimRoom(props.room, props.currentUserId))
const isClosed = computed(() => props.room?.status === 'closed')
const isPendingClose = computed(() => props.room?.status === 'pending_close')

const icon = computed(() => participantIcon(props.room?.participant_type))
const profileLink = computed(() => participantProfileLink(props.room))
const statusLabel = computed(() => roomStatusLabel(props.room?.status))
const typeLabel = computed(() => participantLabel(props.room?.participant_type))
const primary = computed(() => props.room?.participant_name || typeLabel.value)
const secondary = computed(() => props.room?.participant_phone || props.room?.passenger_id || props.room?.id || '')

const statusToneClass = computed(() => {
  if (isClosed.value)
    return 'border-white/10 bg-white/6 text-white/55'
  if (isPendingClose.value)
    return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
})
</script>

<template>
  <header class="shrink-0 border-b border-white/8 bg-secondary-900/95 px-4 py-3 backdrop-blur">
    <div class="mx-auto max-w-6xl flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="min-w-0 flex flex-1 items-center gap-3">
        <RouterLink
          aria-label="Вернуться к списку обращений"
          class="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-white/7 text-slate-300 transition hover:bg-white/12"
          to="/support"
        >
          <span class="i-mdi-arrow-left text-5" aria-hidden="true" />
        </RouterLink>

        <div class="h-11 w-11 flex shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
          <span :class="icon" class="text-5.5" aria-hidden="true" />
        </div>

        <div class="min-w-0">
          <div class="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <RouterLink
              v-if="profileLink"
              :to="profileLink"
              class="min-w-0 truncate text-base text-cyan-100 font-950 hover:underline"
            >
              {{ primary }}
            </RouterLink>
            <p v-else class="min-w-0 truncate text-base font-950">
              {{ primary }}
            </p>
            <span
              class="inline-flex items-center border rounded-lg px-2 py-0.5 text-xs font-900"
              :class="statusToneClass"
            >
              {{ statusLabel }}
            </span>
          </div>
          <div class="mt-0.5 min-w-0 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45 font-800">
            <span class="truncate">{{ secondary }}</span>
            <span>{{ typeLabel }}</span>
            <span>ID {{ shortId(room?.id ?? '') }}</span>
            <span>{{ messageCount }} сообщ.</span>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button
          v-if="!isAssigned && canClaim"
          :disabled="isMutating"
          class="h-10 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98] hover:bg-cyan-200 disabled:opacity-50"
          type="button"
          @click="$emit('claim')"
        >
          <span class="i-mdi-hand-back-right-outline text-5" aria-hidden="true" />
          {{ isMutating ? 'Берём...' : 'Взять в работу' }}
        </button>

        <button
          v-if="isAssigned && !isClosed && !isPendingClose"
          :disabled="isMutating"
          class="h-10 inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 text-sm text-red-200 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
          type="button"
          @click="$emit('close')"
        >
          <span class="i-mdi-check-circle-outline text-5" aria-hidden="true" />
          {{ isMutating ? 'Отправляем...' : 'Решено' }}
        </button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="mx-auto mt-3 max-w-5xl border border-red-400/20 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-100 font-800"
    >
      {{ errorMessage }}
    </div>
  </header>
</template>
