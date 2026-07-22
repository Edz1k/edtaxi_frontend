import type { DriverLocationPayload } from '~/types/driver'
import type { DriverTripOffer, DriverWebSocketMessage } from '~/types/websocket'
import { buildWsUrl } from '~/api/client'
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'

// Реконнект не сдаётся, пока водитель на линии.
//
// Раньше здесь был vueuse useWebSocket с autoReconnect{retries: 3}: три
// неудачные попытки — и сокет мёртв ДО ПЕРЕЗАПУСКА мини-аппы. Свернул
// приложение на пару минут (вебвью замораживает таймеры, ОС рвёт соединение) —
// вернулся к неработающему трекингу: позиция не уходит (машина замирает на
// карте у пассажира) и офферы не приходят — хаб молча дропает сообщение, если
// клиент не подключён. Ни visibilitychange-, ни online-обработчиков не было
// вовсе, поэтому само оно не чинилось.
//
// Схема та же, что у пассажирского сокета: экспоненциальный бэкофф с потолком
// и джиттером, переподключение при возврате из фона и появлении сети.
const RECONNECT_BASE_DELAY_MS = 1500
const RECONNECT_MAX_DELAY_MS = 30_000
// Джиттер: деплой сносит все контейнеры разом, без него все водители пошли бы
// переподключаться синхронными волнами.
const RECONNECT_JITTER = 0.3
// После скольких подряд неудач сказать водителю о деградации. Тост —
// информирование: попытки продолжаются и после него.
const RECONNECT_TOAST_AFTER = 5
// Как часто шлём позицию, пока сокет открыт.
const LOCATION_PING_MS = 2_000

function normalizeOffer(message: Extract<DriverWebSocketMessage, { type: 'trip_offer' }>): DriverTripOffer {
  return {
    category: message.data.category,
    comment: message.data.comment,
    distance_km: message.data.distance_km,
    dropoff_address: message.data.dropoff_address,
    dropoff_lat: message.data.dropoff_lat,
    dropoff_lng: message.data.dropoff_lng,
    estimated_fare: message.data.estimated_fare ?? message.data.fare ?? 0,
    options: message.data.options,
    per_km: message.data.per_km,
    pickup_address: message.data.pickup_address,
    pickup_lat: message.data.pickup_lat,
    pickup_lng: message.data.pickup_lng,
    stops: message.data.stops,
    timeout_sec: message.data.timeout_sec,
    trip_id: message.data.trip_id,
  }
}

export function useDriverTrackingSocket() {
  const driver = useDriverStore()
  const toast = useToast()
  const errorMessage = ref('')
  const status = ref<'closed' | 'connecting' | 'open'>('closed')

  let socket: null | WebSocket = null
  let reconnectAttempts = 0
  let reconnectTimer: number | undefined
  let intentionallyClosed = true
  let toastShown = false

  let locationTimer: number | undefined
  let watchId: number | undefined

  const isOpen = computed(() => status.value === 'open')

  function stopLocationStreaming() {
    if (locationTimer !== undefined) {
      window.clearInterval(locationTimer)
      locationTimer = undefined
    }

    if (watchId !== undefined) {
      navigator.geolocation.clearWatch(watchId)
      watchId = undefined
    }
  }

  function sendLocation(payload: DriverLocationPayload) {
    if (!isOpen.value || !socket)
      return

    socket.send(JSON.stringify({
      heading: payload.heading ?? 0,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed ?? 0,
    }))
  }

  // Стрим стартует на КАЖДОМ открытии сокета (в т.ч. после реконнекта) —
  // раньше он поднимался только один раз и после разрыва не возвращался.
  function startLocationStreaming() {
    if (!navigator.geolocation || locationTimer !== undefined)
      return

    let lastPosition: GeolocationPosition | null = null

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition = position
      },
      () => {
        // Тост не показываем: обязательность геолокации обрабатывает экран
        // LocationGate, баннер поверх него только дублирует сообщение.
        errorMessage.value = 'Не удалось получить геопозицию.'
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    )

    locationTimer = window.setInterval(() => {
      if (!lastPosition)
        return

      sendLocation({
        heading: lastPosition.coords.heading ?? 0,
        lat: lastPosition.coords.latitude,
        lng: lastPosition.coords.longitude,
        speed: lastPosition.coords.speed ?? 0,
      })
    }, LOCATION_PING_MS)
  }

  function handleMessage(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as DriverWebSocketMessage

      if (message.type === 'trip_offer') {
        driver.receiveOffer(normalizeOffer(message))
        return
      }

      // Оффер истёк на сервере: закрываем модалку (и мелодию), пока водитель
      // не принял заказ, который уже ушёл другому.
      if (message.type === 'trip_offer_expired') {
        if (driver.expireOffer(message.data.trip_id))
          toast.warning('Заказ ушёл', 'Время на ответ истекло — заказ предложен другому водителю.')
        return
      }

      if (message.type === 'trip_status') {
        driver.applyTripStatus(message.data.trip_id, message.data.status, message.data.cancelled_by)
        driver.refreshActiveTrip().catch(() => {})
      }
    }
    catch {
      errorMessage.value = 'Не удалось прочитать сообщение от сервера.'
      toast.error('Ошибка WebSocket', errorMessage.value)
    }
  }

  function clearReconnectTimer() {
    if (!reconnectTimer)
      return

    window.clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }

  function canReuseSocket() {
    return socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  }

  // Задержка n-й попытки: экспонента с потолком, размазанная джиттером.
  function reconnectDelayMs(attempt: number) {
    const base = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS)
    const jitter = 1 + (Math.random() * 2 - 1) * RECONNECT_JITTER
    return Math.round(base * jitter)
  }

  function openSocket() {
    if (intentionallyClosed || canReuseSocket())
      return

    // Реконнект это или первый коннект — решаем ДО onopen: он различает,
    // нужен ли ресинк.
    const isReconnect = reconnectAttempts > 0

    status.value = 'connecting'
    errorMessage.value = ''

    const ws = new WebSocket(buildWsUrl('/ws/driver/tracking'))
    socket = ws

    ws.onopen = () => {
      reconnectAttempts = 0
      toastShown = false
      status.value = 'open'
      errorMessage.value = ''
      startLocationStreaming()

      // Пока сокет лежал, оффер и смена статуса могли прийти и пропасть
      // навсегда — хаб не ретранслирует пропущенное. Перечитываем поездку,
      // иначе водитель смотрел бы на устаревший экран.
      if (isReconnect)
        driver.refreshActiveTrip().catch(() => {})
    }

    ws.onmessage = event => handleMessage(event as MessageEvent<string>)

    ws.onerror = () => {
      // Без тоста: onerror стреляет на каждый обрыв, а связь в машине рвётся
      // постоянно. О деградации сообщаем ниже, когда попытки идут подряд.
      errorMessage.value = 'WebSocket водителя недоступен.'
    }

    ws.onclose = () => {
      if (socket === ws)
        socket = null

      status.value = 'closed'
      stopLocationStreaming()

      if (intentionallyClosed)
        return

      reconnectAttempts += 1

      // Сообщаем о деградации один раз за сбой, но НЕ бросаем попытки: связь
      // в машине рвётся и возвращается.
      if (reconnectAttempts >= RECONNECT_TOAST_AFTER && !toastShown) {
        toastShown = true
        errorMessage.value = 'Пытаемся восстановить связь с сервером.'
        toast.error('Связь с сервером недоступна', errorMessage.value)
      }

      clearReconnectTimer()
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined
        openSocket()
      }, reconnectDelayMs(reconnectAttempts))
    }
  }

  function connect() {
    if (typeof window === 'undefined')
      return

    intentionallyClosed = false
    if (canReuseSocket())
      return

    reconnectAttempts = 0
    toastShown = false
    openSocket()
  }

  function close() {
    intentionallyClosed = true
    // Таймер снимаем ДО close(): иначе запланированный бэкофф поднял бы сокет
    // заново уже после ухода водителя с линии.
    clearReconnectTimer()
    stopLocationStreaming()

    if (socket) {
      socket.close()
      socket = null
    }

    status.value = 'closed'
  }

  // Вернулись из фона / появилась сеть.
  //
  // refreshActiveTrip зовём ВСЕГДА, а не только при переподключении:
  // замороженный вебвью оставляет сокет в состоянии OPEN на уже мёртвом
  // соединении, canReuseSocket его пропускает — и без этого вызова водитель
  // остался бы со старым экраном, ничего не заметив.
  function resume() {
    if (intentionallyClosed)
      return

    driver.refreshActiveTrip().catch(() => {})

    if (canReuseSocket())
      return

    clearReconnectTimer()
    openSocket()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible')
      resume()
  }

  onMounted(() => {
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', resume)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    close()
  })

  return {
    close,
    connect,
    errorMessage,
    isOpen,
    status,
  }
}
