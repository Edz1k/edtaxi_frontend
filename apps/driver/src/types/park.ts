export interface DriverAcceptInvitePayload {
  token: string
}

// Парк из списка GET /driver/parks (parkToMap на бэке).
export interface AvailablePark {
  id: string
  owner_id: string
  name: string
  description: string
  bin: string
  phone: string
  // commission_rate — доля парка (0…0.03) сверх комиссии платформы
  commission_rate: number
  is_verified: boolean
  is_platform: boolean
  status: string
  is_active: boolean
  rejection_reason: null | string
  created_at: string
}

export interface AvailableParksResponse {
  parks: AvailablePark[]
}

// Акция парка в публичной карточке (GET /driver/parks/:id).
export interface ParkPromotion {
  description: string
  ends_at: string
  reward: number
  target_trips: number
  title: string
}

// Публичная карточка парка: описание, комиссия, активные акции.
export interface ParkInfo {
  commission_rate: number
  created_at: string
  description: string
  id: string
  is_platform: boolean
  name: string
  phone: string
  promotions?: ParkPromotion[]
}

// Заявка водителя на вступление в парк.
export interface ParkJoinRequest {
  created_at: string
  decided_at: null | string
  driver_id: string
  id: string
  park_id: string
  park_name?: string
  status: 'approved' | 'pending' | 'rejected'
}

export interface ParkJoinRequestResponse {
  request: null | ParkJoinRequest
}
