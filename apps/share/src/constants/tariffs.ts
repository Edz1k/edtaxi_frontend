import type { VehicleCategory } from '~/types/trips'

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
