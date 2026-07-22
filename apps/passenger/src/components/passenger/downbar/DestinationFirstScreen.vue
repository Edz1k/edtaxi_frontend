<script setup lang="ts">
import type { BonusPromotion } from '@edtaxi/shared/types/bonus'
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { MapPickerMode } from '@edtaxi/shared/types/map'
import type { QuickDestination } from '~/components/passenger/downbar/AddressForm.vue'
import { getMyPromotions } from '@edtaxi/shared/api/bonus'
import { mediaUrl } from '~/api/client'

defineProps<{
  quickDestinations: QuickDestination[]
}>()

const emit = defineEmits<{
  // «Куда едем?» — раскрыть полный поиск адреса.
  expand: []
  // Выбор точки на карте — полезный старт, пока истории поездок нет.
  pickFromMap: [mode: MapPickerMode, stopIndex?: number]
  // Быстрый адрес — сразу выбрать назначение (дальше уходим к тарифам).
  selectDestination: [place: GeoPlace]
}>()

// Действующие акции — компактной лентой на главном экране; тап ведёт на /bonus.
// Ошибку глотаем: без акций лента просто не показывается.
const promotions = ref<BonusPromotion[]>([])

onMounted(() => {
  getMyPromotions('passenger')
    .then((response) => {
      promotions.value = response.promotions ?? []
    })
    .catch(() => {})
})
</script>

<template>
  <div class="space-y-3">
    <!-- Заголовок -->
    <div class="flex items-center gap-2.5 px-1">
      <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-[0.9rem] bg-main-500 text-#06142f">
        <span class="i-mdi-taxi text-5.5" aria-hidden="true" />
      </span>
      <h2 class="text-xl font-950">
        Такси
      </h2>
    </div>

    <!-- Куда едем? — вход в поиск -->
    <button
      class="h-13 w-full flex items-center justify-between gap-3 rounded-[1.35rem] app-chip px-4 text-left transition active:scale-[0.99] hover:bg-white/12"
      type="button"
      @click="emit('expand')"
    >
      <span class="flex items-center gap-2.5">
        <span class="i-mdi-magnify shrink-0 text-5 app-accent" aria-hidden="true" />
        <span class="text-base font-900">Куда едем?</span>
      </span>
      <span class="i-mdi-chevron-right shrink-0 text-5 text-white/40" aria-hidden="true" />
    </button>

    <!-- Акции: горизонтальная лента, тап — все акции и бонусы -->
    <div
      v-if="promotions.length"
      class="[scrollbar-width:none] flex gap-2 overflow-x-auto pb-1 -mx-1 [&::-webkit-scrollbar]:hidden"
    >
      <RouterLink
        v-for="promo in promotions"
        :key="promo.id"
        class="relative h-20 w-60 shrink-0 overflow-hidden border app-border rounded-[1.35rem] transition first:ml-1 last:mr-1 active:scale-[0.98]"
        to="/bonus"
      >
        <img
          v-if="promo.image_url"
          alt=""
          class="absolute inset-0 h-full w-full object-cover"
          :src="mediaUrl(promo.image_url)"
        >
        <div
          class="absolute inset-0"
          :class="promo.image_url
            ? 'bg-gradient-to-r from-secondary-950/90 via-secondary-950/55 to-transparent'
            : 'bg-gradient-to-br from-main-500/25 via-secondary-900 to-secondary-950'"
        />
        <div class="relative z-10 h-full flex flex-col justify-center px-3.5">
          <p class="line-clamp-1 text-sm font-950">
            {{ promo.title }}
          </p>
          <p class="line-clamp-1 mt-0.5 text-xs text-main-200 font-800 light:text-main-700">
            +{{ promo.reward.toLocaleString('ru-RU') }} бонусов за {{ promo.target_trips }} поездок
          </p>
        </div>
      </RouterLink>
    </div>

    <!-- Частые адреса — быстрый выбор -->
    <div v-if="quickDestinations.length" class="space-y-0.5">
      <button
        v-for="item in quickDestinations.slice(0, 3)"
        :key="item.place.id"
        class="w-full flex items-center gap-3 rounded-[1.1rem] px-2 py-2 text-left transition active:scale-[0.99] hover:bg-white/6 light:hover:bg-black/4"
        type="button"
        @click="emit('selectDestination', item.place)"
      >
        <span class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/7 text-main-200 light:text-main-700">
          <span :class="item.times > 2 ? 'i-mdi-star' : 'i-mdi-history'" class="text-4.5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-800">{{ item.place.name }}</span>
          <span class="block truncate text-xs app-faint font-700">{{ item.place.address }}</span>
        </span>
      </button>
    </div>

    <!-- Пустое состояние: истории поездок ещё нет — вместо дыры даём подсказку
         и полезное действие (выбор точки на карте). -->
    <div
      v-else
      class="relative overflow-hidden border border-white/8 rounded-[1.65rem] from-main-500/14 via-white/4 to-transparent bg-gradient-to-br p-4"
    >
      <span
        class="app-accent/12 i-mdi-map-marker-star-outline pointer-events-none absolute text-24 -right-4 -top-5"
        aria-hidden="true"
      />
      <p class="text-sm font-950">
        Любимые адреса появятся здесь
      </p>
      <p class="mt-1 max-w-60 text-xs app-muted font-700 leading-5">
        После первых поездок покажем недавние и частые места — закажете в один тап.
      </p>
      <button
        class="mt-3 h-10 inline-flex items-center gap-2 rounded-full app-chip px-4 text-sm font-900 transition active:scale-[0.97] hover:bg-white/12"
        type="button"
        @click="emit('pickFromMap', 'destination')"
      >
        <span class="i-mdi-map-marker-radius-outline text-4.5 app-accent" aria-hidden="true" />
        Выбрать на карте
      </button>
    </div>
  </div>
</template>
