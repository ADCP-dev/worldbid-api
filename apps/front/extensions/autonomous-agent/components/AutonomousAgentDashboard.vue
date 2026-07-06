<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Bot, Activity, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-vue-next';
import type { ConfigEntity, RunEntity, PaginatedResponse } from '../types';

const autonomousAgent = useAutonomousAgent();

const loading = ref(true);
const configs = ref<ConfigEntity[]>([]);
const runs = ref<RunEntity[]>([]);

const activeConfigs = computed(() =>
  configs.value.filter((c) => c.enabled !== false),
);

const totalRuns = computed(() => runs.value.length);

const lastRun = computed(() => {
  if (runs.value.length === 0) return null;
  return [...runs.value].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )[0];
});

const lastRunStatus = computed(() => lastRun.value?.status ?? '—');

const recentRuns = computed(() =>
  [...runs.value]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 6),
);

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
    case 'success':
      return 'badge-success';
    case 'running':
      return 'badge-info';
    case 'failed':
    case 'error':
      return 'badge-error';
    case 'pending':
    case 'queued':
      return 'badge-warning';
    default:
      return 'badge-ghost';
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const [configsResult, runsResult] = await Promise.all([
      autonomousAgent.getConfigs(1, 100).catch(() => [] as ConfigEntity[]),
      autonomousAgent.getRuns(1, 20).catch(() => [] as RunEntity[]),
    ]);
    const configsPaginated = configsResult as PaginatedResponse<ConfigEntity> | ConfigEntity[];
    configs.value = Array.isArray(configsPaginated) ? configsPaginated : configsPaginated.data ?? [];
    const runsPaginated = runsResult as PaginatedResponse<RunEntity> | RunEntity[];
    runs.value = Array.isArray(runsPaginated) ? runsPaginated : runsPaginated.data ?? [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error cargando dashboard Autonomous Agent', { description: msg });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">Autonomous Agent Dashboard</h2>
      <NuxtLink to="/app/autonomous-agent" class="btn btn-primary btn-sm">
        Gestionar agentes
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-primary">
            <Bot class="w-6 h-6" />
          </div>
          <div class="stat-title">Configs activos</div>
          <div class="stat-value text-primary">{{ activeConfigs.length }}</div>
          <div class="stat-desc">{{ configs.length }} total</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-info">
            <Activity class="w-6 h-6" />
          </div>
          <div class="stat-title">Ejecuciones totales</div>
          <div class="stat-value text-info">{{ totalRuns }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure">
            <CheckCircle2 v-if="lastRunStatus === 'completed' || lastRunStatus === 'success'" class="w-6 h-6 text-success" />
            <AlertCircle v-else-if="lastRunStatus === 'failed' || lastRunStatus === 'error'" class="w-6 h-6 text-error" />
            <Activity v-else class="w-6 h-6 text-base-content/40" />
          </div>
          <div class="stat-title">Última ejecución</div>
          <div class="stat-value capitalize text-base">{{ lastRunStatus }}</div>
          <div class="stat-desc">{{ formatDate(lastRun?.finishedAt ?? lastRun?.startedAt ?? null) }}</div>
        </div>
      </div>

      <!-- Recent runs -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="card-title">Ejecuciones recientes</h3>
          <div v-if="recentRuns.length === 0" class="text-sm text-base-content/40">
            Sin ejecuciones
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Config</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="run in recentRuns" :key="run.id">
                  <td class="font-medium">{{ run.configId }}</td>
                  <td>
                    <span v-if="run.runType" class="badge badge-sm badge-outline">{{ run.runType }}</span>
                    <span v-else class="text-base-content/40">—</span>
                  </td>
                  <td>
                    <span class="badge badge-sm capitalize" :class="statusBadgeClass(run.status)">
                      {{ run.status }}
                    </span>
                  </td>
                  <td class="text-xs text-base-content/60">{{ formatDate(run.startedAt) }}</td>
                  <td class="text-xs text-base-content/60">{{ formatDate(run.finishedAt) }}</td>
                  <td>
                    <NuxtLink to="/app/autonomous-agent/runs" class="btn btn-ghost btn-xs">
                      <ArrowRight class="w-3 h-3" />
                    </NuxtLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>