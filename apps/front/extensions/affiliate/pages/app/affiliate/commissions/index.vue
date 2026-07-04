<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const commissions = ref<any[]>([]);
const partners = ref<any[]>([]);
const summary = ref<any>(null);
const partnerId = ref<string>('');
const status = ref<string>('');

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

async function loadPartners() {
  try {
    const res: any = await affiliate.getPartners(1);
    partners.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando partners', { description: err.message });
  }
}

async function loadCommissions() {
  loading.value = true;
  try {
    const res: any = await affiliate.getCommissions(
      partnerId.value ? Number(partnerId.value) : undefined,
      status.value || undefined,
    );
    commissions.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando comisiones', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  try {
    summary.value = await affiliate.getCommissionSummary();
  } catch (err: any) {
    // Non-fatal
    console.error('Error cargando resumen', err);
  }
}

function onFilterChange() {
  loadCommissions();
}

onMounted(async () => {
  await Promise.all([loadPartners(), loadSummary()]);
  await loadCommissions();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Comisiones</h1>

    <!-- Summary -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
        <div class="stat-title">Pendientes</div>
        <div class="stat-value text-warning">{{ formatCurrency(summary?.pending ?? 0) }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
        <div class="stat-title">Aprobadas</div>
        <div class="stat-value text-info">{{ formatCurrency(summary?.approved ?? 0) }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
        <div class="stat-title">Pagadas este mes</div>
        <div class="stat-value text-success">{{ formatCurrency(summary?.paidThisMonth ?? 0) }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="form-control w-56">
        <label class="label"><span class="label-text">Partner</span></label>
        <select v-model="partnerId" class="select select-bordered w-full" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="form-control w-48">
        <label class="label"><span class="label-text">Estado</span></label>
        <select v-model="status" class="select select-bordered w-full" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Proyecto</th>
                <th class="text-right">Base</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Comisión</th>
                <th>Estado</th>
                <th>Pagada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="commissions.length === 0">
                <td colspan="7" class="text-center text-base-content/40 py-8">Sin comisiones</td>
              </tr>
              <tr v-else v-for="c in commissions" :key="c.id">
                <td>{{ c.partner?.name || '—' }}</td>
                <td>{{ c.project?.name || '—' }}</td>
                <td class="text-right">{{ formatCurrency(c.baseAmount) }}</td>
                <td class="text-right">{{ c.rate != null ? `${c.rate}%` : '—' }}</td>
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