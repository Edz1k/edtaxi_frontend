import type { TariffCategory, TariffCategoryGroup } from '~/types/admin'

// Порядок категорий фиксирован — совпадает с entity.AllVehicleCategories()
// на бэкенде, чтобы карточки и график не прыгали местами между загрузками.
export const CATEGORY_ORDER: TariffCategory[] = ['moped', 'moto', 'economy', 'comfort', 'business', 'minivan', 'comfort_plus', 'business_plus']

export const CATEGORY_LABELS: Record<TariffCategory, string> = {
  moped: 'Мопед',
  moto: 'Мото',
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
  comfort_plus: 'Комфорт+',
  business_plus: 'Бизнес+',
}

export const CATEGORY_ICONS: Record<TariffCategory, string> = {
  moped: 'i-mdi-moped',
  moto: 'i-mdi-motorbike',
  economy: 'i-mdi-car-hatchback',
  comfort: 'i-mdi-car',
  business: 'i-mdi-car-sports',
  minivan: 'i-mdi-van-passenger',
  comfort_plus: 'i-mdi-car-select',
  business_plus: 'i-mdi-crown',
}

// Группа категории — зеркало entity.GroupOf на бэке (п.30).
export const CATEGORY_GROUPS: Record<TariffCategory, TariffCategoryGroup> = {
  moped: 'moto',
  moto: 'moto',
  economy: 'taxi',
  comfort: 'taxi',
  business: 'taxi',
  minivan: 'taxi',
  comfort_plus: 'khan',
  business_plus: 'khan',
}

export const CATEGORY_GROUP_LABELS: Record<TariffCategoryGroup, string> = {
  moto: 'Мото',
  taxi: 'Такси',
  khan: 'Хантакси',
}
