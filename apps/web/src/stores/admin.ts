import type { AdminAssignableRole, AdminListTripsParams, AdminListUsersParams, AdminSupportStats, AdminTechSupportNumber, AdminUser, CreateParkOwnerPayload, PlatformSettings, PlatformSettingsUpdatePayload } from '~/types/admin'
import type { ParkChatRoom, ParkStatus, TaxiPark } from '~/types/park'
import type { AdminListPayoutsParams, PayoutRequest } from '~/types/payout'
import type { AdminSupportRoomsParams, SupportRoom } from '~/types/support'
import type { Trip } from '~/types/trips'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { addAdminUserRole, addTechSupportNumber as addTechSupportNumberApi, assignAdminSupportRoom, blockAdminUser, closeAdminSupportRoom, createParkOwner as createParkOwnerApi, getAdminTrip, getPlatformSettings, getSupportStats, listAdminPayouts, listAdminSupportRooms, listAdminTrips, listAdminUsers, listTechSupportNumbers, markAdminPayoutPaid, rejectAdminPayout, removeAdminUserRole, removeTechSupportNumber as removeTechSupportNumberApi, updatePlatformSettings } from '~/api/admin'
import { listAdminParkChats, listAdminParks, rejectAdminPark, verifyAdminPark } from '~/api/park'
import { useStoreAction } from '~/composables/useStoreAction'
import { useAuthStore } from '~/stores/auth'

export const useAdminStore = defineStore('admin', () => {
  const users = ref<AdminUser[]>([])
  const trips = ref<Trip[]>([])
  const parks = ref<TaxiPark[]>([])
  const parkChats = ref<ParkChatRoom[]>([])
  const techSupportNumbers = ref<AdminTechSupportNumber[]>([])
  const supportStats = ref<AdminSupportStats | null>(null)
  const supportRooms = ref<SupportRoom[]>([])
  const payouts = ref<PayoutRequest[]>([])
  const platformSettings = ref<PlatformSettings | null>(null)
  const isLoadingSupportStats = ref(false)
  const selectedTrip = ref<Trip | null>(null)
  const usersTotal = ref(0)
  const tripsTotal = ref(0)
  const isLoadingUsers = ref(false)
  const isLoadingTrips = ref(false)
  const isLoadingParks = ref(false)
  const isLoadingParkChats = ref(false)
  const isLoadingTechSupportNumbers = ref(false)
  const isLoadingSupportRooms = ref(false)
  const isLoadingPayouts = ref(false)
  const isLoadingSettings = ref(false)
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
    // У tech_support нет доступа к /admin/*, поэтому эндпоинт выбираем по роли.
    const auth = useAuthStore()
    const scope = auth.hasAnyRole(['admin', 'superadmin']) ? 'admin' : 'tech_support'
    return withLoading(isLoadingSupportStats, async () => {
      supportStats.value = await getSupportStats(scope)
      return supportStats.value
    }, 'Не удалось загрузить статистику обращений.')
  }

  async function loadSupportRooms(params: AdminSupportRoomsParams = {}) {
    return withLoading(isLoadingSupportRooms, async () => {
      const response = await listAdminSupportRooms(params)
      supportRooms.value = response.rooms
      return response
    }, 'Не удалось загрузить обращения поддержки.')
  }

  // Назначает агентом обращения текущего администратора (бэкенд назначает вызывающего).
  async function assignSupportRoom(room: SupportRoom) {
    return withLoading(isMutating, async () => {
      await assignAdminSupportRoom(room.id)
      const auth = useAuthStore()
      room.agent_id = auth.currentUser?.id ?? room.agent_id
    }, 'Не удалось назначить агента.')
  }

  async function closeSupportRoom(room: SupportRoom) {
    return withLoading(isMutating, async () => {
      await closeAdminSupportRoom(room.id)
      room.status = 'closed'
    }, 'Не удалось закрыть обращение.')
  }

  async function loadPayouts(params: AdminListPayoutsParams = {}) {
    return withLoading(isLoadingPayouts, async () => {
      const response = await listAdminPayouts(params)
      payouts.value = response.payouts
      return response
    }, 'Не удалось загрузить заявки на выплату.')
  }

  async function markPayoutPaid(payout: PayoutRequest) {
    return withLoading(isMutating, async () => {
      await markAdminPayoutPaid(payout.id)
      payout.status = 'paid'
      payout.reviewed_at = new Date().toISOString()
    }, 'Не удалось отметить выплату оплаченной.')
  }

  async function rejectPayout(payout: PayoutRequest, reason: string) {
    return withLoading(isMutating, async () => {
      await rejectAdminPayout(payout.id, reason)
      payout.status = 'rejected'
      payout.rejection_reason = reason || null
      payout.reviewed_at = new Date().toISOString()
    }, 'Не удалось отклонить заявку на выплату.')
  }

  async function loadSettings() {
    return withLoading(isLoadingSettings, async () => {
      platformSettings.value = await getPlatformSettings()
      return platformSettings.value
    }, 'Не удалось загрузить настройки платформы.')
  }

  async function saveSettings(payload: PlatformSettingsUpdatePayload) {
    return withLoading(isMutating, async () => {
      platformSettings.value = await updatePlatformSettings(payload)
      return platformSettings.value
    }, 'Не удалось сохранить настройки платформы.')
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
    supportStats.value = null
    supportRooms.value = []
    payouts.value = []
    platformSettings.value = null
    selectedTrip.value = null
    usersTotal.value = 0
    tripsTotal.value = 0
    isLoadingUsers.value = false
    isLoadingTrips.value = false
    isLoadingParks.value = false
    isLoadingParkChats.value = false
    isLoadingTechSupportNumbers.value = false
    isLoadingSupportStats.value = false
    isLoadingSupportRooms.value = false
    isLoadingPayouts.value = false
    isLoadingSettings.value = false
    isMutating.value = false
    errorMessage.value = ''
  }

  return {
    addTechSupportNumber,
    assignSupportRoom,
    clearAdminState,
    closeSupportRoom,
    errorMessage,
    isLoadingSupportStats,
    loadSupportStats,
    supportStats,
    supportRooms,
    isLoadingTrips,
    isLoadingParks,
    isLoadingParkChats,
    isLoadingTechSupportNumbers,
    isLoadingSupportRooms,
    isLoadingPayouts,
    isLoadingSettings,
    isLoadingUsers,
    isMutating,
    createParkOwner,
    grantUserRole,
    loadParkChats,
    loadParks,
    loadPayouts,
    loadSettings,
    loadSupportRooms,
    loadTechSupportNumbers,
    loadTrip,
    loadTrips,
    loadUsers,
    markPayoutPaid,
    parkChats,
    parks,
    payouts,
    platformSettings,
    rejectPark,
    rejectPayout,
    removeTechSupportNumber,
    revokeUserRole,
    saveSettings,
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
