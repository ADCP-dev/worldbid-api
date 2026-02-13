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

const fileInput = ref<HTMLInputElement | null>(null);
const localFile = ref<File | null>(props.modelValue ?? null);

watch(() => props.modelValue, (newVal) => {
  localFile.value = newVal ?? null;
});

const fileName = computed(() => localFile.value?.name || "");

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] || null;
  localFile.value = file;
  emit("update:modelValue", file);
  target.value = "";
}

function openFileDialog() {
  fileInput.value?.click();
}
</script>

<template>
  <div class="space-y-2">
    <label v-if="label" class="block font-medium mb-1">
      {{ label }} <span v-if="required" class="text-red-600">*</span>
    </label>
    <div class="relative cursor-pointer">
      <input
        ref="fileInput"
        type="file"
        :disabled="disabled"
        :required="required"
        :accept="accept"
        class="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        @change="onFileChange"
        tabindex="-1"
      />
      <div
        class="flex items-center border px-3 py-2 dark:bg-zinc-800 bg-zinc-100 font-medium rounded-md cursor-pointer gap-2"
        @click="openFileDialog"
      >
        <button
          type="button"
          class="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-sm font-semibold transition-colors duration-150 cursor-pointer"
          @click.stop="openFileDialog"
        >
          Seleccionar archivo
        </button>
        <span
          class="truncate max-w-[80px] md:max-w-[200px] overflow-hidden whitespace-nowrap text-gray-700 dark:text-gray-200"
        >
          {{ fileName || "Ningún archivo seleccionado" }}
        </span>
      </div>
    </div>
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>