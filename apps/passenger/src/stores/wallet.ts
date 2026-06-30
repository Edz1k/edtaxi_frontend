import type { Wallet, WalletTransaction } from '~/types/wallet'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { showErrorToast } from '~/api/errors'
import { getWallet, getWalletHistory, topUpWallet } from '~/api/wallet'

export const useWalletStore = defineStore('wallet', () => {
  const wallet = ref<Wallet | null>(null)
  const transactions = ref<WalletTransaction[]>([])
  const offset = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const isLoadingHistory = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  async function loadWallet() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      wallet.value = await getWallet()
      return wallet.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить кошелек.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadHistory(limit = 20, nextOffset = 0, options: { append?: boolean } = {}) {
    if (isLoadingHistory.value)
      return

    isLoadingHistory.value = true
    errorMessage.value = ''

    try {
      const response = await getWalletHistory(limit, nextOffset)
      transactions.value = options.append
        ? [
            ...transactions.value,
            ...response.transactions.filter(item => !transactions.value.some(existing => existing.id === item.id)),
          ]
        : response.transactions
      offset.value = response.offset + response.transactions.length
      hasMore.value = response.transactions.length >= response.limit
      return response
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить историю кошелька.')
      throw error
    }
    finally {
      isLoadingHistory.value = false
    }
  }

  async function loadMore(limit = 20) {
    if (!hasMore.value || isLoadingHistory.value)
      return

    return loadHistory(limit, offset.value, { append: true })
  }

  // topUp создаёт платёж в Freedom Pay и возвращает redirect_url — страница
  // показывает его во встроенном фрейме. Баланс обновится не сразу, а после
  // колбэка от Freedom — см. wallet/history (страница опрашивает их, пока фрейм открыт).
  async function topUp(amount: number) {
    isMutating.value = true
    errorMessage.value = ''

    try {
      return await topUpWallet({ amount })
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось пополнить баланс.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  function resetHistory() {
    transactions.value = []
    offset.value = 0
    hasMore.value = true
  }

  function clearWalletState() {
    wallet.value = null
    resetHistory()
    isLoading.value = false
    isLoadingHistory.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    clearWalletState,
    errorMessage,
    hasMore,
    isLoading,
    isLoadingHistory,
    isMutating,
    loadHistory,
    loadMore,
    loadWallet,
    offset,
    resetHistory,
    topUp,
    transactions,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWalletStore as any, import.meta.hot))
