// Куда вести водителя из баннера «не удалось выйти на линию».
export type OnlineBlockTarget = 'daily-check' | 'live-location' | 'park' | 'verification'

// onlineBlockTargetFor выбирает экран по тексту 403 с бэкенда: у гейтов выхода
// на линию нет машиночитаемого кода, а причины закрываются на разных экранах.
//
// Сопоставление по тексту хрупкое, поэтому оно собрано здесь и покрыто тестами:
// при смене формулировок на бэке правится и ломается ровно одно место.
// Истечение фотоконтроля посреди смены сюда не приходит — там состояние
// известно клиенту, и цель ставится явно.
export function onlineBlockTargetFor(message: string): OnlineBlockTarget {
  const text = message.toLowerCase()

  // Раньше «парка»: сообщение про трансляцию тоже содержит слово «чате», но
  // ни одно из парковых слов — порядок важен только если формулировки сойдутся.
  if (text.includes('трансляц'))
    return 'live-location'

  if (text.includes('таксопарк') || text.includes('парк'))
    return 'park'

  if (text.includes('фотоконтрол'))
    return 'daily-check'

  return 'verification'
}
