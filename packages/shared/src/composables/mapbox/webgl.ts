// hasWebgl2 — проба поддержки WebGL2. mapbox-gl v3 без него не запускается:
// new Map() синхронно бросает «Failed to initialize WebGL». Пробой заранее
// отличаем «карта тут не поднимется» (мобильные браузеры без WebGL2, GPU в
// блок-листе, выключенное аппаратное ускорение) от рабочего окружения — и
// уводим зрителя на статичный фолбэк вместо чёрного экрана.
export function hasWebgl2(): boolean {
  if (typeof document === 'undefined')
    return false
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  }
  catch {
    return false
  }
}
