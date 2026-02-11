<script setup lang="ts">
import Input from "~/components/ui/input/Input.vue";
import Label from "~/components/ui/label/Label.vue";

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
}>();

const model = defineModel<string | number>();

const emit = defineEmits<{ (e: "blur"): void }>();

const slots = useSlots();
</script>

<template>
  <div class="relative space-y-2">
    <Label
      >{{ label }}<span v-if="required" class="text-red-600">*</span></Label
    >
    <Input
      v-model="model"
      :placeholder="placeholder"
      :type="type"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      @blur="emit('blur')"
    />
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <span
      v-if="slots['icon-start']"
      class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
    >
      <slot name="icon-start" />
    </span>
    <span
      v-if="slots['icon-end']"
      class="absolute end-0 inset-y-0 flex items-center justify-center px-2"
    >
      <slot name="icon-end" />
    </span>
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
