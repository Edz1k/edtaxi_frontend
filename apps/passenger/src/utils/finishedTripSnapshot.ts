import type { Trip } from '~/types/trips'

// Снапшот завершённой неоценённой поездки.
//
// Экран оценки живёт на activeTrip в памяти, а GET /trips/active знает только
// НЕзавершённые поездки: пассажир уходил в меню или перезапускал приложение —
// restoreActiveTrip получал null и молча сбрасывал экран, оценка пропадала.
// Снапшот переживает и ремоунт карты, и полный перезапуск мини-аппа.
//
// Пишется ТОЛЬКО терминальный снапшот (из finishActiveTrip): если сохранять
// последнюю активную поездку, то после закрытия приложения в in_progress
// восстановление показало бы «едем» по давно завершённой поездке.
const STORAGE_KEY = 'edtaxi:finished-unrated-trip'
const TTL_MS = 24 * 60 * 60 * 1000

interface FinishedTripSnapshot {
  savedAt: number
  trip: Trip
}

export function saveFinishedTrip(trip: Trip) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), trip } satisfies FinishedTripSnapshot))
  }
  catch {}
}

export function readFinishedTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null

    const snapshot = JSON.parse(raw) as FinishedTripSnapshot
    const expired = !Number.isFinite(snapshot.savedAt) || Date.now() - snapshot.savedAt > TTL_MS
    // Оценка спустя сутки уже не актуальна; оценённая поездка — тем более.
    if (expired || !snapshot.trip || snapshot.trip.status !== 'completed' || snapshot.trip.my_rating) {
      clearFinishedTrip()
      return null
    }
    return snapshot.trip
  }
  catch {
    return null
  }
}

export function clearFinishedTrip() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  }
  catch {}
}
