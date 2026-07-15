<script setup lang="ts">
import type { PayoutStatus } from '~/types/driver'
import EarningsChart from '~/components/driver/EarningsChart.vue'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useToast } from '~/composables/useToast'
import { useDriverEarningsStore } from '~/stores/driverEarnings'
import { MIN_PAYOUT_AMOUNT } from '~/types/driver'

const earnings = useDriverEarningsStore()
const toast = useToast()
const topUpAmount = ref(2000)
const paymentUrl = ref('')
let paymentPollTimer: ReturnType<typeof setInterval> | undefined

const isPayoutFormOpen = ref(false)
const payoutAmount = ref(MIN_PAYOUT_AMOUNT)
const payoutDestination = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Заработок | Telegram Taxi',
})

async function refresh() {
  await Promise.all([
    earnings.loadEarnings().catch(() => {}),
    earnings.loadWallet().catch(() => {}),
    earnings.loadPayouts().catch(() => {}),
    earnings.loadChartTrips().catch(() => {}),
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

const availableBalance = computed(() => earnings.wallet?.available_balance ?? 0)

const canRequestPayout = computed(() =>
  payoutAmount.value >= MIN_PAYOUT_AMOUNT
  && payoutAmount.value <= availableBalance.value
  && Boolean(payoutDestination.value.trim()),
)

async function submitPayout() {
  await earnings.requestPayout(payoutAmount.value, payoutDestination.value.trim())
  isPayoutFormOpen.value = false
  payoutAmount.value = MIN_PAYOUT_AMOUNT
  payoutDestination.value = ''
  toast.success('Заявка создана', 'Мы переведём деньги после проверки заявки.')
}

const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'На рассмотрении',
  paid: 'Выплачено',
  rejected: 'Отклонено',
}

function payoutStatusClass(status: PayoutStatus) {
  if (status === 'paid')
    return 'bg-emerald-500/12 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/12 text-red-300'
  return 'bg-amber-500/12 text-amber-300'
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

        <!-- Разбивка дохода: наличными (получено в руки) и картой/кошельком -->
        <div class="grid grid-cols-2 mt-4 gap-2">
          <div class="rounded-2xl bg-white/6 px-3 py-2.5">
            <p class="flex items-center gap-1 text-xs text-slate-400 font-800">
              <span class="i-mdi-cash text-4 text-emerald-300" />
              Наличными
            </p>
            <p class="mt-0.5 text-lg font-950">
              {{ formatMoney(earnings.earnings?.cash_earned ?? 0) }}
            </p>
          </div>
          <div class="rounded-2xl bg-white/6 px-3 py-2.5">
            <p class="flex items-center gap-1 text-xs text-slate-400 font-800">
              <span class="i-mdi-credit-card-outline text-4 text-main-300" />
              Картой
            </p>
            <p class="mt-0.5 text-lg font-950">
              {{ formatMoney(earnings.earnings?.card_earned ?? 0) }}
            </p>
          </div>
        </div>
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

      <EarningsChart
        class="mt-6"
        :loading="earnings.isLoadingChartTrips"
        :trips="earnings.chartTrips"
        :truncated="earnings.isChartTripsTruncated"
      />

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
          Баланс
        </p>
        <p class="mt-2 text-4xl text-main-200 font-950">
          {{ formatMoney(earnings.wallet?.available_balance ?? 0) }}
        </p>
        <!-- Долг не блокирует работу: комиссии наличных поездок копятся и
             автоматически списываются при следующем пополнении. -->
        <template v-if="earnings.wallet && earnings.wallet.debt_balance > 0">
          <p class="mt-1 text-sm text-red-300">
            Долг по наличным поездкам: {{ formatMoney(earnings.wallet.debt_balance) }}
          </p>
          <p class="mt-0.5 text-xs text-slate-400 leading-4">
            Долг не мешает выходить на линию — спишется автоматически при следующем пополнении (это будет видно в истории).
          </p>
        </template>
        <p v-else class="mt-1 text-sm text-slate-400">
          Выходить на линию можно с любым балансом.
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

      <!-- Вывод средств -->
      <section class="mt-6 border border-main-500/20 rounded-3xl bg-white/6 p-5">
        <p class="text-xs text-slate-400 font-800 uppercase">
          Вывод средств
        </p>
        <p class="mt-1 text-sm text-slate-400">
          Минимальная сумма — {{ formatMoney(MIN_PAYOUT_AMOUNT) }}. Заявку проверит администратор.
        </p>

        <button
          v-if="!isPayoutFormOpen"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          :disabled="availableBalance < MIN_PAYOUT_AMOUNT"
          type="button"
          @click="isPayoutFormOpen = true"
        >
          Вывести
        </button>
        <p v-if="!isPayoutFormOpen && availableBalance < MIN_PAYOUT_AMOUNT" class="mt-2 text-center text-xs text-slate-500 font-700">
          Недостаточно средств для вывода
        </p>

        <form v-if="isPayoutFormOpen" class="mt-4 space-y-3" @submit.prevent="submitPayout">
          <div>
            <label class="text-xs text-slate-400 font-800 uppercase" for="payout-amount">
              Сумма
            </label>
            <input
              id="payout-amount"
              v-model.number="payoutAmount"
              class="mt-2 h-13 w-full border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-base text-white outline-none focus:border-main-400"
              inputmode="numeric"
              :max="availableBalance"
              :min="MIN_PAYOUT_AMOUNT"
              name="payout_amount"
              type="number"
            >
          </div>

          <div>
            <label class="text-xs text-slate-400 font-800 uppercase" for="payout-destination">
              Реквизиты (карта или IBAN)
            </label>
            <input
              id="payout-destination"
              v-model="payoutDestination"
              class="mt-2 h-13 w-full border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-sm text-white outline-none focus:border-main-400"
              maxlength="200"
              name="payout_destination"
              placeholder="Например, 4400 1234 5678 9012"
            >
          </div>

          <div class="flex gap-2">
            <button
              :disabled="earnings.isRequestingPayout || !canRequestPayout"
              class="h-13 flex-1 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="submit"
            >
              {{ earnings.isRequestingPayout ? 'Отправляем...' : 'Создать заявку' }}
            </button>
            <button
              class="h-13 rounded-2xl bg-white/8 px-5 text-sm font-900 transition active:scale-[0.98]"
              type="button"
              @click="isPayoutFormOpen = false"
            >
              Отмена
            </button>
          </div>
        </form>
      </section>

      <!-- Заявки на вывод -->
      <section v-if="earnings.payouts.length || earnings.isLoadingPayouts" class="mt-6">
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Заявки на вывод
        </h2>

        <div v-if="earnings.isLoadingPayouts && !earnings.payouts.length" class="mt-3 space-y-2">
          <div v-for="item in 3" :key="item" class="h-16 animate-pulse rounded-2xl bg-white/6" />
        </div>

        <div v-else class="mt-3 space-y-2">
          <article v-for="payout in earnings.payouts" :key="payout.id" class="rounded-2xl bg-white/5 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-lg font-950">
                  {{ formatMoney(payout.amount) }}
                </p>
                <p class="mt-0.5 truncate text-xs text-slate-400 font-700">
                  {{ payout.destination || 'Реквизиты не указаны' }}
                </p>
                <p class="mt-0.5 text-xs text-slate-500 font-700">
                  {{ formatDate(payout.created_at) }}
                </p>
              </div>
              <span class="shrink-0 rounded-full px-3 py-1.5 text-xs font-900" :class="payoutStatusClass(payout.status)">
                {{ PAYOUT_STATUS_LABELS[payout.status] }}
              </span>
            </div>
            <p v-if="payout.status === 'rejected' && payout.rejection_reason" class="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 leading-4">
              Причина отказа: {{ payout.rejection_reason }}
            </p>
          </article>
        </div>
      </section>
    </section>

    <PaymentFrameModal v-if="paymentUrl" :url="paymentUrl" @close="closePaymentFrame" />
  </main>
</template>
