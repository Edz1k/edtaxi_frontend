import type { PickupHint } from '@edtaxi/shared/composables/mapbox/useMapboxPickupHints'
import { describe, expect, it } from 'vitest'
import { distanceM, HINT_SNAP_RADIUS_M, nearestHint } from '~/utils/pickupHints'

// Астана, проспект Туран.
const LAT = 51.1282
const LNG = 71.4304

function hint(patch: Partial<PickupHint> = {}): PickupHint {
  return { lat: LAT, lng: LNG, source: 'cluster', ...patch }
}

// Сдвиг на N метров по широте: 1° ≈ 111 320 м.
function north(meters: number) {
  return LAT + meters / 111320
}

describe('distanceM', () => {
  it('до самой себя — ноль', () => {
    expect(distanceM(LAT, LNG, LAT, LNG)).toBe(0)
  })

  it('градус широты ≈ 111 км', () => {
    const d = distanceM(LAT, LNG, LAT + 1, LNG)

    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('притягивание пина к подсказке', () => {
  it('берёт ближайшую в радиусе', () => {
    const near = hint({ lat: north(30), title: 'ближняя' })
    const far = hint({ lat: north(80), title: 'дальняя' })

    expect(nearestHint(LAT, LNG, [far, near])?.title).toBe('ближняя')
  })

  // Пассажир мог осознанно поставить точку в стороне — утаскивать её оттуда
  // значит спорить с пользователем. Кружки остаются подсказкой.
  it('не притягивает дальше радиуса', () => {
    const far = hint({ lat: north(HINT_SNAP_RADIUS_M + 50) })

    expect(nearestHint(LAT, LNG, [far])).toBeNull()
  })

  it('пустой список — ничего не притягивает', () => {
    expect(nearestHint(LAT, LNG, [])).toBeNull()
  })

  // При сопоставимом расстоянии выигрывает более надёжный источник, а не
  // случайный порядок в массиве.
  it('на равном расстоянии предпочитает размеченную точку', () => {
    const manual = hint({ source: 'manual', title: 'Вход №3' })
    const cluster = hint({ source: 'cluster', title: 'популярное' })

    expect(nearestHint(LAT, LNG, [cluster, manual])?.title).toBe('Вход №3')
  })

  it('на равном расстоянии личная история важнее общей популярности', () => {
    const personal = hint({ source: 'personal', title: 'вы уезжали отсюда' })
    const cluster = hint({ source: 'cluster', title: 'популярное' })

    expect(nearestHint(LAT, LNG, [cluster, personal])?.title).toBe('вы уезжали отсюда')
  })

  // Но близость важнее источника: точка в 5 метрах полезнее «надёжной» в 90.
  it('заметно более близкая точка побеждает несмотря на источник', () => {
    const closeCluster = hint({ lat: north(5), source: 'cluster', title: 'рядом' })
    const farManual = hint({ lat: north(90), source: 'manual', title: 'далеко' })

    expect(nearestHint(LAT, LNG, [farManual, closeCluster])?.title).toBe('рядом')
  })

  it('радиус можно сузить', () => {
    const h = hint({ lat: north(50) })

    expect(nearestHint(LAT, LNG, [h], 30)).toBeNull()
    expect(nearestHint(LAT, LNG, [h], 80)).not.toBeNull()
  })
})
