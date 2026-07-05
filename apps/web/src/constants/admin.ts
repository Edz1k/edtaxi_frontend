import type { TariffCategory } from '~/types/admin'

// Порядок категорий фиксирован — совпадает с entity.AllVehicleCategories()
// на бэкенде, чтобы карточки и график не прыгали местами между загрузками.
export const CATEGORY_ORDER: TariffCategory[] = ['moto', 'economy', 'comfort', 'business', 'minivan']

export const CATEGORY_LABELS: Record<TariffCategory, string> = {
  moto: 'Мото',
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}

export const CATEGORY_ICONS: Record<TariffCategory, string> = {
  moto: 'i-mdi-motorbike',
  economy: 'i-mdi-car-hatchback',
  comfort: 'i-mdi-car',
  business: 'i-mdi-car-sports',
  minivan: 'i-mdi-van-passenger',
}
