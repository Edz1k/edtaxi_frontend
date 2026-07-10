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
  // Приходят только в админском списке /admin/park-chats. driver_user_id —
  // это users.id, по нему открывается карточка водителя /drivers/:id
  // (driver_id — это drivers.id, для ссылки он не годится).
  park_name?: string
  driver_user_id?: string
  driver_name?: null | string
  driver_phone?: string
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

// Регистрация: комиссию НЕ задаём — парк ставит её позже через заявку,
// которую одобряет админ (см. ParkChangeRequestPayload).
export interface TaxiParkRegisterPayload {
  name: string
  description?: string
  bin?: string
  phone?: string
}

// Быстрая правка парком: только имя/описание/телефон. БИН и комиссия — через
// заявку с одобрением админа. (Для админского PUT /admin/parks/:id — все поля.)
export interface TaxiParkUpdatePayload {
  bin?: string
  commission_rate?: number
  description?: string
  name?: string
  phone?: string
}

// Заявка парка на изменение БИН и/или комиссии (одобряет админ).
export interface ParkChangeRequestPayload {
  bin?: string
  // доля: 0.03 = 3%
  commission_rate?: number
}

export interface ParkChangeRequest {
  id: string
  park_id: string
  requested_bin: null | string
  requested_commission_rate: null | number
  status: 'approved' | 'pending' | 'rejected'
  created_at: string
  // Заполняется только в админском списке — контекст для решения.
  park_name?: string
  current_bin?: null | string
  current_commission_rate?: number
}

export interface ParkChangeRequestResponse {
  request: null | ParkChangeRequest
}

export interface AdminParkChangeRequestsResponse {
  requests: ParkChangeRequest[]
}

// Пригласительная ссылка парка: одна, многоразовая, по умолчанию бессрочная
// (expires_at = null). Отзывается перевыпуском, а не пометкой «использована».
export interface ParkInvite {
  expires_at: null | string
  id?: string
  token: string
}

export interface ParkInvitesResponse {
  invites: ParkInvite[]
}

export interface ParkDriver {
  id: string
  is_online: boolean
  // Имя/телефон водителя — чтобы владелец парка видел людей, а не UUID.
  name?: null | string
  phone?: null | string
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

// Дневная точка GET /park/analytics/daily: завершённые поездки, выручка и
// число водителей парка, возивших в этот день. Серия непрерывная (пустые
// дни — нулями).
export interface ParkDailyPoint {
  date: string // YYYY-MM-DD
  trips: number
  revenue: number
  active_drivers: number
}

export interface ParkDailyAnalyticsResponse {
  days: ParkDailyPoint[]
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
