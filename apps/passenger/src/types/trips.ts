export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type TripFlowState = 'driver_arriving' | 'driver_assigned' | 'finished' | 'idle' | 'in_progress' | 'route_ready' | 'searching' | 'tariffs'
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan' | 'moto'
// Способ оплаты: cash — наличные водителю, card — списание с привязанной
// карты при завершении поездки (если карты нет или списание не прошло, бэкенд
// сам откатывается на баланс кошелька, затем на наличные).
export type PaymentMethod = 'card' | 'cash'

export interface EstimateTripPayload {
  category: VehicleCategory
  distance_km: number
  duration_min: number
}

export interface EstimateTripResponse {
  category: VehicleCategory
  distance_km: number
  duration_min: number
  estimated_fare: number
  surge_multiplier: number
}

export interface CreateTripPayload extends EstimateTripPayload {
  // Мультивыбор тарифов: бэкенд принимает до 5 категорий.
  categories?: VehicleCategory[]
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  payment_method?: PaymentMethod
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
}

export interface TripFareQuote {
  fare: number
  surge_multiplier: number
}

// TripDriver — данные назначенного водителя, которые видит пассажир, когда заказ
// принят (бэкенд добавляет объект driver к поездке при наличии водителя).
export interface TripDriverVehicle {
  make: string
  model: string
  plate_number: string
  color: string
  category: string
}

export interface TripDriver {
  name?: string
  avatar_url?: null | string
  phone?: string
  rating: number
  total_trips: number
  user_id?: string
  vehicle?: TripDriverVehicle
  // Последняя известная позиция машины (синк с бэка ~раз в 10с) — для первого
  // кадра карты и ETA до прихода live-координат по WebSocket.
  location?: null | { lat: number, lng: number }
}

// Оценка, которую пассажир уже поставил за поездку (бэкенд кладёт my_rating в
// завершённые поездки) — по ней экран завершения показывает выставленные звёзды.
export interface TripMyRating {
  comment?: null | string
  score: number
}

export interface Trip {
  // Момент прибытия водителя — точка отсчёта бесплатного ожидания.
  arrived_at?: null | string
  cancelled_at?: null | string
  cancelled_by?: null | string
  categories?: VehicleCategory[]
  category: VehicleCategory
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver?: null | TripDriver
  driver_assigned_at?: null | string
  driver_id?: null | string
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  duration_min: number
  estimated_fare: number
  fare_quotes?: Record<string, TripFareQuote>
  final_fare?: null | number
  id: string
  my_rating?: null | TripMyRating
  passenger_id?: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  started_at?: null | string
  status: TripStatus
  surge_multiplier: number
  // Надбавка за платное ожидание (в final_fare) и правила её расчёта —
  // фронт строит таймер/тексты по этим значениям, а не по константам.
  waiting_fee?: number
  waiting_free_minutes?: number
  waiting_per_minute_fee?: number
}

export interface TripHistoryResponse {
  limit: number
  offset: number
  trips: Trip[]
}

export interface ActiveTripResponse {
  trip: null | Trip
}

// «Умная подсказка» адреса назначения из истории поездок.
export interface DestinationSuggestion {
  address: string
  last_used: string
  lat: number
  lng: number
  times: number
}

export interface DestinationSuggestionsResponse {
  suggestions: DestinationSuggestion[]
}

export interface RateTripPayload {
  comment?: string
  score: number
}

export interface FileTripComplaintPayload {
  reason: string
}

export interface FileTripComplaintResponse {
  id: string
  status: string
  message: string
}
