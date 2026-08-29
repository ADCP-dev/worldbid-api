<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { Plus } from 'lucide-vue-next';
import type { KanbanStateConfig, KanbanTask, KanbanTagConfig, KanbanColumnStyleConfig } from './types';
import KanbanCard from './KanbanCard.vue';

const props = defineProps<{
  state: KanbanStateConfig;
  tasks: KanbanTask[];
  tagConfig?: KanbanTagConfig;
  styleConfig?: KanbanColumnStyleConfig;
  group: string;
  /** Extra SortableJS options merged over the defaults. */
  dragOptions?: object;
}>();

const emit = defineEmits<{
  (e: 'create-task' | 'delete-task' | 'click-task', payload: string): void;
  (e: 'update-task-state', payload: { taskId: string; newStateId: string; oldStateId: string }): void;
  (e: 'update-task-order', payload: { taskId: string; stateId: string; index: number }): void;
  (e: 'update-task-title', payload: { taskId: string; title: string }): void;
  (e: 'toggle-checklist-item', payload: { taskId: string; itemId: string }): void;
  (e: 'add-checklist-item', payload: { taskId: string; text: string }): void;
}>();

const DEFAULT_DRAG_OPTIONS = { fallbackTolerance: 3 } as const;

const localTasks = ref<KanbanTask[]>([]);

// While a drag is active SortableJS owns the DOM and the v-model. Reacting to
// prop updates mid-drag (the old deep watch) desynced the DOM and locked the
// board after the first drop. Instead: reconcile by id *sequence* after the drag ends.
const isDragging = ref(false);

function onDragStart() {
  isDragging.value = true;
}

function onDragEnd() {
  isDragging.value = false;
  nextTick(reconcile);
}

/**
 * Align localTasks with props.tasks without clobbering an in-flight drag.
 * Only rebuilds when membership changes; pure reordering from the DOM drop is kept.
 */
function reconcile() {
  const wantedIds = props.tasks.map((t) => t.id);
  const wantedSet = new Set(wantedIds);
  const localIds = new Set(localTasks.value.map((t) => t.id));

  const added = props.tasks.filter((t) => !localIds.has(t.id));
  const removed = localTasks.value.filter((t) => !wantedSet.has(t.id));

  if (added.length === 0 && removed.length === 0) {
    // Same members — maybe parent reordered internally. Parent is source of
    // truth when nothing is in flight, but keep our DOM order (from the drop).
    return;
  }

  if (added.length === 0 && removed.length > 0) {
    // Task(s) left this column (dragged out / deleted elsewhere): drop them.
    localTasks.value = localTasks.value.filter((t) => wantedSet.has(t.id));
    return;
  }

  if (added.length > 0 && removed.length === 0 && wantedIds.length === localIds.length + added.length) {
    // Task(s) arrived via parent update only (create, filter change). Insert
    // each one next to its nearest previous sibling that is already local.
    const result = [...localTasks.value];
    for (const task of added) {
      const wantedIndex = props.tasks.findIndex((t) => t.id === task.id);
      let insertAt = result.length;
      for (let i = wantedIndex - 1; i >= 0; i--) {
        const at = result.findIndex((t) => t.id === props.tasks[i]!.id);
        if (at > -1) {
          insertAt = at + 1;
          break;
        }
      }
      result.splice(insertAt, 0, task);
    }
    localTasks.value = result;
    return;
  }

  // Anything else (bulk create/delete): full rebuild, non-drag context only.
  localTasks.value = [...props.tasks];
}

watch(
  () => props.tasks.map((t) => t.id).join('|'),
  () => {
    if (isDragging.value) return;
    reconcile();
  },
  { immediate: true },
);

const mergedDragOptions = computed(() => ({
  ...DEFAULT_DRAG_OPTIONS,
  ...props.dragOptions,
}));

const headerClass = computed(() => props.styleConfig?.[props.state.id]?.headerClass ?? '');
const borderClass = computed(() => props.styleConfig?.[props.state.id]?.borderClass ?? '');
const bgClass = computed(() => props.styleConfig?.[props.state.id]?.bgClass ?? '');

function onDragChange(event: unknown) {
  const ev = event as { added?: { element: KanbanTask }; moved?: { element: KanbanTask; newIndex: number } } | undefined;
  if (!ev) return;
  if (ev.added) {
    const task = ev.added.element;
    const oldStateId = task.stateId;
    const newStateId = props.state.id;
    if (oldStateId !== newStateId) {
      emit('update-task-state', { taskId: task.id, newStateId, oldStateId });
      // Keep the entry order hint in sync for persistence.
      emit('update-task-order', { taskId: task.id, stateId: newStateId, index: localTasks.value.findIndex((t) => t.id === task.id) });
      return;
    }
  }
  if (ev.moved) {
    const task = ev.moved.element;
    task.order = ev.moved.newIndex;
    emit('update-task-order', { taskId: task.id, stateId: props.state.id, index: ev.moved.newIndex });
  }
}
</script>

<template>
  <div
    class="flex flex-col rounded-lg border border-base-300 min-w-[280px] max-w-[350px] flex-shrink-0"
    :class="[borderClass, bgClass]"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 py-2 rounded-t-lg"
      :class="headerClass"
    >
      <h3 class="font-semibold text-sm">{{ state.title }}</h3>
      <span class="badge badge-sm badge-ghost">{{ localTasks.length }}</span>
    </div>

    <!-- Body — no per-column scroll: the board container scrolls vertically, columns grow naturally -->
    <div class="flex-1 p-2 flex flex-col gap-2">
      <VueDraggable
        v-model="localTasks"
        :group="group"
        :options="mergedDragOptions"
        :animation="150"
        ghost-class="kanban-ghost"
        item-key="id"
        class="flex flex-col gap-2 flex-1"
        :class="{ 'min-h-[80px] rounded-lg border border-dashed border-base-300': localTasks.length === 0 }"
        @change="onDragChange"
        @start="onDragStart"
        @end="onDragEnd"
      >
        <KanbanCard
          v-for="task in localTasks"
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

      <!-- Create task button -->
      <button
        class="btn btn-ghost btn-sm w-full mt-1"
        @click="$emit('create-task', state.id)"
      >
        <Plus class="w-4 h-4" />
        <span>Crear tarea</span>
      </button>
    </div>
  </div>
</template>