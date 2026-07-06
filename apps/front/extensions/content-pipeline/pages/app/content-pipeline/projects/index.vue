<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { CellContext, DataTableRow, Project } from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const projects = ref<Project[]>([]);
const total = ref(0);

const tableName = 'content-pipeline-projects';

const tableState = computed(() => {
  const raw = (tableStateStore as Record<string, unknown>)[tableName] as Record<string, unknown> | undefined || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
  };
});

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
];

const columns = computed(() => [
  { accessorKey: 'name', headerName: 'Name', header: 'Name', filterType: 'string' as const },
  { accessorKey: 'niche', headerName: 'Niche', header: 'Niche', filterType: 'string' as const },
  {
    accessorKey: 'status',
    headerName: 'Status',
    header: 'Status',
    filterType: 'select' as const,
    options: statusOptions,
    cell: ({ row }: CellContext<Project>) =>
      h('span', { class: 'badge badge-sm badge-outline capitalize' }, row.original.status || '—'),
  },
  {
    accessorKey: 'createdAt',
    headerName: 'Created',
    header: 'Created',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<Project>) =>
      new Date(row.original.createdAt ?? '').toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  },
]);

async function loadProjects() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res = await cp.getProjects(s.pageIndex + 1, s.pageSize, s.globalFilter || undefined);
    projects.value = 'data' in res ? (res.data ?? []) : (res ?? []);
    total.value = 'total' in res ? (res.total ?? projects.value.length) : projects.value.length;
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error loading projects', { description: err.message });
    else toast.error('Error loading projects');
  } finally {
    loading.value = false;
  }
}

onMounted(loadProjects);

watch(tableState, () => {
  loadProjects();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Projects</h1>
      <NuxtLink to="/app/content-pipeline/projects/create" class="btn btn-primary btn-sm">
        New Project
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="projects"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: DataTableRow<Project>) => navigateTo(`/app/content-pipeline/projects/${row.original.id}`)"
        />
      </div>
    </div>
  </div>
</template>