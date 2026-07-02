export type ParkChatRoomStatus = 'closed' | 'open' | 'pending_close'

export interface ParkChatRoom {
  id: string
  park_id: string
  driver_id: string
  status: ParkChatRoomStatus
  created_at: string
  updated_at: string
}

export interface ParkChatMessage {
  id: string
  sender_id: string
  content: string
  sent_at: string
}

export interface ParkChatMessagesResponse {
  messages: ParkChatMessage[]
  room_id: string
}

export interface ParkChatSendMessagePayload {
  content: string
}
