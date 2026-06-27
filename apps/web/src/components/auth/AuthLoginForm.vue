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
const otpDeliveryMethod = ref<OtpDeliveryMethod>(auth.pendingOtpDeliveryMethod)
const step = ref<'code' | 'phone'>(auth.pendingPhone && auth.pendingFlow === props.flow ? 'code' : 'phone')

const isPhoneStep = computed(() => step.value === 'phone')
const canSubmit = computed(() => {
  if (isPhoneStep.value)
    return isKazakhstanPhoneComplete(phone.value)

  return code.value.length === 6
})

async function submit() {
  if (isPhoneStep.value) {
    await auth.requestOtp(toKazakhstanE164(phone.value), props.flow, otpDeliveryMethod.value)
    step.value = 'code'
    return
  }

  await auth.confirmOtp(code.value)
  await router.push(props.successRedirect)
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
    <form class="mt-8 space-y-4" @submit.prevent="submit">
      <template v-if="isPhoneStep">
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
        :loading-text="isPhoneStep ? 'Отправляем...' : 'Проверяем...'"
        :text="isPhoneStep ? 'Получить код' : 'Войти'"
      />
    </form>

    <template #footer>
      {{ footer }}
    </template>
  </AuthScreen>
</template>
