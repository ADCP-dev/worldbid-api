<script setup lang="ts">
import { ref, watch, computed } from 'vue';
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
}>();

const emit = defineEmits<{
  (e: 'create-task', stateId: string): void;
  (e: 'update-task-state', payload: { taskId: string; newStateId: string; oldStateId: string }): void;
  (e: 'update-task-title', payload: { taskId: string; title: string }): void;
  (e: 'delete-task', taskId: string): void;
  (e: 'click-task', taskId: string): void;
  (e: 'toggle-checklist-item', payload: { taskId: string; itemId: string }): void;
  (e: 'add-checklist-item', payload: { taskId: string; text: string }): void;
}>();

const localTasks = ref<KanbanTask[]>([...props.tasks]);

watch(
  () => props.tasks,
  (newTasks) => {
    localTasks.value = [...newTasks];
  },
  { deep: true }
);

const headerClass = computed(() => {
  return props.styleConfig?.[props.state.id]?.headerClass ?? '';
});

const borderClass = computed(() => {
  return props.styleConfig?.[props.state.id]?.borderClass ?? '';
});

const bgClass = computed(() => {
  return props.styleConfig?.[props.state.id]?.bgClass ?? '';
});

function onDragChange(event: any) {
  if (event.added) {
    const task = event.added.element as KanbanTask;
    const oldStateId = task.stateId;
    const newStateId = props.state.id;
    if (oldStateId !== newStateId) {
      emit('update-task-state', { taskId: task.id, newStateId, oldStateId });
    }
  }
  if (event.moved) {
    const task = event.moved.element as KanbanTask;
    task.order = event.moved.newIndex;
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

    <!-- Body -->
    <div class="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
      <VueDraggable
        v-model="localTasks"
        :group="group"
        :animation="150"
        ghost-class="kanban-ghost"
        item-key="id"
        @change="onDragChange"
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
