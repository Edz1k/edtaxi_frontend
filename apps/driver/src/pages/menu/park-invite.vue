<script setup lang="ts">
import type { AvailablePark } from '~/types/park'
import { listAvailableParks } from '~/api/park'
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'

const driver = useDriverStore()

const toast = useToast()
const token = ref('')

const parks = ref<AvailablePark[]>([])
const isLoadingParks = ref(false)

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Таксопарк',
  },
})

useHead({
  title: 'Таксопарк | EdTaxi',
})

onMounted(async () => {
  isLoadingParks.value = true
  try {
    const response = await listAvailableParks({ limit: 50 })
    parks.value = response.parks
  }
  catch {
    // список парков — справочный, не блокируем страницу ошибкой
  }
  finally {
    isLoadingParks.value = false
  }
})

// commission_rate приходит долей (0.03 → 3%)
function commissionLabel(park: AvailablePark) {
  return `${(park.commission_rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
}

async function acceptInvite() {
  await driver.acceptParkInvite(token.value.trim())
  token.value = ''
  toast.success('Готово', 'Вы присоединились к таксопарку.')
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Таксопарк
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Введите код приглашения, который выдал владелец парка.
        </p>
      </header>

      <form class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="acceptInvite">
        <label class="text-xs text-slate-400 font-800 uppercase" for="park-token">
          Код приглашения
        </label>
        <input
          id="park-token"
          v-model="token"
          class="mt-2 h-13 w-full border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-sm outline-none focus:border-main-400"
          placeholder="Введите token"
        >
        <button
          :disabled="driver.isLoadingParkInvite || !token.trim()"
          class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ driver.isLoadingParkInvite ? 'Проверяем...' : 'Присоединиться' }}
        </button>
      </form>

      <!-- Доступные парки: куда можно вступить и на каких условиях -->
      <section class="mt-8">
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Доступные парки
        </h2>

        <div v-if="isLoadingParks" class="mt-3 space-y-2">
          <div v-for="item in 3" :key="item" class="h-20 animate-pulse rounded-2xl bg-white/6" />
        </div>

        <p v-else-if="!parks.length" class="mt-3 text-sm text-slate-500">
          Пока нет парков, открытых для вступления.
        </p>

        <div v-else class="mt-3 space-y-2">
          <article v-for="park in parks" :key="park.id" class="rounded-2xl bg-white/5 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-base font-950">
                  {{ park.name }}
                </p>
                <p v-if="park.description" class="line-clamp-2 mt-1 text-xs text-slate-400 leading-4">
                  {{ park.description }}
                </p>
                <p v-if="park.phone" class="mt-1 text-xs text-slate-500 font-700">
                  {{ park.phone }}
                </p>
              </div>
              <span class="shrink-0 rounded-full bg-main-500/14 px-3 py-1.5 text-xs text-main-200 font-900">
                Комиссия {{ commissionLabel(park) }}
              </span>
            </div>
          </article>
        </div>

        <p v-if="parks.length" class="mt-3 text-xs text-slate-500 leading-4">
          Чтобы вступить в парк, запросите у его владельца код приглашения.
        </p>
      </section>
    </section>
  </main>
</template>
