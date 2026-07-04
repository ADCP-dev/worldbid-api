<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const referrals = ref<any[]>([]);
const total = ref(0);

const tableName = 'affiliate-portal-referrals';

const tableState = computed(() => {
  const raw = (tableStateStore as Record<string, any>)[tableName] || {};
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const columns = computed(() => [
  {
    accessorKey: 'clientName',
    headerName: 'Cliente',
    header: 'Cliente',
    filterType: 'string' as const,
    cell: ({ row }: any) => h('span', { class: 'font-medium' }, row.original.clientName || '—'),
  },
  {
    accessorKey: 'companyName',
    headerName: 'Empresa',
    header: 'Empresa',
    filterType: 'string' as const,
    cell: ({ row }: any) => row.original.companyName || '—',
  },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'string' as const,
    cell: ({ row }: any) => h(
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
    cell: ({ row }: any) => formatDate(row.original.referredDate || row.original.createdAt),
  },
]);

async function loadReferrals() {
  loading.value = true;
  try {
    const res: any = await affiliate.getMyReferrals();
    referrals.value = res.data ?? res ?? [];
    total.value = res.total ?? referrals.value.length;
  } catch (err: any) {
    toast.error('Error cargando referencias', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadReferrals);

watch(tableState, () => {
  loadReferrals();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Mis referencias</h1>
      <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary btn-sm">
        Nueva referencia
      </NuxtLink>
    </div>

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