<script setup lang="ts">
import { TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.about',
  },
})

const { t } = useI18n()

useHead({
  title: () => `${t('titles.about')} | Telegram Taxi`,
})

const ADV_KEYS = ['price', 'drivers', 'bonus', 'support', 'local'] as const
const ADV_ICONS: Record<(typeof ADV_KEYS)[number], string> = {
  bonus: 'i-mdi-star-four-points',
  drivers: 'i-mdi-shield-check',
  local: 'i-mdi-map-marker-star',
  price: 'i-mdi-cash-check',
  support: 'i-mdi-headset',
}
const advantages = computed(() => ADV_KEYS.map(key => ({
  icon: ADV_ICONS[key],
  text: t(`about.adv.${key}Text`),
  title: t(`about.adv.${key}Title`),
})))
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Бренд -->
      <section class="border border-main-500/20 rounded-3xl app-card p-6 text-center">
        <span class="mx-auto h-16 w-16 flex items-center justify-center rounded-3xl bg-main-500/15 text-main-200 light:text-main-700">
          <span class="i-mdi-taxi text-9" />
        </span>
        <h1 class="mt-3 text-3xl font-950">
          Telegram Taxi
        </h1>
        <p class="mt-1 text-sm app-muted font-700">
          {{ t('about.tagline') }}
        </p>
      </section>

      <!-- Почему мы -->
      <section class="mt-6">
        <h2 class="text-xs app-muted font-800 uppercase">
          {{ t('about.why') }}
        </h2>
        <div class="mt-3 space-y-3">
          <article v-for="item in advantages" :key="item.icon" class="rounded-3xl app-card p-4">
            <div class="flex items-center gap-3">
              <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
                <span :class="item.icon" class="text-5.5" />
              </span>
              <h3 class="min-w-0 text-base font-950">
                {{ item.title }}
              </h3>
            </div>
            <p class="mt-2 text-sm app-muted leading-5">
              {{ item.text }}
            </p>
          </article>
        </div>
      </section>

      <!-- Тарифы -->
      <section class="mt-6">
        <h2 class="text-xs app-muted font-800 uppercase">
          {{ t('about.tariffs') }}
        </h2>
        <div class="mt-3 rounded-3xl app-card p-2">
          <div
            v-for="category in TARIFF_ORDER"
            :key="category"
            class="flex items-center gap-4 rounded-2xl px-3 py-3"
          >
            <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl app-chip text-main-200 light:text-main-700">
              <span :class="TARIFF_META[category].icon" class="text-6" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-900">
                {{ TARIFF_META[category].label }}
              </span>
              <span class="mt-0.5 block truncate text-xs app-muted font-600">
                {{ TARIFF_META[category].caption }}
              </span>
            </span>
          </div>
        </div>
        <p class="mt-2 text-xs app-faint leading-4">
          {{ t('about.tariffsNote') }}
        </p>
      </section>

      <p class="mt-8 text-center text-xs text-slate-600 font-700">
        {{ t('about.madeIn') }}
      </p>
    </section>
  </main>
</template>
