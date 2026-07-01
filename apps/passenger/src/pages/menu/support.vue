<script setup lang="ts">
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useAuthStore } from '~/stores/auth'
import { useSupportStore } from '~/stores/support'

const support = useSupportStore()
const auth = useAuthStore()
const notifications = useNotificationsSocket()
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Поддержка',
  },
})

useHead({
  title: 'Поддержка | EdTaxi',
})

onMounted(async () => {
  await support.ensureRoom().catch(() => {})
  scrollToBottom()
  notifications.connect()
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
  draft.value = ''
  await support.sendMessage(content)
  scrollToBottom()
}

// pending_close — агент завершает обращение и ждёт подтверждения: «да» закрывает,
// иначе диалог продолжается и возвращается в работу тому же агенту.
async function confirmClose(resolved: boolean) {
  if (support.isSending)
    return
  await support.sendMessage(resolved ? 'да' : 'Нет, проблема не решена')
  scrollToBottom()
}

const isClosed = computed(() => support.room?.status === 'closed')
const isPendingClose = computed(() => support.room?.status === 'pending_close')
const agentLabel = computed(() => support.room?.agent_name ? `Техподдержка ${support.room.agent_name}` : 'Оператор онлайн')
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full flex flex-col bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <!-- Status -->
      <div class="mb-3 flex shrink-0 items-center gap-2">
        <span
          class="h-2 w-2 rounded-full"
          :class="isClosed ? 'bg-slate-500' : 'bg-emerald-400'"
        />
        <p class="text-xs text-slate-400 font-700">
          {{ isClosed ? 'Обращение закрыто' : agentLabel }}
        </p>
      </div>

      <!-- Подтверждение закрытия -->
      <div v-if="isPendingClose" class="mb-3 shrink-0 rounded-2xl bg-amber-500/12 px-4 py-3">
        <p class="text-sm text-amber-200 font-800">
          Ваша проблема решена?
        </p>
        <div class="mt-2.5 flex gap-2">
          <button
            :disabled="support.isSending"
            class="h-10 flex-1 rounded-xl bg-emerald-400 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="confirmClose(true)"
          >
            Да, решена
          </button>
          <button
            :disabled="support.isSending"
            class="h-10 flex-1 rounded-xl bg-white/10 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="confirmClose(false)"
          >
            Нет
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div
        ref="messagesEl"
        class="min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/5 p-4"
      >
        <!-- Loading skeleton -->
        <div v-if="support.isLoading && !support.messages.length" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
            <div
              class="h-12 animate-pulse rounded-3xl bg-white/8"
              :class="[i % 2 === 0 ? 'rounded-br-md w-44' : 'rounded-bl-md w-56']"
            />
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!support.messages.length"
          class="h-full min-h-60 flex flex-col items-center justify-center gap-3 text-center"
        >
          <span class="i-mdi-headset text-16 text-white/10" />
          <p class="text-sm text-slate-400">
            Напишите вопрос — оператор ответит в ближайшее время.
          </p>
        </div>

        <!-- Messages list -->
        <div v-else class="space-y-2">
          <div
            v-for="msg in support.messages"
            :key="msg.id"
            class="flex"
            :class="isMyMessage(msg.sender_id) ? 'justify-end' : 'justify-start'"
          >
            <article
              class="max-w-[78%] rounded-3xl px-4 py-2.5"
              :class="isMyMessage(msg.sender_id)
                ? 'rounded-br-md bg-main-500 text-white'
                : 'rounded-bl-md bg-white/10 text-white'"
            >
              <p class="text-sm leading-[1.5]">
                {{ msg.content }}
              </p>
              <p
                class="mt-1 text-[11px] font-700"
                :class="isMyMessage(msg.sender_id) ? 'text-right text-white/50' : 'text-slate-500'"
              >
                {{ formatTime(msg.sent_at) }}
              </p>
            </article>
          </div>
        </div>
      </div>

      <!-- Input -->
      <form
        class="grid grid-cols-[1fr_auto] mt-3 shrink-0 gap-2"
        @submit.prevent="send"
      >
        <input
          v-model="draft"
          aria-label="Сообщение в поддержку"
          :disabled="isClosed"
          class="h-13 min-w-0 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none transition focus:border-main-400/60 disabled:opacity-50"
          maxlength="2000"
          name="support_message"
          :placeholder="isClosed ? 'Обращение закрыто' : 'Напишите сообщение...'"
          @keydown.enter.exact.prevent="send"
        >
        <button
          aria-label="Отправить сообщение"
          :disabled="!draft.trim() || isClosed || support.isSending"
          class="h-13 w-13 flex items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.97] disabled:opacity-50"
          type="submit"
        >
          <span class="i-mdi-send text-5" />
        </button>
      </form>
    </section>
  </main>
</template>
