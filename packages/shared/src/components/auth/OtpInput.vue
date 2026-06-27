<script setup lang="ts">
import { PinInputInput, PinInputRoot } from 'reka-ui'
import { useId } from 'vue'

defineProps<{
  shake?: boolean
}>()

const model = defineModel<string>({ required: true })
const labelId = useId()

const digits = computed<string[]>({
  get: () => Array.from({ length: 6 }, (_, index) => model.value[index] ?? ''),
  set: value => model.value = value.join('').replace(/\D/g, '').slice(0, 6),
})
</script>

<template>
  <div>
    <label :id="labelId" class="mb-3 block text-sm text-slate-300 font-600">
      Код подтверждения
    </label>

    <PinInputRoot
      v-model="digits"
      :aria-labelledby="labelId"
      class="flex justify-between gap-2"
      :class="{ 'animate-otp-shake': shake }"
      otp
    >
      <PinInputInput
        v-for="(_, index) in 6"
        :key="index"
        autocomplete="one-time-code"
        class="h-16 min-w-0 flex flex-1 items-center justify-center border rounded-2xl bg-white/5 text-center text-2xl text-white font-800 outline-none transition focus:border-main-400 focus:bg-main-500/10 placeholder:text-slate-500 focus:ring-2 focus:ring-main-400/40"
        inputmode="numeric"
        :index="index"
        :name="index === 0 ? 'otp' : undefined"
        placeholder="•"
      />
    </PinInputRoot>
  </div>
</template>

<style scoped>
.animate-otp-shake {
  animation: otp-shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes otp-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
</style>
