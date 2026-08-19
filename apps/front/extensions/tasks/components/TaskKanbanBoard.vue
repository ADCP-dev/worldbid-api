<script setup lang="ts">
/**
 * TaskKanbanBoard — 5-column kanban (pending, in_progress, review, done, blocked)
 * with drag & drop between columns via vue-draggable-plus.
 *
 * Features (Slice 4, change tasks-v2-professional):
 *   - Disableable columns (toggle visibility, persists in localStorage
 *     under key `tasks:kanban:columns`)
 *   - Drag & drop feedback: ghost card opacity-50, drop-zone highlight
 *   - Client-side filters: search, priority, assignee (in addition to API
 *     search handled by the parent)
 *   - Count per column + total
 *   - Per-column `+` button to create a task with that status preset
 *
 * Emits `@drop(taskId, newStatus)` when a card is dragged to a new column.
 */
import { computed, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { Plus, Eye, EyeOff, Search, Filter } from 'lucide-vue-next';
import type { Task, TaskStatus, TaskPriority, UserLight } from '../types';
import { TASK_STATUSES, TASK_PRIORITIES } from '../types';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  tasks: Task[];
  users: UserLight[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'drop', payload: { taskId: number; newStatus: TaskStatus }): void;
  (e: 'click', taskId: number): void;
  (e: 'edit', taskId: number): void;
  (e: 'add', status: TaskStatus): void;
}>();

const COLUMNS: Array<{ id: TaskStatus; title: string; headerClass: string }> = [
  { id: 'pending', title: 'Pending', headerClass: 'text-warning' },
  { id: 'in_progress', title: 'In Progress', headerClass: 'text-info' },
  { id: 'review', title: 'Review', headerClass: 'text-secondary' },
  { id: 'done', title: 'Done', headerClass: 'text-success' },
  { id: 'blocked', title: 'Blocked', headerClass: 'text-error' },
];

const STORAGE_KEY = 'tasks:kanban:columns';

function loadColumnVisibility(): Record<TaskStatus, boolean> {
  const def = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, true]),
  ) as Record<TaskStatus, boolean>;
  if (typeof window === 'undefined') return def;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<Record<TaskStatus, boolean>>;
    return { ...def, ...parsed };
  } catch {
    return def;
  }
}

function saveColumnVisibility(v: Record<TaskStatus, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // ignore quota / serialization errors
  }
}

const visible = ref<Record<TaskStatus, boolean>>(loadColumnVisibility());

function toggleColumn(status: TaskStatus) {
  visible.value = { ...visible.value, [status]: !visible.value[status] };
  saveColumnVisibility(visible.value);
}

// ─── Client-side filters ──────────────────────────────────────────────
const filterSearch = ref('');
const filterPriority = ref<TaskPriority | ''>('');
const filterAssignee = ref<number | ''>('');

const PRIORITY_OPTIONS: Array<{ value: TaskPriority | ''; label: string }> = [
  { value: '', label: 'Any priority' },
  ...TASK_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
];

const ASSIGNEE_OPTIONS = computed(() => [
  { value: '' as const, label: 'Any assignee' },
  ...props.users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() })),
]);

function matchesFilters(task: Task): boolean {
  if (filterSearch.value) {
    const q = filterSearch.value.toLowerCase();
    if (!task.title.toLowerCase().includes(q)) return false;
  }
  if (filterPriority.value && task.priority !== filterPriority.value) return false;
  if (filterAssignee.value !== '' && task.assigneeId !== filterAssignee.value) return false;
  return true;
}

// ─── Columns data ─────────────────────────────────────────────────────
const columns = ref<Record<TaskStatus, Task[]>>(
  () => ({ pending: [], in_progress: [], review: [], done: [], blocked: [] }) as Record<TaskStatus, Task[]>,
);

function syncFromProps() {
  const map: Record<TaskStatus, Task[]> = {
    pending: [],
    in_progress: [],
    review: [],
    done: [],
    blocked: [],
  };
  for (const t of props.tasks) {
    const s = (TASK_STATUSES.includes(t.status) ? t.status : 'pending') as TaskStatus;
    map[s].push(t);
  }
  for (const s of TASK_STATUSES) {
    map[s].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
  columns.value = map;
}

watch(
  () => props.tasks,
  () => syncFromProps(),
  { immediate: true, deep: false },
);

const filteredColumns = computed<Record<TaskStatus, Task[]>>(() => {
  const map: Record<TaskStatus, Task[]> = {
    pending: [],
    in_progress: [],
    review: [],
    done: [],
    blocked: [],
  };
  for (const s of TASK_STATUSES) {
    map[s] = columns.value[s].filter(matchesFilters);
  }
  return map;
});

const totalVisible = computed(() =>
  TASK_STATUSES.reduce((sum, s) => sum + filteredColumns.value[s].length, 0),
);

const visibleColumns = computed(() => COLUMNS.filter((c) => visible.value[c.id]));

// ─── User resolution ──────────────────────────────────────────────────
const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  const users = props.users ?? [];
  if (Array.isArray(users)) {
    for (const u of users) m[u.id] = u;
  }
  return m;
});

// ─── Drag handling ────────────────────────────────────────────────────
const dragOverColumn = ref<TaskStatus | null>(null);

function onColumnChange(status: TaskStatus, evt: { added?: { element: Task } }) {
  if (evt?.added?.element) {
    const task = evt.added.element;
    if (task.status !== status) {
      emit('drop', { taskId: task.id, newStatus: status });
    }
  }
  dragOverColumn.value = null;
}

function onDragEnter(status: TaskStatus) {
  dragOverColumn.value = status;
}

function onDragLeave(status: TaskStatus) {
  if (dragOverColumn.value === status) {
    dragOverColumn.value = null;
  }
}

const loadingColumn = computed(() =>
  props.loading ? Array.from({ length: 4 }, (_, i) => ({ id: -i - 1 })) : [],
);
</script>

<template>
  <div class="space-y-3">
    <!-- Filter bar -->
    <div class="flex items-center gap-2 flex-wrap">
      <div class="relative flex-1 min-w-[180px] max-w-xs">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
        <input
          v-model="filterSearch"
          type="text"
          placeholder="Filter in board…"
          class="input input-bordered input-sm w-full pl-9"
        >
      </div>
      <div class="flex items-center gap-1">
        <Filter class="w-4 h-4 text-base-content/40" />
        <select
          v-model="filterPriority"
          class="select select-bordered select-sm"
        >
          <option
            v-for="opt in PRIORITY_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >{{ opt.label }}</option>
        </select>
        <select
          v-model="filterAssignee"
          class="select select-bordered select-sm"
        >
          <option
            v-for="opt in ASSIGNEE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >{{ opt.label }}</option>
        </select>
      </div>
      <span class="badge badge-sm badge-ghost ml-auto">{{ totalVisible }} tasks</span>
    </div>

    <!-- Board -->
    <div class="flex gap-4 overflow-x-auto pb-4">
      <div
        v-for="col in COLUMNS"
        :key="col.id"
        class="flex flex-col"
        :class="visible[col.id]
          ? 'flex-1 min-w-[260px] max-w-[360px] bg-base-200/50 rounded-lg'
          : 'w-12 bg-base-200/30 rounded-lg'"
      >
        <!-- Collapsed column -->
        <template v-if="!visible[col.id]">
          <button
            class="btn btn-ghost btn-sm h-full flex-col gap-1 py-2"
            :title="`Show ${col.title}`"
            @click="toggleColumn(col.id)"
          >
            <EyeOff class="w-4 h-4" :class="col.headerClass" />
            <span class="text-[10px] [writing-mode:vertical-rl] rotate-180">{{ col.title }}</span>
            <span class="badge badge-xs badge-ghost">{{ columns[col.id].length }}</span>
          </button>
        </template>

        <!-- Expanded column -->
        <template v-else>
          <!-- Column header -->
          <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm" :class="col.headerClass">{{ col.title }}</span>
              <span class="badge badge-sm badge-ghost">{{ filteredColumns[col.id].length }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-xs btn-circle"
                title="Hide column"
                @click="toggleColumn(col.id)"
              >
                <Eye class="w-3.5 h-3.5" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-circle"
                title="Add task"
                @click="emit('add', col.id)"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Column body -->
          <div
            class="p-2 flex-1 flex flex-col gap-2 overflow-y-auto transition-colors rounded-b-lg"
            :class="dragOverColumn === col.id ? 'ring-2 ring-primary/40 bg-primary/5' : ''"
            @dragenter="onDragEnter(col.id)"
            @dragleave="onDragLeave(col.id)"
          >
            <template v-if="loading">
              <TaskCard
                v-for="i in 3"
                :key="`sk-${col.id}-${i}`"
                :task="{ id: 0, title: '', status: col.id, priority: 'low', position: 0, isRecurring: false, createdAt: '', updatedAt: '' }"
                :assignee="null"
                loading
              />
            </template>

            <VueDraggable
              v-else
              v-model="columns[col.id]"
              group="tasks"
              :animation="150"
              ghost-class="opacity-50"
              chosen-class="ring-2 ring-primary"
              drag-class="rotate-3"
              item-key="id"
              class="flex flex-col gap-2 min-h-[40px]"
              @change="(e: { added?: { element: Task } }) => onColumnChange(col.id, e)"
            >
              <template v-for="task in filteredColumns[col.id]" :key="task.id">
                <TaskCard
                  :task="task"
                  :assignee="task.assigneeId ? userMap[task.assigneeId] : null"
                  class="group"
                  @click="emit('click', task.id)"
                  @edit="emit('edit', $event)"
                />
              </template>
            </VueDraggable>

            <div
              v-if="!loading && filteredColumns[col.id].length === 0"
              class="text-center py-6 text-base-content/40 text-xs border-2 border-dashed border-base-300 rounded-lg"
            >
              No tasks
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>