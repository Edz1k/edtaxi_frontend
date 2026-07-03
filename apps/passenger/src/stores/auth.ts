import { createAuthStore } from '@edtaxi/shared/stores/create-auth-store'
import { acceptHMRUpdate } from 'pinia'
import { getAuthSession, logout, sendDriverAuthOtp, sendOtp, syncTelegramName, verifyDriverAuthOtp, verifyOtp, verifyTelegramPassenger } from '~/api/auth'
import { usePassengerStore } from '~/stores/passenger'
import { useSupportStore } from '~/stores/support'
import { useTripsStore } from '~/stores/trips'
import { useWalletStore } from '~/stores/wallet'

export const useAuthStore = createAuthStore({
  api: {
    getAuthSession,
    logout,
    sendDriverAuthOtp,
    sendOtp,
    syncTelegramName,
    verifyDriverAuthOtp,
    verifyOtp,
    verifyTelegramSilent: verifyTelegramPassenger,
  },
  clearRelatedStores() {
    usePassengerStore().clearProfile()
    useTripsStore().resetTripState()
    useWalletStore().clearWalletState()
    useSupportStore().clearSupportState()
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
