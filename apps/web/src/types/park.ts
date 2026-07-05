import type { ParkJoinRequest } from '~/types/promotions'

export interface TaxiPark {
  bin: null | string
  commission_rate: number
  created_at: string
  description: null | string
  id: string
  is_active: boolean
  // «Партнёр платформы» — в этот парк попадают заявки водителей с платформенных акций.
  is_platform: boolean
  is_verified: boolean
  name: string
  owner_id: string
  phone: null | string
  rejection_reason: null | string
  status: ParkStatus
}

export type ParkStatus = 'approved' | 'pending' | 'rejected'

export interface ParkChatRoom {
  id: string
  park_id: string
  driver_id: string
  status: 'closed' | 'open'
  created_at: string
  updated_at: string
}

export interface ParkChatMessage {
  id: string
  sender_id: string
  content: string
  sent_at: string
}

export interface ParkChatRoomsResponse {
  rooms: ParkChatRoom[]
}

export interface ParkChatMessagesResponse {
  messages: ParkChatMessage[]
  room_id: string
}

export interface AdminParkChatsResponse {
  rooms: ParkChatRoom[]
}

export interface TaxiParkRegisterPayload {
  name: string
  description?: string
  bin?: string
  phone?: string
  commission_rate?: number
}

export interface TaxiParkUpdatePayload {
  bin?: string
  commission_rate?: number
  description?: string
  name?: string
  phone?: string
}

export interface ParkInvite {
  expires_at: string
  id?: string
  token: string
  used_by?: null | string
}

export interface ParkInvitesResponse {
  invites: ParkInvite[]
}

export interface ParkDriver {
  id: string
  is_online: boolean
  rating: number
  total_trips: number
  user_id: string
}

export interface ParkDriversResponse {
  drivers: ParkDriver[]
}

export interface ParkAnalytics {
  driver_count: number
  total_revenue: number
  trip_count: number
}

export interface AdminParksResponse {
  parks: TaxiPark[]
}

// --- «Гараж платформы»: платформенный парк с нулевой комиссией, куда
// попадают заявки водителей «стать партнёром платформы». ---

export interface PlatformGarageDriver {
  id: string
  is_online: boolean
  name?: null | string
  phone?: null | string
  rating: number
  total_trips: number
  user_id: string
}

export interface PlatformGarageResponse {
  drivers: PlatformGarageDriver[]
  park: TaxiPark
  // Заявки водителей на партнёрство (та же форма, что park join requests).
  requests: ParkJoinRequest[]
}

export interface CreatePlatformGaragePayload {
  description?: string
  name: string
  phone?: string
}
