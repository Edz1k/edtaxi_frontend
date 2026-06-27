import type { CreatePlacePayload, FavoritePlace, UpdatePlacePayload } from '~/types/places'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { createPlace, deletePlace, listPlaces, updatePlace } from '~/api/places'

export const usePlacesStore = defineStore('places', () => {
  const places = ref<FavoritePlace[]>([])
  const isLoading = ref(false)
  const isMutating = ref(false)
  const errorMessage = ref('')

  async function load() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const response = await listPlaces()
      places.value = response.places
    }
    catch {
      errorMessage.value = 'Не удалось загрузить адреса.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function add(payload: CreatePlacePayload) {
    isMutating.value = true
    try {
      const place = await createPlace(payload)
      places.value = [place, ...places.value]
      return place
    }
    catch {
      errorMessage.value = 'Не удалось добавить адрес.'
      throw new Error(errorMessage.value)
    }
    finally {
      isMutating.value = false
    }
  }

  async function edit(id: string, payload: UpdatePlacePayload) {
    isMutating.value = true
    try {
      const updated = await updatePlace(id, payload)
      const index = places.value.findIndex(p => p.id === id)
      if (index !== -1)
        places.value[index] = updated
      return updated
    }
    catch {
      errorMessage.value = 'Не удалось обновить адрес.'
      throw new Error(errorMessage.value)
    }
    finally {
      isMutating.value = false
    }
  }

  async function remove(id: string) {
    isMutating.value = true
    try {
      await deletePlace(id)
      places.value = places.value.filter(p => p.id !== id)
    }
    catch {
      errorMessage.value = 'Не удалось удалить адрес.'
      throw new Error(errorMessage.value)
    }
    finally {
      isMutating.value = false
    }
  }

  return { add, edit, errorMessage, isLoading, isMutating, load, places, remove }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePlacesStore as any, import.meta.hot))
