import type { PassengerDriverLocation } from '@edtaxi/shared/types/websocket'
import type { TripOptions, TripStatus, TripStop, VehicleCategory } from '~/types/trips'

export type { PassengerDriverLocation } from '@edtaxi/shared/types/websocket'

export interface DriverTripOffer {
  category?: VehicleCategory
  comment?: string
  distance_km?: number
  dropoff_address: string
  dropoff_lat?: number
  dropoff_lng?: number
  estimated_fare: number
  options?: null | TripOptions
  // Ставка ₸/км (с учётом сюрджа) для показа в шапке оффера (п.40).
  // Отсутствует/0 у легаси-поездок без снапшота тарифа — бейдж не рисуем.
  per_km?: number
  pickup_address: string
  pickup_lat?: number
  pickup_lng?: number
  stops?: TripStop[]
  timeout_sec: number
  trip_id: string
}

export interface DriverTripOfferWireData {
  category?: VehicleCategory
  comment?: string
  distance_km?: number
  dropoff_address: string
  dropoff_lat?: number
  dropoff_lng?: number
  estimated_fare?: number
  fare?: number
  options?: null | TripOptions
  per_km?: number
  pickup_address: string
  pickup_lat?: number
  pickup_lng?: number
  stops?: TripStop[]
  timeout_sec: number
  trip_id: string
}

export interface DriverTripOfferWireMessage {
  data: DriverTripOfferWireData
  type: 'trip_offer'
}

// Оффер истёк на сервере (водитель не ответил за timeout_sec): модалку заказа
// надо закрыть и остановить мелодию — иначе они висят до бесконечности.
export interface TripOfferExpiredWireMessage {
  data: {
    trip_id: string
  }
  type: 'trip_offer_expired'
}

export interface TripStatusWireMessage {
  data: {
    // Актор отмены (passenger/driver_.../system_...) — водитель отличает
    // «пассажир отменил, ждём следующий заказ» от прочих отмен.
    cancelled_by?: string
    status: TripStatus
    trip_id: string
  }
  type: 'trip_status'
}

export interface ChatMessageWireMessage {
  data: {
    content: string
    id: string
    image_url?: null | string
    room_id: string
    room_status?: 'closed' | 'open' | 'pending_close'
    sender_id: string
    sent_at: string
  }
  type: 'chat_message'
}

// Сообщение чата с таксопарком. Бэкенд не шлёт id сообщения по WS —
// синтетический id собирается на клиенте.
export interface ParkChatMessageWireMessage {
  data: {
    content: string
    room_id: string
    sender_id: string
    sent_at: string
  }
  type: 'park_chat_message'
}

// Чат поездки (пассажир <-> водитель): комнатой служит сама поездка.
export interface TripChatMessageWireMessage {
  data: {
    content: string
    id: string
    image_url?: null | string
    sender_id: string
    sent_at: string
    trip_id: string
  }
  type: 'trip_chat_message'
}

export type DriverWebSocketMessage = ChatMessageWireMessage | DriverTripOfferWireMessage | ParkChatMessageWireMessage | TripChatMessageWireMessage | TripOfferExpiredWireMessage | TripStatusWireMessage

export interface PassengerDriverLocationWireMessage {
  data: PassengerDriverLocation
  type: 'driver_location'
}

export type PassengerWebSocketMessage = ChatMessageWireMessage | ParkChatMessageWireMessage | PassengerDriverLocationWireMessage | TripChatMessageWireMessage | TripStatusWireMessage
