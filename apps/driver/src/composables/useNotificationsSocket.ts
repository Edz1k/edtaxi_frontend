import type { ChatMessageWireMessage, ParkChatMessageWireMessage, PassengerWebSocketMessage } from '~/types/websocket'
import { useWebSocket } from '@vueuse/core'
import { buildWsUrl } from '~/api/client'
import { useParkChatStore } from '~/stores/parkChat'
import { useSupportStore } from '~/stores/support'

// Общий push-канал /ws/notifications — держим открытым на экранах, которым
// нужны live-обновления, не привязанные к конкретной поездке (чат поддержки
// и чат с таксопарком). Сервер адресует сообщения по userID, так что одно
// такое соединение покрывает любую роль.
export function useNotificationsSocket() {
  const support = useSupportStore()
  const parkChat = useParkChatStore()

  function handleMessage(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as PassengerWebSocketMessage

      if (message.type === 'chat_message')
        applyChatMessage(message)

      if (message.type === 'park_chat_message')
        applyParkChatMessage(message)
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

  function applyParkChatMessage(message: ParkChatMessageWireMessage) {
    // id по WS не приходит — собираем синтетический для ключей списка.
    parkChat.receiveMessage({
      id: `${message.data.room_id}:${message.data.sender_id}:${message.data.sent_at}`,
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
