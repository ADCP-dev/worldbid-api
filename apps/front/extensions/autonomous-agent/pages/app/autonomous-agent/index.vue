<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Bot, Activity, CheckCircle, Play } from 'lucide-vue-next';
import type { ConfigEntity, ProjectEntity, RunEntity } from '@/extensions/autonomous-agent/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const aa = useAutonomousAgent();
const cp = useContentPipeline();

const loading = ref(false);
const configs = ref<ConfigEntity[]>([]);
const runs = ref<RunEntity[]>([]);
const projects = ref<ProjectEntity[]>([]);

const activeConfigs = computed(() => configs.value.filter((c) => c.status === 'active'));

const runsToday = computed(() => {
  const today = new Date();
  return runs.value.filter((r) => {
    if (!r.startedAt) return false;
    const d = new Date(r.startedAt);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }).length;
});

const successRate = computed(() => {
  const completed = runs.value.filter((r) => r.status === 'completed' || r.status === 'failed');
  if (completed.length === 0) return 0;
  const success = completed.filter((r) => r.status === 'completed').length;
  return Math.round((success / completed.length) * 100);
});

const recentRuns = computed(() =>
  [...runs.value]
    .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
    .slice(0, 10),
);

const kpis = computed(() => [
  { label: 'Active Agents', value: activeConfigs.value.length, color: 'text-primary', icon: Bot },
  { label: 'Runs Today', value: runsToday.value, color: 'text-info', icon: Activity },
  { label: 'Success Rate', value: `${successRate.value}%`, color: 'text-success', icon: CheckCircle },
  { label: 'Total Configs', value: configs.value.length, color: 'text-warning', icon: Play },
]);

function projectName(projectId: string | number) {
  const p = projects.value.find((pr) => pr.id === projectId || String(pr.id) === String(projectId));
  return p?.name || `#${projectId}`;
}

async function loadDashboard() {
  loading.value = true;
  try {
    const [configsRes, runsRes, projectsRes] = await Promise.all([
      aa.getConfigs(1, 100),
      aa.getRuns(1, 50),
      cp.getProjects(1, 100).catch(() => ({ data: [] })),
    ]);
    configs.value = 'data' in configsRes ? (configsRes.data ?? []) : (configsRes ?? []);
    runs.value = 'data' in runsRes ? (runsRes.data ?? []) : (runsRes ?? []);
    const pr = projectsRes as { data?: ProjectEntity[] } | ProjectEntity[];
    projects.value = Array.isArray(pr) ? pr : (pr.data ?? []);
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error loading dashboard', { description: err.message });
    else toast.error('Error loading dashboard');
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);

function formatDateTime(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Autonomous Agent Dashboard</h1>
      <NuxtLink to="/app/autonomous-agent/configs/create" class="btn btn-primary btn-sm">
        New Config
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="stat bg-base-100 rounded-box shadow-sm border border-base-300"
        >
          <div class="stat-figure" :class="kpi.color">
            <component :is="kpi.icon" class="w-8 h-8" />
          </div>
          <div class="stat-title">{{ kpi.label }}</div>
          <div class="stat-value" :class="kpi.color">{{ kpi.value }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Runs -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title">Recent Runs</h2>
              <NuxtLink to="/app/autonomous-agent/runs" class="btn btn-ghost btn-sm">
                View all
              </NuxtLink>
            </div>
            <div v-if="recentRuns.length === 0" class="text-sm text-base-content/40 py-4">
              No runs yet
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="run in recentRuns" :key="run.id">
                    <td class="font-medium capitalize">{{ run.runType || '—' }}</td>
                    <td>
                      <span class="badge badge-sm badge-outline capitalize">{{ run.status }}</span>
                    </td>
                    <td>{{ projectName(run.projectId) }}</td>
                    <td>{{ formatDateTime(run.startedAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Active Configs -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title">Active Configs</h2>
              <NuxtLink to="/app/autonomous-agent/configs" class="btn btn-ghost btn-sm">
                View all
              </NuxtLink>
            </div>
            <div v-if="activeConfigs.length === 0" class="text-sm text-base-content/40 py-4">
              No active configs
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Research Cron</th>
                    <th>Auto-approve</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="config in activeConfigs"
                    :key="config.id"
                    class="hover cursor-pointer"
                    @click="navigateTo(`/app/autonomous-agent/configs/${config.id}`)"
                  >
                    <td class="font-medium">{{ projectName(config.projectId) }}</td>
                    <td class="font-mono text-xs">{{ config.researchCron || '—' }}</td>
                    <td>
                      <div class="flex gap-1">
                        <span v-if="config.autoApproveIdeas" class="badge badge-xs badge-success">Ideas</span>
                        <span v-if="config.autoApproveDrafts" class="badge badge-xs badge-success">Drafts</span>
                        <span v-if="!config.autoApproveIdeas && !config.autoApproveDrafts" class="text-base-content/40">—</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>