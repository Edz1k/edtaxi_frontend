<script setup lang="ts">
import { useAdminStore } from '~/stores/admin'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()

const form = reactive({ commission_pct: 0, coefficient: 1 })
const savedAt = ref('')

const limits = computed(() => admin.platformSettings?.limits ?? null)

// Комиссия в форме — в процентах, бэкенд хранит долю (0.02 = 2%).
const commissionHint = computed(() => {
  if (!limits.value)
    return ''
  const { min, max } = limits.value.platform_commission_rate
  return `Допустимо от ${min * 100}% до ${max * 100}%. 0% — акция «без комиссии».`
})

const coefficientHint = computed(() => {
  if (!limits.value)
    return ''
  const { min, max } = limits.value.price_coefficient
  return `Допустимо от ${min} до ${max}. Умножает базовую цену каждой поездки.`
})

function fillForm() {
  if (!admin.platformSettings)
    return
  form.commission_pct = +(admin.platformSettings.platform_commission_rate * 100).toFixed(2)
  form.coefficient = admin.platformSettings.price_coefficient
}

async function loadSettings() {
  await admin.loadSettings().catch(() => {})
  fillForm()
}

async function save() {
  await admin.saveSettings({
    platform_commission_rate: +(form.commission_pct / 100).toFixed(4),
    price_coefficient: form.coefficient,
  })
  fillForm()
  savedAt.value = new Date().toISOString()
}

onMounted(loadSettings)
</script>

<template>
  <section v-if="admin.isLoadingSettings && !admin.platformSettings" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
    Загружаем настройки...
  </section>

  <form v-else-if="admin.platformSettings" class="mt-6 max-w-2xl border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur" @submit.prevent="save()">
    <div class="grid gap-5">
      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Комиссия платформы (%)</span>
        <input
          v-model.number="form.commission_pct"
          class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
          :max="(limits?.platform_commission_rate.max ?? 0.5) * 100"
          :min="(limits?.platform_commission_rate.min ?? 0) * 100"
          step="0.1"
          type="number"
        >
        <span class="text-xs text-white/50 leading-5">{{ commissionHint }}</span>
      </label>

      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Коэффициент цены</span>
        <input
          v-model.number="form.coefficient"
          class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
          :max="limits?.price_coefficient.max ?? 3"
          :min="limits?.price_coefficient.min ?? 0.5"
          step="0.05"
          type="number"
        >
        <span class="text-xs text-white/50 leading-5">{{ coefficientHint }}</span>
      </label>
    </div>

    <div class="mt-5 border border-white/8 rounded-2xl bg-black/14 px-4 py-3 text-sm text-white/55 leading-6">
      <p>
        Максимальная надбавка стороннего парка: {{ (admin.platformSettings.max_park_commission_rate * 100).toFixed(0) }}% — задаётся на бэкенде и не редактируется.
      </p>
      <p class="mt-1 text-xs text-white/40">
        Обновлено: {{ formatDate(admin.platformSettings.updated_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
      </p>
    </div>

    <div class="mt-5 flex items-center gap-3">
      <button
        :disabled="admin.isMutating"
        class="h-11 rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
        type="submit"
      >
        {{ admin.isMutating ? 'Сохраняем...' : 'Сохранить' }}
      </button>
      <span v-if="savedAt" class="text-sm text-emerald-300 font-800">
        Настройки сохранены.
      </span>
    </div>
  </form>

  <section v-else class="mt-5 border border-red-300/18 rounded-3xl bg-red-300/8 p-5 text-sm text-white/60 backdrop-blur">
    Не удалось загрузить настройки платформы.
    <button class="ml-2 text-cyan-200 font-900" type="button" @click="loadSettings()">
      Повторить
    </button>
  </section>
</template>
