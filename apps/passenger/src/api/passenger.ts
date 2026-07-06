import type { PassengerOverview, PassengerProfile, UpdatePassengerProfilePayload } from '@edtaxi/shared/types/passenger'
import { apiRequest } from '~/api/client'

export function getPassengerProfile() {
  return apiRequest<PassengerProfile>('/passenger/me')
}

// getPassengerOverview — личный кабинет пассажира о себе: анкета, рейтинг,
// количество поездок и последние оценки от водителей.
export function getPassengerOverview() {
  return apiRequest<PassengerOverview>('/passenger/overview')
}

export function updatePassengerProfile(payload: UpdatePassengerProfilePayload) {
  return apiRequest<PassengerProfile>('/passenger/me', {
    method: 'PUT',
    body: payload,
  })
}

// Загрузка аватарки пассажира: JPEG/PNG, бэкенд кладёт файл в /uploads/avatars
// и сразу сохраняет ссылку в профиле.
export function uploadPassengerAvatar(file: File) {
  const form = new FormData()
  form.append('photo', file)
  return apiRequest<PassengerProfile>('/passenger/me/avatar', {
    method: 'POST',
    body: form,
  })
}
