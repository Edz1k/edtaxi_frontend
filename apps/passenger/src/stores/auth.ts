import { createAuthStore } from '@edtaxi/shared/stores/create-auth-store'
import { acceptHMRUpdate } from 'pinia'
import { getAuthSession, linkTelegramPhone, logout, sendDriverAuthOtp, sendLinkPhoneOtp, sendOtp, syncTelegramName, verifyDriverAuthOtp, verifyLinkPhoneOtp, verifyOtp, verifyTelegramPassenger } from '~/api/auth'
import { usePassengerStore } from '~/stores/passenger'
import { useSupportStore } from '~/stores/support'
import { useTripChatStore } from '~/stores/tripChat'
import { useTripsStore } from '~/stores/trips'
import { useWalletStore } from '~/stores/wallet'

export const SAVED_ACCOUNTS_KEY = 'taxiapp_passenger_saved_accounts'

export const useAuthStore = createAuthStore({
  api: {
    getAuthSession,
    linkTelegramPhone,
    logout,
    sendDriverAuthOtp,
    sendLinkPhoneOtp,
    sendOtp,
    syncTelegramName,
    verifyDriverAuthOtp,
    verifyLinkPhoneOtp,
    verifyOtp,
    verifyTelegramSilent: verifyTelegramPassenger,
  },
  clearRelatedStores() {
    usePassengerStore().clearProfile()
    useTripsStore().resetTripState()
    useWalletStore().clearWalletState()
    useSupportStore().clearSupportState()
    useTripChatStore().clearTripChatState()
  },
  savedAccountsKey: SAVED_ACCOUNTS_KEY,
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
