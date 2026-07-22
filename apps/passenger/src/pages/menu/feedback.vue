<script setup lang="ts">
import { submitFeedback } from '@edtaxi/shared/api/feedback'
import { showErrorToast } from '~/api/errors'
import { useToast } from '~/composables/useToast'

const toast = useToast()
const { t } = useI18n()

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
    layout: 'passenger',
    requiredRole: 'passenger',
    requiresAuth: true,
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.feedback',
  },
})

useHead({
  title: () => `${t('titles.feedback')} | Telegram Taxi`,
})

async function send() {
  if (!canSend.value || isSending.value)
    return

  isSending.value = true
  try {
    await submitFeedback(trimmed.value)
    message.value = ''
    isSent.value = true
    toast.success(t('feedback.toastOkTitle'), t('feedback.toastOkText'))
  }
  catch (error) {
    showErrorToast(error, t('feedback.toastFail'))
  }
  finally {
    isSending.value = false
  }
}
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs app-accent font-900 uppercase">
          {{ t('feedback.eyebrow') }}
        </p>
        <h1 class="mt-1 text-3xl font-950">
          {{ t('feedback.title') }}
        </h1>
        <p class="mt-2 text-sm app-muted leading-5">
          {{ t('feedback.lead') }}
        </p>
      </header>

      <div v-if="isSent" class="mt-6 rounded-3xl app-card p-6 text-center">
        <span class="i-mdi-check-circle-outline mx-auto block text-14 app-accent" />
        <p class="mt-3 text-lg font-950">
          {{ t('feedback.thanksTitle') }}
        </p>
        <p class="mt-1 text-sm app-muted leading-5">
          {{ t('feedback.thanksText') }}
        </p>
        <div class="mt-5 flex flex-col gap-2">
          <button
            class="h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98]"
            type="button"
            @click="isSent = false"
          >
            {{ t('feedback.more') }}
          </button>
          <RouterLink
            class="h-13 w-full flex items-center justify-center rounded-2xl app-chip text-sm font-900 transition active:scale-[0.98]"
            to="/menu"
          >
            {{ t('feedback.backToMenu') }}
          </RouterLink>
        </div>
      </div>

      <form v-else class="mt-6 rounded-3xl app-card p-4" @submit.prevent="send">
        <textarea
          v-model="message"
          :maxlength="MAX_LENGTH"
          rows="6"
          :placeholder="t('feedback.placeholder')"
          class="w-full resize-none rounded-2xl app-card px-4 py-3 text-sm text-white outline-none transition focus:app-chip placeholder-slate-500"
        />
        <div class="mt-1 text-right text-xs app-faint font-700">
          {{ trimmed.length }}/{{ MAX_LENGTH }}
        </div>
        <button
          :disabled="isSending || !canSend"
          class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isSending ? t('feedback.sending') : t('feedback.send') }}
        </button>
      </form>
    </section>
  </main>
</template>
