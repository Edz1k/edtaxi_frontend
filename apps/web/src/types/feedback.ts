export type FeedbackStatus = 'declined' | 'implemented' | 'new'

export interface FeedbackItem {
  id: string
  role: 'driver' | 'passenger'
  message: string
  status: FeedbackStatus
  reward_bonus: number
  reward_sent: boolean
  reviewed_at: null | string
  created_at: string
  user_name: string
  phone: string
}

export interface FeedbackListResponse {
  feedback: FeedbackItem[]
  limit: number
  offset: number
  total: number
}
