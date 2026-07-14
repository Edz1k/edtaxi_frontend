<script setup lang="ts">
import type { PaymentCard, WalletTransaction, WalletTransactionType } from '@edtaxi/shared/types/wallet'
import CardBrandMark from '~/components/CardBrandMark.vue'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useToast } from '~/composables/useToast'
import { useWalletStore } from '~/stores/wallet'

const wallet = useWalletStore()
const toast = useToast()
const amount = ref(2000)
const paymentUrl = ref('')
// Что оплачивается во фрейме: привязка карты (после успеха ждём появления
// карты) или обычное пополнение.
const paymentKind = ref<'bind' | 'topup'>('topup')
const isTopUpOpen = ref(false)
// Карта, которую пользователь собирается отвязать (модалка подтверждения).
const unbindTarget = ref<null | PaymentCard>(null)
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

// Хвост карты: 4400-43XX-XXXX-1234 -> 1234.
function tailOf(pan?: null | string) {
  const digits = (pan ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '····'
}

const cardTail = computed(() => tailOf(wallet.card?.card_pan))

// Прочие карты (кроме основной) — списком под виджетом.
const otherCards = computed(() => wallet.cards.filter(item => item.id !== wallet.card?.id))

async function refresh() {
  await Promise.all([
    wallet.loadWallet().catch(() => {}),
    wallet.loadHistory(20, 0).catch(() => {}),
    wallet.loadCard(),
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
  paymentPollTimer = setInterval(async () => {
    const hadCards = wallet.cards.length
    await refresh()
    // Привязка завершена (карт стало больше) — закрываем фрейм сами, не
    // дожидаясь пользователя. Новая карта становится основной на бэке.
    if (paymentKind.value === 'bind' && wallet.cards.length > hadCards) {
      closePaymentFrame()
      notifyBindSuccess()
    }
  }, 3000)
}

// --- Итог привязки: успех/провал говорим явно, а не молчим ---

// Сколько карт было ДО начала привязки и показали ли уже итоговый тост —
// защита от дублей (итог могут заметить и поллинг, и postMessage со страницы
// возврата).
let bindStartCount = 0
let bindOutcomeShown = false
let bindVerifyToken = 0

function notifyBindSuccess() {
  if (bindOutcomeShown)
    return
  bindOutcomeShown = true
  toast.success('Карта привязана', `Поездки теперь оплачиваются с карты ••${cardTail.value}.`)
}

// Оплата привязки прошла (сигнал со страницы возврата), но карту приносит
// асинхронный вебхук — ждём её до ~10 секунд. Если карта так и не появилась,
// дело не в оплате: шлюз не прислал recurring-профиль (сохранение карт не
// включено мерчанту / тестовый режим) — говорим об этом прямо.
async function verifyBindCompleted() {
  const token = ++bindVerifyToken
  for (let attempt = 0; attempt < 5; attempt++) {
    await wallet.loadCard()
    if (token !== bindVerifyToken || bindOutcomeShown)
      return
    if (wallet.cards.length > bindStartCount) {
      notifyBindSuccess()
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  if (token !== bindVerifyToken || bindOutcomeShown)
    return
  bindOutcomeShown = true
  toast.error(
    'Карта не привязалась',
    'Оплата прошла (сумма вернётся), но платёжный сервис не прислал данные карты — сохранение карт ещё не включено для магазина. Мы запросили включение у FreedomPay.',
  )
}

function handlePaymentResult(status: 'failure' | 'success') {
  if (paymentKind.value !== 'bind')
    return
  if (status === 'failure') {
    if (!bindOutcomeShown) {
      bindOutcomeShown = true
      toast.error('Оплата не прошла', 'Карта не привязана — попробуйте ещё раз.')
    }
    return
  }
  verifyBindCompleted()
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

// Сумма проверочного платежа привязки: источник истины — бэкенд
// (BindCardResponse.amount, entity.CardBindAmount); 10 ₸ — лишь дефолт до
// первого ответа, чтобы текст не разъезжался с реальностью при смене суммы.
const bindAmount = ref(10)

async function startBindCard() {
  const response = await wallet.bindCard().catch(() => null)
  if (!response)
    return
  if (response.amount)
    bindAmount.value = response.amount
  paymentKind.value = 'bind'
  bindStartCount = wallet.cards.length
  bindOutcomeShown = false
  bindVerifyToken++
  paymentUrl.value = response.redirect_url
  startPaymentPolling()
}

async function submitTopUp() {
  const response = await wallet.topUp(amount.value)
  paymentKind.value = 'topup'
  paymentUrl.value = response.redirect_url
  startPaymentPolling()
}

async function confirmUnbind() {
  const target = unbindTarget.value
  unbindTarget.value = null
  if (target)
    await wallet.unbindCard(target.id).catch(() => {})
}

async function makeDefault(item: PaymentCard) {
  await wallet.setDefaultCard(item.id).catch(() => {})
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
          Оплата
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Кошелек
        </h1>
      </header>

      <!-- Привязанная карта: главный способ оплаты -->
      <section class="mt-6">
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Способ оплаты
        </h2>

        <!-- Карта привязана: виджет основной карты + список остальных -->
        <div v-if="wallet.card" class="mt-3">
          <div class="relative overflow-hidden rounded-3xl from-main-500/85 via-main-600/80 to-secondary-950 bg-gradient-to-br p-5 shadow-[0_18px_50px_rgba(230,173,46,0.22)]">
            <div class="pointer-events-none absolute h-40 w-40 rounded-full bg-white/10 blur-2xl -right-8 -top-10" />
            <div class="flex items-start justify-between">
              <span class="i-mdi-contactless-payment text-7 text-white/80" />
              <span class="text-sm text-white/90 font-950 tracking-wide">EdTaxi Pay</span>
            </div>
            <p class="mt-6 text-2xl font-950 tracking-[0.22em]">
              •••• •••• •••• {{ cardTail }}
            </p>
            <div class="mt-4 flex items-center justify-between text-xs text-white/75 font-800">
              <span class="inline-flex items-center gap-1.5">
                <span class="i-mdi-shield-check text-4" />
                Основная карта
              </span>
              <CardBrandMark :brand="wallet.card.card_brand" />
            </div>
          </div>

          <p class="mt-3 rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 font-700 leading-4">
            <span class="i-mdi-check-circle mr-1 inline-block align-middle text-4 text-emerald-300" />
            Поездки со способом «Карта» списываются с этой карты автоматически после завершения.
          </p>

          <!-- Остальные карты: сделать основной или отвязать -->
          <div v-if="otherCards.length" class="mt-3 space-y-2">
            <div
              v-for="item in otherCards"
              :key="item.id"
              class="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5"
            >
              <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg bg-white/8">
                <CardBrandMark :brand="item.card_brand" />
              </span>
              <span class="min-w-0 flex-1 text-sm font-900 tracking-wider">
                •••• {{ tailOf(item.card_pan) }}
              </span>
              <button
                :disabled="wallet.isMutating"
                class="h-9 shrink-0 rounded-xl bg-white/8 px-3 text-[11px] text-slate-300 font-800 transition active:scale-[0.97] disabled:opacity-60"
                type="button"
                @click="makeDefault(item)"
              >
                Сделать основной
              </button>
              <button
                :aria-label="`Отвязать карту ••${tailOf(item.card_pan)}`"
                :disabled="wallet.isMutating"
                class="h-9 w-9 flex shrink-0 items-center justify-center rounded-xl bg-white/8 text-slate-400 transition active:scale-[0.95] hover:text-red-300 disabled:opacity-60"
                type="button"
                @click="unbindTarget = item"
              >
                <span class="i-mdi-trash-can-outline text-4.5" />
              </button>
            </div>
          </div>

          <div class="mt-3 flex gap-2">
            <button
              :disabled="wallet.isMutating"
              class="h-11 flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/6 text-xs text-slate-300 font-800 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="startBindCard"
            >
              <span class="i-mdi-credit-card-plus-outline text-4.5" />
              Привязать ещё карту
            </button>
            <button
              :disabled="wallet.isMutating"
              class="h-11 flex flex-1 items-center justify-center rounded-2xl bg-white/6 text-xs text-slate-400 font-800 transition active:scale-[0.98] hover:text-red-300 disabled:opacity-60"
              type="button"
              @click="unbindTarget = wallet.card"
            >
              Отвязать основную
            </button>
          </div>
        </div>

        <!-- Карты нет: приглашение привязать -->
        <div v-else class="mt-3 border-2 border-white/12 rounded-3xl border-dashed bg-white/4 p-5">
          <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-main-500/14 text-main-200">
            <span class="i-mdi-credit-card-plus-outline text-7" />
          </span>
          <h3 class="mt-3 text-lg font-950">
            Привяжите карту
          </h3>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Поездки будут оплачиваться автоматически — без наличных и ручных пополнений.
          </p>

          <ul class="mt-3 text-xs text-slate-400 leading-4 space-y-2">
            <li class="flex items-start gap-2">
              <span class="i-mdi-flash mt-0.5 shrink-0 text-4 text-main-300" />
              Списание после завершения поездки — ровно по счёту
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-cash-refund mt-0.5 shrink-0 text-4 text-main-300" />
              Для проверки карты спишем {{ bindAmount }} ₸ и сразу вернём их на карту
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-lock-outline mt-0.5 shrink-0 text-4 text-main-300" />
              Данные карты хранит платёжный сервис Freedom Pay, а не приложение
            </li>
          </ul>

          <button
            :disabled="wallet.isMutating"
            class="mt-4 h-13 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="startBindCard"
          >
            <span class="i-mdi-credit-card-plus text-5" />
            {{ wallet.isMutating ? 'Готовим оплату...' : 'Привязать карту' }}
          </button>
        </div>
      </section>

      <!-- Баланс: бонусы, возвраты и запас на поездки без карты -->
      <section class="mt-6 border border-main-500/20 rounded-3xl bg-white/6 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-400 font-800 uppercase">
              Баланс
            </p>
            <p class="mt-1 text-3xl text-main-200 font-950">
              {{ balance }}
            </p>
          </div>
          <button
            class="h-11 inline-flex items-center gap-1.5 rounded-2xl bg-white/8 px-4 text-sm font-900 transition active:scale-[0.98]"
            type="button"
            @click="isTopUpOpen = !isTopUpOpen"
          >
            <span :class="isTopUpOpen ? 'i-mdi-chevron-up' : 'i-mdi-plus'" class="text-4.5" />
            Пополнить
          </button>
        </div>

        <form v-if="isTopUpOpen" class="grid grid-cols-[1fr_auto] mt-4 gap-2" @submit.prevent="submitTopUp">
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
            {{ wallet.isMutating ? '...' : 'Оплатить' }}
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

    <!-- Подтверждение отвязки карты -->
    <Teleport to="body">
      <div
        v-if="unbindTarget"
        class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="unbindTarget = null"
      >
        <div class="max-w-sm w-full border border-white/10 rounded-3xl bg-secondary-900 p-5 shadow-2xl">
          <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-red-500/14 text-red-300">
            <span class="i-mdi-credit-card-remove-outline text-7" />
          </span>
          <h3 class="mt-4 text-lg font-950">
            Отвязать карту ••{{ tailOf(unbindTarget.card_pan) }}?
          </h3>
          <p class="mt-2 text-sm text-slate-400 leading-5">
            Поездки перестанут оплачиваться с этой карты. Привязать её снова можно в любой момент.
          </p>
          <div class="mt-5 flex gap-2">
            <button
              class="h-12 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
              type="button"
              @click="unbindTarget = null"
            >
              Оставить
            </button>
            <button
              :disabled="wallet.isMutating"
              class="h-12 flex-1 rounded-2xl bg-red-500/80 text-sm text-white font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="confirmUnbind"
            >
              Отвязать
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <PaymentFrameModal v-if="paymentUrl" :url="paymentUrl" @close="closePaymentFrame" @result="handlePaymentResult" />
  </main>
</template>
