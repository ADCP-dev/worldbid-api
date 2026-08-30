<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import {
  useProjectsQuery,
  useClientsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  crmAsList,
} from '@crm/composables/useCrm';
import type { CellContext, Project, ProjectType, ProjectStatus, PaymentStatus } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t, d } = useI18n();
const tableName = 'crm-projects';
const clientFilter = ref<number | undefined>(undefined);



const { data: clientsData } = useClientsQuery();
const clients = computed(() => crmAsList(clientsData.value ?? []));

const { data: projectsData, isLoading } = useProjectsQuery(clientFilter);
const createMut = useCreateProjectMutation();
const updateMut = useUpdateProjectMutation();
const deleteMut = useDeleteProjectMutation();

const projects = computed<Project[]>(() => crmAsList<Project>(projectsData.value ?? []));
const total = computed(() => projects.value.length);

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}

const STATUS_BADGE: Record<string, string> = {
  quoted: 'badge-warning',
  approved: 'badge-info',
  in_progress: 'badge-primary',
  delivered: 'badge-success',
  cancelled: 'badge-error',
};

const PAYMENT_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  partial: 'badge-info',
  paid: 'badge-success',
  refunded: 'badge-error',
};

// ─── Create/Edit modal ────────────────────────────────────────────────

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);

const TYPE_OPTIONS = computed(() =>
  (['pack_1', 'pack_2', 'pack_3', 'pack_4', 'custom'] as ProjectType[]).map((v) => ({
    value: v,
    label: t(`ext.crm.projects.types.${v}`),
  })),
);

const STATUS_OPTIONS = computed(() =>
  (['quoted', 'approved', 'in_progress', 'delivered', 'cancelled'] as ProjectStatus[]).map((v) => ({
    value: v,
    label: t(`ext.crm.projects.statusOptions.${v}`),
  })),
);

const PAYMENT_OPTIONS = computed(() =>
  (['pending', 'partial', 'paid', 'refunded'] as PaymentStatus[]).map((v) => ({
    value: v,
    label: t(`ext.crm.projects.paymentOptions.${v}`),
  })),
);

const clientOptions = computed(() =>
  clients.value.map((c) => ({ value: c.id, label: c.companyName ? `${c.name} (${c.companyName})` : c.name })),
);

const emptyForm = () => ({
  clientId: null as number | null,
  name: '',
  type: 'pack_1' as ProjectType,
  price: '' as string | number,
  status: 'quoted' as ProjectStatus,
  paymentStatus: 'pending' as PaymentStatus,
  startDate: '',
  endDate: '',
});

const form = ref(emptyForm());

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(project: Project) {
  editingId.value = project.id;
  form.value = {
    clientId: project.clientId,
    name: project.name || '',
    type: (project.type as ProjectType) || 'pack_1',
    price: project.price ?? '',
    status: project.status || 'quoted',
    paymentStatus: project.paymentStatus || 'pending',
    startDate: project.startDate?.slice(0, 10) || '',
    endDate: project.endDate?.slice(0, 10) || '',
  };
  showModal.value = true;
}

async function submit() {
  if (!form.value.name.trim() || !form.value.clientId) {
    toast.error(t('ext.crm.common.error'));
    return;
  }
  saving.value = true;
  const payload = {
    clientId: Number(form.value.clientId),
    name: form.value.name.trim(),
    type: form.value.type,
    price: form.value.price === '' ? undefined : Number(form.value.price),
    status: form.value.status,
    paymentStatus: form.value.paymentStatus,
    startDate: form.value.startDate || undefined,
    endDate: form.value.endDate || undefined,
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

const deleteTarget = ref<Project | null>(null);

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

const columns = computed(() => [
  {
    accessorKey: 'name',
    headerName: t('ext.crm.projects.name'),
    header: t('ext.crm.projects.name'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Project>) => h('span', { class: 'font-medium' }, row.original.name),
  },
  {
    accessorKey: 'clientId',
    headerName: t('ext.crm.projects.client'),
    header: t('ext.crm.projects.client'),
    cell: ({ row }: CellContext<Project>) =>
      h(
        'button',
        {
          class: 'link link-hover link-primary text-sm',
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/crm/clients/${row.original.clientId}`);
          },
        },
        `#${row.original.clientId}`,
      ),
  },
  {
    accessorKey: 'type',
    headerName: t('ext.crm.projects.type'),
    header: t('ext.crm.projects.type'),
    filterType: 'select' as const,
    options: TYPE_OPTIONS.value,
    cell: ({ row }: CellContext<Project>) =>
      row.original.type ? t(`ext.crm.projects.types.${row.original.type}`, row.original.type) : '—',
  },
  {
    accessorKey: 'price',
    headerName: t('ext.crm.projects.price'),
    header: t('ext.crm.projects.price'),
    cell: ({ row }: CellContext<Project>) =>
      h('span', { class: 'tabular-nums' }, formatCurrency(row.original.price)),
  },
  {
    accessorKey: 'status',
    headerName: t('ext.crm.projects.status'),
    header: t('ext.crm.projects.status'),
    filterType: 'select' as const,
    options: STATUS_OPTIONS.value,
    cell: ({ row }: CellContext<Project>) =>
      h('span', { class: `badge badge-sm ${STATUS_BADGE[row.original.status] ?? 'badge-outline'}` },
        t(`ext.crm.projects.statusOptions.${row.original.status}`, row.original.status)),
  },
  {
    accessorKey: 'paymentStatus',
    headerName: t('ext.crm.projects.paymentStatus'),
    header: t('ext.crm.projects.paymentStatus'),
    filterType: 'select' as const,
    options: PAYMENT_OPTIONS.value,
    cell: ({ row }: CellContext<Project>) =>
      h('span', { class: `badge badge-sm ${PAYMENT_BADGE[row.original.paymentStatus] ?? 'badge-outline'}` },
        t(`ext.crm.projects.paymentOptions.${row.original.paymentStatus}`, row.original.paymentStatus)),
  },
  {
    accessorKey: 'startDate',
    headerName: t('ext.crm.projects.startDate'),
    header: t('ext.crm.projects.startDate'),
    cell: ({ row }: CellContext<Project>) =>
      row.original.startDate ? d(new Date(row.original.startDate), { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
  },
  {
    id: 'actions',
    headerName: t('ext.crm.common.actions'),
    header: t('ext.crm.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Project>) =>
      h('div', { class: 'flex items-center gap-1' }, [
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
        h(ViewButton, {
          ariaLabel: row.original.name,
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/crm/projects/${row.original.id}`);
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
        <h1 class="text-2xl font-bold">{{ t('ext.crm.projects.title') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.crm.projects.subtitle') }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" /> {{ t('ext.crm.projects.new') }}
      </button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div class="mb-3 max-w-xs">
          <select v-model="clientFilter" class="select select-sm select-bordered w-full">
            <option :value="undefined">{{ t('ext.crm.projects.allClients') }}</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <DataTable
          :columns="columns"
          :data="projects"
          :total="total"
          :loading="isLoading"
          manual
          :table-name="tableName"
          @row-click="(row: Project) => navigateTo(`/app/crm/projects/${row.id}`)"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="text-lg font-bold">
          {{ editingId ? t('ext.crm.projects.editTitle') : t('ext.crm.projects.newTitle') }}
        </h3>
        <div class="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            :model-value="form.clientId"
            :label="t('ext.crm.projects.client')"
            :options="clientOptions"
            @update:model-value="form.clientId = $event as number"
          />
          <FormInput v-model="form.name" :label="t('ext.crm.projects.name')" required />
          <FormSelect v-model="form.type" :label="t('ext.crm.projects.type')" :options="TYPE_OPTIONS" />
          <FormInput v-model="form.price" :label="t('ext.crm.projects.price')" type="number" />
          <FormSelect v-model="form.status" :label="t('ext.crm.projects.status')" :options="STATUS_OPTIONS" />
          <FormSelect v-model="form.paymentStatus" :label="t('ext.crm.projects.paymentStatus')" :options="PAYMENT_OPTIONS" />
          <FormInput v-model="form.startDate" :label="t('ext.crm.projects.startDate')" type="date" />
          <FormInput v-model="form.endDate" :label="t('ext.crm.projects.endDate')" type="date" />
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