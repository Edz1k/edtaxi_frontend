import { describe, expect, it } from 'vitest'
import { ApiError } from '~/api/client'
import { carRequestSubmitError } from '~/utils/carRequestErrors'

describe('carRequestSubmitError', () => {
  it('409 «уже в каталоге» → подсказка проверить написание', () => {
    const err = new ApiError(409, 'this model is already in the catalog', null)
    expect(carRequestSubmitError(err)).toMatch(/каталоге/i)
  })

  it('409 дубль pending-заявки → «уже на рассмотрении»', () => {
    const err = new ApiError(409, 'a pending request for this model already exists', null)
    expect(carRequestSubmitError(err)).toMatch(/рассмотрении/i)
  })

  it('400 → проверьте поля', () => {
    const err = new ApiError(400, 'make, model and a valid year are required', null)
    expect(carRequestSubmitError(err)).toMatch(/марку/i)
  })

  it('404 (старый бэк без роута) → фолбэк «обратитесь в поддержку»', () => {
    const err = new ApiError(404, 'Not Found', null)
    expect(carRequestSubmitError(err)).toMatch(/поддержку/i)
  })

  it('не-ApiError (сеть) → общий фолбэк', () => {
    expect(carRequestSubmitError(new Error('network'))).toMatch(/поддержку/i)
  })
})
