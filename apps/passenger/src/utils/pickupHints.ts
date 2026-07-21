import type { PickupHint } from '@edtaxi/shared/composables/mapbox/useMapboxPickupHints'

// Радиус притягивания пина к подсказке. Совпадает с порогом дорожного снапа на
// бэкенде: у пассажира не должно быть двух разных «радиусов притяжения» в
// зависимости от того, размечено это место или нет.
export const HINT_SNAP_RADIUS_M = 100

// Приоритет источников при равном расстоянии. Размеченная точка человеком
// (manual) надёжнее автоматики, личная история пассажира — полезнее общей
// популярности: «вы уезжали отсюда» почти всегда именно то, что нужно.
const SOURCE_RANK: Record<string, number> = {
  'manual': 0,
  'personal': 1,
  '2gis': 2,
  'cluster': 3,
}

function rankOf(source: string): number {
  return SOURCE_RANK[source] ?? 99
}

// distanceM — расстояние по большому кругу (гаверсинус). Дублирует формулу
// бэкенда сознательно: тянуть её из сети ради каждого движения карты нельзя.
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// nearestHint — к какой подсказке притянуть пин, или null если рядом ничего нет.
//
// Дальше радиуса не притягиваем намеренно: пассажир мог осознанно поставить
// точку в стороне от популярного места, и утаскивать её оттуда — значит спорить
// с пользователем. Кружки остаются подсказкой, а не ограничением.
export function nearestHint(lat: number, lng: number, hints: PickupHint[], radiusM = HINT_SNAP_RADIUS_M): null | PickupHint {
  let best: null | PickupHint = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const hint of hints) {
    const distance = distanceM(lat, lng, hint.lat, hint.lng)
    if (distance > radiusM)
      continue

    // При сопоставимом расстоянии (разница меньше метра — это шум GPS и
    // округлений) выигрывает более надёжный источник, а не случайный порядок.
    const closer = distance < bestDistance - 1
    const sameDistanceButBetter = Math.abs(distance - bestDistance) <= 1
      && best !== null && rankOf(hint.source) < rankOf(best.source)

    if (best === null || closer || sameDistanceButBetter) {
      best = hint
      bestDistance = Math.min(distance, bestDistance)
    }
  }

  return best
}
