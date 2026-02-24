<script setup lang="ts">
import { useSlots } from "vue";
import { PlusCircle } from "lucide-vue-next";

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
  // Props for create button
  showCreateButton?: boolean;
  createButtonText?: string;
  createButtonIcon?: boolean;
  onCreateClick?: () => void;
}>();

const model = defineModel<string | number>();
const slots = useSlots();
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="relative flex flex-col gap-2">
      <div class="relative w-full">
        <select
          v-model="model"
          :disabled="disabled"
          class="select select-bordered w-full"
          :class="{ 'select-error': error, 'pl-10': slots['icon-start'] }"
        >
          <option v-if="placeholder" disabled value="">{{ placeholder }}</option>
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <span
          v-if="slots['icon-start']"
          class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50 pointer-events-none"
        >
          <slot name="icon-start" />
        </span>
      </div>

      <!-- Create button (conditional) -->
      <button
        v-if="showCreateButton"
        type="button"
        class="btn btn-outline btn-sm w-full"
        @click.stop="onCreateClick && onCreateClick()"
      >
        <PlusCircle v-if="createButtonIcon" class="w-4 h-4" />
        {{ createButtonText || 'Crear nuevo' }}
      </button>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
