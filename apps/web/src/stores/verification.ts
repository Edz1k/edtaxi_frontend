import type { DailyCheck, PendingVehicle, VerificationStatus } from '~/types/verification'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  listDailyChecks,
  listPendingVehicles,
  reviewDailyCheck,
  reviewVehicle,
} from '~/api/verification'
import { useStoreAction } from '~/composables/useStoreAction'

export const useVerificationStore = defineStore('verification', () => {
  const vehicles = ref<PendingVehicle[]>([])
  const dailyChecks = ref<DailyCheck[]>([])
  const isLoadingVehicles = ref(false)
  const isLoadingDailyChecks = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadVehicles() {
    return withLoading(isLoadingVehicles, async () => {
      const response = await listPendingVehicles({ limit: 100 })
      vehicles.value = response.vehicles ?? []
      return vehicles.value
    }, 'Не удалось загрузить заявки на проверку машин.')
  }

  async function loadDailyChecks(status?: VerificationStatus) {
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

  function clearVerificationState() {
    vehicles.value = []
    dailyChecks.value = []
    isLoadingVehicles.value = false
    isLoadingDailyChecks.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    clearVerificationState,
    dailyChecks,
    decideDailyCheck,
    decideVehicle,
    errorMessage,
    isLoadingDailyChecks,
    isLoadingVehicles,
    isMutating,
    loadDailyChecks,
    loadVehicles,
    vehicles,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useVerificationStore as any, import.meta.hot))
