<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Plus, LayoutGrid, List, ChevronDown, Filter } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
import type {
  KanbanTask,
  KanbanStateConfig,
  KanbanTagConfig,
  KanbanColumnStyleConfig,
  KanbanDragEvent,
} from './types';
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
  tagConfig: undefined,
  stateConfig: undefined,
  group: 'kanban',
  dragOptions: undefined,
  viewMode: 'kanban',
  selectedStateIds: null,
  showToolbar: true,
});

const emit = defineEmits<{
  (e: 'create-task' | 'delete-task' | 'click-task', payload: string): void;
  (e: 'update:task-state', payload: { taskId: string; newStateId: string; oldStateId: string }): void;
  (e: 'update:task-order', payload: { taskId: string; stateId: string; index: number }): void;
  /** Bulk commit of the full visual order after a list-view drop. */
  (e: 'update:tasks-order', tasks: Array<{ taskId: string; stateId: string; order: number }>): void;
  (e: 'update-task-title', payload: { taskId: string; title: string }): void;
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
const filterDropdownRef = ref<HTMLElement | null>(null);

// Collapsed state for list view — keyed by stateId
const collapsedStates = ref<Record<string, boolean>>({});

// While a drag is active SortableJS owns the DOM. Reacting to prop updates
// mid-drag desyncs the DOM and locks the board; reconcile only after drop.
const isDraggingList = ref(false);

watch(() => props.viewMode, (mode) => { internalViewMode.value = mode; });
watch(() => props.selectedStateIds, (ids) => { internalSelectedIds.value = ids; });

function toggleStateFilter() {
  showStateFilter.value = !showStateFilter.value;
}

function closeStateFilter(event: MouseEvent) {
  if (
    showStateFilter.value &&
    filterDropdownRef.value &&
    !filterDropdownRef.value.contains(event.target as Node)
  ) {
    showStateFilter.value = false;
  }
}

onMounted(() => document.addEventListener('click', closeStateFilter));
onBeforeUnmount(() => document.removeEventListener('click', closeStateFilter));

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

/** Sort by explicit order; tasks without order keep their relative position. */
function sortTasks(tasks: KanbanTask[]): KanbanTask[] {
  return [...tasks].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );
}

const tasksByState = computed(() => {
  const map: Record<string, KanbanTask[]> = {};
  for (const state of sortedStates.value) {
    map[state.id] = sortTasks(props.tasks.filter((task) => task.stateId === state.id));
  }
  return map;
});

const totalTasks = computed(() => props.tasks.length);
const visibleTasksCount = computed(() => {
  return visibleStates.value.reduce((sum, state) => {
    return sum + (tasksByState.value[state.id]?.length ?? 0);
  }, 0);
});

// ─── List view: local task lists for drag&drop across collapsible sections ─

const listTasksByState = ref<Record<string, KanbanTask[]>>({});

function rebuildListTasks() {
  if (isDraggingList.value) return;
  const map: Record<string, KanbanTask[]> = {};
  for (const state of sortedStates.value) {
    map[state.id] = sortTasks(tasksByState.value[state.id] ?? []);
  }
  listTasksByState.value = map;
}

// Rebuild on membership/state changes (NOT deep: content edits must not clobber).
watch(
  [
    () => props.tasks.map((t) => `${t.id}:${t.stateId}`).join('|'),
    () => props.states.map((s) => s.id).join('|'),
    internalViewMode,
  ],
  () => {
    if (internalViewMode.value !== 'list') return;
    nextTick(rebuildListTasks);
  },
  { immediate: true },
);

const mergedDragOptions = computed(() => ({
  fallbackTolerance: 3,
  ...(props.dragOptions ?? {}),
}));

function onListDragStart() {
  isDraggingList.value = true;
}

/**
 * Commit the exact visual state the user sees after a list-view drop.
 * Emits one bulk event (stateId + order per task, across ALL visible sections)
 * so the parent can apply it atomically and rebuild won't fight the drop.
 */
function onListDragEnd() {
  isDraggingList.value = false;
  nextTick(() => {
    const commit: Array<{ taskId: string; stateId: string; order: number }> = [];
    for (const state of sortedStates.value) {
      const list = listTasksByState.value[state.id] ?? [];
      list.forEach((task, index) => {
        task.stateId = state.id;
        task.order = index;
        commit.push({ taskId: task.id, stateId: state.id, order: index });
      });
    }
    emit('update:tasks-order', commit);
    nextTick(rebuildListTasks);
  });
}

function onListDragChange(stateId: string, event: KanbanDragEvent) {
  if (event.added) {
    const task = event.added.element;
    const oldStateId = task.stateId;
    if (oldStateId !== stateId) {
      task.stateId = stateId;
      emit('update:task-state', { taskId: task.id, newStateId: stateId, oldStateId });
      return;
    }
  }
}

// ─── Event relay ──────────────────────────────────────────────────────────

function handleUpdateTaskState(payload: { taskId: string; newStateId: string; oldStateId: string }) {
  emit('update:task-state', payload);
}

function handleUpdateTaskOrder(payload: { taskId: string; stateId: string; index: number }) {
  emit('update:task-order', payload);
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
        <div ref="filterDropdownRef" class="dropdown dropdown-end">
          <button
            class="btn btn-sm btn-ghost gap-1"
            :class="{ 'btn-active': internalSelectedIds !== null }"
            @click.stop="toggleStateFilter"
          >
            <Filter class="w-4 h-4" />
            <span class="hidden sm:inline">Filter</span>
            <ChevronDown class="w-3 h-3" />
          </button>

          <!-- Dropdown menu — v-if removed: must stay mounted for the outside-click check -->
          <div
            v-show="showStateFilter"
            class="dropdown-content z-50 mt-2 p-3 shadow-lg bg-base-100 rounded-lg border border-base-300 w-56"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">States</span>
              <button
                class="btn btn-xs btn-ghost"
                @click.stop="selectAllStates"
              >
                All
              </button>
            </div>
            <div class="space-y-1">
              <label
                v-for="state in sortedStates"
                :key="state.id"
                class="flex items-center gap-2 cursor-pointer hover:bg-base-200 rounded px-2 py-1"
                @click.stop
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
    <!-- KANBAN VIEW -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="internalViewMode === 'kanban'" class="flex-1 overflow-hidden">
      <!-- Board: horizontal scroll for columns, vertical scroll for whole board (columns grow, no inner scroll) -->
      <div class="flex items-start overflow-x-auto overflow-y-auto h-full gap-4 p-4">
        <KanbanColumn
          v-for="state in visibleStates"
          :key="state.id"
          :state="state"
          :tasks="tasksByState[state.id] ?? []"
          :tag-config="tagConfig"
          :style-config="stateConfig"
          :group="group"
          :drag-options="dragOptions"
          @create-task="handleCreateTask"
          @update-task-state="handleUpdateTaskState"
          @update-task-order="handleUpdateTaskOrder"
          @update-task-title="handleUpdateTaskTitle"
          @delete-task="handleDeleteTask"
          @click-task="handleClickTask"
          @toggle-checklist-item="handleToggleChecklistItem"
          @add-checklist-item="handleAddChecklistItem"
        >
          <template v-if="$slots['empty-state']" #empty-state="{ stateId }">
            <slot name="empty-state" :state-id="stateId" />
          </template>
          <template v-if="$slots['column-header']" #column-header="{ state: columnState, count }">
            <slot name="column-header" :state="columnState" :count="count" />
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
              @click.stop="handleCreateTask(state.id)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Collapsible body with drag&drop (always mounted → empty sections stay droppable) -->
          <div
            v-show="!collapsedStates[state.id]"
            class="p-2 border-t border-base-300"
          >
            <div
              v-if="(listTasksByState[state.id]?.length ?? 0) === 0"
              class="text-center py-4 text-base-content/40 text-sm"
            >
              <slot name="empty-state" :state-id="state.id">
                No tasks
              </slot>
            </div>

            <VueDraggable
              v-model="listTasksByState[state.id]"
              :group="group"
              :options="mergedDragOptions"
              :animation="150"
              ghost-class="kanban-ghost"
              item-key="id"
              class="flex flex-col gap-2"
              :class="{ 'min-h-[56px] rounded-lg border border-dashed border-base-300': (listTasksByState[state.id]?.length ?? 0) === 0 }"
              @change="(e: KanbanDragEvent) => onListDragChange(state.id, e)"
              @start="onListDragStart"
              @end="onListDragEnd"
            >
              <KanbanCard
                v-for="task in listTasksByState[state.id]"
                :key="task.id"
                :task="task"
                :tag-config="tagConfig"
                @click="handleClickTask($event)"
                @update-title="handleUpdateTaskTitle($event)"
                @delete="handleDeleteTask($event)"
                @toggle-checklist-item="handleToggleChecklistItem($event)"
                @add-checklist-item="handleAddChecklistItem($event)"
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