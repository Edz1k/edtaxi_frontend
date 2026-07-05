// Чат поездки (пассажир <-> водитель). Комнатой служит сама поездка —
// сообщения адресуются по trip_id, отдельного room_id нет.
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
