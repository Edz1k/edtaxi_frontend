import { apiRequest } from './client'

// Определение города пользователя по координатам: бэкенд резолвит ближайший
// крупный город по оффлайн-справочнику (без 2ГИС) и сохраняет его в профиле.
// Пустая строка в ответе — «между городами», сохранённый город не меняется.
export function resolveMyCity(lat: number, lng: number) {
  return apiRequest<{ city: string }>('/profile/city', {
    method: 'POST',
    body: { lat, lng },
  })
}
