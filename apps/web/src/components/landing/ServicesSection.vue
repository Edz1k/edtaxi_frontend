<script setup lang="ts">
const { t } = useI18n()

const categories = computed(() => [
  { icon: 'i-mdi-motorbike', title: t('services.moto'), text: t('services.motoText') },
  { icon: 'i-mdi-car-hatchback', title: t('services.economy'), text: t('services.economyText') },
  { icon: 'i-mdi-car', title: t('services.comfort'), text: t('services.comfortText') },
  { icon: 'i-mdi-car-sports', title: t('services.business'), text: t('services.businessText') },
  { icon: 'i-mdi-van-passenger', title: t('services.minivan'), text: t('services.minivanText') },
])

const steps = computed(() => [
  { title: t('services.step1Title'), text: t('services.step1Text') },
  { title: t('services.step2Title'), text: t('services.step2Text') },
  { title: t('services.step3Title'), text: t('services.step3Text') },
  { title: t('services.step4Title'), text: t('services.step4Text') },
])
</script>

<template>
  <section id="services" class="relative scroll-mt-28 px-5 py-20 md:py-28">
    <div class="mx-auto max-w-1180px">
      <p class="text-sm text-cyan-300 font-800">
        {{ t('services.eyebrow') }}
      </p>

      <h2 class="mt-3 text-3xl font-900 md:text-4xl">
        {{ t('services.title') }}
      </h2>

      <p class="mt-4 max-w-760px text-white/60 leading-8">
        {{ t('services.description') }}
      </p>

      <!-- Категории поездок -->
      <div class="grid grid-cols-2 mt-8 gap-4 lg:grid-cols-5 md:grid-cols-3">
        <div
          v-for="category in categories"
          :key="category.title"
          class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur transition hover:border-cyan-300/30"
        >
          <div class="h-11 w-11 flex items-center justify-center rounded-xl bg-cyan-300/10">
            <div class="text-2xl text-cyan-300" :class="category.icon" />
          </div>
          <b class="mt-4 block">{{ category.title }}</b>
          <p class="mt-1 text-sm text-white/60 leading-6">
            {{ category.text }}
          </p>
        </div>
      </div>

      <!-- Как формируется стоимость -->
      <div class="mt-6 border border-white/10 rounded-3xl bg-white/6 p-6 backdrop-blur md:p-8">
        <h3 class="text-xl font-900">
          {{ t('services.pricingTitle') }}
        </h3>
        <p class="mt-3 max-w-860px text-white/60 leading-7">
          {{ t('services.pricingText') }}
        </p>
      </div>

      <!-- Шаги заказа и оплаты -->
      <h3 class="mt-12 text-2xl font-900">
        {{ t('services.stepsTitle') }}
      </h3>

      <div class="grid mt-6 gap-4 lg:grid-cols-4 sm:grid-cols-2">
        <div
          v-for="(step, index) in steps"
          :key="step.title"
          class="border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur"
        >
          <div class="h-9 w-9 flex items-center justify-center rounded-full bg-cyan-300 text-#06142f font-900">
            {{ index + 1 }}
          </div>
          <b class="mt-4 block">{{ step.title }}</b>
          <p class="mt-1 text-sm text-white/60 leading-6">
            {{ step.text }}
          </p>
        </div>
      </div>

      <!-- Способы оплаты -->
      <div class="mt-6 border border-cyan-300/20 rounded-3xl bg-cyan-300/8 p-6 backdrop-blur md:p-8">
        <h3 class="text-xl font-900">
          {{ t('services.paymentsTitle') }}
        </h3>

        <div class="mt-4">
          <PaymentMethodBadges />
        </div>

        <p class="mt-4 max-w-860px text-sm text-white/60 leading-7">
          {{ t('services.paymentsNote') }}
        </p>

        <p class="mt-3 text-sm text-white/60">
          {{ t('services.docsNote') }}
          <RouterLink to="/legal/offer" class="text-cyan-300 underline underline-offset-3 hover:text-cyan-200">
            {{ t('services.docsOffer') }}
          </RouterLink>
          ·
          <RouterLink to="/legal/refund" class="text-cyan-300 underline underline-offset-3 hover:text-cyan-200">
            {{ t('services.docsRefund') }}
          </RouterLink>
        </p>
      </div>
    </div>
  </section>
</template>
