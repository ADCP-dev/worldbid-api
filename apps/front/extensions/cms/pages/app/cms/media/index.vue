<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import { Upload, Eye, Copy, LayoutGrid, List, X, FileImage, Film } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import { useCmsMedia } from '@cms/composables/useCmsMedia';
import type { CmsMediaFile } from '@cms/composables/useCmsMedia';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

interface CellContextRow<T = Record<string, unknown>> {
  row: { original: T };
}

const cmsMedia = useCmsMedia();

const loading = computed(() => cmsMedia.loading.value);
const media = computed(() => cmsMedia.media.value);

const viewMode = ref<'grid' | 'table'>('grid');
const showUploadModal = ref(false);
const selectedMedia = ref<CmsMediaFile | null>(null);
const showDetailModal = ref(false);

// Upload form
const uploadFiles = ref<File[]>([]);
const uploadAltText = ref('');
const uploadIsPublic = ref(true);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const search = ref('');

const filteredMedia = computed(() => {
  if (!search.value.trim()) return media.value;
  const q = search.value.toLowerCase();
  return media.value.filter((m) => m.name?.toLowerCase().includes(q));
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isImage(type?: string): boolean {
  return !!type && type.startsWith('image/');
}

function isVideo(type?: string): boolean {
  return !!type && type.startsWith('video/');
}

function getTypeLabel(type?: string): string {
  if (!type) return 'Archivo';
  if (type.startsWith('image/')) return 'Imagen';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Audio';
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('document') || type.includes('msword') || type.includes('word')) return 'Documento';
  return 'Archivo';
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(date?: string): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    uploadFiles.value = Array.from(input.files);
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (event.dataTransfer?.files) {
    uploadFiles.value = Array.from(event.dataTransfer.files);
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function removeUploadFile(index: number) {
  uploadFiles.value.splice(index, 1);
  if (fileInput.value) fileInput.value.value = '';
}

function resetUploadForm() {
  uploadFiles.value = [];
  uploadAltText.value = '';
  uploadIsPublic.value = true;
  if (fileInput.value) fileInput.value.value = '';
}

function closeUploadModal() {
  showUploadModal.value = false;
  resetUploadForm();
}

async function submitUpload() {
  if (uploadFiles.value.length === 0) {
    toast.error('Selecciona al menos un archivo');
    return;
  }
  try {
    for (const file of uploadFiles.value) {
      await cmsMedia.uploadMedia(file, {
        context: uploadAltText.value || undefined,
        isPublic: uploadIsPublic.value,
      });
    }
    toast.success(`${uploadFiles.value.length} archivo(s) subido(s)`);
    closeUploadModal();
    await loadMedia();
  } catch (err: unknown) {
    toast.error('Error subiendo archivo(s)', { description: errorMessage(err) });
  }
}

function openDetail(item: CmsMediaFile) {
  selectedMedia.value = item;
  showDetailModal.value = true;
}

function closeDetail() {
  showDetailModal.value = false;
  selectedMedia.value = null;
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  } catch {
    toast.error('No se pudo copiar la URL');
  }
}

const tableColumns = computed(() => [
  {
    accessorKey: 'name',
    headerName: 'Nombre',
    header: 'Nombre',
    filterType: 'string' as const,
    cell: ({ row }: CellContextRow<CmsMediaFile>) => {
      const m = row.original;
      return h('div', { class: 'flex items-center gap-2' }, [
        isImage(m.type)
          ? h('img', { src: m.url, alt: m.name, class: 'w-8 h-8 rounded object-cover' })
          : h('span', { class: 'w-8 h-8 flex items-center justify-center' },
              h(FileImage, { class: 'w-4 h-4 text-base-content/50' })),
        h('span', { class: 'font-medium truncate' }, m.name),
      ]);
    },
  },
  {
    accessorKey: 'type',
    headerName: 'Tipo',
    header: 'Tipo',
    filterType: 'string' as const,
    cell: ({ row }: CellContextRow<CmsMediaFile>) =>
      h('span', { class: 'badge badge-sm badge-ghost' }, getTypeLabel(row.original.type)),
  },
  {
    id: 'size',
    headerName: 'Tamaño',
    header: 'Tamaño',
    filterType: 'string' as const,
    cell: ({ row }: CellContextRow<CmsMediaFile>) => formatSize(row.original.size),
  },
  {
    accessorKey: 'createdAt',
    headerName: 'Subido',
    header: 'Subido',
    filterType: 'date' as const,
    cell: ({ row }: CellContextRow<CmsMediaFile>) => formatDate(row.original.createdAt),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContextRow<CmsMediaFile>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs btn-square',
            title: 'Ver',
            onClick: (e: Event) => {
              e.stopPropagation();
              openDetail(row.original);
            },
          },
          h(Eye, { class: 'w-4 h-4' }),
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs btn-square',
            title: 'Copiar URL',
            onClick: (e: Event) => {
              e.stopPropagation();
              copyUrl(row.original.url);
            },
          },
          h(Copy, { class: 'w-4 h-4' }),
        ),
      ]),
  },
]);

async function loadMedia() {
  try {
    await cmsMedia.getMedia();
  } catch (err: unknown) {
    toast.error('Error cargando media', { description: errorMessage(err) });
  }
}

onMounted(loadMedia);
</script>

<template>
  <div class="container mx-auto py-8">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Media</h1>
      <div class="flex items-center gap-2">
        <!-- View toggle -->
        <div class="join">
          <button
            class="btn btn-sm join-item"
            :class="{ 'btn-active': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button
            class="btn btn-sm join-item"
            :class="{ 'btn-active': viewMode === 'table' }"
            @click="viewMode = 'table'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
        <button class="btn btn-primary btn-sm" @click="showUploadModal = true">
          <Upload class="w-4 h-4" />
          Subir archivo
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-4 max-w-md">
      <FormInput
        v-model="search"
        label="Buscar"
        placeholder="Buscar por nombre..."
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="filteredMedia.length === 0"
      class="text-center py-16 text-base-content/50"
    >
      <FileImage class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p>No hay archivos de media</p>
    </div>

    <!-- Grid view -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <div
        v-for="item in filteredMedia"
        :key="item.id"
        class="card bg-base-100 shadow-sm border border-base-300 cursor-pointer hover:shadow-md transition-shadow"
        @click="openDetail(item)"
      >
        <figure class="aspect-square bg-base-200 flex items-center justify-center overflow-hidden">
          <img
            v-if="isImage(item.type)"
            :src="item.url"
            :alt="item.name"
            class="w-full h-full object-cover"
          >
          <video
            v-else-if="isVideo(item.type)"
            :src="item.url"
            class="w-full h-full object-cover"
            muted
          />
          <FileImage v-else class="w-10 h-10 text-base-content/40" />
        </figure>
        <div class="card-body p-3">
          <p class="text-sm font-medium truncate">{{ item.name }}</p>
          <div class="flex items-center justify-between text-xs text-base-content/60">
            <span class="badge badge-xs badge-ghost">{{ getTypeLabel(item.type) }}</span>
            <span>{{ formatSize(item.size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Table view -->
    <div
      v-else
      class="card bg-base-100 shadow-sm border border-base-300"
    >
      <div class="card-body p-6">
        <DataTable
          :columns="tableColumns"
          :data="filteredMedia"
          :total="filteredMedia.length"
          table-name="cms-media"
          @row-click="(row: CmsMediaFile) => openDetail(row)"
        />
      </div>
    </div>

    <!-- Upload Modal -->
    <dialog v-if="showUploadModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">Subir archivo</h3>
          <button class="btn btn-sm btn-ghost btn-circle" @click="closeUploadModal">
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
          <p class="text-xs text-base-content/60">Imágenes, videos, documentos</p>
          <input
            ref="fileInput"
            type="file"
            multiple
            class="hidden"
            @change="handleFileSelect"
          >
        </div>

        <!-- Selected Files -->
        <div v-if="uploadFiles.length > 0" class="mt-4 space-y-2">
          <p class="text-sm font-medium">Archivos seleccionados ({{ uploadFiles.length }})</p>
          <div class="max-h-40 overflow-y-auto space-y-2">
            <div
              v-for="(file, index) in uploadFiles"
              :key="index"
              class="flex items-center gap-3 p-2 bg-base-200 rounded-lg"
            >
              <FileImage class="w-5 h-5 text-base-content/50 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ file.name }}</p>
                <p class="text-xs text-base-content/60">{{ formatSize(file.size) }}</p>
              </div>
              <button class="btn btn-xs btn-ghost btn-circle" @click.stop="removeUploadFile(index)">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Alt text + visibility -->
        <div class="mt-4 space-y-3">
          <FormInput
            v-model="uploadAltText"
            label="Texto alternativo (opcional)"
            placeholder="Descripción del archivo"
          />
          <FormSwitch
            v-model="uploadIsPublic"
            label="Público"
            description="El archivo será accesible públicamente"
          />
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeUploadModal">Cancelar</button>
          <button
            class="btn btn-primary"
            :disabled="uploadFiles.length === 0"
            @click="submitUpload"
          >
            Subir
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeUploadModal" />
    </dialog>

    <!-- Detail Modal -->
    <dialog v-if="showDetailModal && selectedMedia" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg truncate">{{ selectedMedia.name }}</h3>
          <button class="btn btn-sm btn-ghost btn-circle" @click="closeDetail">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Preview -->
        <div class="bg-base-200 rounded-lg flex items-center justify-center min-h-48 mb-4 overflow-hidden">
          <img
            v-if="isImage(selectedMedia.type)"
            :src="selectedMedia.url"
            :alt="selectedMedia.name"
            class="max-h-96 w-auto object-contain"
          >
          <video
            v-else-if="isVideo(selectedMedia.type)"
            :src="selectedMedia.url"
            controls
            class="max-h-96 w-auto"
          />
          <div v-else class="py-16 flex flex-col items-center gap-2 text-base-content/50">
            <FileImage class="w-12 h-12" />
            <p>Vista previa no disponible</p>
          </div>
        </div>

        <!-- Details -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-base-content/60">Tipo</span>
            <span class="badge badge-sm badge-ghost">{{ getTypeLabel(selectedMedia.type) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Tamaño</span>
            <span>{{ formatSize(selectedMedia.size) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Subido</span>
            <span>{{ formatDate(selectedMedia.createdAt) }}</span>
          </div>
          <div class="flex justify-between items-center gap-2">
            <span class="text-base-content/60 flex-shrink-0">URL</span>
            <code class="text-xs bg-base-200 px-2 py-1 rounded flex-1 truncate text-right">
              {{ selectedMedia.url }}
            </code>
            <button
              class="btn btn-xs btn-ghost btn-square"
              title="Copiar URL"
              @click="copyUrl(selectedMedia.url)"
            >
              <Copy class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeDetail">Cerrar</button>
          <a
            :href="selectedMedia.url"
            target="_blank"
            rel="noopener"
            class="btn btn-primary btn-sm"
          >
            <Eye class="w-4 h-4" />
            Abrir
          </a>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeDetail" />
    </dialog>
  </div>
</template>