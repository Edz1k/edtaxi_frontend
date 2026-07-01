import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { searchPlaces } from '~/api/geocoding'

interface UseAddressSearchOptions {
  query: Ref<string>
  selectedPlace: Ref<GeoPlace | null>
}

export function useAddressSearch(options: UseAddressSearchOptions) {
  const suggestions = ref<GeoPlace[]>([])
  const isSearching = ref(false)
  const lastQuery = ref('')

  const search = useDebounceFn(async () => {
    const query = options.query.value.trim()
    lastQuery.value = query

    if (options.selectedPlace.value?.address === options.query.value) {
      isSearching.value = false
      return
    }

    if (query.length < 3) {
      suggestions.value = []
      isSearching.value = false
      return
    }

    isSearching.value = true

    try {
      const places = await searchPlaces(query)

      if (lastQuery.value === query)
        suggestions.value = places
    }
    catch {
      if (lastQuery.value === query)
        suggestions.value = []
    }
    finally {
      if (lastQuery.value === query)
        isSearching.value = false
    }
  }, 300)

  watch(options.query, () => {
    if (options.selectedPlace.value?.address !== options.query.value)
      options.selectedPlace.value = null

    search()
  })

  function selectPlace(place: GeoPlace) {
    options.selectedPlace.value = place
    options.query.value = place.address
    suggestions.value = []
  }

  function clearSuggestions() {
    suggestions.value = []
  }

  return {
    clearSuggestions,
    isSearching,
    search,
    selectPlace,
    suggestions,
  }
}
