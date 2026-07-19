import type { GeoJSONSource, LngLatBoundsLike, Map } from 'mapbox-gl'
import type { ComputedRef, ShallowRef } from 'vue'
import type { MapboxModule } from './useMapboxMap'

// Полигон района в формате GeoJSON (ST_AsGeoJSON с бэка). Достаточно MultiPolygon
// (city_districts.polygon — MULTIPOLYGON), Polygon тоже переварится Mapbox'ом.
export interface DistrictPolygon {
  coordinates: number[][][][]
  type: 'MultiPolygon' | 'Polygon'
}

export interface DistrictShape {
  id: string
  polygon?: DistrictPolygon | null
}

interface UseMapboxDistrictsOptions {
  districts: ComputedRef<DistrictShape[]>
  // Цвет заливки/границы (по умолчанию янтарный, как маршрут).
  fillColor?: string
  fillOpacity?: number
  lineOpacity?: number
  lineWidth?: number
  map: ShallowRef<Map | undefined>
  // Для fitDistricts (мини-карта в настройках); на главной карте не нужен.
  mapboxglModule?: ShallowRef<MapboxModule | undefined>
  // Префикс source/слоёв — уникальный на карту, чтобы можно было держать два
  // набора (напр. «все районы бледно» + «выбранные ярко»).
  sourcePrefix: string
}

export function useMapboxDistricts(options: UseMapboxDistrictsOptions) {
  const sourceId = options.sourcePrefix
  const fillLayerId = `${options.sourcePrefix}-fill`
  const lineLayerId = `${options.sourcePrefix}-line`
  const fillColor = options.fillColor ?? '#e6ad2e'

  function getFeatureCollection() {
    return {
      type: 'FeatureCollection' as const,
      features: options.districts.value
        .filter(d => d.polygon)
        .map(d => ({
          type: 'Feature' as const,
          properties: { id: d.id },
          geometry: d.polygon as DistrictPolygon,
        })),
    }
  }

  function renderDistricts() {
    if (!options.map.value)
      return

    const collection = getFeatureCollection()

    // Нечего рисовать — убираем прошлые слои (снятие выбора «Весь город»).
    if (collection.features.length === 0) {
      clearDistricts()
      return
    }

    const existing = options.map.value.getSource(sourceId) as GeoJSONSource | undefined
    if (existing) {
      existing.setData(collection)
      return
    }

    options.map.value.addSource(sourceId, { data: collection, type: 'geojson' })

    // Заливку кладём ПОД линию маршрута (если она есть), чтобы маршрут и метки
    // A/B оставались поверх подсветки района.
    const beforeId = options.map.value.getLayer('trip-route-line') ? 'trip-route-line' : undefined

    options.map.value.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': options.fillOpacity ?? 0.12,
      },
    }, beforeId)

    options.map.value.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': fillColor,
        'line-opacity': options.lineOpacity ?? 0.7,
        'line-width': options.lineWidth ?? 1.5,
      },
    }, beforeId)
  }

  function clearDistricts() {
    if (!options.map.value)
      return

    // Порядок: слои → source (source нельзя удалить, пока на него ссылаются слои).
    if (options.map.value.getLayer(fillLayerId))
      options.map.value.removeLayer(fillLayerId)
    if (options.map.value.getLayer(lineLayerId))
      options.map.value.removeLayer(lineLayerId)
    if (options.map.value.getSource(sourceId))
      options.map.value.removeSource(sourceId)
  }

  // restoreDistricts — перерисовка после смены стиля карты (setStyle сбрасывает
  // кастомные слои), без движения камеры.
  function restoreDistricts() {
    renderDistricts()
  }

  // fitDistricts — вписать все полигоны в кадр (мини-карта в настройках).
  function fitDistricts() {
    if (!options.map.value || !options.mapboxglModule?.value)
      return

    const features = getFeatureCollection().features
    if (features.length === 0)
      return

    const first = features[0].geometry.coordinates[0]?.[0]?.[0]
    if (!first)
      return

    const bounds = new options.mapboxglModule.value.default.LngLatBounds(first as [number, number], first as [number, number])
    for (const feature of features) {
      for (const polygon of feature.geometry.coordinates) {
        for (const ring of polygon) {
          for (const coord of ring)
            bounds.extend(coord as [number, number])
        }
      }
    }

    options.map.value.fitBounds(bounds as LngLatBoundsLike, { maxZoom: 13, padding: 28 })
  }

  return {
    clearDistricts,
    fitDistricts,
    renderDistricts,
    restoreDistricts,
  }
}
