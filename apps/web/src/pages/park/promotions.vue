<script setup lang="ts">
import type { CreatePromotionPayload, Promotion } from '~/types/promotions'
import { showErrorToast } from '~/api/errors'
import { createParkPromotion, deactivateParkPromotion, listParkPromotions } from '~/api/promotions'
import WebPageShell from '~/components/app/WebPageShell.vue'
import PromotionForm from '~/components/promotions/PromotionForm.vue'
import PromotionsList from '~/components/promotions/PromotionsList.vue'

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Акции парка | EdTaxi',
})

const promotions = ref<Promotion[]>([])
const isLoading = ref(false)
const isMutating = ref(false)
const formRef = ref<InstanceType<typeof PromotionForm> | null>(null)

onMounted(load)

async function load() {
  isLoading.value = true
  try {
    const response = await listParkPromotions()
    promotions.value = response.promotions
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить акции парка.')
  }
  finally {
    isLoading.value = false
  }
}

async function create(payload: CreatePromotionPayload) {
  isMutating.value = true
  try {
    await createParkPromotion(payload)
    formRef.value?.reset()
    await load()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось запустить акцию.')
  }
  finally {
    isMutating.value = false
  }
}

async function stop(promotion: Promotion) {
  isMutating.value = true
  try {
    await deactivateParkPromotion(promotion.id)
    promotion.is_running = false
    promotion.is_active = false
  }
  catch (error) {
    showErrorToast(error, 'Не удалось остановить акцию.')
  }
  finally {
    isMutating.value = false
  }
}
</script>

<template>
  <WebPageShell
    back-label="Таксопарк"
    back-to="/park"
    description="Акции «N поездок → X бонусов» для водителей вашего парка."
    title="Акции парка"
  >
    <PromotionForm
      ref="formRef"
      hint="Акция для водителей вашего парка. Все водители получат уведомление в Telegram-боте."
      :pending="isMutating"
      @create="create"
    />

    <PromotionsList
      :is-loading="isLoading"
      :pending="isMutating"
      :promotions="promotions"
      @stop="stop"
    />
  </WebPageShell>
</template>
