import type {
  DailyCheck,
  DriverVehicle,
  DriverVehiclePayload,
  DriverVehicleVerification,
  DriverVerificationsResponse,
} from '~/types/driver'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  addDriverVehicle,
  getVerificationStatus,
  listDriverVehicles,
  submitDailyCheck,
  updateDriverVehicle,
  uploadFacePhoto,
  uploadVehiclePhoto,
  uploadVehicleTechPassport,
} from '~/api/driver'
import { showErrorToast } from '~/api/errors'

export const useDriverOnboardingStore = defineStore('driverOnboarding', () => {
  const vehicle = ref<DriverVehicle | null>(null)
  const vehicles = ref<DriverVehicleVerification[]>([])
  const verification = ref<DriverVerificationsResponse | null>(null)
  const isLoading = ref(false)
  const isLoadingVerification = ref(false)
  const errorMessage = ref('')

  const hasVehicle = computed(() => Boolean(vehicle.value) || vehicles.value.length > 0)

  async function loadVerification() {
    isLoadingVerification.value = true
    errorMessage.value = ''

    try {
      verification.value = await getVerificationStatus()
      vehicles.value = verification.value.vehicles
      return verification.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить статус верификации.')
      throw error
    }
    finally {
      isLoadingVerification.value = false
    }
  }

  async function loadVehicles() {
    try {
      const res = await listDriverVehicles()
      vehicles.value = res.vehicles
      return res.vehicles
    }
    catch (error) {
      showErrorToast(error, 'Не удалось загрузить список машин.')
      throw error
    }
  }

  async function saveVehicle(payload: DriverVehiclePayload) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      vehicle.value = await addDriverVehicle(payload)
      return vehicle.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось добавить автомобиль.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function updateVehicle(id: string, payload: DriverVehiclePayload) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const updated = await updateDriverVehicle(id, payload)
      vehicles.value = vehicles.value.map(v => v.id === id ? updated : v)
      if (verification.value)
        verification.value = { ...verification.value, vehicles: vehicles.value }
      return updated
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось обновить автомобиль.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function doUploadVehiclePhoto(vehicleId: string, file: File) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const updated = await uploadVehiclePhoto(vehicleId, file)
      vehicles.value = vehicles.value.map(v => v.id === updated.id ? updated : v)
      if (verification.value)
        verification.value = { ...verification.value, vehicles: vehicles.value }
      return updated
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить фото машины.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function doUploadTechPassport(vehicleId: string, file: File) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      return await uploadVehicleTechPassport(vehicleId, file)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить техпаспорт.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function doUploadFacePhoto(file: File) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await uploadFacePhoto(file)
      if (verification.value)
        verification.value = { ...verification.value, face_verified: true }
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить фото лица.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function doSubmitDailyCheck(vehicleId: string, selfie: File, vehiclePhoto: File): Promise<DailyCheck> {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const result = await submitDailyCheck(vehicleId, selfie, vehiclePhoto)
      if (verification.value)
        verification.value = { ...verification.value, daily_check_valid: result.status === 'approved' || result.status === 'pending' }
      return result
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить ежедневную проверку.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  function clearOnboardingState() {
    vehicle.value = null
    vehicles.value = []
    verification.value = null
    isLoading.value = false
    isLoadingVerification.value = false
    errorMessage.value = ''
  }

  return {
    clearOnboardingState,
    doSubmitDailyCheck,
    doUploadFacePhoto,
    doUploadTechPassport,
    doUploadVehiclePhoto,
    errorMessage,
    hasVehicle,
    isLoading,
    isLoadingVerification,
    loadVehicles,
    loadVerification,
    saveVehicle,
    updateVehicle,
    vehicle,
    vehicles,
    verification,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverOnboardingStore as any, import.meta.hot))
