import type { DriverEarnings, DriverWallet, PayoutRequest } from '~/types/driver'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getDriverEarnings, getDriverPayouts, getDriverWallet, requestDriverPayout, topUpDriverWallet } from '~/api/driver'
import { showErrorToast } from '~/api/errors'

export const useDriverEarningsStore = defineStore('driverEarnings', () => {
  const earnings = ref<DriverEarnings | null>(null)
  const wallet = ref<DriverWallet | null>(null)
  const payouts = ref<PayoutRequest[]>([])
  const isLoadingEarnings = ref(false)
  const isLoadingWallet = ref(false)
  const isLoadingPayouts = ref(false)
  const isMutatingWallet = ref(false)
  const isRequestingPayout = ref(false)
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

  // topUpWallet создаёт платёж в Freedom Pay и возвращает redirect_url —
  // страница показывает его во встроенном фрейме. Баланс обновится не сразу,
  // а после колбэка от Freedom — см. loadWallet (страница опрашивает его, пока фрейм открыт).
  async function topUpWallet(amount: number) {
    isMutatingWallet.value = true
    errorMessage.value = ''

    try {
      return await topUpDriverWallet({ amount })
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось пополнить баланс.')
      throw error
    }
    finally {
      isMutatingWallet.value = false
    }
  }

  async function loadPayouts() {
    isLoadingPayouts.value = true
    errorMessage.value = ''

    try {
      const response = await getDriverPayouts({ limit: 20, offset: 0 })
      payouts.value = response.payouts
      return payouts.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить заявки на вывод.')
      throw error
    }
    finally {
      isLoadingPayouts.value = false
    }
  }

  // requestPayout создаёт заявку на вывод средств. Деньги списываются сразу
  // (резервируются под заявку), поэтому после успеха обновляем баланс.
  async function requestPayout(amount: number, destination: string) {
    isRequestingPayout.value = true
    errorMessage.value = ''

    try {
      const payout = await requestDriverPayout({ amount, destination })
      payouts.value = [payout, ...payouts.value]
      loadWallet().catch(() => {})
      return payout
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать заявку на вывод.')
      throw error
    }
    finally {
      isRequestingPayout.value = false
    }
  }

  function clearEarningsState() {
    earnings.value = null
    wallet.value = null
    payouts.value = []
    isLoadingEarnings.value = false
    isLoadingWallet.value = false
    isLoadingPayouts.value = false
    isMutatingWallet.value = false
    isRequestingPayout.value = false
    errorMessage.value = ''
  }

  return {
    clearEarningsState,
    earnings,
    errorMessage,
    isLoadingEarnings,
    isLoadingPayouts,
    isLoadingWallet,
    isMutatingWallet,
    isRequestingPayout,
    loadEarnings,
    loadPayouts,
    loadWallet,
    payouts,
    requestPayout,
    topUpWallet,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverEarningsStore as any, import.meta.hot))
