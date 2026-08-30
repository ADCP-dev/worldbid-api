<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import { useTableStateStore } from '@base/ui-app/stores/useTableState';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import {
  useClientsQuery,
  useStatusesQuery,
  useOriginsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  crmAsList,
} from '@crm/composables/useCrm';
import type { CellContext, Client } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t } = useI18n();
const tableStateStore = useTableStateStore();

const tableName = 'crm-clients';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

const page = computed(() => tableState.value.pageIndex + 1);
const search = computed(() => tableState.value.globalFilter || undefined);
const statusFilter = ref<number | undefined>(undefined);

const { data: clientsData, isLoading } = useClientsQuery({ page, search, statusId: statusFilter });
const { data: statuses } = useStatusesQuery();
const { data: origins } = useOriginsQuery();
const createMut = useCreateClientMutation();
const updateMut = useUpdateClientMutation();
const deleteMut = useDeleteClientMutation();

const clients = computed<Client[]>(() => crmAsList<Client>(clientsData.value ?? []));
const total = computed(() => {
  const d = clientsData.value;
  return d && !Array.isArray(d) ? (d.total ?? 0) : clients.value.length;
});

const statusOptions = computed(() =>
  (statuses.value ?? []).map((s) => ({ value: s.id, label: s.label || s.name })),
);


const form = ref(emptyForm());

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(client: Client) {
  editingId.value = client.id;
  form.value = {
    name: client.name || '',
    companyName: client.companyName || '',
    nif: client.nif || '',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    city: client.city || '',
    region: client.region || '',
    country: client.country || 'España',
    statusId: client.statusId ?? null,
    originId: client.originId ?? null,
    originDetail: client.originDetail || '',
    isActive: client.isActive,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingId.value = null;
}

async function submit() {
  if (!form.value.name.trim()) {
    toast.error(t('ext.crm.clients.name'));
    return;
  }
  saving.value = true;
  const payload = {
    name: form.value.name.trim(),
    companyName: form.value.companyName || undefined,
    nif: form.value.nif || undefined,
    email: form.value.email || undefined,
    phone: form.value.phone || undefined,
    address: form.value.address || undefined,
    city: form.value.city || undefined,
    region: form.value.region || undefined,
    country: form.value.country || 'España',
    statusId: form.value.statusId ?? undefined,
    originId: form.value.originId ?? undefined,
    originDetail: form.value.originDetail || undefined,
    isActive: form.value.isActive,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, data: payload });
      toast.success(t('ext.crm.clients.updated'));
    } else {
      await createMut.mutateAsync(payload);
      toast.success(t('ext.crm.clients.created'));
    }
    closeModal();
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────

const deleteTarget = ref<Client | null>(null);

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success(t('ext.crm.clients.deleted'));
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  }
}

// ─── Columns ──────────────────────────────────────────────────────────

const columns = computed(() => [
  {
    accessorKey: 'name',
    headerName: t('ext.crm.clients.name'),
    header: t('ext.crm.clients.name'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Client>) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.original.name),
        row.original.companyName
          ? h('span', { class: 'text-xs text-base-content/50' }, row.original.companyName)
          : null,
      ]),
  },
  {
    accessorKey: 'email',
    headerName: t('ext.crm.clients.email'),
    header: t('ext.crm.clients.email'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Client>) => row.original.email ?? '—',
  },
  {
    accessorKey: 'phone',
    headerName: t('ext.crm.clients.phone'),
    header: t('ext.crm.clients.phone'),
    cell: ({ row }: CellContext<Client>) => row.original.phone ?? '—',
  },
  {
    accessorKey: 'status.label',
    headerName: t('ext.crm.clients.status'),
    header: t('ext.crm.clients.status'),
    filterType: 'select' as const,
    options: statusOptions.value,
    cell: ({ row }: CellContext<Client>) =>
      h(
        'span',
        { class: 'badge badge-sm', style: row.original.status?.color ? { backgroundColor: `${row.original.status.color}22`, color: row.original.status.color } : undefined },
        row.original.status?.label ?? row.original.status?.name ?? '—',
      ),
  },
  {
    accessorKey: 'origin.label',
    headerName: t('ext.crm.clients.origin'),
    header: t('ext.crm.clients.origin'),
    cell: ({ row }: CellContext<Client>) => row.original.origin?.label ?? '—',
  },
  {
    accessorKey: 'isActive',
    headerName: t('ext.crm.clients.active'),
    header: t('ext.crm.clients.active'),
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Client>) =>
      h(
        'span',
        { class: `badge badge-sm ${row.original.isActive ? 'badge-success' : 'badge-ghost'}` },
        row.original.isActive ? t('ext.crm.clients.active') : '—',
      ),
  },
  {
    id: 'actions',
    headerName: t('ext.crm.common.actions'),
    header: t('ext.crm.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Client>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(ViewButton, {
          ariaLabel: row.original.name,
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/crm/clients/${row.original.id}`);
          },
        }),
        h(EditButton, {
          onClick: (e: Event) => {
            e.stopPropagation();
            openEdit(row.original);
          },
        }),
        h(DeleteButton, {
          onClick: (e: Event) => {
            e.stopPropagation();
            deleteTarget.value = row.original;
          },
        }),
      ]),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('ext.crm.clients.title') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.crm.clients.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="statusFilter" class="select select-sm select-bordered">
          <option :value="undefined">{{ t('ext.crm.common.all') }}</option>
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.label || s.name }}</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="openCreate">
          <Plus class="w-4 h-4" /> {{ t('ext.crm.clients.new') }}
        </button>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="clients"
          :total="total"
          :loading="isLoading"
          manual
          :table-name="tableName"
          @row-click="(row: Client) => navigateTo(`/app/crm/clients/${row.id}`)"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box max-w-3xl">
        <h3 class="text-lg font-bold">
          {{ editingId ? t('ext.crm.clients.editTitle') : t('ext.crm.clients.new') }}
        </h3>
        <div class="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput v-model="form.name" :label="t('ext.crm.clients.name')" required />
          <FormInput v-model="form.companyName" :label="t('ext.crm.clients.company')" />
          <FormInput v-model="form.nif" :label="t('ext.crm.clients.nif')" />
          <FormInput v-model="form.email" :label="t('ext.crm.clients.email')" type="email" />
          <FormInput v-model="form.phone" :label="t('ext.crm.clients.phone')" />
          <FormSelect
            v-model="form.statusId"
            :label="t('ext.crm.clients.status')"
            :options="statusOptions"
          />
          <FormSelect
            v-model="form.originId"
            :label="t('ext.crm.clients.origin')"
            :options="(origins ?? []).map((o) => ({ value: o.id, label: o.label || o.name }))"
          />
          <FormInput v-model="form.originDetail" :label="t('ext.crm.clients.originDetail')" />
          <FormInput v-model="form.address" :label="t('ext.crm.clients.address')" />
          <FormInput v-model="form.city" :label="t('ext.crm.clients.city')" />
          <FormInput v-model="form.region" :label="t('ext.crm.clients.region')" />
          <FormInput v-model="form.country" :label="t('ext.crm.clients.country')" />
          <FormSwitch v-model="form.isActive" :label="t('ext.crm.clients.active')" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeModal">{{ t('ext.crm.common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            {{ editingId ? t('ext.crm.common.save') : t('ext.crm.common.create') }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeModal" />
    </dialog>

    <!-- Delete confirm -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.crm.common.confirmDeleteTitle') }}</h3>
        <p class="py-4">
          <strong>{{ deleteTarget.name }}</strong> — {{ t('ext.crm.common.deleteWarning') }}
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