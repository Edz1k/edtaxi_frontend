import type { AdminAssignableRole, AdminListTripsParams, AdminListUsersParams, AdminSupportStats, AdminTechSupportNumber, AdminUser, CreateParkOwnerPayload } from '~/types/admin'
import type { ParkChatRoom, ParkStatus, TaxiPark } from '~/types/park'
import type { Trip } from '~/types/trips'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { addAdminUserRole, addTechSupportNumber as addTechSupportNumberApi, blockAdminUser, createParkOwner as createParkOwnerApi, getAdminTrip, getSupportStats, listAdminTrips, listAdminUsers, listTechSupportNumbers, removeAdminUserRole, removeTechSupportNumber as removeTechSupportNumberApi } from '~/api/admin'
import { listAdminParkChats, listAdminParks, rejectAdminPark, verifyAdminPark } from '~/api/park'
import { useStoreAction } from '~/composables/useStoreAction'

export const useAdminStore = defineStore('admin', () => {
  const users = ref<AdminUser[]>([])
  const trips = ref<Trip[]>([])
  const parks = ref<TaxiPark[]>([])
  const parkChats = ref<ParkChatRoom[]>([])
  const techSupportNumbers = ref<AdminTechSupportNumber[]>([])
  const supportStats = ref<AdminSupportStats | null>(null)
  const isLoadingSupportStats = ref(false)
  const selectedTrip = ref<Trip | null>(null)
  const usersTotal = ref(0)
  const tripsTotal = ref(0)
  const isLoadingUsers = ref(false)
  const isLoadingTrips = ref(false)
  const isLoadingParks = ref(false)
  const isLoadingParkChats = ref(false)
  const isLoadingTechSupportNumbers = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  const { withLoading } = useStoreAction(errorMessage)

  async function loadUsers(params: AdminListUsersParams = {}) {
    return withLoading(isLoadingUsers, async () => {
      const response = await listAdminUsers(params)
      users.value = response.users
      usersTotal.value = response.total
      return response
    }, 'Не удалось загрузить пользователей.')
  }

  async function setUserBlocked(user: AdminUser, blocked: boolean) {
    return withLoading(isMutating, async () => {
      const response = await blockAdminUser(user.id, { blocked })
      user.is_blocked = response.is_blocked
    }, 'Не удалось изменить статус пользователя.')
  }

  async function grantUserRole(user: AdminUser, role: AdminAssignableRole) {
    return withLoading(isMutating, async () => {
      const response = await addAdminUserRole(user.id, { role })
      user.roles = response.roles
    }, 'Не удалось выдать роль пользователю.')
  }

  async function revokeUserRole(user: AdminUser, role: AdminAssignableRole) {
    return withLoading(isMutating, async () => {
      const response = await removeAdminUserRole(user.id, role)
      user.roles = response.roles
    }, 'Не удалось отозвать роль пользователя.')
  }

  async function loadTrips(params: AdminListTripsParams = {}) {
    return withLoading(isLoadingTrips, async () => {
      const response = await listAdminTrips(params)
      trips.value = response.trips
      tripsTotal.value = response.total
      return response
    }, 'Не удалось загрузить поездки.')
  }

  async function loadTrip(id: string) {
    return withLoading(isLoadingTrips, async () => {
      selectedTrip.value = await getAdminTrip(id)
      return selectedTrip.value
    }, 'Не удалось загрузить поездку.')
  }

  async function loadParks(params: { status?: ParkStatus | '', limit?: number, offset?: number } = {}) {
    return withLoading(isLoadingParks, async () => {
      const response = await listAdminParks(params)
      parks.value = response.parks
      return response
    }, 'Не удалось загрузить таксопарки.')
  }

  async function verifyPark(park: TaxiPark) {
    return withLoading(isMutating, async () => {
      await verifyAdminPark(park.id)
      park.is_verified = true
      park.status = 'approved'
    }, 'Не удалось подтвердить таксопарк.')
  }

  async function rejectPark(park: TaxiPark, reason: string) {
    return withLoading(isMutating, async () => {
      await rejectAdminPark(park.id, reason)
      park.status = 'rejected'
      park.rejection_reason = reason
      park.is_verified = false
    }, 'Не удалось отклонить таксопарк.')
  }

  async function createParkOwner(payload: CreateParkOwnerPayload) {
    return withLoading(isMutating, () => createParkOwnerApi(payload), 'Не удалось создать владельца парка.')
  }

  async function loadParkChats(params: { status?: string, limit?: number, offset?: number } = {}) {
    return withLoading(isLoadingParkChats, async () => {
      const response = await listAdminParkChats(params)
      parkChats.value = response.rooms
      return response
    }, 'Не удалось загрузить чаты парков.')
  }

  async function loadTechSupportNumbers() {
    return withLoading(isLoadingTechSupportNumbers, async () => {
      const response = await listTechSupportNumbers()
      techSupportNumbers.value = response.numbers
      return response
    }, 'Не удалось загрузить номера техподдержки.')
  }

  async function addTechSupportNumber(phone: string, name = '') {
    return withLoading(isMutating, async () => {
      const response = await addTechSupportNumberApi({ phone, name: name || undefined })
      if (!techSupportNumbers.value.some(item => item.phone === response.phone)) {
        techSupportNumbers.value = [
          { added_by: null, created_at: new Date().toISOString(), name: response.name ?? name ?? null, phone: response.phone },
          ...techSupportNumbers.value,
        ]
      }
      return response
    }, 'Не удалось добавить номер техподдержки.')
  }

  async function loadSupportStats() {
    return withLoading(isLoadingSupportStats, async () => {
      supportStats.value = await getSupportStats()
      return supportStats.value
    }, 'Не удалось загрузить статистику обращений.')
  }

  async function removeTechSupportNumber(phone: string) {
    return withLoading(isMutating, async () => {
      await removeTechSupportNumberApi({ phone })
      techSupportNumbers.value = techSupportNumbers.value.filter(item => item.phone !== phone)
    }, 'Не удалось удалить номер техподдержки.')
  }

  function clearAdminState() {
    users.value = []
    trips.value = []
    parks.value = []
    parkChats.value = []
    techSupportNumbers.value = []
    selectedTrip.value = null
    usersTotal.value = 0
    tripsTotal.value = 0
    isLoadingUsers.value = false
    isLoadingTrips.value = false
    isLoadingParks.value = false
    isLoadingParkChats.value = false
    isLoadingTechSupportNumbers.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    addTechSupportNumber,
    clearAdminState,
    errorMessage,
    isLoadingSupportStats,
    loadSupportStats,
    supportStats,
    isLoadingTrips,
    isLoadingParks,
    isLoadingParkChats,
    isLoadingTechSupportNumbers,
    isLoadingUsers,
    isMutating,
    createParkOwner,
    grantUserRole,
    loadParkChats,
    loadParks,
    loadTechSupportNumbers,
    loadTrip,
    loadTrips,
    loadUsers,
    parkChats,
    parks,
    rejectPark,
    removeTechSupportNumber,
    revokeUserRole,
    selectedTrip,
    setUserBlocked,
    trips,
    tripsTotal,
    techSupportNumbers,
    users,
    usersTotal,
    verifyPark,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAdminStore as any, import.meta.hot))
