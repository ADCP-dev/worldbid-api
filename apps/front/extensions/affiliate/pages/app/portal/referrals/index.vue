<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import { useMyReferralsQuery } from '@affiliate/composables/useAffiliate';
import type { CellContext, Referral } from '../../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t, d } = useI18n();

const { data: referralsData, isLoading } = useMyReferralsQuery();
const referrals = computed<Referral[]>(() =>
  Array.isArray(referralsData.value) ? referralsData.value : (referralsData.value?.data ?? []),
);

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

const columns = computed(() => [
  {
    accessorKey: 'client.name',
    headerName: t('ext.affiliate.referralForm.clientName'),
    header: t('ext.affiliate.referralForm.clientName'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Referral>) =>
      row.original.client?.name ?? '—',
  },
  {
    accessorKey: 'status',
    headerName: t('ext.affiliate.referrals.status'),
    header: t('ext.affiliate.referrals.status'),
    cell: ({ row }: CellContext<Referral>) =>
      h(
        'span',
        { class: `badge badge-sm ${statusBadge(row.original.status)}` },
        t(`ext.affiliate.status.${row.original.status}`),
      ),
  },
  {
    accessorKey: 'referredAt',
    headerName: t('ext.affiliate.referrals.date'),
    header: t('ext.affiliate.referrals.date'),
    cell: ({ row }: CellContext<Referral>) => formatDate(row.original.referredAt ?? row.original.createdAt),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('ext.affiliate.portal.referralsTitle') }}</h1>
      </div>
      <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary btn-sm">
        <Plus class="w-4 h-4" /> {{ t('ext.affiliate.portal.newReferral') }}
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="!isLoading && !referrals.length" class="text-center py-12">
          <p class="text-base-content/60">{{ t('ext.affiliate.portal.noReferrals') }}</p>
          <p class="text-xs text-base-content/40 mt-1">{{ t('ext.affiliate.portal.noReferralsHint') }}</p>
          <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary btn-sm mt-4">
            <Plus class="w-4 h-4" /> {{ t('ext.affiliate.portal.newReferral') }}
          </NuxtLink>
        </div>
        <DataTable
          v-else
          :columns="columns"
          :data="referrals"
          :loading="isLoading"
          manual
          table-name="portal-referrals"
        />
      </div>
    </div>
  </div>
</template>