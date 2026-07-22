<script setup lang="ts">
import type { CategoryGroup, EstimateTripResponse, PaymentMethod, VehicleCategory } from '~/types/trips'
import { getBonusOverview } from '@edtaxi/shared/api/bonus'
import CardBrandMark from '~/components/CardBrandMark.vue'
import CardPickerSheet from '~/components/passenger/downbar/CardPickerSheet.vue'
import { CATEGORY_GROUPS, formatFare, GROUP_META, GROUP_ORDER, isMotoCategory, PAYMENT_META, PAYMENT_ORDER, TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'
import { useWalletStore } from '~/stores/wallet'

defineProps<{
  primaryText: string
  isOrdering: boolean
}>()

const emit = defineEmits<{
  addStop: []
  editRoute: []
  order: []
}>()

const trips = useTripsStore()
const wallet = useWalletStore()

// Картинки тарифов из ~/assets/tariffs (economy.png, comfort.png, ...).
// Имя файла = категория. Файла нет → фолбэк на иконку TARIFF_META.
const tariffImages = import.meta.glob<string>(
  '~/assets/tariffs/*.{png,webp,jpg,jpeg,svg}',
  { eager: true, import: 'default', query: '?url' },
)
const imageByCategory = Object.fromEntries(
  Object.entries(tariffImages).map(([path, url]) => [
    path.split('/').pop()!.replace(/\.\w+$/, ''),
    url,
  ]),
) as Partial<Record<VehicleCategory, string>>

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
// Выбор хранится в сторе: Apple Pay даунбар открывает во внешнем браузере
// (в Telegram-вебвью ApplePaySession недоступен), Google Pay — во фрейме.
function selectMethod(method: PaymentMethod) {
  trips.setPrepaySource(null)
  trips.setPaymentMethod(method)
}

function selectPrepay(source: 'apple' | 'google') {
  trips.setPrepaySource(source)
  trips.setPaymentMethod('prepaid')
}

// Тарифы в каноничном порядке (стор наполняет по мере оценки).
const tariffs = computed(() =>
  TARIFF_ORDER
    .map(category => trips.tariffEstimates.find(estimate => estimate.category === category))
    .filter(estimate => estimate !== undefined),
)

// Табы групп (п.30): Мото | Такси | Хантакси. Показываем только группы с
// оценёнными тарифами; единственную группу табами не дублируем.
const availableGroups = computed(() =>
  GROUP_ORDER.filter(group => tariffs.value.some(tariff => CATEGORY_GROUPS[tariff.category] === group)),
)
const activeGroup = ref<CategoryGroup>('taxi')

watch(availableGroups, (groups) => {
  if (groups.length && !groups.includes(activeGroup.value)) {
    const selectedGroup = CATEGORY_GROUPS[trips.selectedCategory]
    activeGroup.value = groups.includes(selectedGroup) ? selectedGroup : groups[0]!
  }
}, { immediate: true })

// Выбор категории пришёл извне карусели (восстановление стора) — таб следует
// за ним, чтобы выбранная карточка не оказалась на скрытом табе.
watch(() => trips.selectedCategory, (category) => {
  const group = CATEGORY_GROUPS[category]
  if (availableGroups.value.includes(group))
    activeGroup.value = group
})

const visibleTariffs = computed(() =>
  availableGroups.value.length > 1
    ? tariffs.value.filter(tariff => CATEGORY_GROUPS[tariff.category] === activeGroup.value)
    : tariffs.value,
)

// Переключение таба сразу выбирает первую категорию группы — иначе подпись и
// кнопка заказа продолжали бы жить на категории со скрытого таба.
function selectGroup(group: CategoryGroup) {
  if (activeGroup.value === group)
    return
  activeGroup.value = group
  const first = tariffs.value.find(tariff => CATEGORY_GROUPS[tariff.category] === group)
  if (first && CATEGORY_GROUPS[trips.selectedCategory] !== group)
    trips.selectCategory(first.category)
}

function isSelected(category: VehicleCategory) {
  return trips.selectedCategory === category
}

// Мото-группа (мотоцикл/мопед) — повышенный риск: договора со страховой пока
// нет, поездка НЕ застрахована. Заказ доступен только после явного согласия
// «еду на свой страх и риск» (чекбокс гейтит кнопку заказа).
const motoConsent = ref(false)
const needsMotoConsent = computed(() => isMotoCategory(trips.selectedCategory) && !motoConsent.value)

// --- Пожелания к заказу (волна 2A) ---

// Кресло/животное на мото-группе невозможны — чипы блокируются, стор при
// выборе мото/мопеда сам снимает платные опции.
const isMotoSelected = computed(() => trips.selectedCategories.some(isMotoCategory))

// Прайс опций из оценки (одинаков для всех категорий; 0 = доплаты нет).
const surchargeChildSeat = computed(() => trips.tariffEstimates[0]?.surcharge_child_seat ?? 0)
const surchargePets = computed(() => trips.tariffEstimates[0]?.surcharge_pets ?? 0)

function surchargeLabel(amount: number) {
  return amount > 0 ? `+${amount.toLocaleString('ru-RU')} ₸` : 'бесплатно'
}

// «Заказ другу»: имя и телефон пассажира-получателя (водитель их увидит).
const isFriendOrder = ref(Boolean(trips.tripOptions.friendName || trips.tripOptions.friendPhone))

function toggleFriendOrder() {
  isFriendOrder.value = !isFriendOrder.value
  if (!isFriendOrder.value) {
    trips.setTripOption('friendName', '')
    trips.setTripOption('friendPhone', '')
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Маршрут -->
    <div class="flex items-center gap-3 rounded-[1.65rem] app-card p-3">
      <div class="min-w-0 flex-1 space-y-2">
        <p class="flex items-center gap-2 text-sm text-white font-900">
          <span class="i-mdi-near-me shrink-0 text-4.5 app-accent" aria-hidden="true" />
          <span class="truncate">{{ trips.pickup }}</span>
        </p>
        <p
          v-for="(stop, index) in trips.confirmedStops"
          :key="`route-stop-${index}`"
          class="flex items-center gap-2 text-sm text-white/80 font-800"
        >
          <span
            class="h-4.5 w-4.5 flex shrink-0 items-center justify-center rounded-full bg-main-500/22 text-[10px] text-main-200 font-950 light:text-main-700"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <span class="truncate">{{ stop.address }}</span>
        </p>
        <p class="flex items-center gap-2 text-sm text-white font-900">
          <span class="i-mdi-flag-checkered shrink-0 text-4.5 app-accent" aria-hidden="true" />
          <span class="truncate">{{ trips.destination }}</span>
        </p>

        <!-- Добавить остановку прямо с тарифов: возврат в форму адреса, где
             новая строка сразу в фокусе (Downbar.addStopFromTariffs). -->
        <button
          v-if="trips.canAddStop"
          class="flex items-center gap-2 pt-0.5 text-[12px] app-accent font-800 transition active:scale-[0.98]"
          type="button"
          @click="emit('addStop')"
        >
          <span class="i-mdi-plus-circle-outline text-4.5" aria-hidden="true" />
          Добавить остановку
        </button>
      </div>

      <button
        aria-label="Изменить маршрут"
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full app-chip text-white transition active:scale-95 hover:bg-white/12"
        type="button"
        @click="emit('editRoute')"
      >
        <span class="i-mdi-pencil text-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Тарифы: боковая scroll-snap карусель, одиночный выбор -->
    <div>
      <p class="mb-2 px-1 text-[11px] app-accent font-900 uppercase">
        Тариф
      </p>

      <!-- Табы групп (п.30): рисуем только когда групп больше одной -->
      <div
        v-if="availableGroups.length > 1"
        class="mb-2 flex gap-1 rounded-2xl app-card p-1"
        role="tablist"
        aria-label="Группа тарифов"
      >
        <button
          v-for="group in availableGroups"
          :key="group"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-900 transition active:scale-[0.98]"
          :class="activeGroup === group ? 'bg-main-500/20 text-main-200 light:text-main-700' : 'text-white/60'"
          role="tab"
          :aria-selected="activeGroup === group"
          type="button"
          @click="selectGroup(group)"
        >
          <span :class="GROUP_META[group].icon" class="text-4.5" aria-hidden="true" />
          {{ GROUP_META[group].label }}
        </button>
      </div>

      <div
        class="[scrollbar-width:none] flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 -mx-3 [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Выбор тарифа"
      >
        <button
          v-for="tariff in visibleTariffs"
          :key="tariff.category"
          class="w-30 flex shrink-0 flex-col snap-center items-center gap-1.5 border rounded-2xl px-3 py-3 transition active:scale-[0.97]"
          :class="isSelected(tariff.category)
            ? 'border-main-400 bg-main-500/16 shadow-[0_14px_34px_rgba(230,173,46,0.18)]'
            : 'border-white/8 app-card'"
          role="radio"
          :aria-checked="isSelected(tariff.category)"
          type="button"
          @click="trips.selectCategory(tariff.category)"
        >
          <div
            v-if="imageByCategory[tariff.category]"
            class="h-18 w-full flex items-center justify-center"
          >
            <img
              :src="imageByCategory[tariff.category]"
              :alt="TARIFF_META[tariff.category].label"
              class="max-h-full max-w-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]"
              draggable="false"
            >
          </div>
          <span
            v-else
            class="h-12 w-12 flex items-center justify-center rounded-2xl transition"
            :class="isSelected(tariff.category) ? 'bg-main-500/22 text-main-200 light:text-main-700' : 'app-chip text-white'"
          >
            <span :class="TARIFF_META[tariff.category].icon" class="text-6.5" aria-hidden="true" />
          </span>
          <span class="text-sm text-white font-900">
            {{ TARIFF_META[tariff.category].label }}
          </span>
          <!-- Бонусы включены: зачёркнутая полная цена + актуальная со скидкой -->
          <template v-if="showBonusPrices && bonusDiscountFor(tariff) > 0">
            <span class="text-[11px] app-faint leading-3 line-through">
              {{ formatFare(tariff) }}
            </span>
            <span class="text-sm text-main-200 font-950 light:text-main-700">
              {{ discountedFare(tariff) }}
            </span>
          </template>
          <span v-else class="text-sm text-white font-950">
            {{ formatFare(tariff) }}
          </span>
        </button>
      </div>

      <p class="mt-1.5 truncate px-1 text-[11px] app-muted font-700">
        {{ TARIFF_META[trips.selectedCategory].caption }}
      </p>

      <!-- Мототакси: предупреждение о рисках + обязательное согласие.
           «Поездка застрахована» убрано осознанно — договора со страховой нет,
           без согласия кнопка заказа неактивна (TODO п.20). -->
      <div
        v-if="isMotoCategory(trips.selectedCategory)"
        class="mt-2 rounded-2xl bg-amber-500/12 px-3 py-2.5 space-y-2"
      >
        <p class="flex items-start gap-2 text-[12px] text-amber-200 leading-4">
          <span class="i-mdi-alert-outline mt-0.5 shrink-0 text-4.5 text-amber-300" aria-hidden="true" />
          Мото-поездка: только 1 пассажир, водитель обязан выдать вам шлем. Поездка не застрахована — вы едете на свой страх и риск.
        </p>
        <button
          class="w-full flex items-center gap-2 rounded-xl app-card px-2.5 py-2 text-left transition active:scale-[0.99]"
          type="button"
          :aria-pressed="motoConsent"
          @click="motoConsent = !motoConsent"
        >
          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition"
            :class="motoConsent ? 'border-amber-300 bg-amber-400 text-slate-900' : 'border-amber-300/50 bg-transparent'"
          >
            <span v-if="motoConsent" class="i-mdi-check text-4" aria-hidden="true" />
          </span>
          <span class="text-[12px] text-amber-100 font-800 leading-4">
            Понимаю риски и согласен ехать на мото
          </span>
        </button>
      </div>
    </div>

    <!-- Пожелания к заказу: платные опции меняют цену (пере-оценка в сторе) -->
    <div>
      <p class="mb-2 px-1 text-[11px] app-accent font-900 uppercase">
        Пожелания
      </p>

      <div class="rounded-[1.65rem] app-card p-2 space-y-1">
        <!-- Детское кресло -->
        <button
          class="w-full flex items-center gap-3 rounded-[1.25rem] px-2.5 py-2.5 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          :aria-pressed="trips.tripOptions.childSeat"
          :disabled="isMotoSelected"
          @click="trips.setTripOption('childSeat', !trips.tripOptions.childSeat)"
        >
          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition"
            :class="trips.tripOptions.childSeat ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
          >
            <span v-if="trips.tripOptions.childSeat" class="i-mdi-check text-4" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 text-sm text-white font-800">Детское кресло</span>
          <span class="shrink-0 text-[12px] app-accent font-900">{{ surchargeLabel(surchargeChildSeat) }}</span>
        </button>

        <!-- С животным -->
        <button
          class="w-full flex items-center gap-3 rounded-[1.25rem] px-2.5 py-2.5 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          :aria-pressed="trips.tripOptions.pets"
          :disabled="isMotoSelected"
          @click="trips.setTripOption('pets', !trips.tripOptions.pets)"
        >
          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition"
            :class="trips.tripOptions.pets ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
          >
            <span v-if="trips.tripOptions.pets" class="i-mdi-check text-4" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 text-sm text-white font-800">Поездка с животным</span>
          <span class="shrink-0 text-[12px] app-accent font-900">{{ surchargeLabel(surchargePets) }}</span>
        </button>

        <p v-if="isMotoSelected" class="px-2.5 pb-1 text-[11px] text-amber-300/90 leading-4">
          Кресло и животные недоступны на мототакси.
        </p>

        <!-- Особые потребности (бесплатно) -->
        <button
          class="w-full flex items-center gap-3 rounded-[1.25rem] px-2.5 py-2.5 text-left transition active:scale-[0.99]"
          type="button"
          :aria-pressed="trips.tripOptions.accessible"
          @click="trips.setTripOption('accessible', !trips.tripOptions.accessible)"
        >
          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition"
            :class="trips.tripOptions.accessible ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
          >
            <span v-if="trips.tripOptions.accessible" class="i-mdi-check text-4" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 text-sm text-white font-800">Особые потребности</span>
          <span class="shrink-0 text-[12px] app-muted font-800">бесплатно</span>
        </button>

        <!-- Заказ другу: имя и телефон пассажира-получателя -->
        <button
          class="w-full flex items-center gap-3 rounded-[1.25rem] px-2.5 py-2.5 text-left transition active:scale-[0.99]"
          type="button"
          :aria-pressed="isFriendOrder"
          @click="toggleFriendOrder"
        >
          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition"
            :class="isFriendOrder ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
          >
            <span v-if="isFriendOrder" class="i-mdi-check text-4" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 text-sm text-white font-800">Заказ другу</span>
          <span class="shrink-0 text-[12px] app-muted font-800">бесплатно</span>
        </button>

        <div v-if="isFriendOrder" class="px-2.5 pb-1.5 space-y-1.5">
          <input
            :value="trips.tripOptions.friendName"
            aria-label="Имя пассажира"
            class="h-11 w-full rounded-[1.1rem] app-card px-3.5 text-sm text-white font-800 outline-none transition focus:bg-white/10 placeholder:app-muted"
            maxlength="100"
            placeholder="Имя пассажира"
            type="text"
            @input="trips.setTripOption('friendName', ($event.target as HTMLInputElement).value)"
          >
          <input
            :value="trips.tripOptions.friendPhone"
            aria-label="Телефон пассажира"
            class="h-11 w-full rounded-[1.1rem] app-card px-3.5 text-sm text-white font-800 outline-none transition focus:bg-white/10 placeholder:app-muted"
            inputmode="tel"
            maxlength="32"
            placeholder="Телефон пассажира"
            type="tel"
            @input="trips.setTripOption('friendPhone', ($event.target as HTMLInputElement).value)"
          >
          <p class="px-1 text-[11px] app-muted leading-4">
            Водитель увидит имя и телефон — он везёт вашего друга, звонки пойдут ему.
          </p>
        </div>

        <!-- Комментарий водителю -->
        <textarea
          :value="trips.tripComment"
          aria-label="Комментарий водителю"
          class="min-h-16 w-full resize-none rounded-[1.25rem] app-card px-3.5 py-2.5 text-sm text-white font-800 outline-none transition focus:bg-white/10 placeholder:app-muted"
          maxlength="500"
          placeholder="Комментарий водителю: подъезд, домофон, ориентир..."
          rows="2"
          @input="trips.setTripComment(($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>

    <!-- Способ оплаты -->
    <div class="flex items-center gap-1 rounded-[1.65rem] app-card p-1.5">
      <span class="shrink-0 pl-2 pr-1 text-[11px] app-muted font-800 uppercase">
        Оплата
      </span>
      <button
        v-for="method in PAYMENT_ORDER"
        :key="method"
        class="h-10 flex flex-1 items-center justify-center gap-1.5 rounded-[1.3rem] text-sm font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === method ? 'bg-white/12 text-white' : 'app-muted hover:text-white'"
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
        :aria-pressed="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'apple'"
        class="h-11 flex items-center justify-center gap-1 border rounded-[1.3rem] bg-black text-sm text-white font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'apple'
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
        :aria-pressed="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'google'"
        class="h-11 flex items-center justify-center gap-1.5 border rounded-[1.3rem] bg-white text-sm text-slate-800 font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === 'prepaid' && trips.prepaySource === 'google'
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
      class="flex items-start gap-2 rounded-2xl app-card px-3 py-2.5 text-[12px] text-slate-300 leading-4 light:text-slate-600"
    >
      <span class="i-mdi-shield-lock-outline mt-0.5 shrink-0 text-4.5 app-accent" aria-hidden="true" />
      Вся поездка оплачивается вперёд на защищённой странице Freedom Pay — там доступны Apple Pay, Google Pay и карта. Поиск водителя начнётся после оплаты.
    </p>

    <!-- Выбранная карта (способ «Карта»): бренд + последние цифры, тап — выбор карты -->
    <button
      v-if="showCardChip"
      class="w-full flex items-center gap-3 rounded-2xl app-card px-3 py-2.5 text-left transition active:scale-[0.99]"
      type="button"
      @click="isCardPickerOpen = true"
    >
      <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg app-chip">
        <CardBrandMark :brand="wallet.card?.card_brand" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm text-white font-900 tracking-wider">•••• {{ defaultCardTail }}</span>
        <span class="block text-[11px] app-muted leading-4">Спишется после завершения поездки</span>
      </span>
      <span class="i-mdi-chevron-right shrink-0 text-5 app-muted" aria-hidden="true" />
    </button>

    <!-- Оплатить часть поездки бонусами (до 50%; с предоплатой недоступно) -->
    <button
      v-if="bonusBalance > 0 && trips.paymentMethod !== 'prepaid'"
      class="w-full flex items-center gap-3 rounded-[1.65rem] p-3 text-left transition active:scale-[0.99]"
      :class="trips.useBonuses ? 'bg-main-500/16 border border-main-400/40' : 'app-card border border-transparent'"
      type="button"
      @click="trips.useBonuses = !trips.useBonuses"
    >
      <span
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl"
        :class="trips.useBonuses ? 'bg-main-500/22 text-main-200 light:text-main-700' : 'app-chip text-slate-300 light:text-slate-600'"
      >
        <span class="i-mdi-star-four-points text-5.5" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm text-white font-900">
          Списать бонусы — до 50% поездки
        </span>
        <span class="block text-[12px] app-muted leading-4">
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
      <span class="i-mdi-credit-card-plus-outline mt-0.5 shrink-0 text-4.5 app-accent" aria-hidden="true" />
      <p class="text-[12px] text-main-100 leading-4 light:text-main-700">
        Карта ещё не привязана — привяжите её в «Кошельке», и поездка спишется с карты автоматически.
      </p>
      <span class="app-accent/70 i-mdi-chevron-right mt-0.5 shrink-0 text-4.5" aria-hidden="true" />
    </RouterLink>

    <!-- Заказать (мото — только после согласия с рисками) -->
    <button
      :disabled="isOrdering || needsMotoConsent"
      class="h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      type="button"
      @click="emit('order')"
    >
      {{ needsMotoConsent ? 'Подтвердите согласие с рисками' : primaryText }}
    </button>

    <CardPickerSheet v-if="isCardPickerOpen" @close="isCardPickerOpen = false" />
  </div>
</template>
