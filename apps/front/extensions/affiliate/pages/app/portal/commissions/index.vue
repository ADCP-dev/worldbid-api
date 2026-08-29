<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import { Clock, BadgeCheck, Euro, CalendarCheck } from 'lucide-vue-next';
import { useMyCommissionsQuery, useMySummaryQuery } from '../../../composables/useAffiliate';
import type { CellContext, Commission } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t, d } = useI18n();

const { data: commissionsData, isLoading } = useMyCommissionsQuery();
const { data: summary, isLoading: summaryLoading } = useMySummaryQuery();

const commissions = computed<Commission[]>(() =>
  Array.isArray(commissionsData.value) ? commissionsData.value : (commissionsData.value?.data ?? []),
);

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

const stats = computed(() => [
  { label: t('ext.affiliate.portal.pending'), value: summary.value?.pendingTotal ?? 0, icon: Clock, color: 'warning' as const },
  { label: t('ext.affiliate.portal.approved'), value: summary.value?.approvedTotal ?? 0, icon: BadgeCheck, color: 'info' as const },
  { label: t('ext.affiliate.portal.paidTotal'), value: summary.value?.paidTotal ?? 0, icon: Euro, color: 'success' as const },
  { label: t('ext.affiliate.portal.paidThisMonth'), value: summary.value?.paidThisMonth ?? 0, icon: CalendarCheck, color: 'primary' as const },
]);

const columns = computed(() => [
  {
    accessorKey: 'project.name',
    headerName: t('ext.affiliate.commissions.project'),
    header: t('ext.affiliate.commissions.project'),
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Commission>) => row.original.project?.name ?? '—',
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
    cell: ({ row }: CellContext<Commission>) =>
      h('span', { class: `badge badge-sm ${statusBadge(row.original.status)}` }, t(`ext.affiliate.status.${row.original.status}`)),
  },
  {
    accessorKey: 'paidAt',
    headerName: t('ext.affiliate.commissions.paidAt'),
    header: t('ext.affiliate.commissions.paidAt'),
    cell: ({ row }: CellContext<Commission>) => formatDate(row.original.paidAt),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-2xl font-bold">{{ t('ext.affiliate.portal.commissionsTitle') }}</h1>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="formatCurrency(stat.value as number)"
        :icon="stat.icon"
        :color="stat.color"
        :loading="summaryLoading"
      />
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="commissions"
          :loading="isLoading"
          manual
          table-name="portal-commissions"
        />
      </div>
    </div>
  </div>
</template>