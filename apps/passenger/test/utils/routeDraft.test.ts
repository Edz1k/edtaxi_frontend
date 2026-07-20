import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearRouteDraft, readRouteDraft, ROUTE_DRAFT_TTL_MS, saveRouteDraft } from '~/utils/routeDraft'

const NOW = new Date('2026-07-20T12:00:00Z').getTime()

function place(patch: Partial<GeoPlace> = {}): GeoPlace {
  return {
    address: 'ул. Абая 1',
    id: 'place-1',
    lat: 51.1282,
    lng: 71.4304,
    name: 'Абая 1',
    ...patch,
  }
}

function draft() {
  return {
    destination: 'ул. Сатпаева 5',
    destinationPlace: place({ address: 'ул. Сатпаева 5', id: 'place-2' }),
    pickup: 'ул. Абая 1',
    pickupPlace: place(),
    stops: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('черновик маршрута', () => {
  it('сохраняется и читается целиком', () => {
    saveRouteDraft(draft(), NOW)

    const restored = readRouteDraft(NOW)

    expect(restored?.pickup).toBe('ул. Абая 1')
    expect(restored?.pickupPlace?.lat).toBe(51.1282)
    expect(restored?.destinationPlace?.address).toBe('ул. Сатпаева 5')
  })

  it('переживает перезапуск в пределах срока жизни', () => {
    saveRouteDraft(draft(), NOW)

    expect(readRouteDraft(NOW + ROUTE_DRAFT_TTL_MS - 1000)).not.toBeNull()
  })

  // Без срока вчерашний маршрут всплыл бы как сегодняшний, и пассажир заказал
  // бы машину не туда, даже не заметив подмены.
  it('просроченный черновик не возвращается', () => {
    saveRouteDraft(draft(), NOW)

    expect(readRouteDraft(NOW + ROUTE_DRAFT_TTL_MS + 1000)).toBeNull()
  })

  it('остановки сохраняются', () => {
    saveRouteDraft({ ...draft(), stops: [place({ address: 'Остановка', id: 'stop-1' })] }, NOW)

    expect(readRouteDraft(NOW)?.stops).toHaveLength(1)
    expect(readRouteDraft(NOW)?.stops[0]?.address).toBe('Остановка')
  })

  it('пустой черновик не сохраняется', () => {
    saveRouteDraft({ destination: '', destinationPlace: null, pickup: '', pickupPlace: null, stops: [] }, NOW)

    expect(readRouteDraft(NOW)).toBeNull()
  })

  it('очистка удаляет черновик', () => {
    saveRouteDraft(draft(), NOW)
    clearRouteDraft()

    expect(readRouteDraft(NOW)).toBeNull()
  })

  it('пустое хранилище — null, без исключений', () => {
    expect(readRouteDraft(NOW)).toBeNull()
  })

  it('битый JSON не роняет чтение', () => {
    localStorage.setItem('passenger:route-draft', '{не json')

    expect(readRouteDraft(NOW)).toBeNull()
  })

  // Место без координат хуже, чем потерянный черновик: заказ ушёл бы с
  // мусорной точкой подачи.
  it('место без координат отбрасывается', () => {
    localStorage.setItem('passenger:route-draft', JSON.stringify({
      destination: '',
      destinationPlace: null,
      pickup: 'Абая 1',
      pickupPlace: { address: 'Абая 1' },
      savedAt: NOW,
      stops: [],
    }))

    expect(readRouteDraft(NOW)?.pickupPlace).toBeNull()
  })

  it('запись без метки времени считается негодной', () => {
    localStorage.setItem('passenger:route-draft', JSON.stringify({ pickup: 'Абая 1' }))

    expect(readRouteDraft(NOW)).toBeNull()
  })
})
