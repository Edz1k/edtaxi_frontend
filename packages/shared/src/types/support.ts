export type SupportParticipantType = 'driver' | 'passenger'
export type SupportRoomStatus = 'closed' | 'open' | 'pending_close'

// Темы обращения (категории). Значения синхронизированы с бэкендом
// (entity.AllowedChatSubjects).
export type SupportSubject = 'account' | 'other' | 'payment' | 'trip' | 'verification'

export const SUPPORT_SUBJECTS: SupportSubject[] = ['payment', 'trip', 'account', 'verification', 'other']

/** Подписи тем живут в словарях (`supportSubject.*`) — здесь только валидация ключа. */
export function isSupportSubject(subject?: null | string): subject is SupportSubject {
  return Boolean(subject) && SUPPORT_SUBJECTS.includes(subject as SupportSubject)
}

export interface SupportRoom {
  agent_id: null | string
  // Имя назначенного сотрудника — показываем "Техподдержка <имя>".
  agent_name?: null | string
  created_at: string
  id: string
  participant_type: SupportParticipantType
  passenger_id: string
  status: SupportRoomStatus
  subject?: null | string
  updated_at: string
}

export interface SupportMessage {
  content: string
  id: string
  image_url?: null | string
  sender_id: string
  sent_at: string
}

export interface SupportMessagesResponse {
  messages: SupportMessage[]
  room_id: string
}

export interface SupportSendMessagePayload {
  content: string
}

export interface OpenSupportRoomPayload {
  participant_type?: SupportParticipantType
  subject?: SupportSubject
}

export interface SupportListRoomsParams {
  limit?: number
  offset?: number
  participant_type?: SupportParticipantType
  status?: SupportRoomStatus | ''
}

export interface SupportListRoomsResponse {
  rooms: SupportRoom[]
}
