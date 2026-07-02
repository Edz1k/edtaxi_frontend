<script setup lang="ts">
import OtpInput from '~/components/auth/OtpInput.vue'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { sendDriverPhoneOtp, verifyDriverPhone } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

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
    backTo: '/menu/profile',
    screenSubtitle: 'Назад в профиль',
    screenTitle: 'Смена номера',
  },
})

useHead({
  title: 'Смена номера | EdTaxi Driver',
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
    showErrorToast(error, 'Не удалось отправить код. Проверьте номер и попробуйте ещё раз.')
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
      'Готово',
      response.merged ? 'Номер подтверждён, аккаунты объединены.' : 'Номер телефона обновлён.',
    )
    await router.push('/menu/profile')
  }
  catch (error) {
    codeShake.value = true
    setTimeout(() => codeShake.value = false, 400)
    showErrorToast(error, 'Не удалось подтвердить код. Попробуйте ещё раз.')
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
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Профиль
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Смена номера
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          {{ step === 'phone'
            ? 'Введите новый номер — на него придёт код подтверждения.'
            : `Введите код из сообщения на номер ${newPhone}.` }}
        </p>
      </header>

      <form v-if="step === 'phone'" class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="sendCode">
        <PhoneInput v-model="phoneInput" />
        <button
          :disabled="isSending || !canSendCode"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isSending ? 'Отправляем код...' : 'Получить код' }}
        </button>
      </form>

      <form v-else class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="verifyCode">
        <OtpInput v-model="code" :shake="codeShake" />
        <button
          :disabled="isVerifying || code.length !== 6"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ isVerifying ? 'Проверяем...' : 'Подтвердить номер' }}
        </button>
        <div class="mt-3 flex items-center justify-between">
          <button
            class="text-xs text-slate-400 font-800 underline underline-offset-3"
            type="button"
            @click="backToPhone"
          >
            Изменить номер
          </button>
          <button
            :disabled="isSending"
            class="text-xs text-main-300 font-800 underline underline-offset-3 disabled:opacity-60"
            type="button"
            @click="sendCode"
          >
            {{ isSending ? 'Отправляем...' : 'Отправить код ещё раз' }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
