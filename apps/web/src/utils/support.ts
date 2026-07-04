import type { SupportParticipantType, SupportRoom, SupportRoomStatus, SupportRoomTrip } from '~/types/support'
import { formatRevenue } from '~/utils/format'

// Иконка участника обращения — общая для списка и карточки чата.
export function participantIcon(type: SupportParticipantType | undefined): string {
  return type === 'driver' ? 'i-mdi-steering' : 'i-mdi-account'
}

// Ярлык участника в единственном числе — для карточки чата ("Водитель"/"Пассажир").
// В списке обращений используется отдельный ярлык-категория во множественном числе.
export function participantLabel(type: SupportParticipantType | undefined): string {
  return type === 'driver' ? 'Водитель' : 'Пассажир'
}

// Ссылка в кабинет участника: водитель → /drivers/:id, пассажир → /passengers/:id.
// passenger_id здесь — это user_id участника.
export function participantProfileLink(room: Pick<SupportRoom, 'participant_type' | 'passenger_id'> | null | undefined): string {
  if (!room?.passenger_id)
    return ''
  return room.participant_type === 'driver'
    ? `/drivers/${room.passenger_id}`
    : `/passengers/${room.passenger_id}`
}

// Ярлык статуса обращения.
export function roomStatusLabel(status: SupportRoomStatus | undefined): string {
  if (status === 'pending_close')
    return 'На закрытии'
  return status === 'closed' ? 'Закрыто' : 'Открыто'
}

// Обращение закреплено за текущим агентом.
export function isAssignedTo(room: SupportRoom | null | undefined, userId: string | undefined): boolean {
  return !!room && room.agent_id === userId
}

// Можно взять в работу открытое обращение, которое ещё не закреплено
// ни за кем (или уже за нами — повторный claim безопасен).
export function canClaimRoom(room: SupportRoom | null | undefined, userId: string | undefined): boolean {
  if (!room || room.status === 'closed')
    return false
  return !room.agent_id || room.agent_id === userId
}

export const TRIP_STATUS_LABELS: Record<string, string> = {
  searching: 'Поиск',
  driver_assigned: 'Водитель назначен',
  driver_arriving: 'Водитель в пути',
  in_progress: 'В пути',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  wallet: 'Кошелёк',
  kaspi: 'Kaspi',
}

export function tripStatusLabel(status: string): string {
  return TRIP_STATUS_LABELS[status] ?? status
}

export function paymentLabel(method: null | string | undefined): string {
  return PAYMENT_LABELS[method ?? ''] ?? method ?? 'Оплата не указана'
}

export function tripFare(trip: Pick<SupportRoomTrip, 'estimated_fare' | 'final_fare'>): string {
  return formatRevenue(trip.final_fare ?? trip.estimated_fare)
}

export interface SupportActionHint {
  icon: string
  title: string
  text: string
  tone: string
}

export interface SupportRoomState {
  isClosed: boolean
  isPendingClose: boolean
  isAssigned: boolean
  hasAgent: boolean
}

// Подсказка-действие для агента: что можно/нужно сделать с обращением
// в его текущем состоянии. Порядок веток важен — от терминальных к активным.
export function resolveSupportActionHint(state: SupportRoomState): SupportActionHint {
  if (state.isClosed) {
    return {
      icon: 'i-mdi-check-circle-outline',
      title: 'Обращение закрыто',
      text: 'Диалог доступен только для просмотра.',
      tone: 'border-white/10 bg-white/6 text-white/60',
    }
  }
  if (state.isPendingClose) {
    return {
      icon: 'i-mdi-timer-sand',
      title: 'Ожидаем подтверждение клиента',
      text: 'Клиент должен ответить “да”, чтобы закрыть обращение, или написать новое сообщение, если проблема осталась.',
      tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    }
  }
  if (!state.isAssigned && state.hasAgent) {
    return {
      icon: 'i-mdi-account-lock-outline',
      title: 'Чат ведёт другой агент',
      text: 'Ответы и закрытие доступны только назначенному оператору.',
      tone: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    }
  }
  if (!state.isAssigned) {
    return {
      icon: 'i-mdi-hand-back-right-outline',
      title: 'Возьмите обращение в работу',
      text: 'После этого можно отвечать клиенту и нажать “Решено”.',
      tone: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    }
  }
  return {
    icon: 'i-mdi-message-reply-text-outline',
    title: 'Вы ведёте этот чат',
    text: 'Ответьте клиенту. Когда проблема решена, нажмите “Решено” и дождитесь подтверждения.',
    tone: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  }
}
