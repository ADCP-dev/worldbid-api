<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Pencil, FileText, Link2, CheckSquare, Calendar, Plus } from 'lucide-vue-next';
import type { KanbanTask, KanbanTagConfig } from './types';
import UserAvatar from './UserAvatar.vue';
import KanbanTag from './KanbanTag.vue';

const props = defineProps<{
  task: KanbanTask;
  tagConfig?: KanbanTagConfig;
}>();

const emit = defineEmits<{
  (e: 'click', taskId: string): void;
  (e: 'update-title', payload: { taskId: string; title: string }): void;
  (e: 'delete', taskId: string): void;
  (e: 'toggle-checklist-item', payload: { taskId: string; itemId: string }): void;
  (e: 'add-checklist-item', payload: { taskId: string; text: string }): void;
}>();

const isEditing = ref(false);
const editTitle = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);
const isChecklistExpanded = ref(false);
const newItemText = ref('');

watch(isEditing, (val) => {
  if (val) {
    nextTick(() => {
      titleInputRef.value?.focus();
    });
  }
});

const checklistTotal = computed(() => props.task.checklist?.length ?? 0);
const checklistDone = computed(() => props.task.checklist?.filter((item) => item.done).length ?? 0);
const checklistAllDone = computed(() => checklistTotal.value > 0 && checklistDone.value === checklistTotal.value);

const priorityBadgeClass = computed(() => {
  switch (props.task.priority) {
    case 'low':
      return 'badge-ghost';
    case 'medium':
      return 'badge-warning';
    case 'high':
      return 'badge-error';
    default:
      return '';
  }
});

const priorityLabel = computed(() => {
  switch (props.task.priority) {
    case 'low':
      return 'Baja';
    case 'medium':
      return 'Media';
    case 'high':
      return 'Alta';
    default:
      return '';
  }
});

const visibleTags = computed(() => {
  const max = props.tagConfig?.maxVisible ?? Infinity;
  return props.task.tags?.slice(0, max) ?? [];
});

const hiddenTagsCount = computed(() => {
  const max = props.tagConfig?.maxVisible ?? Infinity;
  const total = props.task.tags?.length ?? 0;
  return Math.max(0, total - max);
});

const descriptionPreview = computed(() => {
  if (!props.task.description) return '';
  return props.task.description.length > 120
    ? props.task.description.slice(0, 120) + '...'
    : props.task.description;
});

const relatedTasksTitles = computed(() => {
  return props.task.relatedTasks?.map((t) => t.title).join(' · ') ?? '';
});

const formattedDueDate = computed(() => {
  if (!props.task.dueDate) return '';
  return new Date(props.task.dueDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
});

function startEdit() {
  isEditing.value = true;
  editTitle.value = props.task.title;
}

function saveTitle() {
  if (!editTitle.value.trim()) {
    cancelEdit();
    return;
  }
  if (editTitle.value !== props.task.title) {
    emit('update-title', { taskId: props.task.id, title: editTitle.value.trim() });
  }
  isEditing.value = false;
}

function cancelEdit() {
  isEditing.value = false;
  editTitle.value = '';
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    saveTitle();
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
}

function handleCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('button, input, .tooltip')) return;
  emit('click', props.task.id);
}

function toggleChecklist() {
  isChecklistExpanded.value = !isChecklistExpanded.value;
}

function handleChecklistToggle(itemId: string) {
  emit('toggle-checklist-item', { taskId: props.task.id, itemId });
}

function submitNewItem() {
  const text = newItemText.value.trim();
  if (!text) return;
  emit('add-checklist-item', { taskId: props.task.id, text });
  newItemText.value = '';
}
</script>

<template>
  <div
    class="card card-compact bg-base-100 shadow-sm border border-base-300 cursor-pointer hover:shadow-md transition-shadow group"
    @click="handleCardClick"
  >
    <div class="card-body p-3 gap-2">
      <!-- Title row -->
      <div class="flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <input
            v-if="isEditing"
            ref="titleInputRef"
            v-model="editTitle"
            class="input input-bordered input-sm w-full"
            @keydown="handleKeydown"
            @blur="saveTitle"
          >
          <h3 v-else class="text-sm font-medium leading-tight truncate">{{ task.title }}</h3>
        </div>
        <button
          v-if="!isEditing"
          class="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="startEdit"
        >
          <Pencil class="w-3 h-3" />
        </button>
      </div>

      <!-- Tags -->
      <div v-if="task.tags?.length" class="flex flex-wrap gap-1">
        <KanbanTag
          v-for="tag in visibleTags"
          :key="tag.id"
          :tag="tag"
          :config="tagConfig"
        />
        <span v-if="hiddenTagsCount > 0" class="badge badge-sm badge-ghost">
          +{{ hiddenTagsCount }}
        </span>
      </div>

      <!-- Meta row -->
      <div class="flex items-center gap-2 text-xs">
        <!-- Checklist -->
        <div
          v-if="checklistTotal > 0"
          class="flex items-center gap-1 cursor-pointer"
          :class="checklistAllDone ? 'text-green-500' : 'text-base-content/60'"
          @click.stop="toggleChecklist"
        >
          <CheckSquare class="w-3.5 h-3.5" />
          <span>{{ checklistDone }}/{{ checklistTotal }}</span>
        </div>

        <!-- Description -->
        <div
          v-if="task.description"
          class="tooltip tooltip-bottom flex items-center gap-1 text-base-content/60"
          :data-tip="descriptionPreview"
        >
          <FileText class="w-3.5 h-3.5" />
        </div>

        <!-- Related tasks -->
        <div
          v-if="task.relatedTasks?.length"
          class="tooltip tooltip-bottom flex items-center gap-1 text-base-content/60"
          :data-tip="relatedTasksTitles"
        >
          <Link2 class="w-3.5 h-3.5" />
          <span>{{ task.relatedTasks.length }}</span>
        </div>

        <!-- Due date -->
        <div
          v-if="task.dueDate"
          class="flex items-center gap-1 text-base-content/60"
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>{{ formattedDueDate }}</span>
        </div>

        <!-- Priority -->
        <span v-if="task.priority" class="badge badge-xs ml-auto" :class="priorityBadgeClass">
          {{ priorityLabel }}
        </span>
      </div>

      <!-- Expanded checklist -->
      <div v-if="isChecklistExpanded && checklistTotal > 0" class="flex flex-col gap-1 pt-1">
        <label
          v-for="item in task.checklist"
          :key="item.id"
          class="flex items-center gap-2 cursor-pointer"
          @click.stop
        >
          <input
            type="checkbox"
            :checked="item.done"
            class="checkbox checkbox-xs"
            @change="handleChecklistToggle(item.id)"
          >
          <span :class="{ 'line-through opacity-50': item.done }">{{ item.text }}</span>
        </label>

        <div class="flex items-center gap-1 mt-1" @click.stop>
          <input
            v-model="newItemText"
            class="input input-xs flex-1"
            placeholder="Nueva tarea..."
            @keydown.enter.prevent="submitNewItem"
          >
          <button class="btn btn-ghost btn-xs btn-square" @click="submitNewItem">
            <Plus class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Footer: Assignee -->
      <div v-if="task.assignee" class="flex justify-end pt-1">
        <UserAvatar :user="task.assignee" size="sm" />
      </div>
    </div>
  </div>
</template>
