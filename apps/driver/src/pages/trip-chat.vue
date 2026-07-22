<script setup lang="ts">
import { mediaUrl } from '~/api/client'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useAuthStore } from '~/stores/auth'
import { useDriverStore } from '~/stores/driver'
import { useTripChatStore } from '~/stores/tripChat'

const router = useRouter()
const auth = useAuthStore()
const driver = useDriverStore()
const tripChat = useTripChatStore()
const notifications = useNotificationsSocket()

const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Чат с пассажиром | Telegram Taxi Driver',
})

const activeTrip = computed(() => driver.activeTrip)
const chatOpen = computed(() => {
  const status = activeTrip.value?.status
  return status === 'driver_assigned' || status === 'driver_arriving' || status === 'in_progress'
})

onMounted(async () => {
  if (!driver.activeTrip)
    await driver.restoreActiveTrip().catch(() => {})
  if (!driver.activeTrip) {
    router.replace('/map')
    return
  }
  notifications.connect()
  await tripChat.openChat(driver.activeTrip.id)
  scrollToBottom()
})

onBeforeUnmount(() => {
  tripChat.closeChat()
})

watch(() => tripChat.messages.length, scrollToBottom)

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value)
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function isMyMessage(senderId: string) {
  return auth.currentUser?.id === senderId
}

async function send() {
  const content = draft.value.trim()
  if (!content || tripChat.isSending)
    return
  draft.value = ''
  await tripChat.sendMessage(content).catch(() => {})
  scrollToBottom()
}

function triggerPhoto() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // позволяем повторно выбрать тот же файл
  if (!file)
    return
  await tripChat.uploadImage(file).catch(() => {})
  scrollToBottom()
}
</script>

<template>
  <main class="tg-safe-x tg-safe-screen h-full flex flex-col app-screen pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+0.75rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <!-- Header -->
      <div class="mb-3 flex shrink-0 items-center gap-2">
        <button
          aria-label="Назад к заказу"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full app-chip transition active:scale-95"
          type="button"
          @click="router.back()"
        >
          <span class="i-mdi-arrow-left text-5" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-900">
            Пассажир
          </p>
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="chatOpen ? 'bg-emerald-400' : 'bg-slate-500'" />
            <p class="text-xs app-muted font-700">
              {{ chatOpen ? 'Чат поездки' : 'Поездка завершена — чат закрыт' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesEl" class="min-h-0 flex-1 overflow-y-auto rounded-3xl app-card p-4">
        <div v-if="tripChat.isLoading && !tripChat.messages.length" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
            <div class="h-12 animate-pulse rounded-3xl app-chip" :class="[i % 2 === 0 ? 'rounded-br-md w-44' : 'rounded-bl-md w-56']" />
          </div>
        </div>

        <div v-else-if="!tripChat.messages.length" class="h-full min-h-60 flex flex-col items-center justify-center gap-3 text-center">
          <span class="i-mdi-message-text text-16 text-white/10" />
          <p class="text-sm app-muted">
            Напишите пассажиру — например, уточните, где он находится.
          </p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="msg in tripChat.messages"
            :key="msg.id"
            class="flex"
            :class="isMyMessage(msg.sender_id) ? 'justify-end' : 'justify-start'"
          >
            <article
              class="max-w-[78%] rounded-3xl px-4 py-2.5"
              :class="isMyMessage(msg.sender_id) ? 'rounded-br-md bg-main-500 text-white' : 'rounded-bl-md bg-white/10 text-white'"
            >
              <a
                v-if="msg.image_url"
                :href="mediaUrl(msg.image_url)"
                target="_blank"
                rel="noopener"
              >
                <img
                  :src="mediaUrl(msg.image_url)"
                  alt="Вложение"
                  class="max-h-60 w-full rounded-2xl object-cover"
                  loading="lazy"
                >
              </a>
              <p v-if="msg.content" class="text-sm leading-[1.5]" :class="{ 'mt-2': msg.image_url }">
                {{ msg.content }}
              </p>
              <p class="mt-1 text-[11px] font-700" :class="isMyMessage(msg.sender_id) ? 'text-right text-white/50' : 'app-faint'">
                {{ formatTime(msg.sent_at) }}
              </p>
            </article>
          </div>
        </div>
      </div>

      <!-- Input -->
      <form v-if="chatOpen" class="grid grid-cols-[auto_1fr_auto] mt-3 shrink-0 items-center gap-2" @submit.prevent="send">
        <input ref="fileInput" accept="image/*" class="hidden" type="file" @change="onFileSelected">
        <button
          aria-label="Прикрепить фото"
          :disabled="tripChat.isSending"
          class="h-13 w-13 flex items-center justify-center rounded-2xl app-chip text-white transition active:scale-[0.97] disabled:opacity-50"
          type="button"
          @click="triggerPhoto"
        >
          <span class="i-mdi-paperclip text-5" />
        </button>
        <input
          v-model="draft"
          aria-label="Сообщение пассажиру"
          class="h-13 min-w-0 border app-border rounded-2xl app-card px-4 text-sm outline-none transition focus:border-main-400/60"
          maxlength="2000"
          name="trip_chat_message"
          placeholder="Напишите сообщение..."
          @keydown.enter.exact.prevent="send"
        >
        <button
          aria-label="Отправить сообщение"
          :disabled="!draft.trim() || tripChat.isSending"
          class="h-13 w-13 flex items-center justify-center rounded-2xl bg-main-500 text-white transition active:scale-[0.97] disabled:opacity-50"
          type="submit"
        >
          <span class="i-mdi-send text-5" />
        </button>
      </form>

      <button
        v-else
        class="mt-3 h-13 shrink-0 rounded-2xl bg-main-500 text-sm text-white font-900 transition active:scale-[0.98]"
        type="button"
        @click="router.replace('/map')"
      >
        К карте
      </button>
    </section>
  </main>
</template>
