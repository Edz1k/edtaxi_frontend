import type { EstimateTripResponse, PaymentMethod, VehicleCategory } from '~/types/trips'

// Канонический порядок тарифов в интерфейсе (от дешёвого к дорогому).
export const TARIFF_ORDER: VehicleCategory[] = ['moto', 'economy', 'comfort', 'business', 'minivan']

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
  comfort: {
    caption: 'Больше комфорта',
    icon: 'i-mdi-car-seat',
    label: 'Комфорт',
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
  moto: {
    caption: 'Быстро по городу · 1 пассажир',
    icon: 'i-mdi-motorbike',
    label: 'Мото',
  },
}

export function formatFare(estimate: EstimateTripResponse) {
  return `${Math.round(estimate.estimated_fare).toLocaleString('ru-RU')} ₸`
}

// Способы оплаты для селектора (порядок = порядок в UI). Пока UI-only.
export const PAYMENT_ORDER: PaymentMethod[] = ['cash', 'card']

export const PAYMENT_META: Record<PaymentMethod, { icon: string, label: string }> = {
  cash: { icon: 'i-mdi-cash', label: 'Наличные' },
  card: { icon: 'i-mdi-credit-card-outline', label: 'Карта' },
}
