<script setup lang="ts">
import { vMaska } from 'maska/vue'
import { useId } from 'vue'

withDefaults(defineProps<{ label?: string }>(), { label: 'Номер телефона' })

const model = defineModel<string>({ required: true })
const inputId = useId()
</script>

<template>
  <div>
    <label :for="inputId" class="mb-2 block text-sm text-slate-300 font-600 light:text-slate-600">
      {{ label }}
    </label>

    <div
      class="h-14 flex items-center overflow-hidden border app-border rounded-2xl app-card shadow-inner transition focus-within:border-main-400 focus-within:app-chip"
    >
      <span class="h-full flex items-center gap-2 border-r app-border px-4 text-lg text-white font-700">
        🇰🇿 +7
      </span>

      <input
        :id="inputId"
        v-model="model"
        v-maska="'(###) ###-##-##'"
        autocomplete="tel"
        class="min-w-0 flex-1 bg-transparent px-4 text-lg text-white font-700 tracking-wide outline-none placeholder:text-slate-600"
        inputmode="numeric"
        maxlength="15"
        name="phone"
        placeholder="(700) 123-45-67"
        type="tel"
      >
    </div>
  </div>
</template>
