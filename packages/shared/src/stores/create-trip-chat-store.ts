import type { TripChatMessage } from '../types/trip-chat'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { showErrorToast } from '../api/errors'
import { getTripChatMessages, sendTripChatMessage, uploadTripChatImage } from '../api/trip-chat'

// Чат поездки (пассажир <-> водитель). Один и тот же стор в обоих мини-аппах:
// эндпоинты общие, различается только то, кто собеседник. Живые сообщения
// приходят через /ws/notifications (type "trip_chat_message") и попадают сюда
// через receiveMessage; unreadCount питает бейдж на кнопке чата в активной
// поездке и сбрасывается при открытии чата.
export function createTripChatStore() {
  return defineStore('tripChat', () => {
    const tripId = ref('')
    const messages = ref<TripChatMessage[]>([])
    const isLoading = ref(false)
    const isSending = ref(false)
    const unreadCount = ref(0)
    // Страница чата открыта — входящие не считаются непрочитанными.
    const isViewing = ref(false)

    async function loadMessages() {
      if (!tripId.value)
        return

      isLoading.value = true
      try {
        const response = await getTripChatMessages(tripId.value)
        messages.value = response.messages
      }
      catch (error) {
        showErrorToast(error, 'Не удалось загрузить чат.')
      }
      finally {
        isLoading.value = false
      }
    }

    // openChat вызывается страницей чата: помечает чат просматриваемым и
    // подтягивает историю (если открыли другую поездку — с чистого листа).
    async function openChat(id: string) {
      if (tripId.value !== id) {
        tripId.value = id
        messages.value = []
      }
      isViewing.value = true
      unreadCount.value = 0
      await loadMessages()
    }

    function closeChat() {
      isViewing.value = false
    }

    async function sendMessage(content: string) {
      const trimmed = content.trim()
      if (!trimmed || !tripId.value)
        return

      isSending.value = true
      try {
        const msg = await sendTripChatMessage(tripId.value, trimmed)
        appendMessage(msg)
      }
      catch (error) {
        showErrorToast(error, 'Не удалось отправить сообщение.')
        throw error
      }
      finally {
        isSending.value = false
      }
    }

    async function uploadImage(file: Blob) {
      if (!tripId.value)
        return

      isSending.value = true
      try {
        const msg = await uploadTripChatImage(tripId.value, file)
        appendMessage(msg)
      }
      catch (error) {
        showErrorToast(error, 'Не удалось отправить фото.')
        throw error
      }
      finally {
        isSending.value = false
      }
    }

    // sendQuickMessage — «Уже выхожу» с табло поездки: шлём сообщение ещё до
    // открытия страницы чата.
    async function sendQuickMessage(id: string, content: string) {
      const msg = await sendTripChatMessage(id, content)
      if (tripId.value === id)
        appendMessage(msg)
    }

    function appendMessage(msg: TripChatMessage) {
      if (messages.value.some(existing => existing.id === msg.id))
        return
      messages.value = [...messages.value, msg]
    }

    // receiveMessage — входящее из WS. Дедуп по id (история могла уже
    // подтянуть его по REST).
    function receiveMessage(msg: TripChatMessage) {
      if (msg.trip_id === tripId.value)
        appendMessage(msg)
      if (!isViewing.value || msg.trip_id !== tripId.value)
        unreadCount.value += 1
    }

    function clearTripChatState() {
      tripId.value = ''
      messages.value = []
      unreadCount.value = 0
      isViewing.value = false
      isLoading.value = false
      isSending.value = false
    }

    return {
      clearTripChatState,
      closeChat,
      isLoading,
      isSending,
      isViewing,
      loadMessages,
      messages,
      openChat,
      receiveMessage,
      sendMessage,
      sendQuickMessage,
      tripId,
      unreadCount,
      uploadImage,
    }
  })
}
