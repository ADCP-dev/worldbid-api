<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';
import { Clock } from 'lucide-vue-next';

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  name?: string;
  showIcon?: boolean;
}>();

const model = defineModel<string>();
const slots = useSlots();
const inputRef = ref<HTMLInputElement | null>(null);

// Custom time input clicks handler to always show time picker
const handleContainerClick = (event: MouseEvent) => {
  // Only open the picker if we're not clicking on another control
  if (event.target === event.currentTarget ||
      (event.target as HTMLElement).classList.contains('time-input-container')) {
    inputRef.value?.showPicker();
  }
};
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div
      class="relative flex time-input-container cursor-pointer"
      @click="handleContainerClick"
    >
      <Clock
        v-if="!slots['icon-start']"
        class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/50 pointer-events-none z-10"
      />

      <span
        v-if="slots['icon-start']"
        class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50 z-10"
      >
        <slot name="icon-start" />
      </span>

      <input
        ref="inputRef"
        v-model="model"
        type="time"
        step="60"
        :name="name"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        min="00:00"
        max="23:59"
        class="input input-bordered w-full pl-10 time-input"
        :class="{ 'input-error': error, 'pr-10': slots['icon-end'] }"
      >

      <span
        v-if="slots['icon-end']"
        class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50 z-10"
      >
        <slot name="icon-end" />
      </span>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>

<style scoped>
/* Hide the default browser time input icon/widget */
.time-input::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
  appearance: none;
  opacity: 0;
}

/* Improve cursor and click experience */
.time-input-container {
  transition: background-color 0.2s ease;
}

.time-input-container:hover {
  background-color: hsl(var(--bc) / 0.05);
}
</style>
