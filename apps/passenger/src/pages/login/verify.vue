<script setup lang="ts">
import { useShakeAnimation } from '@edtaxi/shared/composables/useShakeAnimation'
import AuthButton from '~/components/auth/AuthButton.vue'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import OtpInput from '~/components/auth/OtpInput.vue'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { shouldShake, shake } = useShakeAnimation()
const { t } = useI18n()

const code = ref('')

const canSubmit = computed(() => code.value.length === 6)
const deliveryMethodLabel = computed(() =>
  auth.pendingOtpDeliveryMethod === 'whatsapp' ? t('login.viaWhatsapp') : t('login.viaSms'),
)

definePage({
  meta: {
    authRedirect: '/login',
    guestOnly: true,
    guestOnlyRole: 'passenger',
    guestRedirect: '/map',
    requiresPendingPhone: true,
  },
})

useHead({
  title: () => `${t('login.codeTitle')} | Telegram Taxi`,
})

async function submitOtp() {
  if (!canSubmit.value || auth.isLoading || !auth.pendingPhone)
    return

  try {
    await auth.confirmPassengerOtp(code.value)
    await router.replace('/map')
  }
  catch {
    shake()
  }
}

function backToPhone() {
  router.replace('/login')
}
</script>

<template>
  <AuthScreen
    :description="t('login.codeSent', { via: deliveryMethodLabel, phone: auth.pendingPhone || '+7' })"
    icon="i-mdi-shield-key"
    :title="t('login.codeTitle')"
  >
    <template #before>
      <button
        class="mb-8 h-11 w-11 flex items-center justify-center border app-border rounded-2xl app-card text-slate-300 transition active:scale-[0.96] light:text-slate-600"
        type="button"
        @click="backToPhone"
      >
        <span class="i-mdi-arrow-left text-2xl" />
      </button>
    </template>

    <form class="mt-8 space-y-5" @submit.prevent="submitOtp">
      <AuthError :message="auth.errorMessage" />

      <OtpInput v-model="code" :shake="shouldShake" />
      <AuthButton
        :disabled="auth.isLoading || !canSubmit"
        icon="i-mdi-check"
        :loading="auth.isLoading"
        :loading-text="t('login.checkingCode')"
        :text="t('login.signIn')"
      />

      <button
        class="h-14 w-full flex items-center justify-center border app-border rounded-2xl app-card text-base text-slate-300 font-700 transition active:scale-[0.98] light:text-slate-600"
        type="button"
        @click="backToPhone"
      >
        {{ t('login.changePhone') }}
      </button>
    </form>

    <template #footer>
      {{ t('login.codeNotReceived') }}
    </template>
  </AuthScreen>
</template>
