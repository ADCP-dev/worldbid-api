<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import {
  Clock,
  BadgeCheck,
  Euro,
  CalendarCheck,
  Plus,
} from 'lucide-vue-next';
import {
  useCommissionsQuery,
  useCommissionSummaryQuery,
  useUpdateCommissionMutation,
  unwrapList,
} from '@affiliate/composables/useAffiliate';
import type { CellContext, Commission } from '../../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t, d } = useI18n();

const { data: commissionsData, isLoading } = useCommissionsQuery();
const { data: summary } = useCommissionSummaryQuery();
const updateMut = useUpdateCommissionMutation();

const commissions = computed<Commission[]>(() => unwrapList<Commission>(commissionsData.value ?? []));
const { data: referralsData } = useReferralsQuery();
const referrals = computed<Referral[]>(() => unwrapList<Referral>(referralsData.value ?? []));
const showCreate = ref(false);

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return d(new Date(value), { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
      return 'badge-success';
    case 'approved':
      return 'badge-info';
    default:
      return 'badge-warning';
  }
}

async function setStatus(commission: Commission, status: string) {
  try {
    await updateMut.mutateAsync({ id: commission.id, data: { status } });
    toast.success(t('ext.affiliate.common.saved'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  }
}

const columns = computed(() => [
  {
    accessorKey: 'referral.partner.name',
    headerName: t('ext.affiliate.commissions.partner'),
    header: t('ext.affiliate.commissions.partner'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => row.original.partner?.name ?? '—',
  },
  {
    accessorKey: 'project.name',
    headerName: t('ext.affiliate.commissions.project'),
    header: t('ext.affiliate.commissions.project'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.original.project?.name ?? '—'),
        h('span', { class: 'text-xs text-base-content/50 tabular-nums' }, formatCurrency(row.original.baseAmount)),
      ]),
  },
  {
    accessorKey: 'commissionAmount',
    headerName: t('ext.affiliate.commissions.amount'),
    header: t('ext.affiliate.commissions.amount'),
    cell: ({ row }: CellContext<Commission>) =>
      h('span', { class: 'font-semibold tabular-nums' }, formatCurrency(row.original.commissionAmount)),
  },
  {
    accessorKey: 'status',
    headerName: t('ext.affiliate.commissions.status'),
    header: t('ext.affiliate.commissions.status'),
    filterType: 'select' as const,
    options: [
      { value: 'pending', label: t('ext.affiliate.status.pending') },
      { value: 'approved', label: t('ext.affiliate.status.approved') },
      { value: 'paid', label: t('ext.affiliate.status.paid') },
    ],
    cell: ({ row }: CellContext<Commission>) =>
      h('span', { class: `badge badge-sm ${statusBadge(row.original.status)}` }, t(`ext.affiliate.status.${row.original.status}`)),
  },
  {
    accessorKey: 'paidAt',
    headerName: t('ext.affiliate.commissions.paidAt'),
    header: t('ext.affiliate.commissions.paidAt'),
    cell: ({ row }: CellContext<Commission>) => formatDate(row.original.paidAt),
  },
  {
    id: 'actions',
    headerName: t('ext.affiliate.common.actions'),
    header: t('ext.affiliate.common.actions'),
    enableSorting: false,
    cell: ({ row }: CellContext<Commission>) => {
      const c = row.original;
      const buttons = [];
      if (c.status === 'pending') {
        buttons.push(h('button', {
          class: 'btn btn-xs btn-info btn-outline',
          onClick: (e: Event) => {
            e.stopPropagation();
            void setStatus(c, 'approved');
          },
        }, t('ext.affiliate.commissions.approve')));
      }
      if (c.status === 'pending' || c.status === 'approved') {
        buttons.push(h('button', {
          class: 'btn btn-xs btn-success btn-outline',
          onClick: (e: Event) => {
            e.stopPropagation();
            void setStatus(c, 'paid');
          },
        }, t('ext.affiliate.commissions.markPaid')));
      }
      return h('div', { class: 'flex items-center gap-1' }, buttons);
    },
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('ext.affiliate.commissions.title') }}</h1>
        <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.affiliate.commissions.subtitle') }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="showCreate = true">
        <Plus class="w-4 h-4" /> {{ t('ext.affiliate.commissions.new') }}
      </button>
    </div>

    <!-- Summary stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        :label="t('ext.affiliate.commissions.summary.pending')"
        :value="formatCurrency(summary?.pendingTotal ?? 0)"
        :icon="Clock"
        color="warning"
      />
      <StatCard
        :label="t('ext.affiliate.commissions.summary.approved')"
        :value="formatCurrency(summary?.approvedTotal ?? 0)"
        :icon="BadgeCheck"
        color="info"
      />
      <StatCard
        :label="t('ext.affiliate.commissions.summary.paid')"
        :value="formatCurrency(summary?.paidTotal ?? 0)"
        :icon="Euro"
        color="success"
      />
      <StatCard
        :label="t('ext.affiliate.commissions.summary.paidThisMonth')"
        :value="formatCurrency(summary?.paidThisMonth ?? 0)"
        :icon="CalendarCheck"
        color="primary"
      />
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="commissions"
          :loading="isLoading"
          manual
          table-name="affiliate-commissions"
        />
      </div>
    </div>

    <CommissionModal
      v-if="showCreate"
      :referrals="referrals"
      @close="showCreate = false"
    />
  </div>
</template>
