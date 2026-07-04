import type { CatalogCarsResponse, CatalogResolveResponse } from '~/types/catalog'
import { apiRequest } from '~/api/client'

export function searchCatalogCars(query: string, limit = 10) {
  return apiRequest<CatalogCarsResponse>('/catalog/cars', {
    params: { limit, query },
  })
}

export function resolveCatalogCar(make: string, model: string, year: number) {
  return apiRequest<CatalogResolveResponse>('/catalog/cars/resolve', {
    params: { make, model, year },
  })
}
