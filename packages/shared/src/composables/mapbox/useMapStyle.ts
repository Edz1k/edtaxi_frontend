import { computed, ref } from 'vue'

// Темы карты: обычная схема, спутниковый снимок (с подписями улиц) и ночная.
// Выбор общий на приложение (синглтон) и переживает перезапуск (localStorage).
export type MapStyleKey = 'dark' | 'satellite' | 'streets'

export interface MapStyleOption {
  icon: string
  key: MapStyleKey
  label: string
  url: string
}

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { icon: 'i-mdi-map-outline', key: 'streets', label: 'Схема', url: 'mapbox://styles/mapbox/streets-v12' },
  { icon: 'i-mdi-satellite-variant', key: 'satellite', label: 'Спутник', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { icon: 'i-mdi-weather-night', key: 'dark', label: 'Ночная', url: 'mapbox://styles/mapbox/dark-v11' },
]

const STORAGE_KEY = 'edtaxi:map-style'

function loadSavedKey(): MapStyleKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && MAP_STYLE_OPTIONS.some(option => option.key === saved))
      return saved as MapStyleKey
  }
  catch {}
  return 'streets'
}

const currentKey = ref<MapStyleKey>(typeof window === 'undefined' ? 'streets' : loadSavedKey())

export function mapStyleUrl(key: MapStyleKey): string {
  return MAP_STYLE_OPTIONS.find(option => option.key === key)?.url ?? MAP_STYLE_OPTIONS[0].url
}

// currentMapStyleUrl — для инициализации карты (useMapboxMap) без подписки.
export function currentMapStyleUrl(): string {
  return mapStyleUrl(currentKey.value)
}

export function useMapStyle() {
  return {
    currentKey,
    currentUrl: computed(() => mapStyleUrl(currentKey.value)),
    options: MAP_STYLE_OPTIONS,
    setStyle(key: MapStyleKey) {
      currentKey.value = key
      try {
        localStorage.setItem(STORAGE_KEY, key)
      }
      catch {}
    },
  }
}
