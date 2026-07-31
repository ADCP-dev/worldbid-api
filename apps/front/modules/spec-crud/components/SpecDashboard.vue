<script setup lang="ts">
/**
 * SpecDashboard — renders dashboards from spec metadata using Apache ECharts.
 *
 * Reads panel data from GET /api/v1/_spec/views/:name and renders each panel
 * with the appropriate ECharts option based on chart type.
 */
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { useSpecResource } from '../composables/useSpecResource'

interface PanelData {
  name: string
  chart: string
  label?: string
  data: {
    value?: number
    labels?: string[]
    values?: number[]
    [key: string]: unknown
  }
}

interface DashboardData {
  name: string
  displayName?: string
  panels: PanelData[]
}

const props = defineProps<{
  viewName: string
}>()

const { fetchView } = useSpecResource()
const dashboard = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const chartInstances = ref<Record<string, echarts.ECharts>>({})
const containerRefs = ref<Record<string, HTMLElement | null>>({})

const panelGridClass = computed(() => {
  if (!dashboard.value) return 'grid-cols-1'
  const count = dashboard.value.panels.length
  if (count <= 2) return 'grid-cols-1 lg:grid-cols-2'
  if (count <= 4) return 'grid-cols-1 lg:grid-cols-2'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
})

async function loadDashboard() {
  loading.value = true
  error.value = null
  try {
    const data = await fetchView(props.viewName)
    dashboard.value = data as unknown as DashboardData
  } catch (e: unknown) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function buildChartOption(panel: PanelData): echarts.EChartsOption {
  const { chart, data, label } = panel

  switch (chart) {
    case 'stat': {
      return {
        title: {
          text: data.value != null ? String(data.value) : '—',
          subtext: label || panel.name,
          left: 'center',
          top: 'center',
          textStyle: { fontSize: 48, fontWeight: 'bold' },
          subtextStyle: { fontSize: 14, color: '#6b7280' },
        },
        tooltip: { show: false },
        series: [],
      }
    }

    case 'donut': {
      const labels = data.labels || []
      const values = data.values || []
      return {
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', top: 'middle' },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['60%', '50%'],
            avoidLabelOverlap: true,
            data: labels.map((l, i) => ({ name: l, value: values[i] })),
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
            label: { show: false },
            labelLine: { show: false },
          },
        ],
      }
    }

    case 'bar': {
      const labels = data.labels || []
      const values = data.values || []
      return {
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: { rotate: labels.length > 6 ? 30 : 0 },
        },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          },
        ],
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      }
    }

    case 'line': {
      const labels = data.labels || []
      const values = data.values || []
      return {
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels, boundaryGap: false },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'line',
            data: values,
            smooth: true,
            areaStyle: { opacity: 0.15 },
            itemStyle: { width: 2 },
          },
        ],
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      }
    }

    case 'custom': {
      // For custom charts, pass data directly as series
      return {
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14 } },
        dataset: { source: data },
      }
    }

    default:
      return { title: { text: `Unknown chart: ${chart}` } }
  }
}

function renderCharts() {
  if (!dashboard.value) return
  for (const panel of dashboard.value.panels) {
    const el = containerRefs.value[panel.name]
    if (!el) continue

    // Dispose existing instance
    if (chartInstances.value[panel.name]) {
      chartInstances.value[panel.name].dispose()
    }

    const instance = echarts.init(el)
    instance.setOption(buildChartOption(panel))
    chartInstances.value[panel.name] = instance
  }
}

function handleResize() {
  for (const instance of Object.values(chartInstances.value)) {
    instance.resize()
  }
}

onMounted(async () => {
  await loadDashboard()
  // Wait for DOM to render panel containers
  setTimeout(renderCharts, 0)
  window.addEventListener('resize', handleResize)
})

watch(() => props.viewName, async () => {
  await loadDashboard()
  setTimeout(renderCharts, 0)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  for (const instance of Object.values(chartInstances.value)) {
    instance.dispose()
  }
})
</script>

<template>
  <div class="spec-dashboard">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>

    <div v-else-if="error" class="text-red-500 p-4">
      Error loading dashboard: {{ error }}
    </div>

    <div v-else-if="dashboard">
      <h2 v-if="dashboard.displayName" class="text-2xl font-bold mb-6">
        {{ dashboard.displayName }}
      </h2>

      <div :class="['grid gap-6', panelGridClass]">
        <div
          v-for="panel in dashboard.panels"
          :key="panel.name"
          class="bg-white rounded-lg shadow p-4 border border-gray-200"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-gray-700">{{ panel.label || panel.name }}</h3>
            <span class="text-xs text-gray-400 uppercase">{{ panel.chart }}</span>
          </div>

          <!-- Stat card: render inline, no chart container needed -->
          <div
            v-if="panel.chart === 'stat'"
            class="flex flex-col items-center justify-center py-6"
          >
            <span class="text-5xl font-bold text-gray-800">
              {{ panel.data.value ?? '—' }}
            </span>
            <span class="text-sm text-gray-500 mt-1">{{ panel.label }}</span>
          </div>

          <!-- All other charts: ECharts container -->
          <div
            v-else
            :ref="(el) => { containerRefs[panel.name] = el as HTMLElement | null }"
            :style="{ width: '100%', height: '280px' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spec-dashboard {
  width: 100%;
}
</style>