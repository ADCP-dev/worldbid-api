<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Users,
  UserPlus,
  CheckCircle2,
  Euro,
} from 'lucide-vue-next';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import BarChart from '@base/ui-app/components/dashboard/BarChart.vue';
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue';
import TimelineList from '@base/ui-app/components/dashboard/TimelineList.vue';
import { useAffiliateDashboardQuery } from '@affiliate/composables/useAffiliate';
import type { Commission } from '../types';

const { t } = useI18n();

const { data, isLoading } = useAffiliateDashboardQuery();

const summary = computed(() => data.value ?? {});

const stats = computed(() => [
  {
    label: t('ext.affiliate.dashboard.activePartners'),
    value: summary.value.activePartners ?? 0,
    icon: Users,
    color: 'primary' as const,
  },
  {
    label: t('ext.affiliate.dashboard.pendingReferrals'),
    value: summary.value.pendingReferrals ?? 0,
    icon: UserPlus,
    color: 'warning' as const,
  },
  {
    label: t('ext.affiliate.dashboard.convertedReferrals'),
    value: summary.value.convertedReferrals ?? 0,
    icon: CheckCircle2,
    color: 'success' as const,
  },
  {
    label: t('ext.affiliate.dashboard.paidThisMonth'),
    value: summary.value.paidThisMonth ?? 0,
    icon: Euro,
    color: 'info' as const,
    isCurrency: true,
  },
]);

const monthlyChart = computed(() => {
  const series = summary.value.monthlySeries ?? [];
  return {
    categories: series.map((m) => m.month),
    series: [
      {
        name: t('ext.affiliate.dashboard.paidSeries'),
        data: series.map((m) => Number((m.paid ?? 0).toFixed(2))),
      },
      {
        name: t('ext.affiliate.dashboard.pendingSeries'),
        data: series.map((m) => Number((m.pending ?? 0).toFixed(2))),
      },
    ],
  };
});

const referralDonut = computed(() => {
  const pending = summary.value.pendingReferrals ?? 0;
  const converted = summary.value.convertedReferrals ?? 0;
  const total = summary.value.totalReferrals ?? pending + converted;
  const other = Math.max(total - pending - converted, 0);
  return [
    { name: t('ext.affiliate.status.pending'), value: pending, color: '#f59e0b' },
    { name: t('ext.affiliate.status.converted'), value: converted, color: '#10b981' },
    ...(other > 0
      ? [{ name: t('ext.affiliate.status.rejected'), value: other, color: '#ef4444' }]
      : []),
  ].filter((s) => s.value > 0);
});

const recent = computed<Commission[]>(() => summary.value.recentCommissions ?? []);

const timelineEvents = computed(() =>
  recent.value.slice(0, 6).map((c) => ({
    time: c.createdAt ?? c.paidAt ?? new Date().toISOString(),
    title: c.partner?.name ?? t('ext.affiliate.common.none'),
    description: `${t('ext.affiliate.commissions.project')}: ${c.project?.name ?? '—'} · ${formatCurrency(c.commissionAmount)}`,
    color: (c.status === 'paid'
      ? 'success'
      : c.status === 'approved'
        ? 'info'
        : 'warning') as 'success' | 'info' | 'warning',
  })),
);

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('ext.affiliate.dashboard.title') }}</h1>
      <p class="text-base-content/60 mt-1">{{ t('ext.affiliate.dashboard.subtitle') }}</p>
    </div>

    <!-- KPI stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.isCurrency ? formatCurrency(stat.value as number) : (stat.value as number)"
        :icon="stat.icon"
        :color="stat.color"
        :loading="isLoading"
      />
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card bg-base-100 shadow-sm border border-base-300 lg:col-span-2">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.dashboard.monthlySeries') }}</h2>
          <BarChart
            :categories="monthlyChart.categories"
            :series="monthlyChart.series"
            height="280px"
            :alt-text="t('ext.affiliate.dashboard.monthlySeries')"
            :loading="isLoading"
          />
        </div>
      </div>
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.dashboard.referralStatus') }}</h2>
          <DonutChart
            v-if="referralDonut.length"
            :data="referralDonut"
            height="280px"
            :alt-text="t('ext.affiliate.dashboard.referralStatus')"
          />
          <div v-else class="flex items-center justify-center h-70 text-base-content/40 text-sm">
            {{ t('ext.affiliate.common.none') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Top partners + recent commissions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.dashboard.topPartners') }}</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>{{ t('ext.affiliate.partners.name') }}</th>
                  <th class="text-right">{{ t('ext.affiliate.dashboard.revenue') }}</th>
                  <th class="text-right">{{ t('ext.affiliate.dashboard.commissions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!summary.topPartners?.length">
                  <td colspan="3" class="text-center text-base-content/40 py-4">
                    {{ t('ext.affiliate.common.none') }}
                  </td>
                </tr>
                <tr v-for="p in summary.topPartners" :key="p.id">
                  <td class="font-medium">{{ p.name }}</td>
                  <td class="text-right tabular-nums">{{ formatCurrency(p.revenue) }}</td>
                  <td class="text-right tabular-nums">{{ p.commissionsCount ?? 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.dashboard.recentCommissions') }}</h2>
          <TimelineList v-if="timelineEvents.length" :events="timelineEvents" />
          <div v-else class="py-6 text-center text-base-content/40 text-sm">
            {{ t('ext.affiliate.common.none') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>