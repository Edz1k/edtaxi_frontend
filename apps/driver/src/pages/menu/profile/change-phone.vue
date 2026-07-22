<script setup lang="ts">
import { sendDriverPhoneOtp, verifyDriverPhone } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import OtpInput from '~/components/auth/OtpInput.vue'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const step = ref<'code' | 'phone'>('phone')
const phoneInput = ref('')
const code = ref('')
const isSending = ref(false)
const isVerifying = ref(false)
const codeShake = ref(false)

const canSendCode = computed(() => isKazakhstanPhoneComplete(phoneInput.value))
const newPhone = computed(() => toKazakhstanE164(phoneInput.value))

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu/settings',
    screenSubtitle: 'nav.backToSettings',
    screenTitle: 'titles.changePhone',
  },
})

useHead({
  title: () => `${t('titles.changePhone')} | Telegram Taxi Driver`,
})

async function sendCode() {
  if (!canSendCode.value || isSending.value)
    return

  isSending.value = true
  try {
    await sendDriverPhoneOtp(newPhone.value)
    code.value = ''
    step.value = 'code'
  }
  catch (error) {
    showErrorToast(error, t('changePhone.sendFail'))
  }
  finally {
    isSending.value = false
  }
}

async function verifyCode() {
  if (code.value.length !== 6 || isVerifying.value)
    return

  isVerifying.value = true
  try {
    const response = await verifyDriverPhone(newPhone.value, code.value)
    // Если номер принадлежал другому аккаунту, бэкенд объединил аккаунты и
    // перевыпустил сессию — перечитываем её в любом случае.
    await auth.restoreSession({ force: true, preferredRole: 'driver' }).catch(() => {})
    toast.success(
      t('changePhone.doneTitle'),
      response.merged ? t('changePhone.doneMerged') : t('changePhone.doneUpdated'),
    )
    await router.push('/menu/settings')
  }
  catch (error) {
    codeShake.value = true
    setTimeout(() => codeShake.value = false, 400)
    showErrorToast(error, t('changePhone.verifyFail'))
  }
  finally {
    isVerifying.value = false
  }
}

function backToPhone() {
  code.value = ''
  step.value = 'phone'
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs app-accent font-900 uppercase">
          {{ t('titles.settings') }}
        </p>
        <h1 class="mt-1 text-3xl font-950">
          {{ t('titles.changePhone') }}
        </h1>
        <p class="mt-2 text-sm app-muted leading-5">
          {{ step === 'phone'
            ? t('changePhone.enterPhone')
            : t('changePhone.enterCode', { phone: newPhone }) }}
        </p>
      </header>

      <form v-if="step === 'phone'" class="mt-6 rounded-3xl app-card p-4" @submit.prevent="sendCode">
        <PhoneInput v-model="phoneInput" />
        <button
          :disabled="isSending || !canSendCode"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isSending ? t('changePhone.sendingCode') : t('changePhone.getCode') }}
        </button>
      </form>

      <form v-else class="mt-6 rounded-3xl app-card p-4" @submit.prevent="verifyCode">
        <OtpInput v-model="code" :shake="codeShake" />
        <button
          :disabled="isVerifying || code.length !== 6"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isVerifying ? t('changePhone.verifying') : t('changePhone.confirm') }}
        </button>
        <div class="mt-3 flex items-center justify-between">
          <button
            class="text-xs app-muted font-800 underline underline-offset-3"
            type="button"
            @click="backToPhone"
          >
            {{ t('changePhone.editPhone') }}
          </button>
          <button
            :disabled="isSending"
            class="text-xs app-accent font-800 underline underline-offset-3 disabled:opacity-60"
            type="button"
            @click="sendCode"
          >
            {{ isSending ? t('changePhone.sending') : t('changePhone.resend') }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
