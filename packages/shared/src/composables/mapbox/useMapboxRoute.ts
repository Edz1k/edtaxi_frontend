import type { GeoJSONSource, LngLatBoundsLike, Map, Marker } from 'mapbox-gl'
import type { ComputedRef, ShallowRef } from 'vue'
import type { GeoPlace, RouteCoordinate } from '../../types/geocoding'
import type { MapboxModule } from './useMapboxMap'
import { computed } from 'vue'

interface UseMapboxRouteOptions {
  destinationPlace: ComputedRef<GeoPlace | null>
  hasRoute: ComputedRef<boolean>
  map: ShallowRef<Map | undefined>
  mapboxglModule: ShallowRef<MapboxModule | undefined>
  pickupPlace: ComputedRef<GeoPlace | null>
  routeCoordinates: ComputedRef<RouteCoordinate[]>
}

function assignStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles)
}

function createPointElement(label: string, color: string) {
  const wrapper = document.createElement('div')
  const bubble = document.createElement('div')
  const stem = document.createElement('div')

  assignStyles(wrapper, {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    transform: 'translateY(2px)',
  })

  assignStyles(bubble, {
    alignItems: 'center',
    background: color,
    border: '3px solid #fff',
    borderRadius: '999px',
    boxShadow: '0 10px 24px rgba(15,23,42,0.28)',
    color: '#fff',
    display: 'flex',
    fontSize: '14px',
    fontWeight: '900',
    height: '34px',
    justifyContent: 'center',
    lineHeight: '34px',
    width: '34px',
  })
  bubble.textContent = label

  assignStyles(stem, {
    background: color,
    height: '12px',
    marginTop: '-2px',
    width: '3px',
  })

  wrapper.append(bubble, stem)

  return wrapper
}

export function useMapboxRoute(options: UseMapboxRouteOptions) {
  const routeMarkers: Marker[] = []

  const pickupCoordinate = computed<RouteCoordinate | null>(() => {
    if (options.pickupPlace.value)
      return [options.pickupPlace.value.lng, options.pickupPlace.value.lat]

    return options.routeCoordinates.value[0] ?? null
  })

  const destinationCoordinate = computed<RouteCoordinate | null>(() => {
    if (options.destinationPlace.value)
      return [options.destinationPlace.value.lng, options.destinationPlace.value.lat]

    return options.routeCoordinates.value.at(-1) ?? null
  })

  function getRouteFeatureCollection() {
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: options.routeCoordinates.value,
          },
        },
      ],
    }
  }

  function renderRoute() {
    if (!options.map.value || !options.hasRoute.value)
      return

    const existingSource = options.map.value.getSource('trip-route') as GeoJSONSource | undefined

    if (existingSource) {
      existingSource.setData(getRouteFeatureCollection())
      return
    }

    options.map.value.addSource('trip-route', {
      data: getRouteFeatureCollection(),
      type: 'geojson',
    })

    options.map.value.addLayer({
      id: 'trip-route-line',
      type: 'line',
      source: 'trip-route',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#e6ad2e',
        'line-width': 5,
      },
    })
  }

  function renderRouteMarkers() {
    if (!options.map.value || !options.mapboxglModule.value || !options.hasRoute.value || !pickupCoordinate.value || !destinationCoordinate.value)
      return

    routeMarkers.forEach(item => item.remove())
    routeMarkers.length = 0

    routeMarkers.push(
      new options.mapboxglModule.value.default.Marker({
        anchor: 'bottom',
        element: createPointElement('A', '#e6ad2e'),
      })
        .setLngLat(pickupCoordinate.value)
        .addTo(options.map.value),

      new options.mapboxglModule.value.default.Marker({
        anchor: 'bottom',
        element: createPointElement('B', '#ef4444'),
      })
        .setLngLat(destinationCoordinate.value)
        .addTo(options.map.value),
    )
  }

  function clearRoute() {
    if (!options.map.value)
      return

    routeMarkers.forEach(item => item.remove())
    routeMarkers.length = 0

    if (options.map.value.getLayer('trip-route-line'))
      options.map.value.removeLayer('trip-route-line')

    if (options.map.value.getSource('trip-route'))
      options.map.value.removeSource('trip-route')
  }

  function fitRoute() {
    if (!options.map.value || !options.mapboxglModule.value || !options.hasRoute.value)
      return

    const bounds = new options.mapboxglModule.value.default.LngLatBounds(
      options.routeCoordinates.value[0],
      options.routeCoordinates.value[0],
    )

    options.routeCoordinates.value.forEach((coordinate) => {
      bounds.extend(coordinate)
    })

    if (pickupCoordinate.value)
      bounds.extend(pickupCoordinate.value)

    if (destinationCoordinate.value)
      bounds.extend(destinationCoordinate.value)

    options.map.value.fitBounds(
      bounds as LngLatBoundsLike,
      {
        maxZoom: 13,
        padding: {
          bottom: 290,
          left: 48,
          right: 48,
          top: 110,
        },
      },
    )
  }

  function showTripRoute() {
    if (!options.map.value || !options.hasRoute.value)
      return

    renderRoute()
    renderRouteMarkers()
    fitRoute()
  }

  return {
    clearRoute,
    showTripRoute,
  }
}
