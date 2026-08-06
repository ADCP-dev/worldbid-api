<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type {
  CellContext,
  Commission,
  CommissionSummary,
  PaginatedResponse,
  Partner,
} from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const commissions = ref<Commission[]>([]);
const partners = ref<Partner[]>([]);
const summary = ref<CommissionSummary | null>(null);
const partnerId = ref<string>('');
const status = ref<string>('');
const total = ref(0);

const tableName = 'affiliate-commissions';

interface TableStateRaw {
  pageIndex?: number;
  pageSize?: number;
  globalFilter?: string;
}

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, TableStateRaw>)[tableName] ?? {};
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

const statusOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
]);

const partnerOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...partners.value.map((p) => ({ label: p.name, value: String(p.id) })),
]);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}


const columns = computed(() => [
  {
    accessorKey: 'partner',
    headerName: 'Partner',
    header: 'Partner',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => row.original.partner?.name || '—',
  },
  {
    accessorKey: 'project',
    headerName: 'Proyecto',
    header: 'Proyecto',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => row.original.project?.name || '—',
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

async function loadPartners() {
  try {
    const res: PaginatedResponse<Partner> | Partner[] = await affiliate.getPartners(1);
    partners.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error cargando partners', { description: errorMessage(err) });
  }
}

async function loadCommissions() {
  loading.value = true;
  try {
    const res: PaginatedResponse<Commission> | Commission[] = await affiliate.getCommissions(
      partnerId.value ? Number(partnerId.value) : undefined,
      status.value || undefined,
    );
    const list = Array.isArray(res) ? res : (res.data ?? []);
    commissions.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error cargando comisiones', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  try {
    summary.value = await affiliate.getCommissionSummary();
  } catch (err: unknown) {
    // Non-fatal
    if (import.meta.dev) console.error('Error cargando resumen', err);
  }
}

function onFilterChange() {
  loadCommissions();
}

onMounted(async () => {
  await Promise.all([loadPartners(), loadSummary()]);
  await loadCommissions();
});

watch(tableState, () => {
  loadCommissions();
}, { deep: true });
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
      <div class="w-56">
        <FormSelect
          v-model="partnerId"
          label="Partner"
          :options="partnerOptions"
          @update:model-value="onFilterChange"
        />
      </div>
      <div class="w-48">
        <FormSelect
          v-model="status"
          label="Estado"
          :options="statusOptions"
          @update:model-value="onFilterChange"
        />
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