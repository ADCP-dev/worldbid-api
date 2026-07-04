<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const commissions = ref<any[]>([]);
const summary = ref<any>(null);

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
  rejected: 'Rechazada',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-info',
  paid: 'badge-success',
  rejected: 'badge-error',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadData() {
  loading.value = true;
  try {
    const [comms, sum] = await Promise.all([
      affiliate.getMyCommissions(),
      affiliate.getMySummary(),
    ]);
    commissions.value = (comms as any)?.data ?? comms ?? [];
    summary.value = sum;
  } catch (err: any) {
    toast.error('Error cargando comisiones', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Mis comisiones</h1>

    <!-- Summary -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
        <div class="stat-title">Total pendiente</div>
        <div class="stat-value text-warning">{{ formatCurrency(summary?.pending ?? 0) }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
        <div class="stat-title">Total pagado</div>
        <div class="stat-value text-success">{{ formatCurrency(summary?.paidTotal ?? 0) }}</div>
      </div>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th class="text-right">Comisión</th>
                <th>Estado</th>
                <th>Pagada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="4" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="commissions.length === 0">
                <td colspan="4" class="text-center text-base-content/40 py-8">Sin comisiones</td>
              </tr>
              <tr v-else v-for="c in commissions" :key="c.id">
                <td class="font-medium">{{ c.project?.name || '—' }}</td>
                <td class="text-right font-semibold">{{ formatCurrency(c.commissionAmount) }}</td>
                <td>
                  <span class="badge badge-sm" :class="STATUS_BADGE[c.status]">
                    {{ STATUS_LABELS[c.status] ?? c.status }}
                  </span>
                </td>
                <td>{{ c.paidDate ? formatDate(c.paidDate) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>