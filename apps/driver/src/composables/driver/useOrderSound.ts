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
    // preload='auto', а не 'none': при 'none' файл начинал качаться прямо в
    // момент прогрева, из-за чего между play() и пришедшим следом pause()
    // проходили сотни миллисекунд — то самое окно, в котором прогрев был
    // слышен. Заодно первый настоящий оффер звучит сразу, а не после загрузки.
    audio.preload = 'auto'
    return audio
  }

  // Возврат элемента в «слышимое» состояние после прогрева.
  function makeAudible(el: HTMLAudioElement) {
    el.muted = false
    el.volume = 1
  }

  // Прогрев на первом жесте: короткий беззвучный play→pause снимает блокировку
  // автозапуска, чтобы позже play() по приходу заказа сработал без жеста.
  //
  // ⚠️ Прогрев обязан быть НЕ СЛЫШЕН. Раньше он глушился только через muted, и
  // этого не хватало: водители слышали мелодию заказа просто от касания экрана
  // (вход в приложение, приопускание шторки — любой pointerdown зовёт unlock).
  // Поэтому глушим двумя независимыми способами и снимаем глушение только
  // после того, как убедились, что элемент действительно остановлен.
  function unlock() {
    if (unlocked)
      return
    const el = ensureAudio()
    // Мелодия уже легитимно играет (оффер на экране, жест её и разблокировал) —
    // не глушим её прогревом.
    if (!el.paused) {
      unlocked = true
      return
    }

    el.muted = true
    el.volume = 0

    el.play()
      .then(() => {
        el.pause()
        el.currentTime = 0
        unlocked = true
        makeAudible(el)

        // Пока шёл прогрев, мог прийти настоящий оффер: его play() отработал на
        // заглушенном элементе, а наш pause() выше его же и остановил. Без этой
        // строки водитель молча пропустил бы заказ.
        if (driver.pendingOffer)
          play()
      })
      .catch(() => {
        // Прогрев отклонён — ждём следующего жеста. Слушатель ниже
        // перевешивается именно поэтому: с {once:true} и без этого повтора
        // единственная неудачная попытка глушила бы мелодию на всю сессию.
        makeAudible(el)
        armFirstGesture()
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
    else if (driver.pendingOffer)
      play()
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
