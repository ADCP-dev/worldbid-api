<script setup lang="ts">
/**
 * TaskKanbanBoard — 5-column kanban (pending, in_progress, review, done, blocked)
 * with drag & drop between columns via vue-draggable-plus.
 *
 * Emits `@drop(taskId, newStatus)` when a card is dragged to a new column.
 * The parent (index.vue) performs the optimistic update + API call + revert
 * on failure (pessimistic: refetch on success, revert on fail).
 */
import { computed, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { Plus } from 'lucide-vue-next';
import type { Task, TaskStatus, UserLight } from '../types';
import { TASK_STATUSES } from '../types';
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

const COLUMNS: Array<{ id: TaskStatus; title: string; headerClass: string; badgeClass: string }> = [
  { id: 'pending', title: 'Pending', headerClass: 'text-warning', badgeClass: 'badge-warning' },
  { id: 'in_progress', title: 'In Progress', headerClass: 'text-info', badgeClass: 'badge-info' },
  { id: 'review', title: 'Review', headerClass: 'text-secondary', badgeClass: 'badge-secondary' },
  { id: 'done', title: 'Done', headerClass: 'text-success', badgeClass: 'badge-success' },
  { id: 'blocked', title: 'Blocked', headerClass: 'text-error', badgeClass: 'badge-error' },
];

// Tasks per column (mutated by VueDraggable on drag). Re-sync when props.tasks changes.
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
// vue-draggable-plus `@change` event payload (SortableJS onChange) has an
// `added` element with { element, newIndex } when an item enters this list.
// We only fire @drop when an item is ADDED to a different column than its
// task.status (i.e. a cross-column move). Within-column reordering is
// ignored at the API level (position update handled separately if needed).
function onColumnChange(status: TaskStatus, evt: { added?: { element: Task } }) {
  if (evt?.added?.element) {
    const task = evt.added.element;
    if (task.status !== status) {
      emit('drop', { taskId: task.id, newStatus: status });
    }
  }
}

const loadingColumn = computed(() =>
  props.loading ? Array.from({ length: 4 }, (_, i) => ({ id: -i - 1 })) : [],
);
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-4">
    <div
      v-for="col in COLUMNS"
      :key="col.id"
      class="flex-1 min-w-[260px] max-w-[360px] bg-base-200/50 rounded-lg flex flex-col"
    >
      <!-- Column header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm" :class="col.headerClass">{{ col.title }}</span>
          <span class="badge badge-sm badge-ghost">{{ columns[col.id].length }}</span>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-circle"
          title="Add task"
          @click="emit('add', col.id)"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <!-- Column body -->
      <div class="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">
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
          <TaskCard
            v-for="task in columns[col.id]"
            :key="task.id"
            :task="task"
            :assignee="task.assigneeId ? userMap[task.assigneeId] : null"
            class="group"
            @click="emit('click', task.id)"
            @edit="emit('edit', $event)"
          />
        </VueDraggable>

        <div
          v-if="!loading && columns[col.id].length === 0"
          class="text-center py-6 text-base-content/40 text-xs border-2 border-dashed border-base-300 rounded-lg"
        >
          No tasks in this column
        </div>
      </div>
    </div>
  </div>
</template>