<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  useReferralsQuery,
  usePartnersQuery,
  useCreateReferralMutation,
  useUpdateReferralMutation,
  useDeleteReferralMutation,
  unwrapList,
} from '@affiliate/composables/useAffiliate';
import type { CellContext, Referral } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t, d } = useI18n();

const statusFilter = ref<string | undefined>(undefined);
const { data: referralsData, isLoading } = useReferralsQuery(undefined, statusFilter);
const { data: partnersData } = usePartnersQuery();
const createMut = useCreateReferralMutation();
const updateMut = useUpdateReferralMutation();
const deleteMut = useDeleteReferralMutation();

const referrals = computed<Referral[]>(() => unwrapList<Referral>(referralsData.value ?? []));
const partners = computed(() => unwrapList(partnersData.value ?? []));

const statusOptions = computed(() => [
  { value: 'pending', label: t('ext.affiliate.status.pending') },
  { value: 'converted', label: t('ext.affiliate.status.converted') },
  { value: 'rejected', label: t('ext.affiliate.status.rejected') },
]);

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return d(new Date(value), { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'converted':
      return 'badge-success';
    case 'rejected':
      return 'badge-error';
    default:
      return 'badge-warning';
  }
}

// ─── Create modal ─────────────────────────────────────────────────────

const showCreate = ref(false);
const createForm = ref({ partnerId: null as number | null, clientId: null as number | null, status: 'pending' });

const partnerOptions = computed(() =>
  partners.value.map((p: { id: number; name: string }) => ({ value: p.id, label: p.name })),
);

async function submitCreate() {
  if (!createForm.value.partnerId || !createForm.value.clientId) {
    toast.error(t('ext.affiliate.common.error'));
    return;
  }
  try {
    await createMut.mutateAsync({
      partnerId: Number(createForm.value.partnerId),
      clientId: Number(createForm.value.clientId),
      status: createForm.value.status,
    });
    toast.success(t('ext.affiliate.common.created'));
    showCreate.value = false;
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

async function markConverted(referral: Referral) {
  try {
    await updateMut.mutateAsync({ id: referral.id, data: { status: 'converted' } });
    toast.success(t('ext.affiliate.referrals.converted'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

async function reject(referral: Referral) {
  try {
    await updateMut.mutateAsync({ id: referral.id, data: { status: 'rejected' } });
    toast.success(t('ext.affiliate.referrals.reject'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

const deleteTarget = ref<Referral | null>(null);

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success(t('ext.affiliate.common.saved'));
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

const columns = computed(() => [
  {
    accessorKey: 'client.name',
    headerName: t('ext.affiliate.referrals.client'),
    header: t('ext.affiliate.referrals.client'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) =>
      h(
        'div',
        { class: 'flex flex-col' },
        [
          h('span', { class: 'font-medium' }, row.original.client?.name ?? row.original.clientName ?? '—'),
          row.original.client?.companyName
            ? h('span', { class: 'text-xs text-base-content/50' }, row.original.client.companyName)
            : null,
        ],
      ),
  },
  {
    accessorKey: 'partner.name',
    headerName: t('ext.affiliate.referrals.partner'),
    header: t('ext.affiliate.referrals.partner'),
    cell: ({ row }: CellContext<Referral>) => row.original.partner?.name ?? '—',
  },
  {
    accessorKey: 'status',
    headerName: t('ext.affiliate.referrals.status'),
    header: t('ext.affiliate.referrals.status'),
    filterType: 'select' as const,
    options: statusOptions.value,
    cell: ({ row }: CellContext<Referral>) =>
      h('span', { class: `badge badge-sm ${statusBadge(row.original.status)}` }, t(`ext.affiliate.status.${row.original.status}`)),
  },
  {
    accessorKey: 'referredAt',
    headerName: t('ext.affiliate.referrals.date'),
    header: t('ext.affiliate.referrals.date'),
    cell: ({ row }: CellContext<Referral>) => formatDate(row.original.referredAt ?? row.original.createdAt),
  },
  {
    id: 'actions',
    headerName: t('ext.affiliate.common.actions'),
    header: t('ext.affiliate.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Referral>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        row.original.status === 'pending'
          ? h('button', {
              class: 'btn btn-xs btn-success btn-outline',
              onClick: (e: Event) => {
                e.stopPropagation();
                void markConverted(row.original);
              },
            }, t('ext.affiliate.referrals.convert'))
          : null,
        row.original.status === 'pending'
          ? h('button', {
              class: 'btn btn-xs btn-error btn-outline',
              onClick: (e: Event) => {
                e.stopPropagation();
                void reject(row.original);
              },
            }, t('ext.affiliate.referrals.reject'))
          : null,
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
        <h1 class="text-2xl font-bold">{{ t('ext.affiliate.referrals.title') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.affiliate.referrals.subtitle') }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="showCreate = true">
        <Plus class="w-4 h-4" /> {{ t('ext.affiliate.referrals.new') }}
      </button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="statusFilter" class="mb-2 flex items-center gap-2 text-sm">
          <span class="text-base-content/60">{{ t('ext.affiliate.referrals.status') }}:</span>
          <span class="badge badge-outline">{{ t(`ext.affiliate.status.${statusFilter}`) }}</span>
          <button class="btn btn-ghost btn-xs" @click="statusFilter = undefined">✕</button>
        </div>
        <DataTable
          :columns="columns"
          :data="referrals"
          :loading="isLoading"
          manual
          table-name="affiliate-referrals"
        />
      </div>
    </div>

    <!-- Create modal -->
    <dialog v-if="showCreate" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.affiliate.referrals.new') }}</h3>
        <div class="py-4 space-y-4">
          <FormSelect
            v-model="createForm.partnerId"
            :label="t('ext.affiliate.referrals.selectPartner')"
            :options="partnerOptions"
          />
          <FormInput
            :model-value="createForm.clientId ?? ''"
            type="number"
            :label="t('ext.affiliate.referrals.selectClient')"
            @update:model-value="createForm.clientId = $event ? Number($event) : null"
          />
          <FormSelect
            v-model="createForm.status"
            :label="t('ext.affiliate.referrals.status')"
            :options="statusOptions"
          />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showCreate = false">{{ t('ext.affiliate.common.cancel') }}</button>
          <button class="btn btn-primary" @click="submitCreate">{{ t('ext.affiliate.common.create') }}</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showCreate = false" />
    </dialog>

    <!-- Delete confirm -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.affiliate.common.confirmDeleteTitle') }}</h3>
        <p class="py-4">{{ t('ext.affiliate.common.deleteWarning') }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('ext.affiliate.common.cancel') }}</button>
          <button class="btn btn-error" @click="confirmDelete">{{ t('ext.affiliate.common.delete') }}</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="deleteTarget = null" />
    </dialog>
  </div>
</template>