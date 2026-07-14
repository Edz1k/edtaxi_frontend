import { apiRequest } from './client'

// Погода для виджета в шапке карты (бэк проксирует Open-Meteo с кэшем на
// город). available:false — провайдер недоступен, виджет просто прячется.
export interface WeatherResult {
  available: boolean
  city?: string
  temp_c: number
  weather_code: number
}

export function getWeather(lat: number, lng: number) {
  return apiRequest<WeatherResult>('/weather', {
    params: { lat, lng },
  })
}
