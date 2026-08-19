<script setup lang="ts">
/**
 * TaskGroupedList — list view grouped by status.
 *
 * Each status group is a collapsible section showing its tasks inline.
 * Cards can be dragged between groups (same vue-draggable-plus group as the
 * kanban board). Each item also has a dropdown to pick a status directly.
 *
 * Emits the same `@drop` contract as TaskKanbanBoard so the parent page can
 * reuse a single handler.
 */
import { ref, computed, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { ChevronDown, ChevronRight, Calendar, Pencil } from 'lucide-vue-next';
import type { Task, TaskStatus, UserLight } from '../types';
import { TASK_STATUSES } from '../types';
import TaskStatusBadge from './TaskStatusBadge.vue';
import TaskPriorityBadge from './TaskPriorityBadge.vue';

const props = defineProps<{
  tasks: Task[];
  users: UserLight[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'drop', payload: { taskId: number; newStatus: TaskStatus }): void;
  (e: 'click', taskId: number): void;
  (e: 'edit', taskId: number): void;
}>();

const GROUPS: Array<{ id: TaskStatus; title: string }> = [
  { id: 'pending', title: 'Pending' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
  { id: 'blocked', title: 'Blocked' },
];

// Collapsible state per group, persisted lightly in memory only.
const collapsed = ref<Record<TaskStatus, boolean>>({
  pending: false,
  in_progress: false,
  review: false,
  done: false,
  blocked: false,
});

function toggleGroup(status: TaskStatus) {
  collapsed.value = { ...collapsed.value, [status]: !collapsed.value[status] };
}

// Local mirror of tasks grouped by status, kept in sync with props.
const groups = ref<Record<TaskStatus, Task[]>>({
  pending: [],
  in_progress: [],
  review: [],
  done: [],
  blocked: [],
});

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
  groups.value = map;
}

watch(
  () => props.tasks,
  () => syncFromProps(),
  { immediate: true, deep: false },
);

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of props.users ?? []) m[u.id] = u;
  return m;
});

function initials(id?: number | null): string {
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
  return new Date(d).toLocaleDateString('en-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isOverdue(t: Task): boolean {
  if (!t.dueDate) return false;
  return new Date(t.dueDate).getTime() < Date.now() && t.status !== 'done';
}

// Drag handler — mirrors TaskKanbanBoard.onColumnChange.
function onGroupChange(status: TaskStatus, evt: { added?: { element: Task } }) {
  if (evt?.added?.element) {
    const task = evt.added.element;
    if (task.status !== status) {
      emit('drop', { taskId: task.id, newStatus: status });
    }
  }
}

// Status dropdown per item — used by the inline status button.
function onStatusChange(task: Task, event: Event) {
  const value = (event.target as HTMLSelectElement).value as TaskStatus;
  if (value && value !== task.status) {
    emit('drop', { taskId: task.id, newStatus: value });
  }
  // Reset the select so it always shows the current status (the canonical
  // state lives on the task prop, not on this control).
  (event.target as HTMLSelectElement).value = task.status;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = TASK_STATUSES.map((s) => ({
  value: s,
  label: s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1),
}));
</script>

<template>
  <div class="space-y-3">
    <!-- Grouped sections -->
    <div
      v-for="group in GROUPS"
      :key="group.id"
      class="card bg-base-100 shadow-sm border border-base-300"
    >
      <!-- Group header (collapsible) -->
      <button
        type="button"
        class="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-base-200/50 transition-colors rounded-t-lg"
        @click="toggleGroup(group.id)"
      >
        <component
          :is="collapsed[group.id] ? ChevronRight : ChevronDown"
          class="w-4 h-4 text-base-content/50 shrink-0"
        />
        <TaskStatusBadge :status="group.id" />
        <span class="font-semibold text-sm">{{ group.title }}</span>
        <span class="badge badge-sm badge-ghost">{{ groups[group.id].length }}</span>
      </button>

      <!-- Group body -->
      <div v-show="!collapsed[group.id]" class="card-body p-0 pt-2">
        <div v-if="loading && groups[group.id].length === 0" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-sm text-primary" />
        </div>

        <VueDraggable
          v-else
          v-model="groups[group.id]"
          group="tasks-list"
          :animation="150"
          ghost-class="opacity-50"
          chosen-class="ring-2 ring-primary"
          item-key="id"
          class="flex flex-col gap-2 min-h-[40px] px-4 pb-4"
          @change="(e: { added?: { element: Task } }) => onGroupChange(group.id, e)"
        >
          <template v-for="task in groups[group.id]" :key="task.id">
            <div
              class="flex items-center gap-3 p-3 bg-base-200/40 rounded-lg border border-base-300 hover:border-primary/40 transition-colors cursor-grab active:cursor-grabbing"
              @click="emit('click', task.id)"
            >
              <!-- Title + meta -->
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm line-clamp-1">{{ task.title }}</div>
                <div class="flex items-center gap-3 mt-1 flex-wrap text-xs text-base-content/50">
                  <TaskPriorityBadge :priority="task.priority" />
                  <span
                    v-if="task.dueDate"
                    class="inline-flex items-center gap-1"
                    :class="isOverdue(task) ? 'text-error font-medium' : ''"
                  >
                    <Calendar class="w-3 h-3" />{{ formatDate(task.dueDate) }}
                  </span>
                  <span v-if="task.estimateHours != null">{{ task.estimateHours }}h</span>
                  <span class="text-base-content/30">#{{ task.id }}</span>
                </div>
              </div>

              <!-- Assignee avatar -->
              <div
                class="avatar shrink-0"
                :title="task.assigneeId ? `${userMap[task.assigneeId]?.firstName ?? ''} ${userMap[task.assigneeId]?.lastName ?? ''}`.trim() : 'Unassigned'"
              >
                <div class="w-7 h-7 rounded-full bg-neutral text-neutral-content text-[10px] flex items-center justify-center">
                  {{ initials(task.assigneeId) }}
                </div>
              </div>

              <!-- Status dropdown -->
              <select
                class="select select-bordered select-xs w-32"
                :value="task.status"
                @click.stop
                @change="onStatusChange(task, $event)"
              >
                <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>

              <!-- Edit button -->
              <button
                class="btn btn-ghost btn-xs btn-circle shrink-0"
                title="Edit"
                @click.stop="emit('edit', task.id)"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
            </div>
          </template>
        </VueDraggable>

        <div
          v-if="!loading && groups[group.id].length === 0"
          class="text-center py-6 text-base-content/40 text-xs border-2 border-dashed border-base-300 rounded-lg mx-4 mb-4"
        >
          No tasks
        </div>
      </div>
    </div>
  </div>
</template>