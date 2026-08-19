<script setup lang="ts">
/**
 * TaskStatsWidget — compact dashboard widget for the main /app dashboard.
 * Shows 4 stat cards (Total, Done, In Progress, Overdue) and a mini donut
 * chart of tasks by status. Fetches from GET /api/v1/tasks/stats.
 *
 * Designed to drop into a dashboard grid alongside other extension widgets.
 */
import { ref, computed, onMounted } from 'vue';
import { ListTodo, CheckCircle, AlertTriangle, Clock } from 'lucide-vue-next';
import type { TaskStatsResponse } from '../types';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue';
import type { DonutSlice } from '@base/ui-app/components/dashboard/types';

const tasksApi = useTasks();

const stats = ref<TaskStatsResponse | null>(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    stats.value = await tasksApi.getStats('30d');
  } catch {
    // Swallow: widget degrades to zeros/empty state, main dashboard stays usable.
    stats.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  review: '#a78bfa',
  done: '#22c55e',
  blocked: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

const totalTasks = computed(() => {
  if (!stats.value) return 0;
  return Object.values(stats.value.byStatus).reduce((a, b) => a + b, 0);
});
const doneCount = computed(() => stats.value?.byStatus.done ?? 0);
const inProgressCount = computed(() => stats.value?.byStatus.in_progress ?? 0);
const overdueCount = computed(() => stats.value?.overdue.length ?? 0);

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
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold tracking-tight">Task Stats</h3>
      <NuxtLink to="/app/tasks-stats" class="link link-primary text-sm">View all</NuxtLink>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total"
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

    <!-- Mini donut -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-4">
        <h4 class="font-semibold text-sm">Tasks by Status</h4>
        <ClientOnly>
          <DonutChart
            :data="byStatusSlices"
            :loading="loading"
            height="220px"
            :show-legend="true"
            :center-label="String(totalTasks)"
            alt-text="Tasks by status donut chart"
          />
        </ClientOnly>
      </div>
    </div>
  </div>
</template>