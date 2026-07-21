import { apiRequest } from '~/api/client'

// Размеченная точка подачи. Кружки на карте пассажира приходят из трёх
// источников (справочник, личная история, популярность), но админка правит
// только справочник — записи с source='manual'; импортированные и посчитанные
// показываются, но редактировать их бессмысленно, они перезапишутся.
export interface AdminPickupPoint {
  id: string
  city: string
  name: string
  hint?: null | string
  lat: number
  lng: number
  source: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PickupPointPayload {
  city: string
  name: string
  hint?: string
  lat: number
  lng: number
}

export interface PickupPointPatch {
  name?: string
  hint?: string
  lat?: number
  lng?: number
  is_active?: boolean
}

export function getAdminPickupPoints(city?: string) {
  const query = city ? `?city=${encodeURIComponent(city)}` : ''

  return apiRequest<{ pickup_points: AdminPickupPoint[] }>(`/admin/pickup-points${query}`)
}

export function createPickupPoint(payload: PickupPointPayload) {
  return apiRequest<AdminPickupPoint>('/admin/pickup-points', { method: 'POST', body: payload })
}

export function updatePickupPoint(id: string, patch: PickupPointPatch) {
  return apiRequest<AdminPickupPoint>(`/admin/pickup-points/${id}`, { method: 'PUT', body: patch })
}

export function deletePickupPoint(id: string) {
  return apiRequest<{ message: string }>(`/admin/pickup-points/${id}`, { method: 'DELETE' })
}

// Импорт входов из 2GIS — ручной и по одному городу за раз. Автоматическим его
// делать нельзя: один ввод адреса у нас уже порождает несколько обращений к
// 2GIS, а массовый импорт по ключу с лимитами способен его заблокировать —
// именно это уже случилось с боевым ключом.
export function importPickupPointsFrom2GIS(city: string) {
  return apiRequest<{ imported: number, skipped: number, message: string }>(
    '/admin/pickup-points/import-2gis',
    { method: 'POST', body: { city } },
  )
}
