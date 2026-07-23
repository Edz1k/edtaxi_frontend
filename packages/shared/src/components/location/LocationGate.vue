<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { startLocationAutoDetect, useLocationAccess } from '../../composables/location/useLocationAccess'

const { t } = useI18n()

// Полноэкранная заглушка на входе: не пускает в основной экран, пока не выдан
// доступ к геолокации. Заглушка исчезает сама, как только доступ появился:
// автодетект (Permissions API + возврат в приложение + тихий поллинг) снимает
// её без ручного повторного нажатия кнопки.
const { isGranted, isRequesting, openSettings, requestAccess, status } = useLocationAccess()

onMounted(() => {
  startLocationAutoDetect()
  if (!isGranted.value)
    void requestAccess()
})

async function allow() {
  const ok = await requestAccess()
  // Доступ не выдан (уже отказывали) — открываем экран согласия Telegram
  // или повторный системный промпт браузера.
  if (!ok)
    await openSettings()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-200"
    leave-to-class="opacity-0"
  >
    <div
      v-if="!isGranted"
      class="tg-viewport-screen fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 app-screen/98 px-8 text-center text-white backdrop-blur-xl"
    >
      <div class="h-20 w-20 flex items-center justify-center rounded-3xl bg-main-500/16 app-accent">
        <span class="i-mdi-map-marker-radius text-10" />
      </div>

      <div class="space-y-2">
        <h2 class="text-xl font-950">
          {{ t('shared.geoNeeded') }}
        </h2>
        <p class="text-sm text-slate-300 light:text-slate-600 font-700 leading-6">
          {{ t('shared.geoLead') }}
        </p>
      </div>

      <button
        :disabled="isRequesting"
        class="h-14 w-full max-w-xs rounded-2xl bg-main-500 text-base text-white font-900 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        @click="allow"
      >
        {{ isRequesting ? t('shared.requesting') : t('shared.allowAccess') }}
      </button>

      <p v-if="status === 'denied'" class="max-w-xs text-xs text-amber-300 font-700 leading-5">
        {{ t('shared.geoDenied') }}
      </p>
    </div>
  </Transition>
</template>
