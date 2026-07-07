<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Save, RotateCcw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DashboardEntry } from '~/types/dashboard'
import type { NavMenu } from '~/types/nav'
import { useOrderingStore } from '~/composables/useOrderingStore'

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
})

const store = useOrderingStore()
const config = useRuntimeConfig()

// ---- Dashboard list -------------------------------------------------------
const extensionDashboards = useState<DashboardEntry[]>('app:dashboards', () => [])

const dashboardItems = ref<DashboardEntry[]>([])
watch(extensionDashboards, (val) => {
  dashboardItems.value = store.effectiveDashboards(val)
}, { immediate: true, deep: true })

// Re-sort when store override arrives (hydrate completes)
watch(() => store.hydrated, (hydrated) => {
  if (hydrated) dashboardItems.value = store.effectiveDashboards(extensionDashboards.value)
})

async function saveDashboardOrder() {
  const order: Record<string, number> = {}
  dashboardItems.value.forEach((d, i) => { order[d.id] = i * 10 })
  try {
    await store.saveDashboardOrder(order)
    toast.success('Orden de dashboards guardado')
  } catch {
    toast.error('Error al guardar el orden de dashboards')
  }
}

async function resetDashboardOrder() {
  try {
    await store.resetDashboardOrder()
    dashboardItems.value = store.effectiveDashboards(extensionDashboards.value)
    toast.success('Orden de dashboards restaurado')
  } catch {
    toast.error('Error al restaurar el orden')
  }
}

// ---- Sidebar list ---------------------------------------------------------
const { navMenu } = useNavMenu()

const sidebarItems = ref<NavMenu[]>([])
watch(navMenu, (val) => {
  sidebarItems.value = [...val]
}, { immediate: true, deep: true })

watch(() => store.hydrated, (hydrated) => {
  if (hydrated) sidebarItems.value = [...navMenu.value]
})

async function saveSidebarOrder() {
  const order: Record<string, number> = {}
  sidebarItems.value.forEach((g, i) => {
    const key = g.heading ?? ''
    if (key) order[key] = i * 10
  })
  try {
    await store.saveSidebarOrder(order)
    toast.success('Orden del sidebar guardado')
  } catch {
    toast.error('Error al guardar el orden del sidebar')
  }
}

async function resetSidebarOrder() {
  try {
    await store.resetSidebarOrder()
    sidebarItems.value = [...navMenu.value]
    toast.success('Orden del sidebar restaurado')
  } catch {
    toast.error('Error al restaurar el orden')
  }
}
</script>

<template>
  <SettingsLayout>
    <div class="space-y-10 max-w-2xl">
      <header>
        <h1 class="text-2xl font-bold tracking-tight">Apariencia</h1>
        <p class="text-base-content/60 mt-1">
          Reordena los dashboards y los grupos del sidebar arrastrando las tarjetas.
        </p>
      </header>

      <!-- Dashboard order -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Orden de Dashboards</h2>
            <p class="text-sm text-base-content/60">
              Pestañas visibles en <code>{{ config.public.mainAppRoute }}</code>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="resetDashboardOrder">
              <RotateCcw class="w-4 h-4" /> Restablecer
            </button>
            <button class="btn btn-sm btn-primary" @click="saveDashboardOrder">
              <Save class="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>

        <VueDraggable
          v-model="dashboardItems"
          :animation="150"
          :handle="'.drag-handle'"
          ghost-class="opacity-40"
          item-key="id"
          class="space-y-2"
        >
          <div
            v-for="dash in dashboardItems"
            :key="dash.id"
            class="card card-body shadow-sm flex-row items-center gap-3 p-3 bg-base-100"
          >
            <div class="drag-handle cursor-grab active:cursor-grabbing text-base-content/40">
              <GripVertical class="w-5 h-5" />
            </div>
            <span class="font-medium">{{ dash.title }}</span>
            <span class="text-xs text-base-content/40 ml-auto">{{ dash.id }}</span>
          </div>
        </VueDraggable>
        <div v-if="dashboardItems.length === 0" class="text-center py-6 text-base-content/60">
          No hay dashboards instalados.
        </div>
      </section>

      <div class="divider" />

      <!-- Sidebar order -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Orden del Sidebar</h2>
            <p class="text-sm text-base-content/60">Grupos del menú lateral</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="resetSidebarOrder">
              <RotateCcw class="w-4 h-4" /> Restablecer
            </button>
            <button class="btn btn-sm btn-primary" @click="saveSidebarOrder">
              <Save class="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>

        <VueDraggable
          v-model="sidebarItems"
          :animation="150"
          :handle="'.drag-handle'"
          ghost-class="opacity-40"
          :item-key="(g: NavMenu) => g.heading ?? ''"
          class="space-y-2"
        >
          <div
            v-for="group in sidebarItems"
            :key="group.heading ?? ''"
            class="card card-body shadow-sm flex-row items-center gap-3 p-3 bg-base-100"
          >
            <div class="drag-handle cursor-grab active:cursor-grabbing text-base-content/40">
              <GripVertical class="w-5 h-5" />
            </div>
            <div class="flex-1">
              <span class="font-medium">{{ group.heading || '(sin título)' }}</span>
              <span class="block text-xs text-base-content/40">
                {{ group.items.length }} ítem(s)
              </span>
            </div>
          </div>
        </VueDraggable>
        <div v-if="sidebarItems.length === 0" class="text-center py-6 text-base-content/60">
          No hay grupos en el sidebar.
        </div>
      </section>
    </div>
  </SettingsLayout>
</template>