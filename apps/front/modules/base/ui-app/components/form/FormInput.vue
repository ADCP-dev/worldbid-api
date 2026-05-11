<script setup lang="ts">
defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number" | "email";
  disabled?: boolean;
  error?: string;
  description?: string;
  min?: string;
  max?: string;
  step?: string;
  testId?: string;
}>();

const model = defineModel<string | number>();
const emit = defineEmits<{ (e: "blur"): void }>();
const slots = useSlots();
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="relative">
      <input
        v-model="model"
        :type="type || 'text'"
        :placeholder="placeholder"
        :disabled="disabled"
        :min="min"
        :max="max"
        :step="step"
        :data-testid="testId"
        class="input input-bordered w-full"
        :class="{ 'input-error': error, 'pl-10': slots['icon-start'], 'pr-10': slots['icon-end'] }"
        @blur="emit('blur')"
      />

      <span
        v-if="slots['icon-start']"
        class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50"
      >
        <slot name="icon-start" />
      </span>

      <span
        v-if="slots['icon-end']"
        class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50"
      >
        <slot name="icon-end" />
      </span>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0 block">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
