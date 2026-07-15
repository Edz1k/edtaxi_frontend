import type { ParkChangeRequest, TaxiPark } from '~/types/park'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ParkProfileCard from '~/components/park/ParkProfileCard.vue'

function makePark(overrides: Partial<TaxiPark> = {}): TaxiPark {
  return {
    bin: '123456789012',
    commission_rate: 0.015,
    created_at: '2026-07-01T00:00:00Z',
    description: 'Парк у вокзала',
    id: 'park-1',
    is_active: true,
    is_platform: false,
    is_verified: true,
    name: 'Быстрый парк',
    owner_id: 'user-1',
    phone: '+77001234567',
    rejection_reason: null,
    status: 'approved',
    ...overrides,
  }
}

function makeChange(overrides: Partial<ParkChangeRequest> = {}): ParkChangeRequest {
  return {
    id: 'req-1',
    park_id: 'park-1',
    requested_bin: '999999999999',
    requested_commission_rate: 0.03,
    status: 'pending',
    created_at: '2026-07-10T00:00:00Z',
    ...overrides,
  }
}

function mountCard(props: Partial<InstanceType<typeof ParkProfileCard>['$props']> = {}) {
  return mount(ParkProfileCard, {
    props: {
      park: makePark(),
      pendingChange: null,
      isPeeking: false,
      ...props,
    },
  })
}

describe('parkProfileCard', () => {
  it('показывает реквизиты и статус парка', () => {
    const wrapper = mountCard()
    const text = wrapper.text()
    expect(text).toContain('Быстрый парк')
    expect(text).toContain('123456789012')
    expect(text).toContain('+77001234567')
    expect(text).toContain('1.5%')
    expect(text).toContain('Проверен')
  })

  it('шлёт open-change по кнопке заявки', async () => {
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('openChange')).toBeTruthy()
  })

  it('при pending-заявке показывает сводку изменений вместо кнопки', () => {
    const wrapper = mountCard({ pendingChange: makeChange() })
    expect(wrapper.text()).toContain('БИН → 999999999999 · Комиссия → 3%')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('в peek-режиме скрывает блок заявки целиком', () => {
    const wrapper = mountCard({ isPeeking: true })
    expect(wrapper.text()).not.toContain('Изменить БИН и комиссию')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('для отклонённого парка показывает причину', () => {
    const wrapper = mountCard({ park: makePark({ status: 'rejected', rejection_reason: 'Неверный БИН' }) })
    expect(wrapper.text()).toContain('Отклонён')
    expect(wrapper.text()).toContain('Неверный БИН')
  })
})
