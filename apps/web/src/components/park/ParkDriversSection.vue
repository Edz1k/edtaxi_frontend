<script setup lang="ts">
import type { ParkDriver } from '~/types/park'

defineProps<{
  drivers: ParkDriver[]
  isPeeking: boolean
  isMutating: boolean
}>()

defineEmits<{
  remove: [driverId: string]
}>()
</script>

<template>
  <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <h2 class="text-xl font-950">
      Водители
    </h2>

    <div class="mt-4 overflow-hidden rounded-2xl bg-black/14">
      <div v-if="!drivers.length" class="p-4 text-sm text-white/50">
        Водителей нет.
      </div>
      <div
        v-for="driver in drivers"
        v-else
        :key="driver.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_90px_100px_120px] md:items-center last:border-b-0"
      >
        <!-- Имя вместо UUID; клик открывает кабинет водителя -->
        <div class="min-w-0">
          <RouterLink
            class="block truncate text-sm text-cyan-200 font-900 hover:underline"
            :to="`/drivers/${driver.user_id}`"
          >
            {{ driver.name || 'Без имени' }}
          </RouterLink>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ driver.phone || driver.user_id }}
          </p>
        </div>
        <span class="text-sm" :class="driver.is_online ? 'text-emerald-300' : 'text-white/45'">
          {{ driver.is_online ? 'Онлайн' : 'Офлайн' }}
        </span>
        <span class="text-sm text-white/62">
          <span class="i-mdi-star mr-0.5 inline-block align-middle text-3.5 text-amber-300" />
          {{ driver.rating.toFixed(1) }} · {{ driver.total_trips }}
        </span>
        <button
          v-if="!isPeeking"
          :disabled="isMutating"
          class="h-9 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 disabled:opacity-50"
          type="button"
          @click="$emit('remove', driver.id)"
        >
          Удалить
        </button>
      </div>
    </div>
  </section>
</template>
