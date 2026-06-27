import type { ChatMessageWireMessage, PassengerWebSocketMessage } from '~/types/websocket'
import { useWebSocket } from '@vueuse/core'
import { buildWsUrl } from '~/api/client'
import { useSupportStore } from '~/stores/support'

// Общий push-канал /ws/notifications — держим открытым на экранах, которым
// нужны live-обновления, не привязанные к конкретной поездке (сейчас это
// только чат поддержки). Сервер адресует сообщения по userID, так что одно
// такое соединение покрывает любую роль.
export function useNotificationsSocket() {
  const support = useSupportStore()

  function handleMessage(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as PassengerWebSocketMessage

      if (message.type === 'chat_message')
        applyChatMessage(message)
    }
    catch {
      // молча игнорируем нераспознанные сообщения — это общий канал
    }
  }

  function applyChatMessage(message: ChatMessageWireMessage) {
    support.receiveMessage({
      id: message.data.id,
      content: message.data.content,
      sender_id: message.data.sender_id,
      sent_at: message.data.sent_at,
      room_id: message.data.room_id,
    })
  }

  const { close: closeSocket, open: openSocket, status: socketStatus } = useWebSocket<string>(
    buildWsUrl('/ws/notifications'),
    {
      autoReconnect: {
        delay: 1500,
        retries: 3,
      },
      immediate: false,
      onMessage: (_ws, event) => handleMessage(event as MessageEvent<string>),
    },
  )

  function connect() {
    if (socketStatus.value === 'OPEN' || socketStatus.value === 'CONNECTING')
      return
    openSocket()
  }

  function close() {
    closeSocket()
  }

  onBeforeUnmount(close)

  return {
    close,
    connect,
  }
}
