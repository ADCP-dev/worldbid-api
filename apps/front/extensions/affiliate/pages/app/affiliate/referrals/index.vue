<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { CellContext, PaginatedResponse } from '@affiliate/types';
import type { Partner, Referral } from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const referrals = ref<Referral[]>([]);
const partners = ref<Partner[]>([]);
const total = ref(0);
const partnerId = ref<string>('');
const status = ref<string>('');

const tableName = 'affiliate-referrals';

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
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  contacted: 'badge-info',
  qualified: 'badge-primary',
  converted: 'badge-success',
  lost: 'badge-error',
};

const statusOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
]);

const partnerOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...partners.value.map((p) => ({ label: p.name, value: String(p.id) })),
]);

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const columns = computed(() => [
  {
    accessorKey: 'partner',
    headerName: 'Partner',
    header: 'Partner',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) => row.original.partner?.name || '—',
  },
  {
    accessorKey: 'clientName',
    headerName: 'Cliente',
    header: 'Cliente',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) => h('span', { class: 'font-medium' }, row.original.clientName || '—'),
  },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) => h(
      'span',
      { class: ['badge', 'badge-sm', STATUS_BADGE[row.original.status] || 'badge-ghost'] },
      STATUS_LABELS[row.original.status] ?? row.original.status,
    ),
  },
  {
    accessorKey: 'referredAt',
    headerName: 'Fecha',
    header: 'Fecha',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) => formatDate(row.original.referredDate || row.original.createdAt || ''),
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

async function loadReferrals() {
  loading.value = true;
  try {
    const res: PaginatedResponse<Referral> | Referral[] = await affiliate.getReferrals(
      partnerId.value ? Number(partnerId.value) : undefined,
      status.value || undefined,
    );
    const list = Array.isArray(res) ? res : (res.data ?? []);
    referrals.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error cargando referencias', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

function onFilterChange() {
  loadReferrals();
}

onMounted(async () => {
  await loadPartners();
  await loadReferrals();
});

watch(tableState, () => {
  loadReferrals();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Referencias</h1>

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
          :data="referrals"
          :total="total"
          manual
          :table-name="tableName"
        />
      </div>
    </div>
  </div>
</template>