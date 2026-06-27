import { buildWsUrl } from '~/api/client'
import { useParkChatStore } from '~/stores/park-chat'

interface ParkChatMessageWire {
  type: 'park_chat_message'
  data: {
    room_id: string
    sender_id: string
    content: string
    sent_at: string
  }
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 1500

// useParkChatSocket слушает /ws/notifications и доставляет входящие
// сообщения park_chat_message в стор чатов парка без перезагрузки.
export function useParkChatSocket() {
  const parkChat = useParkChatStore()

  let socket: null | WebSocket = null
  let reconnectAttempts = 0
  let reconnectTimer: number | undefined
  let intentionallyClosed = false

  function handleMessage(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as ParkChatMessageWire
      if (message.type === 'park_chat_message')
        parkChat.receiveMessage(message.data)
    }
    catch {
      // нераспознанные сообщения канала игнорируем
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  function connect() {
    if (typeof window === 'undefined')
      return
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))
      return

    intentionallyClosed = false
    const ws = new WebSocket(buildWsUrl('/ws/notifications'))
    socket = ws

    ws.onopen = () => {
      reconnectAttempts = 0
    }

    ws.onmessage = event => handleMessage(event as MessageEvent<string>)

    ws.onclose = () => {
      if (socket === ws)
        socket = null

      if (intentionallyClosed || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS)
        return

      reconnectAttempts += 1
      clearReconnectTimer()
      reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS)
    }
  }

  function close() {
    intentionallyClosed = true
    clearReconnectTimer()
    if (socket) {
      socket.close()
      socket = null
    }
  }

  onBeforeUnmount(close)

  return { close, connect }
}
