export type TripStatus = 'awaiting_payment' | 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type TripFlowState = 'awaiting_payment' | 'driver_arriving' | 'driver_assigned' | 'finished' | 'idle' | 'in_progress' | 'route_ready' | 'searching' | 'tariffs'
export type VehicleCategory = 'business' | 'business_plus' | 'comfort' | 'comfort_plus' | 'economy' | 'minivan' | 'moped' | 'moto'
// Группа категорий (п.30): табы карусели. moto — мото-лестница (мопед,
// мотоцикл), taxi — обычное такси, khan — премиальное «Хантакси».
export type CategoryGroup = 'khan' | 'moto' | 'taxi'

// Активная категория тарифа с бэка (GET /tariffs/categories): источник
// карусели — оцениваем только эти категории, пустые группы не показываем.
export interface TariffCategoryInfo {
  category: VehicleCategory
  group: CategoryGroup
  name: string
}
// Способ оплаты: cash — наличные водителю, card — списание с привязанной
// карты при завершении поездки (если карты нет или списание не прошло, бэкенд
// сам откатывается на баланс кошелька, затем на наличные), prepaid —
// предоплата на странице FreedomPay (Apple Pay / Google Pay / карта): поездка
// создаётся в awaiting_payment и уходит в поиск после подтверждения оплаты.
export type PaymentMethod = 'card' | 'cash' | 'prepaid'

// Промежуточная остановка маршрута (до 3 на поездку).
export interface TripStop {
  address: string
  lat: number
  lng: number
}

// Опции заказа: кресло/животное — платные (фикс-доплата из настроек админки),
// особые потребности и «заказ другу» — бесплатные.
export interface TripOptions {
  accessible?: boolean
  child_seat?: boolean
  friend_name?: string
  friend_phone?: string
  pets?: boolean
}

export interface EstimateTripPayload {
  category: VehicleCategory
  distance_km: number
  duration_min: number
  // Координаты опциональны для обратной совместимости, но с ними бэкенд
  // считает коэффициент спроса (surge) и сверяет метрики маршрута с прямой
  // между точками (анти-спуфинг цены) — передавать при любой возможности.
  dropoff_lat?: number
  dropoff_lng?: number
  pickup_lat?: number
  pickup_lng?: number
  // Единый контракт с create: стопы участвуют в проверке метрик маршрута,
  // опции — в цене (options_surcharge входит в estimated_fare).
  options?: TripOptions
  stops?: TripStop[]
}

export interface EstimateTripResponse {
  category: VehicleCategory
  // Группа категории (п.30); опциональна для обратной совместимости со старым бэком.
  group?: CategoryGroup
  distance_km: number
  duration_min: number
  estimated_fare: number
  surge_multiplier: number
  // Доплата за выбранные опции, уже вошедшая в estimated_fare.
  options_surcharge?: number
  // Прайс опций из настроек (0 = опция выключена) — для «+N ₸» на чекбоксах.
  surcharge_child_seat?: number
  surcharge_pets?: number
}

export interface CreateTripPayload extends EstimateTripPayload {
  // Мультивыбор тарифов: бэкенд принимает до 5 категорий.
  categories?: VehicleCategory[]
  comment?: string
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  payment_method?: PaymentMethod
  // Оплатить часть поездки бонусами (до 50%, по балансу на завершении).
  use_bonuses?: boolean
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

// Телефона водителя тут нет намеренно: участники поездки не обмениваются
// контактами. Бэкенд его пассажиру и не отдаёт (enrichTripDriver без телефона,
// стафф получает его отдельным входом). Связь — чат поездки, после завершения —
// через поддержку.
export interface TripDriver {
  name?: string
  avatar_url?: null | string
  rating: number
  total_trips: number
  user_id?: string
  vehicle?: TripDriverVehicle
  // Последняя известная позиция машины (синк с бэка ~раз в 10с) — для первого
  // кадра карты и ETA до прихода live-координат по WebSocket.
  location?: null | { lat: number, lng: number }
}

// Перевозчик — таксопарк, фактически выполняющий поездку. Телефон здесь
// корпоративный (taxi_parks.phone), а не личный номер водителя: приватность
// участников поездки это не нарушает. Полей может не быть — у части парков
// телефон и БИН не заполнены, а у самозанятого водителя нет и самого объекта.
export interface TripCarrier {
  name: string
  is_platform?: boolean
  phone?: string
  bin?: string
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
  comment?: string
  // Промежуточные остановки и опции заказа (волна 2A).
  options?: null | TripOptions
  stops?: TripStop[]
  // Фикс-доплата за опции, вошедшая в estimated_fare/final_fare.
  surcharge?: number
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver?: null | TripDriver
  // Перевозчик (таксопарк) поездки; нет у самозанятого водителя.
  carrier?: null | TripCarrier
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
  // Способ оплаты; может смениться на 'cash' прямо в поездке (онлайн-оплата
  // не прошла — бэкенд перекидывает на наличные и шлёт trip_status).
  payment_method?: PaymentMethod | string
  // Ссылка на оплату предоплаты (только в ответе создания prepaid-поездки).
  payment_url?: string
  // Доплаты за добавленные в пути остановки и текущий итог поездки
  // (estimated + waiting + route_change_fee) — до появления final_fare.
  route_change_fee?: number
  total_fare?: number
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

// Заявка на добавление остановки в идущей поездке: пассажир предлагает, водитель
// подтверждает или отклоняет. Пока статус 'pending', маршрут и цена поездки не
// меняются — доплата показывается обеим сторонам заранее, до согласия.
export interface TripRouteChange {
  created_at: string
  distance_km: number
  duration_min: number
  // Доплата в тенге, посчитанная бэкендом от снапшота тарифа поездки. Считать её
  // на фронте нельзя: ставки и сюрдж могли смениться уже после заказа, и цифра
  // разошлась бы с той, что увидит водитель.
  fee: number
  id: string
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected'
  trip_id: string
}

export interface PendingRouteChangeResponse {
  route_change: null | TripRouteChange
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
  // Чипы-теги отзыва (слаги из constants/ratingTags.ts).
  tags?: string[]
}

// Ответ отправки чаевых: каким способом списали (кошелёк / привязанная карта).
export interface TipResponse {
  message: string
  method: 'card' | 'wallet'
}

export interface FileTripComplaintPayload {
  reason: string
}

export interface FileTripComplaintResponse {
  id: string
  status: string
  message: string
}
