import type { Coordinate } from '../utils/geo'
import { describe, expect, it } from 'vitest'
import { distanceM, projectOnPolyline, trimPolylineFrom } from '../utils/geo'

// Координаты в порядке GeoJSON: [долгота, широта].
const KHAN_SHATYR: Coordinate = [71.402828, 51.132130]
const ASIA_PARK: Coordinate = [71.412619, 51.128132]

describe('distanceM', () => {
  it('меряет расстояние между реальными точками Астаны', () => {
    // Хан Шатыр — Asia Park, по прямой чуть меньше километра.
    const d = distanceM(KHAN_SHATYR[1], KHAN_SHATYR[0], ASIA_PARK[1], ASIA_PARK[0])
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(900)
  })

  it('даёт ноль для одной и той же точки', () => {
    expect(distanceM(51.13, 71.4, 51.13, 71.4)).toBe(0)
  })
})

describe('projectOnPolyline', () => {
  // Длинный прямой участок с вершинами далеко друг от друга — ровно тот случай,
  // ради которого считаем расстояние до отрезка, а не до вершин.
  const straight: Coordinate[] = [[71.40, 51.13], [71.45, 51.13]]

  it('точку посреди длинного отрезка считает лежащей на маршруте', () => {
    const projection = projectOnPolyline(51.13, 71.425, straight)

    // По вершинам расстояние было бы больше километра, и водитель на идеально
    // прямом участке выглядел бы сошедшим с маршрута.
    expect(projection!.distanceM).toBeLessThan(5)
  })

  it('меряет отклонение вбок от отрезка', () => {
    // ~0.0018° широты ≈ 200 м севернее линии.
    const projection = projectOnPolyline(51.1318, 71.425, straight)

    expect(projection!.distanceM).toBeGreaterThan(150)
    expect(projection!.distanceM).toBeLessThan(250)
  })

  it('не уводит проекцию за пределы отрезка', () => {
    // Точка западнее начала линии — проекция обязана прижаться к первой вершине.
    const projection = projectOnPolyline(51.13, 71.30, straight)

    expect(projection!.point[0]).toBeCloseTo(71.40, 5)
  })

  it('возвращает номер сегмента для ломаной', () => {
    const bent: Coordinate[] = [[71.40, 51.13], [71.42, 51.13], [71.42, 51.15]]
    const projection = projectOnPolyline(51.14, 71.4201, bent)

    expect(projection!.segmentIndex).toBe(1)
  })

  it('на пустой линии отдаёт null, а не падает', () => {
    expect(projectOnPolyline(51.13, 71.4, [])).toBeNull()
  })
})

describe('trimPolylineFrom', () => {
  const line: Coordinate[] = [[71.40, 51.13], [71.42, 51.13], [71.44, 51.13]]

  it('отрезает проеденный хвост и начинает с текущей позиции', () => {
    const projection = projectOnPolyline(51.13, 71.41, line)
    const trimmed = trimPolylineFrom(line, projection)

    expect(trimmed[0][0]).toBeCloseTo(71.41, 4)
    // Первая вершина осталась позади — в оставшемся маршруте её быть не должно.
    expect(trimmed).toHaveLength(3)
    expect(trimmed.at(-1)).toEqual([71.44, 51.13])
  })

  it('без проекции отдаёт маршрут как есть', () => {
    expect(trimPolylineFrom(line, null)).toEqual(line)
  })
})
