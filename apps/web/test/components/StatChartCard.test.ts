import type { StatBucket } from '~/utils/statsChart'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import StatChartCard from '~/components/charts/StatChartCard.vue'

// jsdom не считает layout — подменяем размер контейнера, чтобы SVG-геометрия
// чарта реально построилась и тест проверял отрисовку баров.
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useElementSize: () => ({ height: ref(176), width: ref(360) }),
  }
})

function makeBuckets(values: number[]): StatBucket[] {
  return values.map((value, index) => ({
    fullLabel: `${index + 1} июля`,
    hint: `подсказка ${index + 1}`,
    key: `2026-07-0${index + 1}`,
    label: String(index + 1),
    value,
  }))
}

function mountCard(buckets: StatBucket[], extraProps: Record<string, unknown> = {}) {
  return mount(StatChartCard, {
    props: {
      buckets,
      title: 'Заказы',
      ...extraProps,
    },
  })
}

describe('statChartCard', () => {
  it('рисует бары и по умолчанию выбирает последнюю корзину', () => {
    const wrapper = mountCard(makeBuckets([5, 10, 3]))

    // Бары — только у ненулевых корзин (path), выбрана последняя.
    expect(wrapper.findAll('svg path')).toHaveLength(3)
    expect(wrapper.text()).toContain('3 июля')
    expect(wrapper.text()).toContain('подсказка 3')
  })

  it('показывает readout выбранного бара после клавиатурной навигации', async () => {
    const wrapper = mountCard(makeBuckets([5, 10, 3]))

    await wrapper.find('[role="group"][tabindex="0"]').trigger('keydown.left')
    expect(wrapper.text()).toContain('2 июля')
    expect(wrapper.text()).toContain('10')
  })

  it('показывает пустое состояние на нулевой серии', () => {
    const wrapper = mountCard(makeBuckets([0, 0, 0]), { emptyText: 'Данных нет.' })

    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text()).toContain('Данных нет.')
  })

  it('показывает скелет при загрузке', () => {
    const wrapper = mountCard(makeBuckets([1]), { loading: true })

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('переключает режим через кнопки-опции', async () => {
    const wrapper = mountCard(makeBuckets([1, 2]), {
      'onUpdate:option': (value: string) => wrapper.setProps({ option: value }),
      'option': 'day',
      'options': [
        { label: 'Дни', value: 'day' },
        { label: 'Месяцы', value: 'month' },
      ],
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')

    await buttons[1]!.trigger('click')
    expect(wrapper.props('option')).toBe('month')
  })

  it('сбрасывает выбор на последнюю корзину при смене данных', async () => {
    const wrapper = mountCard(makeBuckets([5, 10, 3]))

    await wrapper.find('[role="group"][tabindex="0"]').trigger('keydown.left')
    expect(wrapper.text()).toContain('2 июля')

    await wrapper.setProps({ buckets: makeBuckets([7, 8]) })
    expect(wrapper.text()).toContain('2 июля')
    expect(wrapper.text()).toContain('подсказка 2')
  })
})
