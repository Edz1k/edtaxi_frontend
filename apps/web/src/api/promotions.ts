import type { CreatePromotionPayload, ParkJoinRequestsResponse, Promotion, PromotionImageUpload, PromotionParticipantsResponse, PromotionsResponse } from '~/types/promotions'
import { apiRequest } from '~/api/client'

// Баннер акции (jpeg/png до 5MB): бэкенд возвращает path (кладём в payload
// акции) и url для отображения.
function uploadPromotionImage(endpoint: string, file: Blob) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<PromotionImageUpload>(endpoint, {
    method: 'POST',
    body: form,
  })
}

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

export function uploadAdminPromotionImage(file: Blob) {
  return uploadPromotionImage('/admin/promotions/image', file)
}

export function deactivateAdminPromotion(id: string) {
  return apiRequest<{ message: string }>(`/admin/promotions/${id}/deactivate`, {
    method: 'POST',
  })
}

export function listAdminPromotionParticipants(id: string) {
  return apiRequest<PromotionParticipantsResponse>(`/admin/promotions/${id}/participants`)
}

// Идемпотентная выдача наград по завершённой manual-акции.
export function sendAdminPromotionRewards(id: string) {
  return apiRequest<{ awarded: number, message: string }>(`/admin/promotions/${id}/send-rewards`, {
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

export function uploadParkPromotionImage(file: Blob) {
  return uploadPromotionImage('/park/promotions/image', file)
}

export function deactivateParkPromotion(id: string) {
  return apiRequest<{ message: string }>(`/park/promotions/${id}/deactivate`, {
    method: 'POST',
  })
}

export function listParkPromotionParticipants(id: string) {
  return apiRequest<PromotionParticipantsResponse>(`/park/promotions/${id}/participants`)
}

// Выдача наград по завершённой акции парка: дебетует баланс парка на всю
// сумму; если баланса не хватает на всех — бэкенд откажет целиком (402).
export function sendParkPromotionRewards(id: string) {
  return apiRequest<{ awarded: number, message: string }>(`/park/promotions/${id}/send-rewards`, {
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
