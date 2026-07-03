<script setup lang="ts">
import type { SupportMessage } from '~/types/support'
import { formatTime } from '~/utils/format'

const props = defineProps<{
  messages: SupportMessage[]
  isLoading: boolean
  currentUserId?: string
}>()

const listEl = ref<HTMLElement | null>(null)

function isMyMessage(senderId: string) {
  return props.currentUserId === senderId
}

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value)
      listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

// Стор реассайнит массив сообщений при любой мутации (загрузка, отправка,
// входящее из WS, смена комнаты) — поэтому следим за ссылкой, а не за длиной:
// так ловим и переключение между обращениями с одинаковым числом сообщений.
watch(() => props.messages, scrollToBottom)
onMounted(scrollToBottom)
</script>

<template>
  <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
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
      ref="listEl"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <div v-if="isLoading" class="space-y-3">
        <div v-for="i in 6" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
          <div class="h-14 w-56 animate-pulse rounded-lg bg-white/6" />
        </div>
      </div>

      <div
        v-else-if="!messages.length"
        class="min-h-60 flex flex-col items-center justify-center gap-2 text-center"
      >
        <span class="i-mdi-chat-outline text-12 text-white/15" aria-hidden="true" />
        <p class="text-sm text-slate-500">
          Сообщений пока нет
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="msg in messages"
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
  </div>
</template>
