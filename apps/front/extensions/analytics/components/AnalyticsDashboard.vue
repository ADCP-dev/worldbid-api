<script setup lang="ts">
import NumberFlow from "@number-flow/vue";
import { BarChart3, CalendarRange, Clock, UserCheck } from "lucide-vue-next";
import { useApi } from '#imports'
import VisitorLineChart from './VisitorLineChart.vue'
import SourceBarChart from './SourceBarChart.vue'
import ConversionGauge from './ConversionGauge.vue'

const config = useRuntimeConfig()
const apiStats = `/analytics/visitors/stats`
const apiEvents = `/analytics/events/stats`

const api = useApi()
const { data: stats, pending } = await useAsyncData('analytics-stats', () => api.get(apiStats))
const { data: eventStats } = await useAsyncData('analytics-events', () => api.get(apiEvents))

const totalVisitors = computed(() => stats.value?.totalVisitors ?? 0)
const uniqueVisitors = computed(() => stats.value?.uniqueVisitors ?? 0)
const visitorsThisMonth = computed(() => stats.value?.visitorsThisMonth ?? 0)
const visitorsToday = computed(() => stats.value?.visitorsToday ?? 0)
const prevMonthVisitors = computed(() => stats.value?.prevMonthVisitors ?? 0)

const monthDelta = computed(() => {
  if (!prevMonthVisitors.value) return null
  const delta = ((visitorsThisMonth.value - prevMonthVisitors.value) / prevMonthVisitors.value) * 100
  return { value: Math.abs(delta).toFixed(0), up: delta >= 0 }
})

const monthDeltaText = computed(() => {
  if (!prevMonthVisitors.value || !monthDelta.value) return ''
  return `${monthDelta.value.up ? '+' : '-'}${monthDelta.value.value}% vs mes anterior`
})

const topPages = computed(() => {
  if (!stats.value?.pageViews) return []
  const total = stats.value.totalVisitors || 1
  return Object.entries(stats.value.pageViews)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({
      name: path,
      count,
      pct: ((count / total) * 100).toFixed(1),
    }))
})

const topSources = computed(() => stats.value?.topSources ?? [])
const dailySeries = computed(() => stats.value?.dailySeries ?? [])
const conversionRate = computed(() => eventStats.value?.conversionRate ?? 0)
const totalEvents = computed(() => eventStats.value?.totalEvents ?? 0)

const eventsByFrequency = computed(() => {
  if (!eventStats.value?.byType) return []
  return Object.entries(eventStats.value.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }))
})

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    'cta_clicked': 'Click en Agendar',
    'form_submitted': 'Formulario enviado',
    'calculator_used': 'Calculadora usada',
    'appointment_modal_opened': 'Modal de Cita abierto',
    'analysis_call_scheduled': 'Llamada de Análisis agendada',
    'mortgage_study_scheduled': 'Estudio Hipotecario agendado',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

function eventPct(_type: string, count: number): string {
  const total = stats.value?.totalVisitors || 1
  const pct = ((count / total) * 100).toFixed(1)
  return `(${pct}% de visitas)`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Stats cards -->
    <div class="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
      <DashboardCard title="Visitantes Totales" :icon="BarChart3" :value="totalVisitors" />
      <DashboardCard title="Visitantes Únicos" :icon="UserCheck" :value="uniqueVisitors" />
      <DashboardCard
        title="Este Mes"
        :icon="CalendarRange"
        :value="visitorsThisMonth"
        :description-suffix="monthDeltaText"
        :description-class="monthDelta?.up ? 'text-success' : 'text-error'"
      />
      <DashboardCard title="Hoy" :icon="Clock" :value="visitorsToday" />
    </div>

    <!-- Charts row 1 -->
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 ">
      <div class="card bg-base-100 shadow-sm border border-base-300 xl:col-span-2">
        <div class="card-body p-4">
          <h3 class="card-title text-base font-semibold">Visitas diarias (30 días)</h3>
          <VisitorLineChart :data="dailySeries" />
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-4">
          <h3 class="card-title text-base font-semibold mb-2">Páginas más visitadas</h3>
          <div v-if="topPages.length" class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="(page, i) in topPages" :key="page.name"
              class="flex justify-between items-center p-2 rounded-lg"
              :class="i < 3 ? 'bg-primary/10 border border-primary/20' : 'bg-base-200'">
              <div>
                <div class="flex items-center gap-2">
                  <span v-if="i < 3" class="text-xs font-bold w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center">{{ i + 1 }}</span>
                  <span v-else class="w-5 text-center text-xs text-base-content/40">{{ i + 1 }}</span>
                  <p class="text-sm font-medium leading-none truncate max-w-[180px]">{{ page.name }}</p>
                </div>
                <p class="text-xs text-base-content/50 ml-7">{{ page.pct }}% del tráfico</p>
              </div>
              <span class="badge badge-sm">{{ page.count }}</span>
            </div>
          </div>
          <p v-else-if="!pending" class="text-base-content/40 text-sm">Sin datos aún.</p>
        </div>
      </div>
    </div>

    <!-- Charts row 2 -->
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 ">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-4">
          <h3 class="card-title text-base font-semibold">Fuentes de tráfico</h3>
          <SourceBarChart :data="topSources" />
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-4 items-center">
          <h3 class="card-title text-base font-semibold self-start">Tasa de conversión</h3>
          <ConversionGauge :value="conversionRate" />
          <p class="text-xs text-base-content/50 -mt-4">Formularios y CTA / Visitantes únicos (este mes)</p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm border border-base-300 xl:col-span-1">
        <div class="card-body p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="card-title text-base font-semibold">Eventos</h3>
            <span v-if="totalEvents" class="text-xs text-base-content/50">{{ totalEvents }} totales</span>
          </div>
          <div v-if="eventsByFrequency.length" class="space-y-2 max-h-60 overflow-y-auto">
            <div v-for="event in eventsByFrequency" :key="event.type" class="flex justify-between items-center p-2 bg-base-200 rounded-lg">
              <div>
                <span class="text-sm font-medium">{{ eventLabel(event.type) }}</span>
                <span class="text-xs text-base-content/50 ml-2">{{ eventPct(event.type, event.count) }}</span>
              </div>
              <span class="badge badge-sm badge-primary">{{ event.count }}</span>
            </div>
          </div>
          <p v-else class="text-base-content/40 text-sm">Sin eventos aún. Los eventos se registran al interactuar con los CTAs y formularios.</p>
        </div>
      </div>
    </div>
  </div>
</template>