<script setup lang="ts">
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useParkChatStore } from '~/stores/parkChat'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Чат с парком',
  },
})

useHead({
  title: 'Чат с парком | EdTaxi',
})

const parkChat = useParkChatStore()
const notifications = useNotificationsSocket()
const draft = ref('')
// Комнату не удалось открыть (например, водитель не состоит в парке).
const openError = ref('')

onMounted(async () => {
  openError.value = ''
  try {
    await parkChat.ensureRoom()
  }
  catch {
    openError.value = parkChat.errorMessage || 'Не удалось открыть чат с таксопарком.'
    return
  }
  notifications.connect()
})

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function send() {
  const message = draft.value
  draft.value = ''
  await parkChat.sendMessage(message)
}

async function closeChat() {
  if (parkChat.isLoading)
    return
  await parkChat.closeRoom()
}

const isClosed = computed(() => parkChat.room?.status === 'closed')
</script>

<template>
  <main class="tg-safe-x h-full flex flex-col bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <header class="shrink-0">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="i-mdi-office-building-marker text-5 text-main-300" />
              <p class="text-xs text-main-300 font-900 uppercase">
                Таксопарк
              </p>
            </div>
            <h1 class="mt-1 text-3xl font-950">
              Чат с парком
            </h1>
            <p class="mt-1 text-sm text-slate-400">
              {{ isClosed ? 'Чат закрыт' : 'Вопросы по работе в парке' }}
            </p>
          </div>
          <button
            v-if="parkChat.room && !isClosed"
            aria-label="Закрыть чат"
            :disabled="parkChat.isLoading"
            class="h-11 shrink-0 rounded-2xl bg-white/8 px-4 text-xs text-slate-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="closeChat"
          >
            Закрыть чат
          </button>
        </div>
      </header>

      <!-- Не удалось открыть комнату (например, водитель не в парке) -->
      <div v-if="openError && !parkChat.room" class="mt-6 rounded-3xl bg-white/5 px-5 py-8 text-center">
        <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-amber-500/16 text-amber-300">
          <span class="i-mdi-office-building text-8" />
        </div>
        <p class="mt-4 text-sm text-slate-400 leading-5">
          {{ openError }}
        </p>
        <RouterLink
          class="mt-4 h-12 inline-flex items-center justify-center rounded-2xl bg-main-500 px-6 text-sm font-950 transition active:scale-[0.98]"
          to="/menu/park-invite"
        >
          Вступить в парк
        </RouterLink>
      </div>

      <template v-else>
        <section class="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/5 p-4">
          <div v-if="parkChat.isLoading && !parkChat.messages.length" class="space-y-3">
            <div v-for="item in 5" :key="item" class="h-14 animate-pulse rounded-2xl bg-white/6" />
          </div>

          <div v-else-if="!parkChat.messages.length" class="h-full min-h-80 flex items-center justify-center text-center text-sm text-slate-400">
            Напишите сообщение — владелец парка увидит его.
          </div>

          <div v-else class="space-y-3">
            <article
              v-for="message in parkChat.messages"
              :key="message.id"
              class="rounded-2xl bg-secondary-950/70 p-3"
            >
              <p class="text-sm leading-5">
                {{ message.content }}
              </p>
              <p class="mt-2 text-right text-[11px] text-slate-500 font-800">
                {{ formatTime(message.sent_at) }}
              </p>
            </article>
          </div>
        </section>

        <form class="grid grid-cols-[1fr_auto] mt-3 shrink-0 gap-2" @submit.prevent="send">
          <input
            v-model="draft"
            aria-label="Сообщение таксопарку"
            :disabled="isClosed"
            class="h-13 min-w-0 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none focus:border-main-400 disabled:opacity-60"
            maxlength="2000"
            name="park_chat_message"
            placeholder="Сообщение"
          >
          <button
            aria-label="Отправить сообщение"
            :disabled="parkChat.isSending || !draft.trim() || isClosed"
            class="h-13 w-13 flex items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.98] disabled:opacity-60"
            type="submit"
          >
            <span class="i-mdi-send text-5" />
          </button>
        </form>
      </template>
    </section>
  </main>
</template>
