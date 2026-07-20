import type { GeoPlace, TripRoute } from '@edtaxi/shared/types/geocoding'
import { describe, expect, it } from 'vitest'
import { applyPickupSnap } from '~/utils/pickupSnap'

const pickup: GeoPlace = {
  address: 'ТРЦ «Хан Шатыр»',
  id: 'place-1',
  lat: 51.1282,
  lng: 71.4304,
  name: 'ТРЦ «Хан Шатыр»',
}

function route(patch: Partial<TripRoute> = {}): TripRoute {
  return { distance_km: 7.2, duration_min: 18, geometry: [], ...patch }
}

describe('applyPickupSnap', () => {
  it('сдвигает координаты на проезжую часть, когда бэк прислал поправку', () => {
    const snapped = applyPickupSnap(pickup, route({ snapped_pickup: { lat: 51.1286, lng: 71.4309 } }))

    expect(snapped.lat).toBe(51.1286)
    expect(snapped.lng).toBe(71.4309)
  })

  // Пассажир выбирал именно этот адрес — подменять подпись под ним нельзя,
  // сдвигаются только координаты, и всего на десятки метров.
  it('сохраняет адрес и остальные поля места', () => {
    const snapped = applyPickupSnap(pickup, route({ snapped_pickup: { lat: 51.1286, lng: 71.4309 } }))

    expect(snapped.address).toBe('ТРЦ «Хан Шатыр»')
    expect(snapped.name).toBe('ТРЦ «Хан Шатыр»')
    expect(snapped.id).toBe('place-1')
  })

  it('без поправки возвращает исходное место как есть', () => {
    expect(applyPickupSnap(pickup, route())).toBe(pickup)
  })

  // Старый бэкенд поля не присылает — фича просто не активируется.
  it('переживает ответ старого бэкенда', () => {
    const legacy = { distance_km: 7.2, duration_min: 18, geometry: [] } as TripRoute

    expect(applyPickupSnap(pickup, legacy)).toBe(pickup)
  })
})
