import type { ActiveTripResponse, CreateTripPayload, DestinationSuggestionsResponse, EstimateTripPayload, EstimateTripResponse, FileTripComplaintPayload, FileTripComplaintResponse, RateTripPayload, TipResponse, Trip, TripHistoryResponse } from '~/types/trips'
import { apiRequest } from '~/api/client'

export function estimateTrip(payload: EstimateTripPayload) {
  return apiRequest<EstimateTripResponse>('/trips/estimate', {
    method: 'POST',
    body: payload,
  })
}

export function createTrip(payload: CreateTripPayload) {
  return apiRequest<Trip>('/trips', {
    method: 'POST',
    body: payload,
  })
}

export function getTrip(id: string) {
  return apiRequest<Trip>(`/trips/${id}`)
}

export async function getActiveTrip() {
  const response = await apiRequest<ActiveTripResponse>('/trips/active')
  return response.trip
}

// «Умные подсказки» для поля «Куда»: частые и недавние адреса назначения
// из истории завершённых поездок (ранжирует бэкенд).
export function getDestinationSuggestions() {
  return apiRequest<DestinationSuggestionsResponse>('/trips/suggestions')
}

export function getTripHistory(limit = 20, offset = 0) {
  return apiRequest<TripHistoryResponse>('/trips', {
    params: { limit, offset },
  })
}

export function cancelTrip(id: string) {
  return apiRequest<{ message: string }>(`/trips/${id}/cancel`, {
    method: 'POST',
  })
}

// Повторная ссылка на оплату предоплаченной поездки в awaiting_payment
// (пассажир закрыл платёжную страницу или оплата не прошла).
export function retryTripPrepay(id: string) {
  return apiRequest<{ payment_url: string }>(`/trips/${id}/prepay`, {
    method: 'POST',
  })
}

export function rateTrip(id: string, payload: RateTripPayload) {
  return apiRequest<{ message: string }>(`/trips/${id}/rate`, {
    method: 'POST',
    body: payload,
  })
}

// Чаевые водителю (100-5000 ₸): кошелёк → фолбэк привязанная карта; один раз
// на поездку (повтор — 409; не хватает средств и нет карты — 402).
export function sendTripTip(id: string, amount: number) {
  return apiRequest<TipResponse>(`/trips/${id}/tip`, {
    method: 'POST',
    body: { amount },
  })
}

export function fileTripComplaint(id: string, payload: FileTripComplaintPayload) {
  return apiRequest<FileTripComplaintResponse>(`/trips/${id}/complaint`, {
    method: 'POST',
    body: payload,
  })
}
