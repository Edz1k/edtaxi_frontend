// Контроль переписки поездок (пассажир <-> водитель) поддержкой/админами.

export interface TripChatDriver {
  avatar_url?: null | string
  name?: string
  phone?: string
  rating?: number
  user_id?: string
}

export interface TripChatSummary {
  driver?: null | TripChatDriver
  last_message_at: string
  messages_count: number
  passenger_id: string
  passenger_name?: string
  passenger_phone?: string
  trip_id: string
  trip_status: string
}

export interface TripChatsListResponse {
  chats: TripChatSummary[]
  limit: number
  offset: number
}

export interface TripChatMessage {
  content: string
  id: string
  image_url?: null | string
  sender_id: string
  sent_at: string
  trip_id: string
}

export interface TripChatMessagesResponse {
  messages: TripChatMessage[]
}
