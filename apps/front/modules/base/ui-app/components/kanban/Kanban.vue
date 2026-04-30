<script setup lang="ts">
import { computed } from 'vue';
import { Plus } from 'lucide-vue-next';
import type {
  KanbanTask,
  KanbanStateConfig,
  KanbanTagConfig,
  KanbanColumnStyleConfig,
} from './types';
import KanbanColumn from './KanbanColumn.vue';

const props = withDefaults(defineProps<{
  tasks: KanbanTask[];
  states: KanbanStateConfig[];
  tagConfig?: KanbanTagConfig;
  stateConfig?: KanbanColumnStyleConfig;
  group?: string;
  dragOptions?: object;
}>(), {
  group: 'kanban',
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
}>();

const sortedStates = computed(() => {
  return [...props.states].sort((a, b) => a.order - b.order);
});

const tasksByState = computed(() => {
  const map: Record<string, KanbanTask[]> = {};
  for (const state of sortedStates.value) {
    map[state.id] = props.tasks.filter((task) => task.stateId === state.id);
  }
  return map;
});

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
  <div class="flex overflow-x-auto gap-4 p-4 h-full">
    <KanbanColumn
      v-for="state in sortedStates"
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
</template>
