<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import { Eye, Pencil, Trash2 } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import type { CellContext, Client, Project, ProjectStatus  } from '@crm/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const loading = ref(false);
const projects = ref<Project[]>([]);
const clients = ref<Client[]>([]);
const clientMap = computed(() => {
  const map = new Map<number, Client>();
  for (const c of clients.value) map.set(c.id, c);
  return map;
});

// Filters
const filterClientId = ref<string | number>('');
const filterStatus = ref<string>('');

const PROJECT_STATUS_LABELS: Record<string, string> = {
  quoted: 'Presupuestado',
  approved: 'Aprobado',
  in_progress: 'En progreso',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  pending: 'Pendiente',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
  overdue: 'Vencido',
};

const clientOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...clients.value.map((c) => ({ label: c.name, value: String(c.id) })),
]);

const statusOptions = computed(() => [
  { label: 'Todos', value: '' },
  ...Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]);


function formatDate(date?: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPrice(price?: number | null): string {
  if (price === null || price === undefined) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

const filteredProjects = computed(() => {
  let list = projects.value;
  if (filterClientId.value) {
    const id = Number(filterClientId.value);
    list = list.filter((p) => p.clientId === id);
  }
  if (filterStatus.value) {
    list = list.filter((p) => p.status === filterStatus.value);
  }
  return list;
});

const columns = computed(() => [
  {
    accessorKey: 'name',
    headerName: 'Nombre',
    header: 'Nombre',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Project>) =>
      h('span', { class: 'font-medium' }, row.original.name),
  },
  {
    id: 'clientName',
    headerName: 'Cliente',
    header: 'Cliente',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Project>) => {
      const client = clientMap.value.get(row.original.clientId);
      return client
        ? h(
            'a',
            {
              class: 'link link-hover',
              onClick: (e: Event) => {
                e.stopPropagation();
                navigateTo(`/app/crm/clients/${client.id}`);
              },
            },
            client.name,
          )
        : h('span', { class: 'text-base-content/40' }, '—');
    },
  },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'select' as const,
    options: statusOptions.value,
    cell: ({ row }: CellContext<Project>) => {
      const label = PROJECT_STATUS_LABELS[row.original.status] ?? row.original.status;
      return h('span', { class: 'badge badge-sm badge-ghost' }, label);
    },
  },
  {
    accessorKey: 'paymentStatus',
    headerName: 'Pago',
    header: 'Pago',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Project>) => {
      const label = PAYMENT_STATUS_LABELS[row.original.paymentStatus] ?? row.original.paymentStatus;
      return h('span', { class: 'badge badge-sm badge-outline' }, label);
    },
  },
  {
    accessorKey: 'price',
    headerName: 'Presupuesto',
    header: 'Presupuesto',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Project>) => formatPrice(row.original.price),
  },
  {
    accessorKey: 'startDate',
    headerName: 'Inicio',
    header: 'Inicio',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<Project>) => formatDate(row.original.startDate),
  },
  {
    accessorKey: 'endDate',
    headerName: 'Fin',
    header: 'Fin',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<Project>) => formatDate(row.original.endDate),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Project>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs btn-square',
            title: 'Ver',
            onClick: (e: Event) => {
              e.stopPropagation();
              navigateTo(`/app/crm/projects/${row.original.id}`);
            },
          },
          h(Eye, { class: 'w-4 h-4' }),
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs btn-square',
            title: 'Editar',
            onClick: (e: Event) => {
              e.stopPropagation();
              navigateTo(`/app/crm/projects/${row.original.id}`);
            },
          },
          h(Pencil, { class: 'w-4 h-4' }),
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs btn-square text-error',
            title: 'Eliminar',
            onClick: async (e: Event) => {
              e.stopPropagation();
              await removeProject(row.original.id);
            },
          },
          h(Trash2, { class: 'w-4 h-4' }),
        ),
      ]),
  },
]);

async function loadProjects() {
  loading.value = true;
  try {
    const data = await crm.getProjects();
    projects.value = Array.isArray(data) ? data : [];
  } catch (err: unknown) {
    toast.error('Error cargando proyectos', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadClients() {
  try {
    const res = await crm.getClients(1, 1000);
    clients.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error cargando clientes', { description: errorMessage(err) });
  }
}

async function removeProject(id: number | string) {
  if (!confirm('¿Eliminar proyecto?')) return;
  try {
    await crm.deleteProject(id);
    toast.success('Proyecto eliminado');
    await loadProjects();
  } catch (err: unknown) {
    toast.error('Error eliminando proyecto', { description: errorMessage(err) });
  }
}

onMounted(() => {
  loadClients();
  loadProjects();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Proyectos</h1>
      <NuxtLink to="/app/crm/projects/new" class="btn btn-primary btn-sm">
        Nuevo proyecto
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            v-model="filterClientId"
            label="Cliente"
            :options="clientOptions"
          />
          <FormSelect
            v-model="filterStatus"
            label="Estado"
            :options="statusOptions"
          />
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="loading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary" />
        </div>
        <DataTable
          v-else
          :columns="columns"
          :data="filteredProjects"
          :total="filteredProjects.length"
          table-name="crm-projects"
          @row-click="(row: Project) => navigateTo(`/app/crm/projects/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>