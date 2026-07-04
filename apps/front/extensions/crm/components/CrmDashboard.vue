<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';

const crm = useCrm();

const loading = ref(false);
const dashboard = ref<any>(null);
const statuses = ref<any[]>([]);

const kpis = computed(() => {
  if (!dashboard.value) return [];
  return [
    { label: 'Total clientes', value: dashboard.value.totalClients ?? 0, color: 'text-primary' },
    {
      label: 'En discovery',
      value: (dashboard.value.clientsByStatus ?? []).find((s: any) => s.statusName === 'discovery')?.count ?? 0,
      color: 'text-info',
    },
    {
      label: 'Propuestas',
      value: (dashboard.value.clientsByStatus ?? []).find((s: any) => s.statusName === 'proposal')?.count ?? 0,
      color: 'text-warning',
    },
    { label: 'Clientes activos', value: dashboard.value.activeClients ?? 0, color: 'text-success' },
  ];
});

const pipeline = computed(() => dashboard.value?.clientsByStatus ?? []);

const originsList = computed(() => {
  const list = dashboard.value?.clientsByOrigin ?? [];
  const max = Math.max(...list.map((o: any) => o.count), 1);
  return list.map((o: any) => ({ ...o, pct: Math.round((o.count / max) * 100) }));
});

const projectsByStatus = computed(() => dashboard.value?.projectsByStatus ?? []);
const activeProjects = computed(() => dashboard.value?.activeProjects ?? 0);
const recentInteractions = computed(() => dashboard.value?.recentInteractions ?? []);

async function loadDashboard() {
  loading.value = true;
  try {
    const [dash, stat] = await Promise.all([crm.getDashboard(), crm.getStatuses()]);
    dashboard.value = dash;
    statuses.value = stat;
  } catch (err: any) {
    toast.error('Error cargando dashboard', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadDashboard();
});

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">CRM Dashboard</h1>
      <NuxtLink to="/app/crm/clients/new" class="btn btn-primary btn-sm">
        Nuevo cliente
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="kpi in kpis" :key="kpi.label" class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-title">{{ kpi.label }}</div>
          <div class="stat-value" :class="kpi.color">{{ kpi.value }}</div>
        </div>
      </div>

      <!-- Pipeline -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Pipeline de clientes</h2>
          <div class="flex flex-wrap gap-3">
            <div
              v-for="stage in pipeline"
              :key="stage.statusId"
              class="card card-compact flex-1 min-w-[140px] bg-base-200"
            >
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ stage.label }}</span>
                  <span class="badge badge-sm" :style="{ backgroundColor: stage.color, color: '#fff' }">
                    {{ stage.count }}
                  </span>
                </div>
                <div class="text-2xl font-bold">{{ stage.count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Orígenes -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Clientes por origen</h2>
          <div v-if="originsList.length === 0" class="text-sm text-base-content/40">
            Sin datos
          </div>
          <div v-else class="space-y-2">
            <div v-for="origin in originsList" :key="origin.originId" class="flex items-center gap-3">
              <span class="w-32 text-sm truncate">{{ origin.label }}</span>
              <div class="flex-1 bg-base-200 rounded-full h-6 overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full flex items-center justify-end pr-2 transition-all"
                  :style="{ width: `${origin.pct}%` }"
                >
                  <span class="text-xs text-primary-content font-semibold">{{ origin.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Proyectos por status -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Proyectos por estado ({{ activeProjects }} activos)</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th class="text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ps in projectsByStatus" :key="ps.status">
                  <td>
                    <span class="badge badge-outline capitalize">{{ PROJECT_STATUS_LABELS[ps.status] ?? ps.status }}</span>
                  </td>
                  <td class="text-right font-semibold">{{ ps.count }}</td>
                </tr>
                <tr v-if="projectsByStatus.length === 0">
                  <td colspan="2" class="text-base-content/40 text-center">Sin proyectos</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Interacciones recientes -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Interacciones recientes</h2>
          <div v-if="recentInteractions.length === 0" class="text-sm text-base-content/40">
            Sin interacciones
          </div>
          <ul v-else class="timeline timeline-vertical">
            <li v-for="item in recentInteractions" :key="item.id">
              <div class="timeline-start">
                <span class="badge badge-sm badge-primary">{{ item.type }}</span>
              </div>
              <div class="timeline-middle">
                <span class="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div class="timeline-end mb-4">
                <div class="text-sm font-medium">{{ item.subject }}</div>
                <div class="text-xs text-base-content/60">
                  {{ formatDate(item.interactionDate) }}
                  <span v-if="item.client"> · {{ item.client.name }}</span>
                </div>
                <p v-if="item.body" class="text-xs text-base-content/50 mt-1 line-clamp-2">{{ item.body }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>