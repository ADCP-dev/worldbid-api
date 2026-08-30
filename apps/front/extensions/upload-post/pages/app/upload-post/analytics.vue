<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { BarChart3, Mail, Users, Eye, MousePointerClick, Heart } from 'lucide-vue-next';
import PageShell from '@upload-post/components/PageShell.vue';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import LineChart from '@base/ui-app/components/dashboard/LineChart.vue';
import BarChart from '@base/ui-app/components/dashboard/BarChart.vue';
import DonutChart from '@base/ui-app/components/dashboard/DonutChart.vue';
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue';
import {
  useAnalyticsQuery,
  useLocalPostsQuery,
  useWeeklyReportQuery,
  useSendWeeklyReportMutation,
  type UpAnalyticsPlatform,
} from '@upload-post/composables/useUploadPostApi';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const profile = ref('default');
const platformFilter = ref('');

const analyticsQuery = useAnalyticsQuery(
  computed(() => profile.value),
  computed(() => (platformFilter.value ? [platformFilter.value] : undefined)),
);
const weeklyQuery = useWeeklyReportQuery();
const sendReport = useSendWeeklyReportMutation();

const platformEntries = computed<[string, UpAnalyticsPlatform][]>(() =>
  Object.entries(analyticsQuery.data.value ?? {}),
);

const totals = computed(() => {
  const acc = { followers: 0, reach: 0, impressions: 0, interactions: 0 };
  for (const [, p] of platformEntries.value) {
    acc.followers += p.followers ?? 0;
    acc.reach += p.reach ?? 0;
    acc.impressions += p.impressions ?? 0;
    acc.interactions += (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);
  }
  return acc;
});

const reachSeries = computed(() =>
  platformEntries.value
    .filter(([, p]) => (p.reach_timeseries ?? []).length > 0)
    .map(([platform, p]) => ({
      name: t(`ext.upload-post.platforms.${platform}`),
      data: (p.reach_timeseries ?? []).map(
        (point: { date: string; value: number }) => ({
          x: new Date(point.date).getTime(),
          y: point.value,
        }),
      ),
    })),
);

const platformBars = computed(() => ({
  categories: platformEntries.value.map(([k]) => t(`ext.upload-post.platforms.${k}`)),
  series: [
    {
      name: t('ext.upload-post.analytics.reach'),
      data: platformEntries.value.map(([, p]) => p.reach ?? 0),
    },
  ],
}));

const statusSlices = computed(() => {
  const dist: Record<string, number> = {};
  for (const p of localPosts.value) {
    dist[p.status] = (dist[p.status] ?? 0) + 1;
  }
  return Object.entries(dist).map(([name, value]) => ({ name, value }));
});

const localPostsQuery = useLocalPostsQuery();
void localPostsQuery;
const localPosts = computed(() => localPostsQuery.data.value ?? []);

async function onSendReport() {
  try {
    await sendReport.mutateAsync();
    toast.success(t('ext.upload-post.analytics.reportSent'));
  } catch (err: unknown) {
    toast.error(
      err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'),
    );
  }
}
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.analytics.title')"
    :subtitle="t('ext.upload-post.pages.analytics.subtitle')"
    :icon="BarChart3"
    :loading="analyticsQuery.isLoading.value"
  >
    <div class="space-y-6">
      <!-- KPI row -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          :label="t('ext.upload-post.analytics.followers')"
          :value="totals.followers"
          :icon="Users"
          color="primary"
        />
        <StatCard
          :label="t('ext.upload-post.analytics.reach')"
          :value="totals.reach"
          :icon="Eye"
          color="info"
        />
        <StatCard
          :label="t('ext.upload-post.analytics.impressions')"
          :value="totals.impressions"
          :icon="Eye"
          color="secondary"
        />
        <StatCard
          :label="t('ext.upload-post.analytics.interactions')"
          :value="totals.interactions"
          :icon="Heart"
          color="success"
        />
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-sm">
              {{ t('ext.upload-post.analytics.reachOverTime') }}
            </h3>
            <LineChart
              v-if="reachSeries.length > 0"
              :series="reachSeries"
              x-axis-type="time"
              smooth
              area
              :alt-text="t('ext.upload-post.analytics.reachOverTime')"
            />
            <EmptyState
              v-else
              :title="t('ext.upload-post.common.noData')"
              :icon="MousePointerClick"
            />
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-sm">
              {{ t('ext.upload-post.analytics.perPlatform') }}
            </h3>
            <BarChart
              v-if="platformBars.categories.length > 0"
              :categories="platformBars.categories"
              :series="platformBars.series"
              :alt-text="t('ext.upload-post.analytics.perPlatform')"
            />
            <EmptyState
              v-else
              :title="t('ext.upload-post.common.noData')"
              :icon="MousePointerClick"
            />
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-sm">
              {{ t('ext.upload-post.analytics.statusDistribution') }}
            </h3>
            <DonutChart
              v-if="statusSlices.length > 0"
              :data="statusSlices"
              :alt-text="t('ext.upload-post.analytics.statusDistribution')"
            />
            <EmptyState
              v-else
              :title="t('ext.upload-post.common.noData')"
              :icon="Mail"
            />
          </div>
        </div>

        <!-- Weekly report card -->
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-3">
            <h3 class="card-title text-sm">
              {{ t('ext.upload-post.analytics.weeklyReport') }}
            </h3>
            <template v-if="weeklyQuery.data.value">
              <p class="text-sm text-base-content/60">
                {{ weeklyQuery.data.value.period.start }} →
                {{ weeklyQuery.data.value.period.end }}
              </p>
              <p class="text-2xl font-bold">
                {{ t('ext.upload-post.analytics.totalImpressions') }}:
                {{ weeklyQuery.data.value.totalImpressions }}
              </p>
              <p class="text-sm">
                {{ t('ext.upload-post.analytics.topPlatform') }}:
                {{ t(`ext.upload-post.platforms.${weeklyQuery.data.value.topPlatform}`) }}
              </p>
              <ul class="text-xs text-base-content/60 space-y-1">
                <li v-for="p in weeklyQuery.data.value.platforms" :key="p.platform">
                  {{ t(`ext.upload-post.platforms.${p.platform}`) }} —
                  {{ p.followers }} (+{{ p.followersDelta }})
                </li>
              </ul>
            </template>
            <button
              type="button"
              class="btn btn-primary btn-sm w-fit"
              :disabled="sendReport.isPending.value"
              @click="onSendReport"
            >
              <span
                v-if="sendReport.isPending.value"
                class="loading loading-spinner loading-xs"
              />
              {{ t('ext.upload-post.analytics.sendReport') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Platform metric cards -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="[platform, metrics] in platformEntries"
          :key="platform"
          class="card bg-base-100 border border-base-300"
        >
          <div class="card-body p-4 gap-2">
            <h4 class="font-semibold">
              {{ t(`ext.upload-post.platforms.${platform}`) }}
            </h4>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <span>{{ t('ext.upload-post.analytics.followers') }}: {{ metrics.followers ?? '—' }}</span>
              <span>{{ t('ext.upload-post.analytics.reach') }}: {{ metrics.reach ?? '—' }}</span>
              <span>{{ t('ext.upload-post.analytics.views') }}: {{ metrics.views ?? '—' }}</span>
              <span>{{ t('ext.upload-post.analytics.likes') }}: {{ metrics.likes ?? '—' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>