<script setup lang="ts">
import { computed } from 'vue';
import type { KanbanAssignee } from './types';

const props = withDefaults(defineProps<{
  user: KanbanAssignee;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  size: 'md',
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-6 h-6';
    case 'lg':
      return 'w-10 h-10';
    default:
      return 'w-8 h-8';
  }
});

const initials = computed(() => {
  return props.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

const tooltipContent = computed(() => {
  return `${props.user.name} · ${props.user.email} · ${props.user.role}`;
});
</script>

<template>
  <div class="tooltip tooltip-bottom" :data-tip="tooltipContent">
    <div class="avatar">
      <div class="rounded-full" :class="sizeClasses">
        <img
          v-if="user.avatarUrl"
          :src="user.avatarUrl"
          :alt="user.name"
        />
        <span v-else class="text-xs font-medium">{{ initials }}</span>
      </div>
    </div>
  </div>
</template>
