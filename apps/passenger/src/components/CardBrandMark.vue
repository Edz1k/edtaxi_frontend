<script setup lang="ts">
// Визуальный знак платёжной системы карты: словомарка VISA, два круга
// Mastercard или нейтральная иконка, если бренд неизвестен (карты, привязанные
// до появления pg_card_brand). Бренд приходит от шлюза как произвольная
// строка (VISA/MASTERCARD/…) — матчим по подстроке без регистра.
const props = defineProps<{ brand?: null | string }>()

const kind = computed(() => {
  const value = (props.brand ?? '').toLowerCase()
  if (value.includes('visa'))
    return 'visa'
  if (value.includes('master') || value.includes('mc'))
    return 'mastercard'
  return 'generic'
})
</script>

<template>
  <span v-if="kind === 'visa'" aria-label="Visa" class="text-[13px] text-sky-300 font-950 leading-none tracking-tight italic">VISA</span>
  <span v-else-if="kind === 'mastercard'" aria-label="Mastercard" class="inline-flex items-center">
    <span class="h-3.5 w-3.5 rounded-full bg-red-500/90" />
    <span class="h-3.5 w-3.5 rounded-full bg-amber-400/85 -ml-1.5" />
  </span>
  <span v-else aria-hidden="true" class="i-mdi-credit-card-outline text-4.5 text-slate-300 light:text-slate-600" />
</template>
