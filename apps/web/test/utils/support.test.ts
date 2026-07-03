import type { SupportRoom } from '~/types/support'
import { describe, expect, it } from 'vitest'
import {
  canClaimRoom,
  isAssignedTo,
  participantIcon,
  participantLabel,
  participantProfileLink,
  paymentLabel,
  resolveSupportActionHint,
  roomStatusLabel,
  tripFare,
  tripStatusLabel,
} from '~/utils/support'

function room(partial: Partial<SupportRoom>): SupportRoom {
  return {
    agent_id: null,
    created_at: '',
    id: 'r1',
    participant_type: 'passenger',
    passenger_id: 'u1',
    status: 'open',
    updated_at: '',
    ...partial,
  }
}

describe('participantIcon', () => {
  it('водитель → руль, иначе → аккаунт', () => {
    expect(participantIcon('driver')).toBe('i-mdi-steering')
    expect(participantIcon('passenger')).toBe('i-mdi-account')
    expect(participantIcon(undefined)).toBe('i-mdi-account')
  })
})

describe('participantLabel', () => {
  it('единственное число', () => {
    expect(participantLabel('driver')).toBe('Водитель')
    expect(participantLabel('passenger')).toBe('Пассажир')
  })
})

describe('participantProfileLink', () => {
  it('водитель → /drivers/:id, пассажир → /passengers/:id', () => {
    expect(participantProfileLink(room({ participant_type: 'driver', passenger_id: 'd9' }))).toBe('/drivers/d9')
    expect(participantProfileLink(room({ participant_type: 'passenger', passenger_id: 'p9' }))).toBe('/passengers/p9')
  })

  it('пустая строка без passenger_id или комнаты', () => {
    expect(participantProfileLink(room({ passenger_id: '' }))).toBe('')
    expect(participantProfileLink(null)).toBe('')
  })
})

describe('roomStatusLabel', () => {
  it('маппит статусы, open по умолчанию', () => {
    expect(roomStatusLabel('open')).toBe('Открыто')
    expect(roomStatusLabel('pending_close')).toBe('На закрытии')
    expect(roomStatusLabel('closed')).toBe('Закрыто')
    expect(roomStatusLabel(undefined)).toBe('Открыто')
  })
})

describe('isAssignedTo', () => {
  it('true только когда agent_id совпадает с userId', () => {
    expect(isAssignedTo(room({ agent_id: 'me' }), 'me')).toBe(true)
    expect(isAssignedTo(room({ agent_id: 'other' }), 'me')).toBe(false)
    expect(isAssignedTo(room({ agent_id: null }), 'me')).toBe(false)
    expect(isAssignedTo(null, 'me')).toBe(false)
  })
})

describe('canClaimRoom', () => {
  it('закрытое нельзя взять', () => {
    expect(canClaimRoom(room({ status: 'closed', agent_id: null }), 'me')).toBe(false)
  })

  it('свободное открытое можно взять', () => {
    expect(canClaimRoom(room({ status: 'open', agent_id: null }), 'me')).toBe(true)
  })

  it('своё — повторный claim безопасен', () => {
    expect(canClaimRoom(room({ status: 'open', agent_id: 'me' }), 'me')).toBe(true)
  })

  it('чужое взять нельзя', () => {
    expect(canClaimRoom(room({ status: 'open', agent_id: 'other' }), 'me')).toBe(false)
  })

  it('нет комнаты — нельзя', () => {
    expect(canClaimRoom(null, 'me')).toBe(false)
  })
})

describe('tripStatusLabel', () => {
  it('известные маппятся, неизвестные — как есть', () => {
    expect(tripStatusLabel('in_progress')).toBe('В пути')
    expect(tripStatusLabel('unknown_x')).toBe('unknown_x')
  })
})

describe('paymentLabel', () => {
  it('известные, неизвестные и отсутствующие', () => {
    expect(paymentLabel('kaspi')).toBe('Kaspi')
    expect(paymentLabel('crypto')).toBe('crypto')
    expect(paymentLabel(null)).toBe('Оплата не указана')
    expect(paymentLabel(undefined)).toBe('Оплата не указана')
  })
})

describe('tripFare', () => {
  it('final_fare приоритетнее estimated_fare', () => {
    expect(tripFare({ estimated_fare: 500, final_fare: 800 }).replace(/\s+/g, ' ')).toBe('800 ₸')
    expect(tripFare({ estimated_fare: 500, final_fare: null }).replace(/\s+/g, ' ')).toBe('500 ₸')
  })
})

describe('resolveSupportActionHint', () => {
  it('closed побеждает остальные состояния', () => {
    const hint = resolveSupportActionHint({ isClosed: true, isPendingClose: true, isAssigned: true, hasAgent: true })
    expect(hint.title).toBe('Обращение закрыто')
  })

  it('pending_close — ждём клиента', () => {
    const hint = resolveSupportActionHint({ isClosed: false, isPendingClose: true, isAssigned: false, hasAgent: true })
    expect(hint.title).toBe('Ожидаем подтверждение клиента')
  })

  it('не назначено на нас, но есть агент — чужой чат', () => {
    const hint = resolveSupportActionHint({ isClosed: false, isPendingClose: false, isAssigned: false, hasAgent: true })
    expect(hint.title).toBe('Чат ведёт другой агент')
  })

  it('свободно — предложить взять в работу', () => {
    const hint = resolveSupportActionHint({ isClosed: false, isPendingClose: false, isAssigned: false, hasAgent: false })
    expect(hint.title).toBe('Возьмите обращение в работу')
  })

  it('назначено на нас — вы ведёте чат', () => {
    const hint = resolveSupportActionHint({ isClosed: false, isPendingClose: false, isAssigned: true, hasAgent: true })
    expect(hint.title).toBe('Вы ведёте этот чат')
  })
})
