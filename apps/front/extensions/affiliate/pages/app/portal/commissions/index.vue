<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { CellContext } from '@affiliate/types';
import type { Commission, PortalSummary } from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const commissions = ref<Commission[]>([]);
const summary = ref<PortalSummary | null>(null);
const total = ref(0);

const tableName = 'affiliate-portal-commissions';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

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

const columns = computed(() => [
  {
    accessorKey: 'project',
    headerName: 'Proyecto',
    header: 'Proyecto',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => h('span', { class: 'font-medium' }, row.original.project?.name || '—'),
  },
  {
    accessorKey: 'commissionAmount',
    headerName: 'Comisión',
    header: 'Comisión',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => h('span', { class: 'font-semibold' }, formatCurrency(row.original.commissionAmount ?? 0)),
  },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => h(
      'span',
      { class: ['badge', 'badge-sm', STATUS_BADGE[row.original.status] || 'badge-ghost'] },
      STATUS_LABELS[row.original.status] ?? row.original.status,
    ),
  },
  {
    accessorKey: 'paidAt',
    headerName: 'Pagada',
    header: 'Pagada',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => row.original.paidDate ? formatDate(row.original.paidDate) : '—',
  },
]);

async function loadData() {
  loading.value = true;
  try {
    const [comms, sum] = await Promise.all([
      affiliate.getMyCommissions(),
      affiliate.getMySummary(),
    ]);
    const commsList = Array.isArray(comms) ? comms : (comms.data ?? []);
    commissions.value = commsList;
    total.value = Array.isArray(comms) ? commsList.length : (comms.total ?? commsList.length);
    summary.value = sum;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error cargando comisiones', { description: msg });
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

watch(tableState, () => {
  loadData();
}, { deep: true });
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
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="commissions"
          :total="total"
          manual
          :table-name="tableName"
        />
      </div>
    </div>
  </div>
</template>