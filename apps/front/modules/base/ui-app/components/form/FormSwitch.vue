<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'info' | 'success' | 'warning' | 'error';
  showIcon?: boolean;
}>();

const model = defineModel<boolean>();

const toggleClasses = computed(() => {
  return {
    'toggle': true,
    [`toggle-${props.variant || 'primary'}`]: true,
    'border-error': !!props.error,
  };
});
</script>

<template>
  <div class="form-control w-full flex flex-col gap-2 align-center justify-center ">
    <label class="label cursor-pointer justify-start gap-4">
      <label v-if="showIcon" class="toggle text-base-content" :class="{ 'opacity-50 pointer-events-none': disabled }">
        <input v-model="model" type="checkbox" :disabled="disabled" >
        <svg aria-label="enabled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <g stroke-linejoin="round" stroke-linecap="round" stroke-width="4" fill="none" stroke="currentColor">
            <path d="M20 6 9 17l-5-5"/>
          </g>
        </svg>
        <svg
aria-label="disabled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </label>

      <input v-else v-model="model" type="checkbox" :class="toggleClasses" :disabled="disabled" >
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>


    <label v-if="description" class="label py-0">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
