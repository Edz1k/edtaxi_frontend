<script setup lang="ts">
import type { SavedAccount } from '@edtaxi/shared/composables/auth/saved-accounts'
import { forgetAccount, readSavedAccounts, savedAccountDisplayName } from '@edtaxi/shared/composables/auth/saved-accounts'
import { SAVED_ACCOUNTS_KEY } from '~/stores/auth'

definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: ['tech_support', 'admin', 'superadmin'],
    guestRedirect: '/support',
  },
})

useHead({
  title: 'Вход техподдержки | Telegram Taxi',
})

const accounts = ref<SavedAccount[]>([])
// accounts — список ранее использованных аккаунтов; form — обычная форма входа.
const view = ref<'accounts' | 'form'>('form')
const presetPhone = ref('')

onMounted(() => {
  accounts.value = readSavedAccounts(SAVED_ACCOUNTS_KEY)
  if (accounts.value.length)
    view.value = 'accounts'
})

function selectAccount(account: SavedAccount) {
  presetPhone.value = account.phone
  view.value = 'form'
}

function removeAccount(account: SavedAccount) {
  forgetAccount(SAVED_ACCOUNTS_KEY, account.id)
  accounts.value = readSavedAccounts(SAVED_ACCOUNTS_KEY)
  if (!accounts.value.length)
    view.value = 'form'
}

function loginWithNewAccount() {
  presetPhone.value = ''
  view.value = 'form'
}

function backToAccounts() {
  presetPhone.value = ''
  view.value = 'accounts'
}
</script>

<template>
  <AuthScreen
    v-if="view === 'accounts'"
    description="Выберите аккаунт, под которым уже входили, или войдите в другой по номеру телефона."
    icon="i-mdi-headset"
    title="Вход техподдержки"
  >
    <div class="mt-8 space-y-5">
      <div class="space-y-3">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 transition active:scale-[0.98]"
        >
          <button class="min-w-0 flex flex-1 items-center gap-4 text-left" type="button" @click="selectAccount(account)">
            <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
              <span class="i-mdi-account text-7" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-lg font-900">
                {{ savedAccountDisplayName(account) }}
              </span>
              <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
                {{ account.phone }}
              </span>
            </span>
          </button>

          <button
            class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-400 transition active:scale-[0.95]"
            type="button"
            @click="removeAccount(account)"
          >
            <span class="i-mdi-close text-5" />
          </button>
        </div>
      </div>

      <button
        class="h-14 w-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-base text-slate-300 font-700 transition active:scale-[0.98]"
        type="button"
        @click="loginWithNewAccount"
      >
        Войти в новый аккаунт по номеру
      </button>
    </div>

    <template #footer>
      Отдельный вход для операторов техподдержки.
    </template>
  </AuthScreen>

  <AuthLoginForm
    v-else
    :key="presetPhone"
    description="Войдите по номеру из списка техподдержки, чтобы работать с обращениями."
    flow="tech_support"
    footer="Отдельный вход для операторов техподдержки."
    icon="i-mdi-headset"
    :preset-phone="presetPhone"
    :show-back="accounts.length > 0"
    success-redirect="/support"
    title="Вход техподдержки"
    @back="backToAccounts"
  />
</template>
