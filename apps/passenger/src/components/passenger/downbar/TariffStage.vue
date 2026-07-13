<script setup lang="ts">
import type { EstimateTripResponse, PaymentMethod, VehicleCategory } from '~/types/trips'
import { getBonusOverview } from '@edtaxi/shared/api/bonus'
import CardBrandMark from '~/components/CardBrandMark.vue'
import CardPickerSheet from '~/components/passenger/downbar/CardPickerSheet.vue'
import { formatFare, PAYMENT_META, PAYMENT_ORDER, TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'
import { useWalletStore } from '~/stores/wallet'

defineProps<{
  primaryText: string
  isOrdering: boolean
}>()

const emit = defineEmits<{
  editRoute: []
  order: []
}>()

const trips = useTripsStore()
const wallet = useWalletStore()

// Есть ли привязанная карта — для подсказки при выборе оплаты картой.
// Заказ не блокируем: бэкенд при отсутствии карты сам откатится на
// баланс кошелька / наличные при завершении поездки.
onMounted(() => {
  if (!wallet.isCardLoaded)
    wallet.loadCard()
})

// Оплата части поездки бонусами (до 50%): при включённом тумблере цены
// показываются со скидкой (зачёркнутая полная + актуальная), фактическое
// списание происходит на завершении по балансу на тот момент.
const bonusBalance = ref(0)

onMounted(() => {
  getBonusOverview()
    .then(overview => (bonusBalance.value = Math.floor(overview.balance)))
    .catch(() => {}) // без баланса тумблер просто не показываем
})

function bonusDiscountFor(estimate: EstimateTripResponse) {
  return Math.floor(Math.min(bonusBalance.value, estimate.estimated_fare * 0.5))
}

function discountedFare(estimate: EstimateTripResponse) {
  return `${Math.max(0, Math.round(estimate.estimated_fare - bonusDiscountFor(estimate))).toLocaleString('ru-RU')} ₸`
}

const showBonusPrices = computed(() => trips.useBonuses && bonusBalance.value > 0 && trips.paymentMethod !== 'prepaid')

const showBindCardHint = computed(() =>
  trips.paymentMethod === 'card' && wallet.isCardLoaded && !wallet.card,
)

// Чип выбранной карты (способ «Карта», карты есть): бренд + последние 4 цифры,
// тап открывает шит выбора.
const isCardPickerOpen = ref(false)
const defaultCardTail = computed(() => {
  const digits = (wallet.card?.card_pan ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '····'
})
const showCardChip = computed(() =>
  trips.paymentMethod === 'card' && wallet.cards.length > 0,
)

// Предоплата (Apple Pay / Google Pay): отдельные кнопки под тоглом оплаты.
// Оба ведут на одну hosted-страницу FreedomPay — какая кнопка нажата, важен
// только для подсветки выбора.
const prepaySource = ref<'apple' | 'google' | null>(null)

function selectMethod(method: PaymentMethod) {
  prepaySource.value = null
  trips.setPaymentMethod(method)
}

function selectPrepay(source: 'apple' | 'google') {
  prepaySource.value = source
  trips.setPaymentMethod('prepaid')
}

// Тарифы в каноничном порядке (стор наполняет по мере оценки).
const tariffs = computed(() =>
  TARIFF_ORDER
    .map(category => trips.tariffEstimates.find(estimate => estimate.category === category))
    .filter(estimate => estimate !== undefined),
)

function isSelected(category: VehicleCategory) {
  return trips.selectedCategory === category
}
</script>

<template>
  <div class="space-y-3">
    <!-- Маршрут -->
    <div class="flex items-center gap-3 rounded-[1.65rem] bg-white/5 p-3">
      <div class="min-w-0 flex-1 space-y-2">
        <p class="flex items-center gap-2 text-sm text-white font-900">
          <span class="i-mdi-near-me shrink-0 text-4.5 text-main-300" aria-hidden="true" />
          <span class="truncate">{{ trips.pickup }}</span>
        </p>
        <p class="flex items-center gap-2 text-sm text-white font-900">
          <span class="i-mdi-flag-checkered shrink-0 text-4.5 text-main-300" aria-hidden="true" />
          <span class="truncate">{{ trips.destination }}</span>
        </p>
      </div>

      <button
        aria-label="Изменить маршрут"
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95 hover:bg-white/12"
        type="button"
        @click="emit('editRoute')"
      >
        <span class="i-mdi-pencil text-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Тарифы: боковая scroll-snap карусель, одиночный выбор -->
    <div>
      <p class="mb-2 px-1 text-[11px] text-main-300 font-900 uppercase">
        Тариф
      </p>

      <div
        class="[scrollbar-width:none] flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 -mx-3 [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Выбор тарифа"
      >
        <button
          v-for="tariff in tariffs"
          :key="tariff.category"
          class="w-27 flex shrink-0 flex-col snap-center items-center gap-1.5 border rounded-2xl px-3 py-3 transition active:scale-[0.97]"
          :class="isSelected(tariff.category)
            ? 'border-main-400 bg-main-500/16 shadow-[0_14px_34px_rgba(230,173,46,0.18)]'
            : 'border-white/8 bg-white/5'"
          role="radio"
          :aria-checked="isSelected(tariff.category)"
          type="button"
          @click="trips.selectCategory(tariff.category)"
        >
          <span
            class="h-12 w-12 flex items-center justify-center rounded-2xl transition"
            :class="isSelected(tariff.category) ? 'bg-main-500/22 text-main-200' : 'bg-white/8 text-white'"
          >
            <span :class="TARIFF_META[tariff.category].icon" class="text-6.5" aria-hidden="true" />
          </span>
          <span class="text-sm text-white font-900">
            {{ TARIFF_META[tariff.category].label }}
          </span>
          <!-- Бонусы включены: зачёркнутая полная цена + актуальная со скидкой -->
          <template v-if="showBonusPrices && bonusDiscountFor(tariff) > 0">
            <span class="text-[11px] text-slate-500 leading-3 line-through">
              {{ formatFare(tariff) }}
            </span>
            <span class="text-sm text-main-200 font-950">
              {{ discountedFare(tariff) }}
            </span>
          </template>
          <span v-else class="text-sm text-white font-950">
            {{ formatFare(tariff) }}
          </span>
        </button>
      </div>

      <p class="mt-1.5 truncate px-1 text-[11px] text-slate-400 font-700">
        {{ TARIFF_META[trips.selectedCategory].caption }}
      </p>

      <!-- Мототакси: напоминание о безопасности (виден пока выбран мото) -->
      <div
        v-if="trips.selectedCategory === 'moto'"
        class="mt-2 flex items-start gap-2 rounded-2xl bg-amber-500/12 px-3 py-2.5"
      >
        <span class="i-mdi-shield-check mt-0.5 shrink-0 text-4.5 text-amber-300" aria-hidden="true" />
        <p class="text-[12px] text-amber-200 leading-4">
          Мототакси: только 1 пассажир. Водитель обязан выдать вам шлем. Поездка застрахована.
        </p>
      </div>
    </div>

    <!-- Способ оплаты -->
    <div class="flex items-center gap-1 rounded-[1.65rem] bg-white/5 p-1.5">
      <span class="shrink-0 pl-2 pr-1 text-[11px] text-slate-400 font-800 uppercase">
        Оплата
      </span>
      <button
        v-for="method in PAYMENT_ORDER"
        :key="method"
        class="h-10 flex flex-1 items-center justify-center gap-1.5 rounded-[1.3rem] text-sm font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === method ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'"
        :aria-pressed="trips.paymentMethod === method"
        type="button"
        @click="selectMethod(method)"
      >
        <span :class="PAYMENT_META[method].icon" class="text-4.5" aria-hidden="true" />
        {{ PAYMENT_META[method].label }}
      </button>
    </div>

    <!-- Предоплата через Apple Pay / Google Pay: оплата вперёд на странице FreedomPay -->
    <div class="grid grid-cols-2 gap-2">
      <button
        aria-label="Оплатить через Apple Pay"
        :aria-pressed="trips.paymentMethod === 'prepaid' && prepaySource === 'apple'"
        class="h-11 flex items-center justify-center gap-1 border rounded-[1.3rem] bg-black text-sm text-white font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === 'prepaid' && prepaySource === 'apple'
          ? 'border-main-400 shadow-[0_0_0_2px_rgba(230,173,46,0.35)]'
          : 'border-white/15'"
        type="button"
        @click="selectPrepay('apple')"
      >
        <span class="i-mdi-apple text-5" aria-hidden="true" />
        Pay
      </button>
      <button
        aria-label="Оплатить через Google Pay"
        :aria-pressed="trips.paymentMethod === 'prepaid' && prepaySource === 'google'"
        class="h-11 flex items-center justify-center gap-1.5 border rounded-[1.3rem] bg-white text-sm text-slate-800 font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === 'prepaid' && prepaySource === 'google'
          ? 'border-main-400 shadow-[0_0_0_2px_rgba(230,173,46,0.35)]'
          : 'border-white/15'"
        type="button"
        @click="selectPrepay('google')"
      >
        <span class="i-mdi-google text-4.5" aria-hidden="true" />
        Pay
      </button>
    </div>

    <!-- Предоплата выбрана: пояснение (бонусы недоступны — сумма фиксируется вперёд) -->
    <p
      v-if="trips.paymentMethod === 'prepaid'"
      class="flex items-start gap-2 rounded-2xl bg-white/5 px-3 py-2.5 text-[12px] text-slate-300 leading-4"
    >
      <span class="i-mdi-shield-lock-outline mt-0.5 shrink-0 text-4.5 text-main-300" aria-hidden="true" />
      Вся поездка оплачивается вперёд на защищённой странице Freedom Pay — там доступны Apple Pay, Google Pay и карта. Поиск водителя начнётся после оплаты.
    </p>

    <!-- Выбранная карта (способ «Карта»): бренд + последние цифры, тап — выбор карты -->
    <button
      v-if="showCardChip"
      class="w-full flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5 text-left transition active:scale-[0.99]"
      type="button"
      @click="isCardPickerOpen = true"
    >
      <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg bg-white/8">
        <CardBrandMark :brand="wallet.card?.card_brand" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm text-white font-900 tracking-wider">•••• {{ defaultCardTail }}</span>
        <span class="block text-[11px] text-slate-400 leading-4">Спишется после завершения поездки</span>
      </span>
      <span class="i-mdi-chevron-right shrink-0 text-5 text-slate-400" aria-hidden="true" />
    </button>

    <!-- Оплатить часть поездки бонусами (до 50%; с предоплатой недоступно) -->
    <button
      v-if="bonusBalance > 0 && trips.paymentMethod !== 'prepaid'"
      class="w-full flex items-center gap-3 rounded-[1.65rem] p-3 text-left transition active:scale-[0.99]"
      :class="trips.useBonuses ? 'bg-main-500/16 border border-main-400/40' : 'bg-white/5 border border-transparent'"
      type="button"
      @click="trips.useBonuses = !trips.useBonuses"
    >
      <span
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl"
        :class="trips.useBonuses ? 'bg-main-500/22 text-main-200' : 'bg-white/8 text-slate-300'"
      >
        <span class="i-mdi-star-four-points text-5.5" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm text-white font-900">
          Списать бонусы — до 50% поездки
        </span>
        <span class="block text-[12px] text-slate-400 leading-4">
          У вас {{ bonusBalance.toLocaleString('ru-RU') }} бонусов · спишутся при завершении поездки
        </span>
      </span>
      <span
        class="h-6 w-11 shrink-0 rounded-full p-0.5 transition"
        :class="trips.useBonuses ? 'bg-main-500' : 'bg-white/12'"
      >
        <span
          class="block h-5 w-5 rounded-full bg-white transition"
          :class="trips.useBonuses ? 'translate-x-5' : ''"
        />
      </span>
    </button>

    <!-- Оплата картой выбрана, но карта не привязана -->
    <RouterLink
      v-if="showBindCardHint"
      class="flex items-start gap-2 rounded-2xl bg-main-500/12 px-3 py-2.5 transition active:scale-[0.99]"
      to="/wallet"
    >
      <span class="i-mdi-credit-card-plus-outline mt-0.5 shrink-0 text-4.5 text-main-300" aria-hidden="true" />
      <p class="text-[12px] text-main-100 leading-4">
        Карта ещё не привязана — привяжите её в «Кошельке», и поездка спишется с карты автоматически.
      </p>
      <span class="i-mdi-chevron-right mt-0.5 shrink-0 text-4.5 text-main-300/70" aria-hidden="true" />
    </RouterLink>

    <!-- Заказать -->
    <button
      :disabled="isOrdering"
      class="h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      type="button"
      @click="emit('order')"
    >
      {{ primaryText }}
    </button>

    <CardPickerSheet v-if="isCardPickerOpen" @close="isCardPickerOpen = false" />
  </div>
</template>
