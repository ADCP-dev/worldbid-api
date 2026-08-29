<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Users, UserCheck, FolderKanban, Trophy } from 'lucide-vue-next';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import BarChart from '@base/ui-app/components/dashboard/BarChart.vue';
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue';
import TimelineList from '@base/ui-app/components/dashboard/TimelineList.vue';
import { useCrmDashboardQuery } from '../composables/useCrm';
import type { DaisyVariant } from '@base/ui-app/components/dashboard/types';

const { t } = useI18n();
const { data, isLoading } = useCrmDashboardQuery();

const stats = computed(() => [
  { label: t('ext.crm.dashboard.totalClients'), value: data.value?.totalClients ?? 0, icon: Users, color: 'primary' as DaisyVariant },
  { label: t('ext.crm.dashboard.activeClients'), value: data.value?.activeClients ?? 0, icon: UserCheck, color: 'success' as DaisyVariant },
  { label: t('ext.crm.dashboard.activeProjects'), value: data.value?.activeProjects ?? 0, icon: FolderKanban, color: 'info' as DaisyVariant },
  {
    label: t('ext.crm.dashboard.closedWon'),
    value: data.value?.projectsByStatus?.find((p) => p.status === 'delivered')?.count ?? 0,
    icon: Trophy,
    color: 'warning' as DaisyVariant,
  },
]);

const statusDonut = computed(() => {
  const byStatus = data.value?.clientsByStatus ?? [];
  return byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.label || s.statusName || `#${s.statusId}`,
      value: s.count,
      color: s.color || undefined,
    }));
});

const originChart = computed(() => {
  const byOrigin = data.value?.clientsByOrigin ?? [];
  return {
    categories: byOrigin.map((o) => o.label ?? `#${o.originId}`),
    series: [
      {
        name: t('ext.crm.dashboard.byOrigin'),
        data: byOrigin.map((o) => o.count),
      },
    ],
  };
});

const projectsChart = computed(() => {
  const byStatus = data.value?.projectsByStatus ?? [];
  return {
    categories: byStatus.map((p) => t(`ext.crm.projects.statusOptions.${p.status}`, p.status)),
    series: [{ name: t('ext.crm.dashboard.projectsByStatus'), data: byStatus.map((p) => p.count) }],
  };
});

const recentEvents = computed(() =>
  (data.value?.recentInteractions ?? []).slice(0, 6).map((i) => ({
    time: i.interactionDate || i.createdAt || new Date().toISOString(),
    title: t(`ext.crm.interactions.${i.type}`, i.type),
    description: i.subject ?? i.body ?? '',
    color: 'info' as DaisyVariant,
  })),
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('ext.crm.dashboard.title') }}</h1>
      <p class="text-base-content/60 mt-1">{{ t('ext.crm.dashboard.subtitle') }}</p>
    </div>

    <!-- KPI stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :color="stat.color"
        :loading="isLoading"
      />
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.crm.dashboard.byOrigin') }}</h2>
          <BarChart
            :categories="originChart.categories"
            :series="originChart.series"
            height="260px"
            :alt-text="t('ext.crm.dashboard.byOrigin')"
            :loading="isLoading"
          />
        </div>
      </div>
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.crm.dashboard.byStatus') }}</h2>
          <DonutChart
            v-if="statusDonut.length"
            :data="statusDonut"
            height="260px"
            :alt-text="t('ext.crm.dashboard.byStatus')"
            :loading="isLoading"
          />
          <div v-else class="flex items-center justify-center h-60 text-base-content/40 text-sm">
            {{ t('ext.crm.common.none') }}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.crm.dashboard.projectsByStatus') }}</h2>
          <BarChart
            :categories="projectsChart.categories"
            :series="projectsChart.series"
            height="260px"
            :alt-text="t('ext.crm.dashboard.projectsByStatus')"
            :loading="isLoading"
          />
        </div>
      </div>
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.crm.dashboard.recentTitle') }}</h2>
          <TimelineList v-if="recentEvents.length" :events="recentEvents" />
          <div v-else class="py-6 text-center text-base-content/40 text-sm">
            {{ t('ext.crm.clients.noInteractions') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>