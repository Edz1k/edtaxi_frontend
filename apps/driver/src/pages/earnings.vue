<script setup lang="ts">
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useDriverEarningsStore } from '~/stores/driverEarnings'

const earnings = useDriverEarningsStore()
const topUpAmount = ref(2000)
const paymentUrl = ref('')
let paymentPollTimer: ReturnType<typeof setInterval> | undefined

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Заработок | EdTaxi',
})

async function refresh() {
  await Promise.all([
    earnings.loadEarnings().catch(() => {}),
    earnings.loadWallet().catch(() => {}),
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

async function submitTopUp() {
  const response = await earnings.topUpWallet(topUpAmount.value)
  paymentUrl.value = response.redirect_url
  startPaymentPolling()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'KZT',
  }).format(value)
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+7.25rem)] pt-[calc(var(--app-safe-area-top)+1.35rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Заработок
        </h1>
      </header>

      <section class="mt-6 border border-main-500/20 rounded-3xl bg-white/6 p-5">
        <p class="text-xs text-slate-400 font-800 uppercase">
          Всего заработано
        </p>
        <p class="mt-2 text-4xl text-main-200 font-950">
          {{ formatMoney(earnings.earnings?.total_earned ?? 0) }}
        </p>
      </section>

      <div class="grid grid-cols-2 mt-4 gap-3">
        <article class="rounded-2xl bg-white/5 p-4">
          <p class="text-xs text-slate-400 font-800">
            Поездок
          </p>
          <p class="mt-1 text-2xl font-950">
            {{ earnings.earnings?.trip_count ?? 0 }}
          </p>
        </article>

        <article class="rounded-2xl bg-white/5 p-4">
          <p class="text-xs text-slate-400 font-800">
            Средний чек
          </p>
          <p class="mt-1 text-2xl font-950">
            {{ formatMoney(earnings.earnings?.trip_count ? (earnings.earnings.total_earned / earnings.earnings.trip_count) : 0) }}
          </p>
        </article>
      </div>

      <button
        :disabled="earnings.isLoadingEarnings"
        class="mt-4 h-13 w-full rounded-2xl bg-white/8 text-sm font-900 disabled:opacity-60"
        type="button"
        @click="earnings.loadEarnings()"
      >
        {{ earnings.isLoadingEarnings ? 'Обновляем...' : 'Обновить' }}
      </button>

      <section class="mt-6 border border-main-500/20 rounded-3xl bg-white/6 p-5">
        <p class="text-xs text-slate-400 font-800 uppercase">
          Баланс для выхода на линию
        </p>
        <p class="mt-2 text-4xl text-main-200 font-950">
          {{ formatMoney(earnings.wallet?.available_balance ?? 0) }}
        </p>
        <p v-if="earnings.wallet && earnings.wallet.debt_balance > 0" class="mt-1 text-sm text-red-300">
          Долг по наличным поездкам: {{ formatMoney(earnings.wallet.debt_balance) }}
        </p>
        <p v-else class="mt-1 text-sm text-slate-400">
          Минимум для выхода на линию: {{ formatMoney(earnings.wallet?.min_balance_to_go_online ?? 0) }}
        </p>

        <form class="grid grid-cols-[1fr_auto] mt-5 gap-2" @submit.prevent="submitTopUp">
          <input
            v-model.number="topUpAmount"
            aria-label="Сумма пополнения"
            class="h-13 min-w-0 border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-base text-white outline-none focus:border-main-400"
            inputmode="numeric"
            min="100"
            name="topup_amount"
            type="number"
          >
          <button
            :disabled="earnings.isMutatingWallet || topUpAmount <= 0"
            class="h-13 rounded-2xl bg-main-500 px-5 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="submit"
          >
            {{ earnings.isMutatingWallet ? '...' : 'Пополнить' }}
          </button>
        </form>
      </section>
    </section>

    <PaymentFrameModal v-if="paymentUrl" :url="paymentUrl" @close="closePaymentFrame" />
  </main>
</template>
