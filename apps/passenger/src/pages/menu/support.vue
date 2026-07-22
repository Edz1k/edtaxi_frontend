<script setup lang="ts">
import type { SupportRoom, SupportSubject } from '~/types/support'
import { mediaUrl } from '~/api/client'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useAuthStore } from '~/stores/auth'
import { usePassengerStore } from '~/stores/passenger'
import { useSupportStore } from '~/stores/support'
import { PASSENGER_SUPPORT_SUBJECTS, SUPPORT_SUBJECT_LABELS, supportSubjectLabel } from '~/types/support'

const support = useSupportStore()
const auth = useAuthStore()
const passenger = usePassengerStore()
const notifications = useNotificationsSocket()
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isPicking = ref(false)
const welcomedRoomIds = ref(new Set<string>())
const isWelcomeVisible = ref(false)
const welcomeSentAt = ref(new Date().toISOString())
let welcomeRevealTimer: ReturnType<typeof setTimeout> | undefined

const WELCOMED_ROOMS_STORAGE_KEY = 'edtaxi:passenger-support-welcomed-rooms'
const activeRoom = computed(() => support.activeRoom)
const hasWelcomeMessage = computed(() => Boolean(activeRoom.value && welcomedRoomIds.value.has(activeRoom.value.id)))

const subjects = PASSENGER_SUPPORT_SUBJECTS

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
  title: 'Поддержка | Telegram Taxi',
})

onMounted(async () => {
  restoreWelcomedRooms()
  await Promise.all([
    support.loadRooms('passenger').catch(() => {}),
    passenger.profile ? Promise.resolve() : passenger.loadProfile().catch(() => {}),
  ])
  // Если тред уже выбран (напр. пришли из истории «связаться по поездке»),
  // подгрузим его сообщения; иначе показываем список обращений.
  if (support.activeRoom)
    await support.loadMessages().catch(() => {})
  rememberWelcomeForEmptyRoom()
  scrollToBottom()
  notifications.connect()
})

onBeforeUnmount(() => {
  if (welcomeRevealTimer)
    clearTimeout(welcomeRevealTimer)
})

watch(() => support.messages.length, scrollToBottom)
watch([() => support.activeRoom?.id, () => support.isLoading], rememberWelcomeForEmptyRoom)
watch(() => support.activeRoom?.id, () => {
  isPicking.value = false
  isWelcomeVisible.value = false
  scrollToBottom()
})

function restoreWelcomedRooms() {
  try {
    const saved = JSON.parse(localStorage.getItem(WELCOMED_ROOMS_STORAGE_KEY) || '[]')
    if (Array.isArray(saved))
      welcomedRoomIds.value = new Set(saved.filter(value => typeof value === 'string'))
  }
  catch {}
}

function rememberWelcomeForEmptyRoom() {
  const roomId = support.activeRoom?.id
  if (!roomId || support.isLoading || support.messages.length > 0 || welcomedRoomIds.value.has(roomId))
    return

  const next = new Set(welcomedRoomIds.value)
  next.add(roomId)
  welcomedRoomIds.value = next
  try {
    localStorage.setItem(WELCOMED_ROOMS_STORAGE_KEY, JSON.stringify([...next]))
  }
  catch {}
}

function scheduleWelcomeReveal() {
  if (welcomeRevealTimer)
    clearTimeout(welcomeRevealTimer)

  isWelcomeVisible.value = false
  const roomId = activeRoom.value?.id
  if (!roomId || !hasWelcomeMessage.value)
    return

  welcomeRevealTimer = setTimeout(() => {
    if (activeRoom.value?.id !== roomId)
      return
    welcomeSentAt.value = new Date().toISOString()
    isWelcomeVisible.value = true
    scrollToBottom()
  }, 650)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value)
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function isMyMessage(senderId: string) {
  return auth.currentUser?.id === senderId
}

function statusLabel(room: SupportRoom) {
  if (room.status === 'closed')
    return 'Закрыто'
  if (room.status === 'pending_close')
    return 'Подтвердите'
  return 'Открыто'
}

async function pickCategory(subject: SupportSubject) {
  isPicking.value = false
  await support.openRoom(subject, 'passenger').catch(() => {})
  scrollToBottom()
}

async function send() {
  const content = draft.value.trim()
  if (!content || support.isSending)
    return
  draft.value = ''
  await support.sendMessage(content)
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
  await support.uploadImage(file).catch(() => {})
  scrollToBottom()
}

// pending_close — агент завершает обращение и ждёт подтверждения: «да» закрывает,
// иначе диалог продолжается.
async function confirmClose(resolved: boolean) {
  if (support.isSending)
    return
  await support.sendMessage(resolved ? 'да' : 'Нет, проблема не решена')
  scrollToBottom()
}

const isClosed = computed(() => activeRoom.value?.status === 'closed')
const isPendingClose = computed(() => activeRoom.value?.status === 'pending_close')
const agentLabel = computed(() => activeRoom.value?.agent_name ? `Оператор ${activeRoom.value.agent_name}` : 'Поддержка на связи')
const showWelcomeMessage = computed(() => hasWelcomeMessage.value && isWelcomeVisible.value)
const passengerFirstName = computed(() => passenger.profile?.first_name?.trim() || '')
const welcomeMessage = computed(() => passengerFirstName.value
  ? `Здравствуйте, ${passengerFirstName.value}! Расскажите, пожалуйста, что произошло. Мы внимательно разберёмся и постараемся помочь как можно скорее.`
  : 'Здравствуйте! Расскажите, пожалуйста, что произошло. Мы внимательно разберёмся и постараемся помочь как можно скорее.')

watch([() => activeRoom.value?.id, hasWelcomeMessage], scheduleWelcomeReveal, { immediate: true, flush: 'post' })
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full flex flex-col bg-[#050607] pb-[calc(var(--app-safe-area-bottom)+1rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <!-- ===================== СПИСОК ОБРАЩЕНИЙ ===================== -->
      <template v-if="!activeRoom">
        <div class="mb-3 flex shrink-0 items-center justify-between gap-2">
          <p class="text-sm text-slate-300 font-800">
            Мои обращения
          </p>
          <button
            :disabled="support.isLoading"
            class="h-9 rounded-xl bg-main-500 px-3 text-xs text-white font-900 transition active:scale-[0.97] disabled:opacity-50"
            type="button"
            @click="isPicking = !isPicking"
          >
            + Новое
          </button>
        </div>

        <!-- Выбор темы -->
        <div v-if="isPicking" class="mb-3 shrink-0 rounded-2xl bg-white/6 p-3">
          <p class="mb-2 text-xs text-slate-400 font-800 uppercase">
            Выберите тему обращения
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="s in subjects"
              :key="s"
              :disabled="support.isLoading"
              class="h-11 rounded-xl bg-white/8 text-sm font-800 transition active:scale-[0.97] hover:bg-white/12 disabled:opacity-50"
              type="button"
              @click="pickCategory(s)"
            >
              {{ SUPPORT_SUBJECT_LABELS[s] }}
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="support.isLoading && !support.rooms.length" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-2xl bg-white/6" />
          </div>

          <div
            v-else-if="!support.rooms.length"
            class="h-full min-h-60 flex flex-col items-center justify-center gap-3 text-center"
          >
            <span class="i-mdi-headset text-16 text-white/10" />
            <p class="text-sm text-slate-400">
              У вас пока нет обращений. Нажмите «Новое», чтобы задать вопрос.
            </p>
          </div>

          <div v-else class="space-y-2">
            <button
              v-for="room in support.rooms"
              :key="room.id"
              class="w-full flex items-center gap-3 rounded-2xl bg-white/6 p-3 text-left transition active:scale-[0.99] hover:bg-white/10"
              type="button"
              @click="support.selectRoom(room)"
            >
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :class="room.status === 'closed' ? 'bg-slate-500' : room.status === 'pending_close' ? 'bg-amber-400' : 'bg-emerald-400'"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-900">
                  {{ supportSubjectLabel(room.subject) }}
                </p>
                <p class="mt-0.5 text-xs text-slate-400">
                  {{ formatDay(room.updated_at) }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-lg px-2 py-1 text-[11px] font-800"
                :class="room.status === 'closed' ? 'bg-white/8 text-slate-400' : room.status === 'pending_close' ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/12 text-emerald-300'"
              >
                {{ statusLabel(room) }}
              </span>
            </button>
          </div>
        </div>
      </template>

      <!-- ===================== ТРЕД ОБРАЩЕНИЯ ===================== -->
      <template v-else>
        <!-- Header -->
        <div class="mb-3 flex shrink-0 items-center gap-3 px-1">
          <button
            aria-label="К списку обращений"
            class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-slate-200 transition active:scale-95"
            type="button"
            @click="support.closeThread()"
          >
            <span class="i-mdi-arrow-left text-5.5" />
          </button>
          <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full from-main-400 to-main-600 bg-gradient-to-br text-[#12100a] shadow-[0_8px_22px_rgba(230,173,46,0.18)]">
            <span class="i-mdi-headset text-5.5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15px] font-950">
              Telegram Taxi Support
            </p>
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" :class="isClosed ? 'bg-slate-500 text-slate-500' : 'bg-emerald-400 text-emerald-400'" />
              <p class="truncate text-xs text-slate-400 font-700">
                {{ isClosed ? 'Обращение закрыто' : agentLabel }}
              </p>
            </div>
          </div>
          <span class="max-w-22 truncate rounded-full bg-white/6 px-2.5 py-1 text-[10px] text-slate-400 font-800">
            {{ supportSubjectLabel(activeRoom.subject) }}
          </span>
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
        <div ref="messagesEl" class="support-chat relative min-h-0 flex-1 overflow-y-auto rounded-[1.75rem] bg-[#08090b] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <div class="pointer-events-none absolute inset-0 flex flex-col select-none items-center justify-center overflow-hidden text-center" aria-hidden="true">
            <div class="flex flex-col items-center text-white/[0.022]">
              <span class="i-mdi-send-circle-outline mb-3 text-15" />
              <span class="text-[25px] font-950 leading-7 tracking-[0.16em] uppercase">Telegram Taxi</span>
              <span class="mt-2 text-[10px] font-800 tracking-[0.5em] uppercase">Support</span>
            </div>
          </div>

          <div v-if="support.isLoading && !support.messages.length" class="space-y-3">
            <div v-for="i in 5" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
              <div class="h-12 animate-pulse rounded-[1.35rem] bg-white/6" :class="[i % 2 === 0 ? 'rounded-br-md w-44' : 'rounded-bl-md w-56']" />
            </div>
          </div>

          <div v-else class="relative min-h-full flex flex-col justify-end">
            <div v-if="showWelcomeMessage" class="support-welcome mb-2 flex items-end gap-2">
              <span class="mb-0.5 h-7 w-7 flex shrink-0 items-center justify-center rounded-full bg-main-500/14 text-main-300">
                <span class="i-mdi-headset text-4" aria-hidden="true" />
              </span>
              <article class="max-w-[82%] border border-white/6 rounded-[1.35rem] rounded-bl-[0.35rem] bg-[#181a1e] px-3.5 py-2.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.2)]">
                <p class="text-[14px] leading-[1.45]">
                  {{ welcomeMessage }}
                </p>
                <p class="mt-1 text-[10px] text-slate-500 font-700">
                  {{ formatTime(welcomeSentAt) }}
                </p>
              </article>
            </div>

            <div v-if="!hasWelcomeMessage && !support.messages.length" class="h-full min-h-60 flex flex-col items-center justify-center gap-3 text-center">
              <span class="i-mdi-headset text-16 text-white/8" />
              <p class="max-w-60 text-sm text-slate-500 leading-5">
                Напишите вопрос — поддержка ответит в ближайшее время.
              </p>
            </div>

            <TransitionGroup v-else name="chat-message" tag="div" class="space-y-2">
              <div
                v-for="msg in support.messages"
                :key="msg.id"
                class="flex items-end gap-2"
                :class="isMyMessage(msg.sender_id) ? 'justify-end' : 'justify-start'"
              >
                <span
                  v-if="!isMyMessage(msg.sender_id)"
                  class="mb-0.5 h-7 w-7 flex shrink-0 items-center justify-center rounded-full bg-main-500/14 text-main-300"
                >
                  <span class="i-mdi-headset text-4" aria-hidden="true" />
                </span>
                <article
                  class="max-w-[82%] px-3.5 py-2.5 shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
                  :class="isMyMessage(msg.sender_id)
                    ? 'rounded-[1.35rem] rounded-br-[0.35rem] from-main-300 to-main-500 bg-gradient-to-br text-[#171207]'
                    : 'border border-white/6 rounded-[1.35rem] rounded-bl-[0.35rem] bg-[#181a1e] text-white'"
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
                      class="max-h-60 w-full rounded-[1rem] object-cover"
                      loading="lazy"
                    >
                  </a>
                  <p v-if="msg.content" class="text-[14px] leading-[1.45]" :class="{ 'mt-2': msg.image_url }">
                    {{ msg.content }}
                  </p>
                  <p
                    class="mt-1 text-[10px] font-750"
                    :class="isMyMessage(msg.sender_id) ? 'text-right text-[#171207]/55' : 'text-slate-500'"
                  >
                    {{ formatTime(msg.sent_at) }}
                  </p>
                </article>
              </div>
            </TransitionGroup>
          </div>
        </div>

        <!-- Закрытое обращение -->
        <button
          v-if="isClosed"
          :disabled="support.isLoading"
          class="mt-3 h-13 shrink-0 rounded-2xl bg-main-500 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          @click="support.closeThread()"
        >
          К списку обращений
        </button>

        <!-- Input -->
        <form v-else class="grid grid-cols-[auto_1fr_auto] mt-3 shrink-0 items-center gap-2" @submit.prevent="send">
          <input ref="fileInput" accept="image/*" class="hidden" type="file" @change="onFileSelected">
          <button
            aria-label="Прикрепить фото"
            :disabled="support.isSending"
            class="h-12 w-12 flex items-center justify-center rounded-full bg-[#15171a] text-slate-300 transition active:scale-[0.94] disabled:opacity-50"
            type="button"
            @click="triggerPhoto"
          >
            <span class="i-mdi-paperclip text-5.5" />
          </button>
          <div class="h-12 min-w-0 flex items-center border border-white/8 rounded-full bg-[#111316] px-4 transition focus-within:border-main-400/50 focus-within:bg-[#15171a]">
            <input
              v-model="draft"
              aria-label="Сообщение в поддержку"
              class="min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              maxlength="2000"
              name="support_message"
              placeholder="Сообщение..."
              @keydown.enter.exact.prevent="send"
            >
          </div>
          <button
            aria-label="Отправить сообщение"
            :disabled="!draft.trim() || support.isSending"
            class="h-12 w-12 flex items-center justify-center rounded-full from-main-300 to-main-500 bg-gradient-to-br text-[#171207] shadow-[0_8px_22px_rgba(230,173,46,0.18)] transition active:scale-[0.94] disabled:opacity-35 disabled:shadow-none"
            type="submit"
          >
            <span class="i-mdi-arrow-up text-6 font-950" />
          </button>
        </form>
      </template>
    </section>
  </main>
</template>

<style scoped>
.support-chat {
  scroll-behavior: smooth;
}

.support-welcome {
  animation: support-message-in 440ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.chat-message-enter-active {
  transition:
    opacity 240ms ease,
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.chat-message-enter-from {
  opacity: 0;
  transform: translateY(0.9rem) scale(0.96);
}

.chat-message-move {
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes support-message-in {
  from {
    opacity: 0;
    transform: translateY(0.9rem) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .support-chat {
    scroll-behavior: auto;
  }

  .support-welcome {
    animation-duration: 1ms;
  }

  .chat-message-enter-active,
  .chat-message-move {
    transition-duration: 1ms;
  }
}
</style>
