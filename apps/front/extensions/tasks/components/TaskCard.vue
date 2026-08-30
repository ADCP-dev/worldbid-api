<script setup lang="ts">
import { computed } from 'vue';
import { Calendar, Clock, Pencil } from 'lucide-vue-next';
import type { Task, UserLight } from '../types';
import TaskPriorityBadge from './TaskPriorityBadge.vue';

const props = defineProps<{
  task: Task;
  assignee?: UserLight | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click' | 'edit', id: number): void;
}>();

const initials = computed(() => {
  if (props.assignee) {
    const name = `${props.assignee.firstName} ${props.assignee.lastName}`.trim();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return '?';
});

const dueDateRelative = computed(() => {
  if (!props.task.dueDate) return null;
  const due = new Date(props.task.dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 30) return `In ${days}d`;
  return due.toLocaleDateString('en-ES', { month: 'short', day: 'numeric' });
});

const isOverdue = computed(() => {
  if (!props.task.dueDate) return false;
  return new Date(props.task.dueDate).getTime() < Date.now();
});

const tagsList = computed<string[]>(() => {
  const t = props.task.tags;
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
});

const visibleTags = computed(() => tagsList.value.slice(0, 3));
const overflowCount = computed(() => Math.max(0, tagsList.value.length - 3));
</script>

<template>
  <div
    v-if="!loading"
    class="card bg-base-100 shadow-sm border border-base-300 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer rounded-lg text-sm"
    @click="emit('click', task.id)"
  >
    <div class="card-body p-3 gap-2">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-medium leading-tight line-clamp-2 flex-1">
          {{ task.title }}
        </h3>
        <button
          class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 -mt-1 -mr-1"
          title="Edit"
          @click.stop="emit('edit', task.id)"
        >
          <Pencil class="w-3 h-3" />
        </button>
      </div>

      <p
        v-if="task.description"
        class="text-xs text-base-content/60 line-clamp-2"
      >
        {{ task.description }}
      </p>

      <div class="flex items-center gap-2 flex-wrap mt-1">
        <TaskPriorityBadge :priority="task.priority" />
        <span
          v-if="task.isRecurring"
          class="badge badge-xs badge-outline"
          title="Recurring"
        >R</span>
        <span
          v-if="task.estimateHours != null"
          class="text-xs text-base-content/50 inline-flex items-center gap-1"
        >
          <Clock class="w-3 h-3" />{{ task.estimateHours }}h
        </span>
        <span
          v-for="tag in visibleTags"
          :key="tag"
          class="badge badge-xs badge-ghost"
        >{{ tag }}</span>
        <span
          v-if="overflowCount > 0"
          class="badge badge-xs badge-ghost"
          :title="tagsList.slice(3).join(', ')"
        >+{{ overflowCount }}</span>
      </div>

      <div class="flex items-center justify-between mt-1">
        <div class="flex items-center gap-2">
          <div
            v-if="assignee"
            class="avatar"
            :title="`${assignee.firstName} ${assignee.lastName}`"
          >
            <div class="w-6 h-6 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
              {{ initials }}
            </div>
          </div>
          <span
            v-if="dueDateRelative"
            class="text-xs inline-flex items-center gap-1"
            :class="isOverdue ? 'text-error font-medium' : 'text-base-content/50'"
          >
            <Calendar class="w-3 h-3" />{{ dueDateRelative }}
          </span>
        </div>
        <span class="text-xs text-base-content/30">#{{ task.id }}</span>
      </div>
    </div>
  </div>

  <div
    v-else
    class="card bg-base-100 shadow-sm border border-base-300 rounded-lg animate-pulse"
  >
    <div class="card-body p-3 gap-2">
      <div class="h-4 bg-base-300 rounded w-3/4" />
      <div class="h-3 bg-base-300/50 rounded w-full" />
      <div class="flex items-center justify-between mt-1">
        <div class="h-6 w-6 bg-base-300 rounded-full" />
        <div class="h-3 bg-base-300/50 rounded w-12" />
      </div>
    </div>
  </div>
</template>