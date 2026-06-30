// Личный кабинет водителя о самом себе — агрегат бэкенда GET /driver/overview
// (тот же ответ, что поддержка видит по /tech-support/drivers/:id/profile).

export interface DriverOverviewUser {
  id: string
  phone: string
  first_name: null | string
  last_name: null | string
  avatar_url: null | string
  telegram_username: null | string
  created_at: string
}

export interface DriverOverviewDriver {
  id: string
  park_id: null | string
  is_online: boolean
  is_available: boolean
  rating: number
  total_trips: number
  activity_percent: number
  cancel_count_today: number
  blocked_until: null | string
  face_photo_url: null | string
  created_at: string
}

export interface DriverOverviewVehicle {
  id: string
  category: string
  plate_number: string
  make: string
  model: string
  year: number
  color: string
  is_active: boolean
  verification_status: 'approved' | 'pending' | 'rejected'
  created_at: string
}

// type — причина снижения рейтинга: complaint_confirmed | cancel_after_accept |
// driver_no_show. delta < 0, rating_after — рейтинг сразу после события.
export interface DriverRatingEvent {
  id: string
  type: string
  delta: number
  rating_after: number
  reason: null | string
  trip_id: null | string
  created_at: string
}

export interface DriverRecentRating {
  score: number
  comment: null | string
  trip_id: string
  created_at: string
}

export interface DriverOverview {
  user: DriverOverviewUser
  driver: DriverOverviewDriver
  vehicles: DriverOverviewVehicle[]
  rating_events: DriverRatingEvent[]
  recent_ratings: DriverRecentRating[]
}
