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
  // Каждый stop/new offer инвалидирует незавершённый play(). Это важно для
  // Telegram WebView: там promise от play() иногда остаётся pending до
  // следующего жеста и без проверки музыка внезапно стартует от скролла/тапа,
  // хотя оффер к этому моменту уже закрыт.
  let playGeneration = 0
  let pendingPlayOfferId: string | null = null
  let warmPromise: Promise<void> | null = null

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
    if (unlocked || warmPromise)
      return

    // Оффер уже пришёл, но autoplay был заблокирован. Этот жест разрешает
    // проиграть именно текущий заказ — прогревать и сразу глушить его нельзя.
    const offerId = driver.pendingOffer?.trip_id
    if (offerId) {
      unlocked = true
      // Если play() этого же оффера уже ждёт пользовательского жеста, сам
      // pointerdown его разблокирует. Второй play() создал бы гонку promises.
      if (pendingPlayOfferId !== offerId)
        void playOffer(offerId)
      return
    }

    const el = ensureAudio()
    const generation = playGeneration
    const previousVolume = el.volume
    el.muted = true
    // Часть Android WebView некорректно соблюдает muted у media element.
    // Нулевая громкость — второй предохранитель от слышимого «прогрева».
    el.volume = 0
    warmPromise = el.play()
      .then(() => {
        el.pause()
        el.currentTime = 0
        // Если за время прогрева появился/исчез оффер, этот play уже устарел.
        // Разблокировку всё равно считаем успешной, но ничего не запускаем.
        if (generation === playGeneration)
          unlocked = true
      })
      .catch(() => {
        // Прогрев отклонён — ждём следующего жеста. Слушатель ниже
        // перевешивается именно поэтому: с {once:true} и без этого повтора
        // единственная неудачная попытка глушила бы мелодию на всю сессию.
        armFirstGesture()
      })
      .finally(() => {
        el.muted = false
        el.volume = previousVolume
        warmPromise = null
      })
  }

  async function playOffer(offerId: string) {
    if (!enabled.value || driver.pendingOffer?.trip_id !== offerId || driver.hasActiveTrip)
      return

    if (pendingPlayOfferId === offerId)
      return

    // Не конкурируем с muted-прогревом: иначе его .then() может поставить на
    // pause уже настоящее проигрывание только что пришедшего заказа.
    if (warmPromise)
      await warmPromise

    if (!enabled.value || driver.pendingOffer?.trip_id !== offerId || driver.hasActiveTrip)
      return

    const generation = ++playGeneration
    pendingPlayOfferId = offerId
    const el = ensureAudio()
    el.muted = false
    el.volume = 1
    el.currentTime = 0
    try {
      await el.play()
      // play() мог выполниться только на более позднем pointerdown. Не даём
      // такому отложенному запуску пережить закрытие/замену оффера.
      // При более новом поколении аудио уже принадлежит следующему офферу либо
      // было остановлено. Не глушим новый заказ ответом старого promise; но если
      // актуального оффера больше нет, повторно фиксируем pause.
      if (generation !== playGeneration) {
        if (!driver.pendingOffer || driver.hasActiveTrip || !enabled.value)
          stopAudio()
      }
      else if (driver.pendingOffer?.trip_id !== offerId
        || driver.hasActiveTrip
        || !enabled.value) {
        stopAudio()
      }
      if (pendingPlayOfferId === offerId)
        pendingPlayOfferId = null
    }
    catch {
      // Автозапуск заблокирован (не было жеста) — молча пропускаем.
      // Очередной жест попробует запустить звук только если оффер ещё актуален.
      if (pendingPlayOfferId === offerId)
        pendingPlayOfferId = null
      if (generation === playGeneration && driver.pendingOffer?.trip_id === offerId) {
        unlocked = false
        armFirstGesture()
      }
    }
  }

  function stopAudio() {
    if (!audio)
      return
    audio.pause()
    audio.currentTime = 0
  }

  function stop() {
    playGeneration++
    pendingPlayOfferId = null
    stopAudio()
  }

  // Смотрим на ID, а не на весь объект: повторный WS/refetch того же оффера не
  // должен заново запускать мелодию. Звук стартует только на переходе к новому ID.
  watch(
    () => driver.pendingOffer?.trip_id ?? null,
    (offerId) => {
      if (offerId)
        void playOffer(offerId)
      else
        stop()
    },
  )

  // Страховка: с началом активной поездки мелодии быть не должно, каким бы
  // путём ни закрылся оффер (accept, restore после перезагрузки, гонка WS).
  watch(
    () => driver.hasActiveTrip,
    (active) => {
      if (active)
        stop()
    },
  )

  watch(enabled, (on) => {
    if (!on)
      stop()
    // Включение настройки посреди уже открытого оффера не считается новым
    // заказом и не должно запускать музыку от клика по тумблеру.
  })

  const onFirstGesture = () => unlock()

  // Вешаем разблокировку на очередной жест. Вызывается повторно, если прогрев
  // не удался: браузер мог отклонить его, например пока вкладка была скрыта.
  function armFirstGesture() {
    if (unlocked)
      return
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true })
  }

  onMounted(armFirstGesture)

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onFirstGesture)
    stop()
  })

  return { enabled, unlock }
}
