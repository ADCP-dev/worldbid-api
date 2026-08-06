<script setup lang="ts">
/**
 * Task Attachments list page — DataTable of all attachments.
 * Columns: Filename (with file icon), Task (link), Date.
 */
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import { FileText } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type {
  CellContext,
  ColumnFilter,
  PaginatedResponse,
  TaskAttachment,
} from '@tasks/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const tasksApi = useTasks();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const attachments = ref<TaskAttachment[]>([]);
const total = ref(0);

const tableName = 'tasks-attachments';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string; columnFilters?: ColumnFilter[] }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
  };
});


function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const columns = computed(() => [
  {
    accessorKey: 'filename',
    headerName: 'Filename',
    header: 'Filename',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<TaskAttachment>) =>
      h('span', { class: 'inline-flex items-center gap-2 font-medium' }, [
        h(FileText, { class: 'w-4 h-4 text-base-content/50' }),
        row.original.filename,
      ]),
  },
  {
    accessorKey: 'taskId',
    headerName: 'Task',
    header: 'Task',
    filterType: 'number' as const,
    cell: ({ row }: CellContext<TaskAttachment>) =>
      h(
        'a',
        {
          class: 'link link-primary link-hover text-sm',
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/tasks/${row.original.taskId}`);
          },
        },
        `#${row.original.taskId}`,
      ),
  },
  {
    accessorKey: 'createdAt',
    headerName: 'Date',
    header: 'Date',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<TaskAttachment>) =>
      h('span', { class: 'text-base-content/50' }, formatDate(row.original.createdAt)),
  },
]);

async function loadAttachments() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res: PaginatedResponse<TaskAttachment> | TaskAttachment[] =
      await tasksApi.getTaskAttachments(undefined, s.pageIndex + 1, s.pageSize);
    const list = Array.isArray(res) ? res : (res.data ?? []);
    attachments.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error loading attachments', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

onMounted(loadAttachments);

watch(tableState, () => loadAttachments(), { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Task Attachments</h1>
      <NuxtLink to="/app/tasks" class="btn btn-ghost btn-sm">← Board</NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="attachments"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: TaskAttachment) => navigateTo(`/app/tasks/${row.taskId}`)"
        />
      </div>
    </div>
  </div>
</template>