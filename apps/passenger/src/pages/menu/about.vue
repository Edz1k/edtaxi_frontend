<script setup lang="ts">
import { TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'О приложении',
  },
})

useHead({
  title: 'О приложении | EdTaxi',
})

const advantages = [
  {
    icon: 'i-mdi-cash-check',
    title: 'Честная цена без сюрпризов',
    text: 'Стоимость видна до заказа. Комиссия сервиса ниже, чем у крупных агрегаторов, — водители зарабатывают больше и приезжают охотнее.',
  },
  {
    icon: 'i-mdi-shield-check',
    title: 'Проверенные водители',
    text: 'Документы, автомобиль и фото каждого водителя проверяются до допуска к заказам. Подробнее — в разделе «Безопасность».',
  },
  {
    icon: 'i-mdi-star-four-points',
    title: 'Бонусы за каждую поездку',
    text: 'Катайтесь и копите бонусы, приглашайте друзей по своему коду и участвуйте в акциях — всё в разделе «Бонусы».',
  },
  {
    icon: 'i-mdi-headset',
    title: 'Живая поддержка в приложении',
    text: 'Не бот по скриптам, а реальные люди: напишите в чат поддержки — ответим и решим вопрос.',
  },
  {
    icon: 'i-mdi-map-marker-star',
    title: 'Казахстанский сервис',
    text: 'EdTaxi создан в Казахстане для Казахстана: мы знаем свои города, работаем в тенге, и деньги остаются в стране.',
  },
]
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Бренд -->
      <section class="border border-main-500/20 rounded-3xl bg-white/6 p-6 text-center">
        <span class="mx-auto h-16 w-16 flex items-center justify-center rounded-3xl bg-main-500/15 text-main-200">
          <span class="i-mdi-taxi text-9" />
        </span>
        <h1 class="mt-3 text-3xl font-950">
          EdTaxi
        </h1>
        <p class="mt-1 text-sm text-slate-400 font-700">
          Казахстанское такси — быстро, честно, безопасно
        </p>
      </section>

      <!-- Почему мы -->
      <section class="mt-6">
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Почему EdTaxi
        </h2>
        <div class="mt-3 space-y-3">
          <article v-for="item in advantages" :key="item.icon" class="rounded-3xl bg-white/5 p-4">
            <div class="flex items-center gap-3">
              <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
                <span :class="item.icon" class="text-5.5" />
              </span>
              <h3 class="min-w-0 text-base font-950">
                {{ item.title }}
              </h3>
            </div>
            <p class="mt-2 text-sm text-slate-400 leading-5">
              {{ item.text }}
            </p>
          </article>
        </div>
      </section>

      <!-- Тарифы -->
      <section class="mt-6">
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Тарифы
        </h2>
        <div class="mt-3 rounded-3xl bg-white/5 p-2">
          <div
            v-for="category in TARIFF_ORDER"
            :key="category"
            class="flex items-center gap-4 rounded-2xl px-3 py-3"
          >
            <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
              <span :class="TARIFF_META[category].icon" class="text-6" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-900">
                {{ TARIFF_META[category].label }}
              </span>
              <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
                {{ TARIFF_META[category].caption }}
              </span>
            </span>
          </div>
        </div>
        <p class="mt-2 text-xs text-slate-500 leading-4">
          Точная стоимость рассчитывается по маршруту и показывается до подтверждения заказа.
        </p>
      </section>

      <p class="mt-8 text-center text-xs text-slate-600 font-700">
        Сделано в Казахстане 🇰🇿
      </p>
    </section>
  </main>
</template>
