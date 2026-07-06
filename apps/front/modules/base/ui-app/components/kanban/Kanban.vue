<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Plus, LayoutGrid, List, ChevronDown, Filter } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
import type {
  KanbanTask,
  KanbanStateConfig,
  KanbanTagConfig,
  KanbanColumnStyleConfig,
} from './types';
import KanbanColumn from './KanbanColumn.vue';
import KanbanCard from './KanbanCard.vue';

const props = withDefaults(defineProps<{
  tasks: KanbanTask[];
  states: KanbanStateConfig[];
  tagConfig?: KanbanTagConfig;
  stateConfig?: KanbanColumnStyleConfig;
  group?: string;
  dragOptions?: object;
  /** View mode: 'kanban' (columns) or 'list' (collapsible sections). Defaults to 'kanban'. */
  viewMode?: 'kanban' | 'list';
  /** State IDs to show. null/undefined = all states. */
  selectedStateIds?: string[] | null;
  /** Show the view toggle + status filter toolbar. Defaults to true. */
  showToolbar?: boolean;
}>(), {
  group: 'kanban',
  viewMode: 'kanban',
  selectedStateIds: null,
  showToolbar: true,
});

const emit = defineEmits<{
  (e: 'update:task-state', payload: { taskId: string; newStateId: string; oldStateId: string }): void;
  (e: 'create-task', stateId: string): void;
  (e: 'update-task-title', payload: { taskId: string; title: string }): void;
  (e: 'delete-task', taskId: string): void;
  (e: 'click-task', taskId: string): void;
  (e: 'toggle-checklist-item', payload: { taskId: string; itemId: string }): void;
  (e: 'add-checklist-item', payload: { taskId: string; text: string }): void;
  (e: 'create-state'): void;
  (e: 'update:view-mode', mode: 'kanban' | 'list'): void;
  (e: 'update:selected-state-ids', ids: string[] | null): void;
}>();

// ─── Internal reactive state (synced with props) ──────────────────────────

const internalViewMode = ref(props.viewMode);
const internalSelectedIds = ref<string[] | null>(props.selectedStateIds);
const showStateFilter = ref(false);

// Collapsed state for list view — keyed by stateId
const collapsedStates = ref<Record<string, boolean>>({});

function toggleViewMode() {
  internalViewMode.value = internalViewMode.value === 'kanban' ? 'list' : 'kanban';
  emit('update:view-mode', internalViewMode.value);
}

function toggleStateFilter() {
  showStateFilter.value = !showStateFilter.value;
}

function toggleStateSelection(stateId: string) {
  if (internalSelectedIds.value === null) {
    // Currently "all" — start by selecting all except the toggled one
    internalSelectedIds.value = props.states
      .map((s) => s.id)
      .filter((id) => id !== stateId);
  } else {
    if (internalSelectedIds.value.includes(stateId)) {
      internalSelectedIds.value = internalSelectedIds.value.filter((id) => id !== stateId);
      if (internalSelectedIds.value.length === 0) {
        // None selected → reset to all
        internalSelectedIds.value = null;
      }
    } else {
      internalSelectedIds.value = [...internalSelectedIds.value, stateId];
      // If all are selected, reset to null (= all)
      if (internalSelectedIds.value.length === props.states.length) {
        internalSelectedIds.value = null;
      }
    }
  }
  emit('update:selected-state-ids', internalSelectedIds.value);
}

function selectAllStates() {
  internalSelectedIds.value = null;
  emit('update:selected-state-ids', null);
}

function toggleCollapse(stateId: string) {
  collapsedStates.value[stateId] = !collapsedStates.value[stateId];
}

// ─── Computed ─────────────────────────────────────────────────────────────

const sortedStates = computed(() => {
  return [...props.states].sort((a, b) => a.order - b.order);
});

const visibleStates = computed(() => {
  if (internalSelectedIds.value === null) return sortedStates.value;
  return sortedStates.value.filter((s) => internalSelectedIds.value!.includes(s.id));
});

const tasksByState = computed(() => {
  const map: Record<string, KanbanTask[]> = {};
  for (const state of sortedStates.value) {
    map[state.id] = props.tasks.filter((task) => task.stateId === state.id);
  }
  return map;
});

const totalTasks = computed(() => props.tasks.length);
const visibleTasksCount = computed(() => {
  return visibleStates.value.reduce((sum, state) => {
    return sum + (tasksByState.value[state.id]?.length ?? 0);
  }, 0);
});

// ─── List view: local task lists for drag&drop within collapsed sections ──

const listTasksByState = ref<Record<string, KanbanTask[]>>({});

function syncListTasks() {
  for (const state of sortedStates.value) {
    listTasksByState.value[state.id] = [...(tasksByState.value[state.id] ?? [])];
  }
}

// Re-sync when tasks change
watch(
  () => props.tasks,
  () => syncListTasks(),
  { deep: true, immediate: true },
);

function onListDragChange(stateId: string, event: any) {
  if (event.added) {
    const task = event.added.element as KanbanTask;
    const oldStateId = task.stateId;
    if (oldStateId !== stateId) {
      // Update the task's stateId in local list
      task.stateId = stateId;
      emit('update:task-state', { taskId: task.id, newStateId: stateId, oldStateId });
    }
  }
  if (event.moved) {
    const task = event.moved.element as KanbanTask;
    task.order = event.moved.newIndex;
  }
}

// ─── Event relay ──────────────────────────────────────────────────────────

function handleUpdateTaskState(payload: { taskId: string; newStateId: string; oldStateId: string }) {
  emit('update:task-state', payload);
}

function handleCreateTask(stateId: string) {
  emit('create-task', stateId);
}

function handleUpdateTaskTitle(payload: { taskId: string; title: string }) {
  emit('update-task-title', payload);
}

function handleDeleteTask(taskId: string) {
  emit('delete-task', taskId);
}

function handleClickTask(taskId: string) {
  emit('click-task', taskId);
}

function handleToggleChecklistItem(payload: { taskId: string; itemId: string }) {
  emit('toggle-checklist-item', payload);
}

function handleAddChecklistItem(payload: { taskId: string; text: string }) {
  emit('add-checklist-item', payload);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar: view toggle + state filter -->
    <div
      v-if="showToolbar"
      class="flex items-center justify-between px-4 py-2 border-b border-base-300 gap-2 flex-shrink-0"
    >
      <!-- Left: view mode toggle -->
      <div class="flex items-center gap-2">
        <div class="join">
          <button
            class="btn btn-sm join-item"
            :class="internalViewMode === 'kanban' ? 'btn-active btn-primary' : 'btn-ghost'"
            @click="internalViewMode = 'kanban'; emit('update:view-mode', 'kanban')"
          >
            <LayoutGrid class="w-4 h-4" />
            <span class="hidden sm:inline">Kanban</span>
          </button>
          <button
            class="btn btn-sm join-item"
            :class="internalViewMode === 'list' ? 'btn-active btn-primary' : 'btn-ghost'"
            @click="internalViewMode = 'list'; emit('update:view-mode', 'list')"
          >
            <List class="w-4 h-4" />
            <span class="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      <!-- Right: state filter + counts -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-base-content/60 hidden sm:inline">
          {{ visibleTasksCount }}/{{ totalTasks }} tasks
        </span>

        <!-- State filter dropdown -->
        <div class="dropdown dropdown-end">
          <button
            class="btn btn-sm btn-ghost gap-1"
            :class="{ 'btn-active': internalSelectedIds !== null }"
            @click="toggleStateFilter"
          >
            <Filter class="w-4 h-4" />
            <span class="hidden sm:inline">Filter</span>
            <ChevronDown class="w-3 h-3" />
          </button>

          <!-- Dropdown menu -->
          <div
            v-if="showStateFilter"
            class="dropdown-content z-50 mt-2 p-3 shadow-lg bg-base-100 rounded-lg border border-base-300 w-56"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">States</span>
              <button
                class="btn btn-xs btn-ghost"
                @click="selectAllStates"
              >
                All
              </button>
            </div>
            <div class="space-y-1">
              <label
                v-for="state in sortedStates"
                :key="state.id"
                class="flex items-center gap-2 cursor-pointer hover:bg-base-200 rounded px-2 py-1"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  :checked="internalSelectedIds === null || internalSelectedIds.includes(state.id)"
                  @change="toggleStateSelection(state.id)"
                >
                <span
                  v-if="state.color"
                  class="w-2 h-2 rounded-full"
                  :class="{
                    'bg-neutral': state.color === 'neutral',
                    'bg-success': state.color === 'success',
                    'bg-warning': state.color === 'warning',
                    'bg-info': state.color === 'info',
                    'bg-error': state.color === 'error',
                    'bg-primary': state.color === 'primary',
                  }"
                />
                <span class="text-sm flex-1">{{ state.title }}</span>
                <span class="badge badge-xs badge-ghost">
                  {{ tasksByState[state.id]?.length ?? 0 }}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- KANBAN VIEW (original) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="internalViewMode === 'kanban'" class="flex-1 overflow-hidden">
      <div class="flex overflow-x-auto gap-4 p-4 h-full">
        <KanbanColumn
          v-for="state in visibleStates"
          :key="state.id"
          :state="state"
          :tasks="tasksByState[state.id] ?? []"
          :tag-config="tagConfig"
          :style-config="stateConfig"
          :group="group"
          @create-task="handleCreateTask"
          @update-task-state="handleUpdateTaskState"
          @update-task-title="handleUpdateTaskTitle"
          @delete-task="handleDeleteTask"
          @click-task="handleClickTask"
          @toggle-checklist-item="handleToggleChecklistItem"
          @add-checklist-item="handleAddChecklistItem"
        >
          <template v-if="$slots['empty-state']" #empty-state="{ stateId }">
            <slot name="empty-state" :state-id="stateId" />
          </template>
          <template v-if="$slots['column-header']" #column-header="{ state, count }">
            <slot name="column-header" :state="state" :count="count" />
          </template>
          <template v-if="$slots['card-actions']" #card-actions="{ task }">
            <slot name="card-actions" :task="task" />
          </template>
        </KanbanColumn>

        <button
          class="btn btn-ghost btn-sm flex-shrink-0 self-start mt-2 px-4 border-2 border-dashed border-base-300 hover:border-primary"
          @click="emit('create-state')"
        >
          <Plus class="w-4 h-4" />
          <span>Columna</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- LIST VIEW (collapsible sections by status with drag&drop) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="max-w-3xl mx-auto p-4 space-y-2">
        <div
          v-for="state in visibleStates"
          :key="state.id"
          class="rounded-lg border border-base-300 overflow-hidden"
        >
          <!-- Section header (clickable to collapse) -->
          <div
            class="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-base-200 transition-colors"
            @click="toggleCollapse(state.id)"
          >
            <div class="flex items-center gap-2">
              <ChevronDown
                class="w-4 h-4 transition-transform"
                :class="{ '-rotate-90': collapsedStates[state.id] }"
              />
              <span
                v-if="state.color"
                class="w-2.5 h-2.5 rounded-full"
                :class="{
                  'bg-neutral': state.color === 'neutral',
                  'bg-success': state.color === 'success',
                  'bg-warning': state.color === 'warning',
                  'bg-info': state.color === 'info',
                  'bg-error': state.color === 'error',
                  'bg-primary': state.color === 'primary',
                }"
              />
              <h3 class="font-semibold text-sm">{{ state.title }}</h3>
              <span class="badge badge-sm badge-ghost">
                {{ listTasksByState[state.id]?.length ?? 0 }}
              </span>
            </div>

            <button
              class="btn btn-ghost btn-xs"
              @click.stop="emit('create-task', state.id)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Collapsible body with drag&drop -->
          <div
            v-show="!collapsedStates[state.id]"
            class="p-2 border-t border-base-300"
          >
            <div
              v-if="(listTasksByState[state.id]?.length ?? 0) === 0"
              class="text-center py-6 text-base-content/40 text-sm"
            >
              <slot name="empty-state" :state-id="state.id">
                No tasks
              </slot>
            </div>

            <VueDraggable
              v-else
              v-model="listTasksByState[state.id]"
              :group="group"
              :animation="150"
              ghost-class="kanban-ghost"
              item-key="id"
              class="flex flex-col gap-2"
              @change="(e: any) => onListDragChange(state.id, e)"
            >
              <KanbanCard
                v-for="task in listTasksByState[state.id]"
                :key="task.id"
                :task="task"
                :tag-config="tagConfig"
                @click="$emit('click-task', $event)"
                @update-title="$emit('update-task-title', $event)"
                @delete="$emit('delete-task', $event)"
                @toggle-checklist-item="$emit('toggle-checklist-item', $event)"
                @add-checklist-item="$emit('add-checklist-item', $event)"
              />
            </VueDraggable>
          </div>
        </div>

        <!-- Empty state when no states are visible -->
        <div
          v-if="visibleStates.length === 0"
          class="text-center py-12 text-base-content/40"
        >
          <p class="text-sm">No states match the current filter.</p>
          <button class="btn btn-ghost btn-sm mt-2" @click="selectAllStates">
            Show all
          </button>
        </div>
      </div>
    </div>
  </div>
</template>