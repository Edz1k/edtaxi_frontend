import type { DriverEarnings, DriverWallet, PayoutRequest } from '~/types/driver'
import type { Trip } from '~/types/trips'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getDriverEarnings, getDriverPayouts, getDriverTripHistory, getDriverWallet, requestDriverPayout, topUpDriverWallet } from '~/api/driver'
import { showErrorToast } from '~/api/errors'

// Для графика заработка историю тянем страницами (потолок бэка — 100 за запрос)
// и останавливаемся на 500 поездках: этого хватает на окна день/месяц/год,
// а у очень активных водителей график честно помечается как усечённый.
const CHART_TRIPS_PAGE = 100
const CHART_TRIPS_MAX = 500

export const useDriverEarningsStore = defineStore('driverEarnings', () => {
  const earnings = ref<DriverEarnings | null>(null)
  const wallet = ref<DriverWallet | null>(null)
  const payouts = ref<PayoutRequest[]>([])
  const chartTrips = ref<Trip[]>([])
  const isChartTripsTruncated = ref(false)
  const isLoadingEarnings = ref(false)
  const isLoadingWallet = ref(false)
  const isLoadingPayouts = ref(false)
  const isLoadingChartTrips = ref(false)
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

  // loadChartTrips грузит завершённые поездки для диаграммы заработка.
  // История отдаётся от новых к старым, поэтому страницы читаются подряд,
  // пока не кончатся данные или не будет достигнут CHART_TRIPS_MAX.
  async function loadChartTrips() {
    isLoadingChartTrips.value = true

    try {
      const collected: Trip[] = []
      while (collected.length < CHART_TRIPS_MAX) {
        const response = await getDriverTripHistory({ limit: CHART_TRIPS_PAGE, offset: collected.length })
        collected.push(...response.trips)
        if (response.trips.length < CHART_TRIPS_PAGE)
          break
      }
      isChartTripsTruncated.value = collected.length >= CHART_TRIPS_MAX
      chartTrips.value = collected.filter(trip => trip.status === 'completed' && trip.completed_at)
      return chartTrips.value
    }
    catch (error) {
      showErrorToast(error, 'Не удалось загрузить статистику заработка.')
      throw error
    }
    finally {
      isLoadingChartTrips.value = false
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
    chartTrips.value = []
    isChartTripsTruncated.value = false
    isLoadingEarnings.value = false
    isLoadingWallet.value = false
    isLoadingPayouts.value = false
    isLoadingChartTrips.value = false
    isMutatingWallet.value = false
    isRequestingPayout.value = false
    errorMessage.value = ''
  }

  return {
    chartTrips,
    clearEarningsState,
    earnings,
    errorMessage,
    isChartTripsTruncated,
    isLoadingChartTrips,
    isLoadingEarnings,
    isLoadingPayouts,
    isLoadingWallet,
    isMutatingWallet,
    isRequestingPayout,
    loadChartTrips,
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
