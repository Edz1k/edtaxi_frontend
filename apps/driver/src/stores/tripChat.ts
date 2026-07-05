import { createTripChatStore } from '@edtaxi/shared/stores/create-trip-chat-store'
import { acceptHMRUpdate } from 'pinia'

export const useTripChatStore = createTripChatStore()

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useTripChatStore as any, import.meta.hot))
