<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import { Plus, Pencil, Trash2, Video } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type {
  CellContext,
  CreateCtaVideoPayload,
  CtaVideo,
  UpdateCtaVideoPayload,
} from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();
const tableStateStore = useTableStateStore();

const loading = ref(false);
const ctaVideos = ref<CtaVideo[]>([]);
const modalOpen = ref(false);
const editing = ref<CtaVideo | null>(null);
const saving = ref(false);
const deletingId = ref<string | null>(null);

const tableName = 'content-pipeline-cta-videos';

const tableState = computed(() => {
  const raw = (tableStateStore as Record<string, unknown>)[tableName] as Record<string, unknown> | undefined || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

const formatOptions = [
  { label: 'Portrait', value: 'portrait' },
  { label: 'Vertical', value: 'vertical' },
  { label: 'Square', value: 'square' },
  { label: 'Landscape', value: 'landscape' },
];

const form = ref<{
  name: string;
  url: string;
  format: string;
  durationSec: string;
  description: string;
  isActive: boolean;
}>({
  name: '',
  url: '',
  format: 'portrait',
  durationSec: '',
  description: '',
  isActive: false,
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function truncateUrl(url: string, len = 40): string {
  if (!url) return '—';
  if (url.length <= len) return url;
  return `${url.slice(0, len)}…`;
}

const columns = computed(() => [
  { accessorKey: 'name', headerName: 'Name', header: 'Name', filterType: 'string' as const },
  {
    accessorKey: 'url',
    headerName: 'URL',
    header: 'URL',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<CtaVideo>) =>
      h('span', { class: 'font-mono text-xs', title: row.original.url }, truncateUrl(row.original.url)),
  },
  {
    accessorKey: 'format',
    headerName: 'Format',
    header: 'Format',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<CtaVideo>) =>
      h('span', { class: 'badge badge-sm badge-ghost capitalize' }, row.original.format || '—'),
  },
  {
    accessorKey: 'durationSec',
    headerName: 'Duration',
    header: 'Duration',
    filterType: 'number' as const,
    cell: ({ row }: CellContext<CtaVideo>) =>
      row.original.durationSec != null ? `${row.original.durationSec}s` : '—',
  },
  {
    accessorKey: 'isActive',
    headerName: 'Active',
    header: 'Active',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<CtaVideo>) =>
      h(
        'span',
        { class: `badge badge-sm ${row.original.isActive ? 'badge-success' : 'badge-ghost'}` },
        row.original.isActive ? 'Active' : 'Inactive',
      ),
  },
  {
    id: 'actions',
    headerName: 'Actions',
    header: 'Actions',
    enableColumnFilter: false,
    cell: ({ row }: CellContext<CtaVideo>) =>
      h('div', { class: 'flex gap-1' }, [
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs',
            onClick: (e: Event) => {
              e.stopPropagation();
              openEdit(row.original);
            },
          },
          [h(Pencil, { class: 'w-3.5 h-3.5' })],
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-xs text-error',
            onClick: (e: Event) => {
              e.stopPropagation();
              void handleDelete(row.original);
            },
          },
          [h(Trash2, { class: 'w-3.5 h-3.5' })],
        ),
      ]),
  },
]);

async function loadCtaVideos() {
  loading.value = true;
  try {
    ctaVideos.value = await cp.listCtaVideos();
  } catch (err: unknown) {
    toast.error('Error loading CTA videos', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

onMounted(loadCtaVideos);

function resetForm() {
  form.value = {
    name: '',
    url: '',
    format: 'portrait',
    durationSec: '',
    description: '',
    isActive: false,
  };
}

function openCreate() {
  editing.value = null;
  resetForm();
  modalOpen.value = true;
  (document.getElementById('cp-cta-modal') as HTMLDialogElement | null)?.showModal();
}

function openEdit(video: CtaVideo) {
  editing.value = video;
  form.value = {
    name: video.name,
    url: video.url,
    format: video.format || 'portrait',
    durationSec: video.durationSec != null ? String(video.durationSec) : '',
    description: video.description || '',
    isActive: video.isActive,
  };
  modalOpen.value = true;
  (document.getElementById('cp-cta-modal') as HTMLDialogElement | null)?.showModal();
}

function closeModal() {
  modalOpen.value = false;
  editing.value = null;
  (document.getElementById('cp-cta-modal') as HTMLDialogElement | null)?.close();
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.url.trim()) {
    toast.error('Name and URL are required');
    return;
  }
  const durationNum = form.value.durationSec.trim() === '' ? undefined : Number(form.value.durationSec);
  if (durationNum != null && Number.isNaN(durationNum)) {
    toast.error('Duration must be a number');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      const payload: UpdateCtaVideoPayload = {
        name: form.value.name,
        url: form.value.url,
        format: form.value.format,
        durationSec: durationNum,
        isActive: form.value.isActive,
        description: form.value.description || undefined,
      };
      await cp.updateCtaVideo(editing.value.id, payload);
      toast.success('CTA video updated');
    } else {
      const payload: CreateCtaVideoPayload = {
        name: form.value.name,
        url: form.value.url,
        format: form.value.format,
        durationSec: durationNum,
        isActive: form.value.isActive,
        description: form.value.description || undefined,
      };
      await cp.createCtaVideo(payload);
      toast.success('CTA video created');
    }
    closeModal();
    await loadCtaVideos();
  } catch (err: unknown) {
    toast.error('Error saving CTA video', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(video: CtaVideo) {
  if (!confirm(`Delete CTA video "${video.name}"?`)) return;
  deletingId.value = video.id;
  try {
    await cp.deleteCtaVideo(video.id);
    toast.success('CTA video deleted');
    await loadCtaVideos();
  } catch (err: unknown) {
    toast.error('Error deleting CTA video', { description: errorMessage(err) });
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Video class="w-6 h-6 text-primary" />
        <h1 class="text-2xl font-bold">CTA Videos</h1>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" />
        Add CTA Video
      </button>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="ctaVideos"
          :total="ctaVideos.length"
          :table-name="tableName"
        />
      </div>
    </div>

    <!-- Modal: create / edit -->
    <dialog id="cp-cta-modal" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box max-w-lg">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">{{ editing ? 'Edit CTA Video' : 'New CTA Video' }}</h3>
          <button class="btn btn-ghost btn-xs" @click="closeModal">✕</button>
        </div>

        <div class="space-y-3 mt-3">
          <FormInput
            v-model="form.name"
            label="Name"
            placeholder="e.g. Default CTA"
            required
            test-id="cta-name"
          />
          <FormInput
            v-model="form.url"
            label="URL"
            placeholder="https://..."
            required
            test-id="cta-url"
          />
          <FormSelect
            v-model="form.format"
            label="Format"
            :options="formatOptions"
          />
          <FormInput
            v-model="form.durationSec"
            label="Duration (seconds)"
            type="number"
            placeholder="15"
            test-id="cta-duration"
          />
          <FormTextArea
            v-model="form.description"
            label="Description"
            :rows="2"
            placeholder="Optional description..."
          />
          <FormSwitch
            v-model="form.isActive"
            label="Set as active CTA"
            description="Activating this video will deactivate all others."
          />
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="handleSave">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            {{ editing ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </div>
</template>