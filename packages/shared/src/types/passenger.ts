export interface PassengerProfile {
  avatar_url: null | string
  first_name: null | string
  id: string
  last_name: null | string
  phone: string
}

// PassengerOverview — агрегат личного кабинета пассажира (GET /passenger/overview):
// анкета с рейтингом, счётчик поездок и последние оценки от водителей.
export interface PassengerOverview {
  recent_ratings: Array<{ comment: null | string, created_at: string, score: number }>
  stats: { total_trips: number }
  user: PassengerProfile & {
    created_at: string
    passenger_rating: number
    telegram_username: null | string
  }
}

export interface UpdatePassengerProfilePayload {
  avatar_url?: null | string
  first_name?: null | string
  last_name?: null | string
}
