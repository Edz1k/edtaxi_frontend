import type { PassengerWebSocketMessage } from '~/types/websocket'
import { buildWsUrl } from '~/api/client'
import { useToast } from '~/composables/useToast'
import { useTripsStore } from '~/stores/trips'

// Реконнект не сдаётся, пока поездка активна. Это условие безопасности для
// редкого поллинга (15 с) в сторе: сокет — первичный канал доставки статуса, и
// «попробовали три раза и бросили» оставляло бы пассажира с моргнувшей сетью на
// одном поллинге до конца поездки.
//
// Задержка растёт экспоненциально до потолка: молотить сервер при долгом сбое
// незачем, а первые попытки должны быть быстрыми — обычно сеть возвращается
// через секунды.
const RECONNECT_BASE_DELAY_MS = 1500
const RECONNECT_MAX_DELAY_MS = 30_000
// Джиттер обязателен: деплой сносит все контейнеры разом, и без него все
// пассажиры пошли бы переподключаться синхронными волнами.
const RECONNECT_JITTER = 0.3
// После скольких подряд неудач показать «онлайн-обновления недоступны». Тост —
// только информирование: попытки продолжаются и после него.
const RECONNECT_TOAST_AFTER = 5

export function usePassengerTripSocket(tripId: Ref<string>) {
  const toast = useToast()
  const trips = useTripsStore()
  const errorMessage = ref('')
  const status = ref<'closed' | 'connecting' | 'open'>('closed')

  let socket: null | WebSocket = null
  let reconnectAttempts = 0
  let reconnectTimer: number | undefined
  let intentionallyClosed = false
  let toastShown = false

  function handleMessage(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as PassengerWebSocketMessage

      if (message.type === 'driver_location') {
        trips.setDriverLocation(message.data)
        return
      }

      if (message.type === 'trip_status') {
        trips.applyTripStatus(message.data.trip_id, message.data.status)
        trips.refreshActiveTrip().catch(() => {})
      }
    }
    catch {
      errorMessage.value = 'Не удалось прочитать обновление поездки.'
      toast.error('Ошибка WebSocket', errorMessage.value)
    }
  }

  const isOpen = computed(() => status.value === 'open')

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
    if (!tripId.value || canReuseSocket())
      return

    // Реконнект это или первый коннект — решаем ДО onopen: он различает,
    // нужен ли ресинк.
    const isReconnect = reconnectAttempts > 0

    intentionallyClosed = false
    status.value = 'connecting'
    errorMessage.value = ''

    const ws = new WebSocket(buildWsUrl(`/ws/trip/${tripId.value}/track`))
    socket = ws

    ws.onopen = () => {
      reconnectAttempts = 0
      toastShown = false
      status.value = 'open'
      errorMessage.value = ''

      // Пока сокет лежал, trip_status мог прийти и пропасть навсегда — сервер
      // не ретранслирует пропущенное. Перечитываем поездку, иначе пассажир
      // смотрел бы на устаревший статус до следующего тика поллинга (15 с).
      if (isReconnect)
        trips.refreshActiveTrip().catch(() => {})
    }

    ws.onmessage = event => handleMessage(event)

    ws.onerror = () => {
      errorMessage.value = 'WebSocket поездки недоступен.'
    }

    ws.onclose = () => {
      if (socket === ws)
        socket = null

      status.value = 'closed'

      if (intentionallyClosed || !tripId.value)
        return

      reconnectAttempts += 1

      // Сообщаем о деградации один раз за сбой, но НЕ бросаем попытки: связь в
      // машине рвётся и возвращается, а поллинг стора тем временем страхует.
      if (reconnectAttempts >= RECONNECT_TOAST_AFTER && !toastShown) {
        toastShown = true
        errorMessage.value = 'Обновления приходят с задержкой — пытаемся восстановить связь.'
        toast.warning('Онлайн-обновления недоступны', errorMessage.value)
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

    openSocket()
  }

  // Сеть вернулась или мини-апп вышел из фона — переподключаемся сразу, не
  // дожидаясь хвоста бэкоффа (в фоне вебвью замораживает таймеры, и без этого
  // вернувшийся пассажир ждал бы до 30 секунд).
  function reconnectNow() {
    if (intentionallyClosed || !tripId.value || canReuseSocket())
      return

    clearReconnectTimer()
    openSocket()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible')
      reconnectNow()
  }

  function close() {
    intentionallyClosed = true
    clearReconnectTimer()

    if (socket) {
      socket.close()
      socket = null
    }

    status.value = 'closed'
  }

  watch(tripId, (nextTripId, previousTripId) => {
    if (nextTripId === previousTripId)
      return

    close()

    if (nextTripId) {
      intentionallyClosed = false
      reconnectAttempts = 0
      toastShown = false
      connect()
    }
  }, { immediate: true })

  onMounted(() => {
    window.addEventListener('online', reconnectNow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', reconnectNow)
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
