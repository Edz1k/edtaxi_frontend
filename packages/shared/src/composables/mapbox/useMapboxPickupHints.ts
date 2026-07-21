import type { GeoJSONSource, Map } from 'mapbox-gl'
import type { ComputedRef, ShallowRef } from 'vue'
import { watch } from 'vue'

// Кружок-подсказка: где обычно садятся и выходят. Подсказка, а не ограничение —
// точку по-прежнему можно поставить куда угодно.
export interface PickupHint {
  lat: number
  lng: number
  // Имя размеченной точки («Вход №3») либо адрес из истории поездок.
  title?: string
  // manual | 2gis | cluster | personal — см. бэкенд. Личные подсказки рисуем
  // заметнее: «вы уезжали отсюда» полезнее случайной популярной точки рядом.
  source: string
  trips?: number
}

interface UseMapboxPickupHintsOptions {
  hints: ComputedRef<PickupHint[]>
  map: ShallowRef<Map | undefined>
  sourcePrefix?: string
}

// Слой подсказок рисуем через GeoJSON-source, а НЕ DOM-маркерами (как избранные
// места): маркеров бывает пара штук, а подсказок — десятки, и каждый DOM-узел
// пришлось бы двигать на каждом кадре карты.
export function useMapboxPickupHints(options: UseMapboxPickupHintsOptions) {
  const sourceId = options.sourcePrefix ?? 'pickup-hints'
  const circleLayerId = `${sourceId}-circle`
  const labelLayerId = `${sourceId}-label`

  function getFeatureCollection() {
    return {
      type: 'FeatureCollection' as const,
      features: options.hints.value.map(hint => ({
        type: 'Feature' as const,
        properties: {
          isPersonal: hint.source === 'personal',
          title: hint.title ?? '',
        },
        geometry: { coordinates: [hint.lng, hint.lat], type: 'Point' as const },
      })),
    }
  }

  function renderHints() {
    if (!options.map.value)
      return

    const collection = getFeatureCollection()
    if (collection.features.length === 0) {
      clearHints()
      return
    }

    const existing = options.map.value.getSource(sourceId) as GeoJSONSource | undefined
    if (existing) {
      existing.setData(collection)
      return
    }

    options.map.value.addSource(sourceId, { data: collection, type: 'geojson' })

    // Под линию маршрута: подсказки — фон, метки А/Б и маршрут важнее.
    const beforeId = options.map.value.getLayer('trip-route-line') ? 'trip-route-line' : undefined

    options.map.value.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': ['case', ['get', 'isPersonal'], 5, 4],
        'circle-color': '#f8fafc',
        'circle-opacity': 0.9,
        'circle-stroke-width': ['case', ['get', 'isPersonal'], 2, 1.5],
        'circle-stroke-color': ['case', ['get', 'isPersonal'], '#e6ad2e', '#64748b'],
      },
    }, beforeId)

    // Подписи только у личных точек и только на близком зуме: иначе десяток
    // адресов превращает карту в кашу.
    options.map.value.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['get', 'isPersonal'],
      minzoom: 15,
      layout: {
        'text-field': ['get', 'title'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.2,
      },
    }, beforeId)
  }

  function clearHints() {
    if (!options.map.value)
      return

    // Порядок: слои → source (source нельзя удалить, пока на него ссылаются слои).
    if (options.map.value.getLayer(labelLayerId))
      options.map.value.removeLayer(labelLayerId)
    if (options.map.value.getLayer(circleLayerId))
      options.map.value.removeLayer(circleLayerId)
    if (options.map.value.getSource(sourceId))
      options.map.value.removeSource(sourceId)
  }

  // Смена стиля карты (тема) сбрасывает пользовательские source и слои — без
  // повторного вызова подсказки просто исчезли бы после переключения темы.
  function restoreHints() {
    renderHints()
  }

  watch(options.hints, renderHints, { deep: true })

  return { clearHints, renderHints, restoreHints }
}
