import { createAuthStore } from '@edtaxi/shared/stores/create-auth-store'
import { acceptHMRUpdate } from 'pinia'
import { getAuthSession, linkTelegramPhone, logout, sendDriverAuthOtp, sendLinkPhoneOtp, sendOtp, syncTelegramName, verifyDriverAuthOtp, verifyLinkPhoneOtp, verifyOtp, verifyTelegramDriver } from '~/api/auth'
import { useDriverStore } from '~/stores/driver'
import { useDriverEarningsStore } from '~/stores/driverEarnings'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { useParkChatStore } from '~/stores/parkChat'
import { useSupportStore } from '~/stores/support'
import { useTripChatStore } from '~/stores/tripChat'

export const SAVED_ACCOUNTS_KEY = 'taxiapp_driver_saved_accounts'

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
    verifyTelegramSilent: verifyTelegramDriver,
  },
  clearRelatedStores() {
    useDriverStore().clearDriverState()
    useDriverOnboardingStore().clearOnboardingState()
    useDriverEarningsStore().clearEarningsState()
    useSupportStore().clearSupportState()
    useParkChatStore().clearParkChatState()
    useTripChatStore().clearTripChatState()
  },
  savedAccountsKey: SAVED_ACCOUNTS_KEY,
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
