<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { CalendarView } from './types';

const props = defineProps<{
  currentDate: Date;
  view: CalendarView;
  title: string;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'today'): void;
  (e: 'change-view', view: CalendarView): void;
}>();

const viewOptions: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Día' },
];
</script>

<template>
  <div class="flex items-center justify-between p-3 border-b border-base-300">
    <div class="flex items-center gap-2">
      <button
        class="btn btn-sm btn-ghost btn-square"
        @click="emit('prev')"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>
      <h2 class="text-lg font-semibold capitalize min-w-[200px] text-center">
        {{ props.title }}
      </h2>
      <button
        class="btn btn-sm btn-ghost btn-square"
        @click="emit('next')"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
      <button
        class="btn btn-sm btn-ghost ml-2"
        @click="emit('today')"
      >
        Hoy
      </button>
    </div>

    <div class="tabs tabs-boxed">
      <button
        v-for="option in viewOptions"
        :key="option.value"
        class="tab"
        :class="{ 'tab-active': props.view === option.value }"
        @click="emit('change-view', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
