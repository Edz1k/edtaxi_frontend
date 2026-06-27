<script setup lang="ts">
import type { OtpDeliveryMethod } from '../../types/auth'

const model = defineModel<OtpDeliveryMethod>({ default: 'whatsapp' })

const methods: Array<{
  description: string
  icon: string
  label: string
  value: OtpDeliveryMethod
}> = [
  { description: 'Быстро и бесплатно', icon: 'i-mdi-whatsapp', label: 'WhatsApp', value: 'whatsapp' },
  { description: 'Обычное сообщение', icon: 'i-mdi-message-text-outline', label: 'SMS', value: 'sms' },
]
</script>

<template>
  <div
    class="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1"
    role="radiogroup"
    aria-label="Способ получения кода"
  >
    <button
      v-for="method in methods"
      :key="method.value"
      :aria-checked="model === method.value"
      class="min-h-12 flex items-center justify-center gap-2 rounded-xl px-4 text-center text-sm font-700 transition-all duration-300 ease-out active:scale-[0.98]"
      :class="model === method.value
        ? method.value === 'whatsapp'
          ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
          : 'bg-main-500 text-white shadow-lg shadow-main-500/25'
        : 'bg-transparent text-slate-400 shadow-none'"
      role="radio"
      type="button"
      @click="model = method.value"
    >
      <span class="text-xl" :class="method.icon" aria-hidden="true" />
      {{ method.label }}
    </button>
  </div>
</template>
