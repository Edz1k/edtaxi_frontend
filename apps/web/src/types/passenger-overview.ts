// Кабинет пассажира глазами поддержки/админа — агрегат бэкенда
// GET /tech-support/passengers/:id/profile (см. passenger_overview.go).

export interface PassengerOverviewUser {
  id: string
  phone: string
  role: string
  first_name: null | string
  last_name: null | string
  avatar_url: null | string
  telegram_username: null | string
  is_active: boolean
  is_blocked: boolean
  passenger_rating: number
  created_at: string
  // Бонусный баланс: поддержке нужен при выдаче компенсации. Опционально —
  // старый бэкенд поля не отдаёт.
  bonus_balance?: number
}

export interface PassengerTrip {
  id: string
  status: string
  category: string
  pickup_address: null | string
  dropoff_address: null | string
  estimated_fare: number
  final_fare: null | number
  created_at: string
}

export interface PassengerOverview {
  user: PassengerOverviewUser
  recent_trips: PassengerTrip[]
}

// Одна запись журнала бонусов. granted_by заполнен только у ручных выдач
// поддержки (kind=support_grant), у автоматических начислений — null.
export interface BonusTransaction {
  id: string
  amount: number
  kind: string
  description: string
  created_at: string
  granted_by: null | string
}

export interface BonusTransactionsResponse {
  transactions: BonusTransaction[]
}
