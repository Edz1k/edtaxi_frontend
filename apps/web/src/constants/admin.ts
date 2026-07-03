import type { TariffCategory } from '~/types/admin'

// Порядок категорий фиксирован — совпадает с entity.AllVehicleCategories()
// на бэкенде, чтобы карточки и график не прыгали местами между загрузками.
export const CATEGORY_ORDER: TariffCategory[] = ['economy', 'comfort', 'business', 'minivan']

export const CATEGORY_LABELS: Record<TariffCategory, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}
