import type { DriverEarnings, DriverWallet } from '~/types/driver'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getDriverEarnings, getDriverWallet, topUpDriverWallet } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { openExternalLink } from '~/composables/auth/telegram'
import { useToast } from '~/composables/useToast'

export const useDriverEarningsStore = defineStore('driverEarnings', () => {
  const earnings = ref<DriverEarnings | null>(null)
  const wallet = ref<DriverWallet | null>(null)
  const isLoadingEarnings = ref(false)
  const isLoadingWallet = ref(false)
  const isMutatingWallet = ref(false)
  const errorMessage = ref('')

  async function loadEarnings() {
    isLoadingEarnings.value = true
    errorMessage.value = ''

    try {
      earnings.value = await getDriverEarnings()
      return earnings.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить заработок.')
      throw error
    }
    finally {
      isLoadingEarnings.value = false
    }
  }

  async function loadWallet() {
    isLoadingWallet.value = true
    errorMessage.value = ''

    try {
      wallet.value = await getDriverWallet()
      return wallet.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить баланс.')
      throw error
    }
    finally {
      isLoadingWallet.value = false
    }
  }

  // topUpWallet создаёт платёж в Freedom Pay и открывает окно оплаты картой.
  // Баланс обновится не сразу, а после колбэка от Freedom — см. loadWallet.
  async function topUpWallet(amount: number) {
    isMutatingWallet.value = true
    errorMessage.value = ''

    try {
      const response = await topUpDriverWallet({ amount })
      openExternalLink(response.redirect_url)
      useToast().info('Окно оплаты открыто', 'После оплаты картой баланс обновится автоматически.')
      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось пополнить баланс.')
      throw error
    }
    finally {
      isMutatingWallet.value = false
    }
  }

  function clearEarningsState() {
    earnings.value = null
    wallet.value = null
    isLoadingEarnings.value = false
    isLoadingWallet.value = false
    isMutatingWallet.value = false
    errorMessage.value = ''
  }

  return {
    clearEarningsState,
    earnings,
    errorMessage,
    isLoadingEarnings,
    isLoadingWallet,
    isMutatingWallet,
    loadEarnings,
    loadWallet,
    topUpWallet,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverEarningsStore as any, import.meta.hot))
