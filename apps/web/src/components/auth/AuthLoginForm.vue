<script setup lang="ts">
import type { AuthLoginFlow, OtpDeliveryMethod } from '~/types/auth'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  description: string
  flow: AuthLoginFlow
  footer: string
  icon: string
  successRedirect: string
  title: string
}>()

const auth = useAuthStore()
const router = useRouter()
auth.loadSession()

const phone = ref('')
const code = ref('')
const telegramCode = ref('')
const otpDeliveryMethod = ref<OtpDeliveryMethod>(auth.pendingOtpDeliveryMethod)
const step = ref<'code' | 'phone'>(auth.pendingPhone && auth.pendingFlow === props.flow ? 'code' : 'phone')
// Вход по коду из Telegram-бота доступен только парку и техподдержке.
const method = ref<'otp' | 'telegram'>('otp')
const supportsTelegramCode = computed(() => props.flow !== 'admin')

const isTelegramMethod = computed(() => supportsTelegramCode.value && method.value === 'telegram')
const isPhoneStep = computed(() => step.value === 'phone')
const canSubmit = computed(() => {
  if (isTelegramMethod.value)
    return telegramCode.value.length === 6

  if (isPhoneStep.value)
    return isKazakhstanPhoneComplete(phone.value)

  return code.value.length === 6
})

const submitLoadingText = computed(() => {
  if (isTelegramMethod.value)
    return 'Проверяем...'
  return isPhoneStep.value ? 'Отправляем...' : 'Проверяем...'
})

const submitText = computed(() => {
  if (isTelegramMethod.value)
    return 'Войти'
  return isPhoneStep.value ? 'Получить код' : 'Войти'
})

async function submit() {
  if (isTelegramMethod.value && props.flow !== 'admin') {
    await auth.confirmTelegramCode(telegramCode.value, props.flow)
    await router.push(props.successRedirect)
    return
  }

  if (isPhoneStep.value) {
    await auth.requestOtp(toKazakhstanE164(phone.value), props.flow, otpDeliveryMethod.value)
    step.value = 'code'
    return
  }

  await auth.confirmOtp(code.value)
  await router.push(props.successRedirect)
}

function selectMethod(next: 'otp' | 'telegram') {
  method.value = next
  auth.errorMessage = ''
}

function editPhone() {
  auth.clearPendingLogin()
  otpDeliveryMethod.value = 'whatsapp'
  code.value = ''
  step.value = 'phone'
}
</script>

<template>
  <AuthScreen
    :description="description"
    :icon="icon"
    :title="title"
  >
    <div v-if="supportsTelegramCode" class="mt-6 inline-flex w-full gap-1 rounded-2xl bg-white/5 p-1">
      <button
        class="h-10 flex-1 rounded-xl text-sm font-900 transition"
        :class="!isTelegramMethod ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'"
        type="button"
        @click="selectMethod('otp')"
      >
        Код по номеру
      </button>
      <button
        class="h-10 flex-1 rounded-xl text-sm font-900 transition"
        :class="isTelegramMethod ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'"
        type="button"
        @click="selectMethod('telegram')"
      >
        Код из Telegram
      </button>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <template v-if="isTelegramMethod">
        <div class="rounded-2xl bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 font-800 uppercase">
            Как получить код
          </p>
          <p class="mt-1 text-sm text-slate-200 leading-5">
            Откройте бота <span class="font-900">@telegtaxi_bot</span> в Telegram, подтвердите номер телефона и введите выданный код.
          </p>
        </div>

        <OtpInput v-model="telegramCode" :shake="Boolean(auth.errorMessage)" />
      </template>

      <template v-else-if="isPhoneStep">
        <PhoneInput v-model="phone" />
        <OtpSelect v-model="otpDeliveryMethod" />
      </template>

      <div v-else class="space-y-4">
        <div class="rounded-2xl bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 font-800 uppercase">
            Код отправлен {{ auth.pendingOtpDeliveryMethod === 'whatsapp' ? 'в WhatsApp' : 'по SMS' }}
          </p>
          <div class="mt-1 flex items-center justify-between gap-3">
            <span class="text-sm text-slate-200 font-800">{{ auth.pendingPhone }}</span>
            <button class="text-sm text-main-300 font-900" type="button" @click="editPhone">
              Изменить
            </button>
          </div>
        </div>

        <OtpInput v-model="code" :shake="Boolean(auth.errorMessage)" />
      </div>

      <AuthError :message="auth.errorMessage" />

      <AuthButton
        :disabled="auth.isLoading || !canSubmit"
        :loading="auth.isLoading"
        :loading-text="submitLoadingText"
        :text="submitText"
      />
    </form>

    <template #footer>
      {{ footer }}
    </template>
  </AuthScreen>
</template>
