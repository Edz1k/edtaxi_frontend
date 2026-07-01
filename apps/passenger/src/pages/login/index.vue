<script setup lang="ts">
import type { OtpDeliveryMethod } from '~/types/auth'
import AuthButton from '~/components/auth/AuthButton.vue'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { readyTelegramWebApp } from '@edtaxi/shared/composables/auth/telegram'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const phoneInput = ref('')
const otpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')

const canSubmit = computed(() => isKazakhstanPhoneComplete(phoneInput.value))

definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: 'passenger',
    guestRedirect: '/map',
  },
})

useHead({
  title: 'Вход | Telegram Taxi',
})

onMounted(() => {
  readyTelegramWebApp()
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
    description="Быстрый заказ такси прямо через Telegram. Введите номер телефона, чтобы получить код подтверждения."
    icon="i-mdi-taxi"
    title="Telegram Taxi"
  >
    <form class="mt-8 space-y-5" @submit.prevent="submitPhone">
      <AuthError :message="auth.errorMessage" />

      <PhoneInput v-model="phoneInput" />
      <OtpSelect v-model="otpDeliveryMethod" />
      <AuthButton
        :disabled="auth.isLoading || !canSubmit"
        :loading="auth.isLoading"
        loading-text="Отправляем код..."
        text="Получить код"
      />
    </form>

    <template #footer>
      Продолжая, вы соглашаетесь с условиями сервиса
    </template>
  </AuthScreen>
</template>
