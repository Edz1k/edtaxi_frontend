import type { VehicleCategory } from '~/types/trips'

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  business: 'Бизнес',
  business_plus: 'Бизнес+',
  comfort: 'Комфорт',
  comfort_plus: 'Комфорт+',
  economy: 'Эконом',
  minivan: 'Минивэн',
  moped: 'Мопед',
  moto: 'Мото',
}

// Порядок отображения тарифов: от дешёвого к дорогому, минивэн, хан-классы
// (Комфорт+/Бизнес+ — «Хантакси», п.30) и мото-лестница отдельно.
export const CATEGORY_ORDER: VehicleCategory[] = ['economy', 'comfort', 'business', 'comfort_plus', 'business_plus', 'minivan', 'moped', 'moto']

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as VehicleCategory] ?? category
}

export function sortCategories(categories: VehicleCategory[]) {
  return [...categories].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
}
