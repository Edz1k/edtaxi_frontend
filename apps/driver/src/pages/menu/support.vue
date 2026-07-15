<script setup lang="ts">
import type { SupportRoom, SupportSubject } from '~/types/support'
import { mediaUrl } from '~/api/client'
import { useNotificationsSocket } from '~/composables/useNotificationsSocket'
import { useAuthStore } from '~/stores/auth'
import { useSupportStore } from '~/stores/support'
import { DRIVER_SUPPORT_SUBJECTS, SUPPORT_SUBJECT_LABELS, supportSubjectLabel } from '~/types/support'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Поддержка',
  },
})

useHead({
  title: 'Поддержка | Telegram Taxi',
})

const support = useSupportStore()
const auth = useAuthStore()
const notifications = useNotificationsSocket()
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isPicking = ref(false)

const subjects = DRIVER_SUPPORT_SUBJECTS

onMounted(async () => {
  await support.loadRooms('driver').catch(() => {})
  if (support.activeRoom)
    await support.loadMessages().catch(() => {})
  scrollToBottom()
  notifications.connect()
})

watch(() => support.messages.length, scrollToBottom)
watch(() => support.activeRoom?.id, () => {
  isPicking.value = false
  scrollToBottom()
})

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
  await support.openRoom(subject, 'driver').catch(() => {})
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
  input.value = ''
  if (!file)
    return
  await support.uploadImage(file).catch(() => {})
  scrollToBottom()
}

async function confirmClose(resolved: boolean) {
  if (support.isSending)
    return
  await support.sendMessage(resolved ? 'да' : 'Нет, проблема не решена')
  scrollToBottom()
}

const activeRoom = computed(() => support.activeRoom)
const isClosed = computed(() => activeRoom.value?.status === 'closed')
const isPendingClose = computed(() => activeRoom.value?.status === 'pending_close')
const agentLabel = computed(() => activeRoom.value?.agent_name ? `Техподдержка ${activeRoom.value.agent_name}` : 'открыто')
</script>

<template>
  <main class="tg-safe-x h-full flex flex-col bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm min-h-0 w-full flex flex-1 flex-col">
      <!-- ===================== СПИСОК ОБРАЩЕНИЙ ===================== -->
      <template v-if="!activeRoom">
        <header class="shrink-0">
          <div class="flex items-center gap-2">
            <span class="i-mdi-telegram text-5 text-main-300" />
            <p class="text-xs text-main-300 font-900 uppercase">
              Telegram Taxi
            </p>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2">
            <h1 class="text-3xl font-950">
              Поддержка
            </h1>
            <button
              :disabled="support.isLoading"
              class="h-9 rounded-xl bg-main-500 px-3 text-xs text-white font-900 transition active:scale-[0.97] disabled:opacity-50"
              type="button"
              @click="isPicking = !isPicking"
            >
              + Новое
            </button>
          </div>
        </header>

        <div v-if="isPicking" class="mt-4 shrink-0 rounded-2xl bg-white/6 p-3">
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

        <div class="mt-5 min-h-0 flex-1 overflow-y-auto">
          <div v-if="support.isLoading && !support.rooms.length" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-2xl bg-white/6" />
          </div>

          <div v-else-if="!support.rooms.length" class="h-full min-h-60 flex items-center justify-center text-center text-sm text-slate-400">
            У вас пока нет обращений. Нажмите «Новое», чтобы задать вопрос.
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
        <header class="flex shrink-0 items-center gap-2">
          <button
            aria-label="К списку обращений"
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 transition active:scale-95"
            type="button"
            @click="support.closeThread()"
          >
            <span class="i-mdi-arrow-left text-5" />
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-xl font-950">
              {{ supportSubjectLabel(activeRoom.subject) }}
            </h1>
            <p class="text-sm text-slate-400">
              {{ isClosed ? 'Обращение закрыто' : agentLabel }}
            </p>
          </div>
        </header>

        <!-- Подтверждение закрытия -->
        <div v-if="isPendingClose" class="mt-4 shrink-0 rounded-2xl bg-amber-500/12 px-4 py-3">
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

        <section ref="messagesEl" class="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/5 p-4">
          <div v-if="support.isLoading && !support.messages.length" class="space-y-3">
            <div v-for="item in 5" :key="item" class="h-14 animate-pulse rounded-2xl bg-white/6" />
          </div>

          <div v-else-if="!support.messages.length" class="h-full min-h-60 flex items-center justify-center text-center text-sm text-slate-400">
            Напишите вопрос, и оператор увидит ваше обращение.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="message in support.messages"
              :key="message.id"
              class="flex"
              :class="isMyMessage(message.sender_id) ? 'justify-end' : 'justify-start'"
            >
              <article
                class="max-w-[80%] rounded-2xl px-3 py-2.5"
                :class="isMyMessage(message.sender_id) ? 'bg-main-500 text-white' : 'bg-secondary-950/70 text-white'"
              >
                <a v-if="message.image_url" :href="mediaUrl(message.image_url)" target="_blank" rel="noopener">
                  <img
                    :src="mediaUrl(message.image_url)"
                    alt="Вложение"
                    class="max-h-60 w-full rounded-xl object-cover"
                    loading="lazy"
                  >
                </a>
                <p v-if="message.content" class="text-sm leading-5" :class="{ 'mt-2': message.image_url }">
                  {{ message.content }}
                </p>
                <p class="mt-1.5 text-right text-[11px] font-700" :class="isMyMessage(message.sender_id) ? 'text-white/50' : 'text-slate-500'">
                  {{ formatTime(message.sent_at) }}
                </p>
              </article>
            </div>
          </div>
        </section>

        <button
          v-if="isClosed"
          :disabled="support.isLoading"
          class="mt-3 h-13 shrink-0 rounded-2xl bg-main-500 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          @click="support.closeThread()"
        >
          К списку обращений
        </button>

        <form v-else class="grid grid-cols-[auto_1fr_auto] mt-3 shrink-0 items-center gap-2" @submit.prevent="send">
          <input ref="fileInput" accept="image/*" class="hidden" type="file" @change="onFileSelected">
          <button
            aria-label="Прикрепить фото"
            :disabled="support.isSending"
            class="h-13 w-13 flex items-center justify-center rounded-2xl bg-white/8 text-white transition active:scale-[0.97] disabled:opacity-50"
            type="button"
            @click="triggerPhoto"
          >
            <span class="i-mdi-paperclip text-5" />
          </button>
          <input
            v-model="draft"
            aria-label="Сообщение в поддержку"
            class="h-13 min-w-0 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm outline-none focus:border-main-400"
            maxlength="2000"
            name="support_message"
            placeholder="Сообщение"
          >
          <button
            aria-label="Отправить сообщение"
            :disabled="support.isSending || !draft.trim()"
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
