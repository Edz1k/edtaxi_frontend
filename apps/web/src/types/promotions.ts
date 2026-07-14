// Акции «N поездок → X бонусов»: платформенные (админ, для пассажиров или
// водителей) и парковые (владелец парка, для своих водителей).
export type PromotionScope = 'park' | 'platform_driver' | 'platform_passenger'

// Режим выдачи наград: auto — сразу при достижении цели (пассажирские и
// легаси-акции), manual — кнопкой «Отправить награды» после завершения.
export type PromotionAwardMode = 'auto' | 'manual'
// Аудитория платформенной водительской акции: водители платформенного парка
// или все водители.
export type PromotionAudience = 'all' | 'platform'

export interface Promotion {
  audience: PromotionAudience
  award_mode: PromotionAwardMode
  created_at: string
  description: string
  ends_at: string
  id: string
  // Абсолютный/относительный URL баннера акции (null — без картинки).
  image_url: null | string
  is_active: boolean
  // Акция закончилась (по сроку или остановлена) — можно отправлять награды.
  is_finished: boolean
  is_running: boolean
  // Кастомный текст Telegram-рассылки; пустой — ушло шаблонное уведомление.
  message: null | string
  reward: number
  // Когда награды выданы вручную (null — ещё не выданы).
  rewards_sent_at: null | string
  scope: PromotionScope
  starts_at: string
  target_trips: number
  title: string
}

// Участник акции с прогрессом (кабинет парка / админка).
export interface PromotionParticipant {
  awarded: boolean
  completed: boolean
  joined_at: null | string
  name: string
  phone: null | string
  trips: number
  user_id: string
}

export interface PromotionParticipantsResponse {
  completed_count: number
  participants: PromotionParticipant[]
  promotion: Promotion
  total: number
}

export interface PromotionsResponse {
  promotions: Promotion[]
}

export interface CreatePromotionPayload {
  // Только для scope 'platform_driver': platform (водители платформы, дефолт
  // бэка) или all («акция для всех водителей»).
  audience?: PromotionAudience
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
