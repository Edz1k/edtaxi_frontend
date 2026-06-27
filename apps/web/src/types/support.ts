export type SupportParticipantType = 'driver' | 'passenger'
export type SupportRoomStatus = 'closed' | 'open' | 'pending_close'

export interface SupportRoom {
  agent_id: null | string
  created_at: string
  id: string
  participant_type: SupportParticipantType
  passenger_id: string
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
