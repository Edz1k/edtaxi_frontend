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
  status: string
  is_active: boolean
  rejection_reason: null | string
  created_at: string
}

export interface AvailableParksResponse {
  parks: AvailablePark[]
}
