<script setup lang="ts">
import { computed, ref  } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Users,
  UserCheck,
  Euro,
  Clock,
  BadgeCheck,
  CalendarCheck,
} from 'lucide-vue-next';
import StatCard from '@base/ui-app/components/dashboard/StatCard.vue';
import CommissionModal from './CommissionModal.vue';
import type { PartnerPipeline, PipelineLine } from '@affiliate/composables/useAffiliate';
import type { DaisyVariant } from '@base/ui-app/components/dashboard/types';

const { t, d } = useI18n();

const props = defineProps<{
  data: PartnerPipeline;
  loading?: boolean;
}>();

const commissionLine = ref<PipelineLine | null>(null);

const stats = computed(() => [
  { label: t('ext.affiliate.pipeline.referrals'), value: props.data.totals.referrals, icon: Users, color: 'primary' as DaisyVariant },
  { label: t('ext.affiliate.pipeline.converted'), value: props.data.totals.converted, icon: UserCheck, color: 'success' as DaisyVariant },
  { label: t('ext.affiliate.pipeline.billed'), value: props.data.totals.billed, icon: Euro, color: 'info' as DaisyVariant, isCurrency: true },
  { label: t('ext.affiliate.status.pending'), value: props.data.totals.pending, icon: Clock, color: 'warning' as DaisyVariant, isCurrency: true },
  { label: t('ext.affiliate.status.approved'), value: props.data.totals.approved, icon: BadgeCheck, color: 'info' as DaisyVariant, isCurrency: true },
  { label: t('ext.affiliate.status.paid'), value: props.data.totals.paid, icon: CalendarCheck, color: 'success' as DaisyVariant, isCurrency: true },
]);

const visibleStats = computed(() => stats.value.slice(0, 4));

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return d(new Date(value), { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Partner header -->
    <div class="flex flex-wrap items-center gap-3">
      <span class="badge badge-outline font-mono">{{ data.partner.code ?? '—' }}</span>
      <span class="font-medium">{{ data.partner.name }}</span>
      <span v-if="data.partner.companyName" class="text-base-content/50 text-sm">({{ data.partner.companyName }})</span>
      <span class="badge badge-primary badge-sm">
        {{ t('ext.affiliate.portal.commissionRate') }}: {{ ((data.partner.commissionRate ?? 0) * 100).toFixed(1).replace(/\.0$/, '') }}%
      </span>
    </div>

    <!-- Totals -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        v-for="stat in visibleStats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.isCurrency ? formatCurrency(stat.value as number) : (stat.value as number)"
        :icon="stat.icon"
        :color="stat.color"
        :loading="loading"
      />
    </div>

    <!-- Per-referral lines -->
    <div v-if="!data.lines.length" class="card bg-base-100 border border-base-300">
      <div class="card-body text-center text-base-content/50 py-8">
        {{ t('ext.affiliate.pipeline.noReferrals') }}
      </div>
    </div>

    <div
      v-for="line in data.lines"
      :key="line.referralId"
      class="card bg-base-100 shadow-sm border border-base-300"
    >
      <div class="card-body p-5">
        <!-- Line header -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <h3 class="card-title text-base">{{ line.clientName }}</h3>
            <span v-if="line.companyName" class="text-base-content/50 text-sm">{{ line.companyName }}</span>
            <span class="badge badge-sm" :class="line.referralStatus === 'converted' ? 'badge-success' : line.referralStatus === 'rejected' ? 'badge-error' : 'badge-warning'">
              {{ t(`ext.affiliate.status.${line.referralStatus}`) }}
            </span>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span class="text-base-content/60">
              {{ t('ext.affiliate.pipeline.referred') }}: {{ formatDate(line.referredAt) }}
            </span>
            <span class="font-semibold tabular-nums">{{ formatCurrency(line.billedTotal) }}</span>
            <span class="font-bold tabular-nums text-primary">{{ formatCurrency(line.commissionTotal) }}</span>
            <button
              v-if="line.referralStatus !== 'rejected'"
              class="btn btn-xs btn-primary btn-outline"
              @click="commissionLine = line"
            >
              + {{ t('ext.affiliate.commissions.add') }}
            </button>
          </div>
        </div>

        <!-- Projects / commissions table -->
        <div v-if="line.projects.length" class="overflow-x-auto mt-2">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>{{ t('ext.affiliate.pipeline.project') }}</th>
                <th>{{ t('ext.affiliate.pipeline.price') }}</th>
                <th>{{ t('ext.affiliate.pipeline.projectStatus') }}</th>
                <th>{{ t('ext.affiliate.commissions.amount') }}</th>
                <th>{{ t('ext.affiliate.commissions.status') }}</th>
                <th>{{ t('ext.affiliate.commissions.paidAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="proj in line.projects" :key="proj.projectId">
                <td class="font-medium">{{ proj.projectName }}</td>
                <td class="tabular-nums">{{ formatCurrency(proj.price) }}</td>
                <td>
                  <span
                    v-if="proj.projectStatus"
                    class="badge badge-sm badge-ghost"
                  >
                    {{ t(`ext.crm.projects.statusOptions.${proj.projectStatus}`, proj.projectStatus) }}
                  </span>
                  <span v-else>—</span>
                </td>
                <td class="tabular-nums font-semibold">{{ proj.commission ? formatCurrency(proj.commission.amount) : '—' }}</td>
                <td>
                  <span v-if="proj.commission" class="badge badge-sm" :class="proj.commission.status === 'paid' ? 'badge-success' : proj.commission.status === 'approved' ? 'badge-info' : 'badge-warning'">
                    {{ t(`ext.affiliate.status.${proj.commission.status}`) }}
                  </span>
                  <span v-else class="text-base-content/40">{{ t('ext.affiliate.pipeline.noCommission') }}</span>
                </td>
                <td>{{ formatDate(proj.commission?.paidAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-base-content/40 mt-2">
          {{ t('ext.affiliate.pipeline.noProjects') }}
          <button
            v-if="line.referralStatus !== 'rejected'"
            class="btn btn-xs btn-primary btn-outline ml-2"
            @click="commissionLine = line"
          >
            + {{ t('ext.affiliate.commissions.add') }}
          </button>
        </p>
      </div>
    </div>
  </div>

  <CommissionModal
    v-if="commissionLine"
    :line="commissionLine"
    @close="commissionLine = null"
  />
</template>
