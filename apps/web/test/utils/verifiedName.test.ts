import { describe, expect, it } from 'vitest'
import { splitDisplayName } from '~/utils/verifiedName'

describe('splitDisplayName', () => {
  it('разбивает «Имя Фамилия»', () => {
    expect(splitDisplayName('Ерлан Досов')).toEqual({ first: 'Ерлан', last: 'Досов' })
  })

  it('одно слово → только имя', () => {
    expect(splitDisplayName('Ерлан')).toEqual({ first: 'Ерлан', last: '' })
  })

  it('двойная фамилия целиком в last', () => {
    expect(splitDisplayName('Ерлан Досов Улы')).toEqual({ first: 'Ерлан', last: 'Досов Улы' })
  })

  it('@telegram → пусто (не имя)', () => {
    expect(splitDisplayName('@erlan')).toEqual({ first: '', last: '' })
  })

  it('телефон → пусто (не имя)', () => {
    expect(splitDisplayName('+7 701 234 56 78')).toEqual({ first: '', last: '' })
    expect(splitDisplayName('87012345678')).toEqual({ first: '', last: '' })
  })

  it('пусто/undefined → пусто', () => {
    expect(splitDisplayName('')).toEqual({ first: '', last: '' })
    expect(splitDisplayName(null)).toEqual({ first: '', last: '' })
    expect(splitDisplayName(undefined)).toEqual({ first: '', last: '' })
  })
})
