import type { SupportMessage, SupportParticipantType, SupportRoom, SupportRoomStatus, SupportSubject } from '~/types/support'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { showErrorToast } from '~/api/errors'
import {
  attachTripToSupport,
  closeSupportRoom,
  getSupportMessages,
  getSupportRoom,
  listSupportRooms,
  openSupportRoom,
  sendSupportMessage,
  uploadSupportImage,
} from '~/api/support'

export const useSupportStore = defineStore('support', () => {
  // Пользователь может вести несколько обращений (тикетов) по разным темам:
  // rooms — список всех, activeRoom — открытый тред, messages — его сообщения.
  const rooms = ref<SupportRoom[]>([])
  const activeRoom = ref<SupportRoom | null>(null)
  const messages = ref<SupportMessage[]>([])
  const isLoading = ref(false)
  const isSending = ref(false)
  const errorMessage = ref('')

  // Тип участника запоминаем — водительское приложение переиспользует этот же
  // стор с 'driver'.
  let participant: SupportParticipantType = 'passenger'

  function upsertRoom(room: SupportRoom) {
    const idx = rooms.value.findIndex(r => r.id === room.id)
    if (idx === -1)
      rooms.value = [room, ...rooms.value]
    else
      rooms.value = rooms.value.map(r => (r.id === room.id ? room : r))
  }

  function applyRoomStatus(roomId: string, status: SupportRoomStatus) {
    if (activeRoom.value?.id === roomId)
      activeRoom.value = { ...activeRoom.value, status }
    rooms.value = rooms.value.map(r => (r.id === roomId ? { ...r, status } : r))
  }

  async function loadRooms(participantType: SupportParticipantType = 'passenger') {
    participant = participantType
    isLoading.value = true
    errorMessage.value = ''
    try {
      const res = await listSupportRooms(participantType)
      rooms.value = res.rooms
      return rooms.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить обращения.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadMessages() {
    if (!activeRoom.value)
      return
    isLoading.value = true
    errorMessage.value = ''
    try {
      const res = await getSupportMessages(activeRoom.value.id, 50, 0)
      messages.value = res.messages
      return res
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить сообщения.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  // openRoom создаёт новое обращение по теме (или переиспользует незакрытое с
  // той же темой на бэкенде) и открывает его тред.
  async function openRoom(subject: SupportSubject, participantType: SupportParticipantType = participant) {
    participant = participantType
    isLoading.value = true
    errorMessage.value = ''
    try {
      const room = await openSupportRoom({ participant_type: participantType, subject })
      upsertRoom(room)
      activeRoom.value = room
      await loadMessages().catch(() => {})
      return room
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось открыть обращение.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function selectRoom(room: SupportRoom) {
    activeRoom.value = room
    messages.value = []
    await loadMessages().catch(() => {})
  }

  // closeThread возвращает пользователя к списку обращений, не закрывая само
  // обращение.
  function closeThread() {
    activeRoom.value = null
    messages.value = []
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim()
    if (!trimmed || !activeRoom.value)
      return
    isSending.value = true
    errorMessage.value = ''
    try {
      const message = await sendSupportMessage(activeRoom.value.id, { content: trimmed })
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

  async function uploadImage(file: Blob) {
    if (!activeRoom.value)
      return
    isSending.value = true
    errorMessage.value = ''
    try {
      const message = await uploadSupportImage(activeRoom.value.id, file)
      messages.value = [...messages.value, message]
      return message
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить фото.')
      throw error
    }
    finally {
      isSending.value = false
    }
  }

  // attachTrip открывает обращение по теме «Поездка» и прикрепляет к нему поездку
  // из истории.
  async function attachTrip(tripId: string, participantType: SupportParticipantType = 'passenger') {
    const room = await openRoom('trip', participantType)
    await attachTripToSupport(room.id, tripId)
    return room
  }

  async function refreshActiveRoom() {
    if (!activeRoom.value)
      return
    try {
      const updated = await getSupportRoom(activeRoom.value.id)
      activeRoom.value = updated
      upsertRoom(updated)
    }
    catch {}
  }

  function receiveMessage(message: SupportMessage & { room_id: string, room_status?: SupportRoomStatus }) {
    // Статус приходит прямо в пейлоаде — обновляем комнату без лишнего запроса.
    if (message.room_status)
      applyRoomStatus(message.room_id, message.room_status)

    if (!activeRoom.value || message.room_id !== activeRoom.value.id)
      return
    if (messages.value.some(m => m.id === message.id))
      return
    messages.value = [...messages.value, {
      id: message.id,
      content: message.content,
      image_url: message.image_url,
      sender_id: message.sender_id,
      sent_at: message.sent_at,
    }]
    // Фолбэк для старого пейлоада без room_status.
    if (!message.room_status)
      refreshActiveRoom()
  }

  async function closeRoom() {
    if (!activeRoom.value)
      return
    isLoading.value = true
    errorMessage.value = ''
    try {
      await closeSupportRoom(activeRoom.value.id)
      applyRoomStatus(activeRoom.value.id, 'closed')
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось закрыть обращение.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  function clearSupportState() {
    rooms.value = []
    activeRoom.value = null
    messages.value = []
    isLoading.value = false
    isSending.value = false
    errorMessage.value = ''
  }

  return {
    activeRoom,
    attachTrip,
    clearSupportState,
    closeRoom,
    closeThread,
    errorMessage,
    isLoading,
    isSending,
    loadMessages,
    loadRooms,
    messages,
    openRoom,
    receiveMessage,
    refreshActiveRoom,
    rooms,
    selectRoom,
    sendMessage,
    uploadImage,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSupportStore as any, import.meta.hot))
