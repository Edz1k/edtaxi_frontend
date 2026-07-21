import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { GeoPlace, RouteCoordinate } from '@edtaxi/shared/types/geocoding'
import type { Ref } from 'vue'
import type { DriverTripOffer } from '~/types/websocket'
import { getDrivingRoute, getDrivingRouteVia } from '@edtaxi/shared/api/geocoding'
import { projectOnPolyline, trimPolylineFrom } from '@edtaxi/shared/utils/geo'
import { computed, ref, watch } from 'vue'
import { useDriverStore } from '~/stores/driver'
import { offerToPlace } from '~/utils/geoPlace'

// Насколько водитель должен отойти от нарисованного маршрута, чтобы имело смысл
// строить новый. 150 м — это уже не «шумит GPS» и не «объезжает припаркованную
// машину», а другая улица.
const ROUTE_DEVIATION_M = 150

// Нижняя граница между перестроениями. Страховка от шторма запросов, если GPS
// начнёт прыгать или маршрут окажется потерян окончательно: без неё каждая
// координата за порогом отклонения била бы в роутер.
const MIN_REBUILD_INTERVAL_MS = 60_000

// Строит линию маршрута для текущего оффера / активной поездки. По пути к
// пассажиру маршрут идёт от живой позиции водителя, иначе — подача → назначение.
// Ответы версионируются, устаревшие отбрасываются.
//
// ⚠️ Перестроение по пути к пассажиру привязано к ОТКЛОНЕНИЮ от маршрута, а не
// к таймеру, и это не микрооптимизация. Раньше маршрут перестраивался каждые 15
// секунд, то есть 20-30 платных вызовов роутера на одну подачу — самая дорогая
// строка в счёте 2GIS. Пока водитель едет по нарисованной линии, новый маршрут
// не несёт никакой новой информации; линию достаточно локально подрезать до
// оставшейся части.
export function useOfferRoute(liveCoordinates: Ref<UserCoordinates | null>) {
  const driver = useDriverStore()
  // Маршрут целиком, как его отдал роутер. На карту идёт подрезанный (см. ниже).
  const fullRoute = ref<RouteCoordinate[]>([])
  const isRouteLoading = ref(false)
  let routeVersion = 0
  let lastRebuildAt = 0

  const mapOffer = computed(() => driver.activeOffer || driver.pendingOffer)

  function coordsToPlace(lat: number, lng: number): GeoPlace {
    return { address: '', id: 'self', lat, lng, name: '' }
  }

  async function resolveOfferRoute(offer: DriverTripOffer | null) {
    const version = ++routeVersion
    fullRoute.value = []

    if (!offer) {
      isRouteLoading.value = false
      return
    }

    // Approaching pickup: route from driver's current position to pickup
    if (driver.activeTripStep === 'to_pickup' && liveCoordinates.value) {
      const pickup = offerToPlace(offer, 'pickup')
      if (!pickup)
        return

      isRouteLoading.value = true
      try {
        const from = coordsToPlace(liveCoordinates.value.lat, liveCoordinates.value.lng)
        const route = await getDrivingRoute(from, pickup)
        if (version !== routeVersion)
          return
        fullRoute.value = route.geometry
      }
      catch {
        if (version !== routeVersion)
          return
        fullRoute.value = [
          [liveCoordinates.value.lng, liveCoordinates.value.lat],
          [pickup.lng, pickup.lat],
        ]
      }
      finally {
        if (version === routeVersion)
          isRouteLoading.value = false
      }
      return
    }

    // Active trip or pending offer: full pickup → stops → dropoff route
    const pickup = offerToPlace(offer, 'pickup')
    const destination = offerToPlace(offer, 'dropoff')
    if (!pickup || !destination)
      return

    const stops = offer.stops ?? []

    isRouteLoading.value = true
    try {
      const route = stops.length
        ? await getDrivingRouteVia([pickup, ...stops, destination])
        : await getDrivingRoute(pickup, destination)
      if (version !== routeVersion)
        return
      fullRoute.value = route.geometry
    }
    catch {
      if (version !== routeVersion)
        return
      fullRoute.value = [
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat],
      ]
    }
    finally {
      if (version === routeVersion)
        isRouteLoading.value = false
    }
  }

  // Проекция водителя на маршрут подачи. Считается локально на каждый пинг GPS
  // — это чистая арифметика, к сети не ходит.
  const approachProjection = computed(() => {
    if (driver.activeTripStep !== 'to_pickup' || !liveCoordinates.value || fullRoute.value.length === 0)
      return null

    return projectOnPolyline(liveCoordinates.value.lat, liveCoordinates.value.lng, fullRoute.value)
  })

  // На карту отдаём маршрут от текущего положения водителя и дальше: проеденный
  // хвост подрезаем локально. Раньше этот эффект получался побочно — от того,
  // что маршрут каждые 15 секунд строился заново от live-позиции.
  const routeCoordinates = computed<RouteCoordinate[]>(() =>
    trimPolylineFrom(fullRoute.value, approachProjection.value),
  )

  // Rebuild when offer or trip step changes — single watch prevents double API
  // call when both change synchronously in the same store action (acceptOffer).
  watch(
    [mapOffer, () => driver.activeTripStep],
    ([offer]) => {
      lastRebuildAt = Date.now()
      resolveOfferRoute(offer)
    },
    { immediate: true },
  )

  // Пересчёт маршрута подачи — только когда водитель реально ушёл с линии.
  watch(liveCoordinates, () => {
    if (driver.activeTripStep !== 'to_pickup' || !mapOffer.value)
      return

    const projection = approachProjection.value
    // Маршрута ещё нет (первый пинг пришёл раньше ответа роутера) — строить
    // нечего: этим займётся watch выше.
    if (!projection || projection.distanceM <= ROUTE_DEVIATION_M)
      return

    if (Date.now() - lastRebuildAt < MIN_REBUILD_INTERVAL_MS)
      return

    lastRebuildAt = Date.now()
    resolveOfferRoute(mapOffer.value)
  })

  return { isRouteLoading, mapOffer, routeCoordinates }
}
