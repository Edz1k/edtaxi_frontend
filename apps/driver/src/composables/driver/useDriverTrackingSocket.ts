import type { DriverLocationPayload } from '~/types/driver'
import type { DriverTripOffer, DriverWebSocketMessage } from '~/types/websocket'
import { useWebSocket } from '@vueuse/core'
import { buildWsUrl } from '~/api/client'
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'

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

  let locationTimer: number | undefined
  let watchId: number | undefined

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

  const {
    close: closeSocket,
    open: openSocket,
    send,
    status: socketStatus,
  } = useWebSocket<string>(buildWsUrl('/ws/driver/tracking'), {
    autoReconnect: {
      delay: 1500,
      onFailed() {
        errorMessage.value = 'Не удалось восстановить WebSocket соединение.'
        toast.error('Связь с сервером недоступна', errorMessage.value)
      },
      retries: 3,
    },
    immediate: false,
    onConnected() {
      errorMessage.value = ''
      startLocationStreaming()
    },
    onDisconnected() {
      stopLocationStreaming()
    },
    onError() {
      // Без тоста: onError стреляет на КАЖДЫЙ обрыв, а связь в машине рвётся и
      // возвращается постоянно — водителя засыпало «Связь с сервером
      // недоступна» при каждом моргании сети. Пользователю сообщаем один раз,
      // когда реконнект исчерпал попытки (autoReconnect.onFailed выше).
      errorMessage.value = 'WebSocket водителя недоступен.'
    },
    onMessage: (_ws, event) => handleMessage(event as MessageEvent<string>),
  })

  const status = computed<'closed' | 'connecting' | 'open'>(() => {
    if (socketStatus.value === 'OPEN')
      return 'open'

    if (socketStatus.value === 'CONNECTING')
      return 'connecting'

    return 'closed'
  })
  const isOpen = computed(() => status.value === 'open')

  function close() {
    stopLocationStreaming()
    closeSocket()
  }

  function sendLocation(payload: DriverLocationPayload) {
    if (!isOpen.value)
      return

    send(JSON.stringify({
      heading: payload.heading ?? 0,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed ?? 0,
    }))
  }

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
    }, 2_000)
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

  function connect() {
    if (socketStatus.value === 'OPEN' || socketStatus.value === 'CONNECTING')
      return

    errorMessage.value = ''
    openSocket()
  }

  onBeforeUnmount(close)

  return {
    close,
    connect,
    errorMessage,
    isOpen,
    status,
  }
}
