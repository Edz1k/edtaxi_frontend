<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

interface AppSelectDropdownOption {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  align?: 'center' | 'end' | 'start'
  disabled?: boolean
  label?: string
  modelValue: string
  options: AppSelectDropdownOption[]
}>(), {
  align: 'end',
  disabled: false,
  label: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const activeLabel = computed(() => props.options.find(item => item.value === props.modelValue)?.label ?? props.label)

function select(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :disabled="disabled"
      class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 outline-none transition data-[state=open]:bg-white/12 hover:bg-white/12 disabled:opacity-50"
    >
      {{ activeLabel }}
      <span class="i-mdi-chevron-down text-5 text-cyan-200" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align"
        class="z-60 min-w-56 border border-white/12 rounded-2xl bg-#071a38/96 p-1.5 text-white shadow-2xl shadow-black/35 outline-none backdrop-blur-xl"
        :side-offset="8"
      >
        <DropdownMenuLabel v-if="label" class="px-3 py-2 text-xs text-white/45 font-900 uppercase">
          {{ label }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="item in options"
          :key="item.value"
          class="relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/78 font-800 outline-none transition data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
          @select="select(item.value)"
        >
          <span class="h-5 w-5 flex items-center justify-center">
            <span v-if="modelValue === item.value" class="i-mdi-check text-cyan-200" />
          </span>
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
