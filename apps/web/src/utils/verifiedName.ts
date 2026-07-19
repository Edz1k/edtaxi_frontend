// Разбор driver_name на имя/фамилию для предзаполнения инпутов «имя с
// удостоверения» (TODO п.27). driver_name на бэке — participantDisplayName:
// «Имя Фамилия», либо «@telegram», либо телефон. Технические формы (@ник,
// телефон) в инпуты имени не тащим — возвращаем пустое, саппорт введёт вручную.
export function splitDisplayName(name: null | string | undefined): { first: string, last: string } {
  const trimmed = (name ?? '').trim()
  if (!trimmed)
    return { first: '', last: '' }
  // @telegram-username или телефон (+7…, цифры/скобки/дефисы) — не имя.
  if (trimmed.startsWith('@') || /^[+\d][\d\s()-]*$/.test(trimmed))
    return { first: '', last: '' }

  const parts = trimmed.split(/\s+/)
  const first = parts.shift() ?? ''
  return { first, last: parts.join(' ') }
}
