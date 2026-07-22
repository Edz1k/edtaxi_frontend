import type { CategoryGroup, EstimateTripResponse, PaymentMethod, VehicleCategory } from '~/types/trips'

// Канонический порядок тарифов в интерфейсе (от дешёвого к дорогому внутри
// групп: мото → такси → хантакси) — используется для сортировки выбора.
export const TARIFF_ORDER: VehicleCategory[] = ['moped', 'moto', 'economy', 'comfort', 'business', 'minivan', 'comfort_plus', 'business_plus']

// Фолбэк-набор активных категорий, пока GET /tariffs/categories не ответил
// (или бэк ещё старый): исторический состав, у которого тарифы точно активны.
export const DEFAULT_ACTIVE_CATEGORIES: VehicleCategory[] = ['moto', 'economy', 'comfort', 'business', 'minivan']

// Группа категории (п.30) — зеркало entity.GroupOf бэка: по ней строятся табы
// карусели и действуют мото-правила (запрет опций, согласие на риск).
export const CATEGORY_GROUPS: Record<VehicleCategory, CategoryGroup> = {
  business: 'taxi',
  business_plus: 'khan',
  comfort: 'taxi',
  comfort_plus: 'khan',
  economy: 'taxi',
  minivan: 'taxi',
  moped: 'moto',
  moto: 'moto',
}

export function isMotoCategory(category: VehicleCategory) {
  return CATEGORY_GROUPS[category] === 'moto'
}

// Порядок табов групп в карусели.
export const GROUP_ORDER: CategoryGroup[] = ['moto', 'taxi', 'khan']

export const GROUP_META: Record<CategoryGroup, { icon: string, label: string }> = {
  khan: { icon: 'i-mdi-crown-outline', label: 'Хантакси' },
  moto: { icon: 'i-mdi-motorbike', label: 'Мото' },
  taxi: { icon: 'i-mdi-taxi', label: 'Такси' },
}

export const TARIFF_META: Record<VehicleCategory, {
  caption: string
  icon: string
  label: string
}> = {
  business: {
    caption: 'Премиум авто',
    icon: 'i-mdi-diamond-stone',
    label: 'Бизнес',
  },
  business_plus: {
    caption: 'Хантакси · S-класс',
    icon: 'i-mdi-crown',
    label: 'Бизнес+',
  },
  comfort: {
    caption: 'Больше комфорта',
    icon: 'i-mdi-car-seat',
    label: 'Комфорт',
  },
  comfort_plus: {
    caption: 'Хантакси · выше класс',
    icon: 'i-mdi-car-sports',
    label: 'Комфорт+',
  },
  economy: {
    caption: 'Быстро и выгодно',
    icon: 'i-mdi-car-hatchback',
    label: 'Эконом',
  },
  minivan: {
    caption: 'Для компании',
    icon: 'i-mdi-van-passenger',
    label: 'Минивэн',
  },
  moped: {
    caption: 'Дешевле мото · 1 пассажир',
    icon: 'i-mdi-moped',
    label: 'Мопед',
  },
  moto: {
    caption: 'Быстро по городу · 1 пассажир',
    icon: 'i-mdi-motorbike',
    label: 'Мото',
  },
}

export function formatFare(estimate: EstimateTripResponse, locale = 'ru-RU') {
  return `${Math.round(estimate.estimated_fare).toLocaleString(locale)} ₸`
}

// Способы оплаты для тогла (порядок = порядок в UI). prepaid в тогл не входит —
// его выбирают отдельные кнопки Apple Pay / Google Pay под ним.
export const PAYMENT_ORDER: PaymentMethod[] = ['cash', 'card']

export const PAYMENT_META: Record<PaymentMethod, { icon: string, label: string }> = {
  cash: { icon: 'i-mdi-cash', label: 'Наличные' },
  card: { icon: 'i-mdi-credit-card-outline', label: 'Карта' },
  prepaid: { icon: 'i-mdi-flash-outline', label: 'Предоплата' },
}
