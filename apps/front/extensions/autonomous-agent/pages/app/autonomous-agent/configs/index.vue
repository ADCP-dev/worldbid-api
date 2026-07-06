<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const aa = useAutonomousAgent();
const cp = useContentPipeline();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const configs = ref<any[]>([]);
const total = ref(0);
const projects = ref<any[]>([]);

const tableName = 'autonomous-agent-configs';

const tableState = computed(() => {
  const raw = (tableStateStore as Record<string, any>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
];

const projectOptions = computed(() => [
  { label: 'All', value: '' },
  ...projects.value.map((p) => ({ label: p.name, value: String(p.id) })),
]);

function projectName(projectId: string | number) {
  const p = projects.value.find((pr) => pr.id === projectId || String(pr.id) === String(projectId));
  return p?.name || `#${projectId}`;
}

const columns = computed(() => [
  {
    accessorKey: 'projectId',
    headerName: 'Project',
    header: 'Project',
    filterType: 'select' as const,
    options: projectOptions.value,
    cell: ({ row }: any) => projectName(row.original.projectId),
  },
  {
    accessorKey: 'status',
    headerName: 'Status',
    header: 'Status',
    filterType: 'select' as const,
    options: statusOptions,
    cell: ({ row }: any) =>
      h(
        'span',
        {
          class: `badge badge-sm capitalize ${
            row.original.status === 'active' ? 'badge-success' : 'badge-warning'
          }`,
        },
        row.original.status || '—',
      ),
  },
  {
    accessorKey: 'researchCron',
    headerName: 'Research Cron',
    header: 'Research Cron',
    filterType: 'string' as const,
    cell: ({ row }: any) =>
      h('span', { class: 'font-mono text-xs' }, row.original.researchCron || '—'),
  },
  {
    accessorKey: 'autoApproveIdeas',
    headerName: 'Auto Ideas',
    header: 'Auto Ideas',
    filterType: 'select' as const,
    options: [
      { label: 'All', value: '' },
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
    cell: ({ row }: any) =>
      row.original.autoApproveIdeas
        ? h('span', { class: 'badge badge-xs badge-success' }, 'Yes')
        : h('span', { class: 'badge badge-xs badge-ghost' }, 'No'),
  },
  {
    accessorKey: 'autoApproveDrafts',
    headerName: 'Auto Drafts',
    header: 'Auto Drafts',
    filterType: 'select' as const,
    options: [
      { label: 'All', value: '' },
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
    cell: ({ row }: any) =>
      row.original.autoApproveDrafts
        ? h('span', { class: 'badge badge-xs badge-success' }, 'Yes')
        : h('span', { class: 'badge badge-xs badge-ghost' }, 'No'),
  },
]);

async function loadProjects() {
  try {
    const res: any = await cp.getProjects(1, 200);
    projects.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error loading projects', { description: err.message });
  }
}

async function loadConfigs() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res: any = await aa.getConfigs(s.pageIndex + 1, s.pageSize, s.globalFilter || undefined);
    configs.value = res.data ?? res ?? [];
    total.value = res.total ?? configs.value.length;
  } catch (err: any) {
    toast.error('Error loading configs', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadProjects();
  await loadConfigs();
});

watch(tableState, () => {
  loadConfigs();
}, { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Autonomous Agent Configs</h1>
      <NuxtLink to="/app/autonomous-agent/configs/create" class="btn btn-primary btn-sm">
        New Config
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="configs"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: any) => navigateTo(`/app/autonomous-agent/configs/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>