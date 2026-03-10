<script setup lang="ts">
import { ref, computed, watch } from "vue";

const props = defineProps<{
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  accept?: string;
  modelValue?: File | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: File | null): void;
}>();

const localFile = ref<File | null>(props.modelValue ?? null);

watch(() => props.modelValue, (newVal) => {
  localFile.value = newVal ?? null;
});

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] || null;
  localFile.value = file;
  emit("update:modelValue", file);
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }} <span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <input
      type="file"
      :disabled="disabled"
      :required="required"
      :accept="accept"
      class="file-input file-input-bordered w-full"
      :class="{ 'file-input-error': error }"
      @change="onFileChange"
    />

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
