import type { SupportSubject } from '@edtaxi/shared/types/support'

export * from '@edtaxi/shared/types/support'

// Темы, доступные водителю при создании обращения.
export const DRIVER_SUPPORT_SUBJECTS: SupportSubject[] = ['payment', 'trip', 'verification', 'account', 'other']
