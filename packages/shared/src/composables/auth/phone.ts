export const KZ_PHONE_LENGTH = 10
const NON_DIGIT_RE = /\D/g

export function normalizeKazakhstanPhone(value: string) {
  let digits = value.replace(NON_DIGIT_RE, '')

  if (digits.length > KZ_PHONE_LENGTH && ['7', '8'].includes(digits[0] ?? ''))
    digits = digits.slice(1)

  return digits.slice(0, KZ_PHONE_LENGTH)
}

export function formatKazakhstanPhone(value: string) {
  const digits = normalizeKazakhstanPhone(value)
  const operator = digits.slice(0, 3)
  const first = digits.slice(3, 6)
  const second = digits.slice(6, 8)
  const third = digits.slice(8, 10)

  let formatted = ''
  if (operator)
    formatted += `(${operator}`
  if (operator.length === 3)
    formatted += ')'
  if (first)
    formatted += ` ${first}`
  if (second)
    formatted += `-${second}`
  if (third)
    formatted += `-${third}`

  return formatted
}

export function toKazakhstanE164(value: string) {
  return `+7${normalizeKazakhstanPhone(value)}`
}

export function isKazakhstanPhoneComplete(value: string) {
  return normalizeKazakhstanPhone(value).length === KZ_PHONE_LENGTH
}
