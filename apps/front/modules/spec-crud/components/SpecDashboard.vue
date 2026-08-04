<script setup lang="ts">
/**
 * SpecDashboard — renders dashboards from spec metadata using Apache ECharts.
 *
 * Reads panel data from GET /api/v1/_spec/views/:name and renders each panel
 * with the appropriate renderer based on chart type:
 *   - stat / donut / bar / line  → Apache ECharts (unchanged since pre-change)
 *   - table                      → mini read-only DaisyUI table (panel.data.rows)
 *   - list                       → compact DaisyUI list of records
 *   - custom                     → Vue component resolved via spec-components map
 *
 * spec-engine-v2-frontend-and-loader (Slice 5):
 *   - Panel types `table` and `list` render inline (no ECharts).
 *   - `PanelSpec.component` (string) resolves via the `spec-components` map;
 *     unresolved names render a visible inline error block (not a crash).
 *   - `ViewSpec.type === 'custom'` delegates the entire view to the named
 *     Vue component (panel config ignored).
 *   - Drill-down: ECharts `chart.on('click', params => filters[dim] = name)`;
 *     a `watch(filters)` refetches the view with the merged filter. A
 *     breadcrumb chip row renders active filters with a remove control.
 *   - Time-range selector (7d/30d/90d) in the toolbar; reactive `timeRange`
 *     ref is forwarded to `fetchView(name, { timeRange })` and only
 *     re-queries when changed.
 *   - `PanelSpec.span` (1-12) controls the grid column span (default 4).
 *   - `PanelSpec.height` (string | number) sizes the panel container
 *     (default '280px'). 'auto' sizes to content.
 *
 * Backward compatibility: when the view has no `type` (defaults to
 * 'dashboard'), no panels of type `table`/`list`/`custom`, no `component`,
 * no `span`, no `height`, and no drill-down clicks, the dashboard renders
 * identically to the pre-change version: 4 charts + stat, height 280px,
 * grid columns derived from panel count.
 */
import { ref, onMounted, watch, onUnmounted, computed, shallowRef, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useSpecResource } from '../composables/useSpecResource'
import type { DashboardPanel, PanelChartType } from '../composables/useSpecResource'
import { resolveSpecComponent } from '../setup/spec-components'

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

const props = defineProps<{
  viewName: string
}>()

/* ------------------------------------------------------------------ *
 * State: time-range + drill-down filters
 * ------------------------------------------------------------------ */

/** Time-range selector options. 7d = last 7 days, 30d, 90d. */
const TIME_RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const

/** Active time range. Default '30d' (matches the pre-change tasks.spec.yaml). */
const timeRange = ref<string>('30d')

/**
 * Active drill-down filters. Keyed by the groupBy dimension name
 * (e.g. `status`, `priority`); value is the clicked category label.
 * ECharts click handler writes here; the breadcrumb renders + removes.
 */
const filters = ref<Record<string, string>>({})

/** The view query args (timeRange + filter) — reactive, feeds useViewQuery. */
const viewArgs = computed(() => ({
  timeRange: timeRange.value,
  filter: { ...filters.value },
}))

/* ------------------------------------------------------------------ *
 * Data: load the view
 * ------------------------------------------------------------------ */

const { useViewQuery } = useSpecResource()
const { data: dashboard, isLoading, error } = useViewQuery(
  () => props.viewName,
  viewArgs,
)

const loading = computed(() => isLoading.value)

/* ------------------------------------------------------------------ *
 * ECharts instances — keyed by panel name
 * ------------------------------------------------------------------ */

const chartInstances = ref<Record<string, echarts.ECharts>>({})
const containerRefs = ref<Record<string, HTMLElement | null>>({})

/* ------------------------------------------------------------------ *
 * Custom view delegation (ViewSpec.type === 'custom')
 * ------------------------------------------------------------------ */

/**
 * The custom component for ViewSpec.type==='custom', or null when the view
 * is a normal dashboard (or when the named component is not registered).
 *
 * `shallowRef` because Vue components are opaque objects; deep reactivity
 * is unnecessary and triggers Vue warnings.
 */
const customViewComponent = shallowRef<{ component: ReturnType<typeof resolveSpecComponent>; name: string } | null>(null)

watch(dashboard, (val) => {
  if (val && val.type === 'custom' && val.component) {
    const resolved = resolveSpecComponent(val.component)
    customViewComponent.value = resolved
      ? { component: resolved, name: val.component }
      : null
  } else {
    customViewComponent.value = null
  }
}, { immediate: true })

/** True when the view is custom AND the component resolved successfully. */
const isCustomView = computed(() => !!customViewComponent.value)
/** True when the view is custom but the component name did NOT resolve. */
const customViewMissing = computed(
  () => dashboard.value?.type === 'custom' && !!dashboard.value.component && !customViewComponent.value,
)
/** The unresolved component name (for the error block). */
const missingCustomName = computed(() => dashboard.value?.component ?? '')

/* ------------------------------------------------------------------ *
 * Theme colors — read from CSS variables (DaisyUI theme)
 * ------------------------------------------------------------------ */

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
  const get = (name: string, fallback: string) =>
    getComputedStyle(root).getPropertyValue(name).trim() || fallback
  return {
    primary: get('--p', '#9a66e6'),
    secondary: get('--s', '#a78bfa'),
    neutral: get('--n', '#24252a'),
    baseContent: get('--bc', '#f7f8fa'),
  }
})

/* ------------------------------------------------------------------ *
 * Panel layout helpers — span + height
 * ------------------------------------------------------------------ */

/**
 * Resolve a panel's grid column span. `PanelSpec.span` (1-12) wins; default
 * is 4 (3 panels per row on a 12-col grid, matching the pre-change layout
 * for a 4-5 panel dashboard).
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): added.
 */
function spanFor(panel: DashboardPanel): number {
  const span = panel.span
  if (typeof span === 'number' && span >= 1 && span <= 12) return span
  return 4
}

/** Map a numeric span (1-12) to a Tailwind grid-cols class. */
function spanClass(span: number): string {
  return `col-span-12 md:col-span-${Math.min(12, Math.max(1, span))}`
}

/**
 * Resolve a panel's container height as a CSS string.
 * - string → use as-is ('280px', 'auto', '400px')
 * - number → treat as px
 * - undefined → '280px' (pre-change default)
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): added.
 */
function heightFor(panel: DashboardPanel): string {
  const h = panel.height
  if (typeof h === 'string') return h
  if (typeof h === 'number' && Number.isFinite(h)) return `${h}px`
  return '280px'
}

/**
 * Panels to render. When the view is custom, the panel grid is not used
 * (the custom component renders everything), so this returns [].
 */
const renderablePanels = computed<DashboardPanel[]>(() => {
  if (!dashboard.value) return []
  if (isCustomView.value) return []
  return dashboard.value.panels
})

/* ------------------------------------------------------------------ *
 * Chart option builder — stat / donut / bar / line
 * ------------------------------------------------------------------ */

function buildChartOption(panel: DashboardPanel): echarts.EChartsOption {
  const { chart, data, label, name } = panel
  const colors = themeColors.value
  const palette = [colors.primary, colors.secondary, '#facc15', '#4ade80', '#fb7185', '#60a5fa']

  switch (chart) {
    case 'stat': {
      return {
        title: {
          text: data.value != null ? String(data.value) : '—',
          subtext: label || name,
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
        title: { text: label || name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
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
        title: { text: label || name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
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
        title: { text: label || name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
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
      // The 'custom' chart type on a PANEL is a legacy ECharts passthrough.
      // It is distinct from ViewSpec.type==='custom'. We keep the pre-change
      // behavior: build a minimal ECharts option with the dataset.
      return {
        color: palette,
        title: { text: label || name, left: 'center', textStyle: { fontSize: 14, color: colors.baseContent } },
        dataset: { source: data },
      }
    }

    default:
      return { title: { text: `Unknown chart: ${chart}`, textStyle: { color: colors.baseContent } } }
  }
}

/* ------------------------------------------------------------------ *
 * Drill-down: ECharts click → filters
 * ------------------------------------------------------------------ */

/**
 * The groupBy dimension of a panel — used as the drill-down key. When a
 * panel has `query.groupBy`, clicking a slice/bar writes
 * `filters[query.groupBy] = params.name`.
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): added.
 */
function drillKeyFor(panel: DashboardPanel): string | null {
  const gb = panel.query?.groupBy
  if (typeof gb === 'string' && gb.length) return gb
  return null
}

/**
 * ECharts click handler factory. Returns a function bound to the panel
 * that writes the clicked category into the shared `filters` ref. The
 * `watch(filters)` below triggers a refetch via the reactive viewArgs.
 *
 * Only donut/bar/line charts emit meaningful click params with `.name`;
 * stat panels do not register a click handler.
 */
function makeClickHandler(panel: DashboardPanel): (params: { name?: string } & Record<string, unknown>) => void {
  const key = drillKeyFor(panel)
  return (params) => {
    if (!key) return
    const value = params?.name
    if (typeof value !== 'string' || !value) return
    // Toggle: clicking the already-active slice clears it (drill-back).
    if (filters.value[key] === value) {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(filters.value)) {
        if (k !== key) next[k] = v
      }
      filters.value = next
    } else {
      filters.value = { ...filters.value, [key]: value }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Filter breadcrumb helpers
 * ------------------------------------------------------------------ */

const activeFilterEntries = computed(() => Object.entries(filters.value))

function removeFilter(key: string) {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters.value)) {
    if (k !== key) next[k] = v
  }
  filters.value = next
}

function clearAllFilters() {
  filters.value = {}
}

/* ------------------------------------------------------------------ *
 * Chart rendering — init / dispose / resize
 * ------------------------------------------------------------------ */

function isEchartsPanel(chart: PanelChartType): boolean {
  return chart === 'stat' || chart === 'donut' || chart === 'bar' || chart === 'line' || chart === 'custom'
}

function renderCharts() {
  if (!dashboard.value) return
  for (const panel of dashboard.value.panels) {
    // Only ECharts-backed panels need an instance. table/list/custom-component
    // panels render via Vue templates, not ECharts.
    if (!isEchartsPanel(panel.chart)) continue
    if (panel.component) continue // custom component panel — not ECharts

    const el = containerRefs.value[panel.name]
    if (!el) continue

    if (chartInstances.value[panel.name]) {
      chartInstances.value[panel.name].dispose()
    }

    const instance = echarts.init(el)
    instance.setOption(buildChartOption(panel))

    // Drill-down click handler — only for panels with a groupBy.
    if (drillKeyFor(panel)) {
      instance.on('click', makeClickHandler(panel) as (params: echarts.EChartsOption | Record<string, unknown>) => void)
    }

    chartInstances.value[panel.name] = instance
  }
}

function handleResize() {
  for (const instance of Object.values(chartInstances.value)) {
    instance.resize()
  }
}

/* ------------------------------------------------------------------ *
 * Custom panel component resolution (PanelSpec.component)
 * ------------------------------------------------------------------ */

/**
 * Resolve a panel's custom component (when `panel.component` is set).
 * Returns `{ component, name }` or `null` when not registered.
 *
 * Note: a panel with `chart: 'custom'` AND `component: 'X'` is a custom
 * COMPONENT panel (Vue), distinct from the legacy ECharts 'custom' chart
 * type that has no `component` field.
 */
function panelCustomComponent(panel: DashboardPanel): { component: ReturnType<typeof resolveSpecComponent>; name: string } | null {
  if (!panel.component) return null
  const resolved = resolveSpecComponent(panel.component)
  return resolved ? { component: resolved, name: panel.component } : null
}

/**
 * True when a panel has a `component` that did NOT resolve. Used to render
 * the inline error block (per design: "visible error, not a crash").
 */
function panelComponentMissing(panel: DashboardPanel): boolean {
  return !!panel.component && !resolveSpecComponent(panel.component)
}

/* ------------------------------------------------------------------ *
 * Table / list panel helpers
 * ------------------------------------------------------------------ */

/**
 * Rows for a table/list panel. The view payload may include them in
 * `panel.data.rows`; when absent (the backend hasn't materialized them),
 * the panel renders an empty-state message.
 */
function panelRows(panel: DashboardPanel): Array<Record<string, unknown>> {
  const rows = panel.data?.rows
  return Array.isArray(rows) ? rows : []
}

/**
 * Fields for a table/list panel. Falls back to the keys of the first row
 * when `panel.data.fields` is not provided.
 */
function panelFields(panel: DashboardPanel): string[] {
  const explicit = panel.data?.fields
  if (Array.isArray(explicit) && explicit.length) return explicit
  const rows = panelRows(panel)
  if (rows.length && typeof rows[0] === 'object') {
    return Object.keys(rows[0]).slice(0, 6)
  }
  return []
}

/* ------------------------------------------------------------------ *
 * Watchers: re-render charts when the dashboard data or filters change
 * ------------------------------------------------------------------ */

watch(dashboard, () => {
  if (dashboard.value && !isCustomView.value) {
    // nextTick ensures the template has stamped the container divs before
    // we try to init ECharts into them.
    nextTick(renderCharts)
  }
})

watch(() => viewArgs.value, () => {
  // The view refetches automatically (useViewQuery queryKey changed).
  // When the new data arrives, the dashboard watcher above re-renders.
  // We also dispose the old chart instances here so stale charts don't
  // flash briefly during the refetch.
  for (const instance of Object.values(chartInstances.value)) {
    instance.dispose()
  }
  // Rebuild the instances map without dynamic-delete (eslint-safe).
  chartInstances.value = {}
})

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

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
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-error p-4">
      Error loading dashboard: {{ error.message || 'Unknown error' }}
    </div>

    <!-- ViewSpec.type === 'custom' → delegate entire view to a Vue component -->
    <template v-else-if="dashboard">
      <!-- Custom view: component resolved -->
      <component
        :is="customViewComponent!.component"
        v-if="isCustomView"
        :view="dashboard"
        :filters="filters"
        :time-range="timeRange"
        @drill-down="(key: string, value: string) => (filters = { ...filters, [key]: value })"
        @clear-filter="(key: string) => removeFilter(key)"
        @clear-filters="clearAllFilters"
      />

      <!-- Custom view: component NOT resolved → visible error block -->
      <div
        v-else-if="customViewMissing"
        class="alert alert-error"
      >
        <div>
          <div class="font-semibold">Component not registered</div>
          <div class="text-sm">
            View "{{ dashboard.name }}" declares <code>type: custom</code> with
            <code>component: "{{ missingCustomName }}"</code>, but no component
            with that name is registered in
            <code>modules/spec-crud/setup/spec-components.ts</code>.
          </div>
        </div>
      </div>

      <!-- Normal dashboard view -->
      <div v-else>
        <!-- Toolbar: title + time-range + drill-down breadcrumb -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 v-if="dashboard.displayName" class="text-2xl font-bold text-base-content">
            {{ dashboard.displayName }}
          </h2>

          <div class="flex items-center gap-2">
            <label class="text-sm text-base-content/60" for="spec-dashboard-time-range">Range:</label>
            <select
              id="spec-dashboard-time-range"
              v-model="timeRange"
              class="select select-sm select-bordered"
              data-action="time-range"
            >
              <option v-for="r in TIME_RANGES" :key="r.value" :value="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Drill-down breadcrumb chips -->
        <div v-if="activeFilterEntries.length > 0" class="flex flex-wrap items-center gap-2 mb-4">
          <span class="text-sm text-base-content/60">Drilled down:</span>
          <span
            v-for="[key, value] in activeFilterEntries"
            :key="`filter-${key}`"
            class="badge badge-primary gap-1"
          >
            {{ key }} = {{ value }}
            <button
              class="ml-1 hover:opacity-100"
              data-action="remove-filter"
              :aria-label="`Remove filter ${key}`"
              @click="removeFilter(key)"
            >×</button>
          </span>
          <button
            class="btn btn-ghost btn-xs"
            data-action="clear-filters"
            @click="clearAllFilters"
          >
            Clear all
          </button>
        </div>

        <!-- Panel grid (12-col) -->
        <div class="grid grid-cols-12 gap-4">
          <div
            v-for="panel in renderablePanels"
            :key="panel.name"
            :class="['bg-base-100 rounded-box shadow p-4 border border-base-300', spanClass(spanFor(panel))]"
          >
            <!-- Panel header -->
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-base-content/70">
                {{ panel.label || panel.name }}
              </h3>
              <span class="text-xs text-base-content/50 uppercase">{{ panel.chart }}</span>
            </div>

            <!-- Stat panel: inline render, no ECharts container -->
            <div
              v-if="panel.chart === 'stat'"
              class="flex flex-col items-center justify-center py-6"
            >
              <span class="text-5xl font-bold text-base-content">
                {{ panel.data.value ?? '—' }}
              </span>
              <span class="text-sm text-base-content/70 mt-1">{{ panel.label }}</span>
            </div>

            <!-- Table panel: mini read-only DaisyUI table -->
            <div
              v-else-if="panel.chart === 'table'"
              class="overflow-x-auto"
              :style="{ maxHeight: heightFor(panel) }"
            >
              <table v-if="panelRows(panel).length" class="table table-zebra table-xs">
                <thead>
                  <tr>
                    <th
                      v-for="field in panelFields(panel)"
                      :key="field"
                      class="text-base-content/70"
                    >
                      {{ field }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in panelRows(panel)"
                    :key="`row-${panel.name}-${idx}`"
                    class="hover"
                  >
                    <td v-for="field in panelFields(panel)" :key="field">
                      <SpecFieldRenderer
                        :value="row[field]"
                        :field="{ name: field, label: field }"
                        :row="row"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="text-center text-base-content/40 py-8 text-sm">
                No records.
              </div>
            </div>

            <!-- List panel: compact DaisyUI list -->
            <div
              v-else-if="panel.chart === 'list'"
              class="overflow-y-auto"
              :style="{ maxHeight: heightFor(panel) }"
            >
              <ul v-if="panelRows(panel).length" class="menu menu-sm gap-1">
                <li
                  v-for="(row, idx) in panelRows(panel)"
                  :key="`list-${panel.name}-${idx}`"
                  class="bordered"
                >
                  <div class="flex flex-wrap items-baseline gap-2 py-1">
                    <span
                      v-for="field in panelFields(panel)"
                      :key="field"
                      class="text-sm"
                    >
                      <span class="text-base-content/50">{{ field }}:</span>
                      <SpecFieldRenderer
                        :value="row[field]"
                        :field="{ name: field, label: field }"
                        :row="row"
                      />
                    </span>
                  </div>
                </li>
              </ul>
              <div v-else class="text-center text-base-content/40 py-8 text-sm">
                No records.
              </div>
            </div>

            <!-- Custom component panel (PanelSpec.component) -->
            <template v-else-if="panelCustomComponent(panel)">
              <component
                :is="panelCustomComponent(panel)!.component"
                :panel="panel"
                :filters="filters"
                :time-range="timeRange"
                @drill-down="(key: string, value: string) => (filters = { ...filters, [key]: value })"
                @clear-filter="(key: string) => removeFilter(key)"
              />
            </template>

            <!-- Custom component panel: NOT resolved → visible error block -->
            <div
              v-else-if="panelComponentMissing(panel)"
              class="alert alert-error alert-sm"
            >
              <div>
                <div class="font-semibold text-sm">Component not registered</div>
                <div class="text-xs">
                  Panel "{{ panel.name }}" declares
                  <code>component: "{{ panel.component }}"</code>, but no
                  component with that name is registered in
                  <code>modules/spec-crud/setup/spec-components.ts</code>.
                </div>
              </div>
            </div>

            <!-- ECharts panel (donut/bar/line/custom-chart) -->
            <div
              v-else
              :ref="(el) => { containerRefs[panel.name] = el as HTMLElement | null }"
              :style="{ width: '100%', height: heightFor(panel) }"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.spec-dashboard {
  width: 100%;
}
</style>