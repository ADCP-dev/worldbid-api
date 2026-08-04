<script setup lang="ts">
import { computed } from 'vue';
import type { TaskPriority } from '../types';

const props = defineProps<{
  priority: TaskPriority | string;
}>();

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'badge-ghost',
  medium: 'badge-info',
  high: 'badge-warning',
  urgent: 'badge-error',
};

const label = computed(() =>
  props.priority.charAt(0).toUpperCase() + props.priority.slice(1),
);

const badgeClass = computed(() => PRIORITY_CLASSES[props.priority as string] ?? 'badge-ghost');
</script>

<template>
  <span class="badge badge-xs" :class="badgeClass">{{ label }}</span>
</template>