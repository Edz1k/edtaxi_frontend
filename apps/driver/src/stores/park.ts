import type { DriverProfile } from '~/types/driver'
import type { ParkAnalytics, ParkInvite, TaxiPark, TaxiParkRegisterPayload, TaxiParkUpdatePayload } from '~/types/park'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import {
  createParkInvite,
  getMyPark,
  getParkAnalytics,
  listParkDrivers,
  listParkInvites,
  registerPark,
  removeParkDriver,
  updateMyPark,
} from '~/api/park'

type ParkDriver = Pick<DriverProfile, 'id' | 'is_online' | 'rating' | 'total_trips' | 'user_id'>

export const useParkStore = defineStore('park', () => {
  const park = ref<TaxiPark | null>(null)
  const analytics = ref<ParkAnalytics | null>(null)
  const drivers = ref<ParkDriver[]>([])
  const invites = ref<ParkInvite[]>([])
  const isLoading = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

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
    isMutating.value = true
    errorMessage.value = ''

    try {
      park.value = await registerPark(payload)
      return park.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось зарегистрировать таксопарк.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  async function update(payload: TaxiParkUpdatePayload) {
    isMutating.value = true
    errorMessage.value = ''

    try {
      park.value = await updateMyPark(payload)
      return park.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось обновить таксопарк.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  async function loadDashboard() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const [analyticsResponse, driversResponse, invitesResponse] = await Promise.all([
        getParkAnalytics(),
        listParkDrivers(),
        listParkInvites(),
      ])

      analytics.value = analyticsResponse
      drivers.value = driversResponse.drivers
      invites.value = invitesResponse.invites
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить данные таксопарка.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function createInvite() {
    isMutating.value = true
    errorMessage.value = ''

    try {
      const invite = await createParkInvite()
      invites.value = [invite, ...invites.value]
      return invite
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось создать приглашение.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  async function removeDriver(id: string) {
    isMutating.value = true
    errorMessage.value = ''

    try {
      await removeParkDriver(id)
      drivers.value = drivers.value.filter(driver => driver.id !== id)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось удалить водителя из парка.')
      throw error
    }
    finally {
      isMutating.value = false
    }
  }

  return {
    analytics,
    createInvite,
    drivers,
    errorMessage,
    invites,
    isLoading,
    isMutating,
    loadDashboard,
    loadPark,
    park,
    register,
    removeDriver,
    update,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useParkStore as any, import.meta.hot))
