<script setup lang="ts">
import { ref, watch } from "vue";
import DeleteButton from "../data-table/Buttons/DeleteButton.vue";
import { File, FileUp } from "lucide-vue-next";

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
  <div class="space-y-2">
    <label
      v-if="label"
      :for="name"
      class="block text-sm font-medium text-foreground"
    >
      {{ label }}
    </label>
    <div
      class="relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-8 py-10 bg-background transition hover:border-primary focus-within:border-primary"
      :class="[
        error ? 'border-destructive' : 'border-muted',
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
      />
      <div
        class="flex flex-col items-center justify-center pointer-events-none min-h-[80px]"
      >
        <FileUp class="w-8 h-8 text-muted-foreground mb-2" />
        <span class="text-muted-foreground text-base font-medium text-center">
          Arrastra y suelta archivos aquí<br />o haz clic para seleccionar
        </span>
        <span v-if="description" class="text-xs text-muted-foreground mt-1">
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
        class="flex items-center justify-between bg-muted/70 px-4 py-2 rounded-lg shadow-sm border border-muted hover:bg-muted transition group"
      >
        <div class="flex items-center gap-2">
          <File class="w-5 h-5 text-primary" />
          <span class="truncate text-sm font-medium">{{ file.name }}</span>
          <span class="ml-2 text-xs text-muted-foreground"
            >({{ (file.size / 1024).toFixed(1) }} KB)</span
          >
        </div>
        <DeleteButton @click="removeFile(idx)" />
      </li>
    </transition-group>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
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
