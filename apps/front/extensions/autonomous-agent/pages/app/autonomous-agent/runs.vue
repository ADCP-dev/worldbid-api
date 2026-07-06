<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type { RunEntity, ProjectEntity, PaginatedResponse, CellContext, DataTableRow } from '../../../types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const aa = useAutonomousAgent();
const cp = useContentPipeline();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const runs = ref<RunEntity[]>([]);
const total = ref(0);
const projects = ref<ProjectEntity[]>([]);

const tableName = 'autonomous-agent-runs';

const tableState = computed(() => {
  const raw = (tableStateStore as Record<string, unknown>)[tableName] as Record<string, unknown> | undefined || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

// External filter dropdowns (independent of DataTable column filters)
const statusFilter = ref('');
const runTypeFilter = ref('');

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Queued', value: 'queued' },
];

const runTypeOptions = [
  { label: 'All types', value: '' },
  { label: 'Research', value: 'research' },
  { label: 'Generate', value: 'generate' },
  { label: 'Publish', value: 'publish' },
  { label: 'Metrics', value: 'metrics' },
];

function projectName(projectId: string | number) {
  const p = projects.value.find((pr) => pr.id === projectId || String(pr.id) === String(projectId));
  return p?.name || `#${projectId}`;
}

function formatDuration(startedAt?: string, endedAt?: string) {
  if (!startedAt) return '—';
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = end - new Date(startedAt).getTime();
  if (ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSec}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

const columns = computed(() => [
  {
    accessorKey: 'runType',
    headerName: 'Type',
    header: 'Type',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<RunEntity>) =>
      h('span', { class: 'font-medium capitalize' }, row.original.runType || '—'),
  },
  {
    accessorKey: 'status',
    headerName: 'Status',
    header: 'Status',
    filterType: 'select' as const,
    options: statusOptions,
    cell: ({ row }: CellContext<RunEntity>) => {
      const s = row.original.status;
      const cls: Record<string, string> = {
        running: 'badge-info',
        completed: 'badge-success',
        failed: 'badge-error',
        cancelled: 'badge-ghost',
        queued: 'badge-warning',
      };
      return h('span', { class: `badge badge-sm capitalize ${cls[s] || 'badge-outline'}` }, s || '—');
    },
  },
  {
    accessorKey: 'startedAt',
    headerName: 'Started',
    header: 'Started',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<RunEntity>) =>
      row.original.startedAt
        ? new Date(row.original.startedAt).toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
  },
  {
    accessorKey: 'duration',
    headerName: 'Duration',
    header: 'Duration',
    filterType: 'string' as const,
    enableColumnFilter: false,
    cell: ({ row }: CellContext<RunEntity>) =>
      formatDuration(row.original.startedAt, row.original.finishedAt ?? undefined),
  },
  {
    accessorKey: 'projectId',
    headerName: 'Project',
    header: 'Project',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<RunEntity>) => projectName(row.original.projectId ?? ''),
  },
]);

async function loadProjects() {
  try {
    const res = await cp.getProjects(1, 200);
    projects.value = ('data' in res ? res.data : res) ?? [];
  } catch (err: unknown) {
    toast.error('Error loading projects', { description: err instanceof Error ? err.message : 'Error' });
  }
}

async function loadRuns() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res = await aa.getRuns(s.pageIndex + 1, s.pageSize, {
      status: statusFilter.value || undefined,
      runType: runTypeFilter.value || undefined,
    });
    runs.value = ('data' in res ? res.data : res) ?? [];
    total.value = ('total' in res ? res.total : runs.value.length) ?? runs.value.length;
  } catch (err: unknown) {
    toast.error('Error loading runs', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadProjects();
  await loadRuns();
});

watch(tableState, () => {
  loadRuns();
}, { deep: true });

watch([statusFilter, runTypeFilter], () => {
  loadRuns();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Autonomous Agent Runs</h1>
      <NuxtLink to="/app/autonomous-agent" class="btn btn-ghost btn-sm">
        ← Dashboard
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            v-model="statusFilter"
            label="Filter by status"
            :options="statusOptions"
          />
          <FormSelect
            v-model="runTypeFilter"
            label="Filter by run type"
            :options="runTypeOptions"
          />
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="runs"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: RunEntity) => navigateTo(`/app/autonomous-agent/runs/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>