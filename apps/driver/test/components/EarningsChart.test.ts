import type { Trip } from '~/types/trips'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import EarningsChart from '~/components/driver/EarningsChart.vue'

// jsdom не считает layout — подменяем размер контейнера, чтобы SVG-геометрия
// чарта реально построилась и тест проверял отрисовку баров.
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useElementSize: () => ({ height: ref(176), width: ref(360) }),
  }
})

let tripSeq = 0

function makeTrip(overrides: Partial<Trip>): Trip {
  tripSeq += 1
  return {
    category: 'economy',
    distance_km: 5,
    dropoff_address: 'B',
    dropoff_lat: 0,
    dropoff_lng: 0,
    duration_min: 10,
    estimated_fare: 900,
    final_fare: 1000,
    id: `trip-${tripSeq}`,
    pickup_address: 'A',
    pickup_lat: 0,
    pickup_lng: 0,
    status: 'completed',
    surge_multiplier: 1,
    ...overrides,
  }
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

async function mountChart(trips: Trip[], props: Partial<{ loading: boolean, truncated: boolean }> = {}) {
  const wrapper = mount(EarningsChart, { props: { trips, ...props } })
  // Кнопка «Дни»: localStorage-период разделяется между тестами файла,
  // поэтому каждый тест стартует с известного состояния.
  await wrapper.findAll('button').find(button => button.text() === 'Дни')!.trigger('click')
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
})

describe('earningsChart', () => {
  it('показывает пустое состояние без завершённых поездок', () => {
    const wrapper = mount(EarningsChart, { props: { trips: [] } })

    expect(wrapper.text()).toContain('Пока нет завершённых поездок')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('показывает скелетон при первой загрузке', () => {
    const wrapper = mount(EarningsChart, { props: { loading: true, trips: [] } })

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('рисует бары и readout последнего дня', async () => {
    const wrapper = await mountChart([
      makeTrip({ completed_at: daysAgo(0), final_fare: 1500 }),
      makeTrip({ completed_at: daysAgo(0), final_fare: 500 }),
      makeTrip({ completed_at: daysAgo(1), final_fare: 700 }),
    ])

    // Два дня с поездками → два бара
    expect(wrapper.findAll('svg path')).toHaveLength(2)
    // Readout по умолчанию — сегодняшняя корзина
    expect(wrapper.text()).toContain('2 поездки')
    // Таблица-двойник доступна скринридерам
    expect(wrapper.findAll('tbody tr')).toHaveLength(14)
  })

  it('переключает периоды и двигает выбор стрелками', async () => {
    const wrapper = await mountChart([
      makeTrip({ completed_at: daysAgo(0), final_fare: 1500 }),
      makeTrip({ completed_at: daysAgo(1), final_fare: 700 }),
    ])

    await wrapper.find('[role="group"][tabindex="0"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.text()).toContain('1 поездка')

    const yearButton = wrapper.findAll('button').find(button => button.text() === 'Годы')!
    await yearButton.trigger('click')
    expect(yearButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('2 поездки')
  })

  it('упоминает усечение истории', async () => {
    const wrapper = await mountChart([makeTrip({ completed_at: daysAgo(0) })], { truncated: true })

    expect(wrapper.text()).toContain('Учтены последние 500 поездок')
  })
})
