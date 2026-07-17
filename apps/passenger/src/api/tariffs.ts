import type { TariffCategoryInfo } from '~/types/trips'
import { apiRequest } from '~/api/client'

// Активные категории тарифов с группами (п.30) — источник карусели: оцениваем
// только их (оценка категории без активного тарифа падает на бэке).
export function getTariffCategories() {
  return apiRequest<{ categories: TariffCategoryInfo[] }>('/tariffs/categories')
}
