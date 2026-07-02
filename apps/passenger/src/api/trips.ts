import type { ActiveTripResponse, CreateTripPayload, EstimateTripPayload, EstimateTripResponse, FileTripComplaintPayload, FileTripComplaintResponse, RateTripPayload, Trip, TripHistoryResponse } from '~/types/trips'
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

export function rateTrip(id: string, payload: RateTripPayload) {
  return apiRequest<{ message: string }>(`/trips/${id}/rate`, {
    method: 'POST',
    body: payload,
  })
}

export function fileTripComplaint(id: string, payload: FileTripComplaintPayload) {
  return apiRequest<FileTripComplaintResponse>(`/trips/${id}/complaint`, {
    method: 'POST',
    body: payload,
  })
}
