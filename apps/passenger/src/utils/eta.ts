// Грубая оценка времени прибытия по прямой при средней городской скорости —
// фолбэк на случай, когда live-ETA с бэка ещё не пришёл по WebSocket
// (первые секунды после открытия экрана поездки).
const EARTH_RADIUS_M = 6371000
const CITY_SPEED_MS = (25 * 1000) / 3600

export function coarseEtaSeconds(lat: number, lng: number, targetLat: number, targetLng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(targetLat - lat)
  const dLng = toRad(targetLng - lng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2
  const distM = 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
  return Math.round(distM / CITY_SPEED_MS)
}
