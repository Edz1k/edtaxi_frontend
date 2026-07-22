<script setup lang="ts">
import type { PaymentCard } from '@edtaxi/shared/types/wallet'
import CardBrandMark from '~/components/CardBrandMark.vue'
import PaymentFrameModal from '~/components/PaymentFrameModal.vue'
import { useToast } from '~/composables/useToast'
import { useTripsStore } from '~/stores/trips'
import { useWalletStore } from '~/stores/wallet'

const emit = defineEmits<{
  close: []
}>()

const trips = useTripsStore()
const wallet = useWalletStore()
const toast = useToast()
const titleRef = ref<HTMLElement>()
const paymentUrl = ref('')
const bindAmount = ref(10)
let previousBodyOverflow = ''
let bindOutcomeShown = false
let bindVerifyToken = 0
let bindStartIds = new Set<string>()
let paymentPollTimer: ReturnType<typeof setInterval> | undefined

function tailOf(pan?: null | string) {
  const digits = (pan ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '····'
}

function selectPayment(method: 'cash' | 'prepaid', source: 'apple' | 'google' | null = null) {
  trips.setPrepaySource(source)
  trips.setPaymentMethod(method)
  emit('close')
}

async function chooseCard(item: PaymentCard) {
  if (!item.is_default) {
    const changed = await wallet.setDefaultCard(item.id).then(() => true).catch(() => false)
    if (!changed)
      return
  }
  trips.setPrepaySource(null)
  trips.setPaymentMethod('card')
  emit('close')
}

function stopPaymentPolling() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer)
    paymentPollTimer = undefined
  }
}

function newBoundCard() {
  return wallet.cards.find(item => !bindStartIds.has(item.id))
}

async function finishBindSuccess(item: PaymentCard) {
  if (bindOutcomeShown)
    return
  bindOutcomeShown = true
  stopPaymentPolling()
  paymentUrl.value = ''

  if (!item.is_default) {
    const changed = await wallet.setDefaultCard(item.id).then(() => true).catch(() => false)
    if (!changed)
      return
  }

  trips.setPrepaySource(null)
  trips.setPaymentMethod('card')
  toast.success('Карта привязана', `Для поездки выбрана карта ••${tailOf(item.card_pan)}.`)
  emit('close')
}

async function refreshBoundCards() {
  await wallet.loadCard()
  const item = newBoundCard()
  if (item)
    await finishBindSuccess(item)
}

function startPaymentPolling() {
  stopPaymentPolling()
  paymentPollTimer = setInterval(refreshBoundCards, 3000)
}

async function verifyBindCompleted() {
  const token = ++bindVerifyToken
  for (let attempt = 0; attempt < 5; attempt++) {
    await wallet.loadCard()
    if (token !== bindVerifyToken || bindOutcomeShown)
      return
    const item = newBoundCard()
    if (item) {
      await finishBindSuccess(item)
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  if (token !== bindVerifyToken || bindOutcomeShown)
    return
  bindOutcomeShown = true
  stopPaymentPolling()
  toast.error(
    'Карта не привязалась',
    'Платёж прошёл, но FreedomPay не прислал данные карты. Проверочная сумма будет учтена в кошельке.',
  )
}

function handlePaymentResult(status: 'failure' | 'success') {
  if (status === 'success') {
    verifyBindCompleted()
    return
  }
  if (!bindOutcomeShown) {
    bindOutcomeShown = true
    stopPaymentPolling()
    toast.error('Оплата не прошла', 'Карта не привязана — попробуйте ещё раз.')
  }
}

function closePaymentFrame() {
  paymentUrl.value = ''
  stopPaymentPolling()
  refreshBoundCards()
}

async function startBindCard() {
  bindStartIds = new Set(wallet.cards.map(item => item.id))
  bindOutcomeShown = false
  bindVerifyToken++
  const response = await wallet.bindCard().catch(() => null)
  if (!response)
    return
  if (response.amount)
    bindAmount.value = response.amount
  paymentUrl.value = response.redirect_url
  startPaymentPolling()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !paymentUrl.value)
    emit('close')
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  wallet.loadCard()
  nextTick(() => titleRef.value?.focus())
})

onBeforeUnmount(() => {
  bindVerifyToken++
  stopPaymentPolling()
  document.body.style.overflow = previousBodyOverflow
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/65 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <section
        aria-labelledby="payment-method-title"
        aria-modal="true"
        class="tg-safe-x max-h-[88dvh] max-w-sm w-full flex flex-col overflow-hidden border border-white/10 rounded-t-[2rem] bg-secondary-900 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <div class="shrink-0 px-5 pb-3 pt-3">
          <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2
                id="payment-method-title"
                ref="titleRef"
                class="text-lg text-white font-950 outline-none"
                tabindex="-1"
              >
                Способ оплаты
              </h2>
              <p class="mt-0.5 text-xs text-slate-400">
                Выберите, как оплатить эту поездку
              </p>
            </div>
            <button
              aria-label="Закрыть способы оплаты"
              class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-300 transition active:scale-95"
              type="button"
              @click="emit('close')"
            >
              <span class="i-mdi-close text-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]">
          <p class="mb-2 px-1 text-[11px] text-slate-500 font-900 uppercase">
            Оплата после поездки
          </p>
          <div class="rounded-[1.5rem] bg-white/5 p-2 space-y-1">
            <button
              v-for="item in wallet.cards"
              :key="item.id"
              :disabled="wallet.isMutating"
              class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-55"
              type="button"
              @click="chooseCard(item)"
            >
              <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg bg-white/8">
                <CardBrandMark :brand="item.card_brand" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-white font-900 tracking-wider">•••• {{ tailOf(item.card_pan) }}</span>
                <span class="block text-[11px] text-slate-500 leading-4">Спишется после поездки</span>
              </span>
              <span
                v-if="trips.paymentMethod === 'card' && item.is_default"
                class="i-mdi-check-circle shrink-0 text-5.5 text-main-300"
                aria-label="Выбрано"
              />
            </button>

            <button
              class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-2.5 text-left transition active:scale-[0.99]"
              type="button"
              @click="selectPayment('cash')"
            >
              <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg bg-white/8 text-emerald-300">
                <span class="i-mdi-cash text-6" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-white font-900">Наличные</span>
                <span class="block text-[11px] text-slate-500 leading-4">Оплата водителю</span>
              </span>
              <span
                v-if="trips.paymentMethod === 'cash'"
                class="i-mdi-check-circle shrink-0 text-5.5 text-main-300"
                aria-label="Выбрано"
              />
            </button>
          </div>

          <button
            :disabled="wallet.isMutating"
            class="mt-2 h-12 w-full flex items-center justify-center gap-2 rounded-[1.25rem] bg-white/7 text-sm text-white font-900 transition active:scale-[0.99] disabled:opacity-55"
            type="button"
            @click="startBindCard"
          >
            <span class="i-mdi-credit-card-plus-outline text-5" aria-hidden="true" />
            {{ wallet.isMutating ? 'Открываем FreedomPay…' : 'Добавить новую карту' }}
          </button>
          <p class="mt-1.5 px-2 text-center text-[10px] text-slate-500 leading-4">
            Для проверки карты спишем {{ bindAmount }} ₸ — сумма поступит в ваш кошелёк
          </p>

          <p class="mb-2 mt-4 px-1 text-[11px] text-slate-500 font-900 uppercase">
            Оплата до поездки
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="h-16 flex items-center justify-center gap-2 border rounded-[1.25rem] bg-black text-sm text-white font-900 transition active:scale-[0.99]"
              :class="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'apple' ? 'border-main-400' : 'border-white/10'"
              type="button"
              @click="selectPayment('prepaid', 'apple')"
            >
              <span class="i-mdi-apple text-6" aria-hidden="true" />
              <span>
                <span class="block">Pay</span>
                <span class="block text-[9px] text-white/50 font-700">предоплата</span>
              </span>
            </button>
            <button
              class="h-16 flex items-center justify-center gap-2 border rounded-[1.25rem] bg-white text-sm text-slate-800 font-900 transition active:scale-[0.99]"
              :class="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'google' ? 'border-main-400' : 'border-white/10'"
              type="button"
              @click="selectPayment('prepaid', 'google')"
            >
              <span class="i-mdi-google text-5.5" aria-hidden="true" />
              <span>
                <span class="block">Pay</span>
                <span class="block text-[9px] text-slate-500 font-700">предоплата</span>
              </span>
            </button>
          </div>
          <p class="mt-2 px-2 text-[10px] text-slate-500 leading-4">
            При предоплате поиск водителя начнётся после подтверждения платежа.
          </p>
        </div>
      </section>
    </div>
  </Teleport>

  <PaymentFrameModal
    v-if="paymentUrl"
    :url="paymentUrl"
    @close="closePaymentFrame"
    @result="handlePaymentResult"
  />
</template>
