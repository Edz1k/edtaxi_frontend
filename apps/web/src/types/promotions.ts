// Акции «N поездок → X бонусов»: платформенные (админ, для пассажиров или
// водителей) и парковые (владелец парка, для своих водителей).
export type PromotionScope = 'park' | 'platform_driver' | 'platform_passenger'

export interface Promotion {
  created_at: string
  description: string
  ends_at: string
  id: string
  is_active: boolean
  is_running: boolean
  reward: number
  scope: PromotionScope
  starts_at: string
  target_trips: number
  title: string
}

export interface PromotionsResponse {
  promotions: Promotion[]
}

export interface CreatePromotionPayload {
  description?: string
  ends_at: string
  reward: number
  // Только для платформенных акций — парковые всегда создаются со scope 'park'.
  scope?: PromotionScope
  target_trips: number
  title: string
}

// Заявка водителя на вступление в таксопарк.
export interface ParkJoinRequest {
  created_at: string
  driver_id: string
  driver_name?: null | string
  driver_phone?: null | string
  driver_rating?: null | number
  driver_total_trips?: null | number
  id: string
  park_id: string
  status: string
}

export interface ParkJoinRequestsResponse {
  requests: ParkJoinRequest[]
}
