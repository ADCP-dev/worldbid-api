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

const props = defineProps<{
  viewName: string
}>()

const { useViewQuery } = useSpecResource()
const { data: dashboard, isLoading, error } = useViewQuery(() => props.viewName)

const loading = computed(() => isLoading.value)
const chartInstances = ref<Record<string, echarts.ECharts>>({})
const containerRefs = ref<Record<string, HTMLElement | null>>({})

const panelGridClass = computed(() => {
  if (!dashboard.value) return 'grid-cols-1'
  const count = dashboard.value.panels.length
  if (count <= 2) return 'grid-cols-1 lg:grid-cols-2'
  if (count <= 4) return 'grid-cols-1 md:grid-cols-2'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
})

const themeColors = computed(() => {
  if (typeof document === 'undefined') {
    return {
      primary: '#9a66e6',
      secondary: '#a78bfa',
      neutral: '#24252a',
      baseContent: '#f7f8fa',
    }
  }
  const root = document.documentElement
  const get = (name: string, fallback: string) => getComputedStyle(root).getPropertyValue(name).trim() || fallback
  return {
    primary: get('--p', '#9a66e6'),
    secondary: get('--s', '#a78bfa'),
    neutral: get('--n', '#24252a'),
    baseContent: get('--bc', '#f7f8fa'),
  }
})

function buildChartOption(panel: PanelData): echarts.EChartsOption {
  const { chart, data, label } = panel
  const colors = themeColors.value
  const palette = [colors.primary, colors.secondary, '#facc15', '#4ade80', '#fb7185', '#60a5fa']

  switch (chart) {
    case 'stat': {
      return {
        title: {
          text: data.value != null ? String(data.value) : '—',
          subtext: label || panel.name,
          left: 'center',
          top: 'center',
          textStyle: { fontSize: 48, fontWeight: 'bold', color: colors.primary },
          subtextStyle: { fontSize: 14, color: colors.baseContent },
        },
        tooltip: { show: false },
        series: [],
      }
    }

    case 'donut': {
      const labels = data.labels || []
      const values = data.values || []
      return {
        color: palette,
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', top: 'middle', textStyle: { color: colors.baseContent } },
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
        color: palette,
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: { rotate: labels.length > 6 ? 30 : 0, color: colors.baseContent },
          axisLine: { lineStyle: { color: colors.baseContent } },
        },
        yAxis: { type: 'value', axisLabel: { color: colors.baseContent }, splitLine: { lineStyle: { color: colors.neutral } } },
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.primary },
          },
        ],
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      }
    }

    case 'line': {
      const labels = data.labels || []
      const values = data.values || []
      return {
        color: palette,
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { color: colors.baseContent }, axisLine: { lineStyle: { color: colors.baseContent } } },
        yAxis: { type: 'value', axisLabel: { color: colors.baseContent }, splitLine: { lineStyle: { color: colors.neutral } } },
        series: [
          {
            type: 'line',
            data: values,
            smooth: true,
            areaStyle: { opacity: 0.15, color: colors.primary },
            itemStyle: { color: colors.primary },
            lineStyle: { width: 2 },
          },
        ],
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      }
    }

    case 'custom': {
      return {
        color: palette,
        title: { text: label || panel.name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
        dataset: { source: data },
      }
    }

    default:
      return { title: { text: `Unknown chart: ${chart}`, textStyle: { color: colors.baseContent } } }
  }
}

function renderCharts() {
  if (!dashboard.value) return
  for (const panel of dashboard.value.panels) {
    const el = containerRefs.value[panel.name]
    if (!el) continue

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

watch(dashboard, () => {
  if (dashboard.value) {
    setTimeout(renderCharts, 0)
  }
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
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
      <div class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else-if="error" class="text-error p-4">
      Error loading dashboard: {{ error.message || 'Unknown error' }}
    </div>

    <div v-else-if="dashboard">
      <h2 v-if="dashboard.displayName" class="text-2xl font-bold mb-6 text-base-content">
        {{ dashboard.displayName }}
      </h2>

      <div :class="['grid gap-6', panelGridClass]">
        <div
          v-for="panel in dashboard.panels"
          :key="panel.name"
          class="bg-base-100 rounded-box shadow p-4 border border-base-300"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-base-content/70">{{ panel.label || panel.name }}</h3>
            <span class="text-xs text-base-content/50 uppercase">{{ panel.chart }}</span>
          </div>

          <!-- Stat card: render inline, no chart container needed -->
          <div
            v-if="panel.chart === 'stat'"
            class="flex flex-col items-center justify-center py-6"
          >
            <span class="text-5xl font-bold text-base-content">
              {{ panel.data.value ?? '—' }}
            </span>
            <span class="text-sm text-base-content/70 mt-1">{{ panel.label }}</span>
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
