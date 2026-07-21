// Геометрия для работы с маршрутом на клиенте.
//
// Зачем это здесь, а не на бэкенде: каждый вызов роутера у 2GIS стоит денег, и
// самая дорогая строка счёта — перестроение маршрута подачи, пока водитель едет
// к пассажиру. Считать «водитель всё ещё на маршруте» можно локально и бесплатно,
// а ходить к провайдеру — только когда он с маршрута ушёл.

// Координата в порядке GeoJSON: [долгота, широта]. Именно так их отдаёт роутер
// и ждёт Mapbox, поэтому не переворачиваем.
export type Coordinate = [number, number]

// Метры на градус. Широта — величина почти постоянная; долгота сжимается к
// полюсам, поэтому её масштаб берём по косинусу широты в точке отсчёта.
const METERS_PER_LAT_DEG = 110_540
const METERS_PER_LNG_DEG = 111_320

// distanceM — расстояние по большому кругу (гаверсинус).
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface PolylineProjection {
  // Насколько точка отстоит от линии.
  distanceM: number
  // Сегмент [index, index + 1], на который спроецировалась точка.
  segmentIndex: number
  // Сама проекция — с неё начинается «оставшийся» маршрут.
  point: Coordinate
}

// projectOnPolyline — ближайшая к точке точка НА линии.
//
// Считаем расстояние до отрезков, а не до вершин, и это принципиально: на
// прямом участке трассы вершины стоят через километры, и по вершинам водитель
// посреди такого участка выглядел бы «сошедшим с маршрута» — то есть мы бы
// перестраивали маршрут ровно там, где он идеально ему следует.
//
// В пределах города плоская проекция даёт погрешность заметно меньше порога
// отклонения, поэтому сферическую тригонометрию тут не разводим.
export function projectOnPolyline(lat: number, lng: number, line: Coordinate[]): PolylineProjection | null {
  if (line.length === 0)
    return null
  if (line.length === 1) {
    const [lng0, lat0] = line[0]
    return { distanceM: distanceM(lat, lng, lat0, lng0), point: line[0], segmentIndex: 0 }
  }

  const lngScale = METERS_PER_LNG_DEG * Math.cos((lat * Math.PI) / 180)
  // Начало координат — сама точка, поэтому её плоские координаты это (0, 0).
  const toLocal = (coord: Coordinate): [number, number] => [
    (coord[0] - lng) * lngScale,
    (coord[1] - lat) * METERS_PER_LAT_DEG,
  ]

  let best: PolylineProjection | null = null

  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = toLocal(line[i])
    const [bx, by] = toLocal(line[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy

    // t — положение проекции на отрезке: 0 — начало, 1 — конец. Зажимаем в
    // [0, 1], иначе проекция уехала бы за пределы сегмента.
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq))
    const px = ax + t * dx
    const py = ay + t * dy
    const distance = Math.sqrt(px * px + py * py)

    if (!best || distance < best.distanceM) {
      best = {
        distanceM: distance,
        point: [
          line[i][0] + t * (line[i + 1][0] - line[i][0]),
          line[i][1] + t * (line[i + 1][1] - line[i][1]),
        ],
        segmentIndex: i,
      }
    }
  }

  return best
}

// trimPolylineFrom — часть маршрута от проекции водителя и до конца.
//
// Нужна, чтобы линия на карте не тянулась по уже проеденному куску. Раньше это
// получалось само собой: маршрут перестраивался от текущей позиции каждые 15
// секунд. Теперь перестроение редкое, и «подрезать» линию надо локально —
// бесплатно и мгновенно.
export function trimPolylineFrom(line: Coordinate[], projection: null | PolylineProjection): Coordinate[] {
  if (!projection || line.length === 0)
    return line

  const rest = line.slice(projection.segmentIndex + 1)
  return [projection.point, ...rest]
}
