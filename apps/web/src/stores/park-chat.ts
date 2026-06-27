import type { ParkChatMessage, ParkChatRoom } from '~/types/park'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  closeParkChatRoom,
  getParkChatMessages,
  getParkChatRoom,
  listParkChatRooms,
  sendParkChatMessage,
} from '~/api/park'
import { useStoreAction } from '~/composables/useStoreAction'

export const useParkChatStore = defineStore('park-chat', () => {
  const rooms = ref<ParkChatRoom[]>([])
  const currentRoom = ref<ParkChatRoom | null>(null)
  const messages = ref<ParkChatMessage[]>([])
  const isLoading = ref(false)
  const isLoadingMessages = ref(false)
  const isMutating = ref(false)
  const isSending = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadRooms(params: { status?: string } = {}) {
    return withLoading(isLoading, async () => {
      const response = await listParkChatRooms({ ...params, limit: 100 })
      rooms.value = response.rooms
      return response
    }, 'Не удалось загрузить чаты.')
  }

  async function loadRoom(id: string) {
    return withLoading(isLoading, async () => {
      currentRoom.value = await getParkChatRoom(id)
      return currentRoom.value
    }, 'Не удалось загрузить чат.')
  }

  async function loadMessages(roomId: string) {
    return withLoading(isLoadingMessages, async () => {
      const response = await getParkChatMessages(roomId, { limit: 100 })
      messages.value = response.messages ?? []
      return response
    }, 'Не удалось загрузить сообщения.')
  }

  async function sendMessage(roomId: string, content: string) {
    return withLoading(isSending, async () => {
      const msg = await sendParkChatMessage(roomId, content)
      messages.value = [...messages.value, msg]
      return msg
    }, 'Не удалось отправить сообщение.')
  }

  async function closeRoom(room: ParkChatRoom) {
    return withLoading(isMutating, async () => {
      await closeParkChatRoom(room.id)
      room.status = 'closed'
      if (currentRoom.value?.id === room.id)
        currentRoom.value.status = 'closed'
    }, 'Не удалось закрыть чат.')
  }

  function receiveMessage(data: { room_id: string, sender_id: string, content: string, sent_at: string }) {
    if (!currentRoom.value || data.room_id !== currentRoom.value.id)
      return
    const tempId = `ws-${data.sent_at}-${data.sender_id}`
    if (messages.value.some(m => m.id === tempId))
      return
    messages.value = [...messages.value, { id: tempId, sender_id: data.sender_id, content: data.content, sent_at: data.sent_at }]
  }

  function clearState() {
    rooms.value = []
    currentRoom.value = null
    messages.value = []
    isLoading.value = false
    isLoadingMessages.value = false
    isMutating.value = false
    isSending.value = false
    errorMessage.value = ''
  }

  return {
    clearState,
    closeRoom,
    currentRoom,
    errorMessage,
    isLoading,
    isLoadingMessages,
    isMutating,
    isSending,
    loadMessages,
    loadRoom,
    loadRooms,
    messages,
    receiveMessage,
    rooms,
    sendMessage,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useParkChatStore as any, import.meta.hot))
