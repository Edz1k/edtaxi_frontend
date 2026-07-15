<script setup lang="ts">
// Обвязка модалок кабинета парка: телепорт, затемнение, закрытие по клику
// мимо карточки. Сама карточка — в слоте (форма или просто блок).
const open = defineModel<boolean>({ required: true })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
        @click.self="open = false"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
