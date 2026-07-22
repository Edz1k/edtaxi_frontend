<script setup lang="ts">
import type { OtpDeliveryMethod } from '~/types/auth'
import { readSavedAccounts } from '@edtaxi/shared/composables/auth/saved-accounts'
import { readyTelegramWebApp } from '@edtaxi/shared/composables/auth/telegram'
import AuthButton from '~/components/auth/AuthButton.vue'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const phoneInput = ref('')
const otpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
// Кнопка «назад» к списку сохранённых аккаунтов — только если они есть.
const hasSavedAccounts = ref(false)

const canSubmit = computed(() => isKazakhstanPhoneComplete(phoneInput.value))

definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: 'passenger',
    guestRedirect: '/map',
  },
})

useHead({
  title: () => `${t('login.title')} | Telegram Taxi`,
})

onMounted(() => {
  readyTelegramWebApp()
  auth.errorMessage = ''
  hasSavedAccounts.value = readSavedAccounts(SAVED_ACCOUNTS_KEY).length > 0

  // Со страницы выбора аккаунта приходят с ?phone=+7... — подставляем номер,
  // остаётся только получить код.
  const presetPhone = typeof route.query.phone === 'string' ? route.query.phone : ''
  if (presetPhone)
    phoneInput.value = presetPhone.replace(/^\+7/, '')
})

async function submitPhone() {
  if (!canSubmit.value || auth.isLoading)
    return

  try {
    await auth.requestPassengerOtp(toKazakhstanE164(phoneInput.value), otpDeliveryMethod.value)
    await router.push('/login/verify')
  }
  catch {}
}
</script>

<template>
  <AuthScreen
    :description="t('login.lead')"
    icon="i-mdi-taxi"
    title="Telegram Taxi"
  >
    <template v-if="hasSavedAccounts" #before>
      <button
        class="mb-8 h-11 w-11 flex items-center justify-center border app-border rounded-2xl app-card text-slate-300 transition active:scale-[0.96] light:text-slate-600"
        type="button"
        @click="router.replace('/login/accounts')"
      >
        <span class="i-mdi-arrow-left text-2xl" />
      </button>
    </template>

    <form class="mt-8 space-y-5" @submit.prevent="submitPhone">
      <AuthError :message="auth.errorMessage" />

      <PhoneInput v-model="phoneInput" />
      <OtpSelect v-model="otpDeliveryMethod" />
      <AuthButton
        :disabled="auth.isLoading || !canSubmit"
        :loading="auth.isLoading"
        :loading-text="t('login.sendingCode')"
        :text="t('login.getCode')"
      />
    </form>

    <template #footer>
      {{ t('login.terms') }}
    </template>
  </AuthScreen>
</template>
