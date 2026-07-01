<script setup lang="ts">
import AuthButton from '~/components/auth/AuthButton.vue'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import OtpInput from '~/components/auth/OtpInput.vue'
import { useShakeAnimation } from '@edtaxi/shared/composables/useShakeAnimation'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { shouldShake, shake } = useShakeAnimation()

const code = ref('')

const canSubmit = computed(() => code.value.length === 6)
const deliveryMethodLabel = computed(() =>
  auth.pendingOtpDeliveryMethod === 'whatsapp' ? 'в WhatsApp' : 'по SMS',
)

definePage({
  meta: {
    authRedirect: '/login',
    guestOnly: true,
    guestOnlyRole: 'driver',
    guestRedirect: '/map',
    requiresPendingPhone: true,
  },
})

useHead({
  title: 'Код подтверждения | EdTaxi',
})

async function submitOtp() {
  if (!canSubmit.value || auth.isLoading || !auth.pendingPhone)
    return

  try {
    await auth.confirmDriverOtp(code.value)
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
    :description="`Мы отправили код ${deliveryMethodLabel} на номер ${auth.pendingPhone || '+7'}`"
    icon="i-mdi-shield-key"
    title="Введите код"
  >
    <template #before>
      <button
        class="mb-8 h-11 w-11 flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-slate-300 transition active:scale-[0.96]"
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
        loading-text="Проверяем код..."
        text="Войти"
      />

      <button
        class="h-14 w-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-base text-slate-300 font-700 transition active:scale-[0.98]"
        type="button"
        @click="backToPhone"
      >
        Изменить номер телефона
      </button>
    </form>

    <template #footer>
      Если код не пришел, проверьте номер телефона
    </template>
  </AuthScreen>
</template>
