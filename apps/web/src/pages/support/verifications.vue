<script setup lang="ts">
import type { PendingVehicle } from '~/types/verification'
import { mediaUrl } from '~/api/client'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { CATEGORY_LABELS } from '~/constants/admin'
import { useVerificationStore } from '~/stores/verification'
import { formatDate } from '~/utils/format'
import { validateIin } from '~/utils/iin'

const verification = useVerificationStore()
const tab = ref<'daily' | 'faces' | 'vehicles'>('vehicles')

// ?tab=faces|daily|vehicles — прямой переход из кабинета водителя на нужную
// вкладку проверки.
const route = useRoute()
const initialTab = route.query.tab
if (initialTab === 'faces' || initialTab === 'daily' || initialTab === 'vehicles')
  tab.value = initialTab

// Слоты фотоотчёта машины в порядке показа; первые 10 обязательны. group
// делит их на блоки: 'car' — кузов/салон, 'doc' — документы (техпаспорт, VIN,
// страховка).
type PhotoGroup = 'car' | 'doc'
const VEHICLE_PHOTO_SLOTS: Array<{ slot: string, label: string, required: boolean, group: PhotoGroup }> = [
  { slot: 'exterior_front', label: 'Спереди', required: true, group: 'car' },
  { slot: 'exterior_back', label: 'Сзади', required: true, group: 'car' },
  { slot: 'exterior_left', label: 'Левый бок', required: true, group: 'car' },
  { slot: 'exterior_right', label: 'Правый бок', required: true, group: 'car' },
  { slot: 'interior_front', label: 'Передние сиденья', required: true, group: 'car' },
  { slot: 'interior_back', label: 'Задний ряд сидений', required: true, group: 'car' },
  { slot: 'dashboard', label: 'Панель приборов (с одометром)', required: true, group: 'car' },
  { slot: 'trunk', label: 'Багажник', required: true, group: 'car' },
  { slot: 'doc_registration_front', label: 'Техпаспорт (лицевая сторона)', required: true, group: 'doc' },
  { slot: 'doc_registration_back', label: 'Техпаспорт (обратная сторона)', required: true, group: 'doc' },
  { slot: 'vin', label: 'VIN-номер', required: false, group: 'doc' },
  { slot: 'doc_insurance', label: 'Страховой полис', required: false, group: 'doc' },
]

interface PhotoCard {
  label: string
  url: null | string
}

function categoryLabel(category: string) {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category
}

function vehiclePhotoCards(vehicle: PendingVehicle) {
  const bySlot = new Map((vehicle.photos ?? []).map(p => [p.slot, p.photo_url]))
  const cards: Array<PhotoCard & { slot: string, group: PhotoGroup }> = []
  for (const { slot, label, required, group } of VEHICLE_PHOTO_SLOTS) {
    const url = bySlot.get(slot) ?? null
    bySlot.delete(slot)
    // Необязательные слоты без фото не показываем, обязательные — как заглушку.
    if (url || required)
      cards.push({ slot, label, url, group })
  }
  // Нераспознанные слоты (на будущее) — в блок документов.
  for (const [slot, url] of bySlot)
    cards.push({ slot, label: slot, url, group: 'doc' })
  return cards
}

function vehiclePhotoCount(vehicle: PendingVehicle) {
  if (vehicle.photos?.length)
    return vehicle.photos.length
  let count = 0
  if (vehicle.verification_photo_url)
    count++
  if (vehicle.tech_passport_photo_url)
    count++
  return count
}

// Ручной ввод ИИН с документа для водителей, не приложивших его при онбординге:
// поддержка вбивает номер с фото и сразу видит, сходится ли контрольная сумма.
const manualIin = reactive<Record<string, string>>({})

// --- Заявка открывается в модалке; решение — по чек-листу из двух блоков.
// Итог «Одобрить» доступен только когда ОБА блока отмечены «всё в порядке»;
// «Отклонить» — когда чек-лист заполнен, есть проблемный блок и указана причина
// (её увидит водитель в своём фотоконтроле).

type RequestKind = 'daily' | 'face' | 'vehicle'
const activeRequest = ref<null | { kind: RequestKind, id: string }>(null)
// Вердикты по двум блокам текущей заявки: null — ещё не отмечено.
const checks = reactive<{ first: boolean | null, second: boolean | null }>({ first: null, second: null })
const rejectReason = ref('')

const activeVehicle = computed(() =>
  activeRequest.value?.kind === 'vehicle'
    ? verification.vehicles.find(v => v.id === activeRequest.value?.id) ?? null
    : null,
)
const activeFace = computed(() =>
  activeRequest.value?.kind === 'face'
    ? verification.faces.find(f => f.driver_id === activeRequest.value?.id) ?? null
    : null,
)
const activeDaily = computed(() =>
  activeRequest.value?.kind === 'daily'
    ? verification.dailyChecks.find(c => c.id === activeRequest.value?.id) ?? null
    : null,
)

interface ChecklistBlock {
  key: 'first' | 'second'
  title: string
  hint: string
  cards: PhotoCard[]
  // required-заглушки «нет фото» показываем только для машин.
  showPlaceholders?: boolean
}

function presentCards(cards: PhotoCard[]) {
  return cards.filter(card => card.url)
}

// Два блока чек-листа для текущей заявки (фото сгруппированы по смыслу решения).
const activeBlocks = computed<ChecklistBlock[]>(() => {
  const vehicle = activeVehicle.value
  if (vehicle) {
    const cards = vehiclePhotoCards(vehicle)
    const hasReport = Boolean(vehicle.photos?.length)
    return [
      {
        key: 'first',
        title: 'Фото машины',
        hint: 'Кузов и салон соответствуют анкете, без повреждений и чужих номеров.',
        cards: hasReport
          ? cards.filter(card => card.group === 'car')
          : [{ label: 'Фото машины', url: vehicle.verification_photo_url }],
        showPlaceholders: hasReport,
      },
      {
        key: 'second',
        title: 'Документы',
        hint: 'Техпаспорт читается, данные совпадают с анкетой (госномер, VIN, владелец).',
        cards: hasReport
          ? cards.filter(card => card.group === 'doc')
          : [{ label: 'Техпаспорт', url: vehicle.tech_passport_photo_url ?? null }],
        showPlaceholders: hasReport,
      },
    ]
  }

  const face = activeFace.value
  if (face) {
    return [
      {
        key: 'first',
        title: 'Селфи',
        hint: 'Лицо хорошо видно, без очков и головных уборов, фото не с экрана.',
        cards: [{ label: 'Селфи', url: face.face_photo_url }],
      },
      {
        key: 'second',
        title: 'Удостоверение',
        hint: 'Документ читается, лицо совпадает с селфи, ИИН сходится.',
        cards: [{ label: 'Удостоверение / паспорт', url: face.id_document_url }],
      },
    ]
  }

  const daily = activeDaily.value
  if (daily) {
    return [
      {
        key: 'first',
        title: 'Селфи',
        hint: 'Лицо на сегодняшнем селфи совпадает с эталоном и удостоверением.',
        cards: [
          { label: 'Селфи сейчас', url: daily.selfie_url },
          { label: 'Эталон лица', url: daily.driver_face_photo_url },
          { label: 'Удостоверение', url: daily.driver_id_document_url },
        ],
      },
      {
        key: 'second',
        title: 'Машина',
        hint: 'Сегодняшнее фото — та же машина, что в техпаспорте, без повреждений.',
        cards: [
          { label: 'Фото машины', url: daily.vehicle_photo_url },
          { label: 'Техпаспорт', url: daily.vehicle_tech_passport_photo_url },
        ],
      },
    ]
  }
  return []
})

const activeTitle = computed(() => {
  const vehicle = activeVehicle.value
  if (vehicle)
    return `${vehicle.make} ${vehicle.model} · ${vehicle.year}`
  if (activeFace.value)
    return 'Идентификация личности'
  if (activeDaily.value)
    return 'Ежедневная проверка'
  return ''
})

const activeDriverName = computed(() =>
  activeVehicle.value?.driver_name
  ?? activeFace.value?.driver_name
  ?? activeDaily.value?.driver_name
  ?? 'Водитель',
)

const activeIin = computed(() =>
  activeFace.value?.iin ?? activeDaily.value?.driver_iin ?? null,
)

const checklistComplete = computed(() => checks.first !== null && checks.second !== null)
const canApprove = computed(() => checks.first === true && checks.second === true)
const canReject = computed(() =>
  checklistComplete.value
  && (checks.first === false || checks.second === false)
  && rejectReason.value.trim().length > 0,
)

function openRequest(kind: RequestKind, id: string) {
  activeRequest.value = { kind, id }
  checks.first = null
  checks.second = null
  rejectReason.value = ''
}

function closeRequest() {
  activeRequest.value = null
}

async function submitDecision(approve: boolean) {
  const request = activeRequest.value
  if (!request || (approve ? !canApprove.value : !canReject.value))
    return
  const first = checks.first === true
  const second = checks.second === true
  const reason = approve ? '' : rejectReason.value.trim()

  if (request.kind === 'vehicle')
    await verification.decideVehicleChecklist(request.id, first, second, reason)
  else if (request.kind === 'face')
    await verification.decideFaceChecklist(request.id, first, second, reason)
  else
    await verification.decideDailyCheckChecklist(request.id, first, second, reason)

  closeRequest()
}

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Верификация водителей | EdTaxi',
})

onMounted(() => {
  verification.loadVehicles().catch(() => {})
  verification.loadDailyChecks('pending').catch(() => {})
  verification.loadFaces().catch(() => {})
})

// Лайтбокс: фото открывается в оверлее прямо на странице, а не переходом по
// прямой ссылке /uploads/... (на домене веб-аппа такого пути нет — был 404).
const previewPhoto = ref<null | { alt: string, url: string }>(null)

function openPhoto(url: null | string | undefined, alt: string) {
  const resolved = url ? mediaUrl(url) : ''
  if (resolved)
    previewPhoto.value = { alt, url: resolved }
}

function closePhoto() {
  previewPhoto.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return
  // Сначала закрывается лайтбокс, при повторном Escape — сама заявка.
  if (previewPhoto.value)
    closePhoto()
  else
    closeRequest()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    description="Открывайте заявку водителя, отмечайте каждый блок фотоконтроля и выносите решение по полному чек-листу."
    title="Верификация водителей"
  >
    <div class="mt-5 inline-flex gap-1 rounded-2xl bg-white/8 p-1">
      <button
        class="h-10 rounded-xl px-4 text-sm font-900 transition"
        :class="tab === 'vehicles' ? 'bg-cyan-300 text-#06142f' : 'text-white/60'"
        type="button"
        @click="tab = 'vehicles'"
      >
        Машины
        <span v-if="verification.vehicles.length" class="ml-1 opacity-70">{{ verification.vehicles.length }}</span>
      </button>
      <button
        class="h-10 rounded-xl px-4 text-sm font-900 transition"
        :class="tab === 'faces' ? 'bg-cyan-300 text-#06142f' : 'text-white/60'"
        type="button"
        @click="tab = 'faces'"
      >
        Лица
        <span v-if="verification.faces.length" class="ml-1 opacity-70">{{ verification.faces.length }}</span>
      </button>
      <button
        class="h-10 rounded-xl px-4 text-sm font-900 transition"
        :class="tab === 'daily' ? 'bg-cyan-300 text-#06142f' : 'text-white/60'"
        type="button"
        @click="tab = 'daily'"
      >
        Ежедневные проверки
        <span v-if="verification.dailyChecks.length" class="ml-1 opacity-70">{{ verification.dailyChecks.length }}</span>
      </button>
    </div>

    <!-- Vehicles: компактный список заявок, решение — внутри заявки -->
    <div v-if="tab === 'vehicles'" class="mt-5 space-y-3">
      <div v-if="verification.isLoadingVehicles" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Загружаем заявки...
      </div>
      <div v-else-if="!verification.vehicles.length" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Нет машин, ожидающих проверки.
      </div>

      <article
        v-for="vehicle in verification.vehicles"
        v-else
        :key="vehicle.id"
        class="flex flex-wrap items-center justify-between gap-4 border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur"
      >
        <div class="min-w-0">
          <p class="text-base font-950">
            {{ vehicle.make }} {{ vehicle.model }} · {{ vehicle.year }}
          </p>
          <p class="mt-0.5 text-sm text-white/60 font-800">
            {{ vehicle.plate_number }} · {{ vehicle.color }}
          </p>
          <div v-if="vehicle.categories?.length" class="mt-1.5 flex flex-wrap gap-1.5">
            <span
              v-for="cat in vehicle.categories"
              :key="cat"
              class="rounded-lg bg-cyan-300/15 px-2 py-0.5 text-xs text-cyan-200 font-800"
            >
              {{ categoryLabel(cat) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-white/45">
            <RouterLink
              v-if="vehicle.driver_user_id"
              :to="`/drivers/${vehicle.driver_user_id}`"
              class="text-cyan-200 font-800 hover:underline"
            >
              {{ vehicle.driver_name || 'Водитель' }}
            </RouterLink>
            <span v-else class="font-800">{{ vehicle.driver_name || 'Водитель' }}</span>
            · {{ formatDate(vehicle.created_at) }}
          </p>
        </div>

        <button
          class="h-11 inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          type="button"
          @click="openRequest('vehicle', vehicle.id)"
        >
          <span class="i-mdi-clipboard-check-outline text-5" />
          Открыть заявку · {{ vehiclePhotoCount(vehicle) }} фото
        </button>
      </article>
    </div>

    <!-- Faces -->
    <div v-else-if="tab === 'faces'" class="mt-5 space-y-3">
      <div v-if="verification.isLoadingFaces" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Загружаем заявки...
      </div>
      <div v-else-if="!verification.faces.length" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Нет заявок на проверку лица.
      </div>

      <article
        v-for="face in verification.faces"
        v-else
        :key="face.driver_id"
        class="flex flex-wrap items-center justify-between gap-4 border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur"
      >
        <div class="min-w-0">
          <RouterLink
            v-if="face.driver_user_id"
            :to="`/drivers/${face.driver_user_id}`"
            class="text-base text-cyan-200 font-950 hover:underline"
          >
            {{ face.driver_name }}
          </RouterLink>
          <p v-else class="text-base font-950">
            {{ face.driver_name }}
          </p>
          <p class="mt-0.5 text-xs text-white/40">
            {{ face.driver_phone }} · {{ formatDate(face.created_at) }}
          </p>
        </div>

        <button
          class="h-11 inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          type="button"
          @click="openRequest('face', face.driver_id)"
        >
          <span class="i-mdi-clipboard-check-outline text-5" />
          Открыть заявку
        </button>
      </article>
    </div>

    <!-- Daily checks -->
    <div v-else class="mt-5 space-y-3">
      <div v-if="verification.isLoadingDailyChecks" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Загружаем проверки...
      </div>
      <div v-else-if="!verification.dailyChecks.length" class="border border-white/10 rounded-3xl bg-white/8 px-4 py-6 text-sm text-white/50">
        Нет ежедневных проверок в ожидании.
      </div>

      <article
        v-for="check in verification.dailyChecks"
        v-else
        :key="check.id"
        class="flex flex-wrap items-center justify-between gap-4 border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur"
      >
        <div class="min-w-0">
          <p class="text-base font-950">
            Ежедневная проверка
          </p>
          <p class="mt-1 text-xs text-white/45">
            <RouterLink
              v-if="check.driver_user_id"
              :to="`/drivers/${check.driver_user_id}`"
              class="text-cyan-200 font-800 hover:underline"
            >
              {{ check.driver_name || 'Водитель' }}
            </RouterLink>
            <span v-else class="font-800">{{ check.driver_name || 'Водитель' }}</span>
            · {{ formatDate(check.created_at) }}
          </p>
        </div>

        <button
          class="h-11 inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          type="button"
          @click="openRequest('daily', check.id)"
        >
          <span class="i-mdi-clipboard-check-outline text-5" />
          Открыть заявку
        </button>
      </article>
    </div>

    <!-- Заявка: чек-лист из двух блоков, решение только по полному чек-листу -->
    <Teleport to="body">
      <div
        v-if="activeRequest && activeBlocks.length"
        class="fixed inset-0 z-70 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
        @click.self="closeRequest"
      >
        <div class="max-h-[92vh] max-w-3xl w-full flex flex-col overflow-hidden border border-white/10 rounded-3xl bg-#071a38 shadow-2xl">
          <header class="flex items-start justify-between gap-4 border-b border-white/8 p-5">
            <div class="min-w-0">
              <h2 class="truncate text-xl font-950">
                {{ activeTitle }}
              </h2>
              <p class="mt-1 text-sm text-white/55">
                {{ activeDriverName }}
                <template v-if="activeVehicle">
                  · {{ activeVehicle.plate_number }} · {{ activeVehicle.color }}
                </template>
              </p>
            </div>
            <button
              aria-label="Закрыть"
              class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/8 transition hover:bg-white/15"
              type="button"
              @click="closeRequest"
            >
              <span class="i-mdi-close text-5" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            <section
              v-for="block in activeBlocks"
              :key="block.key"
              class="border rounded-2xl p-4 transition"
              :class="checks[block.key] === true
                ? 'border-emerald-400/30 bg-emerald-400/6'
                : checks[block.key] === false
                  ? 'border-red-400/30 bg-red-500/6'
                  : 'border-white/10 bg-white/4'"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="text-base font-950">
                    {{ block.title }}
                  </h3>
                  <p class="mt-0.5 text-xs text-white/45 leading-5">
                    {{ block.hint }}
                  </p>
                </div>

                <!-- Вердикт блока -->
                <div class="inline-flex shrink-0 gap-1 rounded-xl bg-white/6 p-1">
                  <button
                    class="h-9 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-900 transition"
                    :class="checks[block.key] === true ? 'bg-emerald-400 text-#06142f' : 'text-white/55 hover:text-white'"
                    type="button"
                    @click="checks[block.key] = true"
                  >
                    <span class="i-mdi-check-bold text-4" />
                    Всё в порядке
                  </button>
                  <button
                    class="h-9 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-900 transition"
                    :class="checks[block.key] === false ? 'bg-red-400 text-#06142f' : 'text-white/55 hover:text-white'"
                    type="button"
                    @click="checks[block.key] = false"
                  >
                    <span class="i-mdi-close-thick text-4" />
                    Есть проблема
                  </button>
                </div>
              </div>

              <div v-if="block.showPlaceholders ? block.cards.length : presentCards(block.cards).length" class="grid grid-cols-2 mt-4 gap-3 sm:grid-cols-3">
                <figure
                  v-for="card in (block.showPlaceholders ? block.cards : presentCards(block.cards))"
                  :key="card.label"
                >
                  <button v-if="card.url" class="block w-full" type="button" @click="openPhoto(card.url, card.label)">
                    <img
                      :alt="card.label"
                      class="h-32 w-full rounded-2xl bg-black/20 object-cover transition hover:opacity-80"
                      :src="mediaUrl(card.url)"
                    >
                  </button>
                  <div v-else class="h-32 w-full flex items-center justify-center border border-white/15 rounded-2xl border-dashed bg-white/4 text-xs text-white/35 font-700">
                    нет фото
                  </div>
                  <figcaption class="mt-1 text-center text-xs font-700" :class="card.url ? 'text-white/50' : 'text-white/30'">
                    {{ card.label }}
                  </figcaption>
                </figure>
              </div>
              <p v-else class="mt-4 text-xs text-amber-300/80 font-700">
                Водитель не приложил фото этого блока.
              </p>
            </section>

            <!-- ИИН: бейдж контрольной суммы для сверки с документом. Если водитель
                 не приложил номер — поддержка вбивает его с фото вручную. -->
            <section v-if="activeFace || activeDaily" class="border border-white/8 rounded-2xl bg-white/4 p-4">
              <template v-if="activeIin">
                <p class="text-xs text-white/42 font-900 uppercase">
                  ИИН (с онбординга)
                </p>
                <p class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="text-base font-950 tracking-wide">{{ activeIin }}</span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-900"
                    :class="validateIin(activeIin).valid ? 'bg-emerald-500/12 text-emerald-300' : 'bg-red-500/12 text-red-300'"
                  >
                    <span class="text-4" :class="validateIin(activeIin).valid ? 'i-mdi-check-decagram' : 'i-mdi-alert-decagram'" />
                    {{ validateIin(activeIin).valid ? 'Контрольная сумма сходится' : 'Контрольная сумма НЕ сходится' }}
                  </span>
                </p>
              </template>
              <template v-else>
                <label class="grid max-w-xs gap-1.5">
                  <span class="text-xs text-white/42 font-900 uppercase">ИИН с документа (проверить)</span>
                  <input
                    v-model="manualIin[activeRequest.id]"
                    class="h-10 border border-white/10 rounded-xl bg-white/8 px-3 text-sm outline-none focus:border-cyan-300/40"
                    inputmode="numeric"
                    maxlength="12"
                    placeholder="12 цифр с удостоверения"
                  >
                </label>
                <p v-if="manualIin[activeRequest.id]?.length === 12" class="mt-1.5">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-900"
                    :class="validateIin(manualIin[activeRequest.id]).valid ? 'bg-emerald-500/12 text-emerald-300' : 'bg-red-500/12 text-red-300'"
                  >
                    <span class="text-4" :class="validateIin(manualIin[activeRequest.id]).valid ? 'i-mdi-check-decagram' : 'i-mdi-alert-decagram'" />
                    {{ validateIin(manualIin[activeRequest.id]).valid ? 'Контрольная сумма сходится' : 'Контрольная сумма НЕ сходится' }}
                  </span>
                </p>
              </template>
            </section>

            <!-- Причина отказа: обязательна, когда хотя бы один блок с проблемой -->
            <section v-if="checks.first === false || checks.second === false">
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Причина отказа (увидит водитель)</span>
                <textarea
                  v-model="rejectReason"
                  class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
                  maxlength="500"
                  placeholder="Например: техпаспорт не читается, переснимите обе стороны без бликов."
                  rows="2"
                />
              </label>
            </section>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 p-5">
            <p class="text-xs text-white/45">
              <template v-if="!checklistComplete">
                Отметьте оба блока, чтобы вынести решение.
              </template>
              <template v-else-if="canApprove">
                Все блоки в порядке — можно одобрять.
              </template>
              <template v-else-if="!rejectReason.trim()">
                Укажите причину отказа — водитель увидит её в фотоконтроле.
              </template>
              <template v-else>
                Заявка будет отклонена с указанной причиной.
              </template>
            </p>
            <div class="flex gap-2">
              <button
                :disabled="!canApprove || verification.isMutating"
                class="h-11 rounded-xl bg-emerald-400 px-5 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-40"
                type="button"
                @click="submitDecision(true)"
              >
                Одобрить
              </button>
              <button
                :disabled="!canReject || verification.isMutating"
                class="h-11 rounded-xl bg-red-500/15 px-5 text-sm text-red-300 font-900 transition active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-40"
                type="button"
                @click="submitDecision(false)"
              >
                Отклонить
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Лайтбокс: просмотр фото без ухода со страницы -->
    <div
      v-if="previewPhoto"
      class="fixed inset-0 z-80 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      @click.self="closePhoto"
    >
      <button
        aria-label="Закрыть"
        class="absolute right-4 top-4 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        type="button"
        @click="closePhoto"
      >
        <span class="i-mdi-close text-6" />
      </button>
      <img
        :alt="previewPhoto.alt"
        class="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl shadow-black/60"
        :src="previewPhoto.url"
        @click.stop
      >
      <p class="mt-3 text-sm text-white/70 font-800">
        {{ previewPhoto.alt }}
      </p>
    </div>
  </WebPageShell>
</template>
