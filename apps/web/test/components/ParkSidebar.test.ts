import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ParkSidebar from '~/components/park/ParkSidebar.vue'

// Роут подменяем целиком: сайдбару нужны только path (актив) и query (peek).
const mockRoute = { path: '/park', query: {} as Record<string, unknown> }

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

function mountSidebar() {
  return mount(ParkSidebar, {
    global: {
      plugins: [createPinia()],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

function activeLabels(wrapper: ReturnType<typeof mountSidebar>) {
  return wrapper.findAll('[aria-current="page"]').map(link => link.text())
}

describe('parkSidebar', () => {
  beforeEach(() => {
    mockRoute.path = '/park'
    mockRoute.query = {}
  })

  it('показывает все разделы кабинета', () => {
    const wrapper = mountSidebar()
    const text = wrapper.text()
    for (const label of ['Кабинет', 'Кошелёк', 'Акции', 'Заявки водителей', 'Чат с водителями'])
      expect(text).toContain(label)
  })

  it('подсвечивает «Кабинет» только на точном пути /park', () => {
    mockRoute.path = '/park'
    expect(activeLabels(mountSidebar())).toEqual(['Кабинет'])

    mockRoute.path = '/park/wallet'
    expect(activeLabels(mountSidebar())).toEqual(['Кошелёк'])
  })

  it('подсвечивает «Чат» и на вложенной чат-комнате', () => {
    mockRoute.path = '/park/chat/room-42'
    expect(activeLabels(mountSidebar())).toEqual(['Чат с водителями'])
  })

  it('в peek-режиме (?park_id=) оставляет только «Кабинет» и сохраняет query в ссылке', () => {
    mockRoute.query = { park_id: 'p-1' }
    const wrapper = mountSidebar()

    const text = wrapper.text()
    expect(text).toContain('Кабинет')
    for (const label of ['Кошелёк', 'Акции', 'Заявки водителей', 'Чат с водителями'])
      expect(text).not.toContain(label)

    // Ссылки навигации несут park_id, чтобы суперадмин не выпал из просмотра.
    const links = wrapper.findAllComponents(RouterLinkStub)
    const cabinetLink = links.find(link => link.text().includes('Кабинет'))
    expect(cabinetLink?.props('to')).toEqual({ path: '/park', query: { park_id: 'p-1' } })
  })

  it('шлёт navigate при клике по пункту (для закрытия мобильного меню)', async () => {
    const wrapper = mountSidebar()
    await wrapper.findComponent(RouterLinkStub).trigger('click')
    expect(wrapper.emitted('navigate')).toBeTruthy()
  })
})
