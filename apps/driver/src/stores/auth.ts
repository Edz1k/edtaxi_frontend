import { createAuthStore } from '@edtaxi/shared/stores/create-auth-store'
import { acceptHMRUpdate } from 'pinia'
import { getAuthSession, logout, sendDriverAuthOtp, sendOtp, syncTelegramName, verifyDriverAuthOtp, verifyOtp, verifyTelegramDriver } from '~/api/auth'
import { useDriverStore } from '~/stores/driver'
import { useDriverEarningsStore } from '~/stores/driverEarnings'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { useParkChatStore } from '~/stores/parkChat'
import { useSupportStore } from '~/stores/support'

export const useAuthStore = createAuthStore({
  api: {
    getAuthSession,
    logout,
    sendDriverAuthOtp,
    sendOtp,
    syncTelegramName,
    verifyDriverAuthOtp,
    verifyOtp,
    verifyTelegramSilent: verifyTelegramDriver,
  },
  clearRelatedStores() {
    useDriverStore().clearDriverState()
    useDriverOnboardingStore().clearOnboardingState()
    useDriverEarningsStore().clearEarningsState()
    useSupportStore().clearSupportState()
    useParkChatStore().clearParkChatState()
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
