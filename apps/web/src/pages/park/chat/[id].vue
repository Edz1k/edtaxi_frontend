<script setup lang="ts">
import { useRoute as useVueRoute } from 'vue-router'
import { useParkChatSocket } from '~/composables/useParkChatSocket'
import { useAuthStore } from '~/stores/auth'
import { useParkChatStore } from '~/stores/park-chat'
import { formatTime } from '~/utils/format'

const route = useVueRoute()
const router = useRouter()
const parkChat = useParkChatStore()
const auth = useAuthStore()
const socket = useParkChatSocket()
const roomId = computed(() => (route.params as Record<string, string>).id)
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const isClosed = computed(() => parkChat.currentRoom?.status === 'closed')

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Чат | Таксопарк',
})

onMounted(async () => {
  const room = await parkChat.loadRoom(roomId.value).catch(() => null)
  if (!room) {
    await router.push('/park/chat')
    return
  }
  await parkChat.loadMessages(roomId.value).catch(() => {})
  scrollToBottom()
  socket.connect()
})

watch(() => parkChat.messages.length, scrollToBottom)

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
  if (!content || parkChat.isSending)
    return
  try {
    await parkChat.sendMessage(roomId.value, content)
    draft.value = ''
    scrollToBottom()
  }
  catch {}
}

async function closeChat() {
  if (!parkChat.currentRoom) return
  await parkChat.closeRoom(parkChat.currentRoom).catch(() => {})
}
</script>

<template>
  <main class="h-screen flex flex-col bg-secondary-900 text-white">
    <!-- Header -->
    <header class="shrink-0 border-b border-white/8 bg-secondary-900/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto max-w-2xl flex items-center gap-3">
        <RouterLink
          aria-label="Вернуться к списку чатов"
          class="h-9 w-9 flex items-center justify-center rounded-xl bg-white/6 text-slate-300 transition hover:bg-white/10"
          to="/park/chat"
        >
          <span class="i-mdi-arrow-left text-5" />
        </RouterLink>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <div class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-main-500/20">
              <span class="i-mdi-steering text-4 text-main-300" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-900">
                Водитель
              </p>
              <p class="truncate text-[11px] text-slate-500 font-700 font-mono">
                {{ parkChat.currentRoom?.driver_id ?? roomId }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            class="rounded-xl px-2.5 py-1 text-xs font-900"
            :class="isClosed ? 'bg-white/8 text-slate-400' : 'bg-emerald-500/15 text-emerald-300'"
          >
            {{ isClosed ? 'Закрыт' : 'Открыт' }}
          </span>

          <button
            v-if="!isClosed"
            :disabled="parkChat.isMutating"
            class="h-9 rounded-xl bg-red-500/15 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
            type="button"
            @click="closeChat()"
          >
            Закрыть чат
          </button>
        </div>
      </div>
    </header>

    <!-- Messages -->
    <div
      ref="messagesEl"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <div class="mx-auto max-w-2xl">
        <div v-if="parkChat.isLoadingMessages" class="space-y-3">
          <div v-for="i in 6" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
            <div class="h-12 w-48 animate-pulse rounded-2xl bg-white/6" />
          </div>
        </div>

        <div
          v-else-if="!parkChat.messages.length"
          class="min-h-60 flex flex-col items-center justify-center gap-2 text-center"
        >
          <span class="i-mdi-chat-outline text-12 text-white/15" />
          <p class="text-sm text-slate-500">
            Сообщений пока нет
          </p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="msg in parkChat.messages"
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

    <!-- Input -->
    <div class="shrink-0 border-t border-white/8 bg-secondary-900/95 px-4 py-3 backdrop-blur">
      <form class="mx-auto max-w-2xl flex items-end gap-2" @submit.prevent="send()">
        <input
          v-model="draft"
          aria-label="Сообщение водителю"
          :disabled="isClosed"
          class="h-12 min-w-0 flex-1 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none transition focus:border-main-400/60 focus:bg-white/8 disabled:opacity-40"
          maxlength="2000"
          :placeholder="isClosed ? 'Чат закрыт' : 'Написать водителю...'"
          @keydown.enter.exact.prevent="send()"
        >
        <button
          aria-label="Отправить"
          :disabled="!draft.trim() || isClosed || parkChat.isSending"
          class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.97] hover:bg-main-400 disabled:opacity-40"
          type="submit"
        >
          <span class="i-mdi-send text-5" />
        </button>
      </form>
    </div>
  </main>
</template>
