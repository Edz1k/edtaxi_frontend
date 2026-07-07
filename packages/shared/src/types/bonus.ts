// Бонусный счёт платформы (внутренние баллы, НЕ тенге и не кошелёк):
// реферальный код «пригласи друга», правила начислений и акции.
export interface BonusOverview {
  balance: number
  code_redeemed: boolean
  invited_count: number
  invitee_reward: number
  invites_left: number
  milestone_bonus: number
  milestone_every: number
  owner_reward: number
  referral_code: string
  trip_reward: number
}

// Акция «N заказов до даты — X бонусов» с прогрессом вызывающего.
export interface BonusPromotion {
  description: string
  ends_at: string
  id: string
  image_url?: string | null
  // joined — только у парковых акций (opt-in): false = кнопка «Участвовать»
  // ещё не нажата, прогресс не считается; отсутствует у платформенных.
  joined?: boolean
  message?: string
  my_trips: number
  reward: number
  scope: string
  starts_at: string
  target_trips: number
  title: string
}

export interface BonusPromotionsResponse {
  promotions: BonusPromotion[]
}

// Ответ погашения реферального кода: суммы и имя пригласившего — для
// приветственного окна «вы присоединились по ссылке друга N».
export interface RedeemReferralResponse {
  invitee_reward?: number
  inviter_name?: string
  message: string
  owner_reward?: number
}
