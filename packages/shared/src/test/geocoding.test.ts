import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }))
vi.mock('../api/client', () => ({ apiRequest: apiRequestMock }))

const { getDrivingRoute, reverseGeocodePlace, searchPlaces } = await import('../api/geocoding')

beforeEach(() => {
  apiRequestMock.mockReset()
})

describe('searchPlaces', () => {
  it('short-circuits queries shorter than 3 characters without a request', async () => {
    await expect(searchPlaces('ab')).resolves.toEqual([])
    await expect(searchPlaces('   a   ')).resolves.toEqual([])
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('trims the query and maps suggestions to places', async () => {
    apiRequestMock.mockResolvedValue([
      { title: 'Аэропорт', subtitle: 'Алматы', lat: 43.35, lng: 77.04 },
    ])

    const places = await searchPlaces('  аэро  ')

    expect(apiRequestMock).toHaveBeenCalledWith('/geocoding/suggest', {
      method: 'POST',
      body: { query: 'аэро' },
    })
    expect(places).toEqual([
      {
        address: 'Аэропорт, Алматы',
        distanceM: null,
        id: '43.35:77.04:0',
        // Флаг избранного присутствует всегда (false, если бэк его не прислал).
        isFavorite: false,
        lat: 43.35,
        lng: 77.04,
        name: 'Аэропорт',
        subtitle: 'Алматы',
      },
    ])
  })

  it('passes the near point to the backend and maps distance_m', async () => {
    apiRequestMock.mockResolvedValue([
      { title: 'мкр Мирас, 62а', subtitle: 'Алматы', lat: 43.186, lng: 76.877, distance_m: 973_000 },
    ])

    const places = await searchPlaces('Мирас 62', { lat: 51.1168, lng: 71.4163 })

    expect(apiRequestMock).toHaveBeenCalledWith('/geocoding/suggest', {
      method: 'POST',
      body: { query: 'Мирас 62', lat: 51.1168, lng: 71.4163 },
    })
    expect(places[0].distanceM).toBe(973_000)
  })

  it('accepts the wrapped { results } response shape', async () => {
    apiRequestMock.mockResolvedValue({
      results: [{ title: 'A', subtitle: '', lat: 1, lng: 2 }],
    })

    const places = await searchPlaces('abc')

    // Empty subtitle must not leave a trailing separator in the address.
    expect(places[0].address).toBe('A')
    expect(places[0].id).toBe('1:2:0')
  })
})

describe('reverseGeocodePlace', () => {
  it('maps a reverse-geocode response to a place (lng, lat argument order)', async () => {
    apiRequestMock.mockResolvedValue({ address: 'ул. Абая, 1', lat: 43.24, lng: 76.95 })

    const place = await reverseGeocodePlace(76.95, 43.24)

    expect(apiRequestMock).toHaveBeenCalledWith('/geocoding/reverse', {
      method: 'POST',
      body: { lat: 43.24, lng: 76.95 },
    })
    expect(place).toEqual({
      address: 'ул. Абая, 1',
      id: '43.24:76.95',
      lat: 43.24,
      lng: 76.95,
      name: 'ул. Абая, 1',
    })
  })
})

describe('getDrivingRoute', () => {
  it('sends the coordinate pairs and reshapes the route response', async () => {
    apiRequestMock.mockResolvedValue({
      coordinates: [[76.9, 43.2], [76.95, 43.24]],
      distance_km: 4.2,
      duration_min: 11,
    })

    const from = { address: 'A', id: 'a', lat: 43.2, lng: 76.9, name: 'A' }
    const to = { address: 'B', id: 'b', lat: 43.24, lng: 76.95, name: 'B' }

    const route = await getDrivingRoute(from, to)

    expect(apiRequestMock).toHaveBeenCalledWith('/route', {
      method: 'POST',
      body: { from_lat: 43.2, from_lng: 76.9, to_lat: 43.24, to_lng: 76.95 },
    })
    expect(route).toEqual({
      distance_km: 4.2,
      duration_min: 11,
      geometry: [[76.9, 43.2], [76.95, 43.24]],
    })
  })
})
