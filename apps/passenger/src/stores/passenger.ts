import type { PassengerProfile, UpdatePassengerProfilePayload } from '~/types/passenger'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { showErrorToast } from '~/api/errors'
import { getPassengerProfile, updatePassengerProfile } from '~/api/passenger'

export const usePassengerStore = defineStore('passenger', () => {
  const profile = ref<null | PassengerProfile>(null)
  const isLoading = ref(false)
  const errorMessage = ref('')

  const displayName = computed(() => {
    const firstName = profile.value?.first_name?.trim()
    const lastName = profile.value?.last_name?.trim()
    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    return fullName || 'Пассажир'
  })

  async function loadProfile() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      profile.value = await getPassengerProfile()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось загрузить профиль.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveProfile(payload: UpdatePassengerProfilePayload) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      profile.value = await updatePassengerProfile(payload)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось сохранить профиль.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  function clearProfile() {
    profile.value = null
    errorMessage.value = ''
  }

  return {
    clearProfile,
    displayName,
    errorMessage,
    isLoading,
    loadProfile,
    profile,
    saveProfile,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePassengerStore as any, import.meta.hot))
