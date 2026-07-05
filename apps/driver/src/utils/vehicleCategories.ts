import type { VehicleCategory } from '~/types/trips'

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  business: 'Бизнес',
  comfort: 'Комфорт',
  economy: 'Эконом',
  minivan: 'Минивэн',
  moto: 'Мото',
}

// Порядок отображения тарифов: от дешёвого к дорогому, минивэн и мото отдельно.
export const CATEGORY_ORDER: VehicleCategory[] = ['economy', 'comfort', 'business', 'minivan', 'moto']

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as VehicleCategory] ?? category
}

export function sortCategories(categories: VehicleCategory[]) {
  return [...categories].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
}
