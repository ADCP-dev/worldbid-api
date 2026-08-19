<script setup lang="ts">
/**
 * TaskStatsDashboard — 6-panel stats dashboard for tasks.
 *
 * Panels:
 *   1. Tasks by Status (donut)
 *   2. Tasks by Priority (vertical bar)
 *   3. Tasks by Assignee (horizontal bar)
 *   4. Throughput (line — tasks done per day, selected range)
 *   5. Upcoming deadlines (timeline list)
 *   6. Overdue tasks (timeline list)
 *
 * Uses base dashboard wrappers from @base/ui-app/components/dashboard/*.
 * Wrapped in <client-only> because ECharts is client-only.
 *
 * Part of change `tasks-v2-professional` (Slice 7).
 */
import { ref, computed, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';
import { ListTodo, CheckCircle, AlertTriangle, Clock } from 'lucide-vue-next';
import type {
  TaskStatsResponse,
  StatsRange,
} from '../types';
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue';
import BarChart from '@base/ui-app/components/dashboard/BarChart.vue';
import LineChart from '@base/ui-app/components/dashboard/LineChart.vue';
import TimelineList from '@base/ui-app/components/dashboard/TimelineList.vue';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import type {
  DonutSlice,
  BarSeries,
  LineSeries,
  TimelineEvent,
} from '@base/ui-app/components/dashboard/types';

const tasksApi = useTasks();

const stats = ref<TaskStatsResponse | null>(null);
const loading = ref(true);
const range = ref<StatsRange>('30d');

const RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

async function load() {
  loading.value = true;
  try {
    stats.value = await tasksApi.getStats(range.value);
  } catch (err: unknown) {
    toast.error('Error loading stats', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(range, load);

// ─── Mapped data for charts ───────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  review: '#a78bfa',
  done: '#10b981',
  blocked: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

const byStatusSlices = computed<DonutSlice[]>(() => {
  if (!stats.value) return [];
  return Object.entries(stats.value.byStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k,
      value: v,
      color: STATUS_COLORS[k],
    }));
});

const priorityCategories = computed<string[]>(() => ['low', 'medium', 'high', 'urgent']);

const prioritySeries = computed<BarSeries[]>(() => {
  if (!stats.value) return [{ name: 'Tasks', data: [0, 0, 0, 0] }];
  const b = stats.value.byPriority;
  return [{ name: 'Tasks', data: [b.low ?? 0, b.medium ?? 0, b.high ?? 0, b.urgent ?? 0] }];
});

const assigneeCategories = computed<string[]>(() => {
  if (!stats.value) return [];
  return stats.value.byAssignee.map((a) => a.name);
});

const assigneeSeries = computed<BarSeries[]>(() => {
  if (!stats.value) return [{ name: 'Tasks', data: [] }];
  return [{ name: 'Tasks', data: stats.value.byAssignee.map((a) => a.count) }];
});

const throughputSeries = computed<LineSeries[]>(() => {
  if (!stats.value) return [];
  return [
    {
      name: 'Completed',
      data: stats.value.throughput.map((t) => ({
        x: new Date(t.date).getTime(),
        y: t.count,
      })),
    },
  ];
});

const upcomingEvents = computed<TimelineEvent[]>(() => {
  if (!stats.value) return [];
  return stats.value.upcoming.map((t) => ({
    time: t.dueDate ?? new Date().toISOString(),
    title: t.title,
    color: 'warning' as const,
  }));
});

const overdueEvents = computed<TimelineEvent[]>(() => {
  if (!stats.value) return [];
  return stats.value.overdue.map((t) => ({
    time: t.dueDate ?? new Date().toISOString(),
    title: t.title,
    color: 'error' as const,
  }));
});

// ─── StatCards ────────────────────────────────────────────────────────
const totalTasks = computed(() => {
  if (!stats.value) return 0;
  return Object.values(stats.value.byStatus).reduce((a, b) => a + b, 0);
});

const doneCount = computed(() => stats.value?.byStatus.done ?? 0);
const inProgressCount = computed(() => stats.value?.byStatus.in_progress ?? 0);
const overdueCount = computed(() => stats.value?.overdue.length ?? 0);
</script>

<template>
  <div class="space-y-4">
    <!-- Range selector -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div role="tablist" class="tabs tabs-boxed tabs-sm">
        <button
          v-for="r in RANGES"
          :key="r.value"
          role="tab"
          class="tab"
          :class="{ 'tab-active': range === r.value }"
          @click="range = r.value"
        >{{ r.label }}</button>
      </div>
    </div>

    <!-- Stat cards row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Total Tasks"
        :value="totalTasks"
        :icon="ListTodo"
        color="primary"
        :loading="loading"
      />
      <StatCard
        label="Done"
        :value="doneCount"
        :icon="CheckCircle"
        color="success"
        :loading="loading"
      />
      <StatCard
        label="In Progress"
        :value="inProgressCount"
        :icon="Clock"
        color="info"
        :loading="loading"
      />
      <StatCard
        label="Overdue"
        :value="overdueCount"
        :icon="AlertTriangle"
        color="error"
        :loading="loading"
      />
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Charts grid -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 1. By Status donut -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Tasks by Status</h3>
          <DonutChart
            :data="byStatusSlices"
            :loading="loading"
            :center-label="String(totalTasks)"
            alt-text="Tasks by status donut chart"
          />
        </div>
      </div>

      <!-- 2. By Priority bar -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Tasks by Priority</h3>
          <BarChart
            :categories="priorityCategories"
            :series="prioritySeries"
            :loading="loading"
            alt-text="Tasks by priority bar chart"
          />
        </div>
      </div>

      <!-- 3. By Assignee horizontal bar -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Tasks by Assignee (top 5)</h3>
          <BarChart
            :categories="assigneeCategories"
            :series="assigneeSeries"
            orientation="horizontal"
            :loading="loading"
            alt-text="Tasks by assignee horizontal bar chart"
          />
        </div>
      </div>

      <!-- 4. Throughput line -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Throughput (completed per day)</h3>
          <LineChart
            :series="throughputSeries"
            x-axis-type="time"
            area
            smooth
            :loading="loading"
            alt-text="Tasks throughput over time line chart"
          />
        </div>
      </div>

      <!-- 5. Upcoming deadlines -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Upcoming Deadlines (7 days)</h3>
          <TimelineList
            :events="upcomingEvents"
            :loading="loading"
            :max="20"
          />
        </div>
      </div>

      <!-- 6. Overdue tasks -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="font-semibold text-sm">Overdue Tasks</h3>
          <TimelineList
            :events="overdueEvents"
            :loading="loading"
            :max="20"
          />
        </div>
      </div>
    </div>
  </div>
</template>