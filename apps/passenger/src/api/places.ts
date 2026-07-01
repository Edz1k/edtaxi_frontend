import type { CreatePlacePayload, FavoritePlace, UpdatePlacePayload } from '@edtaxi/shared/types/places'
import { apiRequest } from '~/api/client'

export function listPlaces() {
  return apiRequest<{ places: FavoritePlace[] }>('/places')
}

export function createPlace(payload: CreatePlacePayload) {
  return apiRequest<FavoritePlace>('/places', {
    body: payload,
    method: 'POST',
  })
}

export function updatePlace(id: string, payload: UpdatePlacePayload) {
  return apiRequest<FavoritePlace>(`/places/${id}`, {
    body: payload,
    method: 'PUT',
  })
}

export function deletePlace(id: string) {
  return apiRequest<{ message: string }>(`/places/${id}`, {
    method: 'DELETE',
  })
}
