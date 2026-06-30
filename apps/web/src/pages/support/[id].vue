<script setup lang="ts">
import { useRoute as useVueRoute } from 'vue-router'
import { useSupportSocket } from '~/composables/useSupportSocket'
import { useAuthStore } from '~/stores/auth'
import { useSupportStore } from '~/stores/support'

const route = useVueRoute()
const router = useRouter()
const support = useSupportStore()
const auth = useAuthStore()
const socket = useSupportSocket()
const roomId = computed(() => (route.params as Record<string, string>).id)
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const isAssigned = computed(() => {
  const room = support.currentRoom
  if (!room)
    return false
  return room.agent_id === auth.currentUser?.id
})

// Можно взять в работу открытое обращение, которое ещё не закреплено
// ни за кем (или уже за нами — повторный claim безопасен).
const canClaim = computed(() => {
  const room = support.currentRoom
  if (!room || room.status === 'closed')
    return false
  return !room.agent_id || room.agent_id === auth.currentUser?.id
})

async function claim() {
  try {
    await support.claimRoom(roomId.value)
  }
  catch {}
}

const roomStatusLabel = computed(() => {
  const status = support.currentRoom?.status

  if (status === 'pending_close')
    return 'На закрытии'

  return status === 'closed' ? 'Закрыто' : 'Открыто'
})

const participantLabel = computed(() => {
  return support.currentRoom?.participant_type === 'driver' ? 'Водитель' : 'Пассажир'
})

// Ссылка в кабинет участника: водителя — /drivers/:id, пассажира — /passengers/:id
// (passenger_id здесь — это user_id участника).
const participantProfileLink = computed(() => {
  const room = support.currentRoom
  if (!room?.passenger_id)
    return ''
  return room.participant_type === 'driver'
    ? `/drivers/${room.passenger_id}`
    : `/passengers/${room.passenger_id}`
})

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

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function isMyMessage(senderId: string) {
  return auth.currentUser?.id === senderId
}

async function send() {
  const content = draft.value.trim()
  if (!content || support.isSending)
    return
  try {
    await support.sendMessage(roomId.value, content)
    draft.value = ''
    scrollToBottom()
  }
  catch {}
}

const isClosed = computed(() => support.currentRoom?.status === 'closed')
</script>

<template>
  <main class="h-screen flex flex-col bg-secondary-900 text-white">
    <!-- Header bar -->
    <header class="shrink-0 border-b border-white/8 bg-secondary-900/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto max-w-2xl flex items-center gap-3">
        <RouterLink
          aria-label="Вернуться к списку обращений"
          class="h-9 w-9 flex items-center justify-center rounded-xl bg-white/6 text-slate-300 transition hover:bg-white/10"
          to="/support"
        >
          <span class="i-mdi-arrow-left text-5" />
        </RouterLink>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <div class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-main-500/20">
              <span :class="support.currentRoom?.participant_type === 'driver' ? 'i-mdi-steering' : 'i-mdi-account'" class="text-4 text-main-300" />
            </div>
            <div class="min-w-0">
              <RouterLink
                v-if="participantProfileLink"
                :to="participantProfileLink"
                class="flex items-center gap-1 truncate text-sm text-cyan-200 font-900 hover:underline"
              >
                {{ support.currentRoom?.participant_name || participantLabel }}
                <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" />
              </RouterLink>
              <p v-else class="truncate text-sm font-900">
                {{ support.currentRoom?.participant_name || participantLabel }}
              </p>
              <p class="truncate text-[11px] text-slate-500 font-700">
                {{ support.currentRoom?.participant_phone || support.currentRoom?.passenger_id || roomId }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            class="rounded-xl px-2.5 py-1 text-xs font-900"
            :class="support.currentRoom?.status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : support.currentRoom?.status === 'pending_close' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/8 text-slate-400'"
          >
            {{ roomStatusLabel }}
          </span>

          <button
            v-if="!isAssigned && canClaim"
            :disabled="support.isMutating"
            class="h-9 rounded-xl bg-cyan-300 px-3 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="claim"
          >
            Взять в работу
          </button>

          <button
            v-if="isAssigned && !isClosed"
            :disabled="support.isMutating"
            class="h-9 rounded-xl bg-red-500/15 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
            type="button"
            @click="support.currentRoom && support.closeRoom(support.currentRoom)"
          >
            Решено
          </button>
        </div>
      </div>

      <!-- Warning: assigned to someone else -->
      <div
        v-if="support.currentRoom?.agent_id && !isAssigned && !isClosed"
        class="mx-auto mt-2 max-w-2xl rounded-xl bg-amber-500/12 px-3 py-2 text-xs text-amber-300 font-700"
      >
        Обращение уже взял другой агент. Только он может отвечать.
      </div>
    </header>

    <!-- Messages area -->
    <div
      ref="messagesEl"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <div class="mx-auto max-w-2xl">
        <!-- Loading skeleton -->
        <div v-if="support.isLoadingMessages" class="space-y-3">
          <div v-for="i in 6" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
            <div class="h-12 w-48 animate-pulse rounded-2xl bg-white/6" :class="i % 2 === 0 ? 'rounded-br-sm' : 'rounded-bl-sm'" />
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!support.messages.length"
          class="min-h-60 flex flex-col items-center justify-center gap-2 text-center"
        >
          <span class="i-mdi-chat-outline text-12 text-white/15" />
          <p class="text-sm text-slate-500">
            Сообщений пока нет
          </p>
        </div>

        <!-- Messages -->
        <div v-else class="space-y-2">
          <div
            v-for="msg in support.messages"
            :key="msg.id"
            class="flex"
            :class="isMyMessage(msg.sender_id) ? 'justify-end' : 'justify-start'"
          >
            <article
              class="max-w-[72%] rounded-3xl px-4 py-2.5"
              :class="isMyMessage(msg.sender_id)
                ? 'rounded-br-lg bg-main-500 text-white'
                : 'rounded-bl-lg bg-white/10 text-white'"
            >
              <p class="text-sm leading-[1.55]">
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
    </div>

    <!-- Input bar -->
    <div class="shrink-0 border-t border-white/8 bg-secondary-900/95 px-4 py-3 backdrop-blur">
      <form class="mx-auto max-w-2xl flex items-end gap-2" @submit.prevent="send">
        <input
          v-model="draft"
          aria-label="Ответ в чат поддержки"
          :disabled="isClosed || !isAssigned"
          class="h-12 min-w-0 flex-1 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none transition focus:border-main-400/60 focus:bg-white/8 disabled:opacity-40"
          maxlength="2000"
          name="support_reply"
          :placeholder="isClosed ? 'Чат закрывается или закрыт' : isAssigned ? 'Написать ответ...' : support.currentRoom?.agent_id ? 'Взято другим агентом' : 'Возьмите обращение в работу'"
          @keydown.enter.exact.prevent="send"
        >
        <button
          aria-label="Отправить ответ"
          :disabled="!draft.trim() || !isAssigned || isClosed || support.isSending"
          class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.97] hover:bg-main-400 disabled:opacity-40"
          type="submit"
        >
          <span class="i-mdi-send text-5" />
        </button>
      </form>
    </div>
  </main>
</template>
