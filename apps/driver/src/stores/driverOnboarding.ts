import type {
  DailyCheck,
  DriverVehicle,
  DriverVehiclePayload,
  DriverVehicleVerification,
  DriverVerificationsResponse,
  VehiclePhotoSlot,
  VehicleSlotPhoto,
  VerificationStatus,
} from '~/types/driver'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  addDriverVehicle,
  getVehiclePhotos,
  getVerificationStatus,
  listDriverVehicles,
  submitDailyCheck,
  submitVehiclePhotos,
  updateDriverVehicle,
  uploadFaceVerification,
  uploadVehiclePhoto,
  uploadVehicleSlotPhoto,
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

  // Пофотослотовая верификация машины (чек-лист вместо одной фотографии + техпаспорта).
  const vehiclePhotos = ref<VehicleSlotPhoto[]>([])
  const requiredPhotoSlots = ref<VehiclePhotoSlot[]>([])
  const missingPhotoSlots = ref<VehiclePhotoSlot[]>([])
  const canSubmitPhotos = ref(false)
  const isLoadingPhotos = ref(false)
  const isSubmittingPhotos = ref(false)
  // Set слотов, которые сейчас грузятся — управляет спиннером конкретной карточки.
  const uploadingPhotoSlots = ref<Set<VehiclePhotoSlot>>(new Set())

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

  // applyVehicleVerificationStatus обновляет статус машины локально —
  // например, после отправки фото на проверку хаб сразу показывает «На проверке».
  function applyVehicleVerificationStatus(vehicleId: string, status: VerificationStatus) {
    vehicles.value = vehicles.value.map(v => v.id === vehicleId ? { ...v, verification_status: status } : v)
    if (verification.value)
      verification.value = { ...verification.value, vehicles: vehicles.value }
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

  // doUploadFaceVerification отправляет селфи + документ на проверку поддержке.
  // Лицо больше не подтверждается автоматически — статус становится pending.
  async function doUploadFaceVerification(selfie: File, idDocument: File) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await uploadFaceVerification(selfie, idDocument)
      if (verification.value)
        verification.value = { ...verification.value, face_verified: false, face_status: 'pending' }
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить фото на проверку.')
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

  // loadVehiclePhotos подтягивает загруженные фото-слоты машины и список
  // недостающих обязательных слотов (used для прогресса и can_submit).
  async function loadVehiclePhotos(vehicleId: string) {
    isLoadingPhotos.value = true
    errorMessage.value = ''

    try {
      const res = await getVehiclePhotos(vehicleId)
      vehiclePhotos.value = res.photos
      requiredPhotoSlots.value = res.required
      missingPhotoSlots.value = res.missing
      canSubmitPhotos.value = res.can_submit
      return res
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить фото машины.')
      throw error
    }
    finally {
      isLoadingPhotos.value = false
    }
  }

  // doUploadVehicleSlotPhoto грузит фото в конкретный слот (upsert) — вызывается
  // сразу при выборе файла, до нажатия какой-либо кнопки "Сохранить".
  async function doUploadVehicleSlotPhoto(vehicleId: string, slot: VehiclePhotoSlot, file: File) {
    uploadingPhotoSlots.value.add(slot)

    try {
      const res = await uploadVehicleSlotPhoto(vehicleId, slot, file)
      vehiclePhotos.value = [...vehiclePhotos.value.filter(p => p.slot !== slot), res]
      missingPhotoSlots.value = missingPhotoSlots.value.filter(s => s !== slot)
      canSubmitPhotos.value = requiredPhotoSlots.value.every(
        s => vehiclePhotos.value.some(p => p.slot === s),
      )
      return res
    }
    catch (error) {
      showErrorToast(error, 'Не удалось загрузить фото.')
      throw error
    }
    finally {
      uploadingPhotoSlots.value.delete(slot)
    }
  }

  async function doSubmitVehiclePhotos(vehicleId: string) {
    isSubmittingPhotos.value = true
    errorMessage.value = ''

    try {
      const res = await submitVehiclePhotos(vehicleId)
      applyVehicleVerificationStatus(vehicleId, res.verification_status)
      return res
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить фото на проверку.')
      throw error
    }
    finally {
      isSubmittingPhotos.value = false
    }
  }

  function clearVehiclePhotosState() {
    vehiclePhotos.value = []
    requiredPhotoSlots.value = []
    missingPhotoSlots.value = []
    canSubmitPhotos.value = false
    uploadingPhotoSlots.value = new Set()
  }

  function clearOnboardingState() {
    vehicle.value = null
    vehicles.value = []
    verification.value = null
    isLoading.value = false
    isLoadingVerification.value = false
    errorMessage.value = ''
    clearVehiclePhotosState()
  }

  return {
    canSubmitPhotos,
    clearOnboardingState,
    doSubmitDailyCheck,
    doSubmitVehiclePhotos,
    doUploadFaceVerification,
    doUploadTechPassport,
    doUploadVehiclePhoto,
    doUploadVehicleSlotPhoto,
    errorMessage,
    hasVehicle,
    isLoading,
    isLoadingPhotos,
    isLoadingVerification,
    isSubmittingPhotos,
    loadVehiclePhotos,
    loadVehicles,
    loadVerification,
    missingPhotoSlots,
    requiredPhotoSlots,
    saveVehicle,
    updateVehicle,
    uploadingPhotoSlots,
    vehicle,
    vehiclePhotos,
    vehicles,
    verification,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDriverOnboardingStore as any, import.meta.hot))
