<script setup lang="ts">
import { mediaUrl } from '~/api/client'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useVerificationStore } from '~/stores/verification'
import { formatDate } from '~/utils/format'

const verification = useVerificationStore()
const tab = ref<'daily' | 'vehicles'>('vehicles')

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Верификация водителей | EdTaxi',
})

onMounted(() => {
  verification.loadVehicles().catch(() => {})
  verification.loadDailyChecks('pending').catch(() => {})
})

function photos(items: Array<{ label: string, url: null | string }>) {
  return items.filter(item => item.url)
}
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    description="Проверяйте фото машин при онбординге и ежедневные проверки водителей перед выходом на линию."
    title="Верификация водителей"
  >
    <div class="mt-5 inline-flex gap-1 rounded-2xl bg-white/8 p-1">
      <button
        class="h-10 rounded-xl px-4 text-sm font-900 transition"
        :class="tab === 'vehicles' ? 'bg-cyan-300 text-#06142f' : 'text-white/60'"
        type="button"
        @click="tab = 'vehicles'"
      >
        Машины
        <span v-if="verification.vehicles.length" class="ml-1 opacity-70">{{ verification.vehicles.length }}</span>
      </button>
      <button
        class="h-10 rounded-xl px-4 text-sm font-900 transition"
        :class="tab === 'daily' ? 'bg-cyan-300 text-#06142f' : 'text-white/60'"
        type="button"
        @click="tab = 'daily'"
      >
        Ежедневные проверки
        <span v-if="verification.dailyChecks.length" class="ml-1 opacity-70">{{ verification.dailyChecks.length }}</span>
      </button>
    </div>

    <!-- Vehicles -->
    <div v-if="tab === 'vehicles'" class="mt-5 space-y-3">
      <div v-if="verification.isLoadingVehicles" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Загружаем заявки...
      </div>
      <div v-else-if="!verification.vehicles.length" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Нет машин, ожидающих проверки.
      </div>

      <article
        v-for="vehicle in verification.vehicles"
        v-else
        :key="vehicle.id"
        class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-base font-950">
              {{ vehicle.make }} {{ vehicle.model }} · {{ vehicle.year }}
            </p>
            <p class="mt-0.5 text-sm text-white/60 font-800">
              {{ vehicle.plate_number }} · {{ vehicle.color }} · {{ vehicle.category }}
            </p>
            <p class="mt-1 text-xs text-white/45">
              <RouterLink
                v-if="vehicle.driver_user_id"
                :to="`/drivers/${vehicle.driver_user_id}`"
                class="text-cyan-200 font-800 hover:underline"
              >
                {{ vehicle.driver_name || 'Водитель' }}
              </RouterLink>
              <span v-else class="font-800">{{ vehicle.driver_name || 'Водитель' }}</span>
              · {{ formatDate(vehicle.created_at) }}
            </p>
          </div>

          <div class="flex shrink-0 gap-2">
            <button
              :disabled="verification.isMutating"
              class="h-10 rounded-xl bg-emerald-400 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
              type="button"
              @click="verification.decideVehicle(vehicle.id, true)"
            >
              Одобрить
            </button>
            <button
              :disabled="verification.isMutating"
              class="h-10 rounded-xl bg-red-500/15 px-4 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
              type="button"
              @click="verification.decideVehicle(vehicle.id, false)"
            >
              Отклонить
            </button>
          </div>
        </div>

        <div v-if="vehicle.verification_photo_url" class="mt-4">
          <a :href="mediaUrl(vehicle.verification_photo_url)" rel="noopener" target="_blank">
            <img
              :alt="`Фото ${vehicle.plate_number}`"
              class="h-44 w-full rounded-2xl bg-black/20 object-cover"
              :src="mediaUrl(vehicle.verification_photo_url)"
            >
          </a>
        </div>
        <p v-else class="mt-4 text-xs text-amber-300/80 font-700">
          Водитель не приложил фото машины.
        </p>
      </article>
    </div>

    <!-- Daily checks -->
    <div v-else class="mt-5 space-y-3">
      <div v-if="verification.isLoadingDailyChecks" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Загружаем проверки...
      </div>
      <div v-else-if="!verification.dailyChecks.length" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Нет ежедневных проверок в ожидании.
      </div>

      <article
        v-for="check in verification.dailyChecks"
        v-else
        :key="check.id"
        class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-base font-950">
              Ежедневная проверка
            </p>
            <p class="mt-1 text-xs text-white/45">
              <RouterLink
                v-if="check.driver_user_id"
                :to="`/drivers/${check.driver_user_id}`"
                class="text-cyan-200 font-800 hover:underline"
              >
                {{ check.driver_name || 'Водитель' }}
              </RouterLink>
              <span v-else class="font-800">{{ check.driver_name || 'Водитель' }}</span>
              · {{ formatDate(check.created_at) }}
            </p>
          </div>

          <div class="flex shrink-0 gap-2">
            <button
              :disabled="verification.isMutating"
              class="h-10 rounded-xl bg-emerald-400 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
              type="button"
              @click="verification.decideDailyCheck(check.id, true)"
            >
              Одобрить
            </button>
            <button
              :disabled="verification.isMutating"
              class="h-10 rounded-xl bg-red-500/15 px-4 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-50"
              type="button"
              @click="verification.decideDailyCheck(check.id, false)"
            >
              Отклонить
            </button>
          </div>
        </div>

        <div class="grid mt-4 gap-3 lg:grid-cols-4 sm:grid-cols-2">
          <figure
            v-for="photo in photos([
              { label: 'Селфи сейчас', url: check.selfie_url },
              { label: 'Эталон лица', url: check.driver_face_photo_url },
              { label: 'Фото машины', url: check.vehicle_photo_url },
              { label: 'Техпаспорт', url: check.vehicle_tech_passport_photo_url },
            ])"
            :key="photo.label"
          >
            <a :href="mediaUrl(photo.url)" rel="noopener" target="_blank">
              <img
                :alt="photo.label"
                class="h-36 w-full rounded-2xl bg-black/20 object-cover"
                :src="mediaUrl(photo.url)"
              >
            </a>
            <figcaption class="mt-1 text-center text-xs text-white/50 font-700">
              {{ photo.label }}
            </figcaption>
          </figure>
        </div>
      </article>
    </div>
  </WebPageShell>
</template>
