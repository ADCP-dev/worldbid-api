<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { CellContext, ColumnFilter, PaginatedResponse } from '@crm/types';
import type { Client, Origin, Status } from '@crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const clients = ref<Client[]>([]);
const statuses = ref<Status[]>([]);
const origins = ref<Origin[]>([]);
const total = ref(0);

const tableName = 'crm-clients';

// Reactive table state from the store (pageIndex 0-based, pageSize)
const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string; columnFilters?: ColumnFilter[] }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
  };
});

const statusOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...statuses.value.map((s) => ({ label: s.label, value: String(s.id) })),
]);

const originOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...origins.value.map((o) => ({ label: o.label, value: String(o.id) })),
]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const columns = computed(() => [
  { accessorKey: 'name', headerName: 'Nombre', header: 'Nombre', filterType: 'string' as const },
  { accessorKey: 'companyName', headerName: 'Empresa', header: 'Empresa', filterType: 'string' as const },
  {
    accessorKey: 'email',
    headerName: 'Email',
    header: 'Email',
    filterType: 'string' as const,
  },
  {
    accessorKey: 'phone',
    headerName: 'Teléfono',
    header: 'Teléfono',
    filterType: 'string' as const,
  },
  {
    accessorKey: 'statusId',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'select' as const,
    options: statusOptions.value,
    cell: ({ row }: CellContext<Client>) => {
      const s = row.original.status;
      return s
        ? h('span', {
            class: 'badge badge-sm',
            style: { backgroundColor: s.color, color: '#fff' },
          }, s.label)
        : h('span', { class: 'text-base-content/40' }, '—');
    },
  },
  {
    accessorKey: 'originId',
    headerName: 'Origen',
    header: 'Origen',
    filterType: 'select' as const,
    options: originOptions.value,
    cell: ({ row }: CellContext<Client>) => row.original.origin?.label || h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'createdAt',
    headerName: 'Creado',
    header: 'Creado',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<Client>) => new Date(row.original.createdAt ?? Date.now()).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Client>) => h('button', {
      class: 'btn btn-ghost btn-xs',
      onClick: (e: Event) => {
        e.stopPropagation();
        navigateTo(`/app/crm/clients/${row.original.id}`);
      },
    }, 'Ver'),
  },
]);

async function loadClients() {
  loading.value = true;
  try {
    const s = tableState.value;
    // Extract column filter values for statusId / originId
    const statusFilter = s.columnFilters.find((f: ColumnFilter) => f.id === 'statusId');
    const originFilter = s.columnFilters.find((f: ColumnFilter) => f.id === 'originId');

    const res: PaginatedResponse<Client> | Client[] = await crm.getClients(
      s.pageIndex + 1,
      s.pageSize,
      s.globalFilter || undefined,
      statusFilter?.value ? Number(statusFilter.value) : undefined,
      originFilter?.value ? Number(originFilter.value) : undefined,
    );
    const list = Array.isArray(res) ? res : (res.data ?? []);
    clients.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error cargando clientes', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadFilters() {
  try {
    const [stat, orig] = await Promise.all([crm.getStatuses(), crm.getOrigins()]);
    statuses.value = stat;
    origins.value = orig;
  } catch (err: unknown) {
    toast.error('Error cargando filtros', { description: errorMessage(err) });
  }
}

onMounted(() => {
  loadFilters();
  loadClients();
});

// Reload when table state (pagination, filters, search) changes
watch(tableState, () => {
  loadClients();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Clientes</h1>
      <NuxtLink to="/app/crm/clients/new" class="btn btn-primary btn-sm">
        Nuevo cliente
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="clients"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: Client) => navigateTo(`/app/crm/clients/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>