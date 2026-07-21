import type { PickupHint } from '@edtaxi/shared/composables/mapbox/useMapboxPickupHints'
import { apiRequest } from '~/api/client'

interface PickupHintsResponse {
  hints: PickupHint[]
}

// Кружки-подсказки вокруг точки: где обычно садятся и выходят. Бэкенд сводит
// три источника — размеченные точки, личную историю пассажира и общую
// популярность мест.
export function getPickupHints(lat: number, lng: number, radius?: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  if (radius)
    params.set('radius', String(radius))

  return apiRequest<PickupHintsResponse>(`/pickup-points/hints?${params.toString()}`)
}
