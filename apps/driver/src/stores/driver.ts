import type { DriverProfile, DriverStatusResponse, DriverTripStep } from '~/types/driver'
import type { Trip, VehicleCategory } from '~/types/trips'
import type { DriverTripOffer } from '~/types/websocket'
import { useToast } from '@edtaxi/shared/composables/useToast'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  acceptDriverParkInvite,
  acceptDriverTrip,
  cancelDriverTrip,
  completeDriverTrip,
  createDriverProfile,
  getActiveDriverTrip,
  getDriverCategories,
  markDriverArrived,
  rejectDriverTrip,
  setDriverCategories,
  startDriverTrip,
  updateDriverStatus,
} from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { isTerminalTripStatus, tripStatusToStep, tripToOffer } from '~/utils/trip'
import { sortCategories } from '~/utils/vehicleCategories'

export const useDriverStore = defineStore('driver', () => {
  const profile = ref<DriverProfile | null>(null)
  const pendingOffer = ref<DriverTripOffer | null>(null)
  const activeTrip = ref<Trip | null>(null)
  const activeOffer = ref<DriverTripOffer | null>(null)
  const activeTripStep = ref<DriverTripStep | null>(null)
  const currentTripId = ref('')
  const isOnline = ref(false)
  const isAvailable = ref(false)
  const isLoadingProfile = ref(false)
  const isMutatingOffer = ref(false)
  const isLoadingParkInvite = ref(false)
  const isRestoringActiveTrip = ref(false)
  const isChangingStatus = ref(false)
  const errorMessage = ref('')

  // Тарифы, по которым водитель может/хочет получать заказы.
  // available пуст, пока нет одобренной машины.
  const availableCategories = ref<VehicleCategory[]>([])
  const activeCategories = ref<VehicleCategory[]>([])
  const isLoadingCategories = ref(false)
  const isSavingCategories = ref(false)
  const hasLoadedCategories = ref(false)

  const hasActiveTrip = computed(() => Boolean(currentTripId.value))

  function clearActiveTripState() {
    activeTrip.value = null
    activeOffer.value = null
    activeTripStep.value = null
    currentTripId.value = ''
  }

  function syncActiveTrip(trip: Trip) {
    activeTrip.value = trip
    activeOffer.value = tripToOffer(trip)
    activeTripStep.value = tripStatusToStep(trip.status)
    currentTripId.value = trip.id

    if (pendingOffer.value?.trip_id === trip.id)
      clearOffer()
  }

  function applyStatus(status: DriverStatusResponse) {
    isOnline.value = status.is_online
    isAvailable.value = status.is_available

    if (profile.value) {
      profile.value = {
        ...profile.value,
        is_available: status.is_available,
        is_online: status.is_online,
      }
    }
  }

  async function ensureProfile() {
    if (profile.value)
      return profile.value

    isLoadingProfile.value = true
    errorMessage.value = ''

    try {
      profile.value = await createDriverProfile()
      isOnline.value = profile.value.is_online
      isAvailable.value = profile.value.is_available
      loadCategories().catch(() => {})
      return profile.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать профиль водителя.')
      throw error
    }
    finally {
      isLoadingProfile.value = false
    }
  }

  // loadCategories подтягивает available/active тарифы водителя.
  // Ошибка не показывается тостом: без данных чипы тарифов просто скрыты.
  async function loadCategories() {
    isLoadingCategories.value = true

    try {
      const res = await getDriverCategories()
      availableCategories.value = sortCategories(res.available)
      activeCategories.value = sortCategories(res.active)
      hasLoadedCategories.value = true
      return res
    }
    finally {
      isLoadingCategories.value = false
    }
  }

  // toggleCategory — оптимистичное включение/выключение тарифа с откатом
  // при ошибке. Последний активный тариф выключить нельзя (бэкенд вернёт 400).
  async function toggleCategory(category: VehicleCategory) {
    const previous = [...activeCategories.value]
    const isActive = previous.includes(category)
    const next = isActive
      ? previous.filter(item => item !== category)
      : sortCategories([...previous, category])

    if (isActive && next.length === 0) {
      useToast().warning('Нужен хотя бы один тариф', 'Сначала включите другой тариф.')
      return
    }

    activeCategories.value = next
    isSavingCategories.value = true

    try {
      const res = await setDriverCategories(next)
      availableCategories.value = sortCategories(res.available)
      activeCategories.value = sortCategories(res.active)
    }
    catch (error) {
      activeCategories.value = previous
      showErrorToast(error, 'Не удалось обновить тарифы.')
    }
    finally {
      isSavingCategories.value = false
    }
  }

  async function setOnline(nextOnline: boolean) {
    isChangingStatus.value = true
    errorMessage.value = ''

    try {
      const status = await updateDriverStatus({ is_online: nextOnline })
      applyStatus(status)
      return status
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось изменить статус.')
      throw error
    }
    finally {
      isChangingStatus.value = false
    }
  }

  function receiveOffer(offer: DriverTripOffer) {
    pendingOffer.value = offer
  }

  function clearOffer() {
    pendingOffer.value = null
  }

  // expireOffer закрывает оффер по сигналу trip_offer_expired с сервера.
  // Возвращает true, если закрыли именно показанный сейчас оффер.
  function expireOffer(tripId: string) {
    if (pendingOffer.value?.trip_id !== tripId)
      return false

    clearOffer()
    return true
  }

  async function acceptOffer() {
    if (!pendingOffer.value)
      return

    isMutatingOffer.value = true
    errorMessage.value = ''

    try {
      await acceptDriverTrip(pendingOffer.value.trip_id)
      activeOffer.value = pendingOffer.value
      activeTripStep.value = 'to_pickup'
      currentTripId.value = pendingOffer.value.trip_id
      clearOffer()
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось принять заказ.')
      // Оффер после неудачного принятия почти наверняка мёртв (истёк или заказ
      // ушёл другому) — закрываем модалку, чтобы она и мелодия не висели вечно.
      clearOffer()
      throw error
    }
    finally {
      isMutatingOffer.value = false
    }
  }

  async function rejectOffer() {
    if (!pendingOffer.value)
      return

    isMutatingOffer.value = true
    errorMessage.value = ''

    try {
      await rejectDriverTrip(pendingOffer.value.trip_id)
      clearOffer()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отклонить заказ.')
      throw error
    }
    finally {
      isMutatingOffer.value = false
    }
  }

  async function markArrived() {
    if (!currentTripId.value)
      return

    try {
      await markDriverArrived(currentTripId.value)
      applyTripStatus(currentTripId.value, 'driver_arriving')
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отметить прибытие.')
      throw error
    }
  }

  async function startTrip() {
    if (!currentTripId.value)
      return

    try {
      await startDriverTrip(currentTripId.value)
      applyTripStatus(currentTripId.value, 'in_progress')
      await refreshActiveTrip().catch(() => {})
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось начать поездку.')
      throw error
    }
  }

  async function completeTrip() {
    if (!currentTripId.value)
      return

    try {
      await completeDriverTrip(currentTripId.value)
      clearActiveTripState()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось завершить поездку.')
      throw error
    }
  }

  async function cancelTrip() {
    if (!currentTripId.value)
      return

    try {
      await cancelDriverTrip(currentTripId.value)
      clearActiveTripState()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отменить поездку.')
      throw error
    }
  }

  function applyTripStatus(tripId: string, status: Trip['status']) {
    if (currentTripId.value && currentTripId.value !== tripId)
      return

    if (isTerminalTripStatus(status)) {
      clearActiveTripState()
      return
    }

    currentTripId.value = tripId
    activeTripStep.value = tripStatusToStep(status)

    if (activeTrip.value && activeTrip.value.id === tripId) {
      activeTrip.value = { ...activeTrip.value, status }
      activeOffer.value = tripToOffer(activeTrip.value)
    }
  }

  async function refreshActiveTrip() {
    if (!currentTripId.value)
      return null

    try {
      const trip = await getActiveDriverTrip()

      if (!trip) {
        clearActiveTripState()
        return null
      }

      syncActiveTrip(trip)
      return trip
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось обновить активную поездку.')
      throw error
    }
  }

  async function restoreActiveTrip() {
    isRestoringActiveTrip.value = true
    errorMessage.value = ''

    try {
      const trip = await getActiveDriverTrip()

      if (!trip) {
        clearActiveTripState()
        return null
      }

      syncActiveTrip(trip)
      return trip
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось восстановить активную поездку.')
      throw error
    }
    finally {
      isRestoringActiveTrip.value = false
    }
  }

  async function acceptParkInvite(token: string) {
    isLoadingParkInvite.value = true
    errorMessage.value = ''

    try {
      return await acceptDriverParkInvite(token)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось принять приглашение таксопарка.')
      throw error
    }
    finally {
      isLoadingParkInvite.value = false
    }
  }

  function clearDriverState() {
    profile.value = null
    pendingOffer.value = null
    clearActiveTripState()
    isOnline.value = false
    isAvailable.value = false
    isLoadingProfile.value = false
    isMutatingOffer.value = false
    isLoadingParkInvite.value = false
    availableCategories.value = []
    activeCategories.value = []
    isLoadingCategories.value = false
    isSavingCategories.value = false
    hasLoadedCategories.value = false
    errorMessage.value = ''
  }

  return {
    acceptOffer,
    acceptParkInvite,
    activeCategories,
    activeOffer,
    activeTrip,
    activeTripStep,
    applyTripStatus,
    availableCategories,
    cancelTrip,
    clearDriverState,
    clearOffer,
    completeTrip,
    currentTripId,
    ensureProfile,
    errorMessage,
    expireOffer,
    hasActiveTrip,
    hasLoadedCategories,
    isAvailable,
    isChangingStatus,
    isLoadingCategories,
    isLoadingParkInvite,
    isLoadingProfile,
    isMutatingOffer,
    isOnline,
    isRestoringActiveTrip,
    isSavingCategories,
    loadCategories,
    markArrived,
    pendingOffer,
    profile,
    receiveOffer,
    refreshActiveTrip,
    rejectOffer,
    restoreActiveTrip,
    setOnline,
    startTrip,
    toggleCategory,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverStore as any, import.meta.hot))
