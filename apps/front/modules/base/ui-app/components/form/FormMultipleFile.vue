<script setup lang="ts">
import { ref, watch } from "vue";
import DeleteButton from "../data-table/buttons/DeleteButton.vue";
import { File as FileIcon, FileUp } from "lucide-vue-next";

const props = defineProps<{
  label?: string;
  name?: string;
  error?: string;
  description?: string;
  accept?: string;
  modelValue?: File[] | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue" | "change", value: File[]): void;
}>();

const files = ref<File[]>(props.modelValue ?? []);

watch(
  () => props.modelValue,
  (val) => {
    if (val !== files.value) files.value = val ?? [];
  }
);

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    const newFiles = Array.from(target.files);
    files.value = [...files.value, ...newFiles];
    emit("update:modelValue", files.value);
    emit("change", files.value);
    target.value = "";
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  if (props.disabled) return;
  if (e.dataTransfer?.files) {
    const newFiles = Array.from(e.dataTransfer.files);
    files.value = [...files.value, ...newFiles];
    emit("update:modelValue", files.value);
    emit("change", files.value);
  }
}

function removeFile(idx: number) {
  files.value.splice(idx, 1);
  emit("update:modelValue", files.value);
  emit("change", files.value);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }}
      </span>
    </label>

    <div
      class="relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-8 py-10 transition-colors duration-200 group"
      :class="[
        error ? 'border-error bg-error/5' : 'border-base-content/20 bg-base-200/50 hover:bg-base-200',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ]"
      tabindex="0"
      @drop="onDrop"
      @dragover="onDragOver"
    >
      <input
        :id="name"
        class="absolute inset-0 opacity-0 cursor-pointer"
        type="file"
        :name="name"
        :accept="accept"
        multiple
        :disabled="disabled"
        aria-label="Seleccionar archivos"
        @change="onFileChange"
      >
      <div
        class="flex flex-col items-center justify-center pointer-events-none min-h-[80px]"
      >
        <FileUp class="w-8 h-8 opacity-50 mb-2 group-hover:scale-110 transition-transform" />
        <span class="text-base font-medium text-center">
          Arrastra y suelta archivos aquí<br>o haz clic para seleccionar
        </span>
        <span v-if="description" class="text-xs opacity-60 mt-1">
          {{ description }}
        </span>
      </div>
    </div>

    <transition-group
      v-if="files.length"
      name="fade"
      tag="ul"
      class="mt-4 space-y-2"
    >
      <li
        v-for="(file, idx) in files"
        :key="file.name + file.size + idx"
        class="flex items-center justify-between bg-base-200/50 px-4 py-2 rounded-lg border  hover:bg-base-200 transition-colors group"
      >
        <div class="flex items-center gap-2">
          <FileIcon class="w-5 h-5 text-primary" />
          <span class="truncate text-sm font-medium">{{ file.name }}</span>
          <span class="ml-2 text-xs opacity-60"
            >({{ (file.size / 1024).toFixed(1) }} KB)</span
          >
        </div>
        <DeleteButton @click="removeFile(idx)" />
      </li>
    </transition-group>

    <label v-if="error" class="label py-1">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
