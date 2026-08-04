<script setup lang="ts">
import { computed } from 'vue';
import type { TaskStatus, TaskPriority } from '../types';

const props = defineProps<{
  status: TaskStatus | string;
}>();

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  in_progress: 'badge-info',
  review: 'badge-secondary',
  done: 'badge-success',
  blocked: 'badge-error',
};

const label = computed(() => {
  const s = props.status as string;
  if (s === 'in_progress') return 'In Progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
});

const badgeClass = computed(() => STATUS_COLORS[props.status as string] ?? 'badge-ghost');
</script>

<template>
  <span class="badge badge-sm" :class="badgeClass">{{ label }}</span>
</template>