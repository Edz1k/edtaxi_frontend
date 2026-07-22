<script setup lang="ts">
import type { SavedAccount } from '@edtaxi/shared/composables/auth/saved-accounts'
import { forgetAccount, readSavedAccounts, savedAccountDisplayName } from '@edtaxi/shared/composables/auth/saved-accounts'
import { isTelegramWebApp } from '@edtaxi/shared/composables/auth/telegram'
import AuthError from '~/components/auth/AuthError.vue'
import AuthScreen from '~/components/auth/AuthScreen.vue'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const accounts = ref<SavedAccount[]>([])
const canUseTelegram = computed(() => isTelegramWebApp())

definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: 'driver',
    guestRedirect: '/map',
  },
})

useHead({
  title: () => `${t('login.pickAccountTitle')} | Telegram Taxi Driver`,
})

onMounted(() => {
  auth.errorMessage = ''
  accounts.value = readSavedAccounts(SAVED_ACCOUNTS_KEY)
  // Нечего выбирать — сразу обычный вход по номеру.
  if (!accounts.value.length)
    router.replace('/login')
})

// Тап по аккаунту подставляет его номер в форму входа — остаётся получить код.
function selectAccount(account: SavedAccount) {
  router.push({ path: '/login', query: { phone: account.phone } })
}

function removeAccount(account: SavedAccount) {
  forgetAccount(SAVED_ACCOUNTS_KEY, account.id)
  accounts.value = readSavedAccounts(SAVED_ACCOUNTS_KEY)
  if (!accounts.value.length)
    router.replace('/login')
}

// Явный вход в свой Telegram-аккаунт (после «Выйти» тихий вход отключён).
async function loginViaTelegram() {
  try {
    await auth.loginWithTelegram()
    await router.replace('/map')
  }
  catch {}
}

function loginWithNewAccount() {
  router.push('/login')
}
</script>

<template>
  <AuthScreen
    :description="t('login.pickAccountLead')"
    icon="i-mdi-account-switch"
    :title="t('login.pickAccountTitle')"
  >
    <div class="mt-8 space-y-5">
      <AuthError :message="auth.errorMessage" />

      <div class="space-y-3">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center gap-4 rounded-3xl app-card px-4 py-4 transition active:scale-[0.98]"
        >
          <button class="min-w-0 flex flex-1 items-center gap-4 text-left" type="button" @click="selectAccount(account)">
            <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
              <span class="i-mdi-account text-7" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-lg font-900">
                {{ savedAccountDisplayName(account) }}
              </span>
              <span class="mt-0.5 block truncate text-xs app-muted font-600">
                {{ account.phone }}
              </span>
            </span>
          </button>

          <button
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full app-chip app-muted transition active:scale-[0.95]"
            type="button"
            @click="removeAccount(account)"
          >
            <span class="i-mdi-close text-5" />
          </button>
        </div>
      </div>

      <button
        v-if="canUseTelegram"
        :disabled="auth.isLoading"
        class="h-14 w-full flex items-center justify-center rounded-2xl bg-main-500 text-base text-white font-900 shadow-lg shadow-main-500/25 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="loginViaTelegram"
      >
        <span class="i-mdi-send mr-2 text-5" />
        {{ auth.isLoading ? t('login.loggingIn') : t('login.viaTelegram') }}
      </button>

      <button
        class="h-14 w-full flex items-center justify-center border app-border rounded-2xl app-card text-base text-slate-300 font-700 transition active:scale-[0.98] light:text-slate-600"
        type="button"
        @click="loginWithNewAccount"
      >
        {{ t('login.otherAccount') }}
      </button>
    </div>
  </AuthScreen>
</template>
