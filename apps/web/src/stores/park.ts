import type { ParkAnalytics, ParkChangeRequest, ParkChangeRequestPayload, ParkDriver, ParkInvite, TaxiPark, TaxiParkRegisterPayload, TaxiParkUpdatePayload } from '~/types/park'
import type { ParkWallet, PayoutCreatePayload, PayoutRequest } from '~/types/payout'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import {
  createParkInvite,
  getMyPark,
  getMyParkChangeRequest,
  getParkAnalytics,
  getParkWallet,
  listParkDrivers,
  listParkInvites,
  listParkPayouts,
  registerPark,
  removeParkDriver,
  requestParkPayout,
  submitParkChangeRequest,
  updateMyPark,
} from '~/api/park'
import { useStoreAction } from '~/composables/useStoreAction'

export const useParkStore = defineStore('park', () => {
  const park = ref<TaxiPark | null>(null)
  const analytics = ref<ParkAnalytics | null>(null)
  const drivers = ref<ParkDriver[]>([])
  const invites = ref<ParkInvite[]>([])
  // Активная (ожидающая) заявка на изменение БИН/комиссии — для баннера.
  const changeRequest = ref<ParkChangeRequest | null>(null)
  const wallet = ref<ParkWallet | null>(null)
  const payouts = ref<PayoutRequest[]>([])
  const isLoading = ref(false)
  const isLoadingWallet = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  // viewParkId — если задан, показывает чужой таксопарк (доступно только
  // хардкоженным SuperAdmin, бэкенд игнорирует park_id для остальных ролей).
  const viewParkId = ref<string | undefined>(undefined)

  async function loadPark(options: { silentNotFound?: boolean, parkId?: string } = {}) {
    isLoading.value = true
    errorMessage.value = ''
    viewParkId.value = options.parkId
    try {
      park.value = await getMyPark(options.parkId)
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
      const [analyticsResponse, driversResponse, invitesResponse, changeResponse] = await Promise.all([
        getParkAnalytics(viewParkId.value),
        listParkDrivers(viewParkId.value),
        listParkInvites(viewParkId.value),
        // Заявка на изменение — только для своего парка (не для чужого просмотра).
        viewParkId.value ? Promise.resolve({ request: null }) : getMyParkChangeRequest().catch(() => ({ request: null })),
      ])
      analytics.value = analyticsResponse
      drivers.value = driversResponse.drivers
      invites.value = invitesResponse.invites
      changeRequest.value = changeResponse.request
    }, 'Не удалось загрузить данные таксопарка.')
  }

  // Отправка заявки на изменение БИН/комиссии (одобряет админ).
  async function submitChangeRequest(payload: ParkChangeRequestPayload) {
    return withLoading(isMutating, async () => {
      changeRequest.value = await submitParkChangeRequest(payload)
      return changeRequest.value
    }, 'Не удалось отправить заявку на изменение.')
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
    changeRequest.value = null
    wallet.value = null
    payouts.value = []
    viewParkId.value = undefined
    isLoading.value = false
    isLoadingWallet.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    analytics,
    changeRequest,
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
    submitChangeRequest,
    update,
    viewParkId,
    wallet,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useParkStore as any, import.meta.hot))
