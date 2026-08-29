<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  useProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  crmAsList,
} from '../composables/useCrm';
import type { Project, ProjectPayload, ProjectType, ProjectStatus, PaymentStatus } from '../types';

const props = defineProps<{ clientId: number }>();
const { t } = useI18n();

const { data: projectsData, isLoading } = useProjectsQuery(() => props.clientId);
const projects = computed<Project[]>(() => crmAsList<Project>(projectsData.value ?? []));

const createMut = useCreateProjectMutation();
const updateMut = useUpdateProjectMutation();
const deleteMut = useDeleteProjectMutation();

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const deleteTarget = ref<Project | null>(null);

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

const emptyForm = () => ({
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
  if (!form.value.name.trim()) return;
  saving.value = true;
  const payload: ProjectPayload = {
    clientId: props.clientId,
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

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title text-base">{{ t('ext.crm.clients.projects') }} ({{ projects.length }})</h2>
        <button class="btn btn-ghost btn-xs" @click="openCreate">
          <Plus class="w-3 h-3" /> {{ t('ext.crm.projects.new') }}
        </button>
      </div>

      <div v-if="isLoading" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>

      <div v-else-if="!projects.length" class="py-6 text-center text-base-content/40 text-sm">
        {{ t('ext.crm.common.none') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{{ t('ext.crm.projects.name') }}</th>
              <th>{{ t('ext.crm.projects.type') }}</th>
              <th>{{ t('ext.crm.projects.price') }}</th>
              <th>{{ t('ext.crm.projects.status') }}</th>
              <th>{{ t('ext.crm.projects.paymentStatus') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in projects" :key="p.id">
              <td class="font-medium">{{ p.name }}</td>
              <td>{{ p.type ? t(`ext.crm.projects.types.${p.type}`, p.type) : '—' }}</td>
              <td class="tabular-nums">{{ formatCurrency(p.price) }}</td>
              <td>
                <span class="badge badge-sm" :class="STATUS_BADGE[p.status] ?? 'badge-outline'">
                  {{ t(`ext.crm.projects.statusOptions.${p.status}`, p.status) }}
                </span>
              </td>
              <td>
                <span class="badge badge-sm" :class="PAYMENT_BADGE[p.paymentStatus] ?? 'badge-outline'">
                  {{ t(`ext.crm.projects.paymentOptions.${p.paymentStatus}`, p.paymentStatus) }}
                </span>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <EditButton @click="openEdit(p)" />
                  <DeleteButton @click="deleteTarget = p" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create/Edit modal -->
  <dialog v-if="showModal" class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ editingId ? t('ext.crm.projects.editTitle') : t('ext.crm.projects.newTitle') }}
      </h3>
      <div class="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
</template>