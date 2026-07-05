// Акции «N поездок → X бонусов»: платформенные (админ, для пассажиров или
// водителей) и парковые (владелец парка, для своих водителей).
export type PromotionScope = 'park' | 'platform_driver' | 'platform_passenger'

export interface Promotion {
  created_at: string
  description: string
  ends_at: string
  id: string
  // Абсолютный/относительный URL баннера акции (null — без картинки).
  image_url: null | string
  is_active: boolean
  is_running: boolean
  // Кастомный текст Telegram-рассылки; пустой — ушло шаблонное уведомление.
  message: null | string
  reward: number
  scope: PromotionScope
  starts_at: string
  target_trips: number
  title: string
}

export interface PromotionsResponse {
  promotions: Promotion[]
}

export interface CreatePromotionPayload {
  description?: string
  ends_at: string
  // path из ответа загрузки баннера (POST .../promotions/image).
  image_path?: string
  // Свой текст Telegram-рассылки (≤1000 символов); пусто — шаблонное уведомление.
  message?: string
  reward: number
  // Только для платформенных акций — парковые всегда создаются со scope 'park'.
  scope?: PromotionScope
  target_trips: number
  title: string
}

// Ответ загрузки баннера акции: path сохраняем в payload, url — для превью.
export interface PromotionImageUpload {
  path: string
  url: string
}

// Заявка водителя на вступление в таксопарк.
export interface ParkJoinRequest {
  created_at: string
  decided_at?: null | string
  driver_id: string
  driver_name?: null | string
  driver_phone?: null | string
  driver_rating?: null | number
  driver_total_trips?: null | number
  id: string
  park_id: string
  status: string
}

export interface ParkJoinRequestsResponse {
  requests: ParkJoinRequest[]
}
