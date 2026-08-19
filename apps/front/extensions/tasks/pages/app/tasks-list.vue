<script setup lang="ts">
/**
 * Tasks List View — tabular view with sort, filter, search, bulk ops, CSV export.
 *
 * Uses the base DataTable with `manual: true` so we control fetching + bulk
 * operations. Row click navigates to the task detail.
 *
 * Part of change `tasks-v2-professional` (Slice 5).
 */
import { ref, computed, h, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';
import {
  Plus,
  Search,
  Download,
  Trash2,
  CheckSquare,
  UserCog,
} from 'lucide-vue-next';
import type {
  ColumnDef,
} from '@tanstack/vue-table';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  UserLight,
  PaginatedResponse,
} from '@tasks/types';
import { TASK_STATUSES, TASK_PRIORITIES } from '@tasks/types';
import TaskStatusBadge from '@tasks/components/TaskStatusBadge.vue';
import TaskPriorityBadge from '@tasks/components/TaskPriorityBadge.vue';
import type { MyColumnDef } from '@base/ui-app/components/data-table/types';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const tasksApi = useTasks();

const loading = ref(false);
const tasks = ref<Task[]>([]);
const users = ref<UserLight[]>([]);
const totalCount = ref(0);
const page = ref(0);
const pageSize = ref(20);
const search = ref('');
const statusFilter = ref<TaskStatus | ''>('');
const priorityFilter = ref<TaskPriority | ''>('');
const assigneeFilter = ref<number | ''>('');

// Selection
const selectedIds = ref<Set<number>>(new Set());
const showBulkBar = computed(() => selectedIds.value.size > 0);

// Bulk action UI
const bulkStatusValue = ref<TaskStatus>('pending');
const bulkAssigneeValue = ref<number | ''>('');
const showDeleteConfirm = ref(false);

// ─── Data fetching ────────────────────────────────────────────────────
async function loadTasks() {
  loading.value = true;
  try {
    const res: PaginatedResponse<Task> | Task[] = await tasksApi.getTasks(
      page.value + 1,
      pageSize.value,
      search.value || undefined,
      statusFilter.value || undefined,
      priorityFilter.value || undefined,
    );
    tasks.value = Array.isArray(res) ? res : (res.data ?? []);
    totalCount.value = Array.isArray(res) ? res.length : (res.total ?? res.data?.length ?? 0);
  } catch (err: unknown) {
    toast.error('Error loading tasks', { description: errorMessage(err) });
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

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of users.value) m[u.id] = u;
  return m;
});

function userInitials(id?: number | null): string {
  if (!id) return '?';
  const u = userMap.value[id];
  if (!u) return '?';
  return `${u.firstName} ${u.lastName}`
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Columns ──────────────────────────────────────────────────────────
const columns = computed<MyColumnDef<Task>[]>(() => [
  {
    id: 'select',
    header: () => h('input', {
      type: 'checkbox',
      class: 'checkbox checkbox-sm',
      checked: tasks.value.length > 0 && tasks.value.every((t) => selectedIds.value.has(t.id)),
      onChange: (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          tasks.value.forEach((t) => selectedIds.value.add(t.id));
        } else {
          selectedIds.value.clear();
        }
        selectedIds.value = new Set(selectedIds.value);
      },
    }),
    cell: ({ row }) => h('input', {
      type: 'checkbox',
      class: 'checkbox checkbox-sm',
      checked: selectedIds.value.has(row.original.id),
      onChange: (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        const next = new Set(selectedIds.value);
        if (checked) next.add(row.original.id);
        else next.delete(row.original.id);
        selectedIds.value = next;
      },
      onClick: (e: Event) => e.stopPropagation(),
    }),
    enableSorting: false,
  },
  {
    id: 'title',
    header: 'Title',
    accessorKey: 'title',
    cell: ({ row }) => h('span', { class: 'font-medium line-clamp-1' }, row.original.title),
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    filterType: 'select',
    options: TASK_STATUSES.map((s) => ({ value: s, label: s })),
    cell: ({ row }) => h(TaskStatusBadge, { status: row.original.status }),
  },
  {
    id: 'priority',
    header: 'Priority',
    accessorKey: 'priority',
    filterType: 'select',
    options: TASK_PRIORITIES.map((p) => ({ value: p, label: p })),
    cell: ({ row }) => h(TaskPriorityBadge, { priority: row.original.priority }),
  },
  {
    id: 'assignee',
    header: 'Assignee',
    accessorFn: (row) => row.assigneeId ?? 0,
    cell: ({ row }) => {
      const u = row.original.assigneeId ? userMap.value[row.original.assigneeId] : null;
      return h('div', { class: 'flex items-center gap-2' }, [
        h('div', { class: 'avatar' }, [
          h('div', { class: 'w-6 h-6 rounded-full bg-neutral text-neutral-content text-[10px] flex items-center justify-center' }, userInitials(row.original.assigneeId)),
        ]),
        h('span', { class: 'text-sm' }, u ? `${u.firstName} ${u.lastName}`.trim() : 'Unassigned'),
      ]);
    },
  },
  {
    id: 'dueDate',
    header: 'Due Date',
    accessorKey: 'dueDate',
    cell: ({ row }) => {
      const d = row.original.dueDate;
      if (!d) return h('span', { class: 'text-base-content/30' }, '—');
      const isOverdue = new Date(d).getTime() < Date.now() && row.original.status !== 'done';
      return h('span', { class: isOverdue ? 'text-error font-medium' : '' }, formatDate(d));
    },
  },
  {
    id: 'estimateHours',
    header: 'Estimate',
    accessorKey: 'estimateHours',
    cell: ({ row }) => {
      const e = row.original.estimateHours;
      return e != null ? h('span', { class: 'text-sm' }, `${e}h`) : h('span', { class: 'text-base-content/30' }, '—');
    },
  },
  {
    id: 'updatedAt',
    header: 'Updated',
    accessorKey: 'updatedAt',
    cell: ({ row }) => h('span', { class: 'text-xs text-base-content/50' }, formatDateTime(row.original.updatedAt)),
  },
]);

// ─── Filters ──────────────────────────────────────────────────────────
let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 0;
    loadTasks();
  }, 300);
}

function onFilterChange() {
  page.value = 0;
  loadTasks();
}

// ─── Bulk operations ──────────────────────────────────────────────────
async function bulkChangeStatus() {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;
  try {
    const res = await tasksApi.bulkStatus({ ids, status: bulkStatusValue.value });
    toast.success(`Updated ${res.updated} tasks (${res.skipped} skipped)`);
    selectedIds.value = new Set();
    await loadTasks();
  } catch (err: unknown) {
    toast.error('Bulk update failed', { description: errorMessage(err) });
  }
}

async function bulkAssign() {
  if (bulkAssigneeValue.value === '' ) return;
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;
  const assigneeId = bulkAssigneeValue.value === '' ? null : bulkAssigneeValue.value;
  try {
    await Promise.all(ids.map((id) => tasksApi.updateTask(id, { assigneeId } as Partial<Task>)));
    toast.success(`Assigned ${ids.length} tasks`);
    selectedIds.value = new Set();
    await loadTasks();
  } catch (err: unknown) {
    toast.error('Bulk assign failed', { description: errorMessage(err) });
  }
}

async function bulkDelete() {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;
  try {
    await Promise.all(ids.map((id) => tasksApi.deleteTask(id)));
    toast.success(`Deleted ${ids.length} tasks`);
    selectedIds.value = new Set();
    showDeleteConfirm.value = false;
    await loadTasks();
  } catch (err: unknown) {
    toast.error('Bulk delete failed', { description: errorMessage(err) });
  }
}

function clearSelection() {
  selectedIds.value = new Set();
}

// ─── CSV export ───────────────────────────────────────────────────────
function exportCsv() {
  const rows = tasks.value;
  const headers = ['id', 'title', 'status', 'priority', 'assignee', 'dueDate', 'estimateHours', 'updatedAt'];
  const lines: string[] = [headers.join(',')];
  for (const t of rows) {
    const assignee = t.assigneeId ? userMap.value[t.assigneeId] : null;
    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : '';
    const cells = [
      String(t.id),
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      `"${assigneeName.replace(/"/g, '""')}"`,
      t.dueDate ?? '',
      t.estimateHours != null ? String(t.estimateHours) : '',
      t.updatedAt,
    ];
    lines.push(cells.join(','));
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadTasks(), loadUsers()]);
});

watch([page, pageSize], () => loadTasks());
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">Tasks</h1>
        <div role="tablist" class="tabs tabs-boxed tabs-sm">
          <NuxtLink to="/app/tasks" role="tab" class="tab">Board</NuxtLink>
          <NuxtLink to="/app/tasks-list" role="tab" class="tab tab-active">List</NuxtLink>
          <NuxtLink to="/app/tasks-stats" role="tab" class="tab">Stats</NuxtLink>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-outline btn-sm" @click="exportCsv">
          <Download class="w-4 h-4" /> Export CSV
        </button>
        <button class="btn btn-primary btn-sm" @click="navigateTo('/app/tasks/new')">
          <Plus class="w-4 h-4" /> New Task
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 flex-wrap">
      <div class="relative flex-1 min-w-[180px] max-w-xs">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
        <input
          v-model="search"
          type="text"
          placeholder="Search tasks…"
          class="input input-bordered input-sm w-full pl-9"
          @input="onSearchInput"
        >
      </div>
      <select
        v-model="statusFilter"
        class="select select-bordered select-sm"
        @change="onFilterChange"
      >
        <option value="">Any status</option>
        <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <select
        v-model="priorityFilter"
        class="select select-bordered select-sm"
        @change="onFilterChange"
      >
        <option value="">Any priority</option>
        <option v-for="p in TASK_PRIORITIES" :key="p" :value="p">{{ p }}</option>
      </select>
      <select
        v-model="assigneeFilter"
        class="select select-bordered select-sm"
        @change="onFilterChange"
      >
        <option value="">Any assignee</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.firstName }} {{ u.lastName }}</option>
      </select>
    </div>

    <!-- Bulk action bar -->
    <div v-if="showBulkBar" class="flex items-center gap-2 flex-wrap bg-base-200 rounded-lg p-2">
      <span class="text-sm font-medium">{{ selectedIds.size }} selected</span>
      <div class="divider divider-horizontal mx-1" />
      <select v-model="bulkStatusValue" class="select select-bordered select-sm">
        <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <button class="btn btn-sm btn-outline" @click="bulkChangeStatus">
        <CheckSquare class="w-4 h-4" /> Set status
      </button>
      <select v-model="bulkAssigneeValue" class="select select-bordered select-sm">
        <option value="">Unassigned</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.firstName }} {{ u.lastName }}</option>
      </select>
      <button class="btn btn-sm btn-outline" @click="bulkAssign">
        <UserCog class="w-4 h-4" /> Assign
      </button>
      <button class="btn btn-sm btn-outline btn-error" @click="showDeleteConfirm = true">
        <Trash2 class="w-4 h-4" /> Delete
      </button>
      <button class="btn btn-ghost btn-sm ml-auto" @click="clearSelection">Clear</button>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
        <DataTable
          :columns="columns"
          :data="tasks"
          :manual="true"
          :total="totalCount"
          table-name="tasks-list"
          @row-click="(row: Task) => navigateTo(`/app/tasks/${row.id}`)"
        />
      </div>
    </div>

    <!-- Delete confirm modal -->
    <dialog :class="['modal', { 'modal-open': showDeleteConfirm }]">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Delete {{ selectedIds.size }} tasks?</h3>
        <p class="py-4 text-sm text-base-content/70">
          This action cannot be undone. All selected tasks and their related
          data (comments, activities, notes) will be permanently deleted.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="bulkDelete">
            Delete {{ selectedIds.size }} tasks
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showDeleteConfirm = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>