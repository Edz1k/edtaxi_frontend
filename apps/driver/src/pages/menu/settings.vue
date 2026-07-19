<script setup lang="ts">
import DistrictsMiniMap from '~/components/driver/DistrictsMiniMap.vue'
import { useOrderSoundEnabled } from '~/composables/driver/useOrderSound'
import { useAuthStore } from '~/stores/auth'
import { useDriverStore } from '~/stores/driver'

const auth = useAuthStore()
const driver = useDriverStore()

// Тумблер «Мелодия заказа»: включает звук при поступлении заказа (хранится
// локально на устройстве). Тот же ключ читает плеер на экране карты.
const orderSoundEnabled = useOrderSoundEnabled()

const phone = computed(() => auth.currentUser?.phone ?? '')

// Районы приёма заказов переехали сюда из шторки на карте. Редактируем в любом
// статусе (бэк не гейтит онлайном — фильтр читается на матчинге по факту).
onMounted(() => {
  driver.loadDistricts().catch(() => {})
})

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Настройки',
  },
})

useHead({
  title: 'Настройки | Telegram Taxi Driver',
})
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Мелодия заказа -->
      <div class="flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4">
        <span
          class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
          :class="orderSoundEnabled ? 'bg-main-500/16 text-main-300' : 'bg-white/8 text-slate-500'"
        >
          <span :class="orderSoundEnabled ? 'i-mdi-music-note' : 'i-mdi-music-note-off'" class="text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">Мелодия заказа</span>
          <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
            {{ orderSoundEnabled ? 'Звучит при новом заказе' : 'Выключена' }}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          :aria-checked="orderSoundEnabled"
          aria-label="Мелодия заказа"
          class="relative h-7 w-12 shrink-0 rounded-full transition"
          :class="orderSoundEnabled ? 'bg-main-500' : 'bg-white/14'"
          @click="orderSoundEnabled = !orderSoundEnabled"
        >
          <span
            class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
            :class="orderSoundEnabled ? 'left-6' : 'left-1'"
          />
        </button>
      </div>

      <!-- Смена номера телефона -->
      <RouterLink
        to="/menu/profile/change-phone"
        class="mt-3 flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 text-white transition active:scale-[0.98]"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-300">
          <span class="i-mdi-phone-sync text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-900">Номер телефона</span>
          <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
            {{ phone ? `${phone} · изменить` : 'Изменить номер' }}
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 text-slate-500" />
      </RouterLink>

      <!-- Районы приёма заказов: выбор + превью с подсветкой. Пусто = весь город. -->
      <div class="mt-3 rounded-3xl bg-white/5 p-4">
        <div class="flex items-center gap-3">
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-300">
            <span class="i-mdi-map-marker-radius-outline text-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-900">Районы заказов</span>
            <span class="mt-0.5 block truncate text-xs text-slate-400 font-600">
              Где ищем вам заказы в первую очередь
            </span>
          </span>
        </div>

        <template v-if="driver.availableDistricts.length">
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              :disabled="driver.isSavingDistricts"
              class="rounded-full px-3 py-1.5 text-xs font-800 transition active:scale-[0.96] disabled:opacity-60"
              :class="!driver.activeDistrictIds.length ? 'bg-main-500 text-white' : 'bg-white/8 text-slate-400'"
              type="button"
              @click="driver.clearDistricts()"
            >
              Весь город
            </button>
            <button
              v-for="district in driver.availableDistricts"
              :key="district.id"
              :disabled="driver.isSavingDistricts"
              class="rounded-full px-3 py-1.5 text-xs font-800 transition active:scale-[0.96] disabled:opacity-60"
              :class="driver.activeDistrictIds.includes(district.id) ? 'bg-main-500 text-white' : 'bg-white/8 text-slate-400'"
              type="button"
              @click="driver.toggleDistrict(district.id)"
            >
              {{ district.name }}
            </button>
          </div>

          <DistrictsMiniMap
            class="mt-3"
            :active-ids="driver.activeDistrictIds"
            :districts="driver.availableDistricts"
          />

          <p class="mt-2 text-xs text-slate-500 font-700 leading-4">
            Выбранные районы подсвечиваются на карте. Сначала ищем заказы из них; если рядом никого нет — заказ может прийти из любого района.
          </p>
        </template>

        <p v-else class="mt-3 text-xs text-slate-500 font-700 leading-4">
          Районы появятся, когда определим ваш город — откройте экран карты, чтобы приложение получило геолокацию.
        </p>
      </div>
    </section>
  </main>
</template>
