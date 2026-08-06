<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { CellContext, PaginatedResponse, Partner  } from '@affiliate/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const partners = ref<Partner[]>([]);
const total = ref(0);

const tableName = 'affiliate-partners';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

function formatRate(rate: number) {
  return `${(rate ?? 0).toFixed(2)}%`;
}


const columns = computed(() => [
  { accessorKey: 'name', headerName: 'Nombre', header: 'Nombre', filterType: 'string' as const },
  { accessorKey: 'companyName', headerName: 'Empresa', header: 'Empresa', filterType: 'string' as const },
  { accessorKey: 'email', headerName: 'Email', header: 'Email', filterType: 'string' as const },
  {
    accessorKey: 'commissionRate',
    headerName: 'Comisión',
    header: 'Comisión',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Partner>) => formatRate(row.original.commissionRate),
  },
  {
    accessorKey: 'isActive',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Partner>) => h(
      'span',
      { class: ['badge', 'badge-sm', row.original.isActive ? 'badge-success' : 'badge-ghost'] },
      row.original.isActive ? 'Sí' : 'No',
    ),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Partner>) => h(ViewButton, {
      ariaLabel: `Ver partner ${row.original.name}`,
      onClick: (e: Event) => {
        e.stopPropagation();
        navigateTo(`/app/affiliate/partners/${row.original.id}`);
      },
    }),
  },
]);

async function loadPartners() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res: PaginatedResponse<Partner> | Partner[] = await affiliate.getPartners(s.pageIndex + 1, s.globalFilter || undefined);
    const list = Array.isArray(res) ? res : (res.data ?? []);
    partners.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error cargando partners', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

onMounted(loadPartners);

watch(tableState, () => {
  loadPartners();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Partners</h1>
      <NuxtLink to="/app/affiliate/partners/new" class="btn btn-primary btn-sm">
        Nuevo partner
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="partners"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: Partner) => navigateTo(`/app/affiliate/partners/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>