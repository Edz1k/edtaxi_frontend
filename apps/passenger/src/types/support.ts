import type { SupportSubject } from '@edtaxi/shared/types/support'

export * from '@edtaxi/shared/types/support'

// Темы, доступные пассажиру при создании обращения (верификация — водительская).
export const PASSENGER_SUPPORT_SUBJECTS: SupportSubject[] = ['payment', 'trip', 'account', 'other']
