import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { searchPlaces } from '@edtaxi/shared/api/geocoding'

interface UseAddressSearchOptions {
  // near — от какой точки бэкенду искать и мерить расстояния (обычно точка А
  // пассажира). Без неё саджест теряет гео-приоритет своего города.
  near?: Ref<GeoPlace | null>
  query: Ref<string>
  selectedPlace: Ref<GeoPlace | null>
}

export function useAddressSearch(options: UseAddressSearchOptions) {
  const suggestions = ref<GeoPlace[]>([])
  const isSearching = ref(false)
  // searchFailed — геокодер лёг (сеть/500) или бэкенд отдал degraded: показываем
  // подсказку «поиск временно недоступен», а не молчаливо пустой список.
  const searchFailed = ref(false)
  const lastQuery = ref('')

  const search = useDebounceFn(async () => {
    const query = options.query.value.trim()
    lastQuery.value = query
    searchFailed.value = false

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
      const near = options.near?.value
      const { degraded, places } = await searchPlaces(query, near ? { lat: near.lat, lng: near.lng } : undefined)

      if (lastQuery.value === query) {
        suggestions.value = places
        searchFailed.value = degraded
      }
    }
    catch {
      if (lastQuery.value === query) {
        suggestions.value = []
        searchFailed.value = true
      }
    }
    finally {
      if (lastQuery.value === query)
        isSearching.value = false
    }
    // 450 мс вместо 300: каждый промежуточный ввод — платный запрос саджеста
    // к 2GIS, а на 300 мс срабатывание между буквами было почти гарантировано.
  }, 450)

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
    searchFailed.value = false
  }

  return {
    clearSuggestions,
    isSearching,
    search,
    searchFailed,
    selectPlace,
    suggestions,
  }
}
