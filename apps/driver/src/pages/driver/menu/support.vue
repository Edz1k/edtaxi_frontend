<script setup lang="ts">
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useSupportStore } from '~/stores/support'

definePage({
  meta: {
    authRedirect: '/driver/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Поддержка',
  },
})

useHead({
  title: 'Поддержка | EdTaxi',
})

const support = useSupportStore()
const notifications = useNotificationsSocket()
const draft = ref('')

onMounted(async () => {
  await support.ensureRoom('driver').catch(() => {})
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
  await support.sendMessage(message, 'driver')
}

const isClosed = computed(() => support.room ? support.room.status !== 'open' : false)
</script>

<template>
  <main class="tg-safe-x h-full flex flex-col bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <header class="shrink-0">
        <div class="flex items-center gap-2">
          <span class="i-mdi-telegram text-5 text-main-300" />
          <p class="text-xs text-main-300 font-900 uppercase">
            Telegram Taxi
          </p>
        </div>
        <h1 class="mt-1 text-3xl font-950">
          Поддержка
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Обращение {{ isClosed ? 'закрыто' : 'открыто' }}
        </p>
      </header>

      <section class="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/5 p-4">
        <div v-if="support.isLoading && !support.messages.length" class="space-y-3">
          <div v-for="item in 5" :key="item" class="h-14 animate-pulse rounded-2xl bg-white/6" />
        </div>

        <div v-else-if="!support.messages.length" class="h-full min-h-80 flex items-center justify-center text-center text-sm text-slate-400">
          Напишите вопрос, и оператор увидит ваше обращение.
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="message in support.messages"
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
          aria-label="Сообщение в поддержку"
          :disabled="isClosed"
          class="h-13 min-w-0 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none focus:border-main-400 disabled:opacity-60"
          maxlength="2000"
          name="support_message"
          placeholder="Сообщение"
        >
        <button
          aria-label="Отправить сообщение"
          :disabled="support.isSending || !draft.trim() || isClosed"
          class="h-13 w-13 flex items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          <span class="i-mdi-send text-5" />
        </button>
      </form>
    </section>
  </main>
</template>
