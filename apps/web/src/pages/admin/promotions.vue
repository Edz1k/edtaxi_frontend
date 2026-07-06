<script setup lang="ts">
import type { CreatePromotionPayload, Promotion } from '~/types/promotions'
import { showErrorToast } from '~/api/errors'
import { createAdminPromotion, deactivateAdminPromotion, listAdminPromotions, uploadAdminPromotionImage } from '~/api/promotions'
import WebPageShell from '~/components/app/WebPageShell.vue'
import PromotionForm from '~/components/promotions/PromotionForm.vue'
import PromotionsList from '~/components/promotions/PromotionsList.vue'

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Акции | Админка',
})

const promotions = ref<Promotion[]>([])
const isLoading = ref(false)
const isMutating = ref(false)
const formRef = ref<InstanceType<typeof PromotionForm> | null>(null)

onMounted(load)

async function load() {
  isLoading.value = true
  try {
    const response = await listAdminPromotions()
    promotions.value = response.promotions
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить акции.')
  }
  finally {
    isLoading.value = false
  }
}

async function create(payload: CreatePromotionPayload) {
  isMutating.value = true
  try {
    await createAdminPromotion(payload)
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
    await deactivateAdminPromotion(promotion.id)
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
    embedded
    description="Платформенные акции «N поездок → X бонусов» для пассажиров или водителей. При запуске вся аудитория получает рассылку в Telegram."
    title="Акции"
  >
    <PromotionForm
      ref="formRef"
      hint="Все пользователи аудитории получат уведомление в Telegram."
      :pending="isMutating"
      :upload-image="uploadAdminPromotionImage"
      with-audience
      @create="create"
    />

    <PromotionsList
      :is-loading="isLoading"
      :pending="isMutating"
      :promotions="promotions"
      show-audience
      @stop="stop"
    />
  </WebPageShell>
</template>
