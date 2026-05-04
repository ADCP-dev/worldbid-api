<script setup lang="ts">
import { Image, FileText, Video, Music, File } from 'lucide-vue-next';

interface Props {
  mimeType: string;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const iconComponent = computed(() => {
  const mime = props.mimeType || '';
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('pdf')) return FileText;
  if (mime.startsWith('video/')) return Video;
  if (mime.startsWith('audio/')) return Music;
  return File;
});
</script>

<template>
  <component :is="iconComponent" :class="sizeClasses[size]" />
</template>
