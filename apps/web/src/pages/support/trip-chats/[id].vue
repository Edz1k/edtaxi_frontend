<script setup lang="ts">
import type { TripChatMessage } from '~/types/trip-chats'
import { mediaUrl } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import { getTripChatMessages } from '~/api/trip-chats'
import WebPageShell from '~/components/app/WebPageShell.vue'

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['tech_support', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Чат поездки | EdTaxi',
})

const route = useRoute()
const tripId = computed(() => String((route.params as { id?: string }).id ?? ''))
// Кто в переписке пассажир — приходит из списка (?passenger=<uuid>), чтобы
// подписывать стороны без дополнительного запроса.
const passengerId = computed(() => typeof route.query.passenger === 'string' ? route.query.passenger : '')

const messages = ref<TripChatMessage[]>([])
const isLoading = ref(false)
let pollTimer: number | undefined

onMounted(async () => {
  await load()
  // Живое обновление простым поллингом: страница read-only, WS не нужен.
  pollTimer = window.setInterval(() => void load(true), 5000)
})

onBeforeUnmount(() => {
  if (pollTimer !== undefined)
    window.clearInterval(pollTimer)
})

async function load(silent = false) {
  if (!silent)
    isLoading.value = true
  try {
    const response = await getTripChatMessages(tripId.value)
    messages.value = response.messages
  }
  catch (error) {
    if (!silent)
      showErrorToast(error, 'Не удалось загрузить переписку.')
  }
  finally {
    isLoading.value = false
  }
}

function isPassenger(senderId: string) {
  return passengerId.value !== '' && senderId === passengerId.value
}

function senderLabel(senderId: string) {
  if (!passengerId.value)
    return ''
  return isPassenger(senderId) ? 'Пассажир' : 'Водитель'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <WebPageShell
    back-label="Чаты поездок"
    back-to="/support/trip-chats"
    description="Переписка внутри поездки. Только чтение — вмешаться можно через блокировку пользователя или чат поддержки."
    title="Чат поездки"
  >
    <div class="mt-5 border border-white/10 rounded-3xl bg-white/5 p-4">
      <div v-if="isLoading && !messages.length" class="space-y-3">
        <div v-for="i in 5" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
          <div class="h-12 animate-pulse rounded-3xl bg-white/8" :class="[i % 2 === 0 ? 'w-44' : 'w-56']" />
        </div>
      </div>

      <div v-else-if="!messages.length" class="py-10 text-center text-sm text-white/45">
        В этой поездке пока не переписывались.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex"
          :class="isPassenger(msg.sender_id) ? 'justify-start' : 'justify-end'"
        >
          <article
            class="max-w-[70%] rounded-3xl px-4 py-2.5"
            :class="isPassenger(msg.sender_id) ? 'rounded-bl-md bg-white/10' : 'rounded-br-md bg-cyan-300/14'"
          >
            <p v-if="senderLabel(msg.sender_id)" class="text-[11px] font-900" :class="isPassenger(msg.sender_id) ? 'text-white/45' : 'text-cyan-200/80'">
              {{ senderLabel(msg.sender_id) }}
            </p>
            <a
              v-if="msg.image_url"
              :href="mediaUrl(msg.image_url)"
              target="_blank"
              rel="noopener"
            >
              <img
                :src="mediaUrl(msg.image_url)"
                alt="Вложение"
                class="mt-1 max-h-72 w-full rounded-2xl object-cover"
                loading="lazy"
              >
            </a>
            <p v-if="msg.content" class="mt-1 text-sm text-white leading-[1.5]">
              {{ msg.content }}
            </p>
            <p class="mt-1 text-[11px] text-white/40 font-700">
              {{ formatTime(msg.sent_at) }}
            </p>
          </article>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
