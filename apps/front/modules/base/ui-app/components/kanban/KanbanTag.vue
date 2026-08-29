<script setup lang="ts">
import type { KanbanTag, KanbanTagConfig } from './types';

defineProps<{
  tag: KanbanTag;
  config?: KanbanTagConfig;
}>();
</script>

<template>
  <component
    :is="config?.component"
    v-if="config?.component"
    :tag="tag"
  />
  <span
    v-else
    class="badge badge-sm"
    :class="[tag.color, config?.className]"
  >
    {{ tag.label }}
  </span>
</template>
