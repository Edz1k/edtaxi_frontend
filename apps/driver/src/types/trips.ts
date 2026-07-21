export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type VehicleCategory = 'business' | 'business_plus' | 'comfort' | 'comfort_plus' | 'economy' | 'minivan' | 'moped' | 'moto'

// Промежуточная остановка маршрута (до 3 на поездку).
export interface TripStop {
  address: string
  lat: number
  lng: number
}

// Опции заказа: водитель видит их в оффере ДО принятия (кресло/животное —
// с доплатой, она уже в цене) и в карточке активного заказа.
export interface TripOptions {
  accessible?: boolean
  child_seat?: boolean
  friend_name?: string
  friend_phone?: string
  pets?: boolean
}

export interface Trip {
  // Момент прибытия к пассажиру — точка отсчёта бесплатного ожидания.
  arrived_at?: null | string
  cancelled_at?: null | string
  cancelled_by?: null | string
  // category — тариф поездки; до принятия водителем это заглушка,
  // пассажир мог заказать сразу несколько тарифов (categories).
  category: VehicleCategory
  categories?: VehicleCategory[]
  comment?: string
  // Промежуточные остановки и опции заказа (волна 2A).
  options?: null | TripOptions
  stops?: TripStop[]
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver_assigned_at?: null | string
  driver_id?: null | string
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  duration_min: number
  estimated_fare: number
  final_fare?: null | number
  id: string
  passenger_id?: string
  // Способ оплаты; может смениться на 'cash' прямо в поездке (онлайн-оплата
  // не прошла) — водителю важно узнать, что деньги надо взять наличными.
  payment_method?: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  // Доплаты за добавленные в пути остановки и текущий итог поездки
  // (estimated + waiting + route_change_fee) — до появления final_fare.
  route_change_fee?: number
  total_fare?: number
  started_at?: null | string
  status: TripStatus
  surge_multiplier: number
  // Надбавка за платное ожидание (в final_fare) и правила её расчёта.
  waiting_fee?: number
  waiting_free_minutes?: number
  waiting_per_minute_fee?: number
}

export interface ActiveTripResponse {
  trip: null | Trip
}
