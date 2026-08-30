<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import {
  useStatusesQuery,
  useCreateStatusMutation,
  useUpdateStatusMutation,
  useDeleteStatusMutation,
  crmAsList,
} from '@crm/composables/useCrm';
import type { CellContext, Status } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t } = useI18n();

const { data: statusesData, isLoading } = useStatusesQuery();
const createMut = useCreateStatusMutation();
const updateMut = useUpdateStatusMutation();
const deleteMut = useDeleteStatusMutation();

const statuses = computed<Status[]>(() => crmAsList<Status>(statusesData.value ?? []));

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const deleteTarget = ref<Status | null>(null);

const COLOR_OPTIONS = ['success', 'warning', 'error', 'info', 'primary', 'secondary', 'accent', 'neutral'];

const emptyForm = () => ({
  name: '',
  label: '',
  color: 'info',
  sortOrder: 0,
  isActive: true,
  isDefault: false,
});

const form = ref(emptyForm());

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(status: Status) {
  editingId.value = status.id;
  form.value = {
    name: status.name || '',
    label: status.label || '',
    color: status.color || 'info',
    sortOrder: status.sortOrder ?? 0,
    isActive: status.isActive,
    isDefault: status.isDefault,
  };
  showModal.value = true;
}

async function submit() {
  if (!form.value.name.trim() || !form.value.label.trim()) return;
  saving.value = true;
  const payload = {
    name: form.value.name.trim(),
    label: form.value.label.trim(),
    color: form.value.color,
    sortOrder: Number(form.value.sortOrder) || 0,
    isActive: form.value.isActive,
    isDefault: form.value.isDefault,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, data: payload });
      toast.success(t('ext.crm.common.saved'));
    } else {
      await createMut.mutateAsync(payload);
      toast.success(t('ext.crm.common.created'));
    }
    showModal.value = false;
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success(t('ext.crm.common.deleted'));
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  }
}

function colorBadgeClass(color: string | undefined) {
  const map: Record<string, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    neutral: 'badge-neutral',
  };
  return map[color ?? ''] ?? 'badge-ghost';
}

const columns = computed(() => [
  {
    accessorKey: 'label',
    headerName: t('ext.crm.settings.label'),
    header: t('ext.crm.settings.label'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Status>) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'badge badge-sm', style: row.original.color ? { backgroundColor: `${row.original.color}22`, color: row.original.color } : undefined }, row.original.label),
        row.original.isDefault ? h('span', { class: 'badge badge-xs badge-outline' }, t('ext.crm.settings.defaultBadge')) : null,
      ]),
  },
  {
    accessorKey: 'name',
    headerName: t('ext.crm.settings.name'),
    header: t('ext.crm.settings.name'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Status>) => h('span', { class: 'font-mono text-xs' }, row.original.name),
  },
  {
    accessorKey: 'sortOrder',
    headerName: t('ext.crm.settings.sortOrder'),
    header: t('ext.crm.settings.sortOrder'),
  },
  {
    accessorKey: 'isActive',
    headerName: t('ext.crm.settings.active'),
    header: t('ext.crm.settings.active'),
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Status>) =>
      h('span', { class: `badge badge-sm ${row.original.isActive ? 'badge-success' : 'badge-ghost'}` },
        row.original.isActive ? '✓' : '✕'),
  },
  {
    id: 'actions',
    headerName: t('ext.crm.common.actions'),
    header: t('ext.crm.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Status>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(EditButton, { onClick: () => openEdit(row.original) }),
        h(DeleteButton, { onClick: () => (deleteTarget.value = row.original) }),
      ]),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('ext.crm.settings.statuses') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.crm.settings.statusesSubtitle') }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" /> {{ t('ext.crm.settings.newStatus') }}
      </button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="statuses"
          :loading="isLoading"
          manual
          table-name="crm-statuses"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          {{ editingId ? t('ext.crm.common.edit') : t('ext.crm.settings.newStatus') }}
        </h3>
        <div class="py-4 space-y-4">
          <FormInput v-model="form.label" :label="t('ext.crm.settings.label')" required />
          <FormInput v-model="form.name" :label="t('ext.crm.settings.name')" required />
          <div>
            <p class="text-sm mb-2">{{ t('ext.crm.settings.color') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in COLOR_OPTIONS"
                :key="c"
                type="button"
                class="badge cursor-pointer"
                :class="[colorBadgeClass(c), form.color === c ? 'badge-lg outline outline-2 outline-offset-2 outline-primary' : '']"
                @click="form.color = c"
              >
                {{ c }}
              </button>
            </div>
          </div>
          <FormInput v-model="form.sortOrder" :label="t('ext.crm.settings.sortOrder')" type="number" />
          <FormSwitch v-model="form.isActive" :label="t('ext.crm.settings.active')" />
          <FormSwitch v-model="form.isDefault" :label="t('ext.crm.settings.isDefault')" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showModal = false">{{ t('ext.crm.common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            {{ editingId ? t('ext.crm.common.save') : t('ext.crm.common.create') }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showModal = false" />
    </dialog>

    <!-- Delete confirm -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.crm.common.confirmDeleteTitle') }}</h3>
        <p class="py-4">
          <strong>{{ deleteTarget.label }}</strong> — {{ t('ext.crm.common.deleteWarning') }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('ext.crm.common.cancel') }}</button>
          <button class="btn btn-error" @click="confirmDelete">{{ t('ext.crm.common.delete') }}</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="deleteTarget = null" />
    </dialog>
  </div>
</template>