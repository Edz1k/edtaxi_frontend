<script setup lang="ts">
import { useRoute as useVueRoute } from 'vue-router'
import { useSupportSocket } from '~/composables/useSupportSocket'
import { useAuthStore } from '~/stores/auth'
import { useSupportStore } from '~/stores/support'
import { formatTime, shortId } from '~/utils/format'
import {
  canClaimRoom,
  isAssignedTo,
  participantIcon as getParticipantIcon,
  participantLabel as getParticipantLabel,
  participantProfileLink as getParticipantProfileLink,
  paymentLabel,
  resolveSupportActionHint,
  roomStatusLabel as getRoomStatusLabel,
  tripFare,
  tripStatusLabel,
} from '~/utils/support'

const route = useVueRoute()
const router = useRouter()
const support = useSupportStore()
const auth = useAuthStore()
const socket = useSupportSocket()
const roomId = computed(() => (route.params as Record<string, string>).id)
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const isAssigned = computed(() => isAssignedTo(support.currentRoom, auth.currentUser?.id))
const canClaim = computed(() => canClaimRoom(support.currentRoom, auth.currentUser?.id))

async function claim() {
  try {
    await support.claimRoom(roomId.value)
  }
  catch {}
}

async function closeAsResolved() {
  const room = support.currentRoom
  if (!room || support.isMutating)
    return

  try {
    await support.closeRoom(room)
    await support.loadMessages(room.id).catch(() => {})
    scrollToBottom()
  }
  catch {}
}

const roomStatusLabel = computed(() => getRoomStatusLabel(support.currentRoom?.status))
const participantLabel = computed(() => getParticipantLabel(support.currentRoom?.participant_type))
const participantProfileLink = computed(() => getParticipantProfileLink(support.currentRoom))

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Чат поддержки | EdTaxi',
})

async function openRoom(id: string) {
  const room = await support.loadRoom(id).catch(() => null)
  if (!room) {
    await router.push('/support')
    return
  }
  await support.loadMessages(id).catch(() => {})
  scrollToBottom()
}

onMounted(async () => {
  await openRoom(roomId.value)
  socket.connect()
})

// Компонент маршрута переиспользуется при переходе между обращениями
// (меняется только :id, onMounted не срабатывает повторно) — иначе на экране
// осталась бы переписка предыдущей комнаты до перезагрузки страницы.
watch(roomId, (id, prev) => {
  if (id && id !== prev)
    openRoom(id)
})

watch(() => support.messages.length, scrollToBottom)

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value)
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

function isMyMessage(senderId: string) {
  return auth.currentUser?.id === senderId
}

async function send() {
  const content = draft.value.trim()
  if (!content || support.isSending || !canReply.value)
    return
  try {
    await support.sendMessage(roomId.value, content)
    draft.value = ''
    scrollToBottom()
  }
  catch {}
}

const isClosed = computed(() => support.currentRoom?.status === 'closed')
const isPendingClose = computed(() => support.currentRoom?.status === 'pending_close')
const canReply = computed(() => isAssigned.value && !isClosed.value && !isPendingClose.value)

const participantIcon = computed(() => getParticipantIcon(support.currentRoom?.participant_type))

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
  hasAgent: !!support.currentRoom?.agent_id,
}))

// Прикреплённая к обращению поездка — чтобы агент видел, о какой поездке речь.
const attachedTrip = computed(() => support.currentRoom?.trip ?? null)
const messageCount = computed(() => support.messages.length)

const participantPrimary = computed(() => {
  return support.currentRoom?.participant_name || participantLabel.value
})

const participantSecondary = computed(() => {
  return support.currentRoom?.participant_phone || support.currentRoom?.passenger_id || roomId.value
})

</script>

<template>
  <main class="h-screen flex flex-col bg-secondary-900 text-white">
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
            <span :class="participantIcon" class="text-5.5" aria-hidden="true" />
          </div>

          <div class="min-w-0">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <RouterLink
                v-if="participantProfileLink"
                :to="participantProfileLink"
                class="min-w-0 truncate text-base text-cyan-100 font-950 hover:underline"
              >
                {{ participantPrimary }}
              </RouterLink>
              <p v-else class="min-w-0 truncate text-base font-950">
                {{ participantPrimary }}
              </p>
              <span
                class="inline-flex items-center border rounded-lg px-2 py-0.5 text-xs font-900"
                :class="statusToneClass"
              >
                {{ roomStatusLabel }}
              </span>
            </div>
            <div class="mt-0.5 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-white/45 font-800">
              <span class="truncate">{{ participantSecondary }}</span>
              <span>{{ participantLabel }}</span>
              <span>ID {{ shortId(roomId) }}</span>
              <span>{{ messageCount }} сообщ.</span>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            v-if="!isAssigned && canClaim"
            :disabled="support.isMutating"
            class="h-10 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm text-#06142f font-900 transition hover:bg-cyan-200 active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="claim"
          >
            <span class="i-mdi-hand-back-right-outline text-5" aria-hidden="true" />
            {{ support.isMutating ? 'Берём...' : 'Взять в работу' }}
          </button>

          <button
            v-if="isAssigned && !isClosed && !isPendingClose"
            :disabled="support.isMutating"
            class="h-10 inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 text-sm text-red-200 font-900 transition hover:bg-red-500/25 active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="closeAsResolved"
          >
            <span class="i-mdi-check-circle-outline text-5" aria-hidden="true" />
            {{ support.isMutating ? 'Отправляем...' : 'Решено' }}
          </button>
        </div>
      </div>

      <div
        v-if="support.errorMessage"
        class="mx-auto mt-3 max-w-5xl border border-red-400/20 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-100 font-800"
      >
        {{ support.errorMessage }}
      </div>
    </header>

    <section class="min-h-0 flex-1 px-4 py-4">
      <div class="mx-auto h-full max-w-6xl grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside class="min-h-0 overflow-y-auto border border-white/10 rounded-lg bg-white/6 p-3">
          <div
            v-if="support.currentRoom"
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
                <span :class="participantIcon" class="text-5" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-950">
                  {{ participantPrimary }}
                </p>
                <p class="mt-0.5 truncate text-xs text-white/45 font-800">
                  {{ participantSecondary }}
                </p>
              </div>
            </div>
            <RouterLink
              v-if="participantProfileLink"
              :to="participantProfileLink"
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
            <div class="mt-3 space-y-2 text-sm font-800">
              <div class="flex items-center justify-between gap-3">
                <span class="text-white/45">Статус</span>
                <span class="border rounded-lg px-2 py-0.5 text-xs font-900" :class="statusToneClass">
                  {{ roomStatusLabel }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-white/45">Назначение</span>
                <span :class="isAssigned ? 'text-emerald-200' : 'text-amber-200'">
                  {{ isAssigned ? 'Вы' : support.currentRoom?.agent_id ? 'Другой агент' : 'Свободно' }}
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
            <p class="mt-3 text-sm leading-5 text-white/78 font-800">
              {{ attachedTrip.pickup_address || 'Адрес подачи не указан' }}
            </p>
            <p class="mt-1 text-sm leading-5 text-white/78 font-800">
              {{ attachedTrip.dropoff_address || 'Адрес назначения не указан' }}
            </p>
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-white/45 font-800">
              <span>{{ tripFare(attachedTrip) }}</span>
              <span>{{ paymentLabel(attachedTrip.payment_method) }}</span>
              <span>{{ formatTime(attachedTrip.created_at) }}</span>
              <span>ID {{ shortId(attachedTrip.id) }}</span>
            </div>
          </div>
        </aside>

        <div class="min-h-0 flex flex-col overflow-hidden border border-white/10 rounded-lg bg-white/5">
          <div class="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-950">
                Переписка
              </p>
              <p class="mt-0.5 text-xs text-white/42 font-800">
                Enter отправляет ответ · после “Решено” ждём ответ клиента
              </p>
            </div>
            <span class="hidden items-center gap-2 text-xs text-white/45 font-800 sm:inline-flex">
              <span class="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.5)]" aria-hidden="true" />
              Live
            </span>
          </div>

          <div
            ref="messagesEl"
            class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            <div v-if="support.isLoadingMessages" class="space-y-3">
              <div v-for="i in 6" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
                <div class="h-14 w-56 animate-pulse rounded-lg bg-white/6" />
              </div>
            </div>

            <div
              v-else-if="!support.messages.length"
              class="min-h-60 flex flex-col items-center justify-center gap-2 text-center"
            >
              <span class="i-mdi-chat-outline text-12 text-white/15" aria-hidden="true" />
              <p class="text-sm text-slate-500">
                Сообщений пока нет
              </p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="msg in support.messages"
                :key="msg.id"
                class="flex"
                :class="isMyMessage(msg.sender_id) ? 'justify-end' : 'justify-start'"
              >
                <article
                  class="max-w-[88%] rounded-lg px-4 py-2.5 shadow-sm md:max-w-[68%]"
                  :class="isMyMessage(msg.sender_id)
                    ? 'bg-main-500 text-white'
                    : 'border border-white/8 bg-white/8 text-white'"
                >
                  <p class="whitespace-pre-wrap text-sm leading-[1.55]">
                    {{ msg.content }}
                  </p>
                  <p
                    class="mt-1 text-[11px] font-700"
                    :class="isMyMessage(msg.sender_id) ? 'text-right text-main-100/60' : 'text-slate-500'"
                  >
                    {{ formatTime(msg.sent_at) }}
                  </p>
                </article>
              </div>
            </div>
          </div>

          <form class="border-t border-white/8 bg-secondary-900/80 p-3" @submit.prevent="send">
            <div class="flex items-end gap-2">
              <textarea
                v-model="draft"
                aria-label="Ответ в чат поддержки"
                :disabled="!canReply"
                class="max-h-36 min-h-12 min-w-0 flex-1 resize-none border border-white/10 rounded-lg bg-white/7 px-4 py-3 text-sm outline-none transition placeholder:text-white/35 focus:border-main-400/60 focus:bg-white/10 disabled:opacity-45"
                maxlength="2000"
                name="support_reply"
                rows="1"
                :placeholder="isClosed ? 'Чат закрыт' : isPendingClose ? 'Ждём подтверждение пользователя' : isAssigned ? 'Написать ответ...' : support.currentRoom?.agent_id ? 'Взято другим агентом' : 'Возьмите обращение в работу'"
                @keydown.enter.exact.prevent="send"
              />
              <button
                aria-label="Отправить ответ"
                :disabled="!draft.trim() || !canReply || support.isSending"
                class="h-12 w-12 flex shrink-0 items-center justify-center rounded-lg bg-main-500 text-white transition hover:bg-main-400 active:scale-[0.97] disabled:opacity-40"
                type="submit"
              >
                <span class="i-mdi-send text-5" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  </main>
</template>
