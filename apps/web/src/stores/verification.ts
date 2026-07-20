import type { DailyCheck, DailyCheckStatus, FaceVerification, PendingVehicle } from '~/types/verification'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ApiError } from '~/api/client'
import {
  listDailyChecks,
  listPendingFaces,
  listPendingVehicles,
  reviewDailyCheck,
  reviewDailyCheckChecklist,
  reviewFace,
  reviewFaceChecklist,
  reviewVehicle,
  reviewVehicleChecklist,
} from '~/api/verification'
import { useStoreAction } from '~/composables/useStoreAction'

export const useVerificationStore = defineStore('verification', () => {
  const vehicles = ref<PendingVehicle[]>([])
  const dailyChecks = ref<DailyCheck[]>([])
  const faces = ref<FaceVerification[]>([])
  const isLoadingVehicles = ref(false)
  const isLoadingDailyChecks = ref(false)
  const isLoadingFaces = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadFaces() {
    return withLoading(isLoadingFaces, async () => {
      const response = await listPendingFaces({ limit: 100 })
      faces.value = response.faces ?? []
      return faces.value
    }, 'Не удалось загрузить заявки на проверку лица.')
  }

  async function decideFace(driverId: string, approve: boolean) {
    return withLoading(isMutating, async () => {
      await reviewFace(driverId, approve)
      faces.value = faces.value.filter(f => f.driver_id !== driverId)
    }, 'Не удалось обновить статус верификации лица.')
  }

  async function loadVehicles() {
    return withLoading(isLoadingVehicles, async () => {
      const response = await listPendingVehicles({ limit: 100 })
      vehicles.value = response.vehicles ?? []
      return vehicles.value
    }, 'Не удалось загрузить заявки на проверку машин.')
  }

  async function loadDailyChecks(status?: DailyCheckStatus) {
    return withLoading(isLoadingDailyChecks, async () => {
      const response = await listDailyChecks({ status, limit: 100 })
      dailyChecks.value = response.daily_checks ?? []
      return dailyChecks.value
    }, 'Не удалось загрузить ежедневные проверки.')
  }

  async function decideVehicle(id: string, approve: boolean) {
    return withLoading(isMutating, async () => {
      await reviewVehicle(id, approve)
      vehicles.value = vehicles.value.filter(v => v.id !== id)
    }, 'Не удалось обновить статус машины.')
  }

  async function decideDailyCheck(id: string, approve: boolean, reason = '') {
    return withLoading(isMutating, async () => {
      await reviewDailyCheck(id, approve, reason)
      dailyChecks.value = dailyChecks.value.filter(c => c.id !== id)
    }, 'Не удалось обновить ежедневную проверку.')
  }

  // --- Решения по чек-листу: пер-блочные вердикты, итог approved только
  // когда все блоки ок; при отказе причина обязательна.

  async function decideVehicleChecklist(id: string, photosOk: boolean, docsOk: boolean, reason = '') {
    return withLoading(isMutating, async () => {
      await reviewVehicleChecklist(id, photosOk, docsOk, reason)
      vehicles.value = vehicles.value.filter(v => v.id !== id)
    }, 'Не удалось сохранить решение по машине.')
  }

  async function decideDailyCheckChecklist(id: string, selfieOk: boolean, vehicleOk: boolean, reason = '') {
    return withLoading(isMutating, async () => {
      try {
        await reviewDailyCheckChecklist(id, selfieOk, vehicleOk, reason)
      }
      catch (error) {
        // 409 — заявка сгорела или её уже рассмотрели: она больше не наша, и
        // держать её на экране нельзя. Тост о причине покажет withLoading.
        if (error instanceof ApiError && error.status === 409)
          loadDailyChecks('pending').catch(() => {})
        throw error
      }
      dailyChecks.value = dailyChecks.value.filter(c => c.id !== id)
    }, 'Не удалось сохранить решение по ежедневной проверке.')
  }

  async function decideFaceChecklist(driverId: string, selfieOk: boolean, documentOk: boolean, reason = '', firstName = '', lastName = '') {
    return withLoading(isMutating, async () => {
      await reviewFaceChecklist(driverId, selfieOk, documentOk, reason, firstName, lastName)
      faces.value = faces.value.filter(f => f.driver_id !== driverId)
    }, 'Не удалось сохранить решение по проверке лица.')
  }

  function clearVerificationState() {
    vehicles.value = []
    dailyChecks.value = []
    faces.value = []
    isLoadingVehicles.value = false
    isLoadingDailyChecks.value = false
    isLoadingFaces.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    clearVerificationState,
    dailyChecks,
    decideDailyCheck,
    decideDailyCheckChecklist,
    decideFace,
    decideFaceChecklist,
    decideVehicle,
    decideVehicleChecklist,
    errorMessage,
    faces,
    isLoadingDailyChecks,
    isLoadingFaces,
    isLoadingVehicles,
    isMutating,
    loadDailyChecks,
    loadFaces,
    loadVehicles,
    vehicles,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useVerificationStore as any, import.meta.hot))
