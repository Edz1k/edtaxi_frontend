import type { EstimateTripResponse, VehicleCategory } from '~/types/trips'

// Канонический порядок тарифов в интерфейсе (от дешёвого к дорогому).
export const TARIFF_ORDER: VehicleCategory[] = ['economy', 'comfort', 'business', 'minivan']

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
}

export function formatFare(estimate: EstimateTripResponse) {
  return `${Math.round(estimate.estimated_fare).toLocaleString('ru-RU')} ₸`
}
