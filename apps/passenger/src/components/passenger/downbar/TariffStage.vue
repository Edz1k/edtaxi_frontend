<script setup lang="ts">
import type { CategoryGroup, EstimateTripResponse, VehicleCategory } from '~/types/trips'
import { getBonusOverview } from '@edtaxi/shared/api/bonus'
import { CATEGORY_GROUPS, formatFare, GROUP_META, GROUP_ORDER, isMotoCategory, TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'

defineProps<{
  motoConsent: boolean
}>()

const emit = defineEmits<{
  'addStop': []
  'editRoute': []
  'update:motoConsent': [value: boolean]
}>()

const trips = useTripsStore()

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
        <p
          v-for="(stop, index) in trips.confirmedStops"
          :key="`route-stop-${index}`"
          class="flex items-center gap-2 text-sm text-white/80 font-800"
        >
          <span
            class="h-4.5 w-4.5 flex shrink-0 items-center justify-center rounded-full bg-main-500/22 text-[10px] text-main-200 font-950"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <span class="truncate">{{ stop.address }}</span>
        </p>
        <p class="flex items-center gap-2 text-sm text-white font-900">
          <span class="i-mdi-flag-checkered shrink-0 text-4.5 text-main-300" aria-hidden="true" />
          <span class="truncate">{{ trips.destination }}</span>
        </p>

        <!-- Добавить остановку прямо с тарифов: возврат в форму адреса, где
             новая строка сразу в фокусе (Downbar.addStopFromTariffs). -->
        <button
          v-if="trips.canAddStop"
          class="flex items-center gap-2 pt-0.5 text-[12px] text-main-300 font-800 transition active:scale-[0.98]"
          type="button"
          @click="emit('addStop')"
        >
          <span class="i-mdi-plus-circle-outline text-4.5" aria-hidden="true" />
          Добавить остановку
        </button>
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

      <!-- Табы групп (п.30): рисуем только когда групп больше одной -->
      <div
        v-if="availableGroups.length > 1"
        class="mb-2 flex gap-1 rounded-2xl bg-white/5 p-1"
        role="tablist"
        aria-label="Группа тарифов"
      >
        <button
          v-for="group in availableGroups"
          :key="group"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-900 transition active:scale-[0.98]"
          :class="activeGroup === group ? 'bg-main-500/20 text-main-200' : 'text-white/60'"
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
            : 'border-white/8 bg-white/5'"
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
          class="w-full flex items-center gap-2 rounded-xl bg-white/6 px-2.5 py-2 text-left transition active:scale-[0.99]"
          type="button"
          :aria-pressed="motoConsent"
          @click="emit('update:motoConsent', !motoConsent)"
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
  </div>
</template>
