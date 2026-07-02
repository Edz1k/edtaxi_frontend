import type { ParkAnalytics, ParkDriver, ParkInvite, TaxiPark, TaxiParkRegisterPayload, TaxiParkUpdatePayload } from '~/types/park'
import type { ParkWallet, PayoutCreatePayload, PayoutRequest } from '~/types/payout'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import {
  createParkInvite,
  getMyPark,
  getParkAnalytics,
  getParkWallet,
  listParkDrivers,
  listParkInvites,
  listParkPayouts,
  registerPark,
  removeParkDriver,
  requestParkPayout,
  updateMyPark,
} from '~/api/park'
import { useStoreAction } from '~/composables/useStoreAction'

export const useParkStore = defineStore('park', () => {
  const park = ref<TaxiPark | null>(null)
  const analytics = ref<ParkAnalytics | null>(null)
  const drivers = ref<ParkDriver[]>([])
  const invites = ref<ParkInvite[]>([])
  const wallet = ref<ParkWallet | null>(null)
  const payouts = ref<PayoutRequest[]>([])
  const isLoading = ref(false)
  const isLoadingWallet = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadPark(options: { silentNotFound?: boolean } = {}) {
    isLoading.value = true
    errorMessage.value = ''
    try {
      park.value = await getMyPark()
      return park.value
    }
    catch (error) {
      if (options.silentNotFound && error instanceof ApiError && error.status === 404) {
        park.value = null
        return null
      }
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить таксопарк.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function register(payload: TaxiParkRegisterPayload) {
    return withLoading(isMutating, async () => {
      park.value = await registerPark(payload)
      return park.value
    }, 'Не удалось зарегистрировать таксопарк.')
  }

  async function update(payload: TaxiParkUpdatePayload) {
    return withLoading(isMutating, async () => {
      park.value = await updateMyPark(payload)
      return park.value
    }, 'Не удалось обновить таксопарк.')
  }

  async function loadDashboard() {
    return withLoading(isLoading, async () => {
      const [analyticsResponse, driversResponse, invitesResponse] = await Promise.all([
        getParkAnalytics(),
        listParkDrivers(),
        listParkInvites(),
      ])
      analytics.value = analyticsResponse
      drivers.value = driversResponse.drivers
      invites.value = invitesResponse.invites
    }, 'Не удалось загрузить данные таксопарка.')
  }

  async function createInvite() {
    return withLoading(isMutating, async () => {
      const invite = await createParkInvite()
      invites.value = [invite, ...invites.value]
      return invite
    }, 'Не удалось создать приглашение.')
  }

  async function removeDriver(id: string) {
    return withLoading(isMutating, async () => {
      await removeParkDriver(id)
      drivers.value = drivers.value.filter(driver => driver.id !== id)
    }, 'Не удалось удалить водителя из парка.')
  }

  async function loadWallet() {
    return withLoading(isLoadingWallet, async () => {
      const [walletResponse, payoutsResponse] = await Promise.all([
        getParkWallet(),
        listParkPayouts({ limit: 50 }),
      ])
      wallet.value = walletResponse
      payouts.value = payoutsResponse.payouts
      return walletResponse
    }, 'Не удалось загрузить кошелёк парка.')
  }

  async function requestPayout(payload: PayoutCreatePayload) {
    isMutating.value = true
    errorMessage.value = ''
    try {
      const payout = await requestParkPayout(payload)
      payouts.value = [payout, ...payouts.value]
      // Сумма удерживается с баланса сразу при создании заявки.
      if (wallet.value)
        wallet.value.available_balance -= payout.amount
      return payout
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать заявку на вывод.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  function clearParkState() {
    park.value = null
    analytics.value = null
    drivers.value = []
    invites.value = []
    wallet.value = null
    payouts.value = []
    isLoading.value = false
    isLoadingWallet.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    analytics,
    clearParkState,
    createInvite,
    drivers,
    errorMessage,
    invites,
    isLoading,
    isLoadingWallet,
    isMutating,
    loadDashboard,
    loadPark,
    loadWallet,
    park,
    payouts,
    register,
    removeDriver,
    requestPayout,
    update,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useParkStore as any, import.meta.hot))
