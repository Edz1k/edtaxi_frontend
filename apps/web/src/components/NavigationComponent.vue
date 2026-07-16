<script setup lang="ts">
import type { Locale } from 'vue-i18n'
import { loadLanguageAsync } from '~/modules/i18n'

const { t, locale } = useI18n()
const landingLocales = ['kk', 'ru', 'en'] as const

function switchLocale(nextLocale: Locale) {
  void loadLanguageAsync(nextLocale)
}

const navItems = computed(() => [
  { label: t('nav.home'), id: 'hero', widthClass: 'w-18' },
  { label: t('nav.platform'), id: 'platform', widthClass: 'w-22' },
  { label: t('nav.apps'), id: 'apps', widthClass: 'w-24' },
  { label: t('nav.token'), id: 'token', widthClass: 'w-16' },
  { label: t('nav.fleets'), id: 'fleets', widthClass: 'w-34' },
  { label: t('nav.investment'), id: 'investment', widthClass: 'w-25' },
  { label: t('nav.roadmap'), id: 'roadmap', widthClass: 'w-23' },
  { label: t('nav.contact'), id: 'contact', widthClass: 'w-22' },
])
</script>

<template>
  <header class="fixed left-0 right-0 top-0 z-50 px-3 py-3 md:px-4 md:py-4">
    <div class="mx-auto max-w-1280px flex items-center justify-between border border-white/15 rounded-full bg-#06142f/75 px-3 py-3 shadow-xl backdrop-blur-xl md:px-5 sm:px-4">
      <a href="#hero" class="min-w-0 flex shrink items-center gap-2 sm:w-46 sm:shrink-0 sm:gap-3">
        <div class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-cyan-300 text-#06142f">
          <div class="i-mdi:taxi text-xl" />
        </div>

        <div class="min-w-0 text-left">
          <p class="truncate text-sm font-900 leading-4 md:text-base">
            {{ t('brand.name') }}
          </p>
          <p class="truncate text-xs text-white/50">
            {{ t('brand.subtitle') }}
          </p>
        </div>
      </a>

      <nav class="hidden flex-1 items-center justify-center gap-1 xl:flex">
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="`#${item.id}`"
          class="whitespace-nowrap rounded-full px-2 py-2 text-center text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          :class="item.widthClass"
        >
          {{ item.label }}
        </a>
      </nav>

      <div class="flex shrink-0 items-center justify-end gap-2 sm:w-54">
        <div class="flex border border-white/10 rounded-full bg-white/8 p-1">
          <button
            v-for="item in landingLocales"
            :key="item"
            type="button"
            class="w-9 rounded-full py-1.5 text-center text-xs font-900 transition"
            :class="locale === item ? 'text-#06142f bg-cyan-300' : 'text-white/60 hover:text-white'"
            @click="switchLocale(item)"
          >
            {{ item.toUpperCase() }}
          </button>
        </div>

        <a
          href="#contact"
          :aria-label="t('nav.cta')"
          class="h-10 w-10 inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-300 text-center text-sm text-#06142f font-900 shadow-cyan-400/20 shadow-lg transition sm:h-auto sm:min-w-30 sm:w-auto hover:bg-cyan-200 md:px-5 sm:px-4 sm:py-2"
        >
          <span class="i-mdi-email-outline sm:hidden" />
          <span class="hidden sm:inline">{{ t('nav.cta') }}</span>
        </a>
      </div>
    </div>
  </header>
</template>
