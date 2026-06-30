import type { Map, Marker } from 'mapbox-gl'
import type { UserCoordinates } from '~/composables/mapbox/useUserLocation'
import type { GeoPlace } from '~/types/geocoding'
import type { PassengerDriverLocation } from '~/types/websocket'

export type MapboxModule = typeof import('mapbox-gl')
export const ALMATY_CENTER: [number, number] = [76.9286, 43.2389]

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function useMapboxMap(mapContainer: Ref<HTMLElement | null>) {
  const map = shallowRef<Map>()
  const mapboxglModule = shallowRef<MapboxModule>()
  const driverMarker = shallowRef<Marker>()
  const pickupMarker = shallowRef<Marker>()
  const userMarker = shallowRef<Marker>()
  const favoriteMarkers: Marker[] = []
  const mapError = ref('')
  let resizeObserver: ResizeObserver | undefined
  let resizeFrame = 0

  function resizeMap() {
    if (resizeFrame)
      window.cancelAnimationFrame(resizeFrame)

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0
      map.value?.resize()
    })
  }

  function syncMapResize() {
    if (!mapContainer.value)
      return

    resizeObserver = new ResizeObserver(resizeMap)
    resizeObserver.observe(mapContainer.value)
    window.addEventListener('resize', resizeMap)
    window.addEventListener('orientationchange', resizeMap)
    window.visualViewport?.addEventListener('resize', resizeMap)
  }

  function stopMapResizeSync() {
    resizeObserver?.disconnect()
    resizeObserver = undefined
    window.removeEventListener('resize', resizeMap)
    window.removeEventListener('orientationchange', resizeMap)
    window.visualViewport?.removeEventListener('resize', resizeMap)

    if (resizeFrame)
      window.cancelAnimationFrame(resizeFrame)

    resizeFrame = 0
  }

  async function initializeMap(onLoad?: () => void, initialCenter?: [number, number]) {
    if (!mapContainer.value)
      return

    if (!mapboxToken) {
      mapError.value = 'Добавь VITE_MAPBOX_TOKEN в .env'
      return
    }

    mapboxglModule.value = await import('mapbox-gl')
    mapboxglModule.value.default.accessToken = mapboxToken

    map.value = new mapboxglModule.value.default.Map({
      attributionControl: false,
      center: initialCenter ?? ALMATY_CENTER,
      container: mapContainer.value,
      pitch: 10,
      style: 'mapbox://styles/mapbox/streets-v12',
      zoom: 12,
    })

    map.value.once('load', () => {
      onLoad?.()
      resizeMap()
    })

    map.value.on('error', () => {
      mapError.value = 'Mapbox не смог загрузить карту'
    })

    syncMapResize()
    window.setTimeout(resizeMap, 100)
  }

  function showCurrentPosition(clearRoute?: () => void) {
    if (!map.value)
      return

    clearRoute?.()

    map.value.flyTo({
      center: ALMATY_CENTER,
      essential: true,
      zoom: 12,
    })
  }

  function hideCurrentMarker() {
    pickupMarker.value?.remove()
  }

  function hideDriverLocation() {
    driverMarker.value?.remove()
    driverMarker.value = undefined
  }

  function assignStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    Object.assign(element.style, styles)
  }

  function createPickupMarkerElement() {
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
      background: '#e6ad2e',
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
    bubble.textContent = 'A'

    assignStyles(stem, {
      background: '#e6ad2e',
      height: '12px',
      marginTop: '-2px',
      width: '3px',
    })

    wrapper.append(bubble, stem)

    return wrapper
  }

  function createDestinationMarkerElement() {
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
      background: '#ef4444',
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
    bubble.textContent = 'B'

    assignStyles(stem, {
      background: '#ef4444',
      height: '12px',
      marginTop: '-2px',
      width: '3px',
    })

    wrapper.append(bubble, stem)

    return wrapper
  }

  function createFavoriteMarkerElement() {
    const wrapper = document.createElement('div')
    const bubble = document.createElement('div')
    const stem = document.createElement('div')

    assignStyles(wrapper, {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      transform: 'translateY(2px)',
    })

    assignStyles(bubble, {
      alignItems: 'center',
      background: '#3b82f6',
      border: '3px solid #fff',
      borderRadius: '999px',
      boxShadow: '0 10px 24px rgba(15,23,42,0.28)',
      color: '#fff',
      display: 'flex',
      fontSize: '15px',
      height: '32px',
      justifyContent: 'center',
      width: '32px',
    })
    bubble.innerHTML = '<span style="line-height:1">★</span>'

    assignStyles(stem, {
      background: '#3b82f6',
      height: '11px',
      marginTop: '-2px',
      width: '3px',
    })

    wrapper.append(bubble, stem)

    return wrapper
  }

  function clearFavoriteLocations() {
    favoriteMarkers.forEach(marker => marker.remove())
    favoriteMarkers.length = 0
  }

  // showFavoriteLocations рисует сохранённые места пассажира синими пинами.
  // onSelect (если передан) вызывается при тапе по пину — например, чтобы
  // подставить это место как точку назначения.
  function showFavoriteLocations(places: GeoPlace[], options: { onSelect?: (place: GeoPlace) => void } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    clearFavoriteLocations()

    for (const place of places) {
      const element = createFavoriteMarkerElement()

      if (options.onSelect) {
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          options.onSelect?.(place)
        })
      }

      const marker = new mapboxglModule.value.default.Marker({
        anchor: 'bottom',
        element,
      })
        .setLngLat([place.lng, place.lat])
        .addTo(map.value)

      favoriteMarkers.push(marker)
    }
  }

  function createUserMarkerElement() {
    const element = document.createElement('div')

    assignStyles(element, {
      background: '#e6ad2e',
      border: '4px solid #fff',
      borderRadius: '999px',
      boxShadow: '0 0 0 8px rgba(230,173,46,0.20), 0 10px 24px rgba(15,23,42,0.28)',
      height: '24px',
      width: '24px',
      zIndex: '5',
    })

    return element
  }

  function createDriverMarkerElement() {
    return createCarMarkerElement()
  }

  function createCarMarkerElement() {
    const element = document.createElement('div')
    const image = document.createElement('img')

    image.src = '/taxi_top_view.svg'
    image.alt = ''
    image.draggable = false

    assignStyles(image, {
      display: 'block',
      height: '64px',
      pointerEvents: 'none',
      userSelect: 'none',
      width: '30px',
    })

    assignStyles(element, {
      filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.45))',
      height: '64px',
      pointerEvents: 'none',
      width: '30px',
      zIndex: '7',
    })

    element.append(image)

    return element
  }

  function showPickupLocation(place: GeoPlace, options: { focus?: boolean } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    pickupMarker.value?.remove()
    pickupMarker.value = new mapboxglModule.value.default.Marker({
      anchor: 'bottom',
      element: createPickupMarkerElement(),
    })
      .setLngLat([place.lng, place.lat])
      .addTo(map.value)

    if (options.focus) {
      map.value.flyTo({
        center: [place.lng, place.lat],
        essential: true,
        zoom: 16,
      })
    }
  }

  function showDestinationLocation(place: GeoPlace, options: { focus?: boolean } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    pickupMarker.value?.remove()
    pickupMarker.value = new mapboxglModule.value.default.Marker({
      anchor: 'bottom',
      element: createDestinationMarkerElement(),
    })
      .setLngLat([place.lng, place.lat])
      .addTo(map.value)

    if (options.focus) {
      map.value.flyTo({
        center: [place.lng, place.lat],
        essential: true,
        zoom: 16,
      })
    }
  }

  function showUserLocation(coordinates: UserCoordinates, options: { focus?: boolean } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    const lngLat: [number, number] = [coordinates.lng, coordinates.lat]

    if (userMarker.value) {
      userMarker.value.setLngLat(lngLat)
      if (options.focus) {
        map.value.flyTo({
          center: lngLat,
          essential: true,
          zoom: 16,
        })
      }
      return
    }

    userMarker.value = new mapboxglModule.value.default.Marker({
      anchor: 'center',
      element: createUserMarkerElement(),
    })
      .setLngLat(lngLat)
      .addTo(map.value)

    if (options.focus) {
      map.value.flyTo({
        center: lngLat,
        essential: true,
        zoom: 16,
      })
    }
  }

  function showSelfCarLocation(coordinates: UserCoordinates, options: { focus?: boolean } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    const lngLat: [number, number] = [coordinates.lng, coordinates.lat]
    const heading = coordinates.heading ?? 0

    if (userMarker.value) {
      userMarker.value.setLngLat(lngLat)
      userMarker.value.setRotation(heading)
      if (options.focus) {
        map.value.flyTo({ center: lngLat, essential: true, zoom: 16 })
      }
      return
    }

    userMarker.value = new mapboxglModule.value.default.Marker({
      anchor: 'center',
      element: createCarMarkerElement(),
      rotation: heading,
      rotationAlignment: 'map',
    })
      .setLngLat(lngLat)
      .addTo(map.value)

    if (options.focus) {
      map.value.flyTo({ center: lngLat, essential: true, zoom: 16 })
    }
  }

  function showDriverLocation(location: PassengerDriverLocation, options: { focus?: boolean } = {}) {
    if (!map.value || !mapboxglModule.value)
      return

    const lngLat: [number, number] = [location.lng, location.lat]

    if (driverMarker.value) {
      driverMarker.value.setLngLat(lngLat)
      driverMarker.value.setRotation(location.heading ?? 0)
      if (options.focus) {
        map.value.flyTo({
          center: lngLat,
          essential: true,
          zoom: 16,
        })
      }
      return
    }

    driverMarker.value = new mapboxglModule.value.default.Marker({
      anchor: 'center',
      element: createDriverMarkerElement(),
      rotation: location.heading ?? 0,
      rotationAlignment: 'map',
    })
      .setLngLat(lngLat)
      .addTo(map.value)

    if (options.focus) {
      map.value.flyTo({
        center: lngLat,
        essential: true,
        zoom: 16,
      })
    }
  }

  function destroyMap(cleanup?: () => void) {
    cleanup?.()
    stopMapResizeSync()
    clearFavoriteLocations()
    driverMarker.value?.remove()
    pickupMarker.value?.remove()
    userMarker.value?.remove()
    map.value?.remove()
  }

  return {
    clearFavoriteLocations,
    destroyMap,
    driverMarker,
    hideDriverLocation,
    hideCurrentMarker,
    initializeMap,
    map,
    mapboxglModule,
    mapError,
    pickupMarker,
    resizeMap,
    showDestinationLocation,
    showDriverLocation,
    showFavoriteLocations,
    showPickupLocation,
    showCurrentPosition,
    showSelfCarLocation,
    showUserLocation,
    userMarker,
  }
}
