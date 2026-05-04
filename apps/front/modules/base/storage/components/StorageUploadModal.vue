<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { X, Upload, ChevronDown, ChevronUp } from 'lucide-vue-next';
import FilePreview from './FilePreview.vue';
import type { FileUploadMeta, FileType } from '../types';

interface Props {
  open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  upload: [payload: { files: File[]; meta?: FileUploadMeta }];
}>();

const selectedFiles = ref<File[]>([]);
const showMetadata = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const meta = ref<FileUploadMeta>({
  entityName: '',
  entityId: '',
  context: '',
  isPublic: true,
});

const dialogRef = ref<HTMLDialogElement | null>(null);
const objectUrls = ref<Map<File, string>>(new Map());

const previewFiles = computed(() => {
  return selectedFiles.value.map((file): FileType => {
    let url = objectUrls.value.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      objectUrls.value.set(file, url);
    }
    return {
      id: url,
      path: url,
      name: file.name,
      isPublic: true,
      entityName: null,
      entityId: null,
      context: null,
      userId: 0,
      type: file.type || 'application/octet-stream',
      size: file.size,
    };
  });
});

function revokeUnusedUrls() {
  const currentFiles = new Set(selectedFiles.value);
  for (const [file, url] of objectUrls.value.entries()) {
    if (!currentFiles.has(file)) {
      URL.revokeObjectURL(url);
      objectUrls.value.delete(file);
    }
  }
}

watch(selectedFiles, revokeUnusedUrls, { deep: true });

onUnmounted(() => {
  for (const url of objectUrls.value.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrls.value.clear();
});

watch(() => props.open, (val) => {
  if (val) {
    dialogRef.value?.showModal();
  } else {
    dialogRef.value?.close();
  }
});

function handleClose() {
  emit('update:open', false);
  resetForm();
}

function resetForm() {
  selectedFiles.value = [];
  meta.value = { entityName: '', entityId: '', context: '', isPublic: true };
  if (fileInput.value) fileInput.value.value = '';
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    selectedFiles.value = Array.from(input.files);
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (event.dataTransfer?.files) {
    selectedFiles.value = Array.from(event.dataTransfer.files);
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1);
}

function handleSubmit() {
  if (selectedFiles.value.length === 0) return;

  const uploadMeta: FileUploadMeta | undefined = showMetadata.value
    ? {
        entityName: meta.value.entityName || undefined,
        entityId: meta.value.entityId || undefined,
        context: meta.value.context || undefined,
        isPublic: meta.value.isPublic,
      }
    : undefined;

  emit('upload', { files: selectedFiles.value, meta: uploadMeta });
  handleClose();
}

</script>

<template>
  <dialog ref="dialogRef" class="modal" @close="handleClose">
    <div class="modal-box max-w-2xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Subir archivos</h3>
        <button class="btn btn-sm btn-ghost btn-circle" @click="handleClose">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Drag & Drop Zone -->
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
        :class="isDragging ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-base-400'"
        @click="fileInput?.click()"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
      >
        <Upload class="w-10 h-10 mx-auto mb-3 text-base-content/50" />
        <p class="text-sm font-medium mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
        <p class="text-xs text-base-content/60">Puedes seleccionar múltiples archivos</p>
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="handleFileSelect"
        >
      </div>

      <!-- Selected Files List -->
      <div v-if="selectedFiles.length > 0" class="mt-4 space-y-2">
        <p class="text-sm font-medium">Archivos seleccionados ({{ selectedFiles.length }})</p>
        <div class="max-h-48 overflow-y-auto space-y-2">
          <div
            v-for="(file, index) in selectedFiles"
            :key="index"
            class="flex items-center gap-3 p-2 bg-base-200 rounded-lg"
          >
            <FilePreview :file="previewFiles[index]" size="sm" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ file.name }}</p>
              <p class="text-xs text-base-content/60">{{ (file.size / 1024).toFixed(1) }} KB</p>
            </div>
            <button class="btn btn-xs btn-ghost btn-circle" @click.stop="removeFile(index)">
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Metadata Section -->
      <div class="mt-4">
        <button
          class="btn btn-sm btn-ghost w-full justify-between"
          @click="showMetadata = !showMetadata"
        >
          <span>Metadatos opcionales</span>
          <ChevronDown v-if="!showMetadata" class="w-4 h-4" />
          <ChevronUp v-else class="w-4 h-4" />
        </button>

        <div v-if="showMetadata" class="mt-3 space-y-3 p-3 bg-base-200 rounded-lg">
          <FormInput
            v-model="meta.entityName"
            label="Entidad"
            placeholder="Nombre de la entidad"
          />
          <FormInput
            v-model="meta.entityId"
            label="ID de entidad"
            placeholder="Identificador de la entidad"
          />
          <FormInput
            v-model="meta.context"
            label="Contexto"
            placeholder="Contexto del archivo"
          />
          <FormSwitch
            v-model="meta.isPublic"
            label="Público"
            description="El archivo será accesible públicamente"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <button class="btn btn-ghost" @click="handleClose">Cancelar</button>
        <button
          class="btn btn-primary"
          :disabled="selectedFiles.length === 0"
          @click="handleSubmit"
        >
          Subir
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="handleClose">close</button>
    </form>
  </dialog>
</template>
