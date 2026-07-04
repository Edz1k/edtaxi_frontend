<script setup lang="ts">
import type { AuthLoginFlow, OtpDeliveryMethod } from '~/types/auth'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  description: string
  flow: AuthLoginFlow
  footer: string
  icon: string
  // Номер из списка сохранённых аккаунтов — подставляется в поле телефона.
  presetPhone?: string
  // Показать кнопку «назад» (страница выбора аккаунтов).
  showBack?: boolean
  successRedirect: string
  title: string
}>()

const emit = defineEmits<{
  back: []
}>()

const auth = useAuthStore()
const router = useRouter()
auth.loadSession()

const phone = ref(props.presetPhone ? props.presetPhone.replace(/^\+7/, '') : '')
const code = ref('')
const otpDeliveryMethod = ref<OtpDeliveryMethod>(auth.pendingOtpDeliveryMethod)
const step = ref<'code' | 'phone'>(auth.pendingPhone && auth.pendingFlow === props.flow ? 'code' : 'phone')
// otp — код по номеру (WhatsApp/SMS); telegram — подтверждение входа в боте.
const method = ref<'otp' | 'telegram'>('otp')
// Ждём подтверждения входа в Telegram-боте (поллинг статуса).
const tgWaiting = ref(false)

const isTelegramMethod = computed(() => method.value === 'telegram')
const isPhoneStep = computed(() => step.value === 'phone')
const canSubmit = computed(() => {
  if (isTelegramMethod.value)
    return isKazakhstanPhoneComplete(phone.value)

  if (isPhoneStep.value)
    return isKazakhstanPhoneComplete(phone.value)

  return code.value.length === 6
})

const submitLoadingText = computed(() => {
  if (isTelegramMethod.value)
    return 'Создаём запрос...'
  return isPhoneStep.value ? 'Отправляем...' : 'Проверяем...'
})

const submitText = computed(() => {
  if (isTelegramMethod.value)
    return 'Войти через Telegram'
  return isPhoneStep.value ? 'Получить код' : 'Войти'
})

let pollTimer: number | undefined

function stopPolling() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}

onUnmounted(() => {
  stopPolling()
  auth.cancelTelegramLogin()
})

async function pollOnce() {
  try {
    const status = await auth.pollTelegramLogin()
    if (status === 'approved') {
      stopPolling()
      tgWaiting.value = false
      await router.push(props.successRedirect)
    }
    else if (status === 'expired') {
      stopPolling()
      tgWaiting.value = false
      auth.errorMessage = 'Запрос входа истёк. Попробуйте ещё раз.'
    }
  }
  catch (error) {
    // Терминальные ошибки (нет прав, номер не в списке) — стоп; сетевые
    // сбои игнорируем и продолжаем поллить до истечения запроса.
    const status = (error as { status?: number }).status ?? 0
    if (status >= 400 && status !== 429) {
      stopPolling()
      tgWaiting.value = false
    }
  }
}

async function submitTelegram() {
  const request = await auth.startTelegramLogin(toKazakhstanE164(phone.value), props.flow)
  tgWaiting.value = true
  // Открываем бота сразу — мы ещё в обработчике клика, попап не заблокируют.
  window.open(request.deepLink, '_blank')
  pollTimer = window.setInterval(pollOnce, 2000)
}

async function submit() {
  if (isTelegramMethod.value) {
    if (!tgWaiting.value)
      await submitTelegram()
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
  stopPolling()
  tgWaiting.value = false
  auth.cancelTelegramLogin()
}

function cancelTelegramWaiting() {
  stopPolling()
  tgWaiting.value = false
  auth.cancelTelegramLogin()
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
    <template v-if="showBack" #before>
      <button
        class="mb-8 h-11 w-11 flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-slate-300 transition active:scale-[0.96]"
        type="button"
        @click="emit('back')"
      >
        <span class="i-mdi-arrow-left text-2xl" />
      </button>
    </template>

    <div class="mt-6 w-full inline-flex gap-1 rounded-2xl bg-white/5 p-1">
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
        Через Telegram
      </button>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <template v-if="isTelegramMethod">
        <template v-if="!tgWaiting">
          <PhoneInput v-model="phone" />

          <div class="rounded-2xl bg-white/5 px-4 py-3">
            <p class="text-xs text-slate-500 font-800 uppercase">
              Как это работает
            </p>
            <p class="mt-1 text-sm text-slate-200 leading-5">
              Откроется Telegram-бот — поделитесь в нём номером телефона, и вход подтвердится автоматически.
            </p>
          </div>
        </template>

        <div v-else class="rounded-2xl bg-white/5 px-4 py-4 text-center space-y-3">
          <div class="mx-auto h-8 w-8 animate-spin border-3 border-main-400 border-t-transparent rounded-full" />
          <p class="text-sm text-slate-200 leading-5">
            Ждём подтверждения в боте. Поделитесь номером
            <span class="font-900">+7{{ phone.replace(/\D/g, '') }}</span> в Telegram — вход произойдёт автоматически.
          </p>
          <a
            v-if="auth.telegramLogin"
            class="h-10 inline-flex items-center justify-center rounded-xl bg-main-500 px-4 text-sm text-white font-900"
            :href="auth.telegramLogin.deepLink"
            rel="noopener"
            target="_blank"
          >
            Открыть Telegram-бота
          </a>
          <button class="block w-full text-xs text-slate-500 underline" type="button" @click="cancelTelegramWaiting">
            Отменить
          </button>
        </div>
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
        v-if="!(isTelegramMethod && tgWaiting)"
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
