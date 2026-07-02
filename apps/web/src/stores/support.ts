import type { SupportListRoomsParams, SupportMessage, SupportRoom } from '~/types/support'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  claimTechSupportRoom,
  closeTechSupportRoom,
  getTechSupportMessages,
  getTechSupportRoom,
  listTechSupportRooms,
  sendTechSupportMessage,
} from '~/api/support'
import { useStoreAction } from '~/composables/useStoreAction'

export const useSupportStore = defineStore('support', () => {
  const rooms = ref<SupportRoom[]>([])
  const currentRoom = ref<SupportRoom | null>(null)
  const messages = ref<SupportMessage[]>([])
  const isLoading = ref(false)
  const isLoadingMessages = ref(false)
  const isMutating = ref(false)
  const isSending = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadRooms(params: SupportListRoomsParams = {}) {
    return withLoading(isLoading, async () => {
      const response = await listTechSupportRooms(params)
      rooms.value = response.rooms
      return response
    }, 'Не удалось загрузить обращения поддержки.')
  }

  // loadRoom только открывает обращение на просмотр — без захвата (claim),
  // чтобы можно было читать чужие/занятые диалоги без конфликта 409.
  async function loadRoom(id: string) {
    return withLoading(isLoading, async () => {
      currentRoom.value = await getTechSupportRoom(id)
      return currentRoom.value
    }, 'Не удалось загрузить обращение.')
  }

  // claimRoom явно берёт обращение в работу — только после этого агент может
  // отвечать. Конфликт (взято другим) обрабатывается стором как ошибка.
  async function claimRoom(id: string) {
    return withLoading(isMutating, async () => {
      const room = await claimTechSupportRoom(id)
      currentRoom.value = room
      const index = rooms.value.findIndex(r => r.id === id)
      if (index !== -1)
        rooms.value[index] = room
      return room
    }, 'Не удалось взять обращение в работу.')
  }

  // receiveMessage добавляет входящее сообщение из WS, если оно относится к
  // открытому сейчас обращению и ещё не отображено.
  function receiveMessage(message: SupportMessage & { room_id: string }) {
    if (!currentRoom.value || message.room_id !== currentRoom.value.id)
      return
    if (messages.value.some(m => m.id === message.id))
      return
    messages.value = [...messages.value, message]
  }

  async function loadMessages(id: string) {
    return withLoading(isLoadingMessages, async () => {
      const response = await getTechSupportMessages(id, { limit: 100 })
      messages.value = response.messages ?? []
      return response
    }, 'Не удалось загрузить сообщения.')
  }

  async function sendMessage(id: string, content: string) {
    return withLoading(isSending, async () => {
      const msg = await sendTechSupportMessage(id, content)
      messages.value = [...messages.value, msg]
      return msg
    }, 'Не удалось отправить сообщение.')
  }

  async function closeRoom(room: SupportRoom) {
    return withLoading(isMutating, async () => {
      await closeTechSupportRoom(room.id)
      room.status = 'pending_close'
      const index = rooms.value.findIndex(r => r.id === room.id)
      if (index !== -1)
        rooms.value[index] = { ...rooms.value[index], status: 'pending_close' }
      if (currentRoom.value?.id === room.id) {
        currentRoom.value.status = 'pending_close'
        currentRoom.value = await getTechSupportRoom(room.id).catch(() => currentRoom.value)
      }
    }, 'Не удалось закрыть обращение.')
  }

  function clearSupportState() {
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
    claimRoom,
    closeRoom,
    clearSupportState,
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
  import.meta.hot.accept(acceptHMRUpdate(useSupportStore as any, import.meta.hot))
