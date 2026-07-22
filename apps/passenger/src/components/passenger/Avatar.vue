<script setup lang="ts">
import {
  AvatarFallback,
  AvatarImage,
  AvatarRoot,
} from 'reka-ui'

interface Props {
  src?: string
  alt?: string
  name?: string
}

withDefaults(defineProps<Props>(), {
  src: '',
  alt: 'Avatar',
  name: 'U',
})

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
</script>

<template>
  <AvatarRoot
    class="h-24 w-24 overflow-hidden border app-border rounded-full app-chip"
  >
    <AvatarImage
      :src="src"
      :alt="alt"
      class="h-full w-full object-cover"
    />

    <AvatarFallback
      class="h-full w-full flex items-center justify-center text-xl text-white font-900"
    >
      {{ getInitials(name) }}
    </AvatarFallback>
  </AvatarRoot>
</template>
