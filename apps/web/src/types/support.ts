export type SupportParticipantType = 'driver' | 'passenger'
export type SupportRoomStatus = 'closed' | 'open' | 'pending_close'

// Прикреплённая к обращению поездка (бэкенд отдаёт её в детали комнаты).
export interface SupportRoomTrip {
  id: string
  status: string
  category: string
  pickup_address: null | string
  dropoff_address: null | string
  estimated_fare: number
  final_fare: null | number
  payment_method: null | string
  created_at: string
}

export interface SupportRoom {
  agent_id: null | string
  created_at: string
  id: string
  participant_type: SupportParticipantType
  passenger_id: string
  trip_id?: null | string
  trip?: null | SupportRoomTrip
  // participant_* подтягиваются бэкендом из анкеты участника, чтобы показывать
  // имя вместо UUID. Могут отсутствовать, если анкета не найдена.
  participant_name?: string
  participant_phone?: string
  participant_avatar_url?: null | string
  status: SupportRoomStatus
  updated_at: string
}

export interface SupportListRoomsParams {
  limit?: number
  offset?: number
  participant_type?: SupportParticipantType
  status?: SupportRoomStatus | ''
}

export interface SupportListRoomsResponse {
  rooms: SupportRoom[]
}

// Параметры общего админского списка обращений (/admin/support/rooms):
// в отличие от tech-support списков, тип участника здесь — необязательный фильтр.
export interface AdminSupportRoomsParams {
  limit?: number
  offset?: number
  participant_type?: SupportParticipantType | ''
  status?: SupportRoomStatus | ''
}

export interface SupportMessage {
  id: string
  sender_id: string
  content: string
  sent_at: string
}

export interface SupportMessagesResponse {
  messages: SupportMessage[]
  room_id: string
}
