<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus, UserPlus, Building2 } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  usePartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useInvitePartnerMutation,
  useCreatePartnerFromClientMutation,
  unwrapList,
} from '@affiliate/composables/useAffiliate';
import type { CellContext, Partner } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t } = useI18n();
const tableStateStore = useTableStateStore();

const tableName = 'affiliate-partners';

const tableState = computed(() => {
  const raw = (tableStateStore as unknown as Record<string, { pageIndex?: number; pageSize?: number; globalFilter?: string }>)[tableName] || {};
  return {
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
  };
});

const page = computed(() => tableState.value.pageIndex + 1);
const search = computed(() => tableState.value.globalFilter || undefined);

const { data: partnersData, isLoading } = usePartnersQuery(page, search);
const createMut = useCreatePartnerMutation();
const updateMut = useUpdatePartnerMutation();
const deleteMut = useDeletePartnerMutation();
const inviteMut = useInvitePartnerMutation();
const fromClientMut = useCreatePartnerFromClientMutation();

const partners = computed<Partner[]>(() =>
  unwrapList<Partner>(partnersData.value ?? []),
);
const total = computed(() => {
  const d = partnersData.value;
  return d && !Array.isArray(d) ? (d.total ?? 0) : partners.value.length;
});

function formatRate(rate: number | undefined) {
  if (rate === undefined || rate === null) return '—';
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

// ─── Create/Edit modal ───────────────────────────────────────────────

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);

const form = ref({
  name: '',
  companyName: '',
  email: '',
  phone: '',
  iban: '',
  commissionRate: 5,
  isActive: true,
});

function resetForm() {
  form.value = { name: '', companyName: '', email: '', phone: '', iban: '', commissionRate: 5, isActive: true };
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showModal.value = true;
}

function openEdit(partner: Partner) {
  editingId.value = partner.id;
  form.value = {
    name: partner.name || '',
    companyName: partner.companyName || '',
    email: partner.email || '',
    phone: partner.phone || '',
    iban: partner.iban || '',
    commissionRate: Math.round((partner.commissionRate ?? 0) * 100),
    isActive: partner.isActive,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  resetForm();
}

async function submit() {
  if (!form.value.name.trim()) {
    toast.error(t('ext.affiliate.partners.name'));
    return;
  }
  if (!form.value.email.trim()) {
    toast.error(t('ext.affiliate.partners.email'));
    return;
  }
  saving.value = true;
  const ratePct = Number(form.value.commissionRate) || 0;
  const payload = {
    name: form.value.name.trim(),
    companyName: form.value.companyName || undefined,
    email: form.value.email.trim(),
    phone: form.value.phone || undefined,
    iban: form.value.iban || undefined,
    commissionRate: ratePct / 100,
    isActive: form.value.isActive,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, data: payload });
      toast.success(t('ext.affiliate.common.saved'));
    } else {
      await createMut.mutateAsync(payload);
      toast.success(t('ext.affiliate.common.created'));
    }
    closeModal();
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

// ─── Delete modal ─────────────────────────────────────────────────────

const deleteTarget = ref<Partner | null>(null);

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

// ─── Invite ───────────────────────────────────────────────────────────

async function invitePartner(partner: Partner) {
  try {
    await inviteMut.mutateAsync(partner.id);
    toast.success(t('ext.affiliate.partners.invited'), { description: partner.email });
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

// ─── From-client modal ────────────────────────────────────────────────

const showFromClient = ref(false);
const fromClientSaving = ref(false);
const fromClientForm = ref({
  clientId: null as number | null,
  clientLabel: '',
  clientEmail: '',
  commissionRate: 5,
  invite: true,
});

function openFromClient() {
  fromClientForm.value = { clientId: null, clientLabel: '', clientEmail: '', commissionRate: 5, invite: true };
  showFromClient.value = true;
  void searchCrmClients('');
}

interface CrmClientOption {
  label: string;
  value: number;
}

const crmClientOptions = ref<CrmClientOption[]>([]);
const fromClientSearching = ref(false);

async function searchCrmClients(term: string) {
  fromClientSearching.value = true;
  try {
    const api = useApi();
    const res = await api.get<{ data?: Array<{ id: number; name: string; companyName?: string | null; email?: string | null }> } | Array<{ id: number; name: string; companyName?: string | null; email?: string | null }>>('/crm/clients', {
      query: { search: term || undefined, limit: 20 },
    });
    const list = Array.isArray(res) ? res : (res.data ?? []);
    crmClientOptions.value = list.map((c) => ({
      value: c.id,
      label: c.companyName ? `${c.name} (${c.companyName})` : c.name,
    }));
  } catch {
    crmClientOptions.value = [];
  } finally {
    fromClientSearching.value = false;
  }
}

async function submitFromClient() {
  if (!fromClientForm.value.clientId) {
    toast.error(t('ext.affiliate.partners.selectClient'));
    return;
  }
  fromClientSaving.value = true;
  const ratePct = Number(fromClientForm.value.commissionRate) || 0;
  try {
    const result = await fromClientMut.mutateAsync({
      clientId: fromClientForm.value.clientId,
      data: { commissionRate: ratePct / 100, invite: fromClientForm.value.invite },
    });
    toast.success(
      result.created
        ? t('ext.affiliate.partners.convertedOk')
        : t('ext.affiliate.partners.convertedExisting'),
    );
    showFromClient.value = false;
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    fromClientSaving.value = false;
  }
}

// ─── Table columns ────────────────────────────────────────────────────

const columns = computed(() => [
  {
    accessorKey: 'code',
    headerName: t('ext.affiliate.common.code'),
    header: t('ext.affiliate.common.code'),
    cell: ({ row }: CellContext<Partner>) =>
      h('span', { class: 'font-mono text-xs badge badge-outline' }, row.original.code ?? '—'),
  },
  {
    accessorKey: 'name',
    headerName: t('ext.affiliate.partners.name'),
    header: t('ext.affiliate.partners.name'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Partner>) =>
      h(
        'div',
        { class: 'flex flex-col' },
        [
          h('span', { class: 'font-medium' }, row.original.name),
          row.original.companyName
            ? h('span', { class: 'text-xs text-base-content/50' }, row.original.companyName)
            : null,
        ],
      ),
  },
  { accessorKey: 'email', headerName: t('ext.affiliate.partners.email'), header: t('ext.affiliate.partners.email'), filterType: 'string' as const },
  {
    accessorKey: 'commissionRate',
    headerName: t('ext.affiliate.partners.commissionRate'),
    header: t('ext.affiliate.partners.commissionRate'),
    cell: ({ row }: CellContext<Partner>) => formatRate(row.original.commissionRate),
  },
  {
    accessorKey: 'referralsCount',
    headerName: t('ext.affiliate.partners.referrals'),
    header: t('ext.affiliate.partners.referrals'),
    cell: ({ row }: CellContext<Partner>) => row.original.referralsCount ?? 0,
  },
  {
    accessorKey: 'userId',
    headerName: t('ext.affiliate.partners.user'),
    header: t('ext.affiliate.partners.user'),
    cell: ({ row }: CellContext<Partner>) =>
      h(
        'span',
        { class: `badge badge-sm ${row.original.userId ? 'badge-success' : 'badge-ghost'}` },
        row.original.userId ? t('ext.affiliate.partners.userLinked') : t('ext.affiliate.partners.userNotLinked'),
      ),
  },
  {
    accessorKey: 'isActive',
    headerName: t('ext.affiliate.common.active'),
    header: t('ext.affiliate.common.active'),
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Partner>) =>
      h(
        'span',
        { class: `badge badge-sm ${row.original.isActive ? 'badge-success' : 'badge-ghost'}` },
        row.original.isActive ? t('ext.affiliate.common.yes') : t('ext.affiliate.common.no'),
      ),
  },
  {
    id: 'actions',
    headerName: t('ext.affiliate.common.actions'),
    header: t('ext.affiliate.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Partner>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(ViewButton, {
          ariaLabel: row.original.name,
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/affiliate/partners/${row.original.id}`);
          },
        }),
        h(EditButton, {
          onClick: (e: Event) => {
            e.stopPropagation();
            openEdit(row.original);
          },
        }),
        row.original.userId
          ? null
          : h(UserPlus, {
              class: 'w-4 h-4 text-info cursor-pointer',
              'aria-label': t('ext.affiliate.partners.invite'),
              onClick: (e: Event) => {
                e.stopPropagation();
                void invitePartner(row.original);
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
        <h1 class="text-2xl font-bold">{{ t('ext.affiliate.partners.title') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.affiliate.partners.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-outline btn-sm" @click="openFromClient">
          <Building2 class="w-4 h-4" /> {{ t('ext.affiliate.partners.fromClient') }}
        </button>
        <button class="btn btn-primary btn-sm" @click="openCreate">
          <Plus class="w-4 h-4" /> {{ t('ext.affiliate.partners.new') }}
        </button>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md text-primary" />
        </div>
        <DataTable
          :columns="columns"
          :data="partners"
          :total="total"
          manual
          :table-name="tableName"
          @row-click="(row: Partner) => navigateTo(`/app/affiliate/partners/${row.id}`)"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          {{ editingId ? t('ext.affiliate.common.edit') : t('ext.affiliate.partners.new') }}
        </h3>
        <div class="py-4 space-y-4">
          <FormInput
            v-model="form.name"
            :label="t('ext.affiliate.partners.name')"
            required
          />
          <FormInput
            v-model="form.companyName"
            :label="t('ext.affiliate.partners.company')"
          />
          <FormInput
            v-model="form.email"
            :label="t('ext.affiliate.partners.email')"
            type="email"
            required
          />
          <div class="grid grid-cols-2 gap-4">
            <FormInput v-model="form.phone" :label="t('ext.affiliate.partners.phone')" />
            <FormInput v-model="form.iban" :label="t('ext.affiliate.partners.iban')" />
          </div>
          <FormInput
            v-model="form.commissionRate"
            :label="t('ext.affiliate.partners.commissionRate')"
            type="number"
            :description="t('ext.affiliate.partners.commissionRateHint')"
          />
          <FormSwitch v-model="form.isActive" :label="t('ext.affiliate.common.active')" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeModal">{{ t('ext.affiliate.common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            {{ editingId ? t('ext.affiliate.common.save') : t('ext.affiliate.common.create') }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeModal" />
    </dialog>

    <!-- From-client modal -->
    <dialog v-if="showFromClient" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.affiliate.partners.fromClientTitle') }}</h3>
        <div class="py-4 space-y-4">
          <FormSearchSelect
            v-model="fromClientForm.clientId"
            :label="t('ext.affiliate.partners.selectClient')"
            :placeholder="t('ext.affiliate.partners.selectClientPlaceholder')"
            :options="crmClientOptions"
            :disabled="fromClientSearching"
          />
          <p v-if="fromClientSearching" class="text-xs text-base-content/50">
            {{ t('ext.affiliate.common.loading') }}
          </p>
          <FormInput
            v-model="fromClientForm.commissionRate"
            :label="t('ext.affiliate.partners.commissionRate')"
            type="number"
            :description="t('ext.affiliate.partners.commissionRateHint')"
          />
          <FormSwitch
            v-model="fromClientForm.invite"
            :label="t('ext.affiliate.partners.inviteNew')"
          />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showFromClient = false">
            {{ t('ext.affiliate.common.cancel') }}
          </button>
          <button class="btn btn-primary" :disabled="fromClientSaving" @click="submitFromClient">
            <span v-if="fromClientSaving" class="loading loading-spinner loading-xs" />
            {{ t('ext.affiliate.common.create') }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showFromClient = false" />
    </dialog>

    <!-- Delete confirm -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('ext.affiliate.common.confirmDeleteTitle') }}</h3>
        <p class="py-4">
          <strong>{{ deleteTarget.name }}</strong> — {{ t('ext.affiliate.common.deleteWarning') }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('ext.affiliate.common.cancel') }}</button>
          <button class="btn btn-error" @click="confirmDelete">{{ t('ext.affiliate.common.delete') }}</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="deleteTarget = null" />
    </dialog>
  </div>
</template>