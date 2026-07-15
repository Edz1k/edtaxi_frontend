<script setup lang="ts">
import { submitFeedback } from '@edtaxi/shared/api/feedback'
import { showErrorToast } from '~/api/errors'
import { useToast } from '~/composables/useToast'

const toast = useToast()

const MAX_LENGTH = 2000
const message = ref('')
const isSending = ref(false)
const isSent = ref(false)

const trimmed = computed(() => message.value.trim())
const canSend = computed(() => trimmed.value.length >= 3 && trimmed.value.length <= MAX_LENGTH)

definePage({
  meta: {
    authRedirect: '/login',
    backTo: '/menu',
    layout: 'driver',
    requiredRole: 'driver',
    requiresAuth: true,
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Предложить улучшение',
  },
})

useHead({
  title: 'Предложить улучшение | Telegram Taxi',
})

async function send() {
  if (!canSend.value || isSending.value)
    return

  isSending.value = true
  try {
    await submitFeedback(trimmed.value)
    message.value = ''
    isSent.value = true
    toast.success('Спасибо!', 'Ваше предложение отправлено.')
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отправить предложение. Попробуйте ещё раз.')
  }
  finally {
    isSending.value = false
  }
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Обратная связь
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Предложить улучшение
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Расскажите, что улучшить в приложении для водителей. Лучшие идеи мы внедряем и благодарим бонусами.
        </p>
      </header>

      <div v-if="isSent" class="mt-6 rounded-3xl bg-white/5 p-6 text-center">
        <span class="i-mdi-check-circle-outline mx-auto block text-14 text-main-300" />
        <p class="mt-3 text-lg font-950">
          Спасибо за идею!
        </p>
        <p class="mt-1 text-sm text-slate-400 leading-5">
          Мы читаем каждое предложение. Если внедрим — начислим бонусы.
        </p>
        <div class="mt-5 flex flex-col gap-2">
          <button
            class="h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98]"
            type="button"
            @click="isSent = false"
          >
            Предложить ещё
          </button>
          <RouterLink
            class="h-13 w-full flex items-center justify-center rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
            to="/menu"
          >
            Вернуться в меню
          </RouterLink>
        </div>
      </div>

      <form v-else class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="send">
        <textarea
          v-model="message"
          :maxlength="MAX_LENGTH"
          rows="6"
          placeholder="Например: показывайте пробки на маршруте к клиенту…"
          class="w-full resize-none rounded-2xl bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:bg-white/8 placeholder-slate-500"
        />
        <div class="mt-1 text-right text-xs text-slate-500 font-700">
          {{ trimmed.length }}/{{ MAX_LENGTH }}
        </div>
        <button
          :disabled="isSending || !canSend"
          class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isSending ? 'Отправляем...' : 'Отправить' }}
        </button>
      </form>
    </section>
  </main>
</template>
