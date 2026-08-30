<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Clock, BadgeCheck, Euro, CalendarCheck, Plus, Copy } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import { useMyProfileQuery, useMySummaryQuery, useMyReferralsQuery } from '@affiliate/composables/useAffiliate';
import type { Referral } from '../../../types';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t, d } = useI18n();
const authStore = useAuthStore();

const { data: profile, isLoading: profileLoading } = useMyProfileQuery();
const { data: summary, isLoading: summaryLoading } = useMySummaryQuery();
const { data: referralsData } = useMyReferralsQuery();

const partnerName = computed(() => profile.value?.name || authStore.user?.firstName || '—');
const recentReferrals = computed<Referral[]>(() => {
  const list = Array.isArray(referralsData.value) ? referralsData.value : (referralsData.value?.data ?? []);
  return list.slice(0, 5);
});

const stats = computed(() => [
  { label: t('ext.affiliate.portal.pending'), value: summary.value?.pendingTotal ?? 0, icon: Clock, color: 'warning' as const },
  { label: t('ext.affiliate.portal.approved'), value: summary.value?.approvedTotal ?? 0, icon: BadgeCheck, color: 'info' as const },
  { label: t('ext.affiliate.portal.paidTotal'), value: summary.value?.paidTotal ?? 0, icon: Euro, color: 'success' as const },
  { label: t('ext.affiliate.portal.paidThisMonth'), value: summary.value?.paidThisMonth ?? 0, icon: CalendarCheck, color: 'primary' as const },
]);

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

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

async function copyCode() {
  if (!profile.value?.code) return;
  try {
    await navigator.clipboard.writeText(profile.value.code);
    toast.success(t('ext.affiliate.portal.yourCode'));
  } catch {
    toast.error(t('ext.affiliate.common.error'));
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div v-if="profileLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Hero -->
      <div class="hero bg-gradient-to-r from-primary/10 to-secondary/10 rounded-box border border-base-300">
        <div class="hero-content flex-col lg:flex-row justify-between w-full py-8">
          <div>
            <h1 class="text-2xl font-bold">{{ t('ext.affiliate.portal.welcome', { name: partnerName }) }}</h1>
            <p class="text-base-content/60 mt-1">{{ t('ext.affiliate.portal.welcomeSub') }}</p>
            <button
              v-if="profile?.code"
              class="btn btn-outline btn-xs mt-3 font-mono"
              @click="copyCode"
            >
              <Copy class="w-3 h-3" />
              {{ profile.code }}
            </button>
          </div>
          <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary">
            <Plus class="w-4 h-4" />
            {{ t('ext.affiliate.portal.newReferral') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Summary -->
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

      <!-- Recent referrals -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300 flex items-center justify-between">
            <h2 class="card-title text-base">{{ t('ext.affiliate.portal.recentReferrals') }}</h2>
            <NuxtLink to="/app/portal/referrals" class="btn btn-ghost btn-xs">
              {{ t('ext.affiliate.portal.viewAll') }}
            </NuxtLink>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>{{ t('ext.affiliate.referralForm.clientName') }}</th>
                  <th>{{ t('ext.affiliate.referrals.status') }}</th>
                  <th>{{ t('ext.affiliate.referrals.date') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!recentReferrals.length">
                  <td colspan="3" class="text-center py-8">
                    <p class="text-base-content/60">{{ t('ext.affiliate.portal.noReferrals') }}</p>
                    <p class="text-xs text-base-content/40 mt-1">{{ t('ext.affiliate.portal.noReferralsHint') }}</p>
                  </td>
                </tr>
                <tr v-for="r in recentReferrals" :key="r.id">
                  <td class="font-medium">{{ r.client?.name ?? '—' }}</td>
                  <td>
                    <span class="badge badge-sm" :class="statusBadge(r.status)">
                      {{ t(`ext.affiliate.status.${r.status}`) }}
                    </span>
                  </td>
                  <td>{{ formatDate(r.referredAt ?? r.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>