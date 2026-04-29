<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  rows?: number;
  maxlength?: number;
  autoResize?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}>(), {
  placeholder: '',
  required: false,
  disabled: false,
  rows: 4,
  autoResize: false,
  resize: 'vertical',
});

const model = defineModel<string>({ default: '' });
const emit = defineEmits<{ (e: 'blur'): void }>();

const resizeClasses = computed(() => {
  switch (props.resize) {
    case 'none':
      return 'resize-none';
    case 'horizontal':
      return 'resize-x';
    case 'both':
      return 'resize';
    default:
      return '';
  }
});
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <textarea
      v-model="model"
      :rows="autoResize ? 1 : rows"
      :maxlength="maxlength"
      :disabled="disabled"
      :placeholder="placeholder"
      class="textarea textarea-bordered w-full"
      :class="[
        { 'textarea-error': error },
        { 'textarea-autoresize': autoResize },
        resizeClasses,
      ]"
      @blur="emit('blur')"
    />

    <div v-if="maxlength" class="text-right text-xs opacity-50 mt-1">
      {{ model?.length || 0 }} / {{ maxlength }}
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
