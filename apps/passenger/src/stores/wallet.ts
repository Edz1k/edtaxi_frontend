import type { PaymentCard, Wallet, WalletTransaction } from '@edtaxi/shared/types/wallet'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { showErrorToast } from '~/api/errors'
import { bindCard as bindCardApi, getMyCard, getWallet, getWalletHistory, setDefaultCard as setDefaultCardApi, topUpWallet, unbindCardById as unbindCardByIdApi } from '~/api/wallet'

export const useWalletStore = defineStore('wallet', () => {
  const wallet = ref<Wallet | null>(null)
  const transactions = ref<WalletTransaction[]>([])
  const offset = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const isLoadingHistory = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  // Привязанные карты: cards — все активные (основная первой), card — основная
  // (легаси-имя времён одной карты, много кода завязано на него). isCardLoaded
  // отличает «ещё не загружали» от «карт нет» — чтобы подсказки про привязку
  // не мигали до первого ответа бэка.
  const card = ref<null | PaymentCard>(null)
  const cards = ref<PaymentCard[]>([])
  const isCardLoaded = ref(false)

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

  // loadCard — тихая загрузка (без тостов): вызывается и из поллинга привязки,
  // и из селектора способа оплаты.
  async function loadCard() {
    try {
      const response = await getMyCard()
      card.value = response.card
      // cards может отсутствовать в ответе старого бэка — тогда производим из card.
      cards.value = response.cards ?? (response.card ? [response.card] : [])
      isCardLoaded.value = true
      return card.value
    }
    catch {
      return card.value
    }
  }

  // setDefaultCard — сделать карту основной (поездки списываются с неё).
  async function setDefaultCard(cardId: string) {
    isMutating.value = true
    try {
      await setDefaultCardApi(cardId)
      await loadCard()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось сменить основную карту.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  // bindCard создаёт платёж привязки и возвращает redirect_url — карта
  // появится после оплаты (страница опрашивает loadCard, пока фрейм открыт).
  async function bindCard() {
    isMutating.value = true
    errorMessage.value = ''

    try {
      return await bindCardApi()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось начать привязку карты.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  // unbindCard — отвязать конкретную карту (по id).
  async function unbindCard(cardId: string) {
    isMutating.value = true
    errorMessage.value = ''

    try {
      await unbindCardByIdApi(cardId)
      await loadCard()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отвязать карту.')
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
    card.value = null
    cards.value = []
    isCardLoaded.value = false
    resetHistory()
    isLoading.value = false
    isLoadingHistory.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    bindCard,
    card,
    cards,
    clearWalletState,
    errorMessage,
    hasMore,
    isCardLoaded,
    isLoading,
    isLoadingHistory,
    isMutating,
    loadCard,
    loadHistory,
    loadMore,
    loadWallet,
    offset,
    resetHistory,
    setDefaultCard,
    topUp,
    transactions,
    unbindCard,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWalletStore as any, import.meta.hot))
