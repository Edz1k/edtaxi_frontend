import type { ParkDriver } from '~/types/park'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ParkDriversSection from '~/components/park/ParkDriversSection.vue'

function makeDriver(overrides: Partial<ParkDriver> = {}): ParkDriver {
  return {
    id: 'drv-1',
    is_online: true,
    name: 'Айдос',
    phone: '+77009876543',
    rating: 4.8,
    total_trips: 120,
    user_id: 'user-9',
    ...overrides,
  }
}

function mountSection(props: Partial<InstanceType<typeof ParkDriversSection>['$props']> = {}) {
  return mount(ParkDriversSection, {
    props: {
      drivers: [makeDriver()],
      isPeeking: false,
      isMutating: false,
      ...props,
    },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('parkDriversSection', () => {
  it('показывает пустое состояние без водителей', () => {
    const wrapper = mountSection({ drivers: [] })
    expect(wrapper.text()).toContain('Водителей нет.')
  })

  it('рисует водителя со ссылкой на его кабинет', () => {
    const wrapper = mountSection()
    expect(wrapper.text()).toContain('Айдос')
    expect(wrapper.text()).toContain('Онлайн')
    expect(wrapper.text()).toContain('4.8 · 120')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/drivers/user-9')
  })

  it('шлёт remove с id водителя', async () => {
    const wrapper = mountSection()
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['drv-1']])
  })

  it('в peek-режиме кнопки удаления нет', () => {
    const wrapper = mountSection({ isPeeking: true })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
