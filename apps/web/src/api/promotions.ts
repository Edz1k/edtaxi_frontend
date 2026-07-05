import type { CreatePromotionPayload, ParkJoinRequestsResponse, Promotion, PromotionsResponse } from '~/types/promotions'
import { apiRequest } from '~/api/client'

// --- Платформенные акции (роли admin/superadmin) ---

export function listAdminPromotions() {
  return apiRequest<PromotionsResponse>('/admin/promotions')
}

export function createAdminPromotion(payload: CreatePromotionPayload) {
  return apiRequest<Promotion>('/admin/promotions', {
    method: 'POST',
    body: payload,
  })
}

export function deactivateAdminPromotion(id: string) {
  return apiRequest<{ message: string }>(`/admin/promotions/${id}/deactivate`, {
    method: 'POST',
  })
}

// --- Акции парка (роль park): бэкенд берёт парк владельца, scope всегда 'park' ---

export function listParkPromotions() {
  return apiRequest<PromotionsResponse>('/park/promotions')
}

export function createParkPromotion(payload: CreatePromotionPayload) {
  return apiRequest<Promotion>('/park/promotions', {
    method: 'POST',
    body: payload,
  })
}

export function deactivateParkPromotion(id: string) {
  return apiRequest<{ message: string }>(`/park/promotions/${id}/deactivate`, {
    method: 'POST',
  })
}

// --- Заявки водителей на вступление в парк ---

export function listParkJoinRequests() {
  return apiRequest<ParkJoinRequestsResponse>('/park/join-requests')
}

export function approveParkJoinRequest(id: string) {
  return apiRequest<{ message: string }>(`/park/join-requests/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectParkJoinRequest(id: string) {
  return apiRequest<{ message: string }>(`/park/join-requests/${id}/reject`, {
    method: 'POST',
  })
}
