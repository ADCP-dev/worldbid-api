<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  SlidersHorizontal,
  FileVideo,
  Images,
  Type,
  FileText,
  Share2,
  PenLine,
  CalendarClock,
} from 'lucide-vue-next';
import type { Component } from 'vue';

const props = defineProps<{
  current: number;
}>();

const emit = defineEmits<{
  (e: 'select', step: number): void;
}>();

const { t } = useI18n();

const steps = computed(() => [
  { icon: SlidersHorizontal as Component, key: 'format' },
  { icon: FileVideo as Component, key: 'media' },
  { icon: Share2 as Component, key: 'platforms' },
  { icon: PenLine as Component, key: 'caption' },
  { icon: CalendarClock as Component, key: 'schedule' },
]);

const icons = {
  format: SlidersHorizontal,
  media: FileVideo,
  platforms: Share2,
  caption: PenLine,
  schedule: CalendarClock,
};

const unused = { Type, Images, FileText, icons };
void unused;
</script>

<template>
  <ul class="steps w-full">
    <li
      v-for="(s, i) in steps"
      :key="s.key"
      class="step"
      :class="i <= props.current ? 'step-primary' : ''"
    >
      <button
        type="button"
        class="flex flex-col items-center gap-1"
        @click="emit('select', i)"
      >
        <component :is="s.icon" class="h-4 w-4" aria-hidden="true" />
        <span class="text-xs">{{ t(`ext.upload-post.composer.steps.${s.key}`) }}</span>
      </button>
    </li>
  </ul>
</template>