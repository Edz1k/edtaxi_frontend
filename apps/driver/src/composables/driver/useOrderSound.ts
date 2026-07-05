import { useLocalStorage } from '@vueuse/core'
import orderMelodyUrl from '~/assets/order-melody.mp3'
import { useDriverStore } from '~/stores/driver'

// Настройка «мелодия заказа»: хранится локально на устройстве водителя,
// по умолчанию включена. Общий ключ для плеера и тумблера в настройках.
const ORDER_SOUND_KEY = 'driver:order-sound-enabled'

export function useOrderSoundEnabled() {
  return useLocalStorage(ORDER_SOUND_KEY, true)
}

// useOrderSound проигрывает мелодию, пока водителю показывается входящий заказ
// (store.pendingOffer), и останавливает её, как только заказ принят/отклонён/
// протух. Вызывать ОДИН раз на живом экране (map). Требует разблокировки звука
// жестом пользователя — браузеры/вебвью блокируют автозапуск аудио, поэтому мы
// «прогреваем» элемент при первом касании экрана.
export function useOrderSound() {
  const driver = useDriverStore()
  const enabled = useOrderSoundEnabled()

  let audio: HTMLAudioElement | null = null
  let unlocked = false

  function ensureAudio() {
    if (audio)
      return audio
    audio = new Audio(orderMelodyUrl)
    audio.loop = true
    audio.preload = 'none'
    return audio
  }

  // Прогрев на первом жесте: короткий muted play→pause снимает блокировку
  // автозапуска, чтобы позже play() по приходу заказа сработал без жеста.
  function unlock() {
    if (unlocked)
      return
    const el = ensureAudio()
    el.muted = true
    el.play()
      .then(() => {
        el.pause()
        el.currentTime = 0
        el.muted = false
        unlocked = true
      })
      .catch(() => {
        // Останется заблокированным до следующего жеста — не критично.
        el.muted = false
      })
  }

  function play() {
    if (!enabled.value)
      return
    const el = ensureAudio()
    el.currentTime = 0
    el.play().catch(() => {
      // Автозапуск заблокирован (не было жеста) — молча пропускаем.
    })
  }

  function stop() {
    if (!audio)
      return
    audio.pause()
    audio.currentTime = 0
  }

  // Проигрываем, пока висит входящий заказ; чиним состояние при смене настройки.
  watch(
    () => driver.pendingOffer,
    (offer) => {
      if (offer)
        play()
      else
        stop()
    },
  )

  watch(enabled, (on) => {
    if (!on)
      stop()
    else if (driver.pendingOffer)
      play()
  })

  const onFirstGesture = () => unlock()

  onMounted(() => {
    // Разблокируем звук на первом касании/клике по приложению.
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onFirstGesture)
    stop()
  })

  return { enabled, unlock }
}
