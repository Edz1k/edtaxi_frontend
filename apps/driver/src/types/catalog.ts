import type { VehicleCategory } from '~/types/trips'

// Строка каталога машин: по марке/модели/годам выпуска определяет,
// какие тарифы доступны автомобилю.
export interface CatalogCarItem {
  make: string
  model: string
  year_from: number
  // year_to == null — модель выпускается до сих пор.
  year_to: null | number
  // max_class == null — машина доступна только как минивэн.
  max_class: null | VehicleCategory
  is_minivan: boolean
}

export interface CatalogCarsResponse {
  items: CatalogCarItem[]
}

export interface CatalogResolveResponse {
  matched: boolean
  categories: VehicleCategory[]
}
