<script setup lang="ts">
import { h, computed, ref } from 'vue';
import { toast } from 'vue-sonner';
import { Eye, Pencil, Trash2, MoreVertical } from 'lucide-vue-next';
import DataTable from '@/modules/base/ui-app/components/data-table/DataTable.vue';
import FilePreview from '@/modules/base/storage/components/FilePreview.vue';
import FileTypeIcon from '@/modules/base/storage/components/FileTypeIcon.vue';
import { useStorageStats } from '@/modules/base/storage/composables/useStorageStats';
import { useFileUpload } from '@/modules/base/storage/composables/useFileUpload';
import { useFileDelete } from '@/modules/base/storage/composables/useFileDelete';
import { useFileUpdate } from '@/modules/base/storage/composables/useFileUpdate';
import type { FileType } from '@/modules/base/storage/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const showUploadModal = ref(false);
const selectedFile = ref<FileType | null>(null);
const showViewModal = ref(false);
const showEditModal = ref(false);
const editForm = ref({ name: '', isPublic: false });

const { data: stats, isLoading: statsLoading } = useStorageStats();
const { mutate: uploadFile, isPending: isUploading } = useFileUpload();
const { mutate: deleteFile } = useFileDelete();
const { mutate: updateFile, isPending: isUpdating } = useFileUpdate();

const formatSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTypeLabel = (mime: string) => {
  if (mime.startsWith('image/')) return 'Imagen';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('document') || mime.includes('msword')) return 'Documento';
  return 'Archivo';
};

const isImage = (type: string) => type?.startsWith('image/');

function handleUpload(payload: { files: File[]; meta?: any }) {
  payload.files.forEach(file => uploadFile({ file, meta: payload.meta }));
  showUploadModal.value = false;
  toast.success('Archivos subidos correctamente');
}

function handleView(file: FileType) {
  selectedFile.value = file;
  showViewModal.value = true;
}

function handleEdit(file: FileType) {
  selectedFile.value = file;
  editForm.value = { name: file.name, isPublic: file.isPublic };
  showEditModal.value = true;
}

function handleSaveEdit() {
  if (!selectedFile.value) return;
  updateFile(
    { id: selectedFile.value.id, data: editForm.value },
    {
      onSuccess: () => {
        toast.success('Archivo actualizado');
        showEditModal.value = false;
      },
      onError: () => toast.error('Error al actualizar'),
    },
  );
}

function handleDelete(file: FileType) {
  if (confirm('¿Eliminar este archivo?')) {
    deleteFile(file.id, {
      onSuccess: () => toast.success('Archivo eliminado'),
      onError: () => toast.error('Error al eliminar'),
    });
  }
}

const columns = computed(() => {
  const cols: any[] = [
    {
      accessorKey: 'preview',
      header: '',
      size: 60,
      enableSorting: false,
      cell: ({ row }: any) => h(FilePreview, { file: row.original, size: 'sm' }),
    },
    { accessorKey: 'name', header: 'Nombre', filterType: 'string' },
    {
      accessorKey: 'type',
      header: 'Tipo',
      filterType: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/png', label: 'PNG' },
        { value: 'application/pdf', label: 'PDF' },
      ],
      cell: ({ row }: any) => h('span', { class: 'badge badge-sm' }, getTypeLabel(row.original.type)),
    },
    {
      accessorKey: 'size',
      header: 'Tamaño',
      cell: ({ row }: any) => formatSize(row.original.size),
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      filterType: 'date',
      cell: ({ row }: any) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString('es-ES') : '—',
    },
    {
      accessorKey: 'isPublic',
      header: 'Privacidad',
      filterType: 'boolean',
      cell: ({ row }: any) => h('span', { class: ['badge badge-sm', row.original.isPublic ? 'badge-success' : 'badge-ghost'] }, row.original.isPublic ? 'Público' : 'Privado'),
    },
  ];

  if (isAdmin.value) {
    cols.push({
      accessorKey: 'user.name',
      header: 'Propietario',
      filterType: 'string',
      cell: ({ row }: any) => row.original.user?.name || '—',
    });
  }

  // Page-level menu state
  const openMenuFileId = ref<string | null>(null);
  const openMenuStyle = ref<Record<string, string>>({});
  
  function closeMenu() { openMenuFileId.value = null; }
  function doView(file: FileType) { closeMenu(); handleView(file); }
  function doEdit(file: FileType) { closeMenu(); handleEdit(file); }
  function doDelete(file: FileType) { closeMenu(); handleDelete(file); }

  // Actions column with fixed-position menu
  cols.push({
    accessorKey: 'actions',
    header: 'Acciones',
    size: 80,
    enableSorting: false,
    cell: ({ row }: any) => {
      const file = row.original as FileType;
      
      function toggleMenu(e: Event) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        openMenuStyle.value = {
          position: 'fixed',
          top: (rect.bottom + 4) + 'px',
          left: Math.min(rect.left, window.innerWidth - 180) + 'px',
        };
        openMenuFileId.value = openMenuFileId.value === file.id ? null : file.id;
      }
      
      return h('div', { class: 'relative' }, [
        h('button', {
          class: 'btn btn-ghost btn-xs',
          onClick: toggleMenu,
        }, h(MoreVertical, { class: 'w-4 h-4' })),
        openMenuFileId.value === file.id ? h('div', {
          style: openMenuStyle.value,
          class: 'menu p-2 shadow-lg bg-base-100 rounded-box w-40 z-[9999] border border-base-300',
          onClick: (e: Event) => e.stopPropagation(),
        }, [
          h('button', { class: 'flex items-center gap-2 text-sm', onClick: () => doView(file) }, [h(Eye, { class: 'w-4 h-4' }), 'Ver']),
          h('button', { class: 'flex items-center gap-2 text-sm', onClick: () => doEdit(file) }, [h(Pencil, { class: 'w-4 h-4' }), 'Editar']),
          h('button', { class: 'flex items-center gap-2 text-sm text-error', onClick: () => doDelete(file) }, [h(Trash2, { class: 'w-4 h-4' }), 'Eliminar']),
        ]) : null,
      ]);
    },
  });

  return cols;
});

const endpoint = computed(() => isAdmin.value ? 'files?all=true' : 'files');
</script>

<template>
  <div class="container mx-auto py-8 max-w-7xl">
    <h1 class="text-3xl font-bold mb-8">Gestión de Archivos</h1>

    <div class="space-y-6">
      <StorageDashboard :stats="stats" :loading="statsLoading" :quota="1099511627776" />

      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title text-lg">Documentos</h2>
            <button class="btn btn-primary" :disabled="isUploading" @click="showUploadModal = true">
              Subir archivo
            </button>
          </div>

          <DataTable
            :columns="columns"
            :endpoint="endpoint"
            table-name="storage-files"
          />
        </div>
      </div>
    </div>

    <StorageUploadModal
      v-model:open="showUploadModal"
      @upload="handleUpload"
    />

    <!-- View Modal -->
    <dialog class="modal" :class="{ 'modal-open': showViewModal }">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Detalles del archivo</h3>
        <div v-if="selectedFile" class="space-y-4">
          <div class="flex justify-center">
            <img
              v-if="isImage(selectedFile.type)"
              :src="selectedFile.path"
              :alt="selectedFile.name"
              class="rounded-lg max-h-64 object-contain"
            >
            <FileTypeIcon v-else :mime-type="selectedFile.type" size="lg" />
          </div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-base-content/60">Nombre</span>
              <span class="text-sm font-medium">{{ selectedFile.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-base-content/60">Tipo</span>
              <span class="text-sm font-medium">{{ getTypeLabel(selectedFile.type) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-base-content/60">Tamaño</span>
              <span class="text-sm font-medium">{{ formatSize(selectedFile.size) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-base-content/60">Fecha</span>
              <span class="text-sm font-medium">{{ formatDate(selectedFile.createdAt) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-base-content/60">Visibilidad</span>
              <span class="badge" :class="selectedFile.isPublic ? 'badge-success' : 'badge-ghost'">
                {{ selectedFile.isPublic ? 'Público' : 'Privado' }}
              </span>
            </div>
          </div>
          <div class="modal-action">
            <a
              :href="selectedFile.path"
              target="_blank"
              class="btn btn-primary"
              download
            >
              Descargar
            </a>
            <button class="btn" @click="showViewModal = false">Cerrar</button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showViewModal = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- Edit Modal -->
    <dialog class="modal" :class="{ 'modal-open': showEditModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Editar archivo</h3>
        <div v-if="selectedFile" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Nombre</span>
            </label>
            <input v-model="editForm.name" type="text" class="input input-bordered" placeholder="Nombre del archivo">
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <span class="label-text">Público</span>
              <input v-model="editForm.isPublic" type="checkbox" class="toggle toggle-primary">
            </label>
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" :disabled="isUpdating" @click="handleSaveEdit">
              <span v-if="isUpdating" class="loading loading-spinner loading-xs" />
              Guardar
            </button>
            <button class="btn" @click="showEditModal = false">Cancelar</button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showEditModal = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
:deep(td:last-child) {
  overflow: visible !important;
}
</style>
