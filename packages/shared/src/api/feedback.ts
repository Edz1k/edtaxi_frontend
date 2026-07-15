import { apiRequest } from './client'

export interface SubmitFeedbackResponse {
  id: string
  message: string
  status: string
}

// submitFeedback — пассажир/водитель отправляет предложение по улучшению сервиса
// (TODO п.32). Роль автора (passenger/driver) определяет бэк по ролям токена.
export function submitFeedback(message: string) {
  return apiRequest<SubmitFeedbackResponse>('/feedback', {
    method: 'POST',
    body: { message },
  })
}
