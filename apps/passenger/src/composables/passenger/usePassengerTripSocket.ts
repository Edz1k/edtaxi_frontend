import type { PassengerWebSocketMessage } from '~/types/websocket'
import { buildWsUrl } from '~/api/client'
import { useToast } from '~/composables/useToast'
import { useTripsStore } from '~/stores/trips'

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 1500

export function usePassengerTripSocket(tripId: Ref<string>) {
  const toast = useToast()
  const trips = useTripsStore()
  const errorMessage = ref('')
  const status = ref<'closed' | 'connecting' | 'open'>('closed')

  let socket: null | WebSocket = null
  let reconnectAttempts = 0
  let reconnectTimer: number | undefined
  let intentionallyClosed = false

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

  function openSocket() {
    if (!tripId.value || canReuseSocket())
      return

    intentionallyClosed = false
    status.value = 'connecting'
    errorMessage.value = ''

    const ws = new WebSocket(buildWsUrl(`/ws/trip/${tripId.value}/track`))
    socket = ws

    ws.onopen = () => {
      reconnectAttempts = 0
      status.value = 'open'
      errorMessage.value = ''
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

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        errorMessage.value = 'Не удалось восстановить обновления поездки.'
        toast.warning('Онлайн-обновления недоступны', errorMessage.value)
        return
      }

      reconnectAttempts += 1
      clearReconnectTimer()
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined
        openSocket()
      }, RECONNECT_DELAY_MS)
    }
  }

  function connect() {
    if (typeof window === 'undefined')
      return

    openSocket()
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
      connect()
    }
  }, { immediate: true })

  onBeforeUnmount(close)

  return {
    close,
    connect,
    errorMessage,
    isOpen,
    status,
  }
}
