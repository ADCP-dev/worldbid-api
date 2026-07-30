<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

/* ------------------------------------------------------------------ *
 * SpecDashboard — renders a view spec with SVG-only charts.
 * Fetches view metadata + data from GET /api/v1/_spec/views/:viewName
 * ------------------------------------------------------------------ */

const props = defineProps<{
  viewName: string
}>()

const config = useRuntimeConfig()
const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`

interface ViewPanel {
  id: string
  title: string
  type: 'stat' | 'donut' | 'bar' | 'line' | 'custom'
  /** Grid span (1-12) for responsive layout */
  span?: number
  /** Stat value */
  value?: string | number
  /** Stat label (falls back to title) */
  label?: string
  /** Stat color (daisy variant) */
  color?: string
  /** Stat trend % */
  trend?: number
  /** Donut slices: [{ name, value, color }] */
  data?: Array<{ name: string; value: number; color?: string }>
  /** Bar chart: categories + series */
  categories?: string[]
  series?: Array<{ name: string; data: number[] }>
  /** Line chart: series of { x, y } points */
  lines?: Array<{ name: string; data: Array<{ x: number; y: number }> }>
  /** Extra metadata for custom panels */
  meta?: Record<string, unknown>
}

interface ViewSpec {
  name: string
  title?: string
  panels: ViewPanel[]
}

const loading = ref(true)
const error = ref<string | null>(null)
const viewSpec = ref<ViewSpec | null>(null)

/** DaisyUI color palette for charts */
const PALETTE = [
  '#570df8', // primary
  '#f000b8', // secondary
  '#37cdbe', // accent
  '#00b8d4', // info
  '#36d399', // success
  '#fbbd23', // warning
  '#f87272', // error
  '#a6adbb', // neutral
]

function colorFor(index: number, override?: string): string {
  return override ?? PALETTE[index % PALETTE.length]
}

/* =================== Stat card =================== */
const statCardClass = computed(() => {
  return (color?: string) => {
    const map: Record<string, string> = {
      primary: 'border-primary/30 bg-primary/5',
      secondary: 'border-secondary/30 bg-secondary/5',
      accent: 'border-accent/30 bg-accent/5',
      info: 'border-info/30 bg-info/5',
      success: 'border-success/30 bg-success/5',
      warning: 'border-warning/30 bg-warning/5',
      error: 'border-error/30 bg-error/5',
    }
    return map[color ?? 'primary'] ?? map.primary
  }
})

/* =================== Donut (SVG) =================== */
function donutSegments(slices: Array<{ value: number }>) {
  const total = slices.reduce((sum, s) => sum + (s.value || 0), 0)
  if (total <= 0) return []
  const R = 60
  const C = 2 * Math.PI * R
  let offset = 0
  return slices.map((s) => {
    const fraction = (s.value || 0) / total
    const dash = fraction * C
    const seg = {
      dasharray: `${dash} ${C - dash}`,
      dashoffset: -offset,
      fraction,
    }
    offset += dash
    return seg
  })
}

/* =================== Bar chart (SVG) =================== */
const BAR_W = 320
const BAR_H = 200
const BAR_PAD = 30

function barScales(categories: string[], series: Array<{ data: number[] }>) {
  const allValues = series.flatMap((s) => s.data)
  const maxVal = Math.max(1, ...allValues)
  const chartW = BAR_W - BAR_PAD * 2
  const chartH = BAR_H - BAR_PAD * 2
  const barGroupW = chartW / Math.max(1, categories.length)
  const barW = barGroupW / Math.max(1, series.length) * 0.8
  return { maxVal, chartW, chartH, barGroupW, barW, pad: BAR_PAD }
}

/** Per-panel bar layout cache keyed by panel id — avoids re-computing in template v-for. */
const barLayoutCache = computed(() => {
  const cache: Record<string, ReturnType<typeof barScales>> = {}
  if (viewSpec.value) {
    for (const panel of viewSpec.value.panels) {
      if (panel.type === 'bar') {
        cache[panel.id] = barScales(panel.categories ?? [], panel.series ?? [])
      }
    }
  }
  return cache
})

/* =================== Line chart (SVG) =================== */
const LINE_W = 320
const LINE_H = 200
const LINE_PAD = 30

function lineScales(lines: Array<{ data: Array<{ x: number; y: number }> }>) {
  const allPoints = lines.flatMap((l) => l.data)
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 1)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 1)
  const chartW = LINE_W - LINE_PAD * 2
  const chartH = LINE_H - LINE_PAD * 2
  return { minX, maxX, minY, maxY, chartW, chartH }
}

/** Per-panel line scales cache. */
const lineScalesCache = computed(() => {
  const cache: Record<string, ReturnType<typeof lineScales>> = {}
  if (viewSpec.value) {
    for (const panel of viewSpec.value.panels) {
      if (panel.type === 'line') {
        cache[panel.id] = lineScales(panel.lines ?? [])
      }
    }
  }
  return cache
})

function linePath(
  points: Array<{ x: number; y: number }>,
  scales: ReturnType<typeof lineScales>,
): string {
  if (!points.length) return ''
  const { minX, maxX, minY, maxY, chartW, chartH } = scales
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  return points
    .map((p, i) => {
      const x = LINE_PAD + ((p.x - minX) / rangeX) * chartW
      const y = LINE_PAD + chartH - ((p.y - minY) / rangeY) * chartH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/* =================== Grid span =================== */
function spanClass(span?: number): string {
  const s = span ?? 6
  // Map to Tailwind 12-col grid
  const map: Record<number, string> = {
    1: 'col-span-12 md:col-span-1',
    2: 'col-span-12 md:col-span-2',
    3: 'col-span-12 md:col-span-3',
    4: 'col-span-12 md:col-span-4',
    6: 'col-span-12 md:col-span-6',
    8: 'col-span-12 md:col-span-8',
    12: 'col-span-12',
  }
  return map[s] ?? 'col-span-12 md:col-span-6'
}

/* =================== Fetch =================== */
async function fetchView() {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<ViewSpec>(`/api/v1/_spec/views/${props.viewName}`, {
      baseURL,
    })
    viewSpec.value = res
  } catch (e) {
    error.value = (e as Error).message || 'Failed to load view'
    viewSpec.value = null
  } finally {
    loading.value = false
  }
}

onMounted(fetchView)
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold">
        {{ viewSpec?.title ?? viewName }}
      </h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- No panels -->
    <div
      v-else-if="viewSpec && !viewSpec.panels.length"
      class="text-center py-16 text-base-content/50"
    >
      No panels defined for this view.
    </div>

    <!-- Grid -->
    <div v-else-if="viewSpec" class="grid grid-cols-12 gap-4">
      <div
        v-for="(panel, idx) in viewSpec.panels"
        :key="panel.id"
        :class="spanClass(panel.span)"
      >
        <!-- ============ STAT ============ -->
        <div
          v-if="panel.type === 'stat'"
          class="card bg-base-100 shadow-sm border border-base-300 h-full"
          :class="statCardClass.value(panel.color)"
        >
          <div class="card-body p-5 gap-1">
            <p class="text-sm font-medium text-base-content/70">
              {{ panel.label ?? panel.title }}
            </p>
            <div class="text-3xl font-bold tracking-tight">
              {{ panel.value ?? '—' }}
            </div>
            <div v-if="panel.trend !== undefined" class="text-sm"
              :class="panel.trend >= 0 ? 'text-success' : 'text-error'"
            >
              {{ panel.trend >= 0 ? '+' : '' }}{{ panel.trend }}%
            </div>
          </div>
        </div>

        <!-- ============ DONUT ============ -->
        <div
          v-else-if="panel.type === 'donut'"
          class="card bg-base-100 shadow-sm border border-base-300 h-full"
        >
          <div class="card-body p-5">
            <h3 class="text-sm font-semibold mb-2">{{ panel.title }}</h3>
            <div class="flex items-center justify-center">
              <svg viewBox="0 0 160 160" class="w-40 h-40">
                <circle
                  cx="80" cy="80" r="60"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="28"
                  class="text-base-300"
                />
                <template
                  v-for="(slice, i) in donutSegments(panel.data ?? [])"
                  :key="i"
                >
                  <circle
                    cx="80" cy="80" r="60"
                    fill="none"
                    :stroke="colorFor(i, panel.data?.[i]?.color)"
                    stroke-width="28"
                    :stroke-dasharray="slice.dasharray"
                    :stroke-dashoffset="slice.dashoffset"
                    transform="rotate(-90 80 80)"
                  >
                    <title>
                      {{ panel.data?.[i]?.name }}: {{ panel.data?.[i]?.value }}
                      ({{ (slice.fraction * 100).toFixed(1) }}%)
                    </title>
                  </circle>
                </template>
              </svg>
            </div>
            <!-- Legend -->
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
              <div
                v-for="(d, i) in panel.data ?? []"
                :key="i"
                class="flex items-center gap-1.5 text-xs"
              >
                <span
                  class="w-3 h-3 rounded-sm inline-block"
                  :style="{ backgroundColor: colorFor(i, d.color) }"
                />
                <span>{{ d.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ BAR ============ -->
        <div
          v-else-if="panel.type === 'bar'"
          class="card bg-base-100 shadow-sm border border-base-300 h-full"
        >
          <div class="card-body p-5">
            <h3 class="text-sm font-semibold mb-2">{{ panel.title }}</h3>
            <div class="overflow-x-auto">
              <svg :viewBox="`0 0 ${BAR_W} ${BAR_H}`" class="w-full" :style="{ maxWidth: '100%' }">
                <!-- Y-axis grid lines -->
                <line
                  v-for="i in 4"
                  :key="`grid-${i}`"
                  :x1="barLayoutCache[panel.id]?.pad"
                  :x2="BAR_W - (barLayoutCache[panel.id]?.pad ?? BAR_PAD)"
                  :y1="(barLayoutCache[panel.id]?.pad ?? BAR_PAD) + (barLayoutCache[panel.id]?.chartH ?? 0) / 4 * i"
                  :y2="(barLayoutCache[panel.id]?.pad ?? BAR_PAD) + (barLayoutCache[panel.id]?.chartH ?? 0) / 4 * i"
                  stroke="currentColor"
                  stroke-width="0.5"
                  class="text-base-300"
                />
                <!-- Bars -->
                <template v-for="(cat, ci) in panel.categories ?? []" :key="`bar-${ci}`">
                  <template
                    v-for="(s, si) in panel.series ?? []"
                    :key="`bar-${ci}-${si}`"
                  >
                    <rect
                      :x="(barLayoutCache[panel.id]?.pad ?? BAR_PAD) + ci * (barLayoutCache[panel.id]?.barGroupW ?? 0) + si * (barLayoutCache[panel.id]?.barW ?? 0)"
                      :y="(barLayoutCache[panel.id]?.pad ?? BAR_PAD) + (barLayoutCache[panel.id]?.chartH ?? 0) - (s.data[ci] || 0) / (barLayoutCache[panel.id]?.maxVal ?? 1) * (barLayoutCache[panel.id]?.chartH ?? 0)"
                      :width="(barLayoutCache[panel.id]?.barW ?? 0) * 0.9"
                      :height="(s.data[ci] || 0) / (barLayoutCache[panel.id]?.maxVal ?? 1) * (barLayoutCache[panel.id]?.chartH ?? 0)"
                      :fill="colorFor(si)"
                      rx="3"
                    >
                      <title>{{ s.name }}: {{ s.data[ci] }}</title>
                    </rect>
                  </template>
                  <!-- X-axis label -->
                  <text
                    :x="(barLayoutCache[panel.id]?.pad ?? BAR_PAD) + ci * (barLayoutCache[panel.id]?.barGroupW ?? 0) + (barLayoutCache[panel.id]?.barGroupW ?? 0) / 2"
                    :y="BAR_H - 8"
                    text-anchor="middle"
                    class="fill-base-content/60 text-[9px]"
                  >
                    {{ cat.length > 8 ? cat.slice(0, 7) + '…' : cat }}
                  </text>
                </template>
              </svg>
            </div>
            <!-- Legend -->
            <div v-if="(panel.series ?? []).length > 1" class="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
              <div
                v-for="(s, si) in panel.series ?? []"
                :key="si"
                class="flex items-center gap-1.5 text-xs"
              >
                <span
                  class="w-3 h-3 rounded-sm inline-block"
                  :style="{ backgroundColor: colorFor(si) }"
                />
                <span>{{ s.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ LINE ============ -->
        <div
          v-else-if="panel.type === 'line'"
          class="card bg-base-100 shadow-sm border border-base-300 h-full"
        >
          <div class="card-body p-5">
            <h3 class="text-sm font-semibold mb-2">{{ panel.title }}</h3>
            <div class="overflow-x-auto">
              <svg :viewBox="`0 0 ${LINE_W} ${LINE_H}`" class="w-full">
                <!-- Grid -->
                <line
                  v-for="i in 4"
                  :key="`lgrid-${i}`"
                  :x1="LINE_PAD"
                  :x2="LINE_W - LINE_PAD"
                  :y1="LINE_PAD + ((LINE_H - LINE_PAD * 2) / 4) * i"
                  :y2="LINE_PAD + ((LINE_H - LINE_PAD * 2) / 4) * i"
                  stroke="currentColor"
                  stroke-width="0.5"
                  class="text-base-300"
                />
                <!-- Lines -->
                <polyline
                  v-for="(line, li) in panel.lines ?? []"
                  :key="`line-${li}`"
                  :points="linePath(line.data, lineScalesCache[panel.id] ?? lineScales(panel.lines ?? []))"
                  fill="none"
                  :stroke="colorFor(li)"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                >
                  <title>{{ line.name }}</title>
                </polyline>
              </svg>
            </div>
            <!-- Legend -->
            <div v-if="(panel.lines ?? []).length > 1" class="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
              <div
                v-for="(l, li) in panel.lines ?? []"
                :key="li"
                class="flex items-center gap-1.5 text-xs"
              >
                <span
                  class="w-3 h-3 rounded-sm inline-block"
                  :style="{ backgroundColor: colorFor(li) }"
                />
                <span>{{ l.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ CUSTOM ============ -->
        <div
          v-else-if="panel.type === 'custom'"
          class="card bg-base-100 shadow-sm border border-base-300 border-dashed h-full min-h-[120px]"
        >
          <div class="card-body p-5 items-center justify-center text-center">
            <h3 class="text-sm font-semibold">{{ panel.title }}</h3>
            <p class="text-xs text-base-content/50">Custom panel — render not implemented</p>
            <div v-if="panel.meta" class="text-xs text-base-content/40 mt-1">
              {{ JSON.stringify(panel.meta) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>