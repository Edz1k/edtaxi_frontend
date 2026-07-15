<script setup lang="ts">
import type { OtpDeliveryMethod } from '~/types/auth'
import { isTelegramContactSupported } from '@edtaxi/shared/composables/telegram/contact'
import { useShakeAnimation } from '@edtaxi/shared/composables/useShakeAnimation'
import AuthButton from '~/components/auth/AuthButton.vue'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import OtpInput from '~/components/auth/OtpInput.vue'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { shouldShake, shake } = useShakeAnimation()

// share — главный экран с кнопкой «Поделиться номером»;
// manual — ручной ввод номера; code — подтверждение OTP.
const step = ref<'code' | 'manual' | 'share'>('share')
const phoneInput = ref('')
const otpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
const code = ref('')

const contactSupported = computed(() => isTelegramContactSupported())
const canSubmitPhone = computed(() => isKazakhstanPhoneComplete(phoneInput.value))
const canSubmitCode = computed(() => code.value.length === 6)

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
  },
})

useHead({
  title: 'Подтверждение номера | Telegram Taxi',
})

onMounted(() => {
  // Ошибки от предыдущих действий не должны встречать пользователя на входе.
  auth.errorMessage = ''

  // Номер уже подтверждён — на карту (страницу открыли напрямую).
  if (auth.phoneVerified) {
    router.replace('/map')
    return
  }

  // Линейный первый вход: сразу показываем нативный диалог Telegram
  // «Поделиться номером?», не заставляя искать кнопку.
  if (contactSupported.value)
    void shareTelegramContact(true)
})

async function shareTelegramContact(auto = false) {
  if (auth.isLoading)
    return

  try {
    const linked = await auth.linkPhoneViaTelegram()
    if (linked) {
      await router.replace('/map')
      return
    }
    // requestContact недоступен или пользователь закрыл диалог. При тапе по
    // кнопке переходим к ручному вводу; после автозапроса остаёмся на экране
    // с кнопкой — пользователь мог закрыть диалог случайно.
    if (!auto)
      step.value = 'manual'
  }
  catch {}
}

async function submitPhone() {
  if (!canSubmitPhone.value || auth.isLoading)
    return

  try {
    await auth.requestLinkPhoneOtp(toKazakhstanE164(phoneInput.value), otpDeliveryMethod.value)
    step.value = 'code'
  }
  catch {}
}

async function submitCode() {
  if (!canSubmitCode.value || auth.isLoading || !auth.pendingPhone)
    return

  try {
    await auth.confirmLinkPhoneOtp(code.value)
    await router.replace('/map')
  }
  catch {
    shake()
  }
}

async function logoutToLogin() {
  await auth.logout()
  await router.replace('/login/accounts')
}
</script>

<template>
  <AuthScreen
    description="Номер телефона обязателен: он нужен, чтобы водитель и поддержка могли с вами связаться."
    icon="i-mdi-phone-check"
    title="Подтвердите номер"
  >
    <template v-if="step !== 'share'" #before>
      <button
        class="mb-8 h-11 w-11 flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-slate-300 transition active:scale-[0.96]"
        type="button"
        @click="step = step === 'code' ? 'manual' : 'share'"
      >
        <span class="i-mdi-arrow-left text-2xl" />
      </button>
    </template>

    <div v-if="step === 'share'" class="mt-8 space-y-5">
      <AuthError :message="auth.errorMessage" />

      <button
        v-if="contactSupported"
        :disabled="auth.isLoading"
        class="h-14 w-full flex items-center justify-center rounded-2xl bg-main-500 text-base text-white font-900 shadow-lg shadow-main-500/25 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="shareTelegramContact()"
      >
        <span class="i-mdi-send mr-2 text-5" />
        {{ auth.isLoading ? 'Подтверждаем...' : 'Поделиться номером из Telegram' }}
      </button>

      <button
        class="h-14 w-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-base text-slate-300 font-700 transition active:scale-[0.98]"
        type="button"
        @click="step = 'manual'"
      >
        Ввести номер вручную
      </button>
    </div>

    <form v-else-if="step === 'manual'" class="mt-8 space-y-5" @submit.prevent="submitPhone">
      <AuthError :message="auth.errorMessage" />

      <PhoneInput v-model="phoneInput" />
      <OtpSelect v-model="otpDeliveryMethod" />
      <AuthButton
        :disabled="auth.isLoading || !canSubmitPhone"
        :loading="auth.isLoading"
        loading-text="Отправляем код..."
        text="Получить код"
      />
    </form>

    <form v-else class="mt-8 space-y-5" @submit.prevent="submitCode">
      <AuthError :message="auth.errorMessage" />

      <OtpInput v-model="code" :shake="shouldShake" />
      <AuthButton
        :disabled="auth.isLoading || !canSubmitCode"
        icon="i-mdi-check"
        :loading="auth.isLoading"
        loading-text="Проверяем код..."
        text="Подтвердить"
      />
    </form>

    <template #footer>
      <button class="text-xs text-slate-500 underline" type="button" @click="logoutToLogin">
        Выйти и сменить аккаунт
      </button>
    </template>
  </AuthScreen>
</template>
