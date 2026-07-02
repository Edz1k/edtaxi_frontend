import type { ParkChatMessage, ParkChatRoom } from '~/types/parkChat'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { showErrorToast } from '~/api/errors'
import { closeParkChatRoom, getParkChatMessages, getParkChatRoom, openParkChatRoom, sendParkChatMessage } from '~/api/parkChat'

export const useParkChatStore = defineStore('parkChat', () => {
  const room = ref<ParkChatRoom | null>(null)
  const messages = ref<ParkChatMessage[]>([])
  const isLoading = ref(false)
  const isSending = ref(false)
  const errorMessage = ref('')

  async function ensureRoom() {
    if (room.value && room.value.status !== 'closed')
      return room.value

    if (room.value?.status === 'closed') {
      room.value = null
      messages.value = []
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      room.value = await openParkChatRoom()
      await loadMessages().catch(() => {})
      return room.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось открыть чат с таксопарком.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadMessages() {
    if (!room.value)
      return

    isLoading.value = true
    errorMessage.value = ''

    try {
      const response = await getParkChatMessages(room.value.id, 50, 0)
      messages.value = response.messages
      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить сообщения.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim()

    if (!trimmed)
      return

    const activeRoom = await ensureRoom()
    isSending.value = true
    errorMessage.value = ''

    try {
      const message = await sendParkChatMessage(activeRoom.id, { content: trimmed })
      messages.value = [...messages.value, message]
      return message
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить сообщение.')
      throw error
    }
    finally {
      isSending.value = false
    }
  }

  // refreshRoom подтягивает актуальный статус комнаты (парк мог закрыть чат).
  async function refreshRoom() {
    if (!room.value)
      return
    try {
      room.value = await getParkChatRoom(room.value.id)
    }
    catch {}
  }

  // receiveMessage — сообщение из WS. Бэкенд не передаёт id по WS, поэтому
  // дедуплицируем по отправителю, времени и тексту.
  function receiveMessage(message: ParkChatMessage & { room_id: string }) {
    if (!room.value || message.room_id !== room.value.id)
      return
    if (messages.value.some(m => m.sender_id === message.sender_id && m.sent_at === message.sent_at && m.content === message.content))
      return
    messages.value = [...messages.value, message]
  }

  async function closeRoom() {
    if (!room.value)
      return

    isLoading.value = true
    errorMessage.value = ''

    try {
      await closeParkChatRoom(room.value.id)
      room.value = {
        ...room.value,
        status: 'closed',
      }
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось закрыть чат.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  function clearParkChatState() {
    room.value = null
    messages.value = []
    isLoading.value = false
    isSending.value = false
    errorMessage.value = ''
  }

  return {
    clearParkChatState,
    closeRoom,
    ensureRoom,
    errorMessage,
    isLoading,
    isSending,
    loadMessages,
    messages,
    receiveMessage,
    refreshRoom,
    room,
    sendMessage,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useParkChatStore as any, import.meta.hot))
