<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { UserPlus } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import {
  usePartnerQuery,
  useReferralsQuery,
  useCommissionsQuery,
  useUpdatePartnerMutation,
  useInvitePartnerMutation,
  unwrapList,
} from '../../../composables/useAffiliate';
import type { CellContext, Commission, Referral } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t, d } = useI18n();
const route = useRoute();
const partnerId = computed(() => route.params.id as string);

const { data: partner, isLoading } = usePartnerQuery(partnerId);
const { data: referralsData } = useReferralsQuery(partnerId, undefined);
const { data: commissionsData } = useCommissionsQuery(partnerId, undefined);

const referrals = computed<Referral[]>(() => unwrapList<Referral>(referralsData.value ?? []));
const commissions = computed<Commission[]>(() => unwrapList<Commission>(commissionsData.value ?? []));

const saving = ref(false);
const inviting = ref(false);

const form = computed(() => ({
  name: partner.value?.name ?? '',
  companyName: partner.value?.companyName ?? '',
  email: partner.value?.email ?? '',
  phone: partner.value?.phone ?? '',
  iban: partner.value?.iban ?? '',
  ratePct: partner.value ? Math.round((partner.value.commissionRate ?? 0) * 100) : 0,
  isActive: partner.value?.isActive ?? true,
}));

const edit = ref({
  name: '',
  companyName: '',
  phone: '',
  iban: '',
  ratePct: 0,
  isActive: true,
});

watchEffect(() => {
  if (partner.value) {
    edit.value = {
      name: partner.value.name ?? '',
      companyName: partner.value.companyName ?? '',
      phone: partner.value.phone ?? '',
      iban: partner.value.iban ?? '',
      ratePct: Math.round((partner.value.commissionRate ?? 0) * 100),
      isActive: partner.value.isActive,
    };
  }
});

const updateMut = useUpdatePartnerMutation();
const inviteMut = useInvitePartnerMutation();

async function save() {
  saving.value = true;
  try {
    await updateMut.mutateAsync({
      id: partnerId.value,
      data: {
        name: edit.value.name,
        companyName: edit.value.companyName || undefined,
        phone: edit.value.phone || undefined,
        iban: edit.value.iban || undefined,
        commissionRate: (Number(edit.value.ratePct) || 0) / 100,
        isActive: edit.value.isActive,
      },
    });
    toast.success(t('ext.affiliate.common.saved'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function invite() {
  inviting.value = true;
  try {
    await inviteMut.mutateAsync(partnerId.value);
    toast.success(t('ext.affiliate.partners.invited'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    inviting.value = false;
  }
}

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return d(new Date(value), { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'converted':
    case 'paid':
      return 'badge-success';
    case 'approved':
      return 'badge-info';
    case 'rejected':
      return 'badge-error';
    default:
      return 'badge-warning';
  }
}

const referralColumns = computed(() => [
  { accessorKey: 'client.name', headerName: t('ext.affiliate.referrals.client'), header: t('ext.affiliate.referrals.client'), cell: ({ row }: CellContext<Referral>) => row.original.client?.name ?? row.original.clientName ?? '—' },
  { accessorKey: 'status', headerName: t('ext.affiliate.referrals.status'), header: t('ext.affiliate.referrals.status'), cell: ({ row }: CellContext<Referral>) => t(`ext.affiliate.status.${row.original.status}`) },
  { accessorKey: 'referredAt', headerName: t('ext.affiliate.referrals.date'), header: t('ext.affiliate.referrals.date'), cell: ({ row }: CellContext<Referral>) => formatDate(row.original.referredAt ?? row.original.createdAt) },
]);

const commissionColumns = computed(() => [
  { accessorKey: 'project.name', headerName: t('ext.affiliate.commissions.project'), header: t('ext.affiliate.commissions.project'), cell: ({ row }: CellContext<Commission>) => row.original.project?.name ?? '—' },
  { accessorKey: 'commissionAmount', headerName: t('ext.affiliate.commissions.amount'), header: t('ext.affiliate.commissions.amount'), cell: ({ row }: CellContext<Commission>) => formatCurrency(row.original.commissionAmount) },
  { accessorKey: 'status', headerName: t('ext.affiliate.commissions.status'), header: t('ext.affiliate.commissions.status'), cell: ({ row }: CellContext<Commission>) => t(`ext.affiliate.status.${row.original.status}`) },
  { accessorKey: 'paidAt', headerName: t('ext.affiliate.commissions.paidAt'), header: t('ext.affiliate.commissions.paidAt'), cell: ({ row }: CellContext<Commission>) => formatDate(row.original.paidAt) },
]);
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-3">
          <NuxtLink to="/app/affiliate/partners" class="btn btn-ghost btn-sm btn-circle">←</NuxtLink>
          <h1 class="text-2xl font-bold">{{ partner?.name ?? t('ext.affiliate.common.loading') }}</h1>
          <span class="badge badge-outline font-mono">{{ partner?.code }}</span>
          <span class="badge" :class="partner?.isActive ? 'badge-success' : 'badge-ghost'">
            {{ partner?.isActive ? t('ext.affiliate.common.active') : t('ext.affiliate.common.inactive') }}
          </span>
        </div>
        <p v-if="partner" class="text-base-content/60 mt-1 text-sm">{{ partner.email }}</p>
      </div>
      <button
        v-if="partner && !partner.userId"
        class="btn btn-primary btn-sm"
        :disabled="inviting"
        @click="invite"
      >
        <UserPlus class="w-4 h-4" />
        {{ t('ext.affiliate.partners.invite') }}
      </button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else-if="partner">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Edit form -->
        <div class="card bg-base-100 shadow-sm border border-base-300 lg:col-span-2">
          <div class="card-body">
            <h2 class="card-title text-base">{{ t('ext.affiliate.common.edit') }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <FormInput v-model="edit.name" :label="t('ext.affiliate.partners.name')" required />
              <FormInput v-model="edit.companyName" :label="t('ext.affiliate.partners.company')" />
              <FormInput v-model="edit.phone" :label="t('ext.affiliate.partners.phone')" />
              <FormInput v-model="edit.iban" :label="t('ext.affiliate.partners.iban')" />
              <FormInput v-model="edit.ratePct" :label="t('ext.affiliate.partners.commissionRate')" type="number" />
              <FormSwitch v-model="edit.isActive" :label="t('ext.affiliate.common.active')" />
            </div>
            <div class="card-actions justify-end mt-4">
              <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
                <span v-if="saving" class="loading loading-spinner loading-xs" />
                {{ t('ext.affiliate.common.save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Info panel -->
        <div class="space-y-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title text-base">{{ t('ext.affiliate.partners.user') }}</h2>
              <p class="text-sm">
                <span class="badge" :class="partner.userId ? 'badge-success' : 'badge-warning'">
                  {{ partner.userId ? t('ext.affiliate.partners.userLinked') : t('ext.affiliate.partners.userNotLinked') }}
                </span>
              </p>
              <p class="text-xs text-base-content/50 mt-1">{{ t('ext.affiliate.partners.inviteHint') }}</p>
            </div>
          </div>
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title text-base">{{ t('ext.affiliate.partners.linkedClient') }}</h2>
              <NuxtLink
                v-if="partner.clientId"
                :to="`/app/crm/clients/${partner.clientId}`"
                class="link link-primary text-sm"
              >
                {{ t('ext.affiliate.partners.linkedClient') }} #{{ partner.clientId }}
              </NuxtLink>
              <p v-else class="text-sm text-base-content/40">
                {{ t('ext.affiliate.partners.noClient') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Referrals + commissions -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-base">{{ t('ext.affiliate.referrals.title') }} ({{ referrals.length }})</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>{{ t('ext.affiliate.referrals.client') }}</th>
                    <th>{{ t('ext.affiliate.referrals.status') }}</th>
                    <th>{{ t('ext.affiliate.referrals.date') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!referrals.length">
                    <td colspan="3" class="text-center text-base-content/40 py-4">—</td>
                  </tr>
                  <tr v-for="r in referrals" :key="r.id">
                    <td class="font-medium">{{ r.client?.name ?? r.clientName ?? '—' }}</td>
                    <td><span class="badge badge-sm" :class="statusBadge(r.status)">{{ t(`ext.affiliate.status.${r.status}`) }}</span></td>
                    <td>{{ formatDate(r.referredAt ?? r.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-base">{{ t('ext.affiliate.commissions.title') }} ({{ commissions.length }})</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>{{ t('ext.affiliate.commissions.project') }}</th>
                    <th>{{ t('ext.affiliate.commissions.amount') }}</th>
                    <th>{{ t('ext.affiliate.commissions.status') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!commissions.length">
                    <td colspan="3" class="text-center text-base-content/40 py-4">—</td>
                  </tr>
                  <tr v-for="c in commissions" :key="c.id">
                    <td class="font-medium">{{ c.project?.name ?? '—' }}</td>
                    <td class="tabular-nums">{{ formatCurrency(c.commissionAmount) }}</td>
                    <td><span class="badge badge-sm" :class="statusBadge(c.status)">{{ t(`ext.affiliate.status.${c.status}`) }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>