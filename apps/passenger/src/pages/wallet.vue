<script setup lang="ts">
import type { WalletTransaction, WalletTransactionType } from '~/types/wallet'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useWalletStore } from '~/stores/wallet'

const wallet = useWalletStore()
const amount = ref(2000)
const paymentUrl = ref('')
let paymentPollTimer: ReturnType<typeof setInterval> | undefined

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
  },
})

useHead({
  title: 'Кошелек | EdTaxi',
})

const transactionMeta: Record<WalletTransactionType, { className: string, icon: string, label: string }> = {
  fare_debit: {
    className: 'text-red-300',
    icon: 'i-mdi-taxi',
    label: 'Оплата поездки',
  },
  refund: {
    className: 'text-emerald-300',
    icon: 'i-mdi-cash-refund',
    label: 'Возврат',
  },
  topup: {
    className: 'text-main-300',
    icon: 'i-mdi-plus-circle',
    label: 'Пополнение',
  },
}

const balance = computed(() => formatMoney(wallet.wallet?.balance ?? 0))

async function refresh() {
  await Promise.all([
    wallet.loadWallet().catch(() => {}),
    wallet.loadHistory(20, 0).catch(() => {}),
  ])
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible')
    refresh()
}

onMounted(() => {
  refresh()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopPaymentPolling()
})

function startPaymentPolling() {
  stopPaymentPolling()
  paymentPollTimer = setInterval(refresh, 3000)
}

function stopPaymentPolling() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer)
    paymentPollTimer = undefined
  }
}

function closePaymentFrame() {
  paymentUrl.value = ''
  stopPaymentPolling()
  refresh()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'KZT',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

async function submitTopUp() {
  const response = await wallet.topUp(amount.value)
  paymentUrl.value = response.redirect_url
  startPaymentPolling()
}

function getTransactionTitle(transaction: WalletTransaction) {
  return transaction.description || transactionMeta[transaction.type].label
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+7.25rem)] pt-[calc(var(--app-safe-area-top)+1.35rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Баланс
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Кошелек
        </h1>
      </header>

      <section class="mt-6 border border-main-500/20 rounded-3xl bg-white/6 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <p class="text-xs text-slate-400 font-800 uppercase">
          Доступно
        </p>
        <p class="mt-2 text-4xl text-main-200 font-950">
          {{ balance }}
        </p>
        <p class="mt-1 text-sm text-slate-400">
          Валюта: {{ wallet.wallet?.currency || 'KZT' }}
        </p>

        <form class="grid grid-cols-[1fr_auto] mt-5 gap-2" @submit.prevent="submitTopUp">
          <input
            v-model.number="amount"
            aria-label="Сумма пополнения"
            class="h-13 min-w-0 border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-base text-white outline-none focus:border-main-400"
            inputmode="numeric"
            min="100"
            name="topup_amount"
            type="number"
          >
          <button
            :disabled="wallet.isMutating || amount <= 0"
            class="h-13 rounded-2xl bg-main-500 px-5 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="submit"
          >
            {{ wallet.isMutating ? '...' : 'Пополнить' }}
          </button>
        </form>
      </section>

      <section class="mt-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-950">
            Операции
          </h2>
          <button aria-label="Обновить операции" class="h-10 w-10 flex items-center justify-center rounded-full bg-white/8" type="button" @click="wallet.loadHistory(20, 0)">
            <span class="i-mdi-refresh text-5" />
          </button>
        </div>

        <div v-if="wallet.isLoadingHistory && !wallet.transactions.length" class="mt-4 space-y-3">
          <div v-for="item in 4" :key="item" class="h-18 animate-pulse rounded-2xl bg-white/6" />
        </div>

        <div v-else-if="!wallet.transactions.length" class="mt-4 rounded-3xl bg-white/5 p-6 text-center text-sm text-slate-400">
          Операций пока нет
        </div>

        <div v-else class="mt-4 space-y-3">
          <article
            v-for="transaction in wallet.transactions"
            :key="transaction.id"
            class="flex items-center gap-3 rounded-2xl bg-white/5 p-4"
          >
            <div class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-white/8" :class="transactionMeta[transaction.type].className">
              <span :class="transactionMeta[transaction.type].icon" class="text-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-900">
                {{ getTransactionTitle(transaction) }}
              </p>
              <p class="mt-0.5 text-xs text-slate-500 font-700">
                {{ formatDate(transaction.created_at) }}
              </p>
            </div>
            <p class="text-sm font-950" :class="transaction.amount >= 0 ? 'text-emerald-300' : 'text-red-300'">
              {{ formatMoney(transaction.amount) }}
            </p>
          </article>

          <button
            v-if="wallet.hasMore"
            :disabled="wallet.isLoadingHistory"
            class="h-12 w-full rounded-2xl bg-white/8 text-sm font-900 disabled:opacity-60"
            type="button"
            @click="wallet.loadMore(20)"
          >
            {{ wallet.isLoadingHistory ? 'Загружаем...' : 'Загрузить ещё' }}
          </button>
        </div>
      </section>
    </section>

    <PaymentFrameModal v-if="paymentUrl" :url="paymentUrl" @close="closePaymentFrame" />
  </main>
</template>
