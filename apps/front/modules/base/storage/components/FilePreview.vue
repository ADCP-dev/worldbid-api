<script setup lang="ts">
import FileTypeIcon from './FileTypeIcon.vue';
import type { FileType } from '../types';

interface Props {
  file: FileType;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 80,
};

const isImage = computed(() => props.file.type?.startsWith('image/'));
</script>

<template>
  <div class="flex items-center justify-center">
    <img
      v-if="isImage"
      :src="file.path"
      :alt="file.name"
      class="rounded object-cover"
      :width="sizeMap[size]"
      :height="sizeMap[size]"
    >
    <FileTypeIcon
      v-else
      :mime-type="file.type"
      :size="size"
    />
  </div>
</template>
