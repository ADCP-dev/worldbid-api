<script setup lang="ts">
/**
 * Task Comments list page — DataTable of all comments across tasks.
 * Columns: Author (avatar), Content (truncate), Task (link), Date (relative).
 * Search + pagination via DataTable manual mode.
 */
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import type {
  CellContext,
  ColumnFilter,
  PaginatedResponse,
  TaskComment,
  UserLight,
} from '@tasks/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const tasksApi = useTasks();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const comments = ref<TaskComment[]>([]);
const users = ref<UserLight[]>([]);
const total = ref(0);

const tableName = 'tasks-comments';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string; columnFilters?: ColumnFilter[] }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
  };
});

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of users.value) m[u.id] = u;
  return m;
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const columns = computed(() => [
  {
    accessorKey: 'authorId',
    headerName: 'Author',
    header: 'Author',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<TaskComment>) => {
      const u = row.original.authorId ? userMap.value[row.original.authorId] : null;
      const name = u ? `${u.firstName} ${u.lastName}`.trim() : 'Unknown';
      return h('span', { class: 'font-medium' }, name);
    },
  },
  {
    accessorKey: 'content',
    headerName: 'Content',
    header: 'Content',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<TaskComment>) =>
      h('span', { class: 'text-base-content/70' }, truncate(row.original.content)),
  },
  {
    accessorKey: 'taskId',
    headerName: 'Task',
    header: 'Task',
    filterType: 'number' as const,
    cell: ({ row }: CellContext<TaskComment>) =>
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
    cell: ({ row }: CellContext<TaskComment>) =>
      h('span', { class: 'text-base-content/50' }, timeAgo(row.original.createdAt)),
  },
]);

async function loadComments() {
  loading.value = true;
  try {
    const s = tableState.value;
    const res: PaginatedResponse<TaskComment> | TaskComment[] =
      await tasksApi.getTaskComments(undefined, s.pageIndex + 1, s.pageSize);
    const list = Array.isArray(res) ? res : (res.data ?? []);
    comments.value = list;
    total.value = Array.isArray(res) ? list.length : (res.total ?? list.length);
  } catch (err: unknown) {
    toast.error('Error loading comments', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    users.value = await tasksApi.getUsers();
  } catch (err: unknown) {
    toast.error('Error loading users', { description: errorMessage(err) });
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadComments()]);
});

watch(tableState, () => loadComments(), { deep: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Task Comments</h1>
      <NuxtLink to="/app/tasks" class="btn btn-ghost btn-sm">← Board</NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="comments"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: TaskComment) => navigateTo(`/app/tasks/${row.taskId}`)"
        />
      </div>
    </div>
  </div>
</template>