// Клиентская проверка казахстанского ИИН (12 цифр) — зеркалит серверную
// entity.ValidateIIN. Нужна тех.поддержке как быстрый бейдж рядом с фото
// документа: контрольная цифра почти наверняка не сойдётся у выдуманного или
// подрисованного («photoshop») номера. Это не сверка с гос.базой, а дешёвый
// офлайн-фильтр очевидных подделок.

export interface IinInfo {
  valid: boolean
  // Расшифровка (только при valid) — можно показать поддержке для доп. сверки.
  birthDate?: Date
  isMale?: boolean
}

const WEIGHTS_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const WEIGHTS_2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]

function weightedSum(digits: number[], weights: number[]): number {
  let sum = 0
  for (let i = 0; i < 11; i++)
    sum += digits[i] * weights[i]
  return sum % 11
}

export function validateIin(raw: null | string | undefined): IinInfo {
  const iin = (raw ?? '').trim()
  if (!/^\d{12}$/.test(iin))
    return { valid: false }

  const d = iin.split('').map(Number)

  // 7-я цифра — век + пол, допустимо 1..6.
  const centuryDigit = d[6]
  if (centuryDigit < 1 || centuryDigit > 6)
    return { valid: false }

  // Дата рождения ГГММДД + век из 7-й цифры; проверяем корректность.
  const yy = d[0] * 10 + d[1]
  const mm = d[2] * 10 + d[3]
  const dd = d[4] * 10 + d[5]
  const century = centuryDigit <= 2 ? 1800 : centuryDigit <= 4 ? 1900 : 2000
  const year = century + yy
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31)
    return { valid: false }
  const birthDate = new Date(Date.UTC(year, mm - 1, dd))
  if (
    birthDate.getUTCFullYear() !== year
    || birthDate.getUTCMonth() !== mm - 1
    || birthDate.getUTCDate() !== dd
  ) {
    return { valid: false }
  }

  // Контрольная сумма: первый проход, при результате 10 — второй.
  let check = weightedSum(d, WEIGHTS_1)
  if (check === 10) {
    check = weightedSum(d, WEIGHTS_2)
    if (check === 10)
      return { valid: false }
  }
  if (check !== d[11])
    return { valid: false }

  return { valid: true, birthDate, isMale: centuryDigit % 2 === 1 }
}
