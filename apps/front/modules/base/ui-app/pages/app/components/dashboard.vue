<script setup lang="ts">
import { computed } from 'vue'
import {
  Users,
  DollarSign,
  Activity,
  ShoppingCart,
  Bell,
  FileText,
  CheckCircle,
  AlertCircle,
  Plus,
} from 'lucide-vue-next'
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue'
import LineChart from '@base/ui-app/components/dashboard/LineChart.vue'
import BarChart from '@base/ui-app/components/dashboard/BarChart.vue'
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue'
import TimelineList from '@base/ui-app/components/dashboard/TimelineList.vue'
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue'
import type {
  LineSeries,
  BarSeries,
  DonutSlice,
  TimelineEvent,
} from '@base/ui-app/components/dashboard/types'

definePageMeta({
  layout: 'default',
  title: 'Dashboard Components',
})

const { t } = useI18n()

// Line chart mock: visitors last 7 days
const lineSeries = computed<LineSeries[]>(() => [
  {
    name: t('mod.ui.dashboard.demoVisitors'),
    data: [
      { x: 1, y: 120 },
      { x: 2, y: 200 },
      { x: 3, y: 150 },
      { x: 4, y: 280 },
      { x: 5, y: 230 },
      { x: 6, y: 310 },
      { x: 7, y: 290 },
    ],
  },
  {
    name: t('mod.ui.dashboard.demoConversions'),
    data: [
      { x: 1, y: 30 },
      { x: 2, y: 45 },
      { x: 3, y: 38 },
      { x: 4, y: 60 },
      { x: 5, y: 52 },
      { x: 6, y: 75 },
      { x: 7, y: 68 },
    ],
  },
])

// Bar chart mock: clients by status
const barCategories = computed(() => [
  t('mod.ui.dashboard.demoActive'),
  t('mod.ui.dashboard.demoPending'),
  t('mod.ui.dashboard.demoInactive'),
  t('mod.ui.dashboard.demoChurned'),
])

const barSeries = computed<BarSeries[]>(() => [
  {
    name: t('mod.ui.dashboard.demoQ1'),
    data: [120, 45, 30, 12],
  },
  {
    name: t('mod.ui.dashboard.demoQ2'),
    data: [150, 38, 25, 8],
  },
])

// Stacked bar chart mock: platform breakdown
const stackedCategories = computed(() => ['Instagram', 'TikTok', 'X', 'LinkedIn'])
const stackedSeries = computed<BarSeries[]>(() => [
  { name: t('mod.ui.dashboard.demoPosts'), data: [320, 280, 150, 90] },
  { name: t('mod.ui.dashboard.demoStories'), data: [180, 220, 80, 40] },
])

// Donut chart mock: plan distribution
const donutData = computed<DonutSlice[]>(() => [
  { name: 'Free', value: 450 },
  { name: 'Pro', value: 280 },
  { name: 'Business', value: 120 },
  { name: 'Enterprise', value: 50 },
])

const emptyDonut: DonutSlice[] = []

// Timeline events mock
const timelineEvents = computed<TimelineEvent[]>(() => [
  {
    time: '2026-07-07T14:30:00',
    title: t('mod.ui.dashboard.demoEvent1Title'),
    description: t('mod.ui.dashboard.demoEvent1Desc'),
    icon: CheckCircle,
    color: 'success',
  },
  {
    time: '2026-07-07T11:15:00',
    title: t('mod.ui.dashboard.demoEvent2Title'),
    description: t('mod.ui.dashboard.demoEvent2Desc'),
    icon: AlertCircle,
    color: 'warning',
  },
  {
    time: '2026-07-06T18:00:00',
    title: t('mod.ui.dashboard.demoEvent3Title'),
    description: t('mod.ui.dashboard.demoEvent3Desc'),
    icon: Bell,
    color: 'info',
  },
  {
    time: '2026-07-06T09:45:00',
    title: t('mod.ui.dashboard.demoEvent4Title'),
    description: t('mod.ui.dashboard.demoEvent4Desc'),
    icon: FileText,
    color: 'primary',
  },
])

const emptyTimeline: TimelineEvent[] = []

const propsTable = computed(() => [
  {
    component: 'StatCard',
    props: 'label, value, icon?, trend?, color?, loading?',
    slots: 'footer, prefix, suffix',
  },
  {
    component: 'LineChart',
    props: 'series, xAxisType?, yAxisType?, height?, loading?, smooth?, area?, altText',
    slots: '—',
  },
  {
    component: 'BarChart',
    props: 'categories, series, orientation?, stacked?, height?, loading?, altText',
    slots: '—',
  },
  {
    component: 'DonutChart',
    props: 'data, height?, showLegend?, loading?, centerLabel?, altText',
    slots: '—',
  },
  {
    component: 'TimelineList',
    props: 'events, max?, loading?',
    slots: '—',
  },
  {
    component: 'EmptyState',
    props: 'icon?, title, description?, size?',
    slots: 'action, default',
  },
])
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">{{ t('mod.ui.dashboard.demoTitle') }}</h1>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-10">
      <!-- StatCards -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoStatCards') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            :label="t('mod.ui.dashboard.demoUsers')"
            :value="1284"
            :icon="Users"
            :trend="12.5"
            color="primary"
          >
            <template #footer>
              <p class="text-xs text-base-content/50">{{ t('mod.ui.dashboard.demoVsLastMonth') }}</p>
            </template>
          </StatCard>

          <StatCard
            :label="t('mod.ui.dashboard.demoRevenue')"
            :value="45230"
            :icon="DollarSign"
            :trend="8.3"
            color="success"
          >
            <template #footer>
              <p class="text-xs text-base-content/50">{{ t('mod.ui.dashboard.demoVsLastMonth') }}</p>
            </template>
          </StatCard>

          <StatCard
            :label="t('mod.ui.dashboard.demoActivity')"
            value="892"
            :icon="Activity"
            :trend="-3.2"
            color="warning"
          />

          <StatCard
            :label="t('mod.ui.dashboard.demoOrders')"
            :value="t('mod.ui.dashboard.demoLoading')"
            :icon="ShoppingCart"
            :loading="true"
            color="info"
          />
        </div>
      </section>

      <!-- LineChart -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoLineChart') }}</h2>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-4">
            <LineChart
              :series="lineSeries"
              :smooth="true"
              :area="true"
              :alt-text="t('mod.ui.dashboard.demoLineChart')"
              height="320px"
            />
          </div>
        </div>
      </section>

      <!-- BarChart -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoBarChart') }}</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <p class="text-sm font-medium mb-2">{{ t('mod.ui.dashboard.demoUnstacked') }}</p>
              <BarChart
                :categories="barCategories"
                :series="barSeries"
                :alt-text="t('mod.ui.dashboard.demoBarChart')"
                height="300px"
              />
            </div>
          </div>
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <p class="text-sm font-medium mb-2">{{ t('mod.ui.dashboard.demoStacked') }}</p>
              <BarChart
                :categories="stackedCategories"
                :series="stackedSeries"
                :stacked="true"
                :alt-text="t('mod.ui.dashboard.demoStackedBarChart')"
                height="300px"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- DonutChart -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoDonutChart') }}</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <p class="text-sm font-medium mb-2">{{ t('mod.ui.dashboard.demoWithLegend') }}</p>
              <DonutChart
                :data="donutData"
                :show-legend="true"
                center-label="900"
                :alt-text="t('mod.ui.dashboard.demoDonutChart')"
                height="300px"
              />
            </div>
          </div>
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <p class="text-sm font-medium mb-2">{{ t('mod.ui.dashboard.demoEmptyState') }}</p>
              <DonutChart
                :data="emptyDonut"
                :alt-text="t('mod.ui.dashboard.demoEmptyDonut')"
                height="300px"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- TimelineList -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoTimeline') }}</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <TimelineList :events="timelineEvents" :max="5" />
            </div>
          </div>
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <p class="text-sm font-medium mb-2">{{ t('mod.ui.dashboard.demoEmptyTimeline') }}</p>
              <TimelineList :events="emptyTimeline" />
            </div>
          </div>
        </div>
      </section>

      <!-- EmptyState -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoEmptyStates') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <EmptyState
                :icon="Users"
                :title="t('mod.ui.dashboard.demoNoUsers')"
                :description="t('mod.ui.dashboard.demoNoUsersDesc')"
                size="sm"
              >
                <template #action>
                  <button class="btn btn-sm btn-primary mt-2">
                    <Plus class="h-4 w-4" />
                    {{ t('mod.ui.dashboard.demoAddUser') }}
                  </button>
                </template>
              </EmptyState>
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <EmptyState
                :icon="FileText"
                :title="t('mod.ui.dashboard.demoNoDocs')"
                size="md"
              />
            </div>
          </div>

          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <EmptyState
                :icon="ShoppingCart"
                :title="t('mod.ui.dashboard.demoNoOrders')"
                :description="t('mod.ui.dashboard.demoNoOrdersDesc')"
                size="lg"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Props table -->
      <section>
        <h2 class="text-lg font-semibold mb-4">{{ t('mod.ui.dashboard.demoPropsTable') }}</h2>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>{{ t('mod.ui.dashboard.demoComponent') }}</th>
                <th>{{ t('mod.ui.dashboard.demoProps') }}</th>
                <th>{{ t('mod.ui.dashboard.demoSlots') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in propsTable" :key="row.component">
                <td class="font-mono font-bold">{{ row.component }}</td>
                <td class="font-mono text-xs">{{ row.props }}</td>
                <td class="font-mono text-xs">{{ row.slots }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>