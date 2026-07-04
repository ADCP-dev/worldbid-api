<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const dashboard = ref<any>(null);

const kpis = computed(() => {
  if (!dashboard.value) return [];
  return [
    { label: 'Partners activos', value: dashboard.value.activePartners ?? 0, color: 'text-primary' },
    { label: 'Referencias pendientes', value: dashboard.value.pendingReferrals ?? 0, color: 'text-info' },
    { label: 'Comisiones pendientes', value: formatCurrency(dashboard.value.pendingCommissions ?? 0), color: 'text-warning' },
    { label: 'Pagadas este mes', value: formatCurrency(dashboard.value.paidThisMonth ?? 0), color: 'text-success' },
  ];
});

const topPartners = computed(() => dashboard.value?.topPartners ?? []);
const recentCommissions = computed(() => dashboard.value?.recentCommissions ?? []);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
  rejected: 'Rechazada',
};

const COMMISSION_STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-info',
  paid: 'badge-success',
  rejected: 'badge-error',
};

async function loadDashboard() {
  loading.value = true;
  try {
    dashboard.value = await affiliate.getAffiliateDashboard();
  } catch (err: any) {
    toast.error('Error cargando dashboard', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Afiliación Dashboard</h1>
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

      <!-- Top partners -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300">
            <h2 class="card-title">Top 5 partners por revenue</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Empresa</th>
                  <th class="text-right">Revenue</th>
                  <th class="text-right">Comisiones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="topPartners.length === 0">
                  <td colspan="4" class="text-center text-base-content/40 py-6">Sin datos</td>
                </tr>
                <tr v-for="p in topPartners" :key="p.id" class="hover cursor-pointer" @click="navigateTo(`/app/affiliate/partners/${p.id}`)">
                  <td class="font-medium">{{ p.name }}</td>
                  <td>{{ p.companyName || '—' }}</td>
                  <td class="text-right font-semibold">{{ formatCurrency(p.revenue ?? 0) }}</td>
                  <td class="text-right">{{ p.commissionsCount ?? 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent commissions -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300">
            <h2 class="card-title">Comisiones recientes</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Proyecto</th>
                  <th class="text-right">Importe</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="recentCommissions.length === 0">
                  <td colspan="5" class="text-center text-base-content/40 py-6">Sin comisiones</td>
                </tr>
                <tr v-for="c in recentCommissions" :key="c.id">
                  <td class="font-medium">{{ c.partner?.name || '—' }}</td>
                  <td>{{ c.project?.name || '—' }}</td>
                  <td class="text-right font-semibold">{{ formatCurrency(c.commissionAmount ?? 0) }}</td>
                  <td>
                    <span class="badge badge-sm" :class="COMMISSION_STATUS_BADGE[c.status]">
                      {{ COMMISSION_STATUS_LABELS[c.status] ?? c.status }}
                    </span>
                  </td>
                  <td>{{ formatDate(c.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>